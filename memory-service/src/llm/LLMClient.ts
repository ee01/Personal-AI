/**
 * Unified LLM client supporting multiple providers.
 *
 * Providers:
 *   - openai   : OpenAI Chat Completions API
 *   - groq     : Groq (OpenAI-compatible) API
 *   - ollama   : Local Ollama instance
 *   - dify     : Dify chat-messages API
 *
 * Uses native fetch — no external SDKs required.
 */

import type { Config } from '../config.js';
import { getConfig } from '../config.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LLMOptions {
  temperature?: number;   // default 0.3
  maxTokens?: number;     // default 2000
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export type LLMStreamDeltaHandler = (delta: string) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOKENS = 2000;
const RETRY_COUNT = 1;
const RETRY_DELAY_MS = 1000;

const OPENAI_BASE_URL = 'https://api.openai.com/v1/chat/completions';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ---------------------------------------------------------------------------
// LLMClient
// ---------------------------------------------------------------------------

export class LLMClient {
  private config: Readonly<Config>;

  constructor(config: Readonly<Config>) {
    this.config = config;
  }

  // ---- Public API ---------------------------------------------------------

  /**
   * Send a prompt to the configured LLM and return the text response.
   */
  async generate(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    const provider = this.config.llmProvider;

    const attempt = async (): Promise<LLMResponse> => {
      switch (provider) {
        case 'openai':
          return this.callOpenAICompatible(OPENAI_BASE_URL, this.config.openaiApiKey, this.config.openaiModel, prompt, options);
        case 'groq':
          return this.callOpenAICompatible(GROQ_BASE_URL, this.config.groqApiKey, this.config.openaiModel, prompt, options);
        case 'ollama':
          return this.callOllama(prompt, options);
        case 'dify':
          return this.callDify(prompt, options);
        default:
          throw new Error(`[LLMClient] Unsupported provider: ${provider}`);
      }
    };

    return this.withRetry(attempt);
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
    const provider = this.config.llmProvider;

    switch (provider) {
      case 'openai':
        return this.callOpenAICompatibleStream(
          OPENAI_BASE_URL,
          this.config.openaiApiKey,
          this.config.openaiModel,
          prompt,
          options,
          onDelta,
        );
      case 'groq':
        return this.callOpenAICompatibleStream(
          GROQ_BASE_URL,
          this.config.groqApiKey,
          this.config.openaiModel,
          prompt,
          options,
          onDelta,
        );
      case 'ollama':
        return this.callOllamaStream(prompt, options, onDelta);
      case 'dify':
        return this.callDifyStream(prompt, options, onDelta);
      default:
        return this.replayBlockingResponse(prompt, options, onDelta);
    }
  }

  /**
   * Send a prompt to the configured LLM and parse the response as JSON.
   * Handles responses wrapped in markdown code blocks (```json ... ```).
   */
  async generateJSON<T>(prompt: string, options?: LLMOptions): Promise<T> {
    const response = await this.generate(prompt, options);
    return this.parseJSON<T>(response.content);
  }

  // ---- Provider implementations -------------------------------------------

  /**
   * Call an OpenAI-compatible chat completions endpoint (OpenAI / Groq).
   */
  private async callOpenAICompatible(
    baseUrl: string,
    apiKey: string,
    model: string,
    prompt: string,
    options?: LLMOptions,
  ): Promise<LLMResponse> {
    const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
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
  }

  private async callOpenAICompatibleStream(
    baseUrl: string,
    apiKey: string,
    model: string,
    prompt: string,
    options: LLMOptions | undefined,
    onDelta: LLMStreamDeltaHandler,
  ): Promise<LLMResponse> {
    const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;
    const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    const messages = this.buildMessages(prompt, options);

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        stream_options: {
          include_usage: true,
        },
      }),
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
  }

  /**
   * Call a local Ollama instance via /api/chat.
   */
  private async callOllama(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    const url = `${this.config.ollamaBaseUrl}/api/chat`;
    const model = this.config.ollamaModel;
    const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;

    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature },
      }),
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
  }

  private async callOllamaStream(
    prompt: string,
    options: LLMOptions | undefined,
    onDelta: LLMStreamDeltaHandler,
  ): Promise<LLMResponse> {
    const url = `${this.config.ollamaBaseUrl}/api/chat`;
    const model = this.config.ollamaModel;
    const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;
    const messages = this.buildMessages(prompt, options);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: { temperature },
      }),
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
  }

  /**
   * Call Dify API. Supports chat (conversational) and completion (text generation) app modes.
   */
  private async callDify(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    const base = this.config.difyApiUrl.replace(/\/$/, '');
    const isV1Base = base.endsWith('/v1');
    const mode = this.config.difyAppMode;
    const path = mode === 'completion' ? 'completion-messages' : 'chat-messages';
    const url = isV1Base ? `${base}/${path}` : `${base}/v1/${path}`;
    const effectivePrompt = options?.systemPrompt
      ? `System instructions:\n${options.systemPrompt}\n\nUser request:\n${prompt}`
      : prompt;

    const body =
      mode === 'completion'
        ? { inputs: { query: effectivePrompt }, response_mode: 'blocking' as const, user: 'memory-service' }
        : { inputs: {}, query: effectivePrompt, response_mode: 'blocking' as const, user: 'memory-service' };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.difyApiKey}`,
      },
      body: JSON.stringify(body),
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
  }

  private async callDifyStream(
    prompt: string,
    options: LLMOptions | undefined,
    onDelta: LLMStreamDeltaHandler,
  ): Promise<LLMResponse> {
    const base = this.config.difyApiUrl.replace(/\/$/, '');
    const isV1Base = base.endsWith('/v1');
    const mode = this.config.difyAppMode;
    const path = mode === 'completion' ? 'completion-messages' : 'chat-messages';
    const url = isV1Base ? `${base}/${path}` : `${base}/v1/${path}`;
    const effectivePrompt = options?.systemPrompt
      ? `System instructions:\n${options.systemPrompt}\n\nUser request:\n${prompt}`
      : prompt;

    const body =
      mode === 'completion'
        ? { inputs: { query: effectivePrompt }, response_mode: 'streaming' as const, user: 'memory-service' }
        : { inputs: {}, query: effectivePrompt, response_mode: 'streaming' as const, user: 'memory-service' };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.difyApiKey}`,
      },
      body: JSON.stringify(body),
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
  }

  // ---- Helpers ------------------------------------------------------------

  /**
   * Retry an async operation once on failure with a 1 second delay.
   */
  private async withRetry(fn: () => Promise<LLMResponse>): Promise<LLMResponse> {
    for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt < RETRY_COUNT) {
          console.warn(
            `[LLMClient] Attempt ${attempt + 1} failed, retrying in ${RETRY_DELAY_MS}ms:`,
            (err as Error).message,
          );
          await this.delay(RETRY_DELAY_MS);
        } else {
          throw err;
        }
      }
    }

    // Unreachable, but TypeScript requires it.
    throw new Error('[LLMClient] All retry attempts exhausted');
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
  ): Promise<LLMResponse> {
    const response = await this.generate(prompt, options);
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
