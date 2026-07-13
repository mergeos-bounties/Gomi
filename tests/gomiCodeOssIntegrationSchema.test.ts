/**
 * Tests for gomiCodeOssIntegrationSchema validator (issue #26).
 */

import { describe, expect, it } from 'vitest';
import { validateIntegrationManifest } from '../src/vs/workbench/contrib/gomi/common/gomiCodeOssIntegrationSchema';

const validManifest = () => ({
  schemaVersion: 1,
  productName: 'Gomi IDE',
  description: 'Test manifest.',
  productJson: {
    source: 'product.json',
    target: 'product.json',
    mode: 'merge',
  },
  moduleCopies: [
    { source: 'src/vs/workbench/contrib/gomi', target: 'src/vs/workbench/contrib/gomi' },
  ],
  webviewAssetCopies: [
    { source: 'build/gomi-office-webview', target: 'media/office' },
  ],
});

describe('GomiCodeOssIntegrationSchema', () => {
  it('accepts a valid manifest', () => {
    const r = validateIntegrationManifest(validManifest());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('rejects missing productJson', () => {
    const m = validManifest();
    delete (m as any).productJson;
    const r = validateIntegrationManifest(m);
    expect(r.valid).toBe(false);
  });

  it('rejects missing moduleCopies', () => {
    const m = validManifest();
    delete (m as any).moduleCopies;
    const r = validateIntegrationManifest(m);
    expect(r.valid).toBe(false);
  });

  it('rejects empty moduleCopies array', () => {
    const m = validManifest();
    (m as any).moduleCopies = [];
    const r = validateIntegrationManifest(m);
    expect(r.valid).toBe(false);
  });

  it('rejects missing webviewAssetCopies', () => {
    const m = validManifest();
    delete (m as any).webviewAssetCopies;
    const r = validateIntegrationManifest(m);
    expect(r.valid).toBe(false);
  });

  it('rejects wrong schemaVersion', () => {
    const m = validManifest();
    (m as any).schemaVersion = 2;
    const r = validateIntegrationManifest(m);
    expect(r.valid).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(validateIntegrationManifest(null).valid).toBe(false);
    expect(validateIntegrationManifest([]).valid).toBe(false);
    expect(validateIntegrationManifest('string').valid).toBe(false);
  });

  it('rejects copy pair with missing source', () => {
    const m = validManifest();
    (m as any).moduleCopies = [{ target: 't' }];
    const r = validateIntegrationManifest(m);
    expect(r.valid).toBe(false);
  });

  it('accepts optional templateCopies and resourceCopies', () => {
    const m = {
      ...validManifest(),
      templateCopies: [{ source: 'templates/a.ts', target: 'src/a.ts' }],
      resourceCopies: [{ source: 'resources/icon.svg', target: 'icons/icon.svg' }],
    };
    const r = validateIntegrationManifest(m);
    expect(r.valid).toBe(true);
  });

  it('rejects extra unknown keys', () => {
    const m = { ...validManifest(), __evil: true };
    const r = validateIntegrationManifest(m);
    expect(r.valid).toBe(false);
  });
});
