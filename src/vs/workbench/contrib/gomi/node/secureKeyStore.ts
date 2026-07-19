/**
 * SecureKeyStore — Abstraction for provider API key storage.
 * ----------------------------------------------------------------
 * THREAT MODEL:
 *   Provider API keys (GOMI_CLOUD_LLM_API_KEY, GOMI_EMBEDDINGS_API_KEY, etc.)
 *   must never be written to plain JSON, localStorage, or world-readable
 *   files. In the Electron desktop build, keys are encrypted via OS-level
 *   safeStorage / keychain. In the web prototype, keys are kept only in
 *   environment variables with an in-memory fallback that logs warnings.
 *
 * IMPLEMENTATIONS:
 *   1. ElectronSafeStorageKeyStore — Electron safeStorage (encrypted OS store)
 *   2. MemoryKeyStore — In-memory only, for web prototype (warns on plaintext)
 *   3. EnvironmentKeyStore — Reads from process.env (existing behavior, no storage)
 *
 * USAGE:
 *   const store = createSecureKeyStore();
 *   await store.setKey('gomi-cloud-llm', 'sk-abc123');
 *   const key = await store.getKey('gomi-cloud-llm');
 *   await store.deleteKey('gomi-cloud-llm');
 *
 * The key store is initialized once during app startup and injected into
 * providers. Providers never read raw keys from settings or env directly.
 */

// ────────────────────────────────────────────────
//  Interface
// ────────────────────────────────────────────────

export interface SecureKeyStore {
  /** Retrieve a stored key. Returns undefined if not found. */
  getKey(providerId: string): Promise<string | undefined>;

  /** Store a key securely. Overwrites existing key for the same providerId. */
  setKey(providerId: string, key: string): Promise<void>;

  /** Delete a stored key. No-op if the key does not exist. */
  deleteKey(providerId: string): Promise<void>;

  /** List all stored provider IDs (for migration/admin). */
  listProviders(): Promise<string[]>;

  /** Human-readable name for diagnostics. */
  readonly name: string;

  /** Whether this store actually encrypts at rest. */
  readonly isEncrypted: boolean;
}

// ────────────────────────────────────────────────
//  Implementation 1: Electron safeStorage
// ────────────────────────────────────────────────

export class ElectronSafeStorageKeyStore implements SecureKeyStore {
  readonly name = 'electron-safeStorage';
  readonly isEncrypted = true;

  private safeStorage: typeof import('electron').safeStorage | null = null;

  constructor() {
    try {
      // Dynamic require to avoid bundling electron in web prototype
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const electron = require('electron');
      if (electron?.safeStorage?.isEncryptionAvailable()) {
        this.safeStorage = electron.safeStorage;
      }
    } catch {
      // Not running in Electron — fall through to error handling
    }
  }

  async getKey(providerId: string): Promise<string | undefined> {
    if (!this.safeStorage) {
      throw new Error('safeStorage not available — not running in Electron or encryption unavailable');
    }

    const encrypted = localStorage.getItem(this.storageKey(providerId));
    if (!encrypted) return undefined;

    try {
      const buffer = Buffer.from(encrypted, 'base64');
      return this.safeStorage.decryptString(buffer);
    } catch {
      // Corrupted or old format — treat as missing
      return undefined;
    }
  }

  async setKey(providerId: string, key: string): Promise<void> {
    if (!this.safeStorage) {
      throw new Error('safeStorage not available');
    }

    const encrypted = this.safeStorage.encryptString(key);
    localStorage.setItem(this.storageKey(providerId), encrypted.toString('base64'));
  }

  async deleteKey(providerId: string): Promise<void> {
    localStorage.removeItem(this.storageKey(providerId));
  }

  async listProviders(): Promise<string[]> {
    const providers: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('gomi-secure-key:')) {
        providers.push(key.replace('gomi-secure-key:', ''));
      }
    }
    return providers;
  }

  private storageKey(providerId: string): string {
    return `gomi-secure-key:${providerId}`;
  }
}

// ────────────────────────────────────────────────
//  Implementation 2: In-memory (web prototype)
// ────────────────────────────────────────────────

export class MemoryKeyStore implements SecureKeyStore {
  readonly name = 'memory';
  readonly isEncrypted = false;

  private readonly store = new Map<string, string>();
  private warnedPlaintext = false;

  async getKey(providerId: string): Promise<string | undefined> {
    this.warnOnce();
    return this.store.get(providerId);
  }

  async setKey(providerId: string, key: string): Promise<void> {
    this.warnOnce();
    this.store.set(providerId, key);
  }

  async deleteKey(providerId: string): Promise<void> {
    this.store.delete(providerId);
  }

  async listProviders(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  private warnOnce(): void {
    if (!this.warnedPlaintext) {
      console.warn(
        '[Gomi] API keys stored in memory only (web prototype). ' +
        'In the packaged IDE, keys are encrypted via OS safeStorage.'
      );
      this.warnedPlaintext = true;
    }
  }
}

// ────────────────────────────────────────────────
//  Implementation 3: Environment-only (read-only)
// ────────────────────────────────────────────────

export class EnvironmentKeyStore implements SecureKeyStore {
  readonly name = 'environment';
  readonly isEncrypted = false;

  private readonly envMap: Record<string, string>;

  constructor(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>) {
    this.envMap = {};
    for (const [key, value] of Object.entries(env)) {
      if (value) this.envMap[key] = value;
    }
  }

