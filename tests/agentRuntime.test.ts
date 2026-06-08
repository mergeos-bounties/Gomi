import { describe, expect, it } from 'vitest';
import { GomiAgentRuntime } from '../src/vs/workbench/contrib/gomi/node/agentRuntime';

describe('GomiAgentRuntime', () => {
  it('streams a final report and patch proposal', async () => {
    const runtime = new GomiAgentRuntime({ delayMs: 0 });
    const eventTypes: string[] = [];

    for await (const event of runtime.run('Review API and UI')) {
      eventTypes.push(event.type);
    }

    expect(eventTypes).toContain('session_started');
    expect(eventTypes).toContain('patch');
    expect(eventTypes).toContain('report');
    expect(eventTypes.at(-1)).toBe('session_completed');
  });
});
