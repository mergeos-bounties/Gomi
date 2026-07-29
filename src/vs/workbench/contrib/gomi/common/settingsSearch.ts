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

function stringifySearchPart(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export function matchesSettingsSearch(parts: unknown[], query: string): boolean {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return true;
  }

  const searchText = parts.map(stringifySearchPart).join(' ').toLowerCase();
  return terms.every((term) => searchText.includes(term));
}

export function searchSettings(
  fields: SearchableField[],
  query: string
): SearchableField[] {
  return fields.filter((field) =>
    matchesSettingsSearch(
      [
        field.key.toLowerCase(),
        field.label.toLowerCase(),
        String(field.value ?? '').toLowerCase(),
        field.section.toLowerCase(),
      ],
      query
    )
  );
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
