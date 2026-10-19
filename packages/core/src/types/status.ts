export interface LocaleStatusReport {
  locale: string;
  isSourceLocale: boolean;
  totalActiveKeys: number;
  translatedCount: number;
  missingCount: number;
  staleCount: number;
  reviewRequiredCount: number;
  approvedCount: number;
  obsoleteCount: number;
  completenessPercentage: number;
}

export interface ProjectStatusReport {
  sourceLocale: string;
  supportedLocales: string[];
  totalKeys: number;
  activeKeys: number;
  obsoleteKeys: number;
  locales: Record<string, LocaleStatusReport>;
  overallCompletenessPercentage: number;
  lastExtractionAt: string | null;
}
