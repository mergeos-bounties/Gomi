export interface GomiEmbeddingProvider {
  readonly id: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
}

export type GomiEmbeddingProviderMode = 'openai-compatible' | 'ollama-embeddings' | 'ollama-embed';

export type GomiEmbeddingFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface GomiHttpEmbeddingRoute {
  mode: GomiEmbeddingProviderMode;
  endpoint?: string;
  endpointEnv?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  model?: string;
  modelEnv?: string;
  timeoutMs?: number;
}

export interface HttpEmbeddingProviderOptions {
  enabled?: boolean;
  route?: GomiHttpEmbeddingRoute;
  fallbackProvider?: GomiEmbeddingProvider;
  fetchImpl?: GomiEmbeddingFetch;
  env?: Record<string, string | undefined>;
  dimensions?: number;
  timeoutMs?: number;
}

const defaultOpenAiEmbeddingEndpoint = 'https://api.openai.com/v1/embeddings';
const defaultOllamaEmbeddingEndpoint = 'http://127.0.0.1:11434/api/embeddings';
const defaultOllamaEmbedEndpoint = 'http://127.0.0.1:11434/api/embed';

export class HashingEmbeddingProvider implements GomiEmbeddingProvider {
  readonly id = 'local-hashing-embedding';
  readonly dimensions: number;

  constructor(dimensions = 128) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = tokenize(text);

    for (const token of tokens) {
      const index = positiveHash(token) % this.dimensions;
      vector[index] += 1;
    }

    return normalizeVector(vector);
  }
}

export class HttpEmbeddingProvider implements GomiEmbeddingProvider {
  readonly id = 'http-embedding-provider';
  readonly dimensions: number;

  private readonly enabled: boolean;
  private readonly route: GomiHttpEmbeddingRoute;
  private readonly fallbackProvider: GomiEmbeddingProvider;
  private readonly fetchImpl: GomiEmbeddingFetch;
  private readonly env: Record<string, string | undefined>;
  private readonly timeoutMs: number;

  constructor(options: HttpEmbeddingProviderOptions = {}) {
    this.fallbackProvider = options.fallbackProvider ?? new HashingEmbeddingProvider();
    this.enabled = options.enabled ?? false;
    this.route = options.route ?? createDefaultEmbeddingRoute(options.env ?? readRuntimeEnv());
    this.fetchImpl = options.fetchImpl ?? createDefaultEmbeddingFetch();
    this.env = options.env ?? readRuntimeEnv();
    this.dimensions = options.dimensions ?? this.fallbackProvider.dimensions;
    this.timeoutMs = options.timeoutMs ?? 60000;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.enabled) {
      return this.fallbackProvider.embed(text);
    }

    try {
      const vector = await this.embedWithRoute(text);

      if (vector.length === 0) {
        return this.fallbackProvider.embed(text);
      }

      return normalizeVector(vector);
    } catch {
      return this.fallbackProvider.embed(text);
    }
  }

  private async embedWithRoute(text: string): Promise<number[]> {
    const endpoint = resolveEmbeddingEndpoint(this.route, this.env);
    const model = resolveEmbeddingModel(this.route, this.env);
    const abortController = new AbortController();
    const timeout = this.route.timeoutMs ?? this.timeoutMs;
    const timer = globalThis.setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: createEmbeddingHeaders(this.route, this.env),
        body: JSON.stringify(createEmbeddingRequestBody(this.route.mode, model, text)),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return parseEmbeddingResponse(this.route.mode, await response.json() as unknown);
    } finally {
      globalThis.clearTimeout(timer);
    }
  }
}

export function createHttpEmbeddingProvider(options: HttpEmbeddingProviderOptions = {}): GomiEmbeddingProvider {
  return new HttpEmbeddingProvider(options);
}

export function createConfiguredEmbeddingProvider(
  options: Omit<HttpEmbeddingProviderOptions, 'route'> & {
    route?: GomiHttpEmbeddingRoute;
  } = {}
): GomiEmbeddingProvider {
  const env = options.env ?? readRuntimeEnv();
  const route = options.route ?? createDefaultEmbeddingRoute(env);
  const enabled = options.enabled ?? isEmbeddingRouteEnabled(route, env);

  return new HttpEmbeddingProvider({
    ...options,
    enabled,
    env,
    route
  });
}

export function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let score = 0;

  for (let index = 0; index < length; index += 1) {
    score += left[index] * right[index];
  }

  return score;
}

