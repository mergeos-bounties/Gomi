import { describe, expect, it } from 'vitest';
import {
  estimateGomiUsage,
  summarizeGomiUsage
} from '../src/vs/workbench/contrib/gomi/common/gomiUsageEstimate';

describe('Gomi usage estimate', () => {
  it('uses provider token counts when they are available', () => {
    const usage = estimateGomiUsage({
      providerId: 'openai-compatible-api',
      model: 'gomi-cloud-test',
      usage: {
        inputTokens: 120,
        outputTokens: 40,
        totalTokens: 160
      }
    });

    expect(usage.inputTokens).toBe(120);
    expect(usage.outputTokens).toBe(40);
    expect(usage.totalTokens).toBe(160);
    expect(usage.hasEstimatedTokens).toBe(false);
    expect(usage.estimatedCostUsd).toBeCloseTo(0.00024, 6);
  });

  it('estimates missing counts from request and response text without external calls', () => {
    const usage = estimateGomiUsage({
      inputText: 'abcd '.repeat(20),
      outputText: 'final summary'
    });

    expect(usage.inputTokens).toBe(25);
    expect(usage.outputTokens).toBe(4);
    expect(usage.totalTokens).toBe(29);
    expect(usage.hasEstimatedTokens).toBe(true);
  });

  it('summarizes multiple usage estimates for a session panel', () => {
    const summary = summarizeGomiUsage([
      estimateGomiUsage({
        providerId: 'openai-compatible-api',
        model: 'gomi-cloud-test',
        usage: {
          inputTokens: 120,
          outputTokens: 40,
          totalTokens: 160
        }
      }),
      estimateGomiUsage({
        providerId: 'ollama-local-model',
        outputText: 'local model output'
      })
    ]);

    expect(summary?.runCount).toBe(2);
    expect(summary?.inputTokens).toBe(120);
    expect(summary?.outputTokens).toBe(45);
    expect(summary?.totalTokens).toBe(165);
    expect(summary?.hasEstimatedTokens).toBe(true);
  });
});
