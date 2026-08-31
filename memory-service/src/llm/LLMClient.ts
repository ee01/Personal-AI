/**
 * Unified LLM client supporting multiple providers.
 *
 * Providers:
 *   - openai   : OpenAI Chat Completions API
 *   - claude   : Anthropic Claude (no base URL; uses api.anthropic.com)
 *   - groq     : Groq (OpenAI-compatible) API
 *   - ollama   : Local Ollama instance
 *   - dify     : Dify chat-messages API
 *
 * Optional ordered fallback is configured via `LLM_FALLBACKS`.
 * Uses native fetch — no external SDKs required.
 */

import type { Config } from '../config.js';
import { getConfig } from '../config.js';
import { recordLlmUsage } from '../analytics/UsageRecorder.js';
import {
  buildSamplingPayload,
  buildTokenLimitPayload,
  resolveTemperature,
  SCENARIO_TEMPERATURE,
  type LLMScenario,
} from './modelSampling.js';
import {
  classifyLLMError,
  LLMAllTargetsFailedError,
  shouldRetrySameTarget,
  type LLMTargetFailure,
} from './llmErrors.js';
import {
  primaryTargetSpec,
  resolveTarget,
  type LLMTargetCredentialContext,
  type ResolvedLLMTarget,
} from './LLMTarget.js';
import { TargetHealthTracker } from './TargetHealthTracker.js';

export { LLMAllTargetsFailedError } from './llmErrors.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LLMOptions {
  /** Task shape driving the temperature tier; an explicit temperature wins. */
  scenario?: LLMScenario;
  temperature?: number;   // default 0.3 (SCENARIO_TEMPERATURE.summary)
  maxTokens?: number;     // default 2000
  systemPrompt?: string;
  timeoutMs?: number;
  retryCount?: number;
  reasoningEffort?: 'none' | 'minimal' | 'low' | 'medium' | 'high';
}

export interface LLMResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export type LLMStreamDeltaHandler = (delta: string) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TEMPERATURE = SCENARIO_TEMPERATURE.summary;
const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
const MIN_REQUEST_TIMEOUT_MS = 1000;
const RETRY_COUNT = 1;
const RETRY_DELAY_MS = 1000;

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ---------------------------------------------------------------------------
// LLMClient
// ---------------------------------------------------------------------------

export class LLMClient {
  private config: Readonly<Config>;
  private readonly healthTracker: TargetHealthTracker;

  constructor(config: Readonly<Config>) {
    this.config = config;
    this.healthTracker = new TargetHealthTracker(
      config.llmFallbackFailureThreshold,
      config.llmFallbackCooldownMs,
      config.llmFallbacks.length > 0,
    );
  }

  getTargetHealthSnapshot() {
    return this.healthTracker.snapshot(this.resolveTargetChain());
  }

  // ---- Public API ---------------------------------------------------------

  /**
   * Send a prompt to the configured LLM and return the text response.
   */
  async generate(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    return this.runWithFallback(prompt, options, (target) =>
      this.withRetryForTarget(
        target,
        () => this.callTarget(target, prompt, options),
        options,
        prompt,
      ),
    );
  }

  /**
   * Best-effort token estimate when the provider omits usage metadata.
   * Roughly ~4 chars/token for Latin; CJK often denser so we use ~2.
   */
  private estimateTokensFromText(text: string): number {
    const trimmed = (text || '').trim();
    if (!trimmed) return 0;
    const cjk = (trimmed.match(/[\u3400-\u9fff]/g) || []).length;
    const other = Math.max(0, trimmed.length - cjk);
    return Math.max(1, Math.ceil(cjk / 2 + other / 4));
  }

  /**
   * Record backend LLM token usage for analytics (best-effort). Attribution
   * (user + capability) is read from the current async usage context.
   * When the provider omits usage, fall back to a content-length estimate so
   * streaming / incomplete-usage calls still appear in the report — flagged
   * `tokensEstimated` so the estimate share is queryable (B7).
   */
  private recordBackendUsage(
    response: LLMResponse,
    prompt: string | undefined,
    target: ResolvedLLMTarget,
  ): void {
    let promptTokens = response.usage?.promptTokens ?? 0;
    let completionTokens = response.usage?.completionTokens ?? 0;
    let tokensEstimated = false;
    if (!response.usage || (promptTokens === 0 && completionTokens === 0)) {
      promptTokens = this.estimateTokensFromText(prompt ?? '');
      completionTokens = this.estimateTokensFromText(response.content ?? '');
      if (promptTokens === 0 && completionTokens === 0) return;
      tokensEstimated = true;
    }
    recordLlmUsage({
      side: 'backend',
      model: target.model,
      provider: target.provider,
      promptTokens,
      completionTokens,
      meta: tokensEstimated ? { tokensEstimated: true } : null,
    });
  }

