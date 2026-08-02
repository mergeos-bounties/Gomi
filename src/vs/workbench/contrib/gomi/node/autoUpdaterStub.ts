/**
 * Electron auto-update stub (issue #29).
 * Wires electron-updater with feature flag (off by default).
 * This is a stub — full implementation requires signing certs.
 *
 * Note: do NOT `import type` from `electron-updater` — the package is optional
 * and not always installed in CI typecheck. Use a minimal local interface.
 */

/** Subset of electron-updater AppUpdater used by this stub. */
export interface AppUpdater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  channel?: string;
  setFeedURL(options: Record<string, unknown>): void;
  checkForUpdates?: () => Promise<unknown>;
}

export interface AutoUpdateConfig {
  enabled: boolean;
  provider: "github" | "generic";
  repo?: string;
  url?: string;
  channel?: string;
}

export function createAutoUpdaterStub(config: AutoUpdateConfig): AppUpdater | null {
  if (!config.enabled) return null;

  try {
    // Dynamic require — electron-updater is an optional dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { autoUpdater } = require("electron-updater") as { autoUpdater: AppUpdater };

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    if (config.provider === "github" && config.repo) {
      const [owner, repo] = config.repo.split("/");
      autoUpdater.setFeedURL({
        provider: "github",
        owner,
        repo,
      });
    }

    if (config.channel) {
      autoUpdater.channel = config.channel;
    }

    return autoUpdater;
  } catch {
    // electron-updater not installed — return null
    return null;
  }
}

export function isAutoUpdateAvailable(): boolean {
  try {
    require.resolve("electron-updater");
    return true;
  } catch {
    return false;
  }
}

/** Inputs the update policy is allowed to consider. */
export interface UpdatePolicyInput {
  /** Feature flag. Absent or false means updates stay off. */
  enabled?: boolean;
  /** Feed target: `owner/repo` for github, or an absolute URL for generic. */
  repo?: string;
  url?: string;
  provider?: AutoUpdateConfig["provider"];
  /** Only packaged builds should ever reach the network. */
  isPackaged?: boolean;
}

export interface UpdatePolicyDecision {
  shouldCheck: boolean;
  /** Machine-readable reason, so callers can log without re-deriving intent. */
  reason:
    | "ok"
    | "disabled"
    | "not-packaged"
    | "no-feed"
    | "updater-unavailable";
}

/**
 * Decide whether a build may contact the update feed.
 *
 * Deliberately fail-closed: every unknown or partially configured state
 * returns false. A default packaged build performs no network call because
 * `enabled` is absent, which is the property the acceptance criteria pin down.
 *
 * Separated from createAutoUpdaterStub so the policy is testable without
 * electron-updater installed and without touching the network.
 */
export function shouldCheckForUpdates(
  input: UpdatePolicyInput = {},
  updaterAvailable: () => boolean = isAutoUpdateAvailable,
): UpdatePolicyDecision {
  if (input.enabled !== true) return { shouldCheck: false, reason: "disabled" };

  // Dev and test runs must never hit a real feed.
  if (input.isPackaged !== true) return { shouldCheck: false, reason: "not-packaged" };

  // Enabled but unconfigured is a misconfiguration, not an invitation to guess.
  const provider = input.provider ?? "github";
  const hasFeed = provider === "github"
    ? typeof input.repo === "string" && input.repo.includes("/")
    : typeof input.url === "string" && /^https:\/\//.test(input.url);
  if (!hasFeed) return { shouldCheck: false, reason: "no-feed" };

  if (!updaterAvailable()) return { shouldCheck: false, reason: "updater-unavailable" };

  return { shouldCheck: true, reason: "ok" };
}
