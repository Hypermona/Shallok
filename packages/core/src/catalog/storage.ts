import fs from 'node:fs/promises';
import path from 'node:path';
import {
  LocalizationManifest,
  LocalizationManifestSchema,
} from '../types/manifest.js';
import {
  CanonicalCatalog,
  CanonicalCatalogSchema,
  CatalogMetadata,
  CatalogMetadataSchema,
  LocaleCatalog,
  LocaleCatalogSchema,
} from '../types/catalog.js';

/**
 * Atomically writes JSON data to a file by writing to a temporary file first
 * and then renaming it.
 */
export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  const jsonContent = JSON.stringify(data, null, 2) + '\n';

  await fs.writeFile(tempPath, jsonContent, 'utf8');
  await fs.rename(tempPath, filePath);
}

/**
 * Reads and parses a JSON file, returning null if the file does not exist.
 */
export async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
}

/**
 * Sorts object keys recursively to produce deterministic JSON diffs.
 */
export function sortObjectKeys<T extends Record<string, any>>(obj: T): T {
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, any> = {};
  for (const key of sortedKeys) {
    result[key] = obj[key];
  }
  return result as T;
}

export class CatalogStorage {
  constructor(private projectRoot: string) {}

  getManifestPath(): string {
    return path.resolve(this.projectRoot, 'localization.json');
  }

  getCanonicalCatalogPath(baseDir: string, sourceLocale: string): string {
    return path.resolve(this.projectRoot, baseDir, `${sourceLocale}.json`);
  }

  getMetadataPath(baseDir: string): string {
    return path.resolve(this.projectRoot, baseDir, 'metadata.json');
  }

  getLocaleCatalogPath(translationsDir: string, locale: string): string {
    return path.resolve(this.projectRoot, translationsDir, `${locale}.json`);
  }

  async readManifest(): Promise<LocalizationManifest | null> {
    const raw = await readJsonIfExists<unknown>(this.getManifestPath());
    if (!raw) return null;
    return LocalizationManifestSchema.parse(raw);
  }

  async writeManifest(manifest: LocalizationManifest): Promise<void> {
    const validated = LocalizationManifestSchema.parse(manifest);
    await writeJsonAtomic(this.getManifestPath(), validated);
  }

  async readCanonicalCatalog(baseDir = 'localization_base', sourceLocale = 'en'): Promise<CanonicalCatalog> {
    const raw = await readJsonIfExists<unknown>(this.getCanonicalCatalogPath(baseDir, sourceLocale));
    if (!raw) return {};
    return CanonicalCatalogSchema.parse(raw);
  }

  async writeCanonicalCatalog(
    catalog: CanonicalCatalog,
    baseDir = 'localization_base',
    sourceLocale = 'en'
  ): Promise<void> {
    const sorted = sortObjectKeys(catalog);
    CanonicalCatalogSchema.parse(sorted);
    await writeJsonAtomic(this.getCanonicalCatalogPath(baseDir, sourceLocale), sorted);
  }

  async readMetadata(baseDir = 'localization_base'): Promise<CatalogMetadata | null> {
    const raw = await readJsonIfExists<unknown>(this.getMetadataPath(baseDir));
    if (!raw) return null;
    return CatalogMetadataSchema.parse(raw);
  }

  async writeMetadata(metadata: CatalogMetadata, baseDir = 'localization_base'): Promise<void> {
    const validated = CatalogMetadataSchema.parse(metadata);
    await writeJsonAtomic(this.getMetadataPath(baseDir), validated);
  }

  async readLocaleCatalog(locale: string, translationsDir = 'messages'): Promise<LocaleCatalog> {
    const raw = await readJsonIfExists<unknown>(this.getLocaleCatalogPath(translationsDir, locale));
    if (!raw) return {};
    return LocaleCatalogSchema.parse(raw);
  }

  async writeLocaleCatalog(
    locale: string,
    catalog: LocaleCatalog,
    translationsDir = 'messages'
  ): Promise<void> {
    const sorted = sortObjectKeys(catalog);
    LocaleCatalogSchema.parse(sorted);
    await writeJsonAtomic(this.getLocaleCatalogPath(translationsDir, locale), sorted);
  }

  async readAllLocaleCatalogs(
    locales: string[],
    translationsDir = 'messages'
  ): Promise<Record<string, LocaleCatalog>> {
    const catalogs: Record<string, LocaleCatalog> = {};
    for (const locale of locales) {
      catalogs[locale] = await this.readLocaleCatalog(locale, translationsDir);
    }
    return catalogs;
  }
}
