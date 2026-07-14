import type {
  GomiAgentResult,
  GomiAgentResultSchemaVersion
} from '../common/gomiTypes';
import { validateAgentResult, type AgentResultValidationResult } from '../common/gomiAgentResultSchema';

export const GOMI_AGENT_RESULT_SCHEMA_VERSION = 1 satisfies GomiAgentResultSchemaVersion;

interface AgentResultRecord {
  [key: string]: unknown;
}

export interface GomiAgentResultParseResult {
  value?: Partial<GomiAgentResult>;
  diagnostics: string[];
}

export function parseAgentResultJson(text: string): Partial<GomiAgentResult> | undefined {
  return parseAgentResultJsonWithDiagnostics(text).value;
}

export function parseAgentResultJsonWithDiagnostics(text: string): GomiAgentResultParseResult {
  const trimmed = text.trim();
  const diagnostics: string[] = [];

  if (!trimmed) {
    return {
      diagnostics: ['Agent result output was empty.']
    };
  }

  for (const candidate of extractJsonObjectCandidates(trimmed).reverse()) {
    const parsed = tryParseObject(candidate);

    if (parsed.value) {
      return normalizeWithSchema(parsed.value);
    }

    diagnostics.push(parsed.error ?? 'Agent result JSON candidate could not be parsed.');
  }

  const trailingCandidate = extractTrailingJsonObjectCandidate(trimmed);
  const completedCandidate = trailingCandidate ? completeTruncatedJsonObject(trailingCandidate) : undefined;

  if (completedCandidate && completedCandidate !== trailingCandidate) {
    const parsed = tryParseObject(completedCandidate);

    if (parsed.value) {
      const normalized = normalizeWithSchema(parsed.value);
      return {
        value: normalized.value,
        diagnostics: [
          'Recovered truncated agent result JSON by closing incomplete objects and arrays.',
          ...normalized.diagnostics
        ]
      };
    }

    diagnostics.push(parsed.error ?? 'Recovered agent result JSON candidate could not be parsed.');
  }

  return {
    diagnostics: diagnostics.length > 0
      ? diagnostics
      : ['No agent result JSON object was found.']
  };
}

/**
 * Run the parsed object through the Zod schema validator.
 * Merges schema validation errors/warnings into the diagnostics stream.
 */
function normalizeWithSchema(value: AgentResultRecord): GomiAgentResultParseResult {
  const validation = validateAgentResult(value);

  // Schema validation errors are fatal — no value returned
  if (validation.errors.length > 0) {
    return { diagnostics: validation.errors };
  }

  // Return validated value with any warnings as diagnostics
  return {
    value: (validation.value ?? value) as Partial<GomiAgentResult>,
    diagnostics: validation.warnings
  };
}

function tryParseObject(text: string): { value?: AgentResultRecord; error?: string } {
  try {
    const value = JSON.parse(text) as unknown;

    if (isAgentResultRecord(value)) {
      return {
        value
      };
    }

    return {
      error: 'Agent result JSON must be an object.'
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Agent result JSON could not be parsed.'
    };
  }
}

function normalizeAgentResultObject(value: AgentResultRecord): GomiAgentResultParseResult {
  const rawSchemaVersion = value.schemaVersion ?? value.schema_version;

  if (rawSchemaVersion === undefined) {
    return {
      value: value as Partial<GomiAgentResult>,
      diagnostics: []
    };
  }

  if (rawSchemaVersion === GOMI_AGENT_RESULT_SCHEMA_VERSION) {
    return {
      value: {
        ...value,
        schemaVersion: GOMI_AGENT_RESULT_SCHEMA_VERSION
      } as Partial<GomiAgentResult>,
      diagnostics: []
    };
  }

  return {
    diagnostics: [`Unsupported agent result schemaVersion ${String(rawSchemaVersion)}.`]
  };
}

function isAgentResultRecord(value: unknown): value is AgentResultRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function extractJsonObjectCandidates(text: string): string[] {
  const candidates: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inString && char === '\\') {
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

    if (char === '{') {
      if (depth === 0) {
        start = index;
      }

      depth++;
    } else if (char === '}' && depth > 0) {
      depth--;

      if (depth === 0 && start !== -1) {
        candidates.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

function extractTrailingJsonObjectCandidate(text: string): string | undefined {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inString && char === '\\') {
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

    if (char === '{') {
      if (depth === 0) {
        start = index;
      }

      depth++;
    } else if (char === '}' && depth > 0) {
      depth--;

      if (depth === 0) {
        start = -1;
      }
    }
  }

  return start === -1 ? undefined : text.slice(start).trimEnd();
}

function completeTruncatedJsonObject(candidate: string): string | undefined {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < candidate.length; index++) {
    const char = candidate[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inString && char === '\\') {
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

    if (char === '{') {
      stack.push('}');
    } else if (char === '[') {
      stack.push(']');
    } else if (char === '}' || char === ']') {
      if (stack.pop() !== char) {
        return undefined;
      }
    }
  }

  if (escaped) {
    return undefined;
  }

  let completed = candidate.trimEnd();

  if (/[:,]\s*$/.test(completed)) {
    return undefined;
  }

  if (inString) {
    completed += '"';
  }

  while (stack.length > 0) {
    completed += stack.pop();
  }

  return completed.replace(/,\s*([}\]])/g, '$1');
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
