import path from 'node:path';
import fs from 'node:fs/promises';
import readline from 'node:readline';
import { CatalogStorage } from '@shallok/core';
import { Printer } from '../output/printer.js';

export interface MediaCommandOptions {
  project?: string;
  token?: string;
  url?: string;
  dashboardUrl?: string;
  locales?: string;
  prompt?: string;
  file?: string;
  locale?: string;
  alt?: string;
  yes?: boolean;
  json?: boolean;
}

async function resolveCloudConfig(options: MediaCommandOptions, cwd: string, printer: Printer) {
  const storage = new CatalogStorage(cwd);
  let manifest: any = null;
  try {
    manifest = await storage.readManifest();
  } catch {
    try {
      const raw = await fs.readFile(path.join(cwd, 'localization.json'), 'utf-8');
      manifest = JSON.parse(raw);
    } catch {}
  }

  const cloud = manifest?.cloud;
  const projectId = options.project || cloud?.project_id;
  const dashboardUrl = (options.dashboardUrl || cloud?.dashboard_url || process.env.SHALLOK_DASHBOARD_URL || 'https://dash.shallok.com').replace(/\/+$/, '');

  if (!projectId) {
    printer.error('Project is not linked to Shallok Cloud. Run "shallok link" first.');
    process.exit(1);
  }

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
    printer.error('SHALLOK_API_TOKEN is missing. Provide via --token, set in .env.local, or run "shallok link".');
    process.exit(1);
  }

  return { projectId, token, dashboardUrl, manifest };
}

function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

/**
 * List media assets from Shallok Dashboard
 */
