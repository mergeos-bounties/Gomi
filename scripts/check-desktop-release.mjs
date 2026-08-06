#!/usr/bin/env node

/**
 * Gomi IDE — Desktop Release Readiness Checker
 *
 * Validates that the repository is ready for desktop packaging:
 *   - product.json branding is Gomi-specific
 *   - Win32 icon paths are configured
 *   - Electron main entry is present
 *   - Branding asset directories exist
 *
 * Usage: node scripts/check-desktop-release.mjs
 * Exit: 0 = ready, 1 = checks failed
 */

import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const CHECKS = [];
let failures = 0;

function check(name, fn) {
  CHECKS.push({ name, fn });
}

function fail(message) {
  failures++;
  console.error(`  FAIL  ${message}`);
}

function ok(message) {
  console.log(`  PASS  ${message}`);
}

// --- Pure validation functions (exportable for testing) ---

/**
 * Validate product.json has required Gomi branding fields.
 * @param {Record<string, unknown>} product
 * @returns {{ passed: boolean, failures: string[] }}
 */
export function validateProductBranding(product) {
  const failures = [];
  const required = {
    nameShort: 'Gomi',
    nameLong: 'Gomi IDE',
    applicationName: 'gomi-ide',
    dataFolderName: '.gomi-ide',
    win32DirName: 'Gomi IDE',
    win32NameVersion: 'Gomi IDE',
    win32AppUserModelId: 'Gomi.IDE',
    darwinBundleIdentifier: 'com.gomi.ide',
    linuxIconName: 'gomi-ide',
    licenseName: 'MIT',
  };

  for (const [key, expected] of Object.entries(required)) {
    if (product[key] !== expected) {
      failures.push(`product.json: ${key} expected "${expected}", got "${product[key]}"`);
    }
  }

  // Check extensions gallery is Open VSX (not Microsoft)
  if (product.extensionsGallery?.serviceUrl !== 'https://open-vsx.org/vscode/gallery') {
    failures.push('product.json: extensionsGallery.serviceUrl should point to Open VSX');
  }

  // Check no Microsoft/Visual Studio Code references
  const text = JSON.stringify(product);
  if (/Visual Studio Code/i.test(text)) {
    failures.push('product.json: contains "Visual Studio Code" reference');
  }
  if (/Microsoft/i.test(text) && !text.includes('MIT')) {
    failures.push('product.json: contains "Microsoft" reference');
  }

  return { passed: failures.length === 0, failures };
}

/**
 * Validate package.json has required desktop packaging configuration.
 * @param {Record<string, unknown>} pkg
 * @returns {{ passed: boolean, failures: string[] }}
 */
export function validatePackageDesktopConfig(pkg) {
  const failures = [];

  // Electron main entry
  if (!pkg.main) {
    failures.push('package.json: missing "main" entry (electron entry point)');
  }

  // Build config
  const build = pkg.build;
  if (!build) {
    failures.push('package.json: missing "build" configuration (electron-builder)');
    return { passed: false, failures };
  }

  if (build.appId !== 'com.gomi.ide') {
    failures.push(`package.json: build.appId expected "com.gomi.ide", got "${build.appId}"`);
  }

  if (build.productName !== 'Gomi IDE') {
    failures.push(`package.json: build.productName expected "Gomi IDE", got "${build.productName}"`);
  }

  // Win32 config
  const win = build.win;
  if (!win) {
    failures.push('package.json: missing build.win configuration');
  } else {
    if (!win.icon) {
      failures.push('package.json: build.win.icon not set');
    }
  }

  return { passed: failures.length === 0, failures };
}

// --- Runtime checks (need filesystem) ---

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

// Register checks
check('product.json exists', async () => {
  if (await exists('product.json')) ok('product.json found');
  else fail('product.json not found');
});

check('product.json branding', async () => {
  const product = await readJson('product.json');
  const result = validateProductBranding(product);
  if (result.passed) {
    ok('product.json branding is Gomi-specific');
  } else {
    for (const f of result.failures) fail(f);
  }
});

check('package.json desktop config', async () => {
  const pkg = await readJson('package.json');
  const result = validatePackageDesktopConfig(pkg);
  if (result.passed) {
    ok('package.json has required desktop packaging config');
  } else {
    for (const f of result.failures) fail(f);
  }
});

check('electron main entry exists', async () => {
  const entry = (await readJson('package.json')).main || 'electron/main.cjs';
  if (await exists(entry)) ok(`electron main entry: ${entry}`);
  else fail(`electron main entry not found: ${entry}`);
});

check('win32 icon configured', async () => {
  const pkg = await readJson('package.json');
  const icon = pkg?.build?.win?.icon;
  if (icon) {
    ok(`win32 icon path: ${icon}`);
  } else {
    fail('win32 icon path not configured in package.json build.win.icon');
  }
});

check('branding assets directory', async () => {
  if (await exists('resources/gomi-branding')) {
    const dirs = ['win32', 'darwin', 'linux'];
    let allGood = true;
    for (const d of dirs) {
      if (await exists(`resources/gomi-branding/${d}`)) {
        ok(`branding assets: resources/gomi-branding/${d}/`);
      } else {
        fail(`branding assets missing: resources/gomi-branding/${d}/`);
        allGood = false;
      }
    }
    if (allGood) ok('all branding asset directories present');
  } else {
    fail('resources/gomi-branding/ directory not found');
  }
});

// --- Run ---
console.log('\nGomi IDE — Desktop Release Readiness Checker\n');

for (const { name, fn } of CHECKS) {
  console.log(`[${name}]`);
  try {
    await fn();
  } catch (err) {
    fail(`Unexpected error: ${err.message}`);
  }
  console.log();
}

const total = CHECKS.length;
console.log(`Results: ${total - failures}/${total} checks passed`);

if (failures > 0) {
  console.error(`\n${failures} check(s) failed. Fix the issues above before tagging a release.`);
  process.exit(1);
} else {
  console.log('✅ All checks passed. Repository is ready for desktop release.\n');
  process.exit(0);
}
