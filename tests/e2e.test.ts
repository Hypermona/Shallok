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

  it('installs shallok into devDependencies and copies skills into .agents/skills/ and skills/', async () => {
    const { installSkillsForProject } = await import('../apps/cli/src/installer/skills-installer.js');

    // Create a mock application package.json
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'my-mobile-app', version: '1.0.0' }, null, 2),
      'utf8'
    );

    const result = await installSkillsForProject(tempDir, 'expo');

    expect(result.copiedSkills).toContain('expo-localization-and-translation-i18n');
    expect(result.copiedSkills).toContain('localization-and-translation-i18n');

    // Verify .agents/skills/
    const agentSkillFile = path.join(
      tempDir,
      '.agents',
      'skills',
      'expo-localization-and-translation-i18n',
      'SKILL.md'
    );
    const coreSkillFile = path.join(
      tempDir,
      '.agents',
      'skills',
      'localization-and-translation-i18n',
      'SKILL.md'
    );
    expect(await fs.stat(agentSkillFile)).toBeDefined();
    expect(await fs.stat(coreSkillFile)).toBeDefined();

    // Verify package.json updated with devDependencies.shallok
    const updatedPkg = JSON.parse(await fs.readFile(path.join(tempDir, 'package.json'), 'utf8'));
    expect(updatedPkg.devDependencies?.shallok).toBeDefined();
  });
});