export async function mediaListCommand(options: MediaCommandOptions): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const { projectId, token, dashboardUrl } = await resolveCloudConfig(options, cwd, printer);

  try {
    const res = await fetch(`${dashboardUrl}/api/projects/${encodeURIComponent(projectId)}/media`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      printer.error(`Failed to fetch media assets: ${err.error || res.statusText}`);
      process.exit(1);
    }

    const data: any = await res.json();
    const assets = data.assets || [];

    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    printer.header(`Shallok Media Assets (${assets.length})`);
    if (assets.length === 0) {
      printer.info('No localized media assets found. Create asset keys in Shallok Dash or via CLI.');
      return;
    }

    for (const a of assets) {
      const variantsCount = (a.variants || []).length;
      printer.log(`• ${a.key} [${a.type.toUpperCase()}] - "${a.name}" (Base: ${a.sourceLocale.toUpperCase()})`);
      printer.log(`  Variants: ${variantsCount} uploaded; CDN: /cdn/${projectId}/media/${a.sourceLocale}.json`);
    }
  } catch (err: any) {
    printer.error(`Media list error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Generate localized variants for a media asset key with AI and upload upon user approval
 */
export async function mediaGenerateCommand(assetKey: string, options: MediaCommandOptions): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const { projectId, token, dashboardUrl, manifest } = await resolveCloudConfig(options, cwd, printer);

  printer.header(`Shallok Media Variant Generator • ${assetKey}`);
  printer.info(`Fetching asset details from Shallok Dashboard...`);

  let asset: any = null;
  try {
    const res = await fetch(`${dashboardUrl}/api/projects/${encodeURIComponent(projectId)}/media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data: any = await res.json();
      asset = (data.assets || []).find((a: any) => a.key === assetKey || a.id === assetKey);
    }
  } catch {}

  if (!asset) {
    printer.error(`Asset key "${assetKey}" not found in project "${projectId}". Create the key first in Shallok Dash.`);
    process.exit(1);
  }

  // Determine target locales
  const sourceLocale = (asset.sourceLocale || 'en').toLowerCase();
  let targetLocales: string[] = [];

  if (options.locales) {
    targetLocales = options.locales.split(',').map((l) => l.trim().toLowerCase()).filter((l) => l && l !== sourceLocale);
  } else if (manifest?.supported_locales) {
    targetLocales = manifest.supported_locales.filter((l: string) => l.toLowerCase() !== sourceLocale);
  }

  if (targetLocales.length === 0) {
    targetLocales = ['es', 'de', 'fr', 'ja'].filter((l) => l !== sourceLocale);
  }

  printer.info(`Target locales for generation: ${targetLocales.map((l) => l.toUpperCase()).join(', ')}`);
  if (options.prompt) {
    printer.info(`Custom instruction: "${options.prompt}"`);
  }

  // Check whether image has text
  const baseVariant = (asset.variants || []).find((v: any) => v.locale.toLowerCase() === sourceLocale) || asset.variants?.[0];
  const hasTextHeuristic = /banner|text|title|header|label|ad|promo|badge/i.test(`${asset.key} ${asset.name} ${asset.description || ''} ${baseVariant?.altText || ''}`);

  printer.info(`Image Text Analysis: ${hasTextHeuristic ? 'Translatable text detected in base image' : 'Visual adaptation without embedded text'}`);

  // Check for local generated variant files
  const candidateFiles: { locale: string; filePath: string; altText: string }[] = [];
  const searchDirs = [cwd, path.join(cwd, 'assets'), path.join(cwd, 'public'), path.join(cwd, 'media')];
  const extensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.pdf'];

  for (const loc of targetLocales) {
    for (const dir of searchDirs) {
      for (const ext of extensions) {
        const potentialNames = [
          path.join(dir, `${assetKey}_${loc}${ext}`),
          path.join(dir, `${assetKey}.${loc}${ext}`),
          path.join(dir, `${loc}_${assetKey}${ext}`),
          path.join(dir, `${loc}${ext}`),
        ];

        for (const p of potentialNames) {
          try {
            await fs.access(p);
            candidateFiles.push({
              locale: loc,
              filePath: p,
              altText: `${asset.name} (${loc.toUpperCase()} localized${options.prompt ? `: ${options.prompt}` : ''})`,
            });
            break;
          } catch {}
        }
        if (candidateFiles.some((c) => c.locale === loc)) break;
      }
      if (candidateFiles.some((c) => c.locale === loc)) break;
    }
  }

  if (candidateFiles.length === 0) {
    printer.header(`AI Agent Action Needed for "${assetKey}":`);
    printer.info(`1. Base Image URL: ${baseVariant?.publicUrl || '[None]'}`);
    printer.info(`2. Translatable Text: ${hasTextHeuristic ? 'YES - Extract and translate in-image text' : 'NO - Visual/cultural adaptation only'}`);
    printer.info(`3. Target Locales: ${targetLocales.map((l) => l.toUpperCase()).join(', ')}`);
    if (options.prompt) printer.info(`4. Custom Prompt: "${options.prompt}"`);
    printer.log(`\nNext Steps:`);
    printer.log(`• Generate localized variant image files using your AI image generation tool.`);
    printer.log(`• Save files locally (e.g. "./assets/${assetKey}_<locale>.png").`);
    printer.log(`• Then upload them using:`);
    printer.log(`  shallok media upload "${assetKey}" <filePath> --locale <locale>\n`);
    return;
  }

  printer.log(`\nFound ${candidateFiles.length} generated local variant file(s):`);
  for (const c of candidateFiles) {
    printer.log(`• [${c.locale.toUpperCase()}]: ${c.filePath}`);
  }

  // User approval step
  let approved = options.yes ?? false;
  if (!approved) {
    printer.log('\nReview the localized variant file(s) above.');
    approved = await askConfirmation('Approve and upload these localized variants to Shallok Dashboard?');
  }

  if (!approved) {
    printer.warn('Upload cancelled. No variants were uploaded to Shallok Dashboard.');
    return;
  }

  printer.info('Uploading approved variant file(s) to Shallok Dashboard...');

  for (const c of candidateFiles) {
    try {
      const uploadUrl = `${dashboardUrl}/api/projects/${encodeURIComponent(projectId)}/media/${encodeURIComponent(asset.id)}/variants`;
      const fileBuffer = await fs.readFile(c.filePath);
      const filename = path.basename(c.filePath);

      const formData = new FormData();
      formData.append('locale', c.locale);
      formData.append('file', new Blob([new Uint8Array(fileBuffer)]), filename);
      formData.append('altText', c.altText);

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        printer.error(`Failed to upload ${c.locale.toUpperCase()}: ${err.error || res.statusText}`);
      } else {
        printer.success(`Uploaded ${c.locale.toUpperCase()} variant from ${filename} successfully.`);
      }
    } catch (err: any) {
      printer.error(`Upload error for ${c.locale.toUpperCase()}: ${err.message}`);
    }
  }

  printer.success(`All approved variants uploaded to Shallok Dash for key "${assetKey}".`);
}

/**
 * Upload a single localized media variant file or URL to Shallok Dashboard
 */
