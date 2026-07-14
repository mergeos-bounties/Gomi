/**
 * Desktop release readiness checker (issue #5).
 * Validates that all files required for a desktop release are present.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

export interface ReleaseCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface ReleaseCheckResult {
  allPassed: boolean;
  checks: ReleaseCheck[];
}

export function checkReleaseReadiness(projectRoot: string): ReleaseCheckResult {
  const checks: ReleaseCheck[] = [];

  function check(name: string, exists: boolean, message: string): void {
    checks.push({ name, passed: exists, message });
  }

  const root = path.resolve(projectRoot);

  // package.json
  const pkgExists = existsSync(path.join(root, 'package.json'));
  check('package.json', pkgExists, pkgExists ? 'Found' : 'Missing package.json');

  // product.json
  const prodExists = existsSync(path.join(root, 'product.json'));
  check('product.json', prodExists, prodExists ? 'Found' : 'Missing product.json');

  // Build output
  const distExists = existsSync(path.join(root, 'dist', 'index.html'));
  check('Build output (dist/index.html)', distExists, distExists ? 'Found' : 'Build not found — run npm run build');

  // Integration manifest
  const manifestExists = existsSync(path.join(root, 'build', 'gomi-code-oss.integration.json'));
  check('Integration manifest', manifestExists, manifestExists ? 'Found' : 'Missing build/gomi-code-oss.integration.json');

  // Branding assets
  const iconExists = existsSync(path.join(root, 'resources', 'gomi-branding', 'win32', 'gomi.ico'));
  check('Windows icon', iconExists, iconExists ? 'Found' : 'Missing — run npm run generate:brand-assets');

  // CI workflow
  const ciExists = existsSync(path.join(root, '.github', 'workflows', 'ci.yml'));
  check('CI workflow', ciExists, ciExists ? 'Found' : 'Missing .github/workflows/ci.yml');

  // Contributing docs
  const contribExists = existsSync(path.join(root, 'CONTRIBUTING.md'));
  check('CONTRIBUTING.md', contribExists, contribExists ? 'Found' : 'Missing — create from template');

  // Security docs
  const securityExists = existsSync(path.join(root, 'SECURITY.md'));
  check('SECURITY.md', securityExists, securityExists ? 'Found' : 'Missing — create from template');

  const allPassed = checks.every((c) => c.passed);

  return { allPassed, checks };
}

export function formatReleaseCheckResult(result: ReleaseCheckResult): string {
  const lines: string[] = ['Release Readiness Check', '======================', ''];
  for (const check of result.checks) {
    const icon = check.passed ? 'PASS' : 'FAIL';
    lines.push(`[${icon}] ${check.name}: ${check.message}`);
  }
  lines.push('');
  lines.push(result.allPassed ? 'All checks passed.' : 'Some checks failed. Fix the items above before releasing.');
  return lines.join('\n');
}
