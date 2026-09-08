/**
 * Singleton embedding client backed by @xenova/transformers.
 *
 * The pipeline is lazy-loaded on first use so the server can start
 * serving health checks before the model weights are downloaded.
 */

import { getConfig } from '../config.js';

// The @xenova/transformers module is loaded dynamically to avoid
// blocking the import graph and to tolerate environments where
// native dependencies are missing.
type Pipeline = (texts: string | string[], options?: Record<string, unknown>) => Promise<{ tolist(): number[][] }>;

/** P0a-3 retry policy: backoff grows 5s→10s→20s… capped at 5 minutes. */
const EMBEDDING_RETRY_BACKOFF_CAP_MS = 5 * 60 * 1000;
/** Delay between bounded warmup attempts at server boot. */
const EMBEDDING_WARMUP_RETRY_DELAY_MS = 15 * 1000;

export class EmbeddingClient {
  private static instance: EmbeddingClient | null = null;

  private pipeline: Pipeline | null = null;
  private modelName: string;
  private loading: Promise<void> | null = null;
  private _loaded = false;

  // ---- P0a-3 readiness / retryable warmup state ----
  // A failed load must never be cached as permanently unavailable
  // (memory-foundation plan §9.6; the Supermemory provider-init race is the
  // external evidence). `this.loading` used to keep the rejected promise,
  // so every later getInstance() re-threw the same failure forever.
  private loadAttempts = 0;
  private lastLoadError: string | null = null;
  private nextRetryAtMs = 0;

  private constructor() {
    this.modelName = getConfig().embeddingModel;
  }

  /**
   * Return (and lazily create) the singleton EmbeddingClient.
   * The first call triggers model loading; a previously failed load is
   * retried after the exponential backoff window instead of being replayed
   * as a permanent failure.
   */
  static async getInstance(): Promise<EmbeddingClient> {
    if (!EmbeddingClient.instance) {
      EmbeddingClient.instance = new EmbeddingClient();
    }
    await EmbeddingClient.instance.ensureLoaded();
    return EmbeddingClient.instance;
  }

  /**
   * Check if the model has finished loading without triggering a load.
   */
  static isLoaded(): boolean {
    return EmbeddingClient.instance?._loaded ?? false;
  }

  /**
   * Readiness snapshot for health checks and diagnostics (P0a-3).
   * Never triggers a load; exposes the retry schedule so operators can see
   * whether the provider is loading, ready, or in backoff after a failure.
   */
  static readiness(): {
    loaded: boolean;
    loading: boolean;
    model: string;
    loadAttempts: number;
    lastError: string | null;
    nextRetryInMs: number;
  } {
    const inst = EmbeddingClient.instance;
    return {
      loaded: inst?._loaded ?? false,
      loading: inst?.loading != null && !inst._loaded,
      model: inst?.modelName ?? getConfig().embeddingModel,
      loadAttempts: inst?.loadAttempts ?? 0,
      lastError: inst?.lastLoadError ?? null,
      nextRetryInMs: inst ? Math.max(0, inst.nextRetryAtMs - Date.now()) : 0,
    };
  }

  /**
   * Return the model name configured for this client.
   */
  static getModelName(): string {
    return EmbeddingClient.instance?.modelName ?? getConfig().embeddingModel;
  }

  /**
   * Fire-and-forget startup warmup with a bounded number of retries
   * (P0a-3). Call once at server boot; failures keep the readiness state
   * honest and leave the backoff retry path in place for later callers.
   */
  static warmup(maxAttempts = 3): Promise<void> {
    const attempt = (remaining: number): Promise<void> =>
      EmbeddingClient.getInstance().then(
        () => undefined,
        (err) => {
          if (remaining <= 1) {
            console.error(
              '[EmbeddingClient] warmup failed after retries; vector channel stays degraded until next backoff retry:',
              err instanceof Error ? err.message : err,
            );
            return;
          }
          return new Promise<void>((resolve) =>
            setTimeout(resolve, EMBEDDING_WARMUP_RETRY_DELAY_MS),
          ).then(() => attempt(remaining - 1));
        },
      );
    return attempt(maxAttempts);
  }

  // ---- internal ----

  private async ensureLoaded(): Promise<void> {
    if (this._loaded) return;
    if (this.loading) {
      await this.loading;
      return;
    }
    // A previous load failed and we are still inside the backoff window:
    // surface the failure to this caller, but do NOT cache it as permanent.
    if (this.nextRetryAtMs > Date.now()) {
      throw new Error(
        `EmbeddingClient not ready (backoff ${Math.ceil((this.nextRetryAtMs - Date.now()) / 1000)}s); last error: ${this.lastLoadError ?? 'unknown'}`,
      );
    }

    this.loading = this.loadPipeline();
    try {
      await this.loading;
    } finally {
      // Always clear the in-flight promise so a failure can be retried
      // later instead of being replayed forever.
      this.loading = null;
    }
  }

  private async loadPipeline(): Promise<void> {
    const start = Date.now();
    console.log(`[EmbeddingClient] Loading model "${this.modelName}" ...`);

    try {
      // Dynamic import so the rest of the app can start even if
      // @xenova/transformers is not installed.
      const { pipeline } = await import('@xenova/transformers');
      this.pipeline = (await pipeline(
        'feature-extraction',
        this.modelName,
        { quantized: true },
      )) as unknown as Pipeline;

      this._loaded = true;
      this.loadAttempts = 0;
      this.lastLoadError = null;
      this.nextRetryAtMs = 0;
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[EmbeddingClient] Model loaded in ${elapsed}s`);
    } catch (err) {
      this.loadAttempts += 1;
      this.lastLoadError = err instanceof Error ? err.message : String(err);
      // Exponential backoff, capped, so callers stop hammering a broken
      // provider but a later call can still recover it.
      const delayMs = Math.min(
        5000 * 2 ** (this.loadAttempts - 1),
        EMBEDDING_RETRY_BACKOFF_CAP_MS,
      );
      this.nextRetryAtMs = Date.now() + delayMs;
      console.error(
        `[EmbeddingClient] Failed to load model (attempt ${this.loadAttempts}, next retry in ${Math.round(delayMs / 1000)}s):`,
        this.lastLoadError,
      );
      throw err;
    }
  }

  /**
   * Embed a single text string into a vector of numbers.
   */
  async embed(text: string): Promise<number[]> {
    if (!this.pipeline) {
      throw new Error('EmbeddingClient pipeline not loaded');
    }
    const output = await this.pipeline(text, {
      pooling: 'mean',
      normalize: true,
    });
    return output.tolist()[0];
  }

  /**
   * Embed multiple texts in a single call.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.pipeline) {
      throw new Error('EmbeddingClient pipeline not loaded');
    }
    const output = await this.pipeline(texts, {
      pooling: 'mean',
      normalize: true,
    });
    return output.tolist();
  }
}
