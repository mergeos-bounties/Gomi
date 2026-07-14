import { describe, expect, it } from 'vitest';
import { probeWebGL, getWebGLBannerMessage } from '../src/vs/workbench/contrib/gomi/browser/webglProbe';

describe('webglProbe', () => {
  it('returns a capability object', () => {
    const cap = probeWebGL();
    expect(cap).toHaveProperty('supported');
    expect(cap).toHaveProperty('version');
    expect(cap).toHaveProperty('renderer');
    expect(cap).toHaveProperty('message');
  });

  it('version is one of the valid values', () => {
    const cap = probeWebGL();
    expect(['none', 'webgl1', 'webgl2']).toContain(cap.version);
  });

  it('banner message is empty when WebGL is available', () => {
    const cap = probeWebGL();
    const msg = getWebGLBannerMessage();
    if (cap.supported) {
      expect(msg).toBe('');
    } else {
      expect(msg).toContain('WebGL');
    }
  });
});
