import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { getEnvConfig, type EnvConfigType } from './utils';
import { UsageTracker } from './analytics/UsageTracker';
import {
  CAPABILITIES,
  normalizeCapability,
  type CapabilityKey,
} from './analytics/capabilities';
import {
  buildSamplingPayload,
  buildTokenLimitPayload,
  isOpenAIReasoningModel,
  resolveTemperature,
  SCENARIO_TEMPERATURE,
  type LLMScenario,
} from './modelSampling';

interface LLMHandlerResult {
  content: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    promptTokens?: number;
    completionTokens?: number;
  } | null;
  tokensEstimated?: boolean;
}

/**
 * 从 OpenAI/Groq/Ollama/Dify 响应里捕获 token 用量并写入前端打点缓冲。
 *
 * 纯副作用：读取 `body.feature` / `body.capability` 作为归类标签，
 * 绝不影响 `handleLLMRequest` 既有的返回契约（仍返回 string）。
 * 未标注的调用能力归为 'unknown'，并在开发期 warn。
 */
export function recordFrontendUsage(params: {
  body?: any;
  model?: string;
  usage?: any;
  status?: 'ok' | 'error';
  errorKind?: string;
  tokensEstimated?: boolean;
  capability?: unknown;
  feature?: string;
}): void {
  try {
    const body = params.body;
    const capability = normalizeCapability(
      params.capability ?? body?.capability,
    );
    if (
      capability === 'unknown' &&
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV !== 'production'
    ) {
      console.warn(
        '[usage] LLM 调用未标注 capability，将归入 unknown:',
        body?.feature || body?.type || params.feature || 'unknown',
      );
    }
    void UsageTracker.record({
      capability,
      feature: String(
        params.feature || body?.feature || body?.type || 'unknown',
      ),
      model: params.model,
      promptTokens: params.usage?.prompt_tokens ?? params.usage?.promptTokens,
      completionTokens:
        params.usage?.completion_tokens ?? params.usage?.completionTokens,
      status: params.status || 'ok',
      errorKind: params.errorKind,
      tokensEstimated: params.tokensEstimated,
    });
  } catch {
    // 打点失败不影响主流程
  }
}

/** 网关未返回 usage 时，按字符长度估算 token。 */
function estimateUsageFromText(
  prompt: string,
  completion: string,
): { prompt_tokens: number; completion_tokens: number } {
  return {
    prompt_tokens: Math.max(1, Math.ceil(String(prompt || '').length / 3)),
    completion_tokens: Math.max(
      1,
      Math.ceil(String(completion || '').length / 3),
    ),
  };
}

/** 把 LLM 调用异常归类为可报表的 errorKind。 */
export function classifyLlmError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  const lower = message.toLowerCase();
  const statusMatch = message.match(/\b(?:status|http)[^\d]*(\d{3})\b/i);
  const code = statusMatch?.[1];
  if (code === '401' || lower.includes('invalid token') || lower.includes('unauthorized')) {
    return 'http_401';
  }
  if (code === '403') return 'http_403';
  if (code === '404' || lower.includes('model_not_found') || lower.includes('not found')) {
    return 'http_404';
  }
  if (code === '429') return 'http_429';
  if (code === '503' || lower.includes('no available channel')) return 'http_503';
  if (code && /^5\d\d$/.test(code)) return `http_${code}`;
  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('aborted') ||
    (error as { name?: string })?.name === 'AbortError'
  ) {
    return 'timeout';
  }
  if (
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound')
  ) {
    return 'network';
  }
  return 'unknown_error';
}

/** 历史默认值：受限模型下会连同 temperature 一起被省略。 */
const DEFAULT_TOP_P = 0.9;

/**
 * 从请求体里读出采样意图：调用方可传 `scenario`（推荐）或直接给 `temperature`。
 * 具体取值与模型是否接受采样参数，交给 `modelSampling` 判定。
 */
function readSamplingRequest(body: any): {
  temperature?: number;
  scenario?: LLMScenario;
} {
  return {
    temperature:
      typeof body?.temperature === 'number' ? body.temperature : undefined,
    scenario: body?.scenario as LLMScenario | undefined,
  };
}

function resolveDefaultModel(
  envConfig: EnvConfigType,
  body: any,
): string {
  const t = String(envConfig.LLM_TYPE || 'openai');
  if (body?.model) return String(body.model);
  if (t === 'local') return String(envConfig.OLLAMA_MODEL || 'ollama');
  if (t === 'groq') return String(envConfig.GROQ_MODEL || 'mixtral-8x7b-32768');
  if (t === 'dify') return String(envConfig.OPENAI_MODEL || 'dify');
  return String(envConfig.OPENAI_MODEL || '');
}

// ==================== 辅助函数：模糊匹配（从 vectorStore.ts 迁移）====================
// 注意: 以下函数暂未使用，保留供将来扩展

/**
 * 模糊匹配人名
 * @param partialName 部分人名
 * @param knownPeople 已知人名列表
 * @returns 匹配的完整人名，如果没有匹配返回 null
 */
function _fuzzyMatchPerson(partialName: string, knownPeople: string[]): string | null {
  if (!partialName || !knownPeople || knownPeople.length === 0) {
    return null;
  }
  
  // 转换为小写进行比较
  const lowerPartialName = partialName.toLowerCase();
  
  // 1. 精确匹配（忽略大小写）
  const exactMatch = knownPeople.find(person => 
    person.toLowerCase() === lowerPartialName
  );
  if (exactMatch) return exactMatch;
  
  // 2. 开头匹配（例如 "Nelson" 匹配 "Nelson Wu"）
  const startsWithMatch = knownPeople.find(person => 
    person.toLowerCase().startsWith(lowerPartialName)
  );
  if (startsWithMatch) return startsWithMatch;
  
  // 3. 包含匹配（例如 "Wu" 匹配 "Nelson Wu"）
  const containsMatch = knownPeople.find(person => 
    person.toLowerCase().includes(lowerPartialName)
  );
  if (containsMatch) return containsMatch;
  
  // 4. 分词匹配（例如 "nelson" 匹配 "Nelson Wu"）
  const wordMatch = knownPeople.find(person => {
    const words = person.toLowerCase().split(/\s+/);
    return words.some(word => word === lowerPartialName);
  });
  if (wordMatch) return wordMatch;
  
  // 5. 首字母匹配（例如 "NW" 匹配 "Nelson Wu"）
  if (lowerPartialName.length >= 2) {
    const initialsMatch = knownPeople.find(person => {
      const initials = person.split(/\s+/).map(word => word[0]?.toLowerCase()).join('');
      return initials === lowerPartialName;
    });
    if (initialsMatch) return initialsMatch;
  }
  
  // 没有找到匹配
  return null;
}

/**
 * 模糊匹配实体名称（项目或主题）
 * @param partialName 部分实体名称
 * @param knownNames 已知实体名称列表
 * @returns 匹配的实体名称数组
 */
