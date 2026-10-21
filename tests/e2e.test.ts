import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  CatalogStorage,
  extractStringsFromSource,
  transformSourceFile,
  reconcileCanonicalCatalog,
  reconcileLocaleCatalog,
  validateCatalogs,
  renameKey,
} from '../packages/core/src/index.js';
import {
  MockTranslationProvider,
  TranslationOrchestrator,
} from '../packages/translation-providers/src/index.js';
import { ReactAdapter } from '../packages/framework-adapters/src/index.js';

describe('End-to-End Localization Pipeline', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'shallok-e2e-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('executes the full lifecycle: Init -> Extract -> Reconcile -> Translate -> Validate -> Build', async () => {
    const storage = new CatalogStorage(tempDir);
    const adapter = new ReactAdapter();

    // 1. Initialize
    const manifest = {
      schema_version: 1,
      localization_version: 1,
      source_locale: 'en',
      supported_locales: ['en', 'kn', 'hi'],
      framework: {
        name: 'react' as const,
        router: null,
        localization_library: 'react-i18next' as const,
        library_version: null,
      },
      paths: {
        source_directories: ['src'],
        base_directory: 'localization_base',
        translations_directory: 'messages',
      },
      key_strategy: 'semantic' as const,
      translation: { provider: 'mock', model: null, batch_size: 25 },
      options: {
        include_accessibility_text: true,
        preserve_obsolete_keys: true,
        require_review_for_ambiguous_strings: true,
        require_review_for_stale_translations: true,
      },
    };

    await storage.writeManifest(manifest);

    // 2. Create sample source file
    const srcDir = path.resolve(tempDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    const sampleCode = `
      import React from 'react';
      export function Checkout() {
        return (
          <div>
            <h1>Checkout Summary</h1>
            <button>Pay now</button>
          </div>
        );
      }
    `;
    await fs.writeFile(path.resolve(srcDir, 'Checkout.tsx'), sampleCode, 'utf8');

    // 3. Extract strings
    const extractRes = extractStringsFromSource({
      filePath: 'src/Checkout.tsx',
      code: sampleCode,
      framework: 'react',
    });

    expect(extractRes.strings.length).toBe(2);
    expect(extractRes.strings.map((s) => s.content)).toContain('Pay now');

    // 4. Reconcile Canonical Catalog
    const canonicalReconcile = reconcileCanonicalCatalog({
      currentCatalog: {},
      extractedStrings: extractRes.strings,
    });

    await storage.writeCanonicalCatalog(canonicalReconcile.catalog, manifest.paths.base_directory, 'en');

    // Reconcile Locale Catalogs
    const localeCatalogs: Record<string, any> = {};
    for (const loc of manifest.supported_locales) {
      const recLoc = reconcileLocaleCatalog({
        canonicalCatalog: canonicalReconcile.catalog,
        localeCatalog: {},
        locale: loc,
      });
      localeCatalogs[loc] = recLoc.catalog;
      await storage.writeLocaleCatalog(loc, recLoc.catalog, manifest.paths.translations_directory);
    }

    // 5. Translate using Mock Provider (translates to kn & hi)
    const provider = new MockTranslationProvider();
    const orchestrator = new TranslationOrchestrator(provider);

    const summaries = await orchestrator.translateLocales({
      canonicalCatalog: canonicalReconcile.catalog,
      localeCatalogs,
      sourceLocale: 'en',
      targetLocales: ['kn', 'hi'],
    });

    expect(summaries.kn.translated).toBe(2);
    expect(summaries.hi.translated).toBe(2);

    // Verify Kannada translation for Pay now
    const payNowKey = Object.keys(canonicalReconcile.catalog).find((k) =>
      canonicalReconcile.catalog[k].content === 'Pay now'
    )!;

    expect(localeCatalogs.kn[payNowKey].value).toBe('ಈಗ ಪಾವತಿಸಿ');
    expect(localeCatalogs.hi[payNowKey].value).toBe('अभी भुगतान करें');

    // 6. Validate Catalogs
    const validation = validateCatalogs({
      manifest,
      canonicalCatalog: canonicalReconcile.catalog,
      localeCatalogs,
    });

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // 7. Build Runtime Messages
    const writtenFiles = await adapter.writeRuntimeMessages(tempDir, {
      manifest,
      canonicalCatalog: canonicalReconcile.catalog,
      localeCatalogs,
    });

    expect(writtenFiles.length).toBe(3); // en, kn, hi

    // Verify written runtime message file content
    const knRuntimeRaw = await fs.readFile(path.resolve(tempDir, 'messages/runtime/kn.json'), 'utf8');
    const knRuntime = JSON.parse(knRuntimeRaw);
    expect(knRuntime[payNowKey]).toBe('ಈಗ ಪಾವತಿಸಿ');

    // 8. Test Per-Key Versioning: Change "Pay now" to "Complete Payment"
    const updatedExtracted = [
      {
        suggestedKey: payNowKey,
        content: 'Complete Payment', // Changed!
        context: '',
        occurrence: { relative_file_path: 'src/Checkout.tsx', line: 6 },
      },
    ];

    const updatedReconcile = reconcileCanonicalCatalog({
      currentCatalog: canonicalReconcile.catalog,
      extractedStrings: updatedExtracted,
    });

    // Version must increment to 2
    expect(updatedReconcile.catalog[payNowKey].key_version).toBe(2);

    // Locale catalog must now mark this key STALE
    const staleReconcile = reconcileLocaleCatalog({
      canonicalCatalog: updatedReconcile.catalog,
      localeCatalog: localeCatalogs.kn,
      locale: 'kn',
    });

    expect(staleReconcile.staleCount).toBe(1);
    expect(staleReconcile.catalog[payNowKey].status).toBe('stale');
    expect(staleReconcile.catalog[payNowKey].value).toBe('ಈಗ ಪಾವತಿಸಿ'); // Value preserved
  });

  it('installs shallok into devDependencies and copies specific framework skill (not general fallback)', async () => {
    const { installSkillsForProject } = await import('../apps/cli/src/installer/skills-installer.js');

    // Create a mock application package.json
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'my-mobile-app', version: '1.0.0' }, null, 2),
      'utf8'
    );

    const result = await installSkillsForProject(tempDir, 'expo');

    expect(result.copiedSkills).toContain('expo-localization-and-translation-i18n');
    expect(result.copiedSkills).not.toContain('localization-and-translation-i18n');
    expect(result.copiedSkills).toHaveLength(1);

    // Verify .agents/skills/ has the expo skill
    const agentSkillFile = path.join(
      tempDir,
      '.agents',
      'skills',
      'expo-localization-and-translation-i18n',
      'SKILL.md'
    );
    expect(await fs.stat(agentSkillFile)).toBeDefined();

    // Verify package.json updated with devDependencies.shallok
    const updatedPkg = JSON.parse(await fs.readFile(path.join(tempDir, 'package.json'), 'utf8'));
    expect(updatedPkg.devDependencies?.shallok).toBeDefined();
  }, 30000);

  it('copies general fallback skill when project framework is not in specific skill set', async () => {
    const { installSkillsForProject } = await import('../apps/cli/src/installer/skills-installer.js');
    const fallbackDir = path.join(tempDir, 'fallback-project');
    await fs.mkdir(fallbackDir, { recursive: true });

    await fs.writeFile(
      path.join(fallbackDir, 'package.json'),
      JSON.stringify({ name: 'my-vue-app', version: '1.0.0', dependencies: { vue: '^3.0.0' } }, null, 2),
      'utf8'
    );

    const result = await installSkillsForProject(fallbackDir, 'vue');

    expect(result.copiedSkills).toEqual(['localization-and-translation-i18n']);

    const fallbackSkillFile = path.join(
      fallbackDir,
      '.agents',
      'skills',
      'localization-and-translation-i18n',
      'SKILL.md'
    );
    expect(await fs.stat(fallbackSkillFile)).toBeDefined();
  }, 30000);

  it('setupCommand installs dependency and copies skill without running any other command (no localization.json created)', async () => {
    const { setupCommand } = await import('../apps/cli/src/commands/setup.js');
    const setupDir = path.join(tempDir, 'setup-test-project');
    await fs.mkdir(setupDir, { recursive: true });

    await fs.writeFile(
      path.join(setupDir, 'package.json'),
      JSON.stringify({ name: 'react-app', version: '1.0.0', dependencies: { react: '^18.0.0' } }, null, 2),
      'utf8'
    );

    const prevCwd = process.cwd();
    try {
      process.chdir(setupDir);
      await setupCommand({ json: true });

      // Check package.json devDependencies
      const pkg = JSON.parse(await fs.readFile(path.join(setupDir, 'package.json'), 'utf8'));
      expect(pkg.devDependencies?.shallok).toBeDefined();

      // Check skill was copied
      const skillPath = path.join(setupDir, '.agents', 'skills', 'react-localization-and-translation-i18n', 'SKILL.md');
      expect(await fs.stat(skillPath)).toBeDefined();

      // Check that NO other command was run (no localization.json or localization_base/)
      let manifestExists = false;
      try {
        await fs.stat(path.join(setupDir, 'localization.json'));
        manifestExists = true;
      } catch {
        manifestExists = false;
      }
      expect(manifestExists).toBe(false);

      let baseDirExists = false;
      try {
        await fs.stat(path.join(setupDir, 'localization_base'));
        baseDirExists = true;
      } catch {
        baseDirExists = false;
      }
      expect(baseDirExists).toBe(false);
    } finally {
      process.chdir(prevCwd);
    }
  }, 30000);
});

