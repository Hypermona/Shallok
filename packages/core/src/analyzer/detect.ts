import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { ProjectAnalysis } from '../types/analyzer.js';
import { FrameworkConfig } from '../types/manifest.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function analyzeProject(projectRoot: string): Promise<ProjectAnalysis> {
  let pkg: PackageJson = {};
  try {
    const pkgRaw = await fs.readFile(path.resolve(projectRoot, 'package.json'), 'utf8');
    pkg = JSON.parse(pkgRaw);
  } catch {
    // No package.json found or invalid JSON
  }

  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  // 1. Detect Framework
  let frameworkName: FrameworkConfig['name'] = 'unknown';
  let router: FrameworkConfig['router'] = 'none';
  let localizationLibrary: FrameworkConfig['localization_library'] = null;
  let libraryVersion: string | null = null;

  if (allDeps['next']) {
    frameworkName = 'nextjs';
    // Check router type
    const hasSrcApp = await fileOrDirExists(path.resolve(projectRoot, 'src/app'));
    const hasApp = await fileOrDirExists(path.resolve(projectRoot, 'app'));
    const hasSrcPages = await fileOrDirExists(path.resolve(projectRoot, 'src/pages'));
    const hasPages = await fileOrDirExists(path.resolve(projectRoot, 'pages'));

    if (hasSrcApp || hasApp) {
      router = 'app';
    } else if (hasSrcPages || hasPages) {
      router = 'pages';
    }
  } else if (allDeps['expo']) {
    frameworkName = 'expo';
  } else if (allDeps['astro']) {
    frameworkName = 'astro';
  } else if (allDeps['vue']) {
    frameworkName = 'vue';
  } else if (allDeps['react']) {
    frameworkName = 'react';
  }

  // 2. Detect Existing Localization Library
  if (allDeps['next-intl']) {
    localizationLibrary = 'next-intl';
    libraryVersion = allDeps['next-intl'];
  } else if (allDeps['expo-localization']) {
    localizationLibrary = 'expo-localization';
    libraryVersion = allDeps['expo-localization'];
  } else if (allDeps['astro-i18n']) {
    localizationLibrary = 'astro-i18n';
    libraryVersion = allDeps['astro-i18n'];
  } else if (allDeps['react-i18next'] || allDeps['i18next']) {
    localizationLibrary = 'react-i18next';
    libraryVersion = allDeps['react-i18next'] || allDeps['i18next'];
  } else if (allDeps['vue-i18n']) {
    localizationLibrary = 'vue-i18n';
    libraryVersion = allDeps['vue-i18n'];
  }

  // 3. Detect Source Directories
  const sourceDirectories: string[] = [];
  if (await fileOrDirExists(path.resolve(projectRoot, 'src'))) {
    sourceDirectories.push('src');
  } else {
    for (const dir of ['app', 'pages', 'components', 'lib']) {
      if (await fileOrDirExists(path.resolve(projectRoot, dir))) {
        sourceDirectories.push(dir);
      }
    }
    if (sourceDirectories.length === 0) {
      sourceDirectories.push('.');
    }
  }

  // 4. Detect Languages
  const detectedLanguages: ('typescript' | 'javascript')[] = [];
  const hasTsConfig = await fileOrDirExists(path.resolve(projectRoot, 'tsconfig.json'));
  if (hasTsConfig || allDeps['typescript']) {
    detectedLanguages.push('typescript');
  } else {
    detectedLanguages.push('javascript');
  }

  // 5. Existing Catalogs and Configs
  const catalogsFound: string[] = [];
  for (const candidate of ['localization_base', 'messages', 'locales', 'public/locales']) {
    if (await fileOrDirExists(path.resolve(projectRoot, candidate))) {
      catalogsFound.push(candidate);
    }
  }

  const candidateSourceFiles = await findCandidateFiles(projectRoot, sourceDirectories);

  return {
    framework: {
      name: frameworkName,
      router,
      localization_library: localizationLibrary,
      library_version: libraryVersion,
    },
    sourceDirectories,
    detectedLanguages,
    existingLocalization: {
      library: localizationLibrary,
      configFile: null,
      catalogsFound,
    },
    totalSourceFiles: candidateSourceFiles.length,
    candidateSourceFiles,
    suggestedLocales: {
      source: 'en',
      targets: ['kn', 'hi'],
    },
  };
}

export async function findCandidateFiles(
  projectRoot: string,
  sourceDirectories: string[] = ['src']
): Promise<string[]> {
  const ignorePatterns = [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/build/**',
    '**/coverage/**',
    '**/localization_base/**',
    '**/messages/**',
    '**/*.test.*',
    '**/*.spec.*',
  ];

  const searchPatterns = sourceDirectories.map((dir) => `${dir}/**/*.{tsx,jsx,ts,js}`);
  return fg(searchPatterns, {
    cwd: projectRoot,
    ignore: ignorePatterns,
    onlyFiles: true,
  });
}

async function fileOrDirExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
