import React from 'react';
import { render } from 'ink';
import { CatalogStorage } from '@shallok/core';
import {
  MockTranslationProvider,
  LLMTranslationProvider,
  TranslationOrchestrator,
  ITranslationProvider,
} from '@shallok/translation-providers';
import { Printer } from '../output/printer.js';
import { TranslateProgress } from '../ui/TranslateProgress.js';

export interface TranslateCommandOptions {
  locale?: string;
  provider?: string;
  batchSize?: number;
  force?: boolean;
  json?: boolean;
}

export async function translateCommand(options: TranslateCommandOptions): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const storage = new CatalogStorage(cwd);

  const manifest = await storage.readManifest();
  if (!manifest) {
    printer.error('No localization.json found. Run "localize init" first.');
    process.exit(1);
  }

  const canonical = await storage.readCanonicalCatalog(
    manifest.paths.base_directory,
    manifest.source_locale
  );

  const targetLocales = options.locale
    ? [options.locale]
    : manifest.supported_locales.filter((l) => l !== manifest.source_locale);

  // Read current locale catalogs
  const localeCatalogs = await storage.readAllLocaleCatalogs(
    manifest.supported_locales,
    manifest.paths.translations_directory
  );

  // Determine provider
  const providerName = options.provider || manifest.translation.provider || 'mock';
  let provider: ITranslationProvider;

  if (providerName === 'llm') {
    provider = new LLMTranslationProvider({
      model: manifest.translation.model || undefined,
    });
  } else {
    provider = new MockTranslationProvider();
  }

  const orchestrator = new TranslationOrchestrator(provider);

  try {
    const summaries = await orchestrator.translateLocales({
      canonicalCatalog: canonical,
      localeCatalogs,
      sourceLocale: manifest.source_locale,
      targetLocales,
      batchSize: options.batchSize || manifest.translation.batch_size || 25,
      forceAll: options.force,
    });

    // Save updated locale catalogs
    for (const loc of targetLocales) {
      if (localeCatalogs[loc]) {
        await storage.writeLocaleCatalog(
          loc,
          localeCatalogs[loc],
          manifest.paths.translations_directory
        );
      }
    }

    if (options.json) {
      printer.json(summaries);
      return;
    }

    if (process.stdout.isTTY) {
      render(React.createElement(TranslateProgress, { summaries }));
    } else {
      printer.header('Shallok • Translation Execution');
      for (const sum of Object.values(summaries)) {
        printer.log(
          `[${sum.locale.toUpperCase()}]: ${sum.translated} translated, ${sum.skipped} skipped, ${sum.failed} failed`
        );
      }
    }
  } catch (err: any) {
    printer.error(`Translation failed: ${err.message}`);
    process.exit(1);
  }
}
