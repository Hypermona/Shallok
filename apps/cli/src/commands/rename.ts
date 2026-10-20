import { CatalogStorage, renameKey } from '@shallok/core';
import { Printer } from '../output/printer.js';

export async function renameCommand(
  oldKey: string,
  newKey: string,
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

  const canonical = await storage.readCanonicalCatalog(
    manifest.paths.base_directory,
    manifest.source_locale
  );

  const localeCatalogs = await storage.readAllLocaleCatalogs(
    manifest.supported_locales,
    manifest.paths.translations_directory
  );

  try {
    const result = await renameKey({
      projectRoot: cwd,
      oldKey,
      newKey,
      canonicalCatalog: canonical,
      localeCatalogs,
    });

    // Save updated catalogs
    await storage.writeCanonicalCatalog(
      canonical,
      manifest.paths.base_directory,
      manifest.source_locale
    );

    for (const loc of manifest.supported_locales) {
      if (localeCatalogs[loc]) {
        await storage.writeLocaleCatalog(
          loc,
          localeCatalogs[loc],
          manifest.paths.translations_directory
        );
      }
    }

    if (options.json) {
      printer.json({
        success: true,
        ...result,
      });
      return;
    }

    printer.header('Shallok • Key Renamed Successfully');
    printer.success(`Renamed "${oldKey}" → "${newKey}"`);
    printer.info(`Updated canonical catalog: ${manifest.paths.base_directory}/${manifest.source_locale}.json`);
    printer.info(`Updated locale catalogs: ${result.localesUpdated.join(', ')}`);
    if (result.filesModified.length > 0) {
      printer.info(`Updated source files: ${result.filesModified.join(', ')}`);
    }
  } catch (err: any) {
    printer.error(`Rename failed: ${err.message}`);
    process.exit(1);
  }
}
