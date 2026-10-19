import { CanonicalCatalog, LocaleCatalog } from '../types/catalog.js';
import { LocalizationManifest } from '../types/manifest.js';
import { LocaleStatusReport, ProjectStatusReport } from '../types/status.js';

export function calculateLocaleStatus(options: {
  locale: string;
  sourceLocale: string;
  canonicalCatalog: CanonicalCatalog;
  localeCatalog: LocaleCatalog;
}): LocaleStatusReport {
  const { locale, sourceLocale, canonicalCatalog, localeCatalog } = options;
  const isSourceLocale = locale === sourceLocale;

  let totalActiveKeys = 0;
  let obsoleteCount = 0;

  for (const entry of Object.values(canonicalCatalog)) {
    if (entry.status === 'active') {
      totalActiveKeys++;
    } else {
      obsoleteCount++;
    }
  }

  let translatedCount = 0;
  let missingCount = 0;
  let staleCount = 0;
  let reviewRequiredCount = 0;
  let approvedCount = 0;

  for (const [key, canonical] of Object.entries(canonicalCatalog)) {
    if (canonical.status !== 'active') continue;

    const locEntry = localeCatalog[key];
    if (!locEntry || !locEntry.value || locEntry.status === 'missing') {
      missingCount++;
    } else if (locEntry.source_version !== canonical.key_version || locEntry.status === 'stale') {
      staleCount++;
    } else if (locEntry.status === 'review_required') {
      reviewRequiredCount++;
    } else if (locEntry.status === 'approved') {
      approvedCount++;
      translatedCount++;
    } else if (locEntry.status === 'translated') {
      translatedCount++;
    }
  }

  const currentCount = translatedCount + approvedCount;
  const completenessPercentage =
    totalActiveKeys > 0 ? Math.round((currentCount / totalActiveKeys) * 100) : 100;

  return {
    locale,
    isSourceLocale,
    totalActiveKeys,
    translatedCount,
    missingCount,
    staleCount,
    reviewRequiredCount,
    approvedCount,
    obsoleteCount,
    completenessPercentage,
  };
}

export function generateProjectStatusReport(options: {
  manifest: LocalizationManifest;
  canonicalCatalog: CanonicalCatalog;
  localeCatalogs: Record<string, LocaleCatalog>;
  lastExtractionAt?: string | null;
}): ProjectStatusReport {
  const { manifest, canonicalCatalog, localeCatalogs, lastExtractionAt = null } = options;

  let totalKeys = 0;
  let activeKeys = 0;
  let obsoleteKeys = 0;

  for (const entry of Object.values(canonicalCatalog)) {
    totalKeys++;
    if (entry.status === 'active') {
      activeKeys++;
    } else {
      obsoleteKeys++;
    }
  }

  const localesReport: Record<string, LocaleStatusReport> = {};
  let targetSumPercentage = 0;
  let targetCount = 0;

  for (const loc of manifest.supported_locales) {
    const locCatalog = localeCatalogs[loc] || {};
    const report = calculateLocaleStatus({
      locale: loc,
      sourceLocale: manifest.source_locale,
      canonicalCatalog,
      localeCatalog: locCatalog,
    });
    localesReport[loc] = report;

    if (loc !== manifest.source_locale) {
      targetSumPercentage += report.completenessPercentage;
      targetCount++;
    }
  }

  const overallCompletenessPercentage =
    targetCount > 0
      ? Math.round(targetSumPercentage / targetCount)
      : activeKeys > 0
        ? 100
        : 0;

  return {
    sourceLocale: manifest.source_locale,
    supportedLocales: manifest.supported_locales,
    totalKeys,
    activeKeys,
    obsoleteKeys,
    locales: localesReport,
    overallCompletenessPercentage,
    lastExtractionAt,
  };
}
