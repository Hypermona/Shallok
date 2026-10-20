import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { render } from 'ink';
import {
  CatalogStorage,
  extractStringsFromSource,
  transformSourceFile,
  reconcileCanonicalCatalog,
  reconcileLocaleCatalog,
  findCandidateFiles,
  ExtractedString,
} from '@shallok/core';
import { Printer } from '../output/printer.js';
import { ExtractionPreview } from '../ui/ExtractionPreview.js';

export interface ExtractCommandOptions {
  dryRun?: boolean;
  apply?: boolean;
  json?: boolean;
}

export async function extractCommand(options: ExtractCommandOptions): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const storage = new CatalogStorage(cwd);

  const manifest = await storage.readManifest();
  if (!manifest) {
    printer.error('No localization.json found. Run "shallok init" first.');
    process.exit(1);
  }

  const isDryRun = options.dryRun ?? false;
  const shouldApplyCodeTransform = options.apply ?? false;

  const currentCanonical = await storage.readCanonicalCatalog(
    manifest.paths.base_directory,
    manifest.source_locale
  );

  // Map existing keys to content for deduplication
  const existingKeyMap = new Map<string, string>();
  for (const [k, v] of Object.entries(currentCanonical)) {
    existingKeyMap.set(k, v.content);
  }

  // Find candidate files using core utility
  const filePaths = await findCandidateFiles(cwd, manifest.paths.source_directories);

  const allExtractedStrings: ExtractedString[] = [];
  const modifiedFiles: string[] = [];

  for (const relPath of filePaths) {
    const fullPath = path.resolve(cwd, relPath);
    const code = await fs.readFile(fullPath, 'utf8');

    if (shouldApplyCodeTransform && !isDryRun) {
      const transformRes = transformSourceFile({
        filePath: relPath,
        code,
        existingKeys: existingKeyMap,
        framework: manifest.framework.name,
      });

      if (transformRes.changed) {
        await fs.writeFile(fullPath, transformRes.transformedCode, 'utf8');
        modifiedFiles.push(relPath);
      }
    }

    const extractRes = extractStringsFromSource({
      filePath: relPath,
      code,
      existingKeys: existingKeyMap,
      framework: manifest.framework.name,
    });

    for (const str of extractRes.strings) {
      allExtractedStrings.push(str);
    }
  }

  // Reconcile with canonical catalog
  const now = new Date().toISOString();
  const reconciliation = reconcileCanonicalCatalog({
    currentCatalog: currentCanonical,
    extractedStrings: allExtractedStrings,
    preserveObsoleteKeys: manifest.options.preserve_obsolete_keys,
    now,
  });

  if (!isDryRun) {
    // 1. Write updated canonical catalog
    await storage.writeCanonicalCatalog(
      reconciliation.catalog,
      manifest.paths.base_directory,
      manifest.source_locale
    );

    // 2. Write metadata
    const activeCount = Object.values(reconciliation.catalog).filter((e) => e.status === 'active').length;
    const obsoleteCount = Object.values(reconciliation.catalog).filter((e) => e.status === 'obsolete').length;

    await storage.writeMetadata(
      {
        tool_name: 'shallok',
        tool_version: '0.1.0',
        schema_version: 1,
        last_extraction_at: now,
        total_keys: Object.keys(reconciliation.catalog).length,
        active_keys: activeCount,
        obsolete_keys: obsoleteCount,
      },
      manifest.paths.base_directory
    );

    // 3. Reconcile all target locale catalogs
    for (const loc of manifest.supported_locales) {
      const locCatalog = await storage.readLocaleCatalog(loc, manifest.paths.translations_directory);
      const reconciledLocale = reconcileLocaleCatalog({
        canonicalCatalog: reconciliation.catalog,
        localeCatalog: locCatalog,
        locale: loc,
      });
      await storage.writeLocaleCatalog(loc, reconciledLocale.catalog, manifest.paths.translations_directory);
    }
  }

  if (options.json) {
    printer.json({
      dryRun: isDryRun,
      extractedCount: allExtractedStrings.length,
      diff: reconciliation.diff,
      modifiedFiles,
    });
    return;
  }

  if (process.stdout.isTTY) {
    render(
      React.createElement(ExtractionPreview, {
        strings: allExtractedStrings,
        modifiedFiles,
        isDryRun,
      })
    );
  } else {
    printer.header(`Shallok • Extraction ${isDryRun ? '(Dry Run)' : 'Completed'}`);
    printer.log(`Total strings extracted: ${allExtractedStrings.length}`);
    printer.log(`Added keys: ${reconciliation.diff.addedKeys.length}`);
    printer.log(`Modified keys: ${reconciliation.diff.modifiedKeys.length}`);
    printer.log(`Obsolete keys: ${reconciliation.diff.obsoleteKeys.length}`);
    printer.log(`Unchanged keys: ${reconciliation.diff.unchangedKeys.length}`);
    if (modifiedFiles.length > 0) {
      printer.log(`Transformed source files: ${modifiedFiles.length}`);
    }
  }
}
