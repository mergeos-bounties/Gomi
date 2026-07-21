/**
 * Pure policy: decide whether the packaged Electron main process may attempt
 * an auto-update network check. Default is OFF — no network unless both the
 * opt-in flag and a trusted HTTPS feed URL are present.
 *
 * Env:
 *   GOMI_AUTO_UPDATE=1|true|yes  — explicit opt-in (default off)
 *   GOMI_UPDATE_FEED_URL=https://… — generic update feed base URL
 *
 * electron-updater itself is optional; this helper only answers "may we check?".
 *
 * @param {{
 *   isPackaged: boolean,
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
 *   updateFeedUrl?: string | null
 * }} options
 * @returns {{
 *   allowed: boolean,
 *   reason: string,
 *   feedUrl?: string
 * }}
 */
function shouldCheckForUpdates(options) {
  const env = options.env || {};

  if (!options.isPackaged) {
    return {
      allowed: false,
      reason: 'not-packaged'
    };
  }

  const flag = String(env.GOMI_AUTO_UPDATE || '')
    .trim()
    .toLowerCase();
  const wantsUpdate =
    flag === '1' || flag === 'true' || flag === 'yes';

  if (!wantsUpdate) {
    return {
      allowed: false,
      reason: 'flag-disabled'
    };
  }

  const feedUrl = String(
    options.updateFeedUrl || env.GOMI_UPDATE_FEED_URL || ''
  ).trim();

  if (!feedUrl) {
    return {
      allowed: false,
      reason: 'missing-feed-url'
    };
  }

  // Only HTTPS feeds are accepted so a misconfigured env cannot point
  // packaged builds at plaintext or local schemes.
  if (!/^https:\/\//i.test(feedUrl)) {
    return {
      allowed: false,
      reason: 'feed-url-not-https'
    };
  }

  return {
    allowed: true,
    reason: 'enabled',
    feedUrl
  };
}

module.exports = {
  shouldCheckForUpdates
};
