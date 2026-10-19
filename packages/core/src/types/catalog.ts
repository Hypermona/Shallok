import { z } from 'zod';

export const OccurrenceSchema = z.object({
  relative_file_path: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().nonnegative().optional(),
});

export const CanonicalKeyStatusSchema = z.enum(['active', 'obsolete']);

export const CanonicalEntrySchema = z.object({
  key: z.string().min(1),
  content: z.string(),
  context: z.string().default(''),
  relative_file_path: z.string(),
  occurrences: z.array(OccurrenceSchema).default([]),
  last_updated_at: z.string().datetime({ offset: true }).or(z.string()),
  key_version: z.number().int().positive(),
  content_hash: z.string().startsWith('sha256:'),
  status: CanonicalKeyStatusSchema,
});

export const CanonicalCatalogSchema = z.record(z.string(), CanonicalEntrySchema);

export const CatalogMetadataSchema = z.object({
  tool_name: z.string().default('shallok'),
  tool_version: z.string(),
  schema_version: z.number().int().default(1),
  last_extraction_at: z.string(),
  total_keys: z.number().int().nonnegative(),
  active_keys: z.number().int().nonnegative(),
  obsolete_keys: z.number().int().nonnegative(),
});

export const TranslationStatusSchema = z.enum([
  'missing',
  'stale',
  'translated',
  'review_required',
  'approved',
]);

export const LocaleEntrySchema = z.union([
  z.object({
    value: z.string(),
    source_version: z.number().int().positive().default(1),
    translated_at: z.string().default(''),
    status: TranslationStatusSchema.default('translated'),
  }),
  z.string().transform((str) => ({
    value: str,
    source_version: 1,
    translated_at: '',
    status: 'translated' as const,
  })),
]);

export const LocaleCatalogSchema = z.record(z.string(), LocaleEntrySchema);

export type Occurrence = z.infer<typeof OccurrenceSchema>;
export type CanonicalKeyStatus = z.infer<typeof CanonicalKeyStatusSchema>;
export type CanonicalEntry = z.infer<typeof CanonicalEntrySchema>;
export type CanonicalCatalog = z.infer<typeof CanonicalCatalogSchema>;
export type CatalogMetadata = z.infer<typeof CatalogMetadataSchema>;
export type TranslationStatus = z.infer<typeof TranslationStatusSchema>;
export type LocaleEntry = z.infer<typeof LocaleEntrySchema>;
export type LocaleCatalog = z.infer<typeof LocaleCatalogSchema>;
