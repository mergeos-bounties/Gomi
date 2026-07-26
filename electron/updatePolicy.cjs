// Utility function to determine if auto-update checks should be performed
// Returns true only when:
//   - Not in development (app is packaged)
//   - AUTO_UPDATE_ENABLED environment variable is set to 'true' (case-insensitive)
//   - UPDATE_FEED_URL environment variable is set and non-empty
function shouldCheckForUpdates(env) {
  // We expect the caller to have determined if the app is packaged
  // For simplicity, we accept a flag or check via env.APP_IS_PACKAGED
  const isPackaged = env.APP_IS_PACKAGED === 'true' || env.APP_IS_PACKAGED === true;
  if (!isPackaged) return false;

  const enabled = String(env.AUTO_UPDATE_ENABLED || '').toLowerCase() === 'true';
  const url = env.UPDATE_FEED_URL || '';
  return enabled && url.length > 0;
}

module.exports = { shouldCheckForUpdates };