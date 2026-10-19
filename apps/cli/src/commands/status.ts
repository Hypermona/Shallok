import React from 'react';
import { render } from 'ink';
import { CatalogStorage, generateProjectStatusReport } from '@shallok/core';
import { Printer } from '../output/printer.js';
import { StatusView } from '../ui/StatusView.js';

export async function statusCommand(options: { json?: boolean }): Promise<void> {
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

  const localeCatalogs = await storage.readAllLocaleCatalogs(
    manifest.supported_locales,
    manifest.paths.translations_directory
  );

  const metadata = await storage.readMetadata(manifest.paths.base_directory);

  const report = generateProjectStatusReport({
    manifest,
    canonicalCatalog: canonical,
    localeCatalogs,
    lastExtractionAt: metadata?.last_extraction_at || null,
  });

  if (options.json) {
    printer.json(report);
    return;
  }

  if (process.stdout.isTTY) {
    render(React.createElement(StatusView, { report }));
  } else {
    printer.header('Shallok • Localization Status');
    printer.log(`Source Locale: ${report.sourceLocale}`);
    printer.log(`Active Keys: ${report.activeKeys} (${report.obsoleteKeys} obsolete)`);
    printer.log(`Overall Completeness: ${report.overallCompletenessPercentage}%`);
    for (const loc of Object.values(report.locales)) {
      printer.log(
        `[${loc.locale.toUpperCase()}]: ${loc.completenessPercentage}% (curr: ${loc.translatedCount}, miss: ${loc.missingCount}, stale: ${loc.staleCount})`
      );
    }
  }
}
