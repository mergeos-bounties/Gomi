/**
 * buildInfo — Build identity for Office status wall (issue #45).
 *
 * Surfaces version (from package.json) and optional git SHA for support
 * screenshots and debugging. Works at build time (Vite define) or runtime
 * best-effort (reading package.json / running git describe).
 *
 * Usage:
 *   import { getBuildInfo } from './buildInfo';
 *   const { version, gitSha, env } = getBuildInfo();
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface BuildInfo {
  version: string;
  gitSha?: string;
  gitDescribe?: string;
  env: string;
  nodeVersion: string;
  formatted: string;
}

let cached: BuildInfo | null = null;

/**
 * Return build identity. Result is cached after first call.
 */
export function getBuildInfo(): BuildInfo {
  if (cached) return cached;

  const version = readPackageVersion();
  const gitSha = readGitSha();
  const gitDescribe = gitSha ? readGitDescribe() : undefined;
  const env = process.env.NODE_ENV ?? 'development';
  const nodeVersion = process.version;

  const formatted = [
    `Gomi IDE v${version}`,
    gitSha ? `(${gitSha.slice(0, 8)})` : '',
    gitDescribe && gitDescribe !== gitSha ? `[${gitDescribe}]` : '',
    `- ${env}`,
  ].filter(Boolean).join(' ');

  cached = { version, gitSha, gitDescribe, env, nodeVersion, formatted };
  return cached;
}

/**
 * Copy the formatted build info string to clipboard.
 * Returns true on success, false on failure (non-HTTPS or permission denied).
 */
export async function copyBuildInfoToClipboard(): Promise<boolean> {
  try {
    const info = getBuildInfo();
    await navigator.clipboard.writeText(info.formatted);
    return true;
  } catch {
    return false;
  }
}

// ── internal ────────────────────────────────────

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, '..', '..', '..', '..', '..', 'package.json');
    const raw = readFileSync(pkgPath, { encoding: 'utf8' });
    const pkg = JSON.parse(raw);
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function readGitSha(): string | undefined {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim() || undefined;
  } catch {
    return undefined;
  }
}

function readGitDescribe(): string | undefined {
  try {
    return execSync('git describe --tags --always --dirty', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim() || undefined;
  } catch {
    return undefined;
  }
}
