import { CanonicalCatalog, CanonicalEntry, Occurrence, LocaleCatalog } from '../types/catalog.js';
import { ExtractedString } from '../types/extractor.js';
import { computeContentHash } from './hash.js';

export interface ReconciliationDiff {
  addedKeys: string[];
  modifiedKeys: string[];
  occurrenceUpdatedKeys: string[];
  obsoleteKeys: string[];
  reactivatedKeys: string[];
  unchangedKeys: string[];
  hasMeaningfulChanges: boolean;
}

export interface ReconcileResult {
  catalog: CanonicalCatalog;
  diff: ReconciliationDiff;
}

/**
 * Reconciles the canonical source catalog against newly extracted source strings.
 * Ensures deterministic per-key versioning and status tracking.
 */
export function reconcileCanonicalCatalog(options: {
  currentCatalog: CanonicalCatalog;
  extractedStrings: ExtractedString[];
  preserveObsoleteKeys?: boolean;
  now?: string;
}): ReconcileResult {
  const {
    currentCatalog,
    extractedStrings,
    preserveObsoleteKeys = true,
    now = new Date().toISOString(),
  } = options;

  const nextCatalog: CanonicalCatalog = {};
  const diff: ReconciliationDiff = {
    addedKeys: [],
    modifiedKeys: [],
    occurrenceUpdatedKeys: [],
    obsoleteKeys: [],
    reactivatedKeys: [],
    unchangedKeys: [],
    hasMeaningfulChanges: false,
  };

  // Group extracted occurrences by key
  const groupedExtracted = new Map<
    string,
    {
      content: string;
      context: string;
      hasExplicitComment: boolean;
      relative_file_path: string;
      occurrences: Occurrence[];
    }
  >();

  for (const item of extractedStrings) {
    const key = item.suggestedKey;
    const existing = groupedExtracted.get(key);
    if (!existing) {
      groupedExtracted.set(key, {
        content: item.content,
        context: item.context || '',
        hasExplicitComment: Boolean(item.hasExplicitComment),
        relative_file_path: item.occurrence.relative_file_path,
        occurrences: [item.occurrence],
      });
    } else {
      existing.occurrences.push(item.occurrence);
      if (item.hasExplicitComment) {
        existing.context = item.context;
        existing.hasExplicitComment = true;
      }
    }
  }

  // Process all extracted keys
  for (const [key, extracted] of groupedExtracted.entries()) {
    const existing = currentCatalog[key];

    // Determine resolved context:
    // 1. If extracted from code with an explicit comment (e.g. {/* context: ... */}), use that!
    // 2. Otherwise, if existing entry has curated context (e.g. set by AI agent), PRESERVE it!
    // 3. Otherwise, use newly derived AST context.
    let resolvedContext = extracted.context;
    if (existing && existing.content === extracted.content) {
      if (existing.context && !extracted.hasExplicitComment) {
        resolvedContext = existing.context;
      }
    }

    const contentHash = computeContentHash(extracted.content, resolvedContext);

    if (!existing) {
      // 1. New key
      nextCatalog[key] = {
        key,
        content: extracted.content,
        context: resolvedContext,
        relative_file_path: extracted.relative_file_path,
        occurrences: extracted.occurrences,
        last_updated_at: now,
        key_version: 1,
        content_hash: contentHash,
        status: 'active',
      };
      diff.addedKeys.push(key);
      diff.hasMeaningfulChanges = true;
    } else {
      // Key existed previously
      const wasObsolete = existing.status === 'obsolete';
      const contentChanged = existing.content_hash !== contentHash;

      // Check if occurrences changed
      const occurrencesChanged =
        JSON.stringify(existing.occurrences) !== JSON.stringify(extracted.occurrences) ||
        existing.relative_file_path !== extracted.relative_file_path;

      if (contentChanged) {
        // Translation-relevant change: increment key_version
        nextCatalog[key] = {
          ...existing,
          content: extracted.content,
          context: resolvedContext,
          relative_file_path: extracted.relative_file_path,
          occurrences: extracted.occurrences,
          last_updated_at: now,
          key_version: existing.key_version + 1,
          content_hash: contentHash,
          status: 'active',
        };
        diff.modifiedKeys.push(key);
        diff.hasMeaningfulChanges = true;
        if (wasObsolete) {
          diff.reactivatedKeys.push(key);
        }
      } else if (wasObsolete) {
        // Reactivated without content change: preserve version
        nextCatalog[key] = {
          ...existing,
          context: resolvedContext,
          relative_file_path: extracted.relative_file_path,
          occurrences: extracted.occurrences,
          status: 'active',
        };
        diff.reactivatedKeys.push(key);
        diff.hasMeaningfulChanges = true;
      } else if (occurrencesChanged) {
        // File moved or occurrence updated: preserve version and timestamp
        nextCatalog[key] = {
          ...existing,
          context: resolvedContext,
          relative_file_path: extracted.relative_file_path,
          occurrences: extracted.occurrences,
        };
        diff.occurrenceUpdatedKeys.push(key);
      } else {
        // Entirely unchanged
        nextCatalog[key] = {
          ...existing,
          context: resolvedContext,
        };
        diff.unchangedKeys.push(key);
      }
    }
  }

  // Process keys in currentCatalog that are not in the new extracted set
  for (const [key, existing] of Object.entries(currentCatalog)) {
    if (!groupedExtracted.has(key)) {
      if (existing.status === 'active') {
        if (preserveObsoleteKeys) {
          nextCatalog[key] = {
            ...existing,
            status: 'obsolete',
            occurrences: [],
          };
          diff.obsoleteKeys.push(key);
          diff.hasMeaningfulChanges = true;
        }
        // If preserveObsoleteKeys is false, omit from nextCatalog
      } else if (preserveObsoleteKeys) {
        // Already obsolete, preserve
        nextCatalog[key] = { ...existing };
      }
    }
  }

  return { catalog: nextCatalog, diff };
}

/**
 * Reconciles a locale catalog against the canonical catalog,
 * marking missing or stale entries while preserving existing translations.
 */
export function reconcileLocaleCatalog(options: {
  canonicalCatalog: CanonicalCatalog;
  localeCatalog: LocaleCatalog;
  locale: string;
}): { catalog: LocaleCatalog; staleCount: number; missingCount: number } {
  const { canonicalCatalog, localeCatalog } = options;
  const nextLocaleCatalog: LocaleCatalog = {};
  let staleCount = 0;
  let missingCount = 0;

  for (const [key, canonical] of Object.entries(canonicalCatalog)) {
    if (canonical.status === 'obsolete') {
      continue;
    }

    const existing = localeCatalog[key];
    if (!existing) {
      // Missing translation
      nextLocaleCatalog[key] = {
        value: '',
        source_version: canonical.key_version,
        translated_at: '',
        status: 'missing',
      };
      missingCount++;
    } else if (existing.source_version !== canonical.key_version) {
      // Source changed since last translated: mark STALE, keep previous value
      nextLocaleCatalog[key] = {
        ...existing,
        status: 'stale',
      };
      staleCount++;
    } else {
      // Still up-to-date
      nextLocaleCatalog[key] = { ...existing };
    }
  }

  return {
    catalog: nextLocaleCatalog,
    staleCount,
    missingCount,
  };
}