function _fuzzyMatchEntityName(partialName: string, knownNames: string[]): string[] {
  if (!partialName || !knownNames || knownNames.length === 0) {
    return [];
  }
  
  // 转换为小写进行比较
  const lowerPartialName = partialName.toLowerCase();
  const matches: string[] = [];
  
  // 1. 精确匹配（忽略大小写）
  const exactMatches = knownNames.filter(name => 
    name.toLowerCase() === lowerPartialName
  );
  matches.push(...exactMatches);
  
  // 如果找到精确匹配，直接返回
  if (matches.length > 0) return matches;
  
  // 2. 开头匹配（例如 "AI note" 匹配 "AI note 相关的规划进度"）
  const startsWithMatches = knownNames.filter(name => 
    name.toLowerCase().startsWith(lowerPartialName)
  );
  matches.push(...startsWithMatches);
  
  // 3. 包含匹配（例如 "note" 匹配 "AI note 相关的规划进度"）
  const containsMatches = knownNames.filter(name => 
    name.toLowerCase().includes(lowerPartialName) && 
    !matches.includes(name)  // 避免重复
  );
  matches.push(...containsMatches);
  
  // 4. 词语匹配（例如 "AI" 和 "note" 都匹配 "AI note 相关的规划进度"）
  const words = lowerPartialName.split(/\s+/);
  if (words.length > 1) {
    const wordMatches = knownNames.filter(name => {
      const nameWords = name.toLowerCase().split(/\s+/);
      return words.every(word => nameWords.some(nameWord => nameWord.includes(word))) &&
        !matches.includes(name);  // 避免重复
    });
    matches.push(...wordMatches);
  }
  
  return matches;
}

// 根据不同 LLM 服务处理 LLM 请求，并提取 JSON 数据
function normalizeLLMRequestBody(body: any): any {
    const normalizedBody = { ...body };
    const hasPrompt =
        normalizedBody.prompt !== undefined &&
        normalizedBody.prompt !== null &&
        String(normalizedBody.prompt).trim().length > 0;

    if (!hasPrompt && (normalizedBody.system_prompt || normalizedBody.user_prompt)) {
        normalizedBody.prompt = [
            normalizedBody.system_prompt,
            normalizedBody.user_prompt,
        ]
            .filter((part) => String(part || '').trim().length > 0)
            .join('\n\n');
    }

    return normalizedBody;
}

export async function handleLLMRequest(body: any): Promise<string> {
    const requestBody = normalizeLLMRequestBody(body);
    const envConfig = await getEnvConfig();
    let handler: (body: any) => Promise<LLMHandlerResult>;
    switch (envConfig.LLM_TYPE) {
        case 'local':
            handler = handleOllamaRequest;
            if (requestBody.type === 'review') requestBody.model = envConfig.OLLAMA_REVIEW_MODEL;
            if (requestBody.type === 'query') requestBody.model = envConfig.OLLAMA_QUERY_MODEL;
            break;
        case 'groq':
            handler = handleGroqRequest;
            if (requestBody.type === 'review') requestBody.model = envConfig.GROQ_REVIEW_MODEL;
            break;
        case 'dify':
            handler = handleDifyRequest;
            if (requestBody.type === 'review') requestBody.apiKey = envConfig.DIFY_REVIEW_API_KEY;
            break;
        default:
            handler = handleOpenAIRequest;
            if (requestBody.type === 'review') requestBody.model = envConfig.OPENAI_REVIEW_MODEL;
    }

    try {
        const result = await handler(requestBody);
        let usage = result.usage;
        let tokensEstimated = Boolean(result.tokensEstimated);
        if (
            !usage ||
            ((usage.prompt_tokens ?? usage.promptTokens ?? 0) === 0 &&
                (usage.completion_tokens ?? usage.completionTokens ?? 0) === 0)
        ) {
            usage = estimateUsageFromText(
                String(
                    requestBody.prompt ||
                        `${requestBody.system_prompt || ''}\n${requestBody.user_prompt || ''}`,
                ),
                result.content,
            );
            tokensEstimated = true;
        }
        recordFrontendUsage({
            body: requestBody,
            model: result.model,
            usage,
            status: 'ok',
            tokensEstimated,
        });
        return result.content;
    } catch (error) {
        recordFrontendUsage({
            body: requestBody,
            model: resolveDefaultModel(envConfig, requestBody),
            usage: { prompt_tokens: 0, completion_tokens: 0 },
            status: 'error',
            errorKind: classifyLlmError(error),
        });
        throw error;
    }
}

/**
 * Meeting Pilot 结构化分析：与 `messageDealing` / `reviewMessageByLLMAndSendToBot` 共用
 * `handleLLMRequest`（`LLM_TYPE`: dify / openai / groq / local），
 * 不再单独依赖 `MEETING_PROVIDER_BASE_URL` 或 `MEETING_ANALYSIS_MODEL`。
 */
export async function runMeetingIntelligenceLLM(params: {
  systemPrompt: string;
  userPrompt: string;
  feature?: string;
  capability?: CapabilityKey;
}): Promise<string> {
  const merged = `${params.systemPrompt}\n\n${params.userPrompt}`.trim();
  return handleLLMRequest({
    system_prompt: params.systemPrompt,
    user_prompt: params.userPrompt,
    prompt: merged,
    capability: params.capability || CAPABILITIES.MEETING_PILOT,
    feature: params.feature || 'meeting_pilot',
  });
}

/**
 * 会中侧栏等展示用：与 `handleLLMRequest` / `LLM_TYPE` 一致，便于与选项页主 LLM 配置对齐。
 */
export function formatMainLlmProfileForMeetingPilot(
  env: EnvConfigType,
): string {
  const t = String(env.LLM_TYPE || 'openai');
  if (t === 'local') {
    const m = String(env.OLLAMA_MODEL || '').trim();
    return m ? `Ollama · ${m}` : 'Ollama（模型未配）';
  }
  if (t === 'groq') {
    const m = String(env.GROQ_MODEL || '').trim();
    return m ? `Groq · ${m}` : 'Groq（模型未配）';
  }
  if (t === 'dify') {
    return 'Dify（主应用）';
  }
  const m = String(env.OPENAI_MODEL || '').trim();
  return m ? `OpenAI 兼容 · ${m}` : 'OpenAI 兼容（模型未配）';
}

/**
 * 主消息分析 LLM 是否已配置（Meeting Pilot readiness，对应 options 里「分析」用的同一套）。
 */
export function isMainLLMConfiguredForMeetingAnalysis(
  env: EnvConfigType,
): { ok: true; message: string } | { ok: false; message: string } {
  const t = String(env.LLM_TYPE || 'openai');
  if (t === 'local') {
    if (!String(env.OLLAMA_BASE_URL || '').trim()) {
      return { ok: false, message: 'Ollama base URL 未配置。' };
    }
    if (!String(env.OLLAMA_MODEL || '').trim()) {
      return { ok: false, message: 'Ollama 模型未配置。' };
    }
    return { ok: true, message: 'Ollama 分析可用。' };
  }
  if (t === 'groq') {
    if (!String(env.GROQ_API_KEY || '').trim()) {
      return { ok: false, message: 'Groq API key 未配置。' };
    }
    if (!String(env.GROQ_MODEL || '').trim()) {
      return { ok: false, message: 'Groq 模型未配置。' };
    }
    return { ok: true, message: 'Groq 分析可用。' };
  }
  if (t === 'dify') {
    if (!String(env.DIFY_API_KEY || '').trim()) {
      return { ok: false, message: 'Dify API key 未配置。' };
    }
    return { ok: true, message: 'Dify 分析可用。' };
  }
  if (!String(env.OPENAI_API_KEY || '').trim()) {
    return { ok: false, message: 'OpenAI API key 未配置。' };
  }
  if (!String(env.OPENAI_MODEL || '').trim()) {
    return { ok: false, message: 'OpenAI 模型未配置。' };
  }
  return { ok: true, message: '主 LLM 分析可用。' };
}

