import chalk from 'chalk';
import { analyzeProject } from '@shallok/core';
import { Printer } from '../output/printer.js';
import { installSkillsForProject } from '../installer/skills-installer.js';

export interface SetupOptions {
  framework?: string;
  json?: boolean;
}

/**
 * Setup command: Initializes repository with Shallok devDependency and copies
 * the appropriate AI agent skill.
 *
 * NOTE: This command is intended solely for human developers (e.g. `npx shallok setup`).
 * AI agents must NOT use this command; AI agents should use `shallok init`, `shallok extract`, etc.
 */
export async function setupCommand(options: SetupOptions): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);

  try {
    printer.log('Setting up Shallok in your project...');

    // 1. Detect project framework unless explicitly overridden
    let detectedFramework = 'unknown';
    try {
      const analysis = await analyzeProject(cwd);
      detectedFramework = analysis.framework.name;
    } catch {
      // If analysis encounters an issue, fallback to unknown
    }

    const framework = options.framework || detectedFramework;

    // 2. Install shallok devDependency and copy the appropriate agent skill
    const result = await installSkillsForProject(cwd, framework);

    if (options.json) {
      printer.json({
        success: true,
        packageManager: result.packageManager,
        dependencyInstalled: result.dependencyInstalled,
        framework,
        copiedSkills: result.copiedSkills,
        destinations: result.destinations,
        instructionForAiAgent:
          'Ask your AI coding agent: "Add localization and translations for a, b, c, d languages" (e.g. en, es, hi, kn)',
      });
      return;
    }

    printer.success('Shallok setup completed successfully!');
    printer.info(`Detected framework: ${framework}`);

    if (result.dependencyInstalled) {
      printer.info(`Installed shallok in devDependencies (${result.packageManager})`);
    } else {
      printer.info(`shallok dependency verified in package.json`);
    }

    for (const skill of result.copiedSkills) {
      printer.info(`Added AI agent skill: ${skill} (.agents/skills/)`);
    }

    // 3. Clear prompt instructions for the developer to hand off to their AI agent
    console.log('');
    console.log(chalk.bold.cyan('======================================================================'));
    console.log(chalk.bold(' Next Step: Ask your AI agent to localize your app!'));
    console.log(chalk.bold.cyan('======================================================================'));
    console.log('Now open your AI coding agent (Antigravity, Cursor, Claude Code, Copilot, etc.)');
    console.log('and tell it:');
    console.log('');
    console.log(chalk.green.bold('  "Add localization and translations for a, b, c, d languages"'));
    console.log(chalk.dim('  (e.g., "Add localization and translations for en, es, hi, kn")'));
    console.log('');
    console.log('Your AI agent will use the installed skill to:');
    console.log('  1. Initialize configuration and catalogs (shallok init)');
    console.log('  2. Extract hardcoded UI strings into canonical catalog (shallok extract)');
    console.log('  3. Generate translations without external API keys (shallok translate)');
    console.log('  4. Wire up framework runtime provider and compile message bundles');
    console.log(chalk.bold.cyan('======================================================================'));
  } catch (err: any) {
    printer.error(`Setup failed: ${err.message}`);
    process.exit(1);
  }
}
