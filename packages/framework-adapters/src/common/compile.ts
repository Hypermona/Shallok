import { CanonicalCatalog, LocaleCatalog } from '@shallok/core';

/**
 * Converts a dotted key path like "checkout.pay_now" into nested object structure.
 */
function setNestedProperty(obj: Record<string, any>, keyPath: string, value: string): void {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

export function compileCatalogToRuntime(
  localeCatalog: LocaleCatalog,
  canonicalCatalog: CanonicalCatalog,
  format: 'flat' | 'nested' = 'flat'
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, canonical] of Object.entries(canonicalCatalog)) {
    if (canonical.status === 'obsolete') {
      continue;
    }

    const locEntry = localeCatalog[key];
    const value = locEntry && locEntry.value ? locEntry.value : canonical.content;

    if (format === 'nested') {
      setNestedProperty(result, key, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
