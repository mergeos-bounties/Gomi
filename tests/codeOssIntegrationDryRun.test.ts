import { execFile as execFileCallback } from 'node:child_process';
import { access, cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFile = promisify(execFileCallback);
const root = process.cwd();

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findPowerShell(): Promise<string | undefined> {
  for (const command of ['pwsh', 'powershell', 'powershell.exe']) {
    try {
      await execFile(command, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()']);
      return command;
    } catch {
      // Try the next common executable name.
    }
  }

  return undefined;
}

describe('Code - OSS integration dry-run reporting', () => {
  it('records planned apply and rollback actions without mutating the target checkout', async () => {
    const scriptPath = path.join(root, 'scripts', 'apply-gomi-code-oss-integration.ps1');
    const fixturePath = path.join(root, 'scripts', 'fixtures', 'code-oss-dry-run');
    const powerShell = await findPowerShell();

    expect(await exists(fixturePath)).toBe(true);

    if (!powerShell) {
      const script = await readFile(scriptPath, 'utf8');
      const windowsRelease = await readFile(path.join(root, 'docs', 'windows-release.md'), 'utf8');

      expect(script).toContain('[string]$ReportPath');
      expect(script).toContain('Write-GomiIntegrationReport');
      expect(windowsRelease).toContain('-ReportPath');
      expect(windowsRelease).toContain('dry-run report');
      return;
    }

    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'gomi-code-oss-dry-run-'));
    const codeOssRoot = path.join(tempRoot, 'code-oss');
    const reportPath = path.join(tempRoot, 'reports', 'dry-run-report.json');
    const productPath = path.join(codeOssRoot, 'product.json');
    const workbenchPath = path.join(codeOssRoot, 'src', 'vs', 'workbench', 'workbench.common.main.ts');
    const gomiTarget = path.join(codeOssRoot, 'src', 'vs', 'workbench', 'contrib', 'gomi');

    try {
      await cp(fixturePath, codeOssRoot, { recursive: true });

      const beforeProduct = await readFile(productPath, 'utf8');
      const beforeWorkbench = await readFile(workbenchPath, 'utf8');

      await execFile(powerShell, [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-CodeOssRoot',
        codeOssRoot,
        '-DryRun',
        '-ReportPath',
        reportPath
      ]);

      expect(await readFile(productPath, 'utf8')).toBe(beforeProduct);
      expect(await readFile(workbenchPath, 'utf8')).toBe(beforeWorkbench);
      expect(await exists(gomiTarget)).toBe(false);

      const report = JSON.parse(await readFile(reportPath, 'utf8')) as {
        dryRun?: boolean;
        actions?: Array<{ kind?: string; destination?: string }>;
        rollbackActions?: unknown[];
      };

      const norm = (p?: string) => (p || '').replace(/\\/g, '/');
      expect(report.dryRun).toBe(true);
      expect(report.actions?.some((action) => action.kind === 'merge-product-json')).toBe(true);
      // Windows dry-run reports use backslashes; normalize before endsWith checks.
      expect(
        report.actions?.some((action) =>
          norm(action.destination).endsWith('src/vs/workbench/contrib/gomi'),
        ),
      ).toBe(true);
      expect(report.rollbackActions?.length).toBeGreaterThan(0);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