  /**
   * Record a failed backend LLM call (best-effort).
   *
   * Historically this always recorded 0 tokens, which is wrong whenever the
   * provider actually generated (and billed) content before the failure:
   *  - B4: generateJSON's JSON.parse fails on a successful, billed response —
   *    pass `usage`/`response` so the real (or estimated) tokens are kept.
   *  - B5: a retried-but-not-final attempt is invisible without this — pass
   *    `attempt`/`willRetry` from withRetryForTarget.
   *  - B6: a client-side request timeout doesn't mean the provider stopped
   *    generating — when no usage is known, estimate promptTokens from the
   *    prompt that was actually sent and flag `billedEstimate`.
   *  - B9: `errorText` keeps the first 200 chars of the provider's error body
   *    so failures like a sudden run of bad_request are diagnosable without
   *    re-deploying a logging change.
   */
  private recordBackendFailure(
    error: unknown,
    target: ResolvedLLMTarget,
    opts?: {
      prompt?: string;
      usage?: { promptTokens: number; completionTokens: number };
      tokensEstimated?: boolean;
      attempt?: number;
      willRetry?: boolean;
    },
  ): void {
    const errorKind = classifyLLMError(error);
    const errorText = (error instanceof Error ? error.message : String(error)).slice(0, 200);

    let promptTokens = opts?.usage?.promptTokens ?? 0;
    let completionTokens = opts?.usage?.completionTokens ?? 0;
    let billedEstimate = false;
    if (
      promptTokens === 0 &&
      completionTokens === 0 &&
      errorKind === 'timeout' &&
      opts?.prompt
    ) {
      promptTokens = this.estimateTokensFromText(opts.prompt);
      billedEstimate = promptTokens > 0;
    }

    recordLlmUsage({
      side: 'backend',
      model: target.model,
      provider: target.provider,
      promptTokens,
      completionTokens,
      status: 'error',
      errorKind,
      meta: {
        errorText,
        ...(opts?.tokensEstimated ? { tokensEstimated: true } : {}),
        ...(billedEstimate ? { billedEstimate: true } : {}),
        ...(opts?.attempt !== undefined
          ? { attempt: opts.attempt, willRetry: Boolean(opts?.willRetry) }
          : {}),
      },
    });
  }

  /**
   * Send a prompt to the configured LLM and stream the text response.
   * Falls back to blocking generation + paced replay when native streaming is unavailable.
   */
  async generateStream(
    prompt: string,
    options: LLMOptions | undefined,
    onDelta: LLMStreamDeltaHandler,
  ): Promise<LLMResponse> {
    const targets = this.getOrderedTargets();
    const failures: LLMTargetFailure[] = [];
    const hasFallback = this.config.llmFallbacks.length > 0;

    for (const target of targets) {
      let emitted = false;
      const wrappedOnDelta: LLMStreamDeltaHandler = async (delta) => {
        if (delta) emitted = true;
        await onDelta(delta);
      };
      try {
        const response = await this.callTargetStream(
          target,
          prompt,
          options,
          wrappedOnDelta,
        );
        this.recordBackendUsage(response, prompt, target);
        this.healthTracker.recordSuccess(target.id);
        this.logFailover(failures, target);
        return response;
      } catch (error) {
        this.recordBackendFailure(error, target, { prompt });
        if (emitted) throw error;
        const kind = classifyLLMError(error);
        this.healthTracker.recordFailure(target.id, kind);
        failures.push(this.toFailure(target, error, kind));
        if (!hasFallback) throw error;
      }
    }

    throw new LLMAllTargetsFailedError(failures);
  }

