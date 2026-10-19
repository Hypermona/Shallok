import { CanonicalCatalog, LocaleCatalog } from '../types/catalog.js';
import { LocalizationManifest } from '../types/manifest.js';

export interface ValidationError {
  key: string;
  locale: string;
  type: 'missing_key' | 'stale_version' | 'missing_placeholder' | 'extra_placeholder' | 'empty_value';
  message: string;
  expected?: string;
  actual?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Extracts ICU / mustache style placeholders from text, e.g. {name}, {count}.
 */
export function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{([a-zA-Z0-9_]+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1)).sort();
}

/**
 * Validates canonical and locale catalogs against freshness, completeness,
 * and placeholder integrity rules.
 */
export function validateCatalogs(options: {
  manifest: LocalizationManifest;
  canonicalCatalog: CanonicalCatalog;
  localeCatalogs: Record<string, LocaleCatalog>;
}): ValidationResult {
  const { manifest, canonicalCatalog, localeCatalogs } = options;
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const activeCanonicalEntries = Object.entries(canonicalCatalog).filter(
    ([, entry]) => entry.status === 'active'
  );

  for (const targetLocale of manifest.supported_locales) {
    if (targetLocale === manifest.source_locale) {
      continue;
    }

    const locCatalog = localeCatalogs[targetLocale] || {};

    for (const [key, canonical] of activeCanonicalEntries) {
      const targetEntry = locCatalog[key];

      if (!targetEntry || !targetEntry.value || targetEntry.status === 'missing') {
        errors.push({
          key,
          locale: targetLocale,
          type: 'missing_key',
          message: `Key "${key}" is missing translation in locale "${targetLocale}".`,
        });
        continue;
      }

      if (targetEntry.source_version !== canonical.key_version || targetEntry.status === 'stale') {
        warnings.push({
          key,
          locale: targetLocale,
          type: 'stale_version',
          message: `Key "${key}" in locale "${targetLocale}" is stale (source version: ${canonical.key_version}, translation version: ${targetEntry.source_version}).`,
          expected: String(canonical.key_version),
          actual: String(targetEntry.source_version),
        });
      }

      // Check placeholder parity
      const sourcePlaceholders = extractPlaceholders(canonical.content);
      const targetPlaceholders = extractPlaceholders(targetEntry.value);

      for (const ph of sourcePlaceholders) {
        if (!targetPlaceholders.includes(ph)) {
          errors.push({
            key,
            locale: targetLocale,
            type: 'missing_placeholder',
            message: `Key "${key}" in locale "${targetLocale}" is missing placeholder "{${ph}}".`,
            expected: ph,
          });
        }
      }

      for (const ph of targetPlaceholders) {
        if (!sourcePlaceholders.includes(ph)) {
          warnings.push({
            key,
            locale: targetLocale,
            type: 'extra_placeholder',
            message: `Key "${key}" in locale "${targetLocale}" contains extra placeholder "{${ph}}" not found in source text.`,
            actual: ph,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
