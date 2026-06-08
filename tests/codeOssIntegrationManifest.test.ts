import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Code - OSS integration manifest', () => {
  it('overlays a native Gomi workbench registration template', async () => {
    const manifestPath = path.join(process.cwd(), 'build', 'gomi-code-oss.integration.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      templateCopies?: Array<{ source: string; target: string }>;
      activityBar?: {
        viewContainerId?: string;
        viewId?: string;
      };
    };
    const contributionTemplate = manifest.templateCopies?.find((copy) =>
      copy.target.endsWith('src/vs/workbench/contrib/gomi/browser/gomiContribution.ts')
    );

    expect(manifest.activityBar?.viewContainerId).toBe('workbench.view.gomiOffice');
    expect(manifest.activityBar?.viewId).toBe('gomi.office.view');
    expect(contributionTemplate).toBeDefined();

    const template = await readFile(path.join(process.cwd(), contributionTemplate?.source ?? ''), 'utf8');

    expect(template).toContain('registerViewContainer');
    expect(template).toContain('registerViews');
    expect(template).toContain('workbench.view.gomiOffice');
    expect(template).toContain('gomi.office.view');
  });
});