  /**
   * Send a prompt to the configured LLM and parse the response as JSON.
   * Handles responses wrapped in markdown code blocks (```json ... ```).
   */
  async generateJSON<T>(prompt: string, options?: LLMOptions): Promise<T> {
    if (!this.config.llmFallbackOnJsonParse) {
      const response = await this.generate(prompt, options);
      return this.parseJSON<T>(response.content);
    }

    const targets = this.getOrderedTargets();
    const failures: LLMTargetFailure[] = [];

    for (const target of targets) {
      try {
        const response = await this.withRetryForTarget(
          target,
          () => this.callTarget(target, prompt, options),
          options,
          prompt,
        );
        try {
          const parsed = this.parseJSON<T>(response.content);
          this.recordBackendUsage(response, prompt, target);
          this.healthTracker.recordSuccess(target.id);
          this.logFailover(failures, target);
          return parsed;
        } catch (parseError) {
          // B4: the call succeeded and was billed — only the JSON.parse
          // failed — so record the real (or best-effort estimated) usage
          // instead of the 0-token default.
          const usage =
            response.usage ?? {
              promptTokens: this.estimateTokensFromText(prompt),
              completionTokens: this.estimateTokensFromText(response.content ?? ''),
            };
          this.recordBackendFailure(parseError, target, {
            usage,
            tokensEstimated: !response.usage,
          });
          this.healthTracker.recordFailure(target.id, 'unknown');
          failures.push(this.toFailure(target, parseError, 'unknown'));
        }
      } catch (error) {
        this.recordBackendFailure(error, target, { prompt });
        const kind = classifyLLMError(error);
        this.healthTracker.recordFailure(target.id, kind);
        failures.push(this.toFailure(target, error, kind));
      }
    }

    throw new LLMAllTargetsFailedError(failures);
  }

  private async runWithFallback(
    prompt: string,
    options: LLMOptions | undefined,
    invoke: (target: ResolvedLLMTarget) => Promise<LLMResponse>,
  ): Promise<LLMResponse> {
    const targets = this.getOrderedTargets();
    const failures: LLMTargetFailure[] = [];
    const hasFallback = this.config.llmFallbacks.length > 0;

    for (const target of targets) {
      try {
        const response = await invoke(target);
        this.recordBackendUsage(response, prompt, target);
        this.healthTracker.recordSuccess(target.id);
        this.logFailover(failures, target);
        return response;
      } catch (error) {
        this.recordBackendFailure(error, target, { prompt });
        const kind = classifyLLMError(error);
        this.healthTracker.recordFailure(target.id, kind);
        failures.push(this.toFailure(target, error, kind));
        if (!hasFallback) throw error;
      }
    }

    throw new LLMAllTargetsFailedError(failures);
  }

  private credentialContext(): LLMTargetCredentialContext {
    return {
      openaiApiKey: this.config.openaiApiKey,
      openaiApiBaseUrl: this.config.openaiApiBaseUrl,
      openaiModel: this.config.openaiModel,
      claudeApiKey: this.config.claudeApiKey,
      claudeModel: this.config.claudeModel,
      groqApiKey: this.config.groqApiKey,
      ollamaBaseUrl: this.config.ollamaBaseUrl,
      ollamaModel: this.config.ollamaModel,
      difyApiKey: this.config.difyApiKey,
      difyApiUrl: this.config.difyApiUrl,
      difyAppMode: this.config.difyAppMode,
    };
  }

  private resolveTargetChain(): ResolvedLLMTarget[] {
    const ctx = this.credentialContext();
    const primarySpec = primaryTargetSpec(this.config.llmProvider, ctx);
    const openaiUrl = this.getOpenAIChatCompletionsUrl();
    const primary = resolveTarget(primarySpec, ctx, openaiUrl, GROQ_BASE_URL);
    const fallbacks = this.config.llmFallbacks.map((spec) =>
      resolveTarget(spec, ctx, openaiUrl, GROQ_BASE_URL),
    );
    return [primary, ...fallbacks];
  }

  private getOrderedTargets(): ResolvedLLMTarget[] {
    return this.healthTracker.orderTargets(this.resolveTargetChain());
  }

