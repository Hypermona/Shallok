import { CatalogStorage, validateCatalogs } from '@shallok/core';
import { Printer } from '../output/printer.js';

export async function validateCommand(options: { json?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const storage = new CatalogStorage(cwd);

  const manifest = await storage.readManifest();
  if (!manifest) {
    printer.error('No localization.json found. Run "shallok init" first.');
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

  const validation = validateCatalogs({
    manifest,
    canonicalCatalog: canonical,
    localeCatalogs,
  });

  if (options.json) {
    printer.json(validation);
    if (!validation.valid) {
      process.exit(1);
    }
    return;
  }

  printer.header('Shallok • Catalog Validation');

  if (validation.warnings.length > 0) {
    printer.warn(`Found ${validation.warnings.length} warning(s):`);
    for (const w of validation.warnings) {
      printer.log(`  ⚠ [${w.locale}] ${w.key}: ${w.message}`);
    }
  }

  if (validation.errors.length > 0) {
    printer.error(`Validation failed with ${validation.errors.length} error(s):`);
    for (const e of validation.errors) {
      printer.log(`  ✖ [${e.locale}] ${e.key}: ${e.message}`);
    }
    process.exit(1);
  } else {
    printer.success('Catalog validation passed! All required checks succeeded.');
  }
}
