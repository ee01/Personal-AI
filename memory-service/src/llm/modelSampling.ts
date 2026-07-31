/**
 * Sampling-parameter compatibility policy for `temperature` / `top_p` and the
 * token-limit field name.
 *
 * Reasoning models (OpenAI o1/o3/o4 and the gpt-5 family, Anthropic Claude
 * Opus 4.7+ and the Claude 5 family) reject non-default sampling values:
 *
 *   Unsupported value: 'temperature' does not support 0.3 with this model.
 *   Only the default (1) value is supported.
 *
 * Vendors disagree on whether sending the default is acceptable (Anthropic
 * rejects on field presence), so the only safe behaviour is to omit
 * `temperature` / `top_p` entirely for those models and steer output with
 * `reasoning_effort` / prompting instead.
 *
 * The extension build tree carries an equivalent copy at `src/modelSampling.ts`;
 * keep the two in sync.
 */

/**
 * Temperature presets keyed by task shape. Callers should pick a scenario
 * rather than hardcoding a number, so re-baselining only touches this table.
 */
export const SCENARIO_TEMPERATURE = {
  /** OCR, entity/field extraction, classification — must be reproducible */
  extraction: 0.1,
  /** Judgements, scoring, structured analysis, JSON output */
  analysis: 0.2,
  /** Summaries, digests, retrieval answers (default tier) */
  summary: 0.3,
  /** Reply drafts, suggestion copy, rewrites */
  drafting: 0.5,
  /** Multi-turn conversation, open-ended Q&A */
  conversation: 0.7,
  /** Divergent ideation, generative replay, deliberate variety */
  creative: 0.9,
} as const;

export type LLMScenario = keyof typeof SCENARIO_TEMPERATURE;

/** Default tier, matching the historical hardcoded 0.3. */
export const DEFAULT_SCENARIO: LLMScenario = 'summary';

/** Model families that reject non-default sampling parameters. */
const SAMPLING_LOCKED_PATTERNS: RegExp[] = [
  // OpenAI o-series: o1 / o1-mini / o3 / o3-mini / o3-pro / o4-mini ...
  /^o[134](?:[-.]|$)/,
  // OpenAI gpt-5 / gpt-5-mini / gpt-5-nano / gpt-5.1 ...
  /^gpt-5(?:[-.]|$)/,
  // Anthropic dropped temperature / top_p / top_k starting with Opus 4.7
  /^claude-opus-4-[7-9](?:[-.]|$)/,
  // Claude 5 family and later (opus / sonnet / haiku / fable / mythos ...)
  /^claude-[a-z]+-(?:[5-9]|\d{2,})(?:[-.]|$)/,
];

/** Names inside a locked family that still accept sampling params. */
const SAMPLING_EXEMPT_PATTERNS: RegExp[] = [/^gpt-5(?:\.\d+)?-chat/];

/** OpenAI reasoning families that only accept `max_completion_tokens`. */
const OPENAI_REASONING_PATTERNS: RegExp[] = [
  /^o[134](?:[-.]|$)/,
  /^gpt-5(?:[-.]|$)/,
];

/**
 * Strip gateway/vendor prefixes so bare model names can be matched.
 *
 * `openai/o3-mini` -> `o3-mini`, `us.anthropic.claude-opus-4-7` ->
 * `claude-opus-4-7`, `vertex_ai/claude-opus-4-7@default` -> `claude-opus-4-7`.
 */
export function normalizeModelId(model: string): string {
  const raw = String(model || '').trim().toLowerCase();
  if (!raw) return '';
  return raw
    .replace(/^[a-z0-9_+-]+\//, '')
    .replace(/^(?:global|us|eu|au|apac)\./, '')
    .replace(/^(?:anthropic|openai)\./, '')
    .replace(/@.*$/, '');
}

/** Whether the model accepts custom `temperature` / `top_p`. */
export function supportsCustomSampling(model: string): boolean {
  const id = normalizeModelId(model);
  if (!id) return true;
  if (SAMPLING_EXEMPT_PATTERNS.some((re) => re.test(id))) return true;
  return !SAMPLING_LOCKED_PATTERNS.some((re) => re.test(id));
}

/** Whether the model is an OpenAI reasoning model needing `max_completion_tokens`. */
export function isOpenAIReasoningModel(model: string): boolean {
  const id = normalizeModelId(model);
  if (!id) return false;
  if (SAMPLING_EXEMPT_PATTERNS.some((re) => re.test(id))) return false;
  return OPENAI_REASONING_PATTERNS.some((re) => re.test(id));
}

/**
 * Temperature to use for this call, or `undefined` when it must not be sent.
 */
export function resolveTemperature(
  model: string,
  options?: { temperature?: number; scenario?: LLMScenario },
): number | undefined {
  if (!supportsCustomSampling(model)) return undefined;
  const explicit = options?.temperature;
  if (typeof explicit === 'number' && Number.isFinite(explicit)) return explicit;
  return SCENARIO_TEMPERATURE[options?.scenario ?? DEFAULT_SCENARIO];
}

/**
 * Sampling fields ready to spread into a chat/completions body. Returns an
 * empty object for locked models so callers need no branching.
 */
export function buildSamplingPayload(
  model: string,
  options?: { temperature?: number; topP?: number; scenario?: LLMScenario },
): { temperature?: number; top_p?: number } {
  const temperature = resolveTemperature(model, options);
  if (temperature === undefined) return {};
  const payload: { temperature: number; top_p?: number } = { temperature };
  if (typeof options?.topP === 'number' && Number.isFinite(options.topP)) {
    payload.top_p = options.topP;
  }
  return payload;
}

/** Token-limit field: OpenAI reasoning models only accept `max_completion_tokens`. */
export function buildTokenLimitPayload(
  model: string,
  maxTokens?: number,
): { max_tokens?: number; max_completion_tokens?: number } {
  if (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens)) return {};
  return isOpenAIReasoningModel(model)
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
}