// 处理 Ollama 请求。Ollama 安装后需要把 launchctl setenv OLLAMA_ORIGINS "*" 加入到 .bashrc 中
async function handleOllamaRequest(body: any): Promise<LLMHandlerResult> {
    const envConfig = await getEnvConfig();
    const model = String(body.model || envConfig.OLLAMA_MODEL || 'ollama');
    const temperature = resolveTemperature(model, readSamplingRequest(body));
    const response = await fetch(`${envConfig.OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            prompt: body.prompt,
            stream: false,
            // Ollama 只读 `options` 里的采样参数，顶层同名字段会被忽略
            options: {
                ...(temperature === undefined ? {} : { temperature }),
                top_p: DEFAULT_TOP_P,
                ...(typeof body.max_tokens === 'number' && Number.isFinite(body.max_tokens)
                    ? { num_predict: body.max_tokens }
                    : {}),
            },
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const content = String(result.response || '');
    const promptEval = Number(result.prompt_eval_count);
    const evalCount = Number(result.eval_count);
    const hasUsage =
        Number.isFinite(promptEval) || Number.isFinite(evalCount);
    return {
        content,
        model,
        usage: hasUsage
            ? {
                prompt_tokens: Number.isFinite(promptEval) ? promptEval : 0,
                completion_tokens: Number.isFinite(evalCount) ? evalCount : 0,
              }
            : null,
        tokensEstimated: !hasUsage,
    };
}

// 处理 OpenAI 请求
async function handleOpenAIRequest(body: any): Promise<LLMHandlerResult> {
  const envConfig = await getEnvConfig();
  // 初始化 OpenAI 客户端
  const openai = new OpenAI({
      apiKey: envConfig.OPENAI_API_KEY,
      baseURL: envConfig.OPENAI_API_BASE_URL,
      dangerouslyAllowBrowser: true
  });
  const model = String(
    body.model || envConfig.OPENAI_MODEL || '',
  );
  const completion = await openai.chat.completions.create({
      model,
      messages: body.system_prompt ?  [
        { role: "system", content: body.system_prompt },
        { role: "user", content: body.user_prompt },
      ] : [
        { role: "user", content: body.prompt },
      ],
      ...buildSamplingPayload(model, {
        ...readSamplingRequest(body),
        topP: DEFAULT_TOP_P,
      }),
      ...buildTokenLimitPayload(model, body.max_tokens),
      ...(isOpenAIReasoningModel(model) && body.reasoning_effort
        ? { reasoning_effort: body.reasoning_effort }
        : {}),
  });

  return {
    content: completion.choices[0].message.content || '',
    model,
    usage: completion.usage || null,
  };
}

// 处理 Groq 请求
async function handleGroqRequest(body: any): Promise<LLMHandlerResult> {
    const envConfig = await getEnvConfig();
    // 初始化 Groq 客户端
    const groq = new Groq({
        apiKey: envConfig.GROQ_API_KEY,
        dangerouslyAllowBrowser: true
    });
    const groqModel = String(
      body.model || envConfig.GROQ_MODEL || 'mixtral-8x7b-32768',
    );
    const completion = await groq.chat.completions.create({
        model: groqModel,
        messages: body.system_prompt ? [
          { role: "system", content: body.system_prompt },
          { role: "user", content: body.user_prompt },
        ] : [
          { role: "user", content: body.prompt },
        ],
        ...buildSamplingPayload(groqModel, {
          ...readSamplingRequest(body),
          topP: DEFAULT_TOP_P,
        }),
        ...buildTokenLimitPayload(groqModel, body.max_tokens),
    });

    return {
      content: completion.choices[0].message.content || '',
      model: groqModel,
      usage: completion.usage || null,
    };
}

// 新增：处理 Dify 请求
async function handleDifyRequest(body: any): Promise<LLMHandlerResult> {
    const envConfig = await getEnvConfig();
    // 新增：初始化 Dify API 配置
    const difyConfig = {
        apiKey: envConfig.DIFY_API_KEY,
        reviewApiKey: envConfig.DIFY_REVIEW_API_KEY,
        baseURL: envConfig.DIFY_API_BASE_URL || 'https://api.dify.ai/v1'
    };
    const response = await fetch(`${difyConfig.baseURL}/completion-messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${body.apiKey || difyConfig.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            inputs: {query: body.prompt},            // 可选的输入参数
            response_mode: 'blocking',           // 改为 streaming 模式
            user: body.user || 'default-user',    // 可选
        })
    });

    if (!response.ok) {
        throw new Error(`Dify API error! status: ${response.status}`);
    }

    const result = await response.json();
    const answer = result.answer || '';
    // Dify often omits usage; estimate so frontend telemetry is not empty for dify users.
    const rawUsage = result.metadata?.usage || result.usage;
    const tokensEstimated = !rawUsage;
    const usage =
      rawUsage ||
      estimateUsageFromText(String(body.prompt || ''), answer);
    return {
      content: answer,
      model: envConfig.OPENAI_MODEL || 'dify',
      usage,
      tokensEstimated,
    };
}

// 新增：从响应文本中提取 JSON 数据
function extractJsonFromResponse(response: string): any[] {
    let jsonData: any[] = [];
    try {
        // 首先尝试直接解析整个响应
        try {
            const directParse = JSON.parse(response.trim());
            return directParse;
        } catch (e) {
            // 如果直接解析失败，继续尝试其他方法
        }

        // 尝试从响应中查找 JSON 代码块
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            const parsedData = JSON.parse(jsonMatch[1].trim());
            jsonData = parsedData;
        } else {
            // 尝试查找可能的 JSON 字符串（方括号或大括号开头和结尾）
            const jsonRegex = /(\[[\s\S]*\]|\{[\s\S]*\})/;
            const potentialJson = response.match(jsonRegex);
            if (potentialJson) {
                const parsedData = JSON.parse(potentialJson[1].trim());
                jsonData = parsedData;
            }
        }
    } catch (e) {
        console.warn('Failed to parse JSON from LLM response:', e);
    }
    return jsonData;
}

/**
 * 知识查询 - 兼容层
 *
 * 🔄 重构说明：此函数现在通过 MemoryServiceClient HTTP 后端进行查询
 * 新的架构中，MemoryServiceClient 作为统一的记忆查询路由，负责：
 * 1. 智能决策：选择本地缓存还是云端查询
 * 2. 查询策略：实体搜索 + 消息搜索 + 关系扩展
 * 3. 结果融合：优先使用实体信息，消息作为补充
 * 4. LLM 生成：基于融合后的上下文生成答案
 *
 * @param question 用户的自然语言问题
 * @returns 查询结果
 */
