import { describe, expect, it } from 'vitest';
import {
  parseAgentResultJson,
  parseAgentResultJsonWithDiagnostics
} from '../src/vs/workbench/contrib/gomi/node/agentOutputParsing';

describe('agent output parsing', () => {
  it('accepts the versioned agent result schema', () => {
    const parsed = parseAgentResultJson(JSON.stringify({
      schemaVersion: 1,
      summary: 'Backend agent reviewed the login path.',
      findings: ['The controller still requires patch approval.'],
      recommendations: ['Open the native diff preview before applying changes.'],
      proposedFiles: ['src/api/login.ts'],
      confidence: 0.86
    }));

    expect(parsed).toMatchObject({
      schemaVersion: 1,
      summary: 'Backend agent reviewed the login path.',
      findings: ['The controller still requires patch approval.'],
      recommendations: ['Open the native diff preview before applying changes.'],
      proposedFiles: ['src/api/login.ts'],
      confidence: 0.86
    });
  });

  it('rejects unsupported schema versions so providers can fall back to free text', () => {
    const result = parseAgentResultJsonWithDiagnostics(JSON.stringify({
      schemaVersion: 99,
      summary: 'Future schema payload.',
      findings: [],
      recommendations: [],
      proposedFiles: [],
      confidence: 0.5
    }));

    expect(result.value).toBeUndefined();
    expect(result.diagnostics[0]).toContain('Unsupported agent result schemaVersion');
  });

  it('recovers a truncated versioned JSON object when required closers are missing', () => {
    const parsed = parseAgentResultJson([
      'Model response:',
      '```json',
      '{"schemaVersion":1,"summary":"Partial run","findings":["Recovered finding"],"recommendations":["Review recovered fields"],"proposedFiles":["src/api/login.ts"],"confidence":0.73'
    ].join('\n'));

    expect(parsed).toMatchObject({
      schemaVersion: 1,
      summary: 'Partial run',
      findings: ['Recovered finding'],
      recommendations: ['Review recovered fields'],
      proposedFiles: ['src/api/login.ts'],
      confidence: 0.73
    });
  });

  it('leaves garbage or plain text output unparsed for the existing fallback path', () => {
    expect(parseAgentResultJson('plain model text without JSON')).toBeUndefined();
    expect(parseAgentResultJson('{"schemaVersion":1,"summary":')).toBeUndefined();
  });
});