  private async callTarget(
    target: ResolvedLLMTarget,
    prompt: string,
    options?: LLMOptions,
  ): Promise<LLMResponse> {
    switch (target.provider) {
      case 'openai':
      case 'claude':
      case 'groq':
        return this.callOpenAICompatible(
          target.baseUrl,
          target.apiKey,
          target.model,
          prompt,
          options,
        );
      case 'ollama':
        return this.callOllama(prompt, options, target);
      case 'dify':
        return this.callDify(prompt, options, target);
      default:
        throw new Error(`[LLMClient] Unsupported provider: ${target.provider}`);
    }
  }

  private async callTargetStream(
    target: ResolvedLLMTarget,
    prompt: string,
    options: LLMOptions | undefined,
    onDelta: LLMStreamDeltaHandler,
  ): Promise<LLMResponse> {
    switch (target.provider) {
      case 'openai':
      case 'claude':
      case 'groq':
        return this.callOpenAICompatibleStream(
          target.baseUrl,
          target.apiKey,
          target.model,
          prompt,
          options,
          onDelta,
        );
      case 'ollama':
        return this.callOllamaStream(prompt, options, onDelta, target);
      case 'dify':
        return this.callDifyStream(prompt, options, onDelta, target);
      default:
        return this.replayBlockingResponse(prompt, options, onDelta, target);
    }
  }

  private toFailure(
    target: ResolvedLLMTarget,
    error: unknown,
    kind: LLMTargetFailure['kind'],
  ): LLMTargetFailure {
    return {
      targetId: target.id,
      kind,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  private logFailover(
    failures: LLMTargetFailure[],
    target: ResolvedLLMTarget,
  ): void {
    if (!failures.length) return;
    const last = failures[failures.length - 1];
    console.warn(
      `[LLMClient] failover ${last.targetId} (${last.kind}) -> ${target.id}`,
    );
  }

  // ---- Provider implementations -------------------------------------------

  private getOpenAIChatCompletionsUrl(): string {
    return this.normalizeOpenAICompatibleChatUrl(
      this.config.openaiApiBaseUrl || OPENAI_BASE_URL,
    );
  }

  private normalizeOpenAICompatibleChatUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim().replace(/\/+$/, '');
    if (!trimmed) {
      return `${OPENAI_BASE_URL}/chat/completions`;
    }
    if (trimmed.endsWith('/chat/completions')) {
      return trimmed;
    }
    if (trimmed.endsWith('/v1')) {
      return `${trimmed}/chat/completions`;
    }
    return `${trimmed}/v1/chat/completions`;
  }

  private buildOpenAICompatibleHeaders(
    baseUrl: string,
    apiKey: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    };
    if (/api\.anthropic\.com/i.test(baseUrl)) {
      headers['anthropic-version'] = '2023-06-01';
    }
    return headers;
  }

