#!/usr/bin/env node

/**
 * Desktop release readiness checker for Gomi IDE.
 * Validates branding assets and electron-builder config before tagging a release.
 * 
 * Usage: node scripts/check-desktop-release.mjs
 * 
 * Bounty: mergeos-bounties/mergeos#244 / mergeos-bounties/Gomi#5
 */

import { access, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

async function check(label, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    failures.push(`${label}: ${detail}`);
    console.log(`  FAIL  ${label}: ${detail}`);
  }
}

async function fileExists(relativePath) {
  try {
    await access(resolve(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('Gomi Desktop Release Readiness Checker');
  console.log('======================================');
  console.log();

  // 1. Check product.json branding
  let productJson;
  try {
    productJson = JSON.parse(await readFile(resolve(root, 'product.json'), 'utf8'));
    console.log('  [product.json] loaded');
  } catch (e) {
    console.log('  FAIL  product.json: missing or invalid');
    process.exit(1);
  }

  await check('Product name is Gomi',
    productJson.nameShort === 'Gomi',
    `Expected "Gomi", got "${productJson.nameShort}"`);

  await check('Long name is Gomi IDE',
    productJson.nameLong === 'Gomi IDE',
    `Expected "Gomi IDE", got "${productJson.nameLong}"`);

  await check('Application name is gomi-ide',
    productJson.applicationName === 'gomi-ide',
    `Expected "gomi-ide", got "${productJson.applicationName}"`);

  // 2. Check win32 branding assets
  const win32Icon = productJson.win32Icon || 'resources/gomi-branding/win32/gomi.ico';
  await check('Win32 icon exists',
    await fileExists(win32Icon),
    `Missing: ${win32Icon}`);

  await check('Win32 app ID configured',
    typeof productJson.win32x64AppId === 'string' && productJson.win32x64AppId.length > 0,
    'Missing win32x64AppId');

  await check('Win32 shell name configured',
    typeof productJson.win32ShellNameShort === 'string',
    'Missing win32ShellNameShort');

  // 3. Check electron main entry
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const mainEntry = pkg.main || 'electron/main.cjs';
  await check('Electron main entry exists',
    await fileExists(mainEntry),
    `Missing: ${mainEntry}`);

  // 4. Check build config
  await check('Build config has appId',
    pkg.build && pkg.build.appId === 'com.gomi.ide',
    'Missing or incorrect build.appId');

  await check('Build config has win target',
    pkg.build && pkg.build.win && Array.isArray(pkg.build.win.target),
    'Missing build.win.target');

  // 5. Check resources directory
  await check('Branding resources directory exists',
    await fileExists('resources/gomi-branding'),
    'Missing resources/gomi-branding/');

  // Summary
  console.log();
  console.log('======================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  if (failures.length > 0) {
    console.log();
    console.log('Failures:');
    failures.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('All checks passed! Ready for release.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
