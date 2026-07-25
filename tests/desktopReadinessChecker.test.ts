import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  checkBrandingAssets,
  checkElectronBuilderConfig,
  checkElectronMain,
  checkIntegrationPrerequisites,
  checkJsonValue,
  checkProductBranding,
} from '../scripts/check-desktop-readiness.mjs';

describe('check-desktop-readiness pure functions', () => {
  describe('checkJsonValue', () => {
    it('returns ok when value matches expected', () => {
      const obj = { nameLong: 'Gomi IDE' };
      expect(checkJsonValue(obj, 'nameLong', 'Gomi IDE').ok).toBe(true);
    });

    it('returns ok false with actual/expected when mismatched', () => {
      const obj = { nameLong: 'Visual Studio Code' };
      const result = checkJsonValue(obj, 'nameLong', 'Gomi IDE');
      expect(result.ok).toBe(false);
      expect(result.actual).toBe('Visual Studio Code');
      expect(result.expected).toBe('Gomi IDE');
    });
  });

  describe('checkElectronMain', () => {
    it('passes when main entry points to an existing file', async () => {
      const results = await checkElectronMain();
      const mainCheck = results.find((r) => r.label.includes('Electron main entry'));
      expect(mainCheck?.ok).toBe(true);
    });
  });

  describe('checkElectronBuilderConfig', () => {
    it('passes when package.json build config matches Gomi branding', async () => {
      const results = await checkElectronBuilderConfig();
      const okResults = results.filter((r) => r.ok);
      const failResults = results.filter((r) => !r.ok);
      expect(okResults.length).toBeGreaterThan(0);
      expect(failResults.length).toBe(0);
    });

    it('has appId com.gomi.ide', async () => {
      const results = await checkElectronBuilderConfig();
      const appId = results.find((r) => r.label.includes('appId'));
      expect(appId?.ok).toBe(true);
    });

    it('has productName Gomi IDE', async () => {
      const results = await checkElectronBuilderConfig();
      const name = results.find((r) => r.label.includes('productName'));
      expect(name?.ok).toBe(true);
    });

    it('has win.icon pointing to resources/gomi-branding/win32/gomi.ico', async () => {
      const results = await checkElectronBuilderConfig();
      const icon = results.find((r) => r.label.includes('win.icon'));
      expect(icon?.ok).toBe(true);
    });
  });

  describe('checkProductBranding', () => {
    it('passes all required Gomi-branded product.json checks', async () => {
      const results = await checkProductBranding();
      const okResults = results.filter((r) => r.ok);
      const failResults = results.filter((r) => !r.ok);
      expect(okResults.length).toBeGreaterThan(0);
      expect(failResults.length).toBe(0);
    });

    it('verifies nameShort equals Gomi', async () => {
      const results = await checkProductBranding();
      const short = results.find((r) => r.label.includes('nameShort'));
      expect(short?.ok).toBe(true);
    });

    it('verifies nameLong equals Gomi IDE', async () => {
      const results = await checkProductBranding();
      const long = results.find((r) => r.label.includes('nameLong'));
      expect(long?.ok).toBe(true);
    });

    it('verifies extensionsGallery points to Open VSX', async () => {
      const results = await checkProductBranding();
      const vsx = results.find((r) => r.label.includes('Open VSX'));
      expect(vsx?.ok).toBe(true);
    });
  });

  describe('checkBrandingAssets', () => {
    it('passes when brand assets have been generated', async () => {
      const results = await checkBrandingAssets();
      const okResults = results.filter((r) => r.ok);
      const failResults = results.filter((r) => !r.ok);
      expect(okResults.length).toBeGreaterThan(0);
      expect(failResults.length).toBe(0);
    });

    it('verifies win32 icon exists', async () => {
      const results = await checkBrandingAssets();
      const icon = results.find((r) => r.label.includes('win32 icon'));
      expect(icon?.ok).toBe(true);
    });
  });

  describe('checkIntegrationPrerequisites', () => {
    it('passes when integration scripts and manifest exist', async () => {
      const results = await checkIntegrationPrerequisites();
      const okResults = results.filter((r) => r.ok);
      const failResults = results.filter((r) => !r.ok);
      expect(okResults.length).toBeGreaterThan(0);
      expect(failResults.length).toBe(0);
    });
  });
});
