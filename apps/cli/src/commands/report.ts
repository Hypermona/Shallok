import { CatalogStorage, generateProjectStatusReport, validateCatalogs } from '@shallok/core';
import { Printer } from '../output/printer.js';

export async function reportCommand(options: { json?: boolean }): Promise<void> {
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

  const statusReport = generateProjectStatusReport({
    manifest,
    canonicalCatalog: canonical,
    localeCatalogs,
    lastExtractionAt: metadata?.last_extraction_at || null,
  });

  const validation = validateCatalogs({
    manifest,
    canonicalCatalog: canonical,
    localeCatalogs,
  });

  const fullReport = {
    generatedAt: new Date().toISOString(),
    status: statusReport,
    validation,
  };

  if (options.json) {
    printer.json(fullReport);
    return;
  }

  printer.header('Shallok • Localization Health Report');
  printer.log(`Framework: ${manifest.framework.name} (${manifest.framework.router || 'standard'})`);
  printer.log(`Library: ${manifest.framework.localization_library}`);
  printer.log(`Source Locale: ${manifest.source_locale}`);
  printer.log(`Supported Locales: ${manifest.supported_locales.join(', ')}`);
  printer.log(`Total Keys: ${statusReport.totalKeys} (Active: ${statusReport.activeKeys}, Obsolete: ${statusReport.obsoleteKeys})`);
  printer.log(`Overall Completeness: ${statusReport.overallCompletenessPercentage}%`);
  printer.divider();

  for (const loc of Object.values(statusReport.locales)) {
    printer.log(
      `Locale [${loc.locale}]: ${loc.completenessPercentage}% | Translated: ${loc.translatedCount} | Missing: ${loc.missingCount} | Stale: ${loc.staleCount}`
    );
  }

  printer.divider();
  if (validation.valid) {
    printer.success('Catalog integrity validation passed with 0 errors.');
  } else {
    printer.warn(`Catalog integrity issues detected: ${validation.errors.length} error(s).`);
  }
}
