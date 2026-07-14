/**
 * Settings search utility (issue #43).
 * Filters Office Settings fields by keyword.
 */

export interface SearchableField {
  key: string;
  label: string;
  value: unknown;
  section: string;
}

export function searchSettings(
  fields: SearchableField[],
  query: string
): SearchableField[] {
  if (!query.trim()) return fields;

  const terms = query.toLowerCase().trim().split(/\s+/);

  return fields.filter((field) => {
    const searchText = [
      field.key.toLowerCase(),
      field.label.toLowerCase(),
      String(field.value ?? '').toLowerCase(),
      field.section.toLowerCase(),
    ].join(' ');

    return terms.every((term) => searchText.includes(term));
  });
}

export function buildSettingsSearchIndex(
  settings: Record<string, unknown>,
  section = 'root',
  prefix = ''
): SearchableField[] {
  const fields: SearchableField[] = [];

  for (const [key, value] of Object.entries(settings)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      fields.push(
        ...buildSettingsSearchIndex(
          value as Record<string, unknown>,
          key,
          fullKey
        )
      );
    } else {
      fields.push({
        key: fullKey,
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
        value,
        section,
      });
    }
  }

  return fields;
}
