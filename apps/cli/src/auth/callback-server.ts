import http from 'node:http';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';

export interface AuthResult {
  token: string;
  projectId?: string;
  slug?: string;
  projectName?: string;
  workspace?: string;
  sourceLocale?: string;
  locales?: string[];
}

export interface LocalAuthServer {
  port: number;
  state: string;
  callbackUrl: string;
  waitForAuth: (timeoutMs?: number) => Promise<AuthResult>;
  close: () => Promise<void>;
}

/**
 * Spins up a temporary local HTTP server to receive OAuth/API token callback
 * from Shallok Dashboard, identical to Wrangler, Supabase, and Vercel CLI flows.
 */
export async function startLocalAuthServer(): Promise<LocalAuthServer> {
  const state = crypto.randomBytes(16).toString('hex');
  let authResolver: ((result: AuthResult) => void) | null = null;
  let serverClosed = false;

  const authPromise = new Promise<AuthResult>((resolve) => {
    authResolver = resolve;
  });

  const server = http.createServer((req, res) => {
    // CORS headers to permit both full-page redirect and client-side fetch from the dashboard
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const host = req.headers.host || `127.0.0.1:${(server.address() as AddressInfo)?.port || 0}`;
    const reqUrl = new URL(req.url || '/', `http://${host}`);

    if (reqUrl.pathname === '/callback' || reqUrl.pathname === '/') {
      const finishWithToken = (
        token: string,
        projectId?: string,
        workspace?: string,
        extra?: {
          slug?: string;
          projectName?: string;
          sourceLocale?: string;
          locales?: string[];
        }
      ) => {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shallok • Authentication Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #090d16;
      color: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      padding: 40px 32px;
      text-align: center;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .check {
      width: 64px;
      height: 64px;
      background: #064e3b;
      color: #34d399;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
    }
    p {
      margin: 0 0 24px;
      font-size: 14px;
      color: #9ca3af;
      line-height: 1.5;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      background: #1e293b;
      color: #38bdf8;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
  </style>
  <script>
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashToken = hashParams.get('token') || hashParams.get('access_token') || hashParams.get('api_token');
      const hashState = hashParams.get('state');
      const hashProj = hashParams.get('project') || hashParams.get('projectId');
      const hashSlug = hashParams.get('slug');
      const hashWs = hashParams.get('workspace');
      const hashName = hashParams.get('projectName') || hashParams.get('name');
      const hashSrc = hashParams.get('sourceLocale') || hashParams.get('defaultLanguage') || hashParams.get('defaultLocale');
      const hashLocs = hashParams.get('locales') || hashParams.get('languages');
      if (hashToken) {
        let q = '/callback?token=' + encodeURIComponent(hashToken) + '&state=' + encodeURIComponent(hashState || '') +
          (hashProj ? '&project=' + encodeURIComponent(hashProj) : '') +
          (hashSlug ? '&slug=' + encodeURIComponent(hashSlug) : '') +
          (hashWs ? '&workspace=' + encodeURIComponent(hashWs) : '') +
          (hashName ? '&projectName=' + encodeURIComponent(hashName) : '') +
          (hashSrc ? '&sourceLocale=' + encodeURIComponent(hashSrc) : '') +
          (hashLocs ? '&locales=' + encodeURIComponent(hashLocs) : '');
        fetch(q);
      }
    }
  </script>
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h1>Authenticated with Shallok</h1>
    <p>Your API token has been received by the Shallok CLI.<br>You can safely close this window and return to your terminal.</p>
    <div class="badge">Shallok CLI • Ready</div>
  </div>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);

        if (authResolver && token) {
          authResolver({
            token,
            projectId: projectId || extra?.slug || undefined,
            slug: extra?.slug || projectId || undefined,
            projectName: extra?.projectName || undefined,
            workspace: workspace || undefined,
            sourceLocale: extra?.sourceLocale || undefined,
            locales: extra?.locales || undefined,
          });
          authResolver = null;
        }
      };

      // 1. Query parameters
      const token =
        reqUrl.searchParams.get('token') ||
        reqUrl.searchParams.get('api_token') ||
        reqUrl.searchParams.get('apiKey') ||
        reqUrl.searchParams.get('access_token');

      const projectId =
        reqUrl.searchParams.get('project') ||
        reqUrl.searchParams.get('projectId') ||
        reqUrl.searchParams.get('project_id') ||
        reqUrl.searchParams.get('slug') ||
        undefined;

      const slug =
        reqUrl.searchParams.get('slug') ||
        reqUrl.searchParams.get('project') ||
        undefined;

      const projectName =
        reqUrl.searchParams.get('projectName') ||
        reqUrl.searchParams.get('project_name') ||
        reqUrl.searchParams.get('name') ||
        undefined;

      const workspace =
        reqUrl.searchParams.get('workspace') ||
        reqUrl.searchParams.get('workspaceSlug') ||
        undefined;

      const sourceLocale =
        reqUrl.searchParams.get('sourceLocale') ||
        reqUrl.searchParams.get('source_locale') ||
        reqUrl.searchParams.get('defaultLanguage') ||
        reqUrl.searchParams.get('defaultLocale') ||
        undefined;

      const localesRaw =
        reqUrl.searchParams.get('locales') ||
        reqUrl.searchParams.get('languages') ||
        undefined;

      const locales = localesRaw
        ? localesRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;

      if (token) {
        finishWithToken(token, projectId, workspace, {
          slug,
          projectName,
          sourceLocale,
          locales,
        });
        return;
      }

      // 2. POST body handling (e.g. JSON webhook/callback)
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const postToken = data.token || data.api_token || data.apiKey || data.access_token;
            if (postToken) {
              const postLocales = Array.isArray(data.locales)
                ? data.locales
                : typeof data.locales === 'string'
                  ? data.locales.split(',').map((s: string) => s.trim()).filter(Boolean)
                  : undefined;
              finishWithToken(postToken, data.project || data.projectId, data.workspace, {
                slug: data.slug || data.project,
                projectName: data.projectName || data.name,
                sourceLocale: data.sourceLocale || data.defaultLanguage,
                locales: postLocales,
              });
              return;
            }
          } catch {}
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing token' }));
        });
        return;
      }

      // 3. If GET without token, render HTML page which can capture hash fragments (#token=...)
      finishWithToken('', undefined, undefined);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.once('error', reject);
  });

  const address = server.address() as AddressInfo;
  const port = address.port;
  const callbackUrl = `http://localhost:${port}/callback`;

  const close = async () => {
    if (serverClosed) return;
    serverClosed = true;
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  };

  const waitForAuth = async (timeoutMs: number = 300000): Promise<AuthResult> => {
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Authentication timed out.'));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([authPromise, timeoutPromise]);
      return result;
    } finally {
      if (timer) clearTimeout(timer);
      await close();
    }
  };

  return {
    port,
    state,
    callbackUrl,
    waitForAuth,
    close,
  };
}

