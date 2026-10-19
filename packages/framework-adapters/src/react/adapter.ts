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

export class ReactAdapter implements IFrameworkAdapter {
  name = 'react';
  framework = 'react' as const;
  library = 'react-i18next' as const;

  async detect(projectRoot: string): Promise<boolean> {
    const pkg = await readJsonIfExists<{ dependencies?: Record<string, string> }>(
      path.resolve(projectRoot, 'package.json')
    );
    if (!pkg?.dependencies) return false;
    return Boolean(pkg.dependencies['react'] && !pkg.dependencies['next']);
  }

  async initialize(projectRoot: string, options: AdapterInitOptions): Promise<AdapterInitResult> {
    const createdFiles: string[] = [];
    const srcDir = path.resolve(projectRoot, 'src');
    await fs.mkdir(srcDir, { recursive: true });

    const i18nConfigPath = path.resolve(srcDir, 'i18n.ts');
    const configContent = `import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

${options.supportedLocales
  .map((loc) => `import ${loc}Messages from '../messages/runtime/${loc}.json';`)
  .join('\n')}

const resources = {
${options.supportedLocales
  .map((loc) => `  ${loc}: { translation: ${loc}Messages },`)
  .join('\n')}
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: '${options.sourceLocale}',
    fallbackLng: '${options.sourceLocale}',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
`;

    await fs.writeFile(i18nConfigPath, configContent, 'utf8');
    createdFiles.push('src/i18n.ts');

    return {
      createdFiles,
      modifiedFiles: [],
      requiredDependencies: ['i18next', 'react-i18next'],
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
