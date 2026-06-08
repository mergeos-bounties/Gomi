import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFile = promisify(execFileCallback);

describe('Code - OSS integration manifest', () => {
  it('overlays a native Gomi workbench registration template', async () => {
    const manifestPath = path.join(process.cwd(), 'build', 'gomi-code-oss.integration.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      templateCopies?: Array<{ source: string; target: string }>;
      webviewAssetCopies?: Array<{ source: string; target: string }>;
      activityBar?: {
        viewContainerId?: string;
        viewId?: string;
      };
    };
    const contributionTemplate = manifest.templateCopies?.find((copy) =>
      copy.target.endsWith('src/vs/workbench/contrib/gomi/browser/gomiContribution.ts')
    );
    const webviewAssets = manifest.webviewAssetCopies?.find((copy) =>
      copy.target.endsWith('src/vs/workbench/contrib/gomi/browser/media/office')
    );

    expect(manifest.activityBar?.viewContainerId).toBe('workbench.view.gomiOffice');
    expect(manifest.activityBar?.viewId).toBe('gomi.office.view');
    expect(contributionTemplate).toBeDefined();
    expect(webviewAssets?.source).toBe('build/gomi-office-webview');

    const template = await readFile(path.join(process.cwd(), contributionTemplate?.source ?? ''), 'utf8');

    expect(template).toContain('registerViewContainer');
    expect(template).toContain('registerViews');
    expect(template).toContain('createWebviewOverlay');
    expect(template).toContain('createGomiWebviewHostBridge');
    expect(template).toContain('GomiWebviewHostController');
    expect(template).toContain('createCodeOssWorkspaceSnapshotReader');
    expect(template).toContain('previewCodeOssPatchMessage');
    expect(template).toContain('applyCodeOssPatchMessage');
    expect(template).toContain('IWorkspaceContextService');
    expect(template).toContain('ITextFileService');
    expect(template).toContain('IMarkerService');
    expect(template).toContain('ICodeEditorService');
    expect(template).toContain('ITerminalService');
    expect(template).toContain('ISCMService');
    expect(template).toContain('terminalService: this.terminalService');
    expect(template).toContain('scmService: this.scmService');
    expect(template).toContain('createUri: URI.from');
    expect(template).toContain('patchPreviewer');
    expect(template).toContain('localResourceRoots');
    expect(template).toContain('__GOMI_ENABLE_WORKBENCH_BRIDGE__');
    expect(template).toContain('assets/index.js');
    expect(template).toContain('assets/index.css');
    expect(template).toContain('workbench.view.gomiOffice');
    expect(template).toContain('gomi.office.view');
  });

  it.runIf(process.platform === 'win32')('merges Gomi product branding without dropping upstream packaging keys', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'gomi-code-oss-'));
    const codeOssRoot = path.join(tempRoot, 'code-oss');
    const webviewAssetRoot = path.join(process.cwd(), 'build', 'gomi-office-webview');
    let createdWebviewAssets = false;

    try {
      try {
        await access(webviewAssetRoot);
      } catch {
        createdWebviewAssets = true;
        await mkdir(path.join(webviewAssetRoot, 'assets'), { recursive: true });
        await writeFile(path.join(webviewAssetRoot, 'index.html'), '<div id="root"></div>\n');
        await writeFile(path.join(webviewAssetRoot, 'assets', 'index.js'), 'export {};\n');
        await writeFile(path.join(webviewAssetRoot, 'assets', 'index.css'), ':root{}\n');
      }

      await mkdir(path.join(codeOssRoot, 'src', 'vs', 'workbench'), { recursive: true });
      await writeFile(path.join(codeOssRoot, 'package.json'), '{"name":"code-oss-stub"}\n');
      await writeFile(
        path.join(codeOssRoot, 'product.json'),
        JSON.stringify(
          {
            nameShort: 'Code - OSS',
            nameLong: 'Code - OSS',
            applicationName: 'code-oss',
            dataFolderName: '.vscode-oss',
            sharedDataFolderName: '.vscode-oss-shared',
            serverApplicationName: 'code-server-oss',
            serverDataFolderName: '.vscode-server-oss',
            tunnelApplicationName: 'code-tunnel-oss',
            win32DirName: 'Microsoft Code OSS',
            win32NameVersion: 'Microsoft Code OSS',
            win32RegValueName: 'CodeOSS',
            win32AppUserModelId: 'Microsoft.CodeOSS',
            darwinBundleIdentifier: 'com.visualstudio.code.oss',
            linuxIconName: 'code-oss',
            upstreamOnlyPackagingKey: 'keep-me',
            builtInExtensions: [
              {
                name: 'ms-vscode.js-debug',
                metadata: {
                  publisherDisplayName: 'Microsoft'
                }
              }
            ],
            builtInExtensionsEnabledWithAutoUpdates: ['GitHub.copilot-chat'],
            defaultChatAgent: {
              extensionId: 'GitHub.copilot'
            },
            trustedExtensionAuthAccess: {
              github: ['GitHub.copilot-chat']
            },
            webviewContentExternalBaseUrlTemplate: 'https://{{uuid}}.vscode-cdn.net/out/vs/workbench/contrib/webview/browser/pre/',
            onboardingKeymaps: [
              {
                id: 'vscode',
                label: 'VS Code'
              }
            ],
            onboardingThemes: [
              {
                id: 'dark-2026',
                label: 'Dark 2026'
              }
            ],
            sessionsWindowAllowedExtensions: ['GitHub.copilot-chat'],
            extensionsGallery: {
              serviceUrl: 'https://marketplace.visualstudio.com/_apis/public/gallery',
              itemUrl: 'https://marketplace.visualstudio.com/items',
              resourceUrlTemplate: 'https://example.test/resource/{publisher}/{name}'
            }
          },
          null,
          2
        )
      );
      await writeFile(
        path.join(codeOssRoot, 'src', 'vs', 'workbench', 'workbench.common.main.ts'),
        "import 'vs/workbench/contrib/files/browser/files.contribution';\n"
      );

      await execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(process.cwd(), 'scripts', 'apply-gomi-code-oss-integration.ps1'),
        '-CodeOssRoot',
        codeOssRoot
      ]);

      const product = JSON.parse(await readFile(path.join(codeOssRoot, 'product.json'), 'utf8')) as {
        nameShort?: string;
        nameLong?: string;
        applicationName?: string;
        sharedDataFolderName?: string;
        serverApplicationName?: string;
        serverDataFolderName?: string;
        tunnelApplicationName?: string;
        win32DirName?: string;
        win32NameVersion?: string;
        win32RegValueName?: string;
        win32AppUserModelId?: string;
        darwinBundleIdentifier?: string;
        linuxIconName?: string;
        upstreamOnlyPackagingKey?: string;
        builtInExtensions?: unknown;
        builtInExtensionsEnabledWithAutoUpdates?: unknown;
        defaultChatAgent?: unknown;
        trustedExtensionAuthAccess?: unknown;
        webviewContentExternalBaseUrlTemplate?: unknown;
        onboardingKeymaps?: unknown;
        onboardingThemes?: unknown;
        sessionsWindowAllowedExtensions?: unknown;
        extensionsGallery?: {
          serviceUrl?: string;
          itemUrl?: string;
          resourceUrlTemplate?: string;
        };
      };
      const workbenchMain = await readFile(
        path.join(codeOssRoot, 'src', 'vs', 'workbench', 'workbench.common.main.ts'),
        'utf8'
      );

      expect(product.nameShort).toBe('Gomi');
      expect(product.nameLong).toBe('Gomi IDE');
      expect(product.applicationName).toBe('gomi-ide');
      expect(product.sharedDataFolderName).toBe('.gomi-ide-shared');
      expect(product.serverApplicationName).toBe('gomi-server');
      expect(product.serverDataFolderName).toBe('.gomi-server');
      expect(product.tunnelApplicationName).toBe('gomi-tunnel');
      expect(product.win32DirName).toBe('Gomi IDE');
      expect(product.win32NameVersion).toBe('Gomi IDE');
      expect(product.win32RegValueName).toBe('GomiIDE');
      expect(product.win32AppUserModelId).toBe('Gomi.IDE');
      expect(product.darwinBundleIdentifier).toBe('com.gomi.ide');
      expect(product.linuxIconName).toBe('gomi-ide');
      expect(product.upstreamOnlyPackagingKey).toBe('keep-me');
      expect(product).not.toHaveProperty('builtInExtensions');
      expect(product).not.toHaveProperty('builtInExtensionsEnabledWithAutoUpdates');
      expect(product).not.toHaveProperty('defaultChatAgent');
      expect(product).not.toHaveProperty('trustedExtensionAuthAccess');
      expect(product).not.toHaveProperty('webviewContentExternalBaseUrlTemplate');
      expect(product).not.toHaveProperty('onboardingKeymaps');
      expect(product).not.toHaveProperty('onboardingThemes');
      expect(product).not.toHaveProperty('sessionsWindowAllowedExtensions');
      expect(product.extensionsGallery?.serviceUrl).toBe('https://open-vsx.org/vscode/gallery');
      expect(product.extensionsGallery?.itemUrl).toBe('https://open-vsx.org/vscode/item');
      expect(product.extensionsGallery?.resourceUrlTemplate).toBe('https://example.test/resource/{publisher}/{name}');
      expect(workbenchMain).toContain("import 'vs/workbench/contrib/gomi/browser/gomiContribution';");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });

      if (createdWebviewAssets) {
        await rm(webviewAssetRoot, { recursive: true, force: true });
      }
    }
  });
});
