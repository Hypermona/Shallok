import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function resolveCliVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const candidates = [
      path.resolve(__dirname, '../package.json'),
      path.resolve(__dirname, '../../package.json'),
      path.resolve(__dirname, '../../../package.json'),
    ];

    for (const candidate of candidates) {
      if (fsSync.existsSync(candidate)) {
        const pkg = JSON.parse(fsSync.readFileSync(candidate, 'utf8'));
        if (pkg && pkg.name === 'shallok' && pkg.version) {
          return pkg.version;
        }
      }
    }
  } catch {
    // fallback if file cannot be read
  }

  return '0.1.5';
}

export const CLI_VERSION = resolveCliVersion();
