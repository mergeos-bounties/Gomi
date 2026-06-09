import type { GomiAgentResult } from '../common/gomiTypes';

export function parseAgentResultJson(text: string): Partial<GomiAgentResult> | undefined {
  const trimmed = text.trim();

  if (!trimmed) {
    return undefined;
  }

  const direct = tryParseObject(trimmed);

  if (direct) {
    return direct;
  }

  const candidate = extractLastJsonObject(trimmed);

  return candidate ? tryParseObject(candidate) : undefined;
}

function tryParseObject(text: string): Partial<GomiAgentResult> | undefined {
  try {
    const value = JSON.parse(text) as unknown;

    if (value && typeof value === 'object') {
      return value as Partial<GomiAgentResult>;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function extractLastJsonObject(text: string): string | undefined {
  let end = -1;

  for (let index = text.length - 1; index >= 0; index--) {
    if (text[index] === '}') {
      end = index;
      break;
    }
  }

  if (end === -1) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = end; index >= 0; index--) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '}') {
      depth++;
    } else if (char === '{') {
      depth--;

      if (depth === 0) {
        return text.slice(index, end + 1);
      }
    }
  }

  return undefined;
}

export function matchWorkspaceFilesInOutput(
  output: string,
  workspaceFiles: string[]
): string[] {
  return workspaceFiles.filter((file) => containsFileToken(output, file));
}

function containsFileToken(output: string, file: string): boolean {
  const pattern = new RegExp(
    `(^|[^\\w/\\\\-])${escapeRegExp(file)}(?![\\w/\\\\-])(?!\\.\\w)`,
    'i'
  );

  return pattern.test(output);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
