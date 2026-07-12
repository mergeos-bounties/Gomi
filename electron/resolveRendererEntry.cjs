/**
 * Pure helper: decide which URL/file Electron should load for the renderer.
 * Packaged builds always use the built dist index. Unpackaged builds can opt
 * into the Vite dev server via GOMI_ELECTRON_DEV=1 (or "true") and optional
 * GOMI_VITE_DEV_URL / GOMI_VITE_PORT.
 *
 * @param {{
 *   isPackaged: boolean,
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
 *   distIndexHtml: string,
 *   defaultDevUrl?: string
 * }} options
 * @returns {{ kind: 'url' | 'file', target: string, reason: string }}
 */
function resolveRendererEntry(options) {
  const env = options.env || {};
  const distIndexHtml = options.distIndexHtml;
  const defaultDevUrl = options.defaultDevUrl || 'http://127.0.0.1:5173';

  if (options.isPackaged) {
    return {
      kind: 'file',
      target: distIndexHtml,
      reason: 'packaged'
    };
  }

  const flag = String(env.GOMI_ELECTRON_DEV || '').trim().toLowerCase();
  const wantsDev = flag === '1' || flag === 'true' || flag === 'yes';

  if (!wantsDev) {
    return {
      kind: 'file',
      target: distIndexHtml,
      reason: 'unpackaged-without-dev-flag'
    };
  }

  const explicitUrl = String(env.GOMI_VITE_DEV_URL || '').trim();
  if (explicitUrl) {
    if (!/^https?:\/\//i.test(explicitUrl)) {
      throw new Error(
        `GOMI_VITE_DEV_URL must be an http(s) URL, got: ${explicitUrl}`
      );
    }
    return {
      kind: 'url',
      target: explicitUrl,
      reason: 'explicit-dev-url'
    };
  }

  const portRaw = String(env.GOMI_VITE_PORT || '').trim();
  if (portRaw) {
    const port = Number(portRaw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`GOMI_VITE_PORT must be an integer 1-65535, got: ${portRaw}`);
    }
    return {
      kind: 'url',
      target: `http://127.0.0.1:${port}`,
      reason: 'dev-port'
    };
  }

  return {
    kind: 'url',
    target: defaultDevUrl,
    reason: 'default-dev-url'
  };
}

module.exports = {
  resolveRendererEntry
};
