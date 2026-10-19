import { extractCommand } from './extract.js';
import { translateCommand } from './translate.js';
import { buildCommand } from './build.js';
import { validateCommand } from './validate.js';
import { Printer } from '../output/printer.js';

export interface SyncCommandOptions {
  dryRun?: boolean;
  yes?: boolean;
  json?: boolean;
}

export async function syncCommand(options: SyncCommandOptions): Promise<void> {
  const printer = new Printer(options.json);

  if (options.dryRun) {
    printer.header('Shallok • Sync (Dry Run Preview)');
    printer.info('Previewing proposed string extraction and catalog changes...');
    await extractCommand({ dryRun: true, json: options.json });
    return;
  }

  printer.header('Shallok • Synchronizing Localization');

  printer.info('1/4: Extracting strings and reconciling catalogs...');
  await extractCommand({ dryRun: false, apply: true, json: false });

  printer.info('2/4: Translating missing and stale entries...');
  await translateCommand({ json: false });

  printer.info('3/4: Building runtime message bundles...');
  await buildCommand({ json: false });

  printer.info('4/4: Validating catalog integrity...');
  await validateCommand({ json: false });

  printer.success('Localization sync completed successfully!');
}
