import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const electronDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'electron');
const { resolveRendererEntry } = require(path.join(electronDir, 'resolveRendererEntry.cjs')) as {
  resolveRendererEntry: (options: {
    isPackaged: boolean;
    env?: Record<string, string | undefined>;
    distIndexHtml: string;
    defaultDevUrl?: string;
  }) => { kind: 'url' | 'file'; target: string; reason: string };
};

const distIndex = path.join('D:', 'fake', 'dist', 'index.html');

describe('resolveRendererEntry', () => {
  it('always uses dist file when packaged', () => {
    const result = resolveRendererEntry({
      isPackaged: true,
      env: { GOMI_ELECTRON_DEV: '1', GOMI_VITE_DEV_URL: 'http://127.0.0.1:5173' },
      distIndexHtml: distIndex
    });

    expect(result).toEqual({
      kind: 'file',
      target: distIndex,
      reason: 'packaged'
    });
  });

  it('uses dist file when unpackaged without dev flag', () => {
    const result = resolveRendererEntry({
      isPackaged: false,
      env: {},
      distIndexHtml: distIndex
    });

    expect(result.kind).toBe('file');
    expect(result.target).toBe(distIndex);
    expect(result.reason).toBe('unpackaged-without-dev-flag');
  });

  it('loads default Vite URL when GOMI_ELECTRON_DEV=1', () => {
    const result = resolveRendererEntry({
      isPackaged: false,
      env: { GOMI_ELECTRON_DEV: '1' },
      distIndexHtml: distIndex
    });

    expect(result).toEqual({
      kind: 'url',
      target: 'http://127.0.0.1:5173',
      reason: 'default-dev-url'
    });
  });

  it('honors GOMI_VITE_PORT and GOMI_VITE_DEV_URL', () => {
    expect(
      resolveRendererEntry({
        isPackaged: false,
        env: { GOMI_ELECTRON_DEV: 'true', GOMI_VITE_PORT: '5199' },
        distIndexHtml: distIndex
      }).target
    ).toBe('http://127.0.0.1:5199');

    expect(
      resolveRendererEntry({
        isPackaged: false,
        env: {
          GOMI_ELECTRON_DEV: 'yes',
          GOMI_VITE_DEV_URL: 'http://127.0.0.1:4173/'
        },
        distIndexHtml: distIndex
      }).target
    ).toBe('http://127.0.0.1:4173/');
  });

  it('rejects non-http dev URLs and invalid ports', () => {
    expect(() =>
      resolveRendererEntry({
        isPackaged: false,
        env: { GOMI_ELECTRON_DEV: '1', GOMI_VITE_DEV_URL: 'file:///tmp/x' },
        distIndexHtml: distIndex
      })
    ).toThrow(/http\(s\) URL/i);

    expect(() =>
      resolveRendererEntry({
        isPackaged: false,
        env: { GOMI_ELECTRON_DEV: '1', GOMI_VITE_PORT: 'not-a-port' },
        distIndexHtml: distIndex
      })
    ).toThrow(/GOMI_VITE_PORT/);
  });
});
