import path from 'node:path';
import fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import readline from 'node:readline/promises';
import chalk from 'chalk';
import { analyzeProject } from '@shallok/core';
import { Printer } from '../output/printer.js';
import { installSkillsForProject } from '../installer/skills-installer.js';
import { startLocalAuthServer, LocalAuthServer } from '../auth/callback-server.js';

export interface SetupPromptHandler {
  askCdn?: () => Promise<boolean>;
  waitForReturn?: () => Promise<string | void>;
}

export interface SetupOptions {
  framework?: string;
  yes?: boolean;
  cdn?: boolean;
  url?: string;
  json?: boolean;
  promptHandler?: SetupPromptHandler;
}

export function openBrowser(url: string): void {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return;
  }
  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      exec(`open "${url}"`, () => {});
    } else if (platform === 'win32') {
      exec(`start "" "${url}"`, () => {});
    } else {
      exec(`xdg-open "${url}"`, () => {});
    }
  } catch {
    // Non-fatal if browser cannot be launched
  }
}

export async function saveTokenToEnv(projectRoot: string, token: string): Promise<void> {
  try {
    const envLocalPath = path.join(projectRoot, '.env.local');
    let envContent = '';
    try {
      envContent = await fs.readFile(envLocalPath, 'utf-8');
    } catch {}

    if (envContent.includes('SHALLOK_API_TOKEN=')) {
      envContent = envContent.replace(/^SHALLOK_API_TOKEN=.*$/m, `SHALLOK_API_TOKEN=${token}`);
      await fs.writeFile(envLocalPath, envContent, 'utf-8');
    } else {
      const newline = envContent.length > 0 && !envContent.endsWith('\n') ? '\n' : '';
      await fs.writeFile(
        envLocalPath,
        `${envContent}${newline}# Shallok Cloud API Token\nSHALLOK_API_TOKEN=${token}\n`,
        'utf-8'
      );
    }
  } catch {}
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

    // Check if running interactively
    const isInteractive =
      !options.json &&
      !options.yes &&
      Boolean(options.promptHandler || (process.stdin.isTTY && !process.env.VITEST && process.env.NODE_ENV !== 'test'));

    let connectedToCdn = false;
    let savedToken = false;

    if (options.cdn !== undefined) {
      connectedToCdn = Boolean(options.cdn);
    } else if (isInteractive) {
      let wantCdn = false;

      if (options.promptHandler?.askCdn) {
        wantCdn = await options.promptHandler.askCdn();
      } else {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        try {
          console.log('');
          const answer = await rl.question(
            chalk.cyan('? ') +
              chalk.bold("Do you want to connect to Shallok CDN? (It's free)") +
              ' ' +
              chalk.dim('(y/N): ')
          );
          wantCdn = answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';

          if (wantCdn) {
            connectedToCdn = true;
            const dashboardUrl = (options.url || process.env.SHALLOK_DASHBOARD_URL || 'https://dash.shallok.com').replace(/\/+$/, '');

            // Start temporary local HTTP callback server to automatically capture the API token (like Wrangler/Vercel)
            let authServer: LocalAuthServer | null = null;
            let loginUrl = `${dashboardUrl}/auth`;
            try {
              authServer = await startLocalAuthServer();
              loginUrl = `${dashboardUrl}/auth?callback=${encodeURIComponent(authServer.callbackUrl)}&state=${authServer.state}`;
            } catch {}

            openBrowser(loginUrl);

            console.log('');
            console.log(chalk.green('✔') + ' ' + chalk.bold('Opening Shallok in your browser: ') + chalk.cyan.underline(loginUrl));
            console.log(chalk.dim('  If your browser does not open automatically, visit the URL above.'));
            console.log('');
            console.log(chalk.bold('Steps in Shallok Dashboard:'));
            console.log('  1. ' + chalk.cyan('Log in') + ' or ' + chalk.cyan('Sign up') + ' to your Shallok account');
            console.log('  2. ' + chalk.cyan('Create a new project') + ' for this application');
            console.log('  3. Authorize CLI (API token will be sent to your terminal automatically)');
            console.log('');

            if (authServer) {
              const manualInputPromise = rl.question(
                chalk.yellow('➜ ') +
                  chalk.bold('Waiting for browser authentication...') +
                  chalk.dim(' (or press [Enter] to continue / paste token): ')
              );

              const raceResult = await Promise.race([
                authServer.waitForAuth().then((res) => ({ type: 'auto' as const, res })),
                manualInputPromise.then((text) => ({ type: 'manual' as const, text })),
              ]);

              if (raceResult.type === 'auto') {
                const autoToken = raceResult.res.token;
                if (autoToken) {
                  await saveTokenToEnv(cwd, autoToken);
                  savedToken = true;
                  console.log('');
                  printer.success('Received API token automatically from browser!');
                  printer.info('Saved SHALLOK_API_TOKEN to .env.local');
                }
              } else {
                const trimmed = (raceResult.text || '').trim();
                if (trimmed) {
                  await saveTokenToEnv(cwd, trimmed);
                  savedToken = true;
                  printer.info('Saved SHALLOK_API_TOKEN to .env.local');
                }
              }

              await authServer.close();
            } else {
              const returnInput = await rl.question(
                chalk.yellow('➜ ') +
                  chalk.bold("Once you've created your project, return to this CLI and press [Enter] to continue") +
                  chalk.dim(' (or paste your API token): ')
              );

              const trimmed = (returnInput || '').trim();
              if (trimmed) {
                await saveTokenToEnv(cwd, trimmed);
                savedToken = true;
                printer.info('Saved SHALLOK_API_TOKEN to .env.local');
              }
            }

            console.log('');
            printer.log('Continuing Shallok setup...');
          } else {
            printer.info('Skipping CDN setup. You can always connect later with "npx shallok link".');
          }
        } finally {
          rl.close();
        }
      }

      if (options.promptHandler?.askCdn && wantCdn) {
        connectedToCdn = true;
        const dashboardUrl = (options.url || process.env.SHALLOK_DASHBOARD_URL || 'https://dash.shallok.com').replace(/\/+$/, '');
        const loginUrl = `${dashboardUrl}/auth`;
        openBrowser(loginUrl);

        if (options.promptHandler?.waitForReturn) {
          const returnInput = await options.promptHandler.waitForReturn();
          const trimmed = (returnInput || '').trim();
          if (trimmed) {
            await saveTokenToEnv(cwd, trimmed);
            savedToken = true;
          }
        }
      }
    }

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
        cdnConnected: connectedToCdn,
        tokenSaved: savedToken,
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

    // 3. Auto-configure local MCP server for AI Coding Agents (.cursor/mcp.json)
    try {
      const cursorDir = path.join(cwd, '.cursor');
      await fs.mkdir(cursorDir, { recursive: true });
      const cursorMcpPath = path.join(cursorDir, 'mcp.json');

      let existingMcp: any = { mcpServers: {} };
      try {
        existingMcp = JSON.parse(await fs.readFile(cursorMcpPath, 'utf-8'));
        if (!existingMcp.mcpServers) existingMcp.mcpServers = {};
      } catch {}

      existingMcp.mcpServers['shallok'] = {
        command: 'npx',
        args: ['shallok', 'mcp'],
      };

      await fs.writeFile(cursorMcpPath, JSON.stringify(existingMcp, null, 2), 'utf-8');
      printer.info('Configured Shallok MCP server in .cursor/mcp.json');
    } catch {}

    // 4. Clear prompt instructions for the developer to hand off to their AI agent
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
    console.log('  5. Synchronize with Shallok Dashboard & Edge CDN via Shallok MCP');
    console.log('');
    console.log(chalk.bold(' Cloud Sync & Global CDN:'));
    if (connectedToCdn) {
      console.log('  Once your AI agent completes translations, publish to Edge CDN:');
      console.log(chalk.green('  npx shallok push'));
    } else {
      console.log('  To link your project and publish translations to the Global Edge CDN:');
      console.log(chalk.green('  npx shallok link --token <shk_live_...>'));
      console.log(chalk.dim('  (Generate tokens at https://dash.shallok.com/mcp)'));
    }
    console.log(chalk.bold.cyan('======================================================================'));
  } catch (err: any) {
    printer.error(`Setup failed: ${err.message}`);
    process.exit(1);
  }
}