export async function knowledgeQuery(question: string) {
  console.log('🔄 knowledgeQuery [兼容层] ->', question);
  try {
    // 🆕 调用 MemoryServiceClient 的 ask() 接口
    const { getMemoryServiceClient } = await import('./services/MemoryServiceClient');
    const client = getMemoryServiceClient();
    const result = await client.ask(question);

    // 🔄 转换新格式到旧格式（向后兼容）
    // client.ask() returns { answer, evidence?: RecallItem[], queryTimeMs }

    // 将 evidence 转换为扁平实体数组
    const flatEntities: any[] = [];
    if (result.evidence) {
      for (const item of result.evidence) {
        flatEntities.push({
          name: item.content,
          type: item.type,
          id: item.id,
          score: item.score,
          source: item.source,
          timestamp: item.timestamp,
          metadata: item.metadata
        });
      }
    }

    return {
      success: true,
      analysis: result.answer,
      relatedMessages: flatEntities.length,
      queryIntent: undefined,
      results: flatEntities
    };
  } catch (error) {
    console.error('💥 知识查询失败:', error);
    return {
      success: false,
      message: '查询时发生错误，请稍后再试。'
    };
  }
}

/**
 * @deprecated 旧的 knowledgeQuery 实现，已废弃
 * 新实现通过 MemoryServiceClient HTTP 后端
 *
 * 🔄 重构说明：
 * - 此函数的逻辑已完整移植到 MemoryServiceClient.ask()
 * - 新实现增强了实体直接检索和关系扩展查询
 * - 不再需要直接访问 cloudStorage，所有查询通过 MemoryServiceClient 路由
 *
 * 此函数已不再使用，保留仅供参考
 */
