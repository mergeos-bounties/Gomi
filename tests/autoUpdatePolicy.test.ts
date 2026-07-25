import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { shouldCheckForUpdates } = require("../electron/autoUpdatePolicy.cjs");

const OLD_ENV = { ...process.env };

function clearEnvVars() {
  delete process.env.GOMI_AUTO_UPDATE_ENABLED;
  delete process.env.GOMI_AUTO_UPDATE_FEED_URL;
}

beforeEach(clearEnvVars);
afterEach(() => {
  clearEnvVars();
  // Restore any env vars we need to keep
  Object.assign(process.env, OLD_ENV);
});

describe("shouldCheckForUpdates", () => {
  it("returns false when neither flag nor feed URL is set", () => {
    expect(shouldCheckForUpdates(process.env)).toBe(false);
  });

  it("returns false when only the flag is set", () => {
    process.env.GOMI_AUTO_UPDATE_ENABLED = "1";
    expect(shouldCheckForUpdates(process.env)).toBe(false);
  });

  it("returns false when only the feed URL is set", () => {
    process.env.GOMI_AUTO_UPDATE_FEED_URL = "https://updates.example.com/gomi";
    expect(shouldCheckForUpdates(process.env)).toBe(false);
  });

  it("returns true when both flag and HTTPS feed URL are set", () => {
    process.env.GOMI_AUTO_UPDATE_ENABLED = "1";
    process.env.GOMI_AUTO_UPDATE_FEED_URL = "https://updates.example.com/gomi";
    expect(shouldCheckForUpdates(process.env)).toBe(true);
  });

  it("accepts 'true' as a valid enabled value", () => {
    process.env.GOMI_AUTO_UPDATE_ENABLED = "true";
    process.env.GOMI_AUTO_UPDATE_FEED_URL = "https://updates.example.com/gomi";
    expect(shouldCheckForUpdates(process.env)).toBe(true);
  });

  it("rejects non-HTTPS feed URLs", () => {
    process.env.GOMI_AUTO_UPDATE_ENABLED = "1";
    process.env.GOMI_AUTO_UPDATE_FEED_URL = "http://updates.example.com/gomi";
    expect(shouldCheckForUpdates(process.env)).toBe(false);
  });

  it("rejects empty feed URL string", () => {
    process.env.GOMI_AUTO_UPDATE_ENABLED = "1";
    process.env.GOMI_AUTO_UPDATE_FEED_URL = "";
    expect(shouldCheckForUpdates(process.env)).toBe(false);
  });

  it("rejects garbage enabled values", () => {
    process.env.GOMI_AUTO_UPDATE_ENABLED = "yes";
    process.env.GOMI_AUTO_UPDATE_FEED_URL = "https://updates.example.com/gomi";
    expect(shouldCheckForUpdates(process.env)).toBe(false);
  });

  it("default packaged build does not call network for updates (no env vars set)", () => {
    // This is the key acceptance criterion: by default, no auto-update
    expect(shouldCheckForUpdates(process.env)).toBe(false);
    expect(shouldCheckForUpdates({})).toBe(false);
  });
});
