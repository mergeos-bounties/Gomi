#!/usr/bin/env node
/**
 * check-desktop-readiness.mjs
 *
 * Validates desktop release prerequisites from the repository root
 * without requiring secrets or a running Code - OSS checkout.
 *
 * Usage:
 *   node scripts/check-desktop-readiness.mjs
 *   npm run check:desktop
 *
 * Exits non-zero when branding, assets, or packaging config is missing
 * so that CI can gate pre-tag validation.
 */

import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── Pure check helpers ────────────────────────────────────────────────

/**
 * Verify that the given file exists under ROOT.
 */
export async function checkFileExists(
  relativePath,
  label = relativePath
) {
  const absolute = path.join(ROOT, relativePath);
  try {
    await access(absolute);
    return { ok: true, label };
  } catch {
    return { ok: false, label };
  }
}

/**
 * Verify that the given directory exists under ROOT.
 */
export async function checkDirectoryExists(
  relativePath,
  label = relativePath
) {
  const absolute = path.join(ROOT, relativePath);
  try {
    const s = await stat(absolute);
    return s.isDirectory()
      ? { ok: true, label }
      : { ok: false, label, detail: 'exists but is not a directory' };
  } catch {
    return { ok: false, label };
  }
}

/**
 * Check that a JSON value equals an expected value.
 */
export function checkJsonValue(
  object,
  key,
  expected,
  label = key
) {
  const actual = object[key];
  return {
    ok: actual === expected,
    label,
    actual,
    expected,
  };
}

/**
 * Assert that the product.json contains Gomi-branded values for the
 * subset of keys that gate desktop identity.
 */
export async function checkProductBranding() {
  const productPath = path.join(ROOT, 'product.json');
  try {
    await access(productPath);
  } catch {
    return [{ ok: false, label: 'product.json exists' }];
  }

  const product = JSON.parse(await readFile(productPath, 'utf8'));
  const required: Record<string, string> = {
    nameShort: 'Gomi',
    nameLong: 'Gomi IDE',
    applicationName: 'gomi-ide',
    dataFolderName: '.gomi-ide',
    linuxIconName: 'gomi-ide',
    darwinBundleIdentifier: 'com.gomi.ide',
    urlProtocol: 'gomi',
    win32DirName: 'Gomi IDE',
    win32AppUserModelId: 'Gomi.IDE',
  };

  const checks = [];
  for (const [key, expected] of Object.entries(required)) {
    checks.push(checkJsonValue(product, key, expected));
  }

  const hasVsxGallery =
    product.extensionsGallery?.serviceUrl ===
    'https://open-vsx.org/vscode/gallery' &&
    product.extensionsGallery?.itemUrl ===
    'https://open-vsx.org/vscode/item';
  checks.push({
    ok: hasVsxGallery,
    label: 'product.json → extensionsGallery points to Open VSX',
  });

  const productText = JSON.stringify(product);
  const noVsCode = !/Visual Studio Code/i.test(productText);
  const noMicrosoft = !/Microsoft/i.test(productText);
  checks.push({ ok: noVsCode, label: 'product.json free of "Visual Studio Code" text' });
  checks.push({ ok: noMicrosoft, label: 'product.json free of "Microsoft" text' });

  return checks;
}

/**
 * Assert that the required desktop branding assets exist.
 */
export async function checkBrandingAssets() {
  return Promise.all([
    checkFileExists(
      'resources/gomi-branding/win32/gomi.ico',
      'win32 icon (resources/gomi-branding/win32/gomi.ico)'
    ),
    checkFileExists(
      'resources/gomi-branding/win32/gomi_70x70.png',
      'win32 70×70 PNG'
    ),
    checkFileExists(
      'resources/gomi-branding/win32/gomi_150x150.png',
      'win32 150×150 PNG'
    ),
    checkDirectoryExists('resources/gomi-branding/linux'),
    checkDirectoryExists('resources/gomi-branding/darwin'),
    checkFileExists('resources/gomi-branding/darwin/gomi.icns'),
    checkFileExists('resources/gomi-branding/linux/gomi.png'),
  ]);
}

/**
 * Assert that the Electron main entry point is declared in package.json
 * and the file on disk is reachable.
 */
