import { CatalogStorage, computeContentHash } from '@shallok/core';
import { Printer } from '../output/printer.js';

export async function contextSetCommand(
  key: string,
  newContext: string,
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

  const entry = canonical[key];
  if (!entry) {
    printer.error(`Key "${key}" not found in canonical catalog.`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  entry.context = newContext.trim();
  entry.content_hash = computeContentHash(entry.content, entry.context);
  entry.last_updated_at = now;

  await storage.writeCanonicalCatalog(
    canonical,
    manifest.paths.base_directory,
    manifest.source_locale
  );

  if (options.json) {
    printer.json({
      success: true,
      key,
      context: entry.context,
      content_hash: entry.content_hash,
      last_updated_at: entry.last_updated_at,
    });
    return;
  }

  printer.success(`Updated context for key "${key}":`);
  printer.log(`  "${entry.context}"`);
}
