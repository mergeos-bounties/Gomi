import type {
  GomiAgentCliProviderId,
  GomiUsageEstimate,
  GomiUsagePricing,
  GomiUsageSummary
} from './gomiTypes';

const TOKEN_CHARS_ESTIMATE = 4;

export const DEFAULT_GOMI_USAGE_PRICING: GomiUsagePricing = {
  inputUsdPerMillionTokens: 1,
  outputUsdPerMillionTokens: 3,
  label: 'Display estimate'
};

export interface EstimateGomiUsageInput {
  providerId?: GomiAgentCliProviderId;
  model?: string;
  inputText?: string;
  outputText?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  pricing?: GomiUsagePricing;
}

export function estimateGomiUsage({
  providerId,
  model,
  inputText,
  outputText,
  usage,
  pricing = DEFAULT_GOMI_USAGE_PRICING
}: EstimateGomiUsageInput): GomiUsageEstimate {
  const inputTokens = normalizeTokenCount(usage?.inputTokens) ?? estimateTokenCount(inputText);
  const outputTokens = normalizeTokenCount(usage?.outputTokens) ?? estimateTokenCount(outputText);
  const summedTotal = inputTokens + outputTokens;
  const totalTokens = normalizeTokenCount(usage?.totalTokens) ?? summedTotal;
  const hasEstimatedTokens =
    normalizeTokenCount(usage?.inputTokens) === undefined ||
    normalizeTokenCount(usage?.outputTokens) === undefined ||
    normalizeTokenCount(usage?.totalTokens) === undefined;

  return {
    providerId,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: estimateCostUsd(inputTokens, outputTokens, pricing),
    hasEstimatedTokens,
    pricing
  };
}

export function summarizeGomiUsage(estimates: Array<GomiUsageEstimate | undefined>): GomiUsageSummary | undefined {
  const usageItems = estimates.filter((estimate): estimate is GomiUsageEstimate => Boolean(estimate));

  if (usageItems.length === 0) {
    return undefined;
  }

  const pricing = usageItems[0].pricing;

  return {
    runCount: usageItems.length,
    inputTokens: usageItems.reduce((total, estimate) => total + estimate.inputTokens, 0),
    outputTokens: usageItems.reduce((total, estimate) => total + estimate.outputTokens, 0),
    totalTokens: usageItems.reduce((total, estimate) => total + estimate.totalTokens, 0),
    estimatedCostUsd: usageItems.reduce((total, estimate) => total + estimate.estimatedCostUsd, 0),
    hasEstimatedTokens: usageItems.some((estimate) => estimate.hasEstimatedTokens),
    pricing,
    items: usageItems
  };
}

function estimateTokenCount(text?: string): number {
  const value = text?.trim() ?? '';

  if (!value) {
    return 0;
  }

  return Math.max(1, Math.ceil(value.length / TOKEN_CHARS_ESTIMATE));
}

function normalizeTokenCount(value?: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.floor(value);
}

function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  pricing: GomiUsagePricing
): number {
  return (
    (inputTokens * pricing.inputUsdPerMillionTokens) / 1_000_000 +
    (outputTokens * pricing.outputUsdPerMillionTokens) / 1_000_000
  );
}
