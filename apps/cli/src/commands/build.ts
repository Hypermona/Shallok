import { CatalogStorage } from '@shallok/core';
import { getAdapter } from '@shallok/framework-adapters';
import { Printer } from '../output/printer.js';

export async function buildCommand(options: { format?: 'flat' | 'nested'; json?: boolean }): Promise<void> {
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

  const adapter = getAdapter(manifest.framework.name);

  try {
    const writtenFiles = await adapter.writeRuntimeMessages(cwd, {
      manifest,
      canonicalCatalog: canonical,
      localeCatalogs,
      format: options.format || (manifest.framework.name === 'vue' ? 'nested' : 'flat'),
    });

    if (options.json) {
      printer.json({
        success: true,
        writtenFiles,
      });
      return;
    }

    printer.header('Shallok • Runtime Messages Build');
    printer.success(`Successfully built runtime message files (${writtenFiles.length} files):`);
    for (const f of writtenFiles) {
      printer.log(`  ✔ ${f}`);
    }
  } catch (err: any) {
    printer.error(`Build failed: ${err.message}`);
    process.exit(1);
  }
}