export async function knowledgeQueryOld_DEPRECATED(_question: string) {
  throw new Error('此函数已废弃，请使用 MemoryServiceClient.ask() 代替');
  
  /* 旧实现已注释，请参考 memorySystem.knowledgeQuery
  console.log('knowledgeQuery', question, new Date().getTime());
  try {
    // 1. 从问题中识别查询意图和关键实体
    const queryIntent = await extractEntitiesForQuery(question);
    console.log('queryIntent', queryIntent, new Date().getTime());
    
    // 类型安全处理：确保时间范围有效
    if (queryIntent?.query?.filters?.time_range) {
      const timeRange = queryIntent.query.filters.time_range;
      
      // 处理时间疑问词
      if (timeRange.type === 'specific' && typeof timeRange.start === 'string') {
        console.warn(`非法的时间值: ${timeRange.start}，类型: ${typeof timeRange.start}`);
        
        // 检查是否是常见的时间疑问词
        const timeQuestionWords = ["什么时候", "何时", "几点", "哪天", "什么日期", "什么时间", "几号", "什么时段", "几月", "哪一天", "什么季节"];
        
        if (timeQuestionWords.some(word => timeRange.start.includes(word))) {
          console.log(`检测到时间疑问词: "${timeRange.start}"，将time_range.type设为"all"`);
          timeRange.type = "all";
          timeRange.start = null;
          timeRange.end = null;
        }
      }
      
      // 根据时间描述设置具体的时间范围
      if (timeRange.type === 'range' && timeRange.description) {
        const now = new Date();
        const thisYear = now.getFullYear();
        const thisMonth = now.getMonth();
        
        if (/今年|本年|今年度|本年度/.test(timeRange.description)) {
          // 今年范围：从今年1月1日到现在
          const startOfYear = new Date(thisYear, 0, 1).getTime();
          timeRange.start = startOfYear;
          timeRange.end = now.getTime();
          console.log(`设置今年时间范围: ${new Date(startOfYear).toISOString()} 到 ${new Date().toISOString()}`);
        } 
        else if (/这个月|本月|当月/.test(timeRange.description)) {
          // 这个月范围：从本月1日到现在
          const startOfMonth = new Date(thisYear, thisMonth, 1).getTime();
          timeRange.start = startOfMonth;
          timeRange.end = now.getTime();
          console.log(`设置本月时间范围: ${new Date(startOfMonth).toISOString()} 到 ${new Date().toISOString()}`);
        }
        else if (/上个月|上月|前一个月/.test(timeRange.description)) {
          // 上个月范围
          const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
          const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
          const startOfLastMonth = new Date(lastMonthYear, lastMonth, 1).getTime();
          const endOfLastMonth = new Date(thisYear, thisMonth, 0).getTime();
          timeRange.start = startOfLastMonth;
          timeRange.end = endOfLastMonth;
          console.log(`设置上月时间范围: ${new Date(startOfLastMonth).toISOString()} 到 ${new Date(endOfLastMonth).toISOString()}`);
        }
        else if (/去年|上一年|前一年/.test(timeRange.description)) {
          // 去年范围
          const lastYear = thisYear - 1;
          const startOfLastYear = new Date(lastYear, 0, 1).getTime();
          const endOfLastYear = new Date(lastYear, 11, 31, 23, 59, 59).getTime();
          timeRange.start = startOfLastYear;
          timeRange.end = endOfLastYear;
          console.log(`设置去年时间范围: ${new Date(startOfLastYear).toISOString()} 到 ${new Date(endOfLastYear).toISOString()}`);
        }
        else if (/过去(\d+)天|最近(\d+)天/.test(timeRange.description)) {
          // 过去N天
          const matches = timeRange.description.match(/过去(\d+)天|最近(\d+)天/);
          if (matches) {
            const days = parseInt(matches[1] || matches[2]);
            if (!isNaN(days)) {
              const pastDays = now.getTime() - (days * 24 * 60 * 60 * 1000);
              timeRange.start = pastDays;
              timeRange.end = now.getTime();
              console.log(`设置过去${days}天时间范围: ${new Date(pastDays).toISOString()} 到 ${new Date().toISOString()}`);
            }
          }
        }
      }
      
      // 如果是recent类型，设置默认为过去7天
      if (timeRange.type === 'recent') {
        const now = new Date();
        const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        timeRange.start = sevenDaysAgo;
        timeRange.end = now.getTime();
        console.log(`设置最近时间范围(7天): ${new Date(sevenDaysAgo).toISOString()} 到 ${new Date().toISOString()}`);
      }
    }
    
    // 1.5 获取所有已知人名、项目和主题进行模糊匹配
    // 1.5.1 人名模糊匹配
    if (queryIntent?.query?.filters?.entities?.people?.length > 0) {
      // 🔄 使用新的 memorySystem API 获取所有已知人名
      await memorySystem.initialize();
      const knownPeople = await memorySystem.cloudStorage.getAllKnownPeople();
      console.log('已知人名列表:', knownPeople);
      
      // 对每个识别出的人名进行模糊匹配
      const matchedPeople = [];
      for (const person of queryIntent.query.filters.entities.people) {
        const matchedPerson = fuzzyMatchPerson(person.name, knownPeople);
        if (matchedPerson) {
          console.log(`人名模糊匹配: "${person.name}" => "${matchedPerson}"`);
          matchedPeople.push({
            name: matchedPerson,
            role: person.role,
            required: person.required
          });
        } else {
          // 如果没有匹配到，保留原始人名
          matchedPeople.push(person);
        }
      }
      
      // 更新查询意图中的人名
      queryIntent.query.filters.entities.people = matchedPeople;
      console.log('更新后的人名列表:', queryIntent.query.filters.entities.people);
    }
    
    // 1.5.2 项目和主题的模糊匹配
    // 🔄 使用新的 memorySystem API 获取所有已知项目和主题
    await memorySystem.initialize();
    const knownProjects = await memorySystem.cloudStorage.getAllKnownProjects();
    const knownTopics = await memorySystem.cloudStorage.getAllKnownTopics();
    console.log('已知项目列表:', knownProjects);
    console.log('已知主题列表:', knownTopics);
    
    // 项目模糊匹配
    if (queryIntent?.query?.filters?.entities?.projects?.length > 0) {
      const matchedProjects = [];
      for (const project of queryIntent.query.filters.entities.projects) {
        const matchedNames = fuzzyMatchEntityName(project.name, knownProjects);
        if (matchedNames.length > 0) {
          console.log(`项目模糊匹配: "${project.name}" => `, matchedNames);
          matchedNames.forEach(name => {
            matchedProjects.push({
              name,
              status: project.status,
              required: project.required
            });
          });
        } else {
          // 如果项目没匹配到，检查是否可以在主题中找到
          const matchedTopics = fuzzyMatchEntityName(project.name, knownTopics);
          if (matchedTopics.length > 0) {
            console.log(`项目在主题中匹配: "${project.name}" => `, matchedTopics);
            // 将匹配到的主题添加到主题列表中
            if (!queryIntent.query.filters.entities.topics) {
              queryIntent.query.filters.entities.topics = [];
            }
            matchedTopics.forEach(name => {
              queryIntent.query.filters.entities.topics.push({
                name,
                category: '',
                required: project.required
              });
            });
          } else {
            matchedProjects.push(project);
          }
        }
      }
      
      // 更新查询意图中的项目
      queryIntent.query.filters.entities.projects = matchedProjects;
    }
    
    // 主题模糊匹配
    if (queryIntent?.query?.filters?.entities?.topics?.length > 0) {
      const matchedTopics = [];
      for (const topic of queryIntent.query.filters.entities.topics) {
        const matchedNames = fuzzyMatchEntityName(topic.name, knownTopics);
        if (matchedNames.length > 0) {
          console.log(`主题模糊匹配: "${topic.name}" => `, matchedNames);
          matchedNames.forEach(name => {
            matchedTopics.push({
              name,
              category: topic.category,
              required: topic.required
            });
          });
        } else {
          // 如果主题没匹配到，检查是否可以在项目中找到
          const matchedProjects = fuzzyMatchEntityName(topic.name, knownProjects);
          if (matchedProjects.length > 0) {
            console.log(`主题在项目中匹配: "${topic.name}" => `, matchedProjects);
            // 将匹配到的项目添加到项目列表中
            if (!queryIntent.query.filters.entities.projects) {
              queryIntent.query.filters.entities.projects = [];
            }
            matchedProjects.forEach(name => {
              queryIntent.query.filters.entities.projects.push({
                name,
                status: '',
                required: topic.required
              });
            });
          } else {
            matchedTopics.push(topic);
          }
        }
      }
      
      // 更新查询意图中的主题
      queryIntent.query.filters.entities.topics = matchedTopics;
    }
    
    // 1.5.3 特殊处理：如果用户查询既没有指定项目也没有指定主题，但问题中含有实体名称，尝试从两者中匹配
    if ((!queryIntent?.query?.filters?.entities?.projects?.length) && 
        (!queryIntent?.query?.filters?.entities?.topics?.length)) {
      
      // 从问题中提取可能的实体名称（简单策略：提取所有名词短语）
      const words = question.split(/\s+/);
      for (let i = 0; i < words.length; i++) {
        // 尝试不同长度的词组
        for (let j = Math.min(i + 3, words.length); j > i; j--) {
          const phrase = words.slice(i, j).join(' ');
          
          // 在项目中查找
          const matchedProjects = fuzzyMatchEntityName(phrase, knownProjects);
          if (matchedProjects.length > 0) {
            console.log(`从问题中提取项目: "${phrase}" => `, matchedProjects);
            if (!queryIntent.query.filters.entities.projects) {
              queryIntent.query.filters.entities.projects = [];
            }
            matchedProjects.forEach(name => {
              queryIntent.query.filters.entities.projects.push({
                name,
                status: '',
                required: true
              });
            });
          }
          
          // 在主题中查找
          const matchedTopics = fuzzyMatchEntityName(phrase, knownTopics);
          if (matchedTopics.length > 0) {
            console.log(`从问题中提取主题: "${phrase}" => `, matchedTopics);
            if (!queryIntent.query.filters.entities.topics) {
              queryIntent.query.filters.entities.topics = [];
            }
            matchedTopics.forEach(name => {
              queryIntent.query.filters.entities.topics.push({
                name,
                category: '',
                required: true
              });
            });
          }
        }
      }
    }
    
    // 去重（基于name字段）
    if (queryIntent?.query?.filters?.entities?.projects) {
      queryIntent.query.filters.entities.projects = Array.from(
        new Map(queryIntent.query.filters.entities.projects.map((item: { name: string }) => [item.name, item])).values()
      );
    }
    if (queryIntent?.query?.filters?.entities?.topics) {
      queryIntent.query.filters.entities.topics = Array.from(
        new Map(queryIntent.query.filters.entities.topics.map((item: { name: string }) => [item.name, item])).values()
      );
    }
    
    console.log('最终查询意图:', queryIntent);
    
    // 2. 构建查询过滤条件
    const filters: any = {};
    
    // 添加安全检查，确保 queryIntent 结构完整
    if (queryIntent?.query?.filters) {
      // 复制实体过滤器
      if (queryIntent.query.filters.entities) {
        filters.entities = queryIntent.query.filters.entities;
      }
      
      // 复制时间范围
      if (queryIntent.query.filters.time_range) {
        filters.time_range = queryIntent.query.filters.time_range;
      }
    }
    
    // 设置输出选项
    const output = queryIntent?.query?.output || {
      format: "list",
      limit: 20,
      sort: {
        field: "timestamp",
        order: "desc" as const
      }
    };
    
    // 4. 🔄 使用新的 memorySystem API 查询消息
    let queryResults;
    try {
      await memorySystem.initialize();
      
      // 转换时间范围格式
      const timeRange = filters.time_range && filters.time_range.start && filters.time_range.end
        ? { start: filters.time_range.start, end: filters.time_range.end }
        : undefined;
      
      // 使用 getSimilarMessages 替代 naturalLanguageQuery
      const messages = await memorySystem.cloudStorage.getSimilarMessages(question, {
        limit: output.limit || 20,
        minRelevanceScore: 0.3,
        timeRange,
        sortBy: output.sort?.field === 'timestamp' ? 'time' : 'relevance',
        sortOrder: output.sort?.order || 'desc',
        filters: {
          source: filters.source,
          teamName: filters.teamName,
          entities: filters.entities,
          metadata: filters.metadata
        }
      });
      
      // 转换为兼容的格式
      queryResults = {
        question: question,
        results: {
          ids: messages.map(m => m.id),
          documents: messages.map(m => m.content),
          metadatas: messages.map(m => ({
            sender: m.sender,
            source: m.sender,
            groupName: m.groupName,
            groupUrl: m.groupUrl,
            datetime: m.datetime,
            summary: m.summary,
            matchedRules: m.matchedRules,
            contextMessages: m.contextMessages
          })),
          distances: messages.map(m => 1 - (m.relevanceScore || 0))
        }
      };
      console.log('queryResults', queryResults, new Date().getTime());
    } catch (error) {
      console.error('向量数据库查询失败:', error);
      queryResults = {
        question: question,
        results: {
          ids: [],
          documents: [],
          metadatas: [],
          distances: []
        }
      };
    }
    
    // 添加空值检查
    if (!queryResults) {
      console.warn('向量数据库查询返回空结果');
      queryResults = {
        question: question,
        results: {
          ids: [],
          documents: [],
          metadatas: [],
          distances: []
        }
      };
    }
    
    const { question: formattedQuestion, results } = queryResults;
    
    if (!results || !results.documents || results.documents.length === 0) {
      return {
        success: false,
        message: `没有找到关于"${question}"的相关信息。`
      };
    }

    console.log('results', !results, !results.documents, results.documents.length === 0, new Date().getTime());
    // 5. 根据查询类型构建不同的提示模板
    let promptTemplate = "";
    
    switch (queryIntent?.query?.intent?.secondary) {
      case "project_status":
        promptTemplate = `
        以下是关于项目的一些信息:
        {{context}}
        
        基于以上信息,请分析并回答关于项目进展的问题:
        ${formattedQuestion}
        
        请包括:
        1. 项目当前进展
        2. 存在的风险和挑战
        3. 下一步计划
        `;
        break;
        
      case "person_info":
        promptTemplate = `
        以下是关于{{person}}的一些信息:
        {{context}}
        
        基于这些信息,请回答:
        ${formattedQuestion}
        
        请分析此人:
        1. 关注的重点话题/项目
        2. 交流和决策风格
        3. 可能的兴趣和关注点
        `;
        break;
        
      case "topic_discussion":
        promptTemplate = `
        以下是关于"{{topic}}"话题的相关信息:
        {{context}}
        
        基于这些信息,请回答:
        ${formattedQuestion}
        
        请分析:
        1. 这个话题的主要讨论点
        2. 不同观点和立场
        3. 最新的发展或决策
        `;
        break;
        
      case "action_items":
        promptTemplate = `
        以下是一些可能包含行动项的消息:
        {{context}}
        
        基于这些信息,请回答:
        ${formattedQuestion}
        
        请列出:
        1. 所有需要注意的行动项
        2. 各项的截止日期(如有提及)
        3. 负责人(如有提及)
        `;
        break;
        
      default:
        promptTemplate = `
        以下是与问题"${formattedQuestion}"相关的信息:
        {{context}}
        
        请基于以上信息提供详细回答。仅使用提供的信息,不要添加额外知识。
        如果信息不足,请明确指出。
        `;
    }
    
    // 6. 插入上下文
    const messagesContext = results.documents
      .map((doc, idx) => {
        const metadata = results.metadatas[idx];
        const source = metadata.source;
        const date = new Date(Number(metadata.timestamp)).toLocaleString();
        return `[${date} - ${source}] ${doc}`;
      })
      .join('\n\n');
      
    let prompt = promptTemplate.replace('{{context}}', messagesContext);
    
    // 替换实体
    if (queryIntent?.query?.intent?.secondary === "person_info" && 
        queryIntent?.query?.filters?.entities?.people?.length > 0) {
      prompt = prompt.replace('{{person}}', queryIntent.query.filters.entities.people[0].name);
    }
    
    if (queryIntent?.query?.intent?.secondary === "topic_discussion" && 
        queryIntent?.query?.filters?.entities?.topics?.length > 0) {
      prompt = prompt.replace('{{topic}}', queryIntent.query.filters.entities.topics[0].name);
    }
    
    // 7. 调用 LLM 生成回答
    const llmResponse = await handleLLMRequest({prompt});
    
    // 8. 构建符合 QueryResult 接口的结果
    const formattedResults = results.documents.map((doc, idx) => {
      const metadata = results.metadatas[idx] as Record<string, string | number | boolean>;
      const id = String(results.ids[idx]);
      const relevance = Math.max(0, 1 - results.distances[idx]); // 余弦距离：1-distance转换为相关性分数 (0-1)
      
      // 解析标签
      let tags: string[] = [];
      try {
        if (metadata.tags) {
          tags = JSON.parse(String(metadata.tags));
        } else if (metadata.category) {
          tags = JSON.parse(String(metadata.category));
        }
      } catch (e) {
        console.error('解析标签失败:', e);
        tags = [];
      }
      
      // 构建群组信息
      const groupInfo = metadata.grName || metadata.groupId ? {
        name: String(metadata.groupName || '未知群组'),
        id: String(metadata.groupId || ''),
        url: metadata.groupId ? `https://app.ringcentral.com/messages/${metadata.groupId}` : ''
      } : undefined;
      
      // 构建 QueryResult 对象
      return {
        id: id,
        summary: String(metadata.summary) || doc.substring(0, 100) + '...',
        details: String(metadata.details || doc),
        timestamp: new Date(Number(metadata.timestamp)).toISOString(),
        source: String(metadata.source),
        relevance: relevance,
        tags: tags,
        team: groupInfo,
        reply_advice: metadata.reply_advice || ''
      };
    });
    
    return {
      success: true,
      analysis: llmResponse,
      relatedMessages: results.documents.length,
      queryIntent: queryIntent,
      results: formattedResults
    };
  } catch (error) {
    console.error('通用查询失败:', error);
    return {
      success: false,
      message: '查询时发生错误,请稍后再试。'
    };
  }
  */
}

