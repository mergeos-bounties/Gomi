import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFile = promisify(execFileCallback);
const root = process.cwd();

describe.runIf(process.platform === 'win32')('Windows artifact collector', () => {
  it('collects branded Gomi desktop artifacts with manifest and checksums', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'gomi-artifacts-'));

    try {
      const codeOssRoot = await createCodeOssRoot(tempRoot, createGomiProductJson());
      const releaseDir = path.join(tempRoot, 'release');

      await execCollector(codeOssRoot, releaseDir);

      const manifest = await readFile(path.join(releaseDir, 'ARTIFACTS.md'), 'utf8');
      const checksums = await readFile(path.join(releaseDir, 'WINDOWS-SHA256SUMS.txt'), 'utf8');
      const exe = await readFile(path.join(releaseDir, 'GomiSetup.exe'), 'utf8');

      expect(exe).toBe('gomi installer');
      expect(manifest).toContain('Product identity verified from Code - OSS product.json');
      expect(manifest).toContain('applicationName: gomi-ide');
      expect(manifest).toContain('extension gallery: Open VSX');
      expect(manifest).toContain('GomiSetup.exe');
      expect(checksums).toContain('GomiSetup.exe');
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('refuses to collect artifacts when product.json is still upstream branded', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'gomi-artifacts-upstream-'));

    try {
      const codeOssRoot = await createCodeOssRoot(tempRoot, {
        ...createGomiProductJson(),
        nameShort: 'Code - OSS',
        nameLong: 'Code - OSS',
        applicationName: 'code-oss'
      });
      const releaseDir = path.join(tempRoot, 'release');
      let failureText = '';

      try {
        await execCollector(codeOssRoot, releaseDir);
      } catch (error) {
        failureText = [
          error instanceof Error ? error.message : String(error),
          typeof (error as { stderr?: unknown }).stderr === 'string' ? (error as { stderr: string }).stderr : ''
        ].join('\n');
      }

      expect(failureText).toContain('Refusing to collect Windows artifacts');
      expect(failureText).toContain("nameLong='Code - OSS'");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

async function createCodeOssRoot(tempRoot: string, productJson: Record<string, unknown>) {
  const codeOssRoot = path.join(tempRoot, 'code-oss');
  const buildRoot = path.join(codeOssRoot, '.build', 'win32-x64');

  await mkdir(buildRoot, { recursive: true });
  await writeFile(path.join(codeOssRoot, 'product.json'), `${JSON.stringify(productJson, null, 2)}\n`);
  await writeFile(path.join(buildRoot, 'GomiSetup.exe'), 'gomi installer');

  return codeOssRoot;
}

function createGomiProductJson() {
  return {
    nameShort: 'Gomi',
    nameLong: 'Gomi IDE',
    applicationName: 'gomi-ide',
    dataFolderName: '.gomi-ide',
    win32NameVersion: 'Gomi IDE',
    extensionsGallery: {
      serviceUrl: 'https://open-vsx.org/vscode/gallery',
      itemUrl: 'https://open-vsx.org/vscode/item'
    }
  };
}

function execCollector(codeOssRoot: string, releaseDir: string) {
  return execFile('powershell.exe', [
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(root, 'scripts', 'collect-gomi-windows-artifacts.ps1'),
    '-CodeOssRoot',
    codeOssRoot,
    '-ReleaseDir',
    releaseDir,
    '-Platform',
    'win32-x64',
    '-CodeOssRepository',
    'mergeos-bounties/gomi-code-oss',
    '-CodeOssRef',
    'main',
    '-CommitSha',
    'abc123',
    '-RefName',
    'v0.1.0-test',
    '-SetupRequested'
  ]);
}
