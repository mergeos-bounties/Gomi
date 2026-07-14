/** i18n: English + Vietnamese packs (issue #20) */
export type I18nMessages = Record<string, string>;
export const EN: I18nMessages = {
  'office.title': 'Gomi Office', 'office.run': 'Run', 'office.stop': 'Stop',
  'office.settings': 'Settings', 'office.memory': 'Memory Board', 'office.patches': 'Patch Review',
  'agent.ceo': 'CEO', 'agent.backend': 'Backend', 'agent.frontend': 'Frontend',
  'agent.designer': 'Designer', 'agent.qa': 'QA', 'agent.devops': 'DevOps',
};
export const VI: I18nMessages = {
  'office.title': 'Van phong Gomi', 'office.run': 'Chay', 'office.stop': 'Dung',
  'office.settings': 'Cai dat', 'office.memory': 'Bang nho', 'office.patches': 'Xem xet ban va',
  'agent.ceo': 'Giam doc', 'agent.backend': 'Backend', 'agent.frontend': 'Frontend',
  'agent.designer': 'Thiet ke', 'agent.qa': 'Kiem thu', 'agent.devops': 'DevOps',
};
export type Locale = 'en' | 'vi';
const packs: Record<Locale, I18nMessages> = { en: EN, vi: VI };
let current: Locale = 'en';
export function setLocale(locale: Locale): void { current = locale; }
export function getLocale(): Locale { return current; }
export function t(key: string): string { return packs[current][key] ?? key; }
