import { CanonicalCatalog, LocaleCatalog, LocalizationManifest } from '@shallok/core';

export interface AdapterInitOptions {
  sourceLocale: string;
  supportedLocales: string[];
  router?: 'app' | 'pages' | 'none' | null;
}

export interface AdapterInitResult {
  createdFiles: string[];
  modifiedFiles: string[];
  requiredDependencies: string[];
}

export interface CompileOptions {
  manifest: LocalizationManifest;
  canonicalCatalog: CanonicalCatalog;
  localeCatalogs: Record<string, LocaleCatalog>;
  format?: 'flat' | 'nested';
}

export interface IFrameworkAdapter {
  name: string;
  framework: 'react' | 'nextjs' | 'vue' | 'expo' | 'astro';
  library: 'react-i18next' | 'next-intl' | 'vue-i18n' | 'expo-localization' | 'astro-i18n';
  detect(projectRoot: string): Promise<boolean>;
  initialize(projectRoot: string, options: AdapterInitOptions): Promise<AdapterInitResult>;
  compileRuntimeMessages(options: CompileOptions): Record<string, any>;
  writeRuntimeMessages(projectRoot: string, options: CompileOptions): Promise<string[]>;
}
