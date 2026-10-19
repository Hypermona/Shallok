import { z } from 'zod';

export const FrameworkConfigSchema = z.object({
  name: z.enum(['react', 'nextjs', 'vue', 'astro', 'expo', 'unknown']),
  router: z.enum(['app', 'pages', 'none']).nullable().default(null),
  localization_library: z.enum(['next-intl', 'react-i18next', 'vue-i18n', 'astro-i18n', 'expo-localization', 'none']).nullable().default(null),
  library_version: z.string().nullable().default(null),
});

export const PathsConfigSchema = z.object({
  source_directories: z.array(z.string()).default(['src']),
  base_directory: z.string().default('localization_base'),
  translations_directory: z.string().default('messages'),
});

export const TranslationConfigSchema = z.object({
  provider: z.string().nullable().default(null),
  model: z.string().nullable().default(null),
  batch_size: z.number().int().positive().default(25),
});

export const OptionsConfigSchema = z.object({
  include_accessibility_text: z.boolean().default(true),
  preserve_obsolete_keys: z.boolean().default(true),
  require_review_for_ambiguous_strings: z.boolean().default(true),
  require_review_for_stale_translations: z.boolean().default(true),
});

export const LocalizationManifestSchema = z.object({
  schema_version: z.number().int().default(1),
  localization_version: z.number().int().default(1),
  source_locale: z.string().min(2),
  supported_locales: z.array(z.string().min(2)),
  framework: FrameworkConfigSchema,
  paths: PathsConfigSchema,
  key_strategy: z.enum(['semantic', 'hierarchical', 'hash']).default('semantic'),
  translation: TranslationConfigSchema,
  options: OptionsConfigSchema,
});

export type FrameworkConfig = z.infer<typeof FrameworkConfigSchema>;
export type PathsConfig = z.infer<typeof PathsConfigSchema>;
export type TranslationConfig = z.infer<typeof TranslationConfigSchema>;
export type OptionsConfig = z.infer<typeof OptionsConfigSchema>;
export type LocalizationManifest = z.infer<typeof LocalizationManifestSchema>;
