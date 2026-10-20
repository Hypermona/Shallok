import { CatalogStorage } from '@shallok/core';
import { Printer } from '../output/printer.js';

export async function entrySetCommand(
  locale: string,
  key: string,
  translatedValue: string,
  options: { json?: boolean }
): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const storage = new CatalogStorage(cwd);

  const manifest = await storage.readManifest();
  if (!manifest) {
    printer.error('No localization.json found. Run "shallok init" first.');
    process.exit(1);
  }

  const cleanLocale = locale.trim().toLowerCase();
  const canonical = await storage.readCanonicalCatalog(
    manifest.paths.base_directory,
    manifest.source_locale
  );

  const canonicalEntry = canonical[key];
  if (!canonicalEntry) {
    printer.error(`Key "${key}" not found in canonical catalog.`);
    process.exit(1);
  }

  const localeCatalog = await storage.readLocaleCatalog(
    cleanLocale,
    manifest.paths.translations_directory
  );

  const now = new Date().toISOString();
  localeCatalog[key] = {
    value: translatedValue,
    source_version: canonicalEntry.key_version,
    translated_at: now,
    status: 'translated',
  };

  await storage.writeLocaleCatalog(
    cleanLocale,
    localeCatalog,
    manifest.paths.translations_directory
  );

  if (options.json) {
    printer.json({
      success: true,
      locale: cleanLocale,
      key,
      value: translatedValue,
      source_version: canonicalEntry.key_version,
      translated_at: now,
    });
    return;
  }

  printer.success(`Updated translation for [${cleanLocale}] "${key}":`);
  printer.log(`  "${translatedValue}" (version: ${canonicalEntry.key_version})`);
}