// 实现 callLLMJsonAPI 函数
export async function callLLMJsonAPI(body: any): Promise<any> {
  // 复用现有的 LLM 请求代码
  const response = await handleLLMRequest(body);
  const jsonData = extractJsonFromResponse(response);
  
  return jsonData;
}

// 通用聊天消息接口
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
}

interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  /** 任务场景，决定 temperature 档位；显式 temperature 优先。 */
  scenario?: LLMScenario;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  onMessage?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: any) => void;
}

// OPENAI聊天实现
class OpenAIChat {
  private apiKey: string;
  private baseUrl: string;
  private openai: any; // OpenAI实例
  private conversationId = ''; // 添加会话ID存储
  private conversationHistory: Map<string, ChatMessage[]> = new Map(); // 存储不同会话的历史记录
  
  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    
    // 初始化OpenAI客户端
    this.openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
      dangerouslyAllowBrowser: true
    });
  }
  
  // 重置会话，开始新对话
  resetConversation() {
    this.conversationId = '';
    return this;
  }
  
  // 设置会话ID
  setConversationId(id: string) {
    this.conversationId = id;
    if (!this.conversationHistory.has(id)) {
      this.conversationHistory.set(id, []);
    }
    return this;
  }
  
  // 获取当前会话ID
  getConversationId(): string {
    return this.conversationId;
  }
  
  // 获取当前会话的历史记录
  getConversationHistory(): ChatMessage[] {
    return this.conversationHistory.get(this.conversationId) || [];
  }

  async chat(options: ChatOptions) {
    const { model, messages, temperature, scenario, max_tokens, stream = false, onMessage, onComplete, onError } = options;
    const sampling = buildSamplingPayload(model, {
      temperature,
      scenario: scenario || 'conversation',
    });
    const tokenLimitField = buildTokenLimitPayload(model, max_tokens);
    
    try {
      // 如果没有会话ID，创建一个新的
      if (!this.conversationId) {
        this.conversationId = Date.now().toString();
        this.conversationHistory.set(this.conversationId, []);
      }
      
      // 获取当前会话的历史记录
      const history = this.conversationHistory.get(this.conversationId) || [];
      
      const tokenLimit = model.includes('gpt-4') ? 8000 : 4000; // 根据模型调整
      const optimizedHistory = this.optimizeHistory(history, tokenLimit);
      const allMessages = [...optimizedHistory, ...messages];
      
      // 使用OpenAI SDK
      if (stream) {
        const stream = await this.openai.chat.completions.create({
          model,
          messages: allMessages,
          ...sampling,
          ...tokenLimitField,
          stream: true
        });
        
        let fullResponse = '';
        for await (const part of stream) {
          const content = part.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            onMessage?.(content);
          }
        }
        
        // 更新会话历史
        if (fullResponse) {
          history.push(...messages); // 添加用户消息
          history.push({ role: 'assistant', content: fullResponse }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        
        onComplete?.(fullResponse);
        return fullResponse;
      } else {
        const completion = await this.openai.chat.completions.create({
          model,
          messages: allMessages,
          ...sampling,
          ...tokenLimitField
        });
        
        const content = completion.choices[0].message.content || '';
        
        // 更新会话历史
        if (content) {
          history.push(...messages); // 添加用户消息
          history.push({ role: 'assistant', content }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        
        onComplete?.(content);
        return content;
      }
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }

  private optimizeHistory(messages: ChatMessage[], maxTokens = 4000): ChatMessage[] {
    // 如果消息数量少，直接返回
    if (messages.length <= 3) return messages;

    // 保留系统消息
    const systemMessages = messages.filter(m => m.role === 'system');
    
    // 获取非系统消息
    let conversationMessages = messages.filter(m => m.role !== 'system');
    
    // 估算当前token数量（简单估算：每4个字符约1个token）
    const estimateTokens = (msgs: ChatMessage[]): number => {
      return msgs.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);
    };
    
    // 如果预估token数量超过限制，开始裁剪历史
    let estimatedTokens = estimateTokens(conversationMessages);
    
    // 保留最新的消息，逐步移除较早的消息对
    while (estimatedTokens > maxTokens && conversationMessages.length > 2) {
      // 移除最早的一对对话（用户+助手）
      conversationMessages = conversationMessages.slice(2);
      estimatedTokens = estimateTokens(conversationMessages);
    }
    
    // 合并系统消息和优化后的对话
    return [...systemMessages, ...conversationMessages];
  }
}

// DIFY聊天实现
class DifyChat {
  private apiKey: string;
  private baseUrl: string;
  private conversationId = ''; // 添加会话ID存储
  
  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  
  // 重置会话，开始新对话
  resetConversation() {
    this.conversationId = '';
    return this;
  }
  
  // 设置会话ID
  setConversationId(id: string) {
    this.conversationId = id;
    return this;
  }
  
  // 获取当前会话ID
  getConversationId(): string {
    return this.conversationId;
  }

  async chat(options: ChatOptions) {
    // Dify 的采样参数在 Dify 应用侧配置，请求体里的 temperature 仅作透传标记。
    const { messages, temperature = SCENARIO_TEMPERATURE.conversation, stream = false, onMessage, onComplete, onError } = options;
    
    // 提取用户输入（最后一条用户消息）
    const userInput = messages.filter(m => m.role === 'user').pop()?.content || '';
    
    // 提取历史消息
    const history = messages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content
    }));
    
    try {
      const requestBody: any = {
        inputs: {},
        query: userInput,
        response_mode: stream ? 'streaming' : 'blocking',
        user: 'user-id', // 可自定义
        temperature
      };
      
      // 如果有会话ID，添加到请求中
      if (this.conversationId) {
        requestBody.conversation_id = this.conversationId;
      }
      
      // 只在没有会话ID时添加历史消息
      if (!this.conversationId && history.length > 0) {
        requestBody.history = history;
      }
      
      const response = await fetch(`${this.baseUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (stream) {
        // 处理流式响应
        const reader = response.body?.getReader();
        let fullResponse = '';
        let metaDataProcessed = false;
        
        if (reader) {
          let isDone = false;
          while (!isDone) {
            const { done, value } = await reader.read();
            isDone = done;
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                
                // 保存会话ID (只需处理一次)
                if (!metaDataProcessed && json.conversation_id) {
                  this.conversationId = json.conversation_id;
                  metaDataProcessed = true;
                }
                
                if (json.event === 'message' && json.data) {
                  fullResponse += json.data.answer || '';
                  onMessage?.(json.data.answer || '');
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
          onComplete?.(fullResponse);
        }
      } else {
        const json = await response.json();
        
        // 保存会话ID
        if (json.conversation_id) {
          this.conversationId = json.conversation_id;
        }
        
        const content = json.answer || '';
        onComplete?.(content);
        return content;
      }
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }
}

// GROQ聊天实现
class GroqChat {
  private apiKey: string;
  private groq: any; // Groq实例
  private conversationId = ''; // 添加会话ID存储
  private conversationHistory: Map<string, ChatMessage[]> = new Map(); // 存储不同会话的历史记录
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    
    // 初始化Groq客户端
    this.groq = new Groq({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true
    });
  }
  
  // 重置会话，开始新对话
  resetConversation() {
    this.conversationId = '';
    return this;
  }
  
  // 设置会话ID
  setConversationId(id: string) {
    this.conversationId = id;
    if (!this.conversationHistory.has(id)) {
      this.conversationHistory.set(id, []);
    }
    return this;
  }
  
  // 获取当前会话ID
  getConversationId(): string {
    return this.conversationId;
  }
  
  // 获取当前会话的历史记录
  getConversationHistory(): ChatMessage[] {
    return this.conversationHistory.get(this.conversationId) || [];
  }

  async chat(options: ChatOptions) {
    const { model, messages, temperature, scenario, max_tokens, stream = false, onMessage, onComplete, onError } = options;
    const sampling = buildSamplingPayload(model, {
      temperature,
      scenario: scenario || 'conversation',
    });
    const tokenLimitField = buildTokenLimitPayload(model, max_tokens);
    
    try {
      // 如果没有会话ID，创建一个新的
      if (!this.conversationId) {
        this.conversationId = Date.now().toString();
        this.conversationHistory.set(this.conversationId, []);
      }
      
      // 获取当前会话的历史记录
      const history = this.conversationHistory.get(this.conversationId) || [];
      
      const tokenLimit = model.includes('gpt-4') ? 8000 : 4000; // 根据模型调整
      const optimizedHistory = this.optimizeHistory(history, tokenLimit);
      const allMessages = [...optimizedHistory, ...messages];
      
      // 使用Groq SDK
      if (stream) {
        const stream = await this.groq.chat.completions.create({
          model,
          messages: allMessages,
          ...sampling,
          ...tokenLimitField,
          stream: true
        });
        
        let fullResponse = '';
        for await (const part of stream) {
          const content = part.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            onMessage?.(content);
          }
        }
        
        // 更新会话历史
        if (fullResponse) {
          history.push(...messages); // 添加用户消息
          history.push({ role: 'assistant', content: fullResponse }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        
        onComplete?.(fullResponse);
        return fullResponse;
      } else {
        const completion = await this.groq.chat.completions.create({
          model,
          messages: allMessages,
          ...sampling,
          ...tokenLimitField
        });
        
        const content = completion.choices[0].message.content || '';
        
        // 更新会话历史
        if (content) {
          history.push(...messages); // 添加用户消息
          history.push({ role: 'assistant', content }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        
        onComplete?.(content);
        return content;
      }
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }

  private optimizeHistory(messages: ChatMessage[], maxTokens = 4000): ChatMessage[] {
    // 如果消息数量少，直接返回
    if (messages.length <= 3) return messages;

    // 保留系统消息
    const systemMessages = messages.filter(m => m.role === 'system');
    
    // 获取非系统消息
    let conversationMessages = messages.filter(m => m.role !== 'system');
    
    // 估算当前token数量（简单估算：每4个字符约1个token）
    const estimateTokens = (msgs: ChatMessage[]): number => {
      return msgs.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);
    };
    
    // 如果预估token数量超过限制，开始裁剪历史
    let estimatedTokens = estimateTokens(conversationMessages);
    
    // 保留最新的消息，逐步移除较早的消息对
    while (estimatedTokens > maxTokens && conversationMessages.length > 2) {
      // 移除最早的一对对话（用户+助手）
      conversationMessages = conversationMessages.slice(2);
      estimatedTokens = estimateTokens(conversationMessages);
    }
    
    // 合并系统消息和优化后的对话
    return [...systemMessages, ...conversationMessages];
  }
}

// Ollama聊天实现
class OllamaChat {
  private baseUrl;
  private conversationId = ''; // 移除了`: string`类型注解
  private conversationHistory: Map<string, ChatMessage[]> = new Map(); // 存储不同会话的历史记录
  
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }
  
  // 重置会话，开始新对话
  resetConversation() {
    this.conversationId = '';
    return this;
  }
  
  // 设置会话ID
  setConversationId(id: string) {
    this.conversationId = id;
    if (!this.conversationHistory.has(id)) {
      this.conversationHistory.set(id, []);
    }
    return this;
  }
  
  // 获取当前会话ID
  getConversationId(): string {
    return this.conversationId;
  }
  
  // 获取当前会话的历史记录
  getConversationHistory(): ChatMessage[] {
    return this.conversationHistory.get(this.conversationId) || [];
  }
  
  async chat(options: ChatOptions) {
    const { model, messages, temperature, scenario, stream = false, onMessage, onComplete, onError } = options;
    const resolvedTemperature = resolveTemperature(model, {
      temperature,
      scenario: scenario || 'conversation',
    });
    
    try {
      // 如果没有会话ID，创建一个新的
      if (!this.conversationId) {
        this.conversationId = Date.now().toString();
        this.conversationHistory.set(this.conversationId, []);
      }
      
      // 获取当前会话的历史记录
      const history = this.conversationHistory.get(this.conversationId) || [];
      
      // 合并历史记录和新消息，转换为Ollama的格式
      const allMessages = [...history, ...messages].map(m => ({
        role: m.role,
        content: m.content
      }));
      
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: allMessages,
          // Ollama 只读 `options` 里的采样参数
          ...(resolvedTemperature === undefined
            ? {}
            : { options: { temperature: resolvedTemperature } }),
          stream
        })
      });
      
      if (stream) {
        // 处理流式响应
        const reader = response.body?.getReader();
        let fullResponse = '';
        
        if (reader) {
          let isDone = false;
          while (!isDone) {
            const { done, value } = await reader.read();
            isDone = done;
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
              try {
                const json = JSON.parse(line);
                if (json.message && json.message.content) {
                  const content = json.message.content;
                  fullResponse += content;
                  onMessage?.(content);
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
          
          // 更新会话历史
          if (fullResponse) {
            history.push(...messages); // 添加用户消息
            history.push({ role: 'assistant', content: fullResponse }); // 添加助手回复
            this.conversationHistory.set(this.conversationId, history);
          }
          
          onComplete?.(fullResponse);
        }
      } else {
        const json = await response.json();
        const content = json.message?.content || '';
        
        // 更新会话历史
        if (content) {
          history.push(...messages); // 添加用户消息
          history.push({ role: 'assistant', content }); // 添加助手回复
          this.conversationHistory.set(this.conversationId, history);
        }
        
        onComplete?.(content);
        return content;
      }
    } catch (error) {
      onError?.(error);
      throw error;
    }
  }
}

// ==================== 自动答复相关函数 ====================

import {
  buildAutoReplyPrompt,
  buildLinkedActionSuggestionPrompt,
} from './prompts';

/**
 * 生成自动答复内容
 * @param messageContext 消息上下文
 * @returns 生成的答复内容
 */
export async function generateAutoReply(messageContext: {
    messageContent: string;
    sender: string;
    groupName?: string;
    summary?: string;
    replyTemplate?: string;  // 用户填写的答复模板，用于风格参考
}): Promise<string> {
    const prompt = buildAutoReplyPrompt(messageContext);
    
    try {
        const response = await handleLLMRequest({
            prompt,
            type: 'auto_reply',
            capability: CAPABILITIES.MESSAGE_REACTION,
            feature: 'auto_reply',
        });
        // 清理可能的思考标签
        const cleanedResponse = response
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .trim();
        return cleanedResponse;
    } catch (error) {
        console.error('生成自动答复失败:', error);
        throw error;
    }
}

/**
 * 生成联动操作建议文本
 * @param params 建议生成上下文
 * @returns 一条可编辑的联动操作建议
 */
export async function generateLinkedActionSuggestionText(params: {
  seedPrompt: string;
  sourceType: 'history' | 'sample';
  sourceLabel: string;
  contextLine: string;
  configSignalLine?: string;
}): Promise<string> {
  const prompt = buildLinkedActionSuggestionPrompt(params);

  try {
    const response = await handleLLMRequest({
      prompt,
      type: 'linked_action',
      capability: CAPABILITIES.MESSAGE_REACTION,
      feature: 'linked_action',
    });
    const cleanedResponse = response
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .trim();
    if (!cleanedResponse) {
      throw new Error('empty_linked_action_suggestion');
    }
    return cleanedResponse;
  } catch (error) {
    console.error('生成联动操作建议失败:', error);
    throw error;
  }
}

/**
 * 判断两条消息内容是否语义相似
 * @param content1 消息1
 * @param content2 消息2
 * @returns 是否相似
 */
export async function isContentSimilar(
    content1: string, 
    content2: string
): Promise<boolean> {
    const prompt = `请判断以下两条消息是否表达类似的意思：

消息1：${content1}
消息2：${content2}

如果两条消息的核心意图相似，请回复"相似"，否则回复"不相似"。
只返回一个词，不要其他内容。`;
    
    try {
        const response = await handleLLMRequest({
            prompt,
            type: 'similarity',
            capability: CAPABILITIES.MESSAGE_REACTION,
            feature: 'similarity',
        });
        // 清理可能的思考标签
        const cleanedResponse = response
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .trim();
        return cleanedResponse.includes('相似') && !cleanedResponse.includes('不相似');
    } catch (error) {
        console.error('判断内容相似度失败:', error);
        return false;  // 出错时默认返回不相似，避免错误触发
    }
}

// 导出所有实现
export {
  ChatMessage,
  ChatOptions,
  OpenAIChat,
  DifyChat,
  GroqChat,
  OllamaChat
};
