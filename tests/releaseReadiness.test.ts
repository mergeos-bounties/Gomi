import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

type ProductJson = Record<string, unknown> & {
  extensionsGallery?: {
    serviceUrl?: string;
    itemUrl?: string;
  };
};

type IntegrationManifest = {
  productJson?: {
    source?: string;
    target?: string;
    mode?: string;
  };
  moduleCopies?: Array<{ source: string; target: string }>;
  templateCopies?: Array<{ source: string; target: string }>;
  webviewAssetCopies?: Array<{ source: string; target: string }>;
  resourceCopies?: Array<{ source: string; target: string }>;
  workbenchImports?: Array<{ target: string; import: string }>;
  activityBar?: {
    viewContainerId?: string;
    viewId?: string;
    title?: string;
    command?: string;
  };
  commands?: string[];
};

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8')) as T;
}

async function exists(relativePath: string): Promise<boolean> {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(relativePath: string): Promise<boolean> {
  return (await stat(path.join(root, relativePath))).isDirectory();
}

function readPngSize(buffer: Buffer): { width: number; height: number } {
  expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function readBmpSize(buffer: Buffer): { width: number; height: number } {
  expect(buffer.subarray(0, 2).toString('ascii')).toBe('BM');

  return {
    width: buffer.readInt32LE(18),
    height: buffer.readInt32LE(22)
  };
}

describe('release readiness', () => {
  it('keeps product branding independent from Visual Studio Code and Microsoft marketplace defaults', async () => {
    const product = await readJson<ProductJson>('product.json');
    const expectedProductFields: Record<string, string> = {
      nameShort: 'Gomi',
      nameLong: 'Gomi IDE',
      applicationName: 'gomi-ide',
      dataFolderName: '.gomi-ide',
      win32MutexName: 'gomiide',
      licenseName: 'MIT',
      urlProtocol: 'gomi',
      serverApplicationName: 'gomi-server',
      tunnelApplicationName: 'gomi-tunnel',
      reportIssueUrl: 'https://github.com/mergeos-bounties/Gomi/issues/new'
    };

    for (const [key, expectedValue] of Object.entries(expectedProductFields)) {
      expect(product[key], `${key} should be Gomi-branded`).toBe(expectedValue);
    }

    const productText = JSON.stringify(product);

    expect(productText).not.toMatch(/Visual Studio Code/i);
    expect(productText).not.toMatch(/Microsoft/i);
    expect(productText).not.toMatch(/marketplace\.visualstudio\.com/i);
    expect(product.extensionsGallery?.serviceUrl).toBe('https://open-vsx.org/vscode/gallery');
    expect(product.extensionsGallery?.itemUrl).toBe('https://open-vsx.org/vscode/item');
  });

  it('declares a complete Code - OSS overlay path for desktop packaging', async () => {
    const manifest = await readJson<IntegrationManifest>('build/gomi-code-oss.integration.json');
    const moduleCopy = manifest.moduleCopies?.find((copy) => copy.target === 'src/vs/workbench/contrib/gomi');
    const contributionTemplate = manifest.templateCopies?.find((copy) =>
      copy.target.endsWith('src/vs/workbench/contrib/gomi/browser/gomiContribution.ts')
    );
    const webviewAssets = manifest.webviewAssetCopies?.find((copy) =>
      copy.target.endsWith('src/vs/workbench/contrib/gomi/browser/media/office')
    );
    const gomiIcon = manifest.resourceCopies?.find((copy) => copy.target === 'resources/gomi-icon.svg');
    const win32Icon = manifest.resourceCopies?.find((copy) => copy.target === 'resources/win32/code.ico');
    const win32Tile70 = manifest.resourceCopies?.find((copy) => copy.target === 'resources/win32/code_70x70.png');
    const win32Tile150 = manifest.resourceCopies?.find((copy) => copy.target === 'resources/win32/code_150x150.png');
    const linuxIcon = manifest.resourceCopies?.find((copy) => copy.target === 'resources/linux/code.png');
    const macIcon = manifest.resourceCopies?.find((copy) => copy.target === 'resources/darwin/code.icns');
    const workbenchImport = manifest.workbenchImports?.find((entry) =>
      entry.import.includes("vs/workbench/contrib/gomi/browser/gomiContribution")
    );

    expect(manifest.productJson).toEqual({
      source: 'product.json',
      target: 'product.json',
      mode: 'merge'
    });
    expect(moduleCopy?.source).toBe('src/vs/workbench/contrib/gomi');
    expect(contributionTemplate?.source).toBe('build/code-oss-templates/gomiContribution.ts');
    expect(webviewAssets?.source).toBe('build/gomi-office-webview');
    expect(gomiIcon?.source).toBe('resources/gomi-icon.svg');
    expect(win32Icon?.source).toBe('resources/gomi-branding/win32/gomi.ico');
    expect(win32Tile70?.source).toBe('resources/gomi-branding/win32/gomi_70x70.png');
    expect(win32Tile150?.source).toBe('resources/gomi-branding/win32/gomi_150x150.png');
    expect(linuxIcon?.source).toBe('resources/gomi-branding/linux/gomi.png');
    expect(macIcon?.source).toBe('resources/gomi-branding/darwin/gomi.icns');
    expect(workbenchImport?.target).toBe('src/vs/workbench/workbench.common.main.ts');
    expect(manifest.activityBar).toMatchObject({
      viewContainerId: 'workbench.view.gomiOffice',
      viewId: 'gomi.office.view',
      title: 'Gomi Office',
      command: 'gomi.openOffice'
    });
    expect(manifest.commands).toEqual(expect.arrayContaining(['gomi.openOffice', 'gomi.runAgentTask', 'gomi.stopAgentTask']));

    expect(await exists(manifest.productJson?.source ?? '')).toBe(true);
    expect(await isDirectory(moduleCopy?.source ?? '')).toBe(true);
    expect(await exists(contributionTemplate?.source ?? '')).toBe(true);
    expect(await exists(gomiIcon?.source ?? '')).toBe(true);
    expect(await exists(win32Icon?.source ?? '')).toBe(true);
    expect(await exists(win32Tile70?.source ?? '')).toBe(true);
    expect(await exists(win32Tile150?.source ?? '')).toBe(true);
    expect(await exists(linuxIcon?.source ?? '')).toBe(true);
    expect(await exists(macIcon?.source ?? '')).toBe(true);

    const installerBitmaps = manifest.resourceCopies?.filter((copy) => copy.target.startsWith('resources/win32/inno-')) ?? [];
    expect(installerBitmaps).toHaveLength(14);

    for (const bitmap of installerBitmaps) {
      expect(await exists(bitmap.source)).toBe(true);
    }
  });

  it('generates valid desktop branding assets for Code - OSS packaging paths', async () => {
    const win32Icon = await readFile(path.join(root, 'resources/gomi-branding/win32/gomi.ico'));
    const tile70 = await readFile(path.join(root, 'resources/gomi-branding/win32/gomi_70x70.png'));
    const tile150 = await readFile(path.join(root, 'resources/gomi-branding/win32/gomi_150x150.png'));
    const linuxIcon = await readFile(path.join(root, 'resources/gomi-branding/linux/gomi.png'));
    const macIcon = await readFile(path.join(root, 'resources/gomi-branding/darwin/gomi.icns'));
    const installerBig100 = await readFile(path.join(root, 'resources/gomi-branding/win32/inno-big-100.bmp'));
    const installerSmall100 = await readFile(path.join(root, 'resources/gomi-branding/win32/inno-small-100.bmp'));

    expect(win32Icon.readUInt16LE(0)).toBe(0);
    expect(win32Icon.readUInt16LE(2)).toBe(1);
    expect(win32Icon.readUInt16LE(4)).toBeGreaterThanOrEqual(7);
    expect(readPngSize(tile70)).toEqual({ width: 70, height: 70 });
    expect(readPngSize(tile150)).toEqual({ width: 150, height: 150 });
    expect(readPngSize(linuxIcon)).toEqual({ width: 512, height: 512 });
    expect(macIcon.subarray(0, 4).toString('ascii')).toBe('icns');
    expect(macIcon.readUInt32BE(4)).toBe(macIcon.length);
    expect(readBmpSize(installerBig100)).toEqual({ width: 164, height: 314 });
    expect(readBmpSize(installerSmall100)).toEqual({ width: 55, height: 55 });
  });

  it('keeps GitHub Actions wired for verification, optional Windows packaging, and release publishing', async () => {
    const workflow = await readFile(path.join(root, '.github/workflows/build-release.yml'), 'utf8');

    expect(workflow).toContain('name: Build and Release Gomi IDE');
    expect(workflow).toContain("tags:");
    expect(workflow).toContain("'v*'");
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('create_release:');
    expect(workflow).toContain('build_code_oss_windows:');
    expect(workflow).toContain('code_oss_repository:');
    expect(workflow).toContain('code_oss_ref:');
    expect(workflow).toContain('windows_platform:');
    expect(workflow).toContain('build_setup_exe:');
    expect(workflow).toContain('verify-prototype:');
    expect(workflow).toContain('code-oss-windows:');
    expect(workflow).toContain('release:');
    expect(workflow).toContain('npm run generate:brand-assets');
    expect(workflow).toContain('npm run verify:release');
    expect(workflow).toContain('Build Code - OSS Windows package');
    expect(workflow).toContain('scripts\\build-gomi-code-oss-windows.ps1');
    expect(workflow).toContain('-Include *.exe,*.msi,*.zip');
    expect(workflow).toContain('gomi-ide-${{ env.GOMI_WINDOWS_PLATFORM }}.zip');
    expect(workflow).toContain('ARTIFACTS.md');
    expect(workflow).toContain('PROTOTYPE-SHA256SUMS.txt');
    expect(workflow).toContain('WINDOWS-SHA256SUMS.txt');
    expect(workflow).toContain("needs.code-oss-windows.result == 'success'");
    expect(workflow).toContain('inputs.build_code_oss_windows == true');
    expect(workflow).toContain('softprops/action-gh-release@v2');
    expect(workflow).not.toContain("needs.code-oss-windows.result == 'skipped'");
    expect(workflow).not.toMatch(/marketplace\.visualstudio\.com/i);
  });

  it('documents the executable-first release path instead of presenting npm as the product runtime', async () => {
    const readme = await readFile(path.join(root, 'README.md'), 'utf8');
    const windowsRelease = await readFile(path.join(root, 'docs/windows-release.md'), 'utf8');
    const packageJson = await readJson<{ scripts?: Record<string, string> }>('package.json');

    expect(readme).toContain('Gomi IDE should be released as a desktop artifact from a Code - OSS fork');
    expect(readme).toContain('not as an `npm run dev` app');
    expect(readme).toContain('GitHub Actions release workflow');
    expect(readme).toContain('Windows Code - OSS packaging script');
    expect(readme).toContain('Generated desktop branding assets');
    expect(readme).toContain('Manual workflow runs can publish a release only when the Windows desktop packaging job is enabled and succeeds.');
    expect(windowsRelease).toContain('## Why EXE, Not NPM');
    expect(windowsRelease).toContain('Generate Gomi desktop branding assets');
    expect(windowsRelease).toContain('GitHub Releases do not present the prototype bundle as the final IDE');
    expect(windowsRelease).toContain('End users should not run Gomi IDE with `npm run dev`.');
    expect(windowsRelease).toContain('Inno Setup `.exe` installer');
    expect(packageJson.scripts?.['verify:release']).toBe(
      'vitest run tests/releaseReadiness.test.ts tests/codeOssIntegrationManifest.test.ts'
    );
  });
});
