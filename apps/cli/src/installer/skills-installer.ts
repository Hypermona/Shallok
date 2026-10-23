import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { CLI_VERSION } from '../version.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

export interface InstallSkillsResult {
  packageManager: PackageManager;
  dependencyInstalled: boolean;
  copiedSkills: string[];
  destinations: string[];
}

export async function detectPackageManager(projectRoot: string): Promise<PackageManager> {
  if (fsSync.existsSync(path.resolve(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fsSync.existsSync(path.resolve(projectRoot, 'yarn.lock'))) return 'yarn';
  if (
    fsSync.existsSync(path.resolve(projectRoot, 'bun.lockb')) ||
    fsSync.existsSync(path.resolve(projectRoot, 'bun.lock'))
  ) {
    return 'bun';
  }
  return 'npm';
}

function resolveSkillsDir(): string | null {
  const candidates = [
    path.resolve(__dirname, '../skills'),
    path.resolve(__dirname, '../../skills'),
    path.resolve(__dirname, '../../../skills'),
    path.resolve(__dirname, '../../../../skills'),
  ];

  for (const candidate of candidates) {
    if (
      fsSync.existsSync(candidate) &&
      fsSync.statSync(candidate).isDirectory() &&
      fsSync.existsSync(path.resolve(candidate, 'localization-and-translation-i18n'))
    ) {
      return candidate;
    }
  }

  return null;
}

export async function ensureShallokDependency(projectRoot: string): Promise<boolean> {
  const pkgPath = path.resolve(projectRoot, 'package.json');
  if (!fsSync.existsSync(pkgPath)) return false;

  try {
    const raw = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);

    // Skip if running inside the Shallok monorepo root
    if (pkg.name === 'shallok-monorepo') return false;

    const hasShallok =
      Boolean(pkg.dependencies?.shallok || pkg.dependencies?.['@shallok/cli']) ||
      Boolean(pkg.devDependencies?.shallok || pkg.devDependencies?.['@shallok/cli']);

    if (hasShallok) return false; // Already present

    const pm = await detectPackageManager(projectRoot);
    const installCmd =
      pm === 'pnpm'
        ? 'pnpm add -D shallok'
        : pm === 'yarn'
        ? 'yarn add -D shallok'
        : pm === 'bun'
        ? 'bun add -d shallok'
        : 'npm install -D shallok';

    try {
      await execAsync(installCmd, { cwd: projectRoot });
      return true;
    } catch {
      // If remote registry lookup fails (e.g. offline or not yet published), update package.json directly
      pkg.devDependencies = pkg.devDependencies || {};
      pkg.devDependencies['shallok'] = `^${CLI_VERSION}`;
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      return true;
    }
  } catch {
    return false;
  }
}

export async function installSkillsForProject(
  projectRoot: string,
  framework?: string
): Promise<InstallSkillsResult> {
  const pm = await detectPackageManager(projectRoot);
  const dependencyInstalled = await ensureShallokDependency(projectRoot);

  const skillsDir = resolveSkillsDir();
  const copiedSkills: string[] = [];
  const destinations: string[] = [];

  if (!skillsDir) {
    return {
      packageManager: pm,
      dependencyInstalled,
      copiedSkills,
      destinations,
    };
  }

  // Determine which skills to install:
  // If project is under specific skill set, copy that skill.
  // Otherwise, copy general 'localization-and-translation-i18n'.
  const frameworkSkillMap: Record<string, string> = {
    react: 'react-localization-and-translation-i18n',
    nextjs: 'nextjs-localization-and-translation-i18n',
    expo: 'expo-localization-and-translation-i18n',
    astro: 'astro-localization-and-translation-i18n',
  };

  const fwSkill = framework ? frameworkSkillMap[framework.toLowerCase()] : undefined;
  const selectedSkills = fwSkill ? [fwSkill] : ['localization-and-translation-i18n'];

  // Target directory:
  // .agents/skills (Customization root for Antigravity & AI agents)
  const targetRoots = [
    path.resolve(projectRoot, '.agents', 'skills'),
  ];

  for (const targetRoot of targetRoots) {
    for (const skillName of selectedSkills) {
      const srcSkillPath = path.resolve(skillsDir, skillName);
      if (fsSync.existsSync(srcSkillPath)) {
        const destSkillPath = path.resolve(targetRoot, skillName);
        await fs.mkdir(destSkillPath, { recursive: true });
        await copyDirRecursive(srcSkillPath, destSkillPath);
        if (!copiedSkills.includes(skillName)) {
          copiedSkills.push(skillName);
        }
      }
    }
    destinations.push(path.relative(projectRoot, targetRoot));
  }

  return {
    packageManager: pm,
    dependencyInstalled,
    copiedSkills,
    destinations,
  };
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.resolve(src, entry.name);
    const destPath = path.resolve(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
