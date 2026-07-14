/**
 * WebGL capability probe (issue #38).
 * Returns whether WebGL is available and a friendly message for unsupported browsers.
 */

export interface WebGLCapability {
  supported: boolean;
  version: 'none' | 'webgl1' | 'webgl2';
  renderer: string;
  message: string;
}

export function probeWebGL(): WebGLCapability {
  // Node.js / test environment — no DOM
  if (typeof document === 'undefined') {
    return {
      supported: false,
      version: 'none',
      renderer: 'none',
      message: 'WebGL probe unavailable outside browser environment.',
    };
  }

  const canvas = document.createElement('canvas');
  const gl2 = canvas.getContext('webgl2');
  if (gl2) {
    const debugInfo = gl2.getExtension('WEBGL_debug_renderer_info');
    return {
      supported: true,
      version: 'webgl2',
      renderer: debugInfo ? gl2.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'WebGL 2',
      message: 'WebGL 2 is available.',
    };
  }

  const gl1 = canvas.getContext('webgl') || (canvas as any).getContext('experimental-webgl');
  if (gl1) {
    return {
      supported: true,
      version: 'webgl1',
      renderer: 'WebGL 1',
      message: 'WebGL 1 is available (3D office may have reduced quality).',
    };
  }

  return {
    supported: false,
    version: 'none',
    renderer: 'none',
    message: 'WebGL is not available. The 3D office requires a WebGL-capable browser or GPU.',
  };
}

export function getWebGLBannerMessage(): string {
  const cap = probeWebGL();
  if (!cap.supported) {
    return 'WebGL is not available. The Gomi 3D office requires hardware acceleration. Please enable WebGL in your browser settings or try a different browser.';
  }
  if (cap.version === 'webgl1') {
    return 'WebGL 1 detected. The 3D office will work but may have reduced performance. WebGL 2 is recommended.';
  }
  return '';
}