export function normalizeEmbeddingVector(vector: number[]): number[] {
  return normalizeVector(vector);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function positiveHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

function createDefaultEmbeddingRoute(env: Record<string, string | undefined>): GomiHttpEmbeddingRoute {
  const provider = env.GOMI_EMBEDDINGS_PROVIDER?.toLowerCase();

  if (provider === 'ollama-embed') {
    return {
      mode: 'ollama-embed',
      endpointEnv: 'GOMI_LOCAL_EMBEDDINGS_ENDPOINT',
      modelEnv: 'GOMI_LOCAL_EMBEDDINGS_MODEL'
    };
  }

  if (provider === 'ollama' || provider === 'ollama-embeddings' || env.GOMI_LOCAL_EMBEDDINGS_ENDPOINT) {
    return {
      mode: 'ollama-embeddings',
      endpointEnv: 'GOMI_LOCAL_EMBEDDINGS_ENDPOINT',
      modelEnv: 'GOMI_LOCAL_EMBEDDINGS_MODEL'
    };
  }

  return {
    mode: 'openai-compatible',
    endpointEnv: 'GOMI_EMBEDDINGS_ENDPOINT',
    apiKeyEnv: 'GOMI_EMBEDDINGS_API_KEY',
    modelEnv: 'GOMI_EMBEDDINGS_MODEL'
  };
}

function isEmbeddingRouteEnabled(
  route: GomiHttpEmbeddingRoute,
  env: Record<string, string | undefined>
): boolean {
  if (env.GOMI_EMBEDDINGS_ENABLED === 'true') {
    return true;
  }

  if (env.GOMI_EMBEDDINGS_ENABLED === 'false') {
    return false;
  }

  return Boolean(
    route.endpoint ||
      (route.endpointEnv && env[route.endpointEnv]) ||
      route.apiKey ||
      (route.apiKeyEnv && env[route.apiKeyEnv]) ||
      route.model ||
      (route.modelEnv && env[route.modelEnv])
  );
}

function createEmbeddingRequestBody(
  mode: GomiEmbeddingProviderMode,
  model: string,
  text: string
): Record<string, unknown> {
  if (mode === 'ollama-embeddings') {
    return {
      model,
      prompt: text
    };
  }

  if (mode === 'ollama-embed') {
    return {
      model,
      input: text
    };
  }

  return {
    model,
    input: text
  };
}

function createEmbeddingHeaders(
  route: GomiHttpEmbeddingRoute,
  env: Record<string, string | undefined>
): Record<string, string> {
  const apiKey = route.apiKey ?? (route.apiKeyEnv ? env[route.apiKeyEnv] : undefined);
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };

  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function parseEmbeddingResponse(mode: GomiEmbeddingProviderMode, payload: unknown): number[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const value = payload as {
    data?: Array<{
      embedding?: unknown;
    }>;
    embedding?: unknown;
    embeddings?: unknown;
  };

  if (mode === 'openai-compatible') {
    return normalizeNumericVector(value.data?.[0]?.embedding);
  }

  if (mode === 'ollama-embed') {
    const embeddings = Array.isArray(value.embeddings) ? value.embeddings : [];
    return normalizeNumericVector(embeddings[0] ?? value.embedding);
  }

  return normalizeNumericVector(value.embedding ?? (Array.isArray(value.embeddings) ? value.embeddings[0] : undefined));
}

function normalizeNumericVector(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function resolveEmbeddingEndpoint(
  route: GomiHttpEmbeddingRoute,
  env: Record<string, string | undefined>
): string {
  const endpoint = route.endpoint ?? (route.endpointEnv ? env[route.endpointEnv] : undefined);

  if (endpoint) {
    return endpoint;
  }

  if (route.mode === 'ollama-embed') {
    return defaultOllamaEmbedEndpoint;
  }

  return route.mode === 'ollama-embeddings'
    ? defaultOllamaEmbeddingEndpoint
    : defaultOpenAiEmbeddingEndpoint;
}

function resolveEmbeddingModel(
  route: GomiHttpEmbeddingRoute,
  env: Record<string, string | undefined>
): string {
  const model = route.model ?? (route.modelEnv ? env[route.modelEnv] : undefined);

  if (model) {
    return model;
  }

  return route.mode === 'openai-compatible' ? 'text-embedding-3-small' : 'nomic-embed-text';
}

function readRuntimeEnv(): Record<string, string | undefined> {
  const runtime = globalThis as typeof globalThis & {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return runtime.process?.env ?? {};
}

function createDefaultEmbeddingFetch(): GomiEmbeddingFetch {
  const runtime = globalThis as typeof globalThis & {
    fetch?: GomiEmbeddingFetch;
  };

  if (typeof runtime.fetch === 'function') {
    return runtime.fetch.bind(globalThis);
  }

  return async () => {
    throw new Error('Fetch is not available in this runtime.');
  };
}
