/**
 * Provider connection test utility (issue #14).
 * Tests whether an HTTP/Ollama provider endpoint is reachable.
 */

export interface ProviderConnectionResult {
  success: boolean;
  endpoint: string;
  latencyMs: number;
  error?: string;
  modelCount?: number;
}

export async function testProviderConnection(
  endpoint: string,
  apiKey?: string,
  timeoutMs = 5000
): Promise<ProviderConnectionResult> {
  const start = Date.now();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${endpoint}/models`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      return {
        success: false,
        endpoint,
        latencyMs,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    const modelCount = data?.data?.length ?? data?.models?.length;

    return { success: true, endpoint, latencyMs, modelCount };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const error = err instanceof Error ? err.message : 'Unknown error';

    if (error.includes('abort')) {
      return { success: false, endpoint, latencyMs, error: `Connection timed out after ${timeoutMs}ms` };
    }

    return { success: false, endpoint, latencyMs, error };
  }
}

export async function testOllamaConnection(
  endpoint = 'http://localhost:11434',
  timeoutMs = 5000
): Promise<ProviderConnectionResult> {
  return testProviderConnection(endpoint, undefined, timeoutMs);
}
