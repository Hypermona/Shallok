import {
  CanonicalCatalog,
  LocaleCatalog,
  extractPlaceholders,
} from '@shallok/core';
import {
  ITranslationProvider,
  TranslationOptions,
  TranslationRequestItem,
  TranslationRunSummary,
} from './types.js';

export class TranslationOrchestrator {
  constructor(private provider: ITranslationProvider) {}

  async translateLocales(options: {
    canonicalCatalog: CanonicalCatalog;
    localeCatalogs: Record<string, LocaleCatalog>;
    sourceLocale: string;
    targetLocales: string[];
    batchSize?: number;
    forceAll?: boolean;
    now?: string;
  }): Promise<Record<string, TranslationRunSummary>> {
    const {
      canonicalCatalog,
      localeCatalogs,
      sourceLocale,
      targetLocales,
      batchSize = 25,
      forceAll = false,
      now = new Date().toISOString(),
    } = options;

    const summaries: Record<string, TranslationRunSummary> = {};

    for (const targetLocale of targetLocales) {
      if (targetLocale === sourceLocale) {
        continue;
      }

      const localeCatalog = localeCatalogs[targetLocale] || {};
      localeCatalogs[targetLocale] = localeCatalog;

      const summary: TranslationRunSummary = {
        locale: targetLocale,
        totalRequested: 0,
        translated: 0,
        failed: 0,
        skipped: 0,
        errors: [],
      };

      // 1. Identify entries needing translation
      const itemsToTranslate: TranslationRequestItem[] = [];

      for (const [key, canonical] of Object.entries(canonicalCatalog)) {
        if (canonical.status !== 'active') {
          continue;
        }

        const currentEntry = localeCatalog[key];
        const isMissing = !currentEntry || !currentEntry.value || currentEntry.status === 'missing';
        const isStale = currentEntry && currentEntry.source_version !== canonical.key_version;

        if (forceAll || isMissing || isStale) {
          itemsToTranslate.push({
            key,
            content: canonical.content,
            context: canonical.context,
            sourceVersion: canonical.key_version,
            variables: extractPlaceholders(canonical.content),
          });
        } else {
          summary.skipped++;
        }
      }

      summary.totalRequested = itemsToTranslate.length;

      // 2. Process in batches
      for (let i = 0; i < itemsToTranslate.length; i += batchSize) {
        const batch = itemsToTranslate.slice(i, i + batchSize);
        const transOptions: TranslationOptions = {
          sourceLocale,
          targetLocale,
          batchSize,
        };

        try {
          const results = await this.provider.translateBatch(batch, transOptions);

          // Map results to keys
          const resultMap = new Map(results.map((r) => [r.key, r]));

          for (const item of batch) {
            const res = resultMap.get(item.key);
            if (!res || !res.translatedValue) {
              summary.failed++;
              summary.errors.push({
                key: item.key,
                error: 'Provider did not return a translation for key.',
              });
              continue;
            }

            // Validate placeholder parity
            const sourcePh = extractPlaceholders(item.content);
            const targetPh = extractPlaceholders(res.translatedValue);
            const missingPh = sourcePh.filter((p) => !targetPh.includes(p));

            if (missingPh.length > 0) {
              summary.failed++;
              summary.errors.push({
                key: item.key,
                error: `Translation dropped placeholders: ${missingPh.join(', ')}`,
              });
              continue;
            }

            // Save translation with exact canonical source version
            localeCatalog[item.key] = {
              value: res.translatedValue,
              source_version: item.sourceVersion,
              translated_at: now,
              status: res.reviewRequired ? 'review_required' : 'translated',
            };

            summary.translated++;
          }
        } catch (err: any) {
          summary.failed += batch.length;
          for (const item of batch) {
            summary.errors.push({
              key: item.key,
              error: err.message || 'Batch request failed.',
            });
          }
        }
      }

      summaries[targetLocale] = summary;
    }

    return summaries;
  }
}
