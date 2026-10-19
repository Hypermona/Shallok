export interface TranslationRequestItem {
  key: string;
  content: string;
  context: string;
  sourceVersion: number;
  variables: string[];
}

export interface TranslationResponseItem {
  key: string;
  translatedValue: string;
  reviewRequired?: boolean;
  notes?: string;
}

export interface TranslationOptions {
  sourceLocale: string;
  targetLocale: string;
  formality?: 'formal' | 'informal' | 'neutral';
  glossary?: Record<string, string>;
  batchSize?: number;
}

export interface ITranslationProvider {
  name: string;
  translateBatch(
    items: TranslationRequestItem[],
    options: TranslationOptions
  ): Promise<TranslationResponseItem[]>;
}

export interface TranslationRunSummary {
  locale: string;
  totalRequested: number;
  translated: number;
  failed: number;
  skipped: number;
  errors: Array<{ key: string; error: string }>;
}
