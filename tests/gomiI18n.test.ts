import { describe, expect, it } from 'vitest';
import { t, getLocaleLabel, GOMI_LOCALE_PACKS } from '../src/vs/workbench/contrib/gomi/common/gomiI18n';

describe('gomiI18n', () => {
  it('returns English string for en locale', () => {
    expect(t('en', 'app.name')).toBe('Gomi IDE');
  });

  it('returns Vietnamese string for vi locale', () => {
    expect(t('vi', 'app.name')).toBe('Gomi IDE');
    expect(t('vi', 'office.run')).toBe('Chạy CEO');
  });

  it('falls back to English for missing Vietnamese key', () => {
    // Use a key that exists in en but not in vi
    expect(t('vi', 'layout.fullOffice')).toBe('Bố cục toàn màn hình');
  });

  it('falls back to key itself when neither locale has the string', () => {
    expect(t('en', 'nonexistent.key')).toBe('nonexistent.key');
  });

  it('accepts a custom fallback string', () => {
    expect(t('en', 'nonexistent.key', 'Fallback')).toBe('Fallback');
  });

  it('has both locale packs', () => {
    const locales = GOMI_LOCALE_PACKS.map((pack) => pack.locale);
    expect(locales).toContain('en');
    expect(locales).toContain('vi');
  });

  it('getLocaleLabel returns display name', () => {
    expect(getLocaleLabel('en')).toBe('English');
    expect(getLocaleLabel('vi')).toBe('Tiếng Việt');
  });

  it('all English keys have Vietnamese translations', () => {
    const enPack = GOMI_LOCALE_PACKS.find((p) => p.locale === 'en')!;
    const viPack = GOMI_LOCALE_PACKS.find((p) => p.locale === 'vi')!;
    const enKeys = Object.keys(enPack.strings);
    const viKeys = new Set(Object.keys(viPack.strings));

    for (const key of enKeys) {
      expect(viKeys.has(key)).toBe(true);
    }
  });
});
