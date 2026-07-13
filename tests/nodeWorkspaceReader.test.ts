import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { readNodeWorkspaceSnapshot } from '../src/vs/workbench/contrib/gomi/node/nodeWorkspaceReader';

describe('readNodeWorkspaceSnapshot', () => {
  it('reads the current workspace without including generated heavy folders', async () => {
    const snapshot = await readNodeWorkspaceSnapshot(process.cwd(), { maxFiles: 80 });

    expect(snapshot.rootName).toBe(path.basename(process.cwd()));
    expect(snapshot.files).toContain('package.json');
    expect(snapshot.files).toContain('product.json');
    expect(snapshot.files.some((file) => file.startsWith('node_modules/'))).toBe(false);
    expect(snapshot.files.some((file) => file.startsWith('dist/'))).toBe(false);
    expect(snapshot.contentSnippets?.length).toBeGreaterThan(0);
    expect(snapshot.gitSummary).toContain('Git branch');
    expect(snapshot.terminalSummary).toContain('package.json');
  });
});
