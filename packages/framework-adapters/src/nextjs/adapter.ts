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

export class NextjsAdapter implements IFrameworkAdapter {
  name = 'nextjs';
  framework = 'nextjs' as const;
  library = 'next-intl' as const;

  async detect(projectRoot: string): Promise<boolean> {
    const pkg = await readJsonIfExists<{ dependencies?: Record<string, string> }>(
      path.resolve(projectRoot, 'package.json')
    );
    return Boolean(pkg?.dependencies?.['next']);
  }

  async initialize(projectRoot: string, options: AdapterInitOptions): Promise<AdapterInitResult> {
    const createdFiles: string[] = [];

    // Check if project has src directory
    let baseDir = 'src';
    try {
      await fs.access(path.resolve(projectRoot, 'src'));
    } catch {
      baseDir = '.';
    }

    const i18nDir = path.resolve(projectRoot, baseDir, 'i18n');
    await fs.mkdir(i18nDir, { recursive: true });

    // 1. Create routing.ts
    const routingPath = path.resolve(i18nDir, 'routing.ts');
    const routingContent = `import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ${JSON.stringify(options.supportedLocales)},
  defaultLocale: '${options.sourceLocale}',
});
`;
    await fs.writeFile(routingPath, routingContent, 'utf8');
    createdFiles.push(path.relative(projectRoot, routingPath));

    // 2. Create request.ts
    const requestPath = path.resolve(i18nDir, 'request.ts');
    const requestContent = `import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(\`../../messages/runtime/\${locale}.json\`)).default,
  };
});
`;
    await fs.writeFile(requestPath, requestContent, 'utf8');
    createdFiles.push(path.relative(projectRoot, requestPath));

    return {
      createdFiles,
      modifiedFiles: [],
      requiredDependencies: ['next-intl'],
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
