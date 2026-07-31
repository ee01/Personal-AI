/**
 * 采样参数（`temperature` / `top_p`）与 token 上限字段的模型兼容策略。
 *
 * 背景：推理型模型（OpenAI o1/o3/o4、gpt-5 系列，Anthropic Claude Opus 4.7+ /
 * Claude 5 家族）会拒绝非默认采样参数，例如：
 *
 *   Unsupported value: 'temperature' does not support 0.3 with this model.
 *   Only the default (1) value is supported.
 *
 * 由于「传默认值」在不同厂商/网关下判定不一致（Anthropic 是按字段是否出现判定），
 * 唯一稳妥做法是对这些模型**整体省略** `temperature` / `top_p`。
 * 想控制输出时改用 `reasoning_effort` / `verbosity` 或 prompt。
 *
 * 参考：
 * - https://community.openai.com/t/gpt-5-models-temperature/1337957
 * - https://community.openai.com/t/o3-mini-unsupported-parameter-temperature/1140846
 * - https://platform.claude.com/docs/en/about-claude/models/migration-guide
 *
 * memory-service 侧有一份等价实现：`memory-service/src/llm/modelSampling.ts`
 * （两个构建树互相不可见，改动需同步）。
 */

/**
 * 按任务性质划分的 temperature 预设。
 *
 * 低温用于「答案唯一、可校验」的任务，高温用于「需要多样性」的任务；
 * 调用方应选场景而不是随手写数字，这样换模型/调基线时只需改这一张表。
 */
export const SCENARIO_TEMPERATURE = {
  /** OCR、实体抽取、字段解析、分类打标：要求可复现 */
  extraction: 0.1,
  /** 判定、打分、结构化分析、JSON 输出 */
  analysis: 0.2,
  /** 摘要、要点归纳、检索问答（默认档） */
  summary: 0.3,
  /** 回复草稿、建议文案、改写 */
  drafting: 0.5,
  /** 多轮对话、开放问答 */
  conversation: 0.7,
  /** 发散联想、记忆重放、多样化生成 */
  creative: 0.9,
} as const;

export type LLMScenario = keyof typeof SCENARIO_TEMPERATURE;

/** 未标注场景时的默认档，对应历史上写死的 0.3。 */
export const DEFAULT_SCENARIO: LLMScenario = 'summary';

/** 拒绝非默认采样参数的模型族。 */
const SAMPLING_LOCKED_PATTERNS: RegExp[] = [
  // OpenAI o-series：o1 / o1-mini / o3 / o3-mini / o3-pro / o4-mini …
  /^o[134](?:[-.]|$)/,
  // OpenAI gpt-5 / gpt-5-mini / gpt-5-nano / gpt-5.1 …
  /^gpt-5(?:[-.]|$)/,
  // Anthropic Opus 4.7 起废弃 temperature / top_p / top_k
  /^claude-opus-4-[7-9](?:[-.]|$)/,
  // Claude 5 及以后的家族（opus / sonnet / haiku / fable / mythos …）
  /^claude-[a-z]+-(?:[5-9]|\d{2,})(?:[-.]|$)/,
];

/** 名字落在受限族里、但实际仍支持采样参数的例外（gpt-5 的 chat 变体）。 */
const SAMPLING_EXEMPT_PATTERNS: RegExp[] = [/^gpt-5(?:\.\d+)?-chat/];

/** 只接受 `max_completion_tokens` 的 OpenAI 推理模型族。 */
const OPENAI_REASONING_PATTERNS: RegExp[] = [
  /^o[134](?:[-.]|$)/,
  /^gpt-5(?:[-.]|$)/,
];

/**
 * 去掉网关/厂商前缀，便于用裸模型名匹配。
 *
 * 例：`openai/o3-mini` → `o3-mini`，`us.anthropic.claude-opus-4-7` →
 * `claude-opus-4-7`，`vertex_ai/claude-opus-4-7@default` → `claude-opus-4-7`。
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

/** 该模型是否接受自定义 `temperature` / `top_p`。 */
export function supportsCustomSampling(model: string): boolean {
  const id = normalizeModelId(model);
  if (!id) return true;
  if (SAMPLING_EXEMPT_PATTERNS.some((re) => re.test(id))) return true;
  return !SAMPLING_LOCKED_PATTERNS.some((re) => re.test(id));
}

/** 该模型是否属于 OpenAI 推理族（需要 `max_completion_tokens`）。 */
export function isOpenAIReasoningModel(model: string): boolean {
  const id = normalizeModelId(model);
  if (!id) return false;
  if (SAMPLING_EXEMPT_PATTERNS.some((re) => re.test(id))) return false;
  return OPENAI_REASONING_PATTERNS.some((re) => re.test(id));
}

/**
 * 解析该次调用应使用的 temperature；受限模型返回 `undefined` 表示不要下发。
 */
export function resolveTemperature(
  model: string,
  options?: { temperature?: number; scenario?: LLMScenario },
): number | undefined {
  if (!supportsCustomSampling(model)) return undefined;
  const explicit = options?.temperature;
  if (typeof explicit === 'number' && Number.isFinite(explicit)) return explicit;
  return SCENARIO_TEMPERATURE[options?.scenario || DEFAULT_SCENARIO];
}

/**
 * 生成可直接展开进 chat/completions 请求体的采样字段。
 * 受限模型返回空对象，调用方无需再做 if 判断。
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

/**
 * 生成 token 上限字段：OpenAI 推理模型只认 `max_completion_tokens`。
 */
export function buildTokenLimitPayload(
  model: string,
  maxTokens?: number,
): { max_tokens?: number; max_completion_tokens?: number } {
  if (typeof maxTokens !== 'number' || !Number.isFinite(maxTokens)) return {};
  return isOpenAIReasoningModel(model)
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
}
