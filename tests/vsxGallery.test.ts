/**
 * Tests for VSX gallery configuration (issue #27).
 * Ensures extensionsGallery points at Open VSX, not Microsoft Marketplace.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const productJson = JSON.parse(
  readFileSync(resolve(__dirname, '../product.json'), 'utf-8')
);

describe('VSX Gallery Configuration', () => {
  it('extensionsGallery.serviceUrl uses open-vsx.org', () => {
    const serviceUrl = productJson.extensionsGallery?.serviceUrl;
    expect(serviceUrl).toBeTruthy();
    expect(serviceUrl).toContain('open-vsx.org');
    expect(serviceUrl).not.toContain('marketplace.visualstudio.com');
    expect(serviceUrl).not.toContain('marketplace.visualstudio');
  });

  it('extensionsGallery.itemUrl uses open-vsx.org', () => {
    const itemUrl = productJson.extensionsGallery?.itemUrl;
    expect(itemUrl).toBeTruthy();
    expect(itemUrl).toContain('open-vsx.org');
    expect(itemUrl).not.toContain('marketplace.visualstudio.com');
  });

  it('extensionsGallery has both serviceUrl and itemUrl defined', () => {
    expect(productJson.extensionsGallery).toBeTruthy();
    expect(typeof productJson.extensionsGallery.serviceUrl).toBe('string');
    expect(typeof productJson.extensionsGallery.itemUrl).toBe('string');
  });

  it('gallery URLs are https', () => {
    expect(productJson.extensionsGallery.serviceUrl).toMatch(/^https:\/\//);
    expect(productJson.extensionsGallery.itemUrl).toMatch(/^https:\/\//);
  });

  it('no Microsoft marketplace references in extensionsGallery', () => {
    const gallery = JSON.stringify(productJson.extensionsGallery || {});
    expect(gallery.toLowerCase()).not.toContain('microsoft');
    expect(gallery).not.toContain('marketplace.visualstudio.com');
    expect(gallery).not.toContain('visualstudio.com');
  });
});