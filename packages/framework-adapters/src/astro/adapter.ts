import fs from 'node:fs/promises';
import path from 'node:path';
import {
  AdapterInitOptions,
  AdapterInitResult,
  CompileOptions,
  IFrameworkAdapter,
} from '../types.js';
import { compileCatalogToRuntime } from '../common/compile.js';
import { writeJsonAtomic, readJsonIfExists } from '@shallok/core';

export class AstroAdapter implements IFrameworkAdapter {
  name = 'astro';
  framework = 'astro' as const;
  library = 'astro-i18n' as const;

  async detect(projectRoot: string): Promise<boolean> {
    const pkg = await readJsonIfExists<{ dependencies?: Record<string, string> }>(
      path.resolve(projectRoot, 'package.json')
    );
    return Boolean(pkg?.dependencies?.['astro']);
  }

  async initialize(projectRoot: string, options: AdapterInitOptions): Promise<AdapterInitResult> {
    const createdFiles: string[] = [];
    const srcDir = path.resolve(projectRoot, 'src', 'i18n');
    await fs.mkdir(srcDir, { recursive: true });

    const utilsPath = path.resolve(srcDir, 'utils.ts');
    const utilsContent = `export const defaultLocale = '${options.sourceLocale}';
export const locales = ${JSON.stringify(options.supportedLocales)} as const;

export type Locale = (typeof locales)[number];

export async function useTranslations(locale: Locale) {
  const messages = (await import(\`../../../messages/runtime/\${locale}.json\`)).default;

  return function t(key: string): string {
    return (messages as Record<string, string>)[key] || key;
  };
}
`;

    await fs.writeFile(utilsPath, utilsContent, 'utf8');
    createdFiles.push('src/i18n/utils.ts');

    return {
      createdFiles,
      modifiedFiles: [],
      requiredDependencies: [],
    };
  }

  compileRuntimeMessages(options: CompileOptions): Record<string, any> {
    const result: Record<string, any> = {};
    for (const locale of options.manifest.supported_locales) {
      const locCatalog = options.localeCatalogs[locale] || {};
      result[locale] = compileCatalogToRuntime(
        locCatalog,
        options.canonicalCatalog,
        options.format || 'flat'
      );
    }
    return result;
  }

  async writeRuntimeMessages(projectRoot: string, options: CompileOptions): Promise<string[]> {
    const compiled = this.compileRuntimeMessages(options);
    const writtenFiles: string[] = [];
    const outDir = path.resolve(projectRoot, options.manifest.paths.translations_directory, 'runtime');
    await fs.mkdir(outDir, { recursive: true });

    for (const [locale, messages] of Object.entries(compiled)) {
      const filePath = path.resolve(outDir, `${locale}.json`);
      await writeJsonAtomic(filePath, messages);
      writtenFiles.push(path.relative(projectRoot, filePath));
    }

    return writtenFiles;
  }
}
