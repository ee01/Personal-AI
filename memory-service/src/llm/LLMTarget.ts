export const LLM_PROVIDERS = [
  'openai',
  'claude',
  'groq',
  'ollama',
  'dify',
] as const;

/** Anthropic OpenAI-compatible chat completions endpoint. No base URL needed. */
export const CLAUDE_CHAT_COMPLETIONS_URL =
  'https://api.anthropic.com/v1/chat/completions';

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';
export type LLMProviderName = (typeof LLM_PROVIDERS)[number];

export interface LLMTargetSpec {
  provider: LLMProviderName;
  model: string;
}

export interface ResolvedLLMTarget extends LLMTargetSpec {
  id: string;
  apiKey: string;
  baseUrl: string;
  difyAppMode?: 'chat' | 'completion';
}

export interface LLMTargetCredentialContext {
  openaiApiKey: string;
  openaiApiBaseUrl: string;
  openaiModel: string;
  claudeApiKey: string;
  claudeModel: string;
  groqApiKey: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
  difyApiKey: string;
  difyApiUrl: string;
  difyAppMode: 'chat' | 'completion';
}

export function isLLMProviderName(value: string): value is LLMProviderName {
  return (LLM_PROVIDERS as readonly string[]).includes(value);
}

export function targetId(provider: string, model: string): string {
  return `${provider}/${model}`;
}

export function defaultModelForProvider(
  provider: LLMProviderName,
  ctx: LLMTargetCredentialContext,
): string {
  if (provider === 'ollama') return ctx.ollamaModel || 'llama3';
  if (provider === 'dify') return ctx.openaiModel || 'dify';
  if (provider === 'claude') {
    return ctx.claudeModel || DEFAULT_CLAUDE_MODEL;
  }
  return ctx.openaiModel || 'gpt-4o-mini';
}

export function hasCredentials(
  provider: LLMProviderName,
  ctx: LLMTargetCredentialContext,
): boolean {
  switch (provider) {
    case 'openai':
      return Boolean(ctx.openaiApiKey);
    case 'claude':
      return Boolean(ctx.claudeApiKey);
    case 'groq':
      return Boolean(ctx.groqApiKey);
    case 'dify':
      return Boolean(ctx.difyApiKey);
    case 'ollama':
      return Boolean(ctx.ollamaBaseUrl);
    default:
      return false;
  }
}

export function resolveTarget(
  spec: LLMTargetSpec,
  ctx: LLMTargetCredentialContext,
  openaiChatCompletionsUrl: string,
  groqChatCompletionsUrl: string,
): ResolvedLLMTarget {
  const model = spec.model || defaultModelForProvider(spec.provider, ctx);
  switch (spec.provider) {
    case 'openai':
      return {
        provider: 'openai',
        model,
        id: targetId('openai', model),
        apiKey: ctx.openaiApiKey,
        baseUrl: openaiChatCompletionsUrl,
      };
    case 'claude':
      return {
        provider: 'claude',
        model,
        id: targetId('claude', model),
        apiKey: ctx.claudeApiKey,
        baseUrl: CLAUDE_CHAT_COMPLETIONS_URL,
      };
    case 'groq':
      return {
        provider: 'groq',
        model,
        id: targetId('groq', model),
        apiKey: ctx.groqApiKey,
        baseUrl: groqChatCompletionsUrl,
      };
    case 'ollama':
      return {
        provider: 'ollama',
        model,
        id: targetId('ollama', model),
        apiKey: '',
        baseUrl: ctx.ollamaBaseUrl,
      };
    case 'dify':
      return {
        provider: 'dify',
        model,
        id: targetId('dify', model),
        apiKey: ctx.difyApiKey,
        baseUrl: ctx.difyApiUrl,
        difyAppMode: ctx.difyAppMode,
      };
  }
}

/**
 * Parse `LLM_FALLBACKS` (`provider/model,provider/model`).
 * Invalid or uncredentialed entries are dropped with a warning.
 */
export function parseLLMFallbacks(
  raw: string | undefined,
  ctx: LLMTargetCredentialContext,
  primary: LLMTargetSpec,
  warn: (message: string) => void = console.warn,
): LLMTargetSpec[] {
  const trimmed = (raw || '').trim();
  if (!trimmed) return [];

  const specs: LLMTargetSpec[] = [];
  const seen = new Set<string>([targetId(primary.provider, primary.model)]);

  for (const item of trimmed.split(',')) {
    const token = item.trim();
    if (!token) continue;
    const slash = token.indexOf('/');
    const providerRaw = (slash === -1 ? token : token.slice(0, slash))
      .trim()
      .toLowerCase();
    const modelRaw = slash === -1 ? '' : token.slice(slash + 1).trim();

    if (!isLLMProviderName(providerRaw)) {
      warn(
        `[LLM] Ignoring fallback "${token}": unknown provider "${providerRaw}"`,
      );
      continue;
    }
    if (!hasCredentials(providerRaw, ctx)) {
      warn(
        `[LLM] Ignoring fallback "${token}": missing credentials for ${providerRaw}`,
      );
      continue;
    }

    const model = modelRaw || defaultModelForProvider(providerRaw, ctx);
    const id = targetId(providerRaw, model);
    if (seen.has(id)) {
      warn(`[LLM] Ignoring fallback "${token}": duplicate of ${id}`);
      continue;
    }
    seen.add(id);
    specs.push({ provider: providerRaw, model });
  }

  return specs;
}

export function primaryTargetSpec(
  llmProvider: string,
  ctx: LLMTargetCredentialContext,
): LLMTargetSpec {
  const provider = isLLMProviderName(llmProvider) ? llmProvider : 'openai';
  return {
    provider,
    model: defaultModelForProvider(provider, ctx),
  };
}