  async getKey(providerId: string): Promise<string | undefined> {
    // Map provider IDs to known env var names
    const envVar = this.providerToEnv(providerId);
    return envVar ? this.envMap[envVar] : undefined;
  }

  async setKey(_providerId: string, _key: string): Promise<void> {
    throw new Error('EnvironmentKeyStore is read-only. Use ElectronSafeStorageKeyStore to persist keys.');
  }

  async deleteKey(_providerId: string): Promise<void> {
    // No-op: env vars cannot be deleted at runtime
  }

  async listProviders(): Promise<string[]> {
    const providers: string[] = [];
    for (const envVar of Object.keys(this.envMap)) {
      const id = this.envToProvider(envVar);
      if (id) providers.push(id);
    }
    return providers;
  }

  private providerToEnv(providerId: string): string | undefined {
    const mapping: Record<string, string> = {
      'gomi-cloud-llm': 'GOMI_CLOUD_LLM_API_KEY',
      'gomi-embeddings': 'GOMI_EMBEDDINGS_API_KEY',
    };
    return mapping[providerId];
  }

  private envToProvider(envVar: string): string | undefined {
    const mapping: Record<string, string> = {
      'GOMI_CLOUD_LLM_API_KEY': 'gomi-cloud-llm',
      'GOMI_EMBEDDINGS_API_KEY': 'gomi-embeddings',
    };
    return mapping[envVar];
  }
}

// ────────────────────────────────────────────────
//  Composite store: cascading lookup
// ────────────────────────────────────────────────

/**
 * Tries multiple stores in order. getKey() returns the first non-undefined
 * result. setKey()/deleteKey() apply to the first writable store.
 */
export class CompositeKeyStore implements SecureKeyStore {
  readonly name: string;
  readonly isEncrypted: boolean;

  constructor(private readonly stores: SecureKeyStore[]) {
    this.name = stores.map((s) => s.name).join('+');
    this.isEncrypted = stores.some((s) => s.isEncrypted);
  }

  async getKey(providerId: string): Promise<string | undefined> {
    for (const store of this.stores) {
      try {
        const key = await store.getKey(providerId);
        if (key !== undefined) return key;
      } catch {
        // Continue to next store
      }
    }
    return undefined;
  }

  async setKey(providerId: string, key: string): Promise<void> {
    const writable = this.stores.find((s) => s.name !== 'environment');
    if (!writable) throw new Error('No writable key store available');
    await writable.setKey(providerId, key);
  }

  async deleteKey(providerId: string): Promise<void> {
    for (const store of this.stores) {
      try { await store.deleteKey(providerId); } catch { /* continue */ }
    }
  }

  async listProviders(): Promise<string[]> {
    const all = new Set<string>();
    for (const store of this.stores) {
      try {
        for (const p of await store.listProviders()) all.add(p);
      } catch { /* skip */ }
    }
    return Array.from(all);
  }
}

// ────────────────────────────────────────────────
//  Migration helper
// ────────────────────────────────────────────────

export interface MigrationResult {
  migrated: string[];
  cleared: string[];
  errors: string[];
}

/**
 * Scan office settings for plaintext API keys and migrate them to the
 * secure key store. Clears plain values after successful migration.
 */
export async function migratePlaintextKeys(
  store: SecureKeyStore,
  settings: {
    providers?: Array<{ id: string; apiKey?: string }>;
    embeddingProvider?: { id: string; apiKey?: string };
  }
): Promise<MigrationResult> {
  const result: MigrationResult = { migrated: [], cleared: [], errors: [] };

  const candidates: Array<{ providerId: string; key: string }> = [];

  for (const provider of settings.providers ?? []) {
    if (provider.apiKey) {
      candidates.push({ providerId: `provider:${provider.id}`, key: provider.apiKey });
    }
  }

  if (settings.embeddingProvider?.apiKey) {
    candidates.push({
      providerId: 'gomi-embeddings',
      key: settings.embeddingProvider.apiKey,
    });
  }

  for (const { providerId, key } of candidates) {
    try {
      await store.setKey(providerId, key);
      result.migrated.push(providerId);
    } catch (err) {
      result.errors.push(`${providerId}: ${(err as Error).message}`);
    }
  }

  // Clear plaintext values from settings object
  for (const provider of settings.providers ?? []) {
    if (provider.apiKey && result.migrated.includes(`provider:${provider.id}`)) {
      delete provider.apiKey;
      result.cleared.push(`provider:${provider.id}`);
    }
  }

  if (settings.embeddingProvider?.apiKey && result.migrated.includes('gomi-embeddings')) {
    delete settings.embeddingProvider.apiKey;
    result.cleared.push('gomi-embeddings');
  }

  return result;
}

// ────────────────────────────────────────────────
//  Factory
// ────────────────────────────────────────────────

export function createSecureKeyStore(): SecureKeyStore {
  // Try Electron safeStorage first
  try {
    // Dynamic require to avoid bundling electron in web prototype
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    if (electron?.safeStorage?.isEncryptionAvailable()) {
      return new ElectronSafeStorageKeyStore();
    }
  } catch {
    // Electron not available — fall through
  }

  // Memory fallback for web prototype
  const memory = new MemoryKeyStore();

  // Also try environment variables
  const env = new EnvironmentKeyStore();

  return new CompositeKeyStore([memory, env]);
}
