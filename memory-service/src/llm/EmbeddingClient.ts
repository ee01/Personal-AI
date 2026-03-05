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

export class EmbeddingClient {
  private static instance: EmbeddingClient | null = null;

  private pipeline: Pipeline | null = null;
  private modelName: string;
  private loading: Promise<void> | null = null;
  private _loaded = false;

  private constructor() {
    this.modelName = getConfig().embeddingModel;
  }

  /**
   * Return (and lazily create) the singleton EmbeddingClient.
   * The first call triggers model loading; subsequent calls return immediately.
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
   * Return the model name configured for this client.
   */
  static getModelName(): string {
    return EmbeddingClient.instance?.modelName ?? getConfig().embeddingModel;
  }

  // ---- internal ----

  private async ensureLoaded(): Promise<void> {
    if (this._loaded) return;
    if (this.loading) {
      await this.loading;
      return;
    }

    this.loading = this.loadPipeline();
    await this.loading;
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
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[EmbeddingClient] Model loaded in ${elapsed}s`);
    } catch (err) {
      console.error('[EmbeddingClient] Failed to load model:', err);
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
