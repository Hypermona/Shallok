#!/usr/bin/env node
import { Command } from 'commander';
import { analyzeCommand } from './commands/analyze.js';
import { initCommand } from './commands/init.js';
import { extractCommand } from './commands/extract.js';
import { translateCommand } from './commands/translate.js';
import { statusCommand } from './commands/status.js';
import { validateCommand } from './commands/validate.js';
import { buildCommand } from './commands/build.js';
import { reportCommand } from './commands/report.js';
import { localeAddCommand, localeRemoveCommand } from './commands/locale.js';
import { syncCommand } from './commands/sync.js';
import { renameCommand } from './commands/rename.js';
import { contextSetCommand } from './commands/context.js';
import { entrySetCommand } from './commands/entry.js';

const program = new Command();

program
  .name('shallok')
  .description('Shallok: AI-Powered, Versioned Localization Tool')
  .version('0.1.0')
  .option('--json', 'Output machine-readable JSON for AI agent orchestration');

// 1. Analyze
program
  .command('analyze')
  .description('Analyze the repository without modifying it')
  .option('--json', 'Output machine-readable JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    await analyzeCommand({ json: isJson });
  });

// 2. Init
program
  .command('init')
  .description('Initialize localization configuration and framework adapter')
  .option('--source <locale>', 'Source locale (e.g. en)')
  .option('--locales <locales>', 'Comma-separated target locales (e.g. kn,hi,fr)')
  .option('--framework <name>', 'Framework name (react, nextjs, vue, expo, astro)')
  .option('-y, --yes', 'Non-interactive mode, accept suggested defaults')
  .option('--json', 'Output machine-readable JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    await initCommand({ ...options, json: isJson });
  });

// 3. Extract
program
  .command('extract')
  .description('Extract user-facing strings and reconcile the catalog')
  .option('--dry-run', 'Preview extracted strings without modifying files')
  .option('--apply', 'Apply code transformations to replace strings with t(...) calls')
  .option('--json', 'Output machine-readable JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    await extractCommand({ ...options, json: isJson });
  });

// 4. Translate
program
  .command('translate')
  .description('Generate missing or stale translations')
  .option('--locale <locale>', 'Target a specific locale')
  .option('--provider <provider>', 'Translation provider (mock, llm)')
  .option('--batch-size <size>', 'Batch size for translation requests', (val) => parseInt(val, 10))
  .option('--force', 'Force retranslation of all entries')
  .option('--json', 'Output machine-readable JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    await translateCommand({ ...options, json: isJson });
  });

// 5. Status
program
  .command('status')
  .description('Check missing, stale, and overall localization status')
  .option('--json', 'Output machine-readable JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    await statusCommand({ json: isJson });
  });

// 6. Validate
program
  .command('validate')
  .description('Validate catalogs and placeholder integrity')
  .option('--json', 'Output machine-readable JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    await validateCommand({ json: isJson });
  });

// 7. Build
program
  .command('build')
  .description('Generate runtime-compatible message files')
  .option('--format <format>', 'Message format (flat, nested)')
  .option('--json', 'Output machine-readable JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    await buildCommand({ ...options, json: isJson });
  });

// 8. Report
program
  .command('report')
  .description('Produce a full localization health report')
  .option('--json', 'Output machine-readable JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    await reportCommand({ json: isJson });
  });

// 9. Locale
const localeCmd = program.command('locale').description('Manage configured locales');

localeCmd
  .command('add <locale>')
  .description('Add a target locale')
  .option('--json', 'Output machine-readable JSON')
  .action(async (locale, options) => {
    const isJson = options.json || program.opts().json;
    await localeAddCommand(locale, { json: isJson });
  });

localeCmd
  .command('remove <locale>')
  .description('Safely remove a target locale from active configuration')
  .option('--json', 'Output machine-readable JSON')
  .action(async (locale, options) => {
    const isJson = options.json || program.opts().json;
    await localeRemoveCommand(locale, { json: isJson });
  });

// 10. Key
const keyCmd = program.command('key').description('Manage translation keys');

keyCmd
  .command('rename <oldKey> <newKey>')
  .description('Safely rename a key across catalogs and source code')
  .option('--json', 'Output machine-readable JSON')
  .action(async (oldKey, newKey, options) => {
    const isJson = options.json || program.opts().json;
    await renameCommand(oldKey, newKey, { json: isJson });
  });

// 11. Context (AI Agent / Developer context enrichment)
const contextCmd = program.command('context').description('Manage translation context in canonical catalog');

contextCmd
  .command('set <key> <description>')
  .description('Update semantic context for a key in canonical catalog')
  .option('--json', 'Output machine-readable JSON')
  .action(async (key, description, options) => {
    const isJson = options.json || program.opts().json;
    await contextSetCommand(key, description, { json: isJson });
  });

// 12. Entry (AI Agent / Developer translation updates)
const entryCmd = program.command('entry').description('Manage locale translation entries');

entryCmd
  .command('set <locale> <key> <translatedValue>')
  .description('Set translated value for a key in a specific locale catalog')
  .option('--json', 'Output machine-readable JSON')
  .action(async (locale, key, translatedValue, options) => {
    const isJson = options.json || program.opts().json;
    await entrySetCommand(locale, key, translatedValue, { json: isJson });
  });

// 11. Sync
program
  .command('sync')
  .description('Full localization workflow: extract, translate, build, and validate')
  .option('--dry-run', 'Preview changes without modifying project files')
  .option('-y, --yes', 'Execute non-interactively without approval prompts')
  .option('--json', 'Output machine-readable JSON')
  .action(async (options) => {
    const isJson = options.json || program.opts().json;
    await syncCommand({ ...options, json: isJson });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
