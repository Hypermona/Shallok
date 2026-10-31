import path from 'node:path';
import fs from 'node:fs/promises';
import { CatalogStorage } from '@shallok/core';
import { Printer } from '../output/printer.js';

export interface LinkOptions {
  project?: string;
  token?: string;
  workspace?: string;
  url?: string;
  json?: boolean;
}

export async function linkCommand(options: LinkOptions): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const storage = new CatalogStorage(cwd);

  const manifest = await storage.readManifest();
  if (!manifest) {
    printer.error('No localization.json found in current directory. Run "shallok init" first.');
    process.exit(1);
  }

  const dashboardUrl = (options.url || process.env.SHALLOK_DASHBOARD_URL || 'https://dash.shallok.com').replace(/\/+$/, '');

  // 1. Resolve API Token
  let token = options.token || process.env.SHALLOK_API_TOKEN;

  if (!token) {
    // Try to read from .env.local or .env
    for (const envFile of ['.env.local', '.env']) {
      try {
        const envContent = await fs.readFile(path.join(cwd, envFile), 'utf-8');
        const match = envContent.match(/^SHALLOK_API_TOKEN\s*=\s*([^\s#]+)/m);
        if (match && match[1]) {
          token = match[1].trim();
          break;
        }
      } catch {}
    }
  }

  if (!token) {
    printer.error(
      `Shallok API Access Token required.\n` +
      `Generate your token at: ${dashboardUrl}/mcp\n` +
      `Then run:\n` +
      `  npx shallok link --project <project-id> --token <shk_live_...>`
    );
    process.exit(1);
  }

  // 2. Resolve Project ID
  let projectId = options.project || manifest.cloud?.project_id;
  if (!projectId) {
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(cwd, 'package.json'), 'utf-8'));
      if (pkg.name) {
        projectId = pkg.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^@.*\//, '');
      }
    } catch {}
  }
  if (!projectId) {
    projectId = path.basename(cwd).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  }

  printer.log(`Connecting project "${projectId}" to Shallok Dashboard (${dashboardUrl})...`);

  // 3. Handshake & Validate Token with Dashboard API
  let workspaceSlug = options.workspace || manifest.cloud?.workspace || '';
  try {
    const res = await fetch(`${dashboardUrl}/api/subdomain/current`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      printer.error(`Invalid or expired API token. Please generate a new token at ${dashboardUrl}/mcp`);
      process.exit(1);
    }

    if (res.ok) {
      const subData: any = await res.json().catch(() => ({}));
      if (subData?.workspace?.slug) {
        workspaceSlug = subData.workspace.slug;
      }
    }
  } catch (err: any) {
    // Non-fatal if offline/local dev, use fallback workspace
    if (!workspaceSlug) {
      workspaceSlug = 'app';
    }
  }

  const cdnBase = workspaceSlug
    ? `https://${workspaceSlug}.shallok.com/${projectId}`
    : `${dashboardUrl}/cdn/${projectId}`;

  // 4. Update localization.json manifest with cloud configuration
  manifest.cloud = {
    project_id: projectId,
    workspace: workspaceSlug,
    dashboard_url: dashboardUrl,
    cdn_url: cdnBase,
    auto_publish: true,
  };

  await storage.writeManifest(manifest);

  // 5. Store SHALLOK_API_TOKEN in .env.local (ignored by Git)
  try {
    const envLocalPath = path.join(cwd, '.env.local');
    let envContent = '';
    try {
      envContent = await fs.readFile(envLocalPath, 'utf-8');
    } catch {}

    if (!envContent.includes('SHALLOK_API_TOKEN=')) {
      const newline = envContent.length > 0 && !envContent.endsWith('\n') ? '\n' : '';
      await fs.writeFile(
        envLocalPath,
        `${envContent}${newline}# Shallok Cloud API Token\nSHALLOK_API_TOKEN=${token}\n`,
        'utf-8'
      );
    }
  } catch {}

  // 6. Configure local MCP config (.cursor/mcp.json)
  let mcpConfigured = false;
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
    mcpConfigured = true;
  } catch {}

  if (options.json) {
    printer.json({
      success: true,
      projectId,
      workspace: workspaceSlug,
      dashboardUrl,
      cdnBaseUrl: cdnBase,
      mcpConfigured,
      manifestCloud: manifest.cloud,
    });
    return;
  }

  printer.header('Shallok • Project Successfully Connected to Cloud');
  printer.success(`Linked project ID: ${projectId}`);
  if (workspaceSlug) {
    printer.info(`Workspace subdomain: ${workspaceSlug}.shallok.com`);
  }
  printer.info(`Live CDN Base: ${cdnBase}`);
  if (mcpConfigured) {
    printer.success(`Configured Shallok MCP server in .cursor/mcp.json`);
  }
  printer.log('');
  printer.log('Next Steps:');
  printer.log('  1. Upload your current translations to the Global Edge CDN:');
  printer.log('     npx shallok push');
  printer.log('  2. Ask your AI coding agent (Cursor, Claude, Antigravity) to translate keys:');
  printer.log('     "Add Kannada & Hindi to this app"');
}

