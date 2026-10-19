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

export class VueAdapter implements IFrameworkAdapter {
  name = 'vue';
  framework = 'vue' as const;
  library = 'vue-i18n' as const;

  async detect(projectRoot: string): Promise<boolean> {
    const pkg = await readJsonIfExists<{ dependencies?: Record<string, string> }>(
      path.resolve(projectRoot, 'package.json')
    );
    return Boolean(pkg?.dependencies?.['vue']);
  }

  async initialize(projectRoot: string, options: AdapterInitOptions): Promise<AdapterInitResult> {
    const createdFiles: string[] = [];
    const srcDir = path.resolve(projectRoot, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    const i18nConfigPath = path.resolve(srcDir, 'i18n.ts');
    const configContent = `import { createI18n } from 'vue-i18n';

${options.supportedLocales
  .map((loc) => `import ${loc}Messages from '../messages/${loc}.json';`)
  .join('\n')}

const messages = {
${options.supportedLocales
  .map((loc) => `  ${loc}: ${loc}Messages,`)
  .join('\n')}
};

export const i18n = createI18n({
  legacy: false,
  locale: '${options.sourceLocale}',
  fallbackLocale: '${options.sourceLocale}',
  messages,
});
`;

    await fs.writeFile(i18nConfigPath, configContent, 'utf8');
    createdFiles.push('src/i18n.ts');

    return {
      createdFiles,
      modifiedFiles: [],
      requiredDependencies: ['vue-i18n'],
    };
  }

  compileRuntimeMessages(options: CompileOptions): Record<string, any> {
    const result: Record<string, any> = {};
    for (const locale of options.manifest.supported_locales) {
      const locCatalog = options.localeCatalogs[locale] || {};
      result[locale] = compileCatalogToRuntime(
        locCatalog,
        options.canonicalCatalog,
        options.format || 'nested'
      );
    }
    return result;
  }

  async writeRuntimeMessages(projectRoot: string, options: CompileOptions): Promise<string[]> {
    const compiled = this.compileRuntimeMessages(options);
    const writtenFiles: string[] = [];
    const outDir = path.resolve(projectRoot, options.manifest.paths.translations_directory);
    await fs.mkdir(outDir, { recursive: true });

    for (const [locale, messages] of Object.entries(compiled)) {
      const filePath = path.resolve(outDir, `${locale}.json`);
      await writeJsonAtomic(filePath, messages);
      writtenFiles.push(path.relative(projectRoot, filePath));
    }

    return writtenFiles;
  }
}