export async function checkElectronMain() {
  try {
    const pkgPath = path.join(ROOT, 'package.json');
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    const mainEntry = pkg.main;

    if (!mainEntry) {
      return [{ ok: false, label: 'package.json → main entry declared' }];
    }

    // main should point to an Electron entry (typically electron/main.cjs)
    const mainFile = path.join(ROOT, mainEntry);
    try {
      await access(mainFile);
      return [{ ok: true, label: `Electron main entry (${mainEntry})` }];
    } catch {
      return [{ ok: false, label: `Electron main entry (${mainEntry})` }];
    }
  } catch {
    return [{ ok: false, label: 'package.json readable' }];
  }
}

/**
 * Assert that electron-builder config keys required for a Windows build
 * are present and point at real assets.
 */
export async function checkElectronBuilderConfig() {
  try {
    const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
    const build = pkg.build;
    if (!build) {
      return [{ ok: false, label: 'package.json → build config present' }];
    }

    const checks = [];

    checks.push(checkJsonValue(build, 'appId', 'com.gomi.ide'));
    checks.push(checkJsonValue(build, 'productName', 'Gomi IDE'));

    const win = build.win;
    if (!win) {
      checks.push({ ok: false, label: 'electron-builder → win config' });
    } else {
      checks.push({
        ok: Array.isArray(win.target) && win.target.includes('nsis'),
        label: 'electron-builder → win.target includes nsis',
      });
      checks.push({
        ok: win.icon === 'resources/gomi-branding/win32/gomi.ico',
        label: 'electron-builder → win.icon path',
      });
    }

    checks.push({
      ok: build.directories?.output === 'release/desktop',
      label: 'electron-builder → output directory',
    });
    checks.push({
      ok: build.directories?.buildResources === 'resources/gomi-branding',
      label: 'electron-builder → buildResources directory',
    });

    return checks;
  } catch {
    return [{ ok: false, label: 'package.json readable for build config' }];
  }
}

/**
 * Assert the Code - OSS integration manifest and generation tooling
 * exist so maintainers can build a desktop package.
 */
export async function checkIntegrationPrerequisites() {
  return Promise.all([
    checkFileExists('build/gomi-code-oss.integration.json'),
    checkDirectoryExists('build/code-oss-templates'),
    checkFileExists('scripts/bootstrap-gomi-code-oss-fork.ps1'),
    checkFileExists('scripts/apply-gomi-code-oss-integration.ps1'),
    checkFileExists('scripts/build-gomi-code-oss-windows.ps1'),
    checkFileExists('scripts/collect-gomi-windows-artifacts.ps1'),
    checkFileExists('scripts/generate-gomi-brand-assets.mjs'),
  ]);
}

// ─── Runner ────────────────────────────────────────────────────────────

async function main() {
  const groups = [
    { name: 'Product branding (product.json)', run: checkProductBranding },
    { name: 'Desktop branding assets', run: checkBrandingAssets },
    { name: 'Electron main entry', run: checkElectronMain },
    { name: 'Electron-builder config', run: checkElectronBuilderConfig },
    { name: 'Code - OSS integration prerequisites', run: checkIntegrationPrerequisites },
  ];

  let passCount = 0;
  let failCount = 0;
  let result = 0;

  for (const group of groups) {
    console.log(`\n▸ ${group.name}`);
    console.log('─'.repeat(52));
    const checks = await group.run();
    for (const check of checks.flat()) {
      if (check.ok) {
        passCount += 1;
        console.log(`  ✅ ${check.label}`);
      } else {
        failCount += 1;
        result = 1;
        let detail = '';
        if (check.actual !== undefined) {
          detail = ` (expected ${JSON.stringify(check.expected)}, got ${JSON.stringify(check.actual)})`;
        } else if (check.detail) {
          detail = ` (${check.detail})`;
        }
        console.log(`  ❌ ${check.label}${detail}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(52));
  console.log(`Desktop release readiness: ${passCount} passed, ${failCount} failed`);
  console.log('═'.repeat(52));

  if (result === 0) {
    console.log('\n✅ All desktop release prerequisites are satisfied.');
  } else {
    console.log(
      `\n❌ ${failCount} check${failCount === 1 ? '' : 's'} failed — resolve before tagging a desktop release.`
    );
  }

  process.exit(result);
}

main().catch((err) => {
  console.error('check:desktop failed with an unexpected error:', err);
  process.exit(2);
});
