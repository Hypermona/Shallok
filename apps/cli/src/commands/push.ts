import path from 'node:path';
import fs from 'node:fs/promises';
import { CatalogStorage } from '@shallok/core';
import { buildCommand } from './build.js';
import { Printer } from '../output/printer.js';

export interface PushOptions {
  project?: string;
  token?: string;
  url?: string;
  json?: boolean;
}

export async function pushCommand(options: PushOptions): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const storage = new CatalogStorage(cwd);

  const manifest = await storage.readManifest();
  if (!manifest) {
    printer.error('No localization.json found. Run "shallok init" first.');
    process.exit(1);
  }

  const cloud = manifest.cloud;
  const projectId = options.project || cloud?.project_id;
  const dashboardUrl = (options.url || cloud?.dashboard_url || process.env.SHALLOK_DASHBOARD_URL || 'https://dash.shallok.com').replace(/\/+$/, '');

  if (!projectId) {
    printer.error(
      'Project is not yet connected to Shallok Cloud.\n' +
      'Run "shallok link" first to connect this repository to your Shallok Dashboard.'
    );
    process.exit(1);
  }

  // 1. Resolve API Token
  let token = options.token || process.env.SHALLOK_API_TOKEN;
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
    printer.error(
      `SHALLOK_API_TOKEN is missing.\n` +
      `Provide via --token, set SHALLOK_API_TOKEN in .env.local, or run "shallok link".`
    );
    process.exit(1);
  }

  printer.log(`Preparing translation files for project "${projectId}"...`);

  // 2. Ensure runtime message bundles exist; if not, compile them
  const runtimeDir = path.join(cwd, manifest.paths.translations_directory, 'runtime');
  let runtimeExists = false;
  try {
    const entries = await fs.readdir(runtimeDir);
    runtimeExists = entries.some((f) => f.endsWith('.json'));
  } catch {}

  if (!runtimeExists) {
    printer.log('Runtime bundles not found; compiling them via "shallok build"...');
    await buildCommand({ json: false });
  }

  // 3. Read compiled locale files
  const filesPayload: Array<{ locale: string; content: Record<string, any>; version?: string }> = [];
  try {
    const runtimeFiles = await fs.readdir(runtimeDir);
    for (const file of runtimeFiles) {
      if (!file.endsWith('.json')) continue;
      const locale = file.replace(/\.json$/i, '').toLowerCase();
      const content = JSON.parse(await fs.readFile(path.join(runtimeDir, file), 'utf-8'));
      filesPayload.push({
        locale,
        content,
        version: String(manifest.localization_version || '1.0.0'),
      });
    }
  } catch (err: any) {
    printer.error(`Failed to read runtime message files: ${err.message}`);
    process.exit(1);
  }

  if (filesPayload.length === 0) {
    printer.error('No translation files found to upload. Run "shallok extract" and "shallok translate" first.');
    process.exit(1);
  }

  printer.log(`Uploading ${filesPayload.length} locale bundles to Shallok Cloud (${dashboardUrl})...`);

  // 4. POST batch sync request to Dashboard API
  try {
    const syncUrl = `${dashboardUrl}/api/projects/${encodeURIComponent(projectId)}/sync`;
    const res = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        manifest,
        version: String(manifest.localization_version || '1.0.0'),
        files: filesPayload,
        uploadedVia: 'cli',
      }),
    });

    const result: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      printer.error(`Cloud sync failed (${res.status}): ${result.error || res.statusText}`);
      process.exit(1);
    }

    if (options.json) {
      printer.json({
        success: true,
        projectId: result.projectId,
        workspace: result.workspace,
        syncedLocales: result.syncedLocales,
        totalKeys: result.totalKeys,
        cdnUrls: result.cdnUrls,
        manifestUrl: result.manifestUrl,
      });
      return;
    }

    printer.header('Shallok • Cloud Sync Succeeded!');
    printer.success(`Published ${result.filesCount || filesPayload.length} locales (${result.totalKeys || 0} keys)`);
    printer.info(`Project: ${result.projectId}`);
    if (result.workspace) {
      printer.info(`Tenant: ${result.workspace}.shallok.com`);
    }
    printer.log('');
    printer.log('Global Edge CDN Endpoints:');
    if (result.cdnUrls) {
      for (const [loc, url] of Object.entries(result.cdnUrls)) {
        printer.log(`  ✔ [${loc.toUpperCase()}] ${url}`);
      }
    }
    if (result.manifestUrl) {
      printer.log(`  ✔ [MANIFEST] ${result.manifestUrl}`);
    }
  } catch (err: any) {
    printer.error(`Network error during cloud sync: ${err.message}`);
    process.exit(1);
  }
}

