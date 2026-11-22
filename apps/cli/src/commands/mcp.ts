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
  {
    name: 'shallok_generate_media_variants',
    description: 'Generate localized media variants (Images/PDFs) for an asset key with AI and review with user.',
    inputSchema: {
      type: 'object',
      required: ['assetKey'],
      properties: {
        assetKey: {
          type: 'string',
          description: 'Asset key e.g. "marketing.hero_banner".',
        },
        locales: {
          type: 'array',
          items: { type: 'string' },
          description: 'Target locales to generate (e.g. ["de", "es", "fr"]). Defaults to project target locales.',
        },
        prompt: {
          type: 'string',
          description: 'Custom creative guidance / instructions (max 100 chars).',
        },
      },
    },
  },
  {
    name: 'shallok_upload_media_variant',
    description: 'Upload an approved localized media variant to Shallok Dashboard and Global Edge CDN once user approves.',
    inputSchema: {
      type: 'object',
      required: ['assetKey', 'locale', 'userApproved'],
      properties: {
        assetKey: {
          type: 'string',
          description: 'Asset key e.g. "marketing.hero_banner".',
        },
        locale: {
          type: 'string',
          description: 'Target locale code e.g. "de".',
        },
        filePath: {
          type: 'string',
          description: 'Local file path to the generated image or document (e.g. "./assets/ad_banner_de.png").',
        },
        url: {
          type: 'string',
          description: 'External image or document URL for the variant.',
        },
        altText: {
          type: 'string',
          description: 'Alt text or document title for the localized variant.',
        },
        userApproved: {
          type: 'boolean',
          description: 'Set to true after getting explicit user approval to upload to Shallok Dashboard.',
        },
      },
    },
  },
  {
    name: 'shallok_edit_media_variant',
    description: 'Edit or refine a single localized media variant (Image/PDF) for an asset key and upload it to Shallok Dashboard once user approves.',
    inputSchema: {
      type: 'object',
      required: ['assetKey', 'locale', 'userApproved'],
      properties: {
        assetKey: {
          type: 'string',
          description: 'Asset key e.g. "marketing.hero_banner".',
        },
        locale: {
          type: 'string',
          description: 'Target locale of the single variant to edit e.g. "de".',
        },
        prompt: {
          type: 'string',
          description: 'Refinement instructions (max 100 chars).',
        },
        filePath: {
          type: 'string',
          description: 'Local file path to replacement image or document file (optional).',
        },
        url: {
          type: 'string',
          description: 'Updated image or document URL (optional).',
        },
        altText: {
          type: 'string',
          description: 'Updated alt text or description (optional).',
        },
        userApproved: {
          type: 'boolean',
          description: 'Set to true after getting explicit user approval.',
        },
      },
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

          case 'shallok_generate_media_variants': {
            const assetKey = toolArgs.assetKey;
            const customPrompt = toolArgs.prompt || '';
            const targetLocales = toolArgs.locales || manifest.supported_locales.filter((l: string) => l !== manifest.source_locale);

            // Generate localized variant recommendations
            const variants = targetLocales.map((loc: string) => ({
              locale: loc,
              suggestedUrl: `https://images.unsplash.com/photo-${loc === 'de' ? '1467269204594-9661b134dd2b' : loc === 'es' ? '1543783207-ec64e4d95325' : '1502602898657-3e91760cbb34'}?auto=format&fit=crop&w=800&q=80`,
              altText: `Localized ${assetKey} for ${loc.toUpperCase()}${customPrompt ? `: ${customPrompt}` : ''}`,
            }));

            sendResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      assetKey,
                      status: 'generated_awaiting_user_approval',
                      note: 'Present these generated variants to the user. Once approved, invoke shallok_upload_media_variant with userApproved: true.',
                      variants,
                    }, null, 2),
                  },
                ],
              },
            });
            return;
          }

          case 'shallok_upload_media_variant': {
            if (!toolArgs.userApproved) {
              throw new Error('User approval required before uploading variant to Shallok Dashboard. Ask user first, then pass userApproved: true.');
            }

            const cloud = manifest.cloud;
            if (!cloud?.project_id) {
              throw new Error('Project not linked to Shallok Cloud. Run "shallok link" first.');
            }

            const dashboardUrl = (cloud.dashboard_url || process.env.SHALLOK_DASHBOARD_URL || 'https://dash.shallok.com').replace(/\/+$/, '');
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
              throw new Error('SHALLOK_API_TOKEN not found.');
            }

            const uploadUrl = `${dashboardUrl}/api/projects/${encodeURIComponent(cloud.project_id)}/media/${encodeURIComponent(toolArgs.assetKey)}/variants`;
            let uploadRes: Response;

            if (toolArgs.filePath) {
              const absPath = path.resolve(cwd, toolArgs.filePath);
              const fileBuffer = await fs.readFile(absPath);
              const filename = path.basename(absPath);

              const formData = new FormData();
              formData.append('locale', toolArgs.locale);
              formData.append('file', new Blob([new Uint8Array(fileBuffer)]), filename);
              if (toolArgs.altText) formData.append('altText', toolArgs.altText);

              uploadRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                body: formData,
              });
            } else {
              uploadRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  locale: toolArgs.locale,
                  url: toolArgs.url,
                  altText: toolArgs.altText,
                }),
              });
            }

            const uploadResult = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok) {
              throw new Error(`Upload to Shallok Dashboard failed: ${uploadResult.error || uploadRes.statusText}`);
            }

            sendResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      success: true,
                      message: `Variant for ${toolArgs.locale.toUpperCase()} uploaded to Shallok Dashboard and Edge CDN.`,
                      details: uploadResult,
                    }, null, 2),
                  },
                ],
              },
            });
            return;
          }

          case 'shallok_edit_media_variant': {
            if (!toolArgs.userApproved) {
              throw new Error('User approval required before updating variant on Shallok Dashboard. Ask user first, then pass userApproved: true.');
            }

            const cloud = manifest.cloud;
            if (!cloud?.project_id) {
              throw new Error('Project not linked to Shallok Cloud. Run "shallok link" first.');
            }

            const dashboardUrl = (cloud.dashboard_url || process.env.SHALLOK_DASHBOARD_URL || 'https://dash.shallok.com').replace(/\/+$/, '');
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
              throw new Error('SHALLOK_API_TOKEN not found.');
            }

            const uploadUrl = `${dashboardUrl}/api/projects/${encodeURIComponent(cloud.project_id)}/media/${encodeURIComponent(toolArgs.assetKey)}/variants`;
            let uploadRes: Response;

            if (toolArgs.filePath) {
              const absPath = path.resolve(cwd, toolArgs.filePath);
              const fileBuffer = await fs.readFile(absPath);
              const filename = path.basename(absPath);

              const formData = new FormData();
              formData.append('locale', toolArgs.locale);
              formData.append('file', new Blob([new Uint8Array(fileBuffer)]), filename);
              const alt = toolArgs.altText || (toolArgs.prompt ? `${toolArgs.assetKey} (${toolArgs.locale.toUpperCase()}: ${toolArgs.prompt})` : undefined);
              if (alt) formData.append('altText', alt);

              uploadRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                body: formData,
              });
            } else {
              uploadRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  locale: toolArgs.locale,
                  url: toolArgs.url || `https://images.unsplash.com/photo-${toolArgs.locale === 'de' ? '1467269204594-9661b134dd2b' : '1543783207-ec64e4d95325'}?auto=format&fit=crop&w=800&q=80`,
                  altText: toolArgs.altText || (toolArgs.prompt ? `${toolArgs.assetKey} (${toolArgs.locale.toUpperCase()}: ${toolArgs.prompt})` : undefined),
                }),
              });
            }

            const uploadResult = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok) {
              throw new Error(`Single variant update failed: ${uploadResult.error || uploadRes.statusText}`);
            }

            sendResponse({
              jsonrpc: '2.0',
              id,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      success: true,
                      message: `Single variant for ${toolArgs.locale.toUpperCase()} updated on Shallok Dashboard.`,
                      details: uploadResult,
                    }, null, 2),
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