  /**
   * Call an OpenAI-compatible chat completions endpoint (OpenAI / Claude / Groq).
   */
  private async callOpenAICompatible(
    baseUrl: string,
    apiKey: string,
    model: string,
    prompt: string,
    options?: LLMOptions,
  ): Promise<LLMResponse> {
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    return this.withRequestTimeout(options, async (signal) => {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: this.buildOpenAICompatibleHeaders(baseUrl, apiKey),
        body: JSON.stringify({
          model,
          messages,
          ...buildSamplingPayload(model, options),
          ...buildTokenLimitPayload(model, maxTokens),
          ...(options?.reasoningEffort && /^gpt-5(?:\.|-|$)/i.test(model)
            ? { reasoning_effort: options.reasoningEffort }
            : {}),
        }),
        signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`[LLMClient] OpenAI-compatible API error ${res.status}: ${body}`);
      }

      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const content = data.choices?.[0]?.message?.content ?? '';
      const usage = data.usage
        ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
        : undefined;

      return { content, usage };
    });
  }

  private async callOpenAICompatibleStream(
    baseUrl: string,
    apiKey: string,
    model: string,
    prompt: string,
    options: LLMOptions | undefined,
    onDelta: LLMStreamDeltaHandler,
  ): Promise<LLMResponse> {
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const messages = this.buildMessages(prompt, options);

    return this.withRequestTimeout(options, async (signal) => {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: this.buildOpenAICompatibleHeaders(baseUrl, apiKey),
        body: JSON.stringify({
          model,
          messages,
          ...buildSamplingPayload(model, options),
          ...buildTokenLimitPayload(model, maxTokens),
          stream: true,
          stream_options: {
            include_usage: true,
          },
        }),
        signal,
      });

      if (!res.ok || !res.body) {
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`[LLMClient] OpenAI-compatible streaming error ${res.status}: ${body}`);
        }
        return this.replayBlockingResponse(prompt, options, onDelta);
      }

      let content = '';
      let usage;

      await this.consumeSseStream(res, async ({ data }) => {
        if (!data || data === '[DONE]') return;

        const payload = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        const delta = payload.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          content += delta;
          await onDelta(delta);
        }

        if (payload.usage) {
          usage = {
            promptTokens: payload.usage.prompt_tokens,
            completionTokens: payload.usage.completion_tokens,
          };
        }
      });

      return { content, usage };
    });
  }

  /**
   * Call a local Ollama instance via /api/chat.
   */
  private async callOllama(
    prompt: string,
    options?: LLMOptions,
    target?: ResolvedLLMTarget,
  ): Promise<LLMResponse> {
    const url = `${target?.baseUrl || this.config.ollamaBaseUrl}/api/chat`;
    const model = target?.model || this.config.ollamaModel;
    const temperature = resolveTemperature(model, options) ?? DEFAULT_TEMPERATURE;

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    return this.withRequestTimeout(options, async (signal) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: { temperature },
        }),
        signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`[LLMClient] Ollama API error ${res.status}: ${body}`);
      }

      const data = (await res.json()) as {
        message?: { content: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };

      const content = data.message?.content ?? '';
      const usage =
        data.prompt_eval_count != null && data.eval_count != null
          ? { promptTokens: data.prompt_eval_count, completionTokens: data.eval_count }
          : undefined;

      return { content, usage };
    });
  }

  private async callOllamaStream(
    prompt: string,
    options: LLMOptions | undefined,
    onDelta: LLMStreamDeltaHandler,
    target?: ResolvedLLMTarget,
  ): Promise<LLMResponse> {
    const url = `${target?.baseUrl || this.config.ollamaBaseUrl}/api/chat`;
    const model = target?.model || this.config.ollamaModel;
    const temperature = resolveTemperature(model, options) ?? DEFAULT_TEMPERATURE;
    const messages = this.buildMessages(prompt, options);

    return this.withRequestTimeout(options, async (signal) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
          options: { temperature },
        }),
        signal,
      });

      if (!res.ok || !res.body) {
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(`[LLMClient] Ollama streaming error ${res.status}: ${body}`);
        }
        return this.replayBlockingResponse(prompt, options, onDelta);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';
      let usage;

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          const payload = JSON.parse(line) as {
            message?: { content?: string };
            prompt_eval_count?: number;
            eval_count?: number;
            done?: boolean;
          };
          const delta = payload.message?.content ?? '';
          if (delta) {
            content += delta;
            await onDelta(delta);
          }
          if (payload.prompt_eval_count != null && payload.eval_count != null) {
            usage = {
              promptTokens: payload.prompt_eval_count,
              completionTokens: payload.eval_count,
            };
          }
        }

        if (done) break;
      }

      if (buffer.trim()) {
        const payload = JSON.parse(buffer) as {
          message?: { content?: string };
          prompt_eval_count?: number;
          eval_count?: number;
        };
        const delta = payload.message?.content ?? '';
        if (delta) {
          content += delta;
          await onDelta(delta);
        }
        if (payload.prompt_eval_count != null && payload.eval_count != null) {
          usage = {
            promptTokens: payload.prompt_eval_count,
            completionTokens: payload.eval_count,
          };
        }
      }

      return { content, usage };
    });
  }

  /**
   * Call Dify API. Supports chat (conversational) and completion (text generation) app modes.
   */
  private async callDify(
    prompt: string,
    options?: LLMOptions,
    target?: ResolvedLLMTarget,
  ): Promise<LLMResponse> {
    const base = (target?.baseUrl || this.config.difyApiUrl).replace(/\/$/, '');
    const isV1Base = base.endsWith('/v1');
    const mode = target?.difyAppMode || this.config.difyAppMode;
    const path = mode === 'completion' ? 'completion-messages' : 'chat-messages';
    const url = isV1Base ? `${base}/${path}` : `${base}/v1/${path}`;
    const effectivePrompt = options?.systemPrompt
      ? `System instructions:\n${options.systemPrompt}\n\nUser request:\n${prompt}`
      : prompt;

    const body =
      mode === 'completion'
        ? { inputs: { query: effectivePrompt }, response_mode: 'blocking' as const, user: 'memory-service' }
        : { inputs: {}, query: effectivePrompt, response_mode: 'blocking' as const, user: 'memory-service' };

    return this.withRequestTimeout(options, async (signal) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${target?.apiKey || this.config.difyApiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`[LLMClient] Dify API error ${res.status} (${url}): ${body}`);
      }

      const data = (await res.json()) as {
        answer?: string;
        metadata?: { usage?: { prompt_tokens: number; completion_tokens: number } };
      };

      const content = data.answer ?? '';
      const usage = data.metadata?.usage
        ? { promptTokens: data.metadata.usage.prompt_tokens, completionTokens: data.metadata.usage.completion_tokens }
        : undefined;

      return { content, usage };
    });
  }

  private async callDifyStream(
    prompt: string,
    options: LLMOptions | undefined,
    onDelta: LLMStreamDeltaHandler,
    target?: ResolvedLLMTarget,
  ): Promise<LLMResponse> {
    const base = (target?.baseUrl || this.config.difyApiUrl).replace(/\/$/, '');
    const isV1Base = base.endsWith('/v1');
    const mode = target?.difyAppMode || this.config.difyAppMode;
    const path = mode === 'completion' ? 'completion-messages' : 'chat-messages';
    const url = isV1Base ? `${base}/${path}` : `${base}/v1/${path}`;
    const effectivePrompt = options?.systemPrompt
      ? `System instructions:\n${options.systemPrompt}\n\nUser request:\n${prompt}`
      : prompt;

    const body =
      mode === 'completion'
        ? { inputs: { query: effectivePrompt }, response_mode: 'streaming' as const, user: 'memory-service' }
        : { inputs: {}, query: effectivePrompt, response_mode: 'streaming' as const, user: 'memory-service' };

    return this.withRequestTimeout(options, async (signal) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${target?.apiKey || this.config.difyApiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok || !res.body) {
        if (!res.ok) {
          const bodyText = await res.text().catch(() => '');
          throw new Error(`[LLMClient] Dify streaming error ${res.status} (${url}): ${bodyText}`);
        }
        return this.replayBlockingResponse(prompt, options, onDelta);
      }

      let content = '';
      let usage;

      await this.consumeSseStream(res, async ({ data }) => {
        if (!data || data === '[DONE]') return;

        const payload = JSON.parse(data) as {
          answer?: string;
          event?: string;
          metadata?: { usage?: { prompt_tokens: number; completion_tokens: number } };
        };

        const nextText = typeof payload.answer === 'string' ? payload.answer : '';
        if (nextText) {
          const delta = this.resolveIncrementalText(nextText, content);
          if (delta) {
            content += delta;
            await onDelta(delta);
          }
        }

        if (payload.metadata?.usage) {
          usage = {
            promptTokens: payload.metadata.usage.prompt_tokens,
            completionTokens: payload.metadata.usage.completion_tokens,
          };
        }
      });

      return { content, usage };
    });
  }

  // ---- Helpers ------------------------------------------------------------

  /**
   * Retry an async operation once on failure with a 1 second delay.
   *
   * B5: an attempt that fails and gets retried was still sent to (and
   * possibly billed by) the provider, but previously only the *final*
   * attempt's failure was ever recorded — every retried attempt in between
   * was invisible to analytics. Record each retried attempt here (tagged
   * `attempt`/`willRetry: true`); the final, non-retried failure is left to
   * propagate and is recorded by the caller as before.
   */
  private async withRetryForTarget(
    target: ResolvedLLMTarget,
    fn: () => Promise<LLMResponse>,
    options?: LLMOptions,
    prompt?: string,
  ): Promise<LLMResponse> {
    const retryCount = this.getRetryCount(options);
    const hasFallback = this.config.llmFallbacks.length > 0;
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const kind = classifyLLMError(err);
        const canRetry =
          attempt < retryCount && (!hasFallback || shouldRetrySameTarget(kind));
        if (canRetry) {
          console.warn(
            `[LLMClient] Attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY_MS}ms:`,
            (err as Error).message,
          );
          this.recordBackendFailure(err, target, {
            prompt,
            attempt: attempt + 1,
            willRetry: true,
          });
          await this.delay(RETRY_DELAY_MS);
        } else {
          throw err;
        }
      }
    }

    throw new Error('[LLMClient] All retry attempts exhausted');
  }

  private getRetryCount(options?: LLMOptions): number {
    if (options?.retryCount === undefined) return RETRY_COUNT;
    if (!Number.isFinite(options.retryCount)) return RETRY_COUNT;
    return Math.max(0, Math.floor(options.retryCount));
  }

  private getRequestTimeoutMs(options?: LLMOptions): number {
    const raw = options?.timeoutMs ?? this.config.llmRequestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (!Number.isFinite(raw)) return DEFAULT_REQUEST_TIMEOUT_MS;
    return Math.max(MIN_REQUEST_TIMEOUT_MS, Math.floor(raw));
  }

  private async withRequestTimeout<T>(
    options: LLMOptions | undefined,
    fn: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const timeoutMs = this.getRequestTimeoutMs(options);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fn(controller.signal);
    } catch (err) {
      if (this.isAbortError(err)) {
        throw new Error(`[LLMClient] Request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private isAbortError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name?: unknown }).name === 'AbortError'
    );
  }

  /**
   * Parse a string as JSON, stripping markdown code-block wrappers if present.
   */
  private parseJSON<T>(text: string): T {
    let cleaned = text.trim();

    // Strip markdown code block fences (```json ... ``` or ``` ... ```)
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }

    try {
      return JSON.parse(cleaned) as T;
    } catch (err) {
      throw new Error(
        `[LLMClient] Failed to parse JSON response: ${(err as Error).message}\nRaw text: ${text.slice(0, 500)}`,
      );
    }
  }

  private buildMessages(prompt: string, options?: LLMOptions): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    return messages;
  }

  private async consumeSseStream(
    response: Response,
    onEvent: (event: { event: string; data: string }) => Promise<void> | void,
  ): Promise<void> {
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

      let delimiterIndex = buffer.search(/\r?\n\r?\n/);
      while (delimiterIndex >= 0) {
        const rawBlock = buffer.slice(0, delimiterIndex);
        const separatorLength = buffer[delimiterIndex] === '\r' ? 4 : 2;
        buffer = buffer.slice(delimiterIndex + separatorLength);
        const parsed = this.parseSseBlock(rawBlock);
        if (parsed) {
          await onEvent(parsed);
        }
        delimiterIndex = buffer.search(/\r?\n\r?\n/);
      }

      if (done) {
        const trailing = buffer.trim();
        if (trailing) {
          const parsed = this.parseSseBlock(trailing);
          if (parsed) {
            await onEvent(parsed);
          }
        }
        break;
      }
    }
  }

  private parseSseBlock(block: string): { event: string; data: string } | null {
    const lines = block.split(/\r?\n/);
    let event = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        event = line.slice(6).trim() || 'message';
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    const data = dataLines.join('\n');
    if (!data) return null;
    return { event, data };
  }

  private resolveIncrementalText(nextText: string, currentText: string): string {
    if (!currentText) return nextText;
    if (nextText.startsWith(currentText)) {
      return nextText.slice(currentText.length);
    }
    return nextText;
  }

  private async replayBlockingResponse(
    prompt: string,
    options: LLMOptions | undefined,
    onDelta: LLMStreamDeltaHandler,
    target?: ResolvedLLMTarget,
  ): Promise<LLMResponse> {
    const response = target
      ? await this.callTarget(target, prompt, options)
      : await this.generate(prompt, options);
    const chunks = response.content.match(/[\s\S]{1,24}/g) ?? [response.content];
    for (const chunk of chunks) {
      if (!chunk) continue;
      await onDelta(chunk);
      await this.delay(40);
    }
    return response;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: LLMClient | null = null;

/**
 * Get the singleton LLMClient instance, lazily created from config.
 */
export function getLLMClient(): LLMClient {
  if (!_instance) {
    _instance = new LLMClient(getConfig());
  }
  return _instance;
}
