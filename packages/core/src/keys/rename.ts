import fs from 'node:fs/promises';
import path from 'node:path';
import { CanonicalCatalog, LocaleCatalog } from '../types/catalog.js';

export interface RenameKeyResult {
  oldKey: string;
  newKey: string;
  canonicalUpdated: boolean;
  localesUpdated: string[];
  filesModified: string[];
}

/**
 * Safely renames a key across canonical catalog, locale catalogs, and source references.
 */
export async function renameKey(options: {
  projectRoot: string;
  oldKey: string;
  newKey: string;
  canonicalCatalog: CanonicalCatalog;
  localeCatalogs: Record<string, LocaleCatalog>;
}): Promise<RenameKeyResult> {
  const { projectRoot, oldKey, newKey, canonicalCatalog, localeCatalogs } = options;

  if (!canonicalCatalog[oldKey]) {
    throw new Error(`Key "${oldKey}" not found in canonical catalog.`);
  }

  if (canonicalCatalog[newKey]) {
    throw new Error(`Cannot rename to "${newKey}": key already exists in catalog.`);
  }

  // 1. Update canonical catalog
  const entry = { ...canonicalCatalog[oldKey], key: newKey };
  canonicalCatalog[newKey] = entry;
  delete canonicalCatalog[oldKey];

  // 2. Update locale catalogs
  const localesUpdated: string[] = [];
  for (const [locale, catalog] of Object.entries(localeCatalogs)) {
    if (catalog[oldKey]) {
      catalog[newKey] = { ...catalog[oldKey] };
      delete catalog[oldKey];
      localesUpdated.push(locale);
    }
  }

  // 3. Update source files where oldKey occurred
  const filesModified: string[] = [];
  const occurrences = entry.occurrences || [];
  const uniqueFilePaths = [...new Set(occurrences.map((o) => o.relative_file_path))];

  for (const relPath of uniqueFilePaths) {
    const fullPath = path.resolve(projectRoot, relPath);
    try {
      const code = await fs.readFile(fullPath, 'utf8');
      // Replace literal string occurrences of oldKey in quotes: 'oldKey' or "oldKey"
      const escapedOld = oldKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(['"\`])${escapedOld}\\1`, 'g');
      if (regex.test(code)) {
        const updatedCode = code.replace(regex, `$1${newKey}$1`);
        await fs.writeFile(fullPath, updatedCode, 'utf8');
        filesModified.push(relPath);
      }
    } catch {
      // File might have moved or be missing; do not throw
    }
  }

  return {
    oldKey,
    newKey,
    canonicalUpdated: true,
    localesUpdated,
    filesModified,
  };
}
