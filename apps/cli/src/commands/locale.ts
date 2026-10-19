import { CatalogStorage } from '@shallok/core';
import { Printer } from '../output/printer.js';

export async function localeAddCommand(
  locale: string,
  options: { json?: boolean }
): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const storage = new CatalogStorage(cwd);

  const manifest = await storage.readManifest();
  if (!manifest) {
    printer.error('No localization.json found. Run "localize init" first.');
    process.exit(1);
  }

  const cleanLocale = locale.trim().toLowerCase();
  if (manifest.supported_locales.includes(cleanLocale)) {
    printer.warn(`Locale "${cleanLocale}" is already in supported_locales.`);
    return;
  }

  manifest.supported_locales.push(cleanLocale);
  await storage.writeManifest(manifest);

  // Initialize empty or existing locale catalog
  const existingCatalog = await storage.readLocaleCatalog(
    cleanLocale,
    manifest.paths.translations_directory
  );
  await storage.writeLocaleCatalog(
    cleanLocale,
    existingCatalog,
    manifest.paths.translations_directory
  );

  if (options.json) {
    printer.json({
      success: true,
      action: 'add',
      locale: cleanLocale,
      supported_locales: manifest.supported_locales,
    });
    return;
  }

  printer.success(`Added locale "${cleanLocale}" to supported_locales.`);
  printer.info(`Run "localize translate --locale ${cleanLocale}" to generate translations for this locale.`);
}

export async function localeRemoveCommand(
  locale: string,
  options: { json?: boolean }
): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const storage = new CatalogStorage(cwd);

  const manifest = await storage.readManifest();
  if (!manifest) {
    printer.error('No localization.json found. Run "localize init" first.');
    process.exit(1);
  }

  const cleanLocale = locale.trim().toLowerCase();
  if (cleanLocale === manifest.source_locale) {
    printer.error(`Cannot remove source locale "${cleanLocale}".`);
    process.exit(1);
  }

  if (!manifest.supported_locales.includes(cleanLocale)) {
    printer.warn(`Locale "${cleanLocale}" is not in supported_locales.`);
    return;
  }

  manifest.supported_locales = manifest.supported_locales.filter((l) => l !== cleanLocale);
  await storage.writeManifest(manifest);

  if (options.json) {
    printer.json({
      success: true,
      action: 'remove',
      locale: cleanLocale,
      supported_locales: manifest.supported_locales,
    });
    return;
  }

  printer.success(`Removed locale "${cleanLocale}" from supported_locales.`);
  printer.info(`The catalog file in messages/${cleanLocale}.json was preserved for safety.`);
}
