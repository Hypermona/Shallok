import path from 'node:path';
import fs from 'node:fs/promises';
import {
  analyzeProject,
  CatalogStorage,
  LocalizationManifest,
  LocalizationManifestSchema,
} from '@shallok/core';
import { getAdapter } from '@shallok/framework-adapters';
import { Printer } from '../output/printer.js';
import { installSkillsForProject } from '../installer/skills-installer.js';
import { CLI_VERSION } from '../version.js';

export interface InitOptions {
  source?: string;
  locales?: string;
  framework?: string;
  yes?: boolean;
  json?: boolean;
}

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const storage = new CatalogStorage(cwd);

  try {
    printer.log('Analyzing project...');
    const analysis = await analyzeProject(cwd);

    const sourceLocale = options.source || analysis.suggestedLocales.source || 'en';
    const targetLocales = options.locales
      ? options.locales.split(',').map((s) => s.trim().toLowerCase())
      : analysis.suggestedLocales.targets || ['kn', 'hi'];

    const supportedLocales = [...new Set([sourceLocale, ...targetLocales])];

    const frameworkName = (options.framework || analysis.framework.name || 'react') as any;
    const adapter = getAdapter(frameworkName);

    const manifest: LocalizationManifest = {
      schema_version: 1,
      localization_version: 1,
      source_locale: sourceLocale,
      supported_locales: supportedLocales,
      framework: {
        name: frameworkName,
        router: analysis.framework.router,
        localization_library: adapter.library,
        library_version: analysis.framework.library_version,
      },
      paths: {
        source_directories: analysis.sourceDirectories.length > 0 ? analysis.sourceDirectories : ['src'],
        base_directory: 'localization_base',
        translations_directory: 'messages',
      },
      key_strategy: 'semantic',
      translation: {
        provider: 'mock',
        model: null,
        batch_size: 25,
      },
      options: {
        include_accessibility_text: true,
        preserve_obsolete_keys: true,
        require_review_for_ambiguous_strings: true,
        require_review_for_stale_translations: true,
      },
    };

    // 1. Write manifest
    await storage.writeManifest(manifest);

    // 2. Initialize base directory and canonical catalog if not existing
    const baseDir = path.resolve(cwd, manifest.paths.base_directory);
    await fs.mkdir(baseDir, { recursive: true });

    const existingCanonical = await storage.readCanonicalCatalog(
      manifest.paths.base_directory,
      sourceLocale
    );
    await storage.writeCanonicalCatalog(
      existingCanonical,
      manifest.paths.base_directory,
      sourceLocale
    );

    const now = new Date().toISOString();
    await storage.writeMetadata(
      {
        tool_name: 'shallok',
        tool_version: CLI_VERSION,
        schema_version: 1,
        last_extraction_at: now,
        total_keys: Object.keys(existingCanonical).length,
        active_keys: Object.values(existingCanonical).filter((k) => k.status === 'active').length,
        obsolete_keys: Object.values(existingCanonical).filter((k) => k.status === 'obsolete').length,
      },
      manifest.paths.base_directory
    );

    // 3. Initialize messages directory and locale catalogs
    const messagesDir = path.resolve(cwd, manifest.paths.translations_directory);
    await fs.mkdir(messagesDir, { recursive: true });

    for (const loc of supportedLocales) {
      const existingLocCatalog = await storage.readLocaleCatalog(loc, manifest.paths.translations_directory);
      await storage.writeLocaleCatalog(loc, existingLocCatalog, manifest.paths.translations_directory);
    }

    // 4. Initialize Framework adapter
    const adapterResult = await adapter.initialize(cwd, {
      sourceLocale,
      supportedLocales,
      router: analysis.framework.router,
    });

    // 5. Install shallok dependency and add agent skills
    const skillsResult = await installSkillsForProject(cwd, frameworkName);

    if (options.json) {
      printer.json({
        success: true,
        manifest,
        adapterResult,
        skillsResult,
      });
      return;
    }

    printer.success('Localization initialized successfully!');
    printer.info(`Created localization.json`);
    printer.info(`Created base directory: ${manifest.paths.base_directory}/`);
    printer.info(`Created messages directory: ${manifest.paths.translations_directory}/`);
    for (const f of adapterResult.createdFiles) {
      printer.info(`Generated adapter file: ${f}`);
    }
    if (skillsResult.dependencyInstalled) {
      printer.info(`Installed shallok in devDependencies (${skillsResult.packageManager})`);
    }
    for (const skill of skillsResult.copiedSkills) {
      printer.info(`Added AI agent skill: ${skill} (.agents/skills/ & skills/)`);
    }
  } catch (err: any) {
    printer.error(`Initialization failed: ${err.message}`);
    process.exit(1);
  }
}

