import path from 'node:path';
import fs from 'node:fs/promises';
import readline from 'node:readline';
import { CatalogStorage } from '@shallok/core';
import { buildCommand } from './build.js';

export const LOCAL_MCP_TOOLS = [
  {
    name: 'shallok_sync_project',
    description: 'Synchronize local localization files and compiled translations to Shallok Cloud and Global Edge CDN.',
    inputSchema: {
      type: 'object',
      properties: {
        forceBuild: {
          type: 'boolean',
          description: 'Rebuild runtime bundles before syncing. Default: true',
        },
      },
    },
  },
  {
    name: 'shallok_get_cdn_url',
    description: 'Get live Global Edge CDN URL for a specific locale from project cloud configuration.',
    inputSchema: {
      type: 'object',
      required: ['locale'],
      properties: {
        locale: {
          type: 'string',
          description: 'Locale code (e.g. "en", "kn", "hi", "es").',
        },
      },
    },
  },
  {
    name: 'shallok_get_project_status',
    description: 'Check local project localization status, supported locales, and cloud connection details.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

export async function mcpCommand(): Promise<void> {
  const cwd = process.cwd();
  const storage = new CatalogStorage(cwd);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const sendResponse = (resp: any) => {
    process.stdout.write(JSON.stringify(resp) + '\n');
  };

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let req: any;
    try {
      req = JSON.parse(trimmed);
    } catch (err: any) {
      sendResponse({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: `Parse error: ${err.message}` },
      });
      return;
    }

    const { id, method, params } = req;

    if (method === 'initialize') {
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'shallok-local-mcp', version: '1.0.0' },
        },
      });
      return;
    }

    if (method === 'notifications/initialized') {
      return;
    }

    if (method === 'tools/list') {
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: { tools: LOCAL_MCP_TOOLS },
      });
      return;
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      try {
        const manifest = await storage.readManifest();
        if (!manifest) {
          throw new Error('No localization.json found in current directory.');
        }

        switch (toolName) {
          case 'shallok_get_project_status': {
            sendResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        sourceLocale: manifest.source_locale,
                        supportedLocales: manifest.supported_locales,
                        framework: manifest.framework,
                        cloud: manifest.cloud || 'Not connected (run "shallok link")',
                      },
                      null,
                      2
                    ),
                  },
                ],
              },
            });
            return;
          }

          case 'shallok_get_cdn_url': {
            const loc = (toolArgs.locale || 'en').toLowerCase();
            const cloud = manifest.cloud;
            if (!cloud?.project_id) {
              throw new Error('Project not linked to Shallok Cloud. Run "shallok link" first.');
            }
            const cdnUrl = cloud.cdn_url
              ? `${cloud.cdn_url}/${loc}.json`
              : `https://${cloud.workspace || 'app'}.shallok.com/${cloud.project_id}/${loc}.json`;

            sendResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({ locale: loc, cdnUrl, projectId: cloud.project_id }, null, 2),
                  },
                ],
              },
            });
            return;
          }

          case 'shallok_sync_project': {
            const cloud = manifest.cloud;
            if (!cloud?.project_id) {
              throw new Error('Project not connected to Shallok Cloud. Run "shallok link --token <shk_live_...>" first.');
            }

            // Read API token
            let token = process.env.SHALLOK_API_TOKEN;
            if (!token) {
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
              throw new Error('SHALLOK_API_TOKEN not found in environment or .env.local.');
            }

            // Always compile runtime bundles before push
            await buildCommand({ json: true });

            const runtimeDir = path.join(cwd, manifest.paths.translations_directory, 'runtime');
            const runtimeFiles = await fs.readdir(runtimeDir);
            const filesPayload: Array<{ locale: string; content: any }> = [];

            for (const file of runtimeFiles) {
              if (!file.endsWith('.json')) continue;
              const locale = file.replace(/\.json$/i, '').toLowerCase();
              const content = JSON.parse(await fs.readFile(path.join(runtimeDir, file), 'utf-8'));
              filesPayload.push({ locale, content });
            }

            const dashboardUrl = (cloud.dashboard_url || 'https://dash.shallok.com').replace(/\/+$/, '');
            const syncUrl = `${dashboardUrl}/api/projects/${encodeURIComponent(cloud.project_id)}/sync`;

            const res = await fetch(syncUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                projectId: cloud.project_id,
                manifest,
                version: String(manifest.localization_version || '1.0.0'),
                files: filesPayload,
                uploadedVia: 'mcp',
              }),
            });

            const result: any = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(`Sync failed: ${result.error || res.statusText}`);
            }

            sendResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              },
            });
            return;
          }

          default:
            sendResponse({
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: `Tool not found: ${toolName}` },
            });
            return;
        }
      } catch (err: any) {
        sendResponse({
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: err.message },
        });
        return;
      }
    }

    sendResponse({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  });
}