export async function mediaUploadCommand(assetKey: string, options: MediaCommandOptions): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const { projectId, token, dashboardUrl } = await resolveCloudConfig(options, cwd, printer);

  const locale = (options.locale || '').trim().toLowerCase();
  if (!locale) {
    printer.error('Locale is required. Specify with --locale <code_e.g._de>');
    process.exit(1);
  }

  if (!options.file && !options.url) {
    printer.error('Either --file <path> or --url <externalUrl> is required.');
    process.exit(1);
  }

  // User confirmation
  let approved = options.yes ?? false;
  if (!approved) {
    approved = await askConfirmation(`Upload ${locale.toUpperCase()} variant for "${assetKey}" to Shallok Dashboard?`);
  }

  if (!approved) {
    printer.warn('Upload cancelled by user.');
    return;
  }

  printer.info(`Uploading ${locale.toUpperCase()} variant to Shallok Dashboard...`);

  try {
    const uploadUrl = `${dashboardUrl}/api/projects/${encodeURIComponent(projectId)}/media/${encodeURIComponent(assetKey)}/variants`;

    if (options.file) {
      const filePath = path.resolve(cwd, options.file);
      const fileBuffer = await fs.readFile(filePath);
      const filename = path.basename(filePath);

      const formData = new FormData();
      formData.append('locale', locale);
      formData.append('file', new Blob([new Uint8Array(fileBuffer)]), filename);
      if (options.alt) formData.append('altText', options.alt);

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        printer.error(`Upload failed: ${err.error || res.statusText}`);
        process.exit(1);
      }
    } else if (options.url) {
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          locale,
          url: options.url,
          altText: options.alt,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        printer.error(`Upload failed: ${err.error || res.statusText}`);
        process.exit(1);
      }
    }

    printer.success(`Successfully uploaded ${locale.toUpperCase()} variant for "${assetKey}" to Shallok Dashboard!`);
  } catch (err: any) {
    printer.error(`Upload error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Edit / refine a single localized variant for an asset key with AI instructions
 */
export async function mediaEditCommand(assetKey: string, options: MediaCommandOptions): Promise<void> {
  const cwd = process.cwd();
  const printer = new Printer(options.json);
  const { projectId, token, dashboardUrl } = await resolveCloudConfig(options, cwd, printer);

  const locale = (options.locale || '').trim().toLowerCase();
  if (!locale) {
    printer.error('Locale is required. Specify which single variant to edit with --locale <code_e.g._de>');
    process.exit(1);
  }

  printer.header(`Shallok Media Variant Editor • ${assetKey} [${locale.toUpperCase()}]`);

  // 1. Fetch existing asset to get current variant state
  let asset: any = null;
  try {
    const res = await fetch(`${dashboardUrl}/api/projects/${encodeURIComponent(projectId)}/media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data: any = await res.json();
      asset = (data.assets || []).find((a: any) => a.key === assetKey || a.id === assetKey);
    }
  } catch {}

  const currentVariant = asset?.variants?.find((v: any) => v.locale.toLowerCase() === locale);
  if (currentVariant) {
    printer.info(`Current ${locale.toUpperCase()} variant URL: ${currentVariant.publicUrl}`);
  }

  if (options.prompt) {
    printer.info(`AI Refinement Instructions: "${options.prompt}"`);
  }

  // 2. Resolve refined single variant file or URL
  let fileBuffer: Buffer | null = null;
  let filename: string | null = null;
  let refinedUrl = options.url || currentVariant?.publicUrl;

  if (options.file) {
    const filePath = path.resolve(cwd, options.file);
    fileBuffer = await fs.readFile(filePath);
    filename = path.basename(filePath);
  }

  const refinedAlt = options.alt || (options.prompt ? `${asset?.name || assetKey} (${locale.toUpperCase()}: ${options.prompt})` : currentVariant?.altText);

  printer.log(`\nProposed Refined ${locale.toUpperCase()} Variant:`);
  printer.log(`• Locale: ${locale.toUpperCase()}`);
  if (filename) printer.log(`• File: ${filename}`);
  if (refinedUrl) printer.log(`• URL: ${refinedUrl}`);
  if (refinedAlt) printer.log(`• Alt: "${refinedAlt}"`);

  // 3. Confirm with user
  let approved = options.yes ?? false;
  if (!approved) {
    approved = await askConfirmation(`Approve and upload this single ${locale.toUpperCase()} variant to Shallok Dashboard?`);
  }

  if (!approved) {
    printer.warn(`Upload cancelled. The ${locale.toUpperCase()} variant was not modified.`);
    return;
  }

  // 4. Upload ONLY this single variant to dashboard
  try {
    const uploadUrl = `${dashboardUrl}/api/projects/${encodeURIComponent(projectId)}/media/${encodeURIComponent(asset?.id || assetKey)}/variants`;
    let res: Response;

    if (fileBuffer && filename) {
      const formData = new FormData();
      formData.append('locale', locale);
      formData.append('file', new Blob([new Uint8Array(fileBuffer)]), filename);
      if (refinedAlt) formData.append('altText', refinedAlt);

      res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
    } else {
      res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          locale,
          url: refinedUrl,
          altText: refinedAlt,
        }),
      });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      printer.error(`Failed to update ${locale.toUpperCase()} variant: ${err.error || res.statusText}`);
      process.exit(1);
    }

    printer.success(`Single variant for ${locale.toUpperCase()} successfully updated on Shallok Dashboard!`);
  } catch (err: any) {
    printer.error(`Edit error: ${err.message}`);
    process.exit(1);
  }
}
