/**
 * Help Center page script (vanilla TS).
 * Language follows Options via chrome.storage, with optional page-local override.
 */

import {
  DEFAULT_UI_LANGUAGE,
  EXTENSION_UI_PREFERENCES_STORAGE_KEY,
  type UiLanguage,
  type UiPreferences,
} from './i18n';
import { DEFAULT_MEMORY_SERVICE_BASE_URL } from './memoryServiceConfig';
import { DEVICE_KEY_STORAGE, USER_API_KEY_STORAGE } from './deviceApiKey';
import { formatLocalScheduleDateTime } from './scheduled-messages/scheduleDateTime';

type HelpLang = 'zh' | 'en';

type MemoryConnection = {
  apiBase: string;
  origin: string;
  /** Tier-1 service key from Options. Used to call the service, never shown. */
  apiKey: string;
  userId: string;
  hasApiKey: boolean;
  fromStorage: boolean;
  /** Tier-2 personal key: bound to this user, safe to paste into external tools. */
  userKey: StoredUserApiKey | null;
};

type StoredUserApiKey = {
  userId: string;
  id: string;
  token: string;
  keyPrefix: string;
  createdAt: number;
};

const USER_API_KEY_STORAGE_KEY = USER_API_KEY_STORAGE;

const HELP_LANG_OVERRIDE_KEY = 'helpCenterLangOverride';
const HELP_SHARE_SELECTED_KEY = 'helpCenterShareSelected';

const WIKI =
  'https://wiki.ringcentral.com/spaces/XTO/pages/911054301/Personal+AI+-+Tools';
const STORE =
  'https://chromewebstore.google.com/detail/kefnadjndpllbibeklhajjddgmlbafel';

function normalizeApiBase(raw: string): string {
  return raw.trim().replace(/\/+$/, '') || DEFAULT_MEMORY_SERVICE_BASE_URL;
}

function serviceOriginFromApiBase(apiBase: string): string {
  try {
    const url = new URL(apiBase);
    let path = url.pathname.replace(/\/+$/, '');
    if (path.endsWith('/api/v1')) path = path.slice(0, -'/api/v1'.length);
    if (path.endsWith('/api')) path = path.slice(0, -'/api'.length);
    return `${url.origin}${path}` || url.origin;
  } catch {
    return apiBase.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  }
}

function shellQuote(value: string): string {
  if (!value) return "''";
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function readStoredUserKey(
  raw: unknown,
  userId: string,
): StoredUserApiKey | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<StoredUserApiKey>;
  if (!candidate.token || !candidate.id) return null;
  // A key issued for another account must never be surfaced here.
  if (candidate.userId !== userId) return null;
  return {
    userId,
    id: candidate.id,
    token: candidate.token,
    keyPrefix: candidate.keyPrefix || candidate.token.slice(0, 18),
    createdAt: candidate.createdAt || 0,
  };
}

async function loadMemoryConnection(): Promise<MemoryConnection> {
  const fallback: MemoryConnection = {
    apiBase: normalizeApiBase(DEFAULT_MEMORY_SERVICE_BASE_URL),
    origin: serviceOriginFromApiBase(DEFAULT_MEMORY_SERVICE_BASE_URL),
    apiKey: '',
    userId: 'default',
    hasApiKey: false,
    fromStorage: false,
    userKey: null,
  };
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return fallback;
    const result = await chrome.storage.local.get([
      'envConfig',
      'userinfo',
      USER_API_KEY_STORAGE_KEY,
      DEVICE_KEY_STORAGE,
    ]);
    const env = (result.envConfig || {}) as Record<string, unknown>;
    const userinfo = (result.userinfo || {}) as {
      username?: string;
      userEmail?: string;
      email?: string;
    };
    const apiBase = normalizeApiBase(
      typeof env.MEMORY_SERVICE_BASE_URL === 'string' &&
        env.MEMORY_SERVICE_BASE_URL.trim()
        ? env.MEMORY_SERVICE_BASE_URL
        : DEFAULT_MEMORY_SERVICE_BASE_URL,
    );
    const apiKey =
      (typeof env.MEMORY_SERVICE_BOOTSTRAP_KEY === 'string'
        ? env.MEMORY_SERVICE_BOOTSTRAP_KEY.trim()
        : '') ||
      (typeof env.MEMORY_SERVICE_API_KEY === 'string'
        ? env.MEMORY_SERVICE_API_KEY.trim()
        : '');
    const userCandidates = [
      userinfo.username,
      userinfo.userEmail?.split('@')[0],
      userinfo.email?.split('@')[0],
    ];
    let userId = 'default';
    for (const candidate of userCandidates) {
      const normalized = candidate?.trim();
      if (normalized && /^[a-zA-Z0-9._-]+$/.test(normalized)) {
        userId = normalized;
        break;
      }
    }
    return {
      apiBase,
      origin: serviceOriginFromApiBase(apiBase),
      apiKey,
      userId,
      hasApiKey: Boolean(apiKey),
      fromStorage: Boolean(result.envConfig),
      userKey:
        readStoredUserKey(result[USER_API_KEY_STORAGE_KEY], userId) ||
        readStoredUserKey(result[DEVICE_KEY_STORAGE], userId),
    };
  } catch {
    return fallback;
  }
}

function serviceHeaders(conn: MemoryConnection): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Id': conn.userId,
  };
  if (conn.apiKey) headers.Authorization = `Bearer ${conn.apiKey}`;
  return headers;
}

async function fetchUserKeyMetadata(
  conn: MemoryConnection,
): Promise<{ id: string; keyPrefix: string; createdAt: number } | null> {
  const res = await fetch(`${conn.apiBase}/users/me/keys`, {
    headers: serviceHeaders(conn),
  });
  if (!res.ok) throw new Error(`list_failed_${res.status}`);
  const body = (await res.json()) as {
    keys?: Array<{ id: string; keyPrefix: string; createdAt: number }>;
  };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  // Prefer the key already stored on this device; otherwise the newest.
  if (conn.userKey?.id) {
    const match = keys.find((k) => k.id === conn.userKey!.id);
    if (match) return match;
  }
  return keys[0] ?? null;
}

async function issueUserKey(conn: MemoryConnection): Promise<StoredUserApiKey> {
  const res = await fetch(`${conn.apiBase}/users/me/keys`, {
    method: 'POST',
    headers: serviceHeaders(conn),
    body: JSON.stringify({ label: 'Context Pack' }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `issue_failed_${res.status}`);
  }
  const body = (await res.json()) as {
    token: string;
    key: { id: string; keyPrefix: string; createdAt: number };
  };
  const stored: StoredUserApiKey = {
    userId: conn.userId,
    id: body.key.id,
    token: body.token,
    keyPrefix: body.key.keyPrefix,
    createdAt: body.key.createdAt,
  };
  await chrome.storage.local.set({ [USER_API_KEY_STORAGE_KEY]: stored });
  return stored;
}

async function revokeUserKey(conn: MemoryConnection, id: string): Promise<void> {
  await fetch(`${conn.apiBase}/users/me/keys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: serviceHeaders(conn),
  });
  await chrome.storage.local.remove(USER_API_KEY_STORAGE_KEY);
}

async function fetchContextPack(
  conn: MemoryConnection,
  scope: string,
  query?: string,
): Promise<{ prompt: string; meta: string; ok: boolean; detail?: string }> {
  const params = new URLSearchParams({ scope });
  if (scope === 'custom' && query) params.set('q', query);
  // Prefer the personal key (binds the user). Fall back to service key + X-User-Id.
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (conn.userKey?.token) {
    headers.Authorization = `Bearer ${conn.userKey.token}`;
  } else {
    Object.assign(headers, serviceHeaders(conn));
  }
  try {
    const res = await fetch(`${conn.apiBase}/context-pack?${params.toString()}`, {
      headers,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return {
        prompt: '',
        meta: '',
        ok: false,
        detail: detail || `HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as {
      prompt?: string;
      scope?: string;
      redactionReceipt?: { applied?: boolean; note?: string };
      experimental?: boolean;
    };
    const receipt = body.redactionReceipt?.applied
      ? ' · redacted'
      : body.redactionReceipt?.note
        ? ''
        : '';
    const experimental = body.experimental ? ' · experimental' : '';
    return {
      prompt: body.prompt || '',
      meta: `live · scope=${body.scope || scope}${receipt}${experimental}`,
      ok: true,
    };
  } catch (err) {
    return {
      prompt: '',
      meta: '',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

const PRESETS: Record<
  string,
  { zh: string; en: string; meta: { zh: string; en: string }; scope: string }
> = {
  identity: {
    zh: '# Persona Context — 拉取于今天 09:42\n你正在协助的用户具备以下身份与偏好:\n- 身份:RingCentral 敏捷教练 / Scrum Master,负责跨团队协同\n- 沟通偏好:中文为主、结论先行;代码示例用 TypeScript\n- 当前重点:Personal AI 记忆平台、Sprint 排期与依赖跟进\n- 边界:不要代发消息或创建外部任务,先给预览',
    en: '# Persona Context — pulled today 09:42\nThe user you are assisting has this identity and these preferences:\n- Role: RingCentral agile coach / Scrum Master, driving cross-team coordination\n- Communication: Chinese first, conclusion first; TypeScript for code samples\n- Current focus: Personal AI memory platform, sprint planning and dependency tracking\n- Boundaries: never send messages or create external tasks — always preview first',
    meta: {
      zh: '来源:用户画像(身份投影,已脱敏) · scope=identity_preferences',
      en: 'Source: user profile (identity projection, redacted) · scope=identity_preferences',
    },
    scope: 'identity_preferences',
  },
  recent: {
    zh: '# Recent Focus — 滚动更新\n- 帮助中心页面设计中,等待 review\n- 商家认证账号审核:等平台结果,Rebecca 跟进中\n- 下个 Sprint 评审材料:周四前需要 timeline 截图\n- Memory Service v2 迁移:context-pack 单接口方案已定稿',
    en: '# Recent Focus — rolling\n- Help center page in design, awaiting review\n- Merchant verification: waiting on the platform, Rebecca following up\n- Next sprint review deck: timeline screenshot needed by Thursday\n- Memory Service v2 migration: single context-pack endpoint finalized',
    meta: {
      zh: '来源:Recent Focus 滚动上下文 · scope=recent_focus',
      en: 'Source: rolling recent-focus context · scope=recent_focus',
    },
    scope: 'recent_focus',
  },
  today: {
    zh: '# Today — 今日安排与待闭环\n- 10:00 敏捷教练周会:待闭环——认证材料截图是否同步\n- 14:00 1:1 with Stephen:上次遗留——认证流程结论\n- 今日 Top:评审材料初稿、回复平台审核邮件',
    en: '# Today — schedule and open loops\n- 10:00 agile coach weekly: open loop — has the verification screenshot been shared?\n- 14:00 1:1 with Stephen: leftover — conclusion on the verification flow\n- Top today: first draft of the review deck, reply to the platform review email',
    meta: {
      zh: '来源:Today Pilot 当日简报 · scope=today',
      en: 'Source: Today Pilot daily brief · scope=today',
    },
    scope: 'today',
  },
  projects: {
    zh: '# Focus Project Updates — 重点项目动态\n- [Personal AI] 帮助中心进入 review;v9.0.0 已发布\n- [商家认证] 平台审核中,预计今天上午出结果\n- [Roadmap Q3] 两个 milestone 已回填 Jira key',
    en: '# Focus Project Updates\n- [Personal AI] Help center in review; v9.0.0 shipped\n- [Merchant verification] Under platform review, result expected this morning\n- [Roadmap Q3] Two milestones now backfilled with Jira keys',
    meta: {
      zh: '来源:watched projects 快照 · scope=projects',
      en: 'Source: watched-projects snapshot · scope=projects',
    },
    scope: 'projects',
  },
  custom: {
    zh: '(输入自定义主题后点「复制 Prompt」——演示环境返回模拟结果)\n\n# Personal AI 项目的近期动态\n- 最近发布:v9.0.0(Personal Roadmap 协作规划)\n- 进行中:扩展帮助中心(三板块引导)\n- 近期讨论:记忆外接命名与预设/自定义混合方案',
    en: '(Type a topic, then copy — this demo returns a canned result)\n\n# Recent activity on the Personal AI project\n- Latest release: v9.0.0 (Personal Roadmap collaborative planning)\n- In progress: extension help center (three-section guide)\n- Under discussion: Context Pack naming and the preset/custom mix',
    meta: {
      zh: '来源:记忆检索(实验性) · scope=custom&q=…',
      en: 'Source: memory retrieval (experimental) · scope=custom&q=…',
    },
    scope: 'custom',
  },
};

type DemoPreview = {
  label: { zh: string; en: string };
  body: { zh: string; en: string };
  meta: { zh: string; en: string };
};

const MCP_PREVIEWS: Record<string, DemoPreview> = {
  memory_context_brief: {
    label: { zh: 'memory_context_brief', en: 'memory_context_brief' },
    body: {
      zh: '{\n  "brief": "Personal AI: 帮助中心已支持 REST/MCP/A2A 三路外接;MCP 工具含 memory_search / memory_ask / memory_context_brief…;写操作走完整 salience 管线。",\n  "evidenceIds": ["chunk:help-1", "message:glip-8821"],\n  "tokenEstimate": 420\n}',
      en: '{\n  "brief": "Personal AI: Help center now covers REST/MCP/A2A wiring; MCP tools include memory_search / memory_ask / memory_context_brief…; writes go through the full salience pipeline.",\n  "evidenceIds": ["chunk:help-1", "message:glip-8821"],\n  "tokenEstimate": 420\n}',
    },
    meta: {
      zh: '演示 · tools/call memory_context_brief · 只读摘要',
      en: 'Demo · tools/call memory_context_brief · read-only brief',
    },
  },
  memory_profile_hint: {
    label: { zh: 'memory_profile_hint', en: 'memory_profile_hint' },
    body: {
      zh: '{\n  "aspect": "沟通风格",\n  "insight": "偏好中文、结论先行;代码示例倾向 TypeScript;对外回复前希望先看预览。",\n  "confidence": 0.82\n}',
      en: '{\n  "aspect": "communication style",\n  "insight": "Prefers Chinese, conclusion-first; TypeScript for code samples; wants a preview before outbound replies.",\n  "confidence": 0.82\n}',
    },
    meta: {
      zh: '演示 · tools/call memory_profile_hint · 画像洞察(非原文行)',
      en: 'Demo · tools/call memory_profile_hint · profile insight (not raw rows)',
    },
  },
  memory_search: {
    label: { zh: 'memory_search', en: 'memory_search' },
    body: {
      zh: '{\n  "items": [\n    {\n      "evidenceId": "message:glip-8821",\n      "summary": "定稿帮助页记忆外接支持 REST / MCP / A2A 切换展示",\n      "channel": "Glip · #personal-ai",\n      "timeCredibility": "day"\n    }\n  ],\n  "receipt": { "channelsCovered": ["glip"], "redacted": true }\n}',
      en: '{\n  "items": [\n    {\n      "evidenceId": "message:glip-8821",\n      "summary": "Help Context Pack section will switch REST / MCP / A2A",\n      "channel": "Glip · #personal-ai",\n      "timeCredibility": "day"\n    }\n  ],\n  "receipt": { "channelsCovered": ["glip"], "redacted": true }\n}',
    },
    meta: {
      zh: '演示 · tools/call memory_search · 稳定 evidenceId + 脱敏摘要',
      en: 'Demo · tools/call memory_search · stable evidenceId + redacted summary',
    },
  },
  memory_ask: {
    label: { zh: 'memory_ask', en: 'memory_ask' },
    body: {
      zh: '{\n  "answer": "记忆外接帮助条目用协议 Tab 区分 REST Prompt、MCP 工具与 A2A Agent Card;MCP/A2A 在页内只演示返回形态,不发起真连接。",\n  "evidenceIds": ["chunk:help-1"],\n  "receipt": { "mode": "qa", "redacted": true }\n}',
      en: '{\n  "answer": "The Context Pack help card uses protocol tabs for REST prompts, MCP tools, and the A2A Agent Card; MCP/A2A demos are shape-only and do not open live connections.",\n  "evidenceIds": ["chunk:help-1"],\n  "receipt": { "mode": "qa", "redacted": true }\n}',
    },
    meta: {
      zh: '演示 · tools/call memory_ask · 带来源回执的问答',
      en: 'Demo · tools/call memory_ask · Q&A with evidence receipts',
    },
  },
};

const A2A_PREVIEWS: Record<string, DemoPreview> = {
  agent_card: {
    label: { zh: 'Agent Card', en: 'Agent Card' },
    body: {
      zh: '{\n  "name": "Personal AI Memory Agent",\n  "url": "{memory-service}/a2a",\n  "preferredTransport": "JSONRPC",\n  "skills": [\n    { "id": "memory-recall", "name": "Memory recall" },\n    { "id": "agent-task", "name": "Delegated agent task" }\n  ],\n  "securitySchemes": { "bearer": { "type": "http", "scheme": "bearer" } }\n}',
      en: '{\n  "name": "Personal AI Memory Agent",\n  "url": "{memory-service}/a2a",\n  "preferredTransport": "JSONRPC",\n  "skills": [\n    { "id": "memory-recall", "name": "Memory recall" },\n    { "id": "agent-task", "name": "Delegated agent task" }\n  ],\n  "securitySchemes": { "bearer": { "type": "http", "scheme": "bearer" } }\n}',
    },
    meta: {
      zh: '演示 · GET /.well-known/agent-card.json · 发现文档',
      en: 'Demo · GET /.well-known/agent-card.json · discovery',
    },
  },
  task_receipt: {
    label: { zh: '任务回执', en: 'Task receipt' },
    body: {
      zh: '{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "result": {\n    "id": "act_demo_01",\n    "contextId": "ctx_demo",\n    "status": {\n      "state": "completed",\n      "message": {\n        "role": "agent",\n        "parts": [{ "type": "text", "text": "上周与 Nova 定了单接口 context-pack + scope 参数。" }]\n      }\n    }\n  }\n}',
      en: '{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "result": {\n    "id": "act_demo_01",\n    "contextId": "ctx_demo",\n    "status": {\n      "state": "completed",\n      "message": {\n        "role": "agent",\n        "parts": [{ "type": "text", "text": "Last week you settled on a single context-pack endpoint with a scope parameter for Nova." }]\n      }\n    }\n  }\n}',
    },
    meta: {
      zh: '演示 · message/send 完成后的 JSON-RPC 回执 · 非真入队',
      en: 'Demo · JSON-RPC receipt after message/send · not a real enqueue',
    },
  },
};

type TakeawaySnippet = {
  label: { zh: string; en: string };
  build: (conn: MemoryConnection) => string;
};

const USER_KEY_PLACEHOLDER = '<PERSONAL_API_KEY>';

/**
 * Snippets always hand out the personal key, never the service key from
 * Options — pasting the latter into a third-party tool would grant it access
 * to every user's memory.
 */
function takeawayAuth(conn: MemoryConnection): string {
  return conn.userKey?.token || USER_KEY_PLACEHOLDER;
}

const MCP_TAKEAWAYS: Record<string, TakeawaySnippet> = {
  cursor_http: {
    label: { zh: 'Cursor HTTP', en: 'Cursor HTTP' },
    build: (conn) =>
      JSON.stringify(
        {
          mcpServers: {
            'personal-memory': {
              url: `${conn.origin}/mcp`,
              headers: {
                Authorization: `Bearer ${takeawayAuth(conn)}`,
                'X-User-Id': conn.userId,
              },
            },
          },
        },
        null,
        2,
      ),
  },
  claude_stdio: {
    label: { zh: 'Claude stdio', en: 'Claude stdio' },
    build: (conn) => {
      const parts = [
        'claude mcp add personal-memory -- node memory-service/mcp-server.mjs',
        `  --user-id ${shellQuote(conn.userId)}`,
        `  --base-url ${shellQuote(conn.origin)}`,
        '  --scopes work',
      ];
      parts.push(`  --api-key ${shellQuote(takeawayAuth(conn))}`);
      return parts.join(' \\\n');
    },
  },
  curl_list: {
    label: { zh: 'curl 发现', en: 'curl discover' },
    build: (conn) => {
      const auth = takeawayAuth(conn);
      return [
        `curl -sS ${shellQuote(`${conn.origin}/mcp`)} \\`,
        `  -H ${shellQuote(`Authorization: Bearer ${auth}`)} \\`,
        `  -H ${shellQuote(`X-User-Id: ${conn.userId}`)}`,
      ].join('\n');
    },
  },
};

const A2A_TAKEAWAYS: Record<string, TakeawaySnippet> = {
  agent_card: {
    label: { zh: 'Agent Card', en: 'Agent Card' },
    build: (conn) => {
      const auth = takeawayAuth(conn);
      return [
        `curl -sS ${shellQuote(`${conn.origin}/.well-known/agent-card.json`)} \\`,
        `  -H ${shellQuote(`Authorization: Bearer ${auth}`)} \\`,
        `  -H ${shellQuote(`X-User-Id: ${conn.userId}`)}`,
      ].join('\n');
    },
  },
  message_send: {
    label: { zh: 'message/send', en: 'message/send' },
    build: (conn) => {
      const auth = takeawayAuth(conn);
      const body = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'message/send',
        params: {
          message: {
            role: 'user',
            parts: [
              {
                type: 'text',
                text: 'What did I decide about Nova last week?',
              },
            ],
          },
        },
      });
      return [
        `curl -sS -X POST ${shellQuote(`${conn.origin}/a2a`)} \\`,
        `  -H ${shellQuote('Content-Type: application/json')} \\`,
        `  -H ${shellQuote(`Authorization: Bearer ${auth}`)} \\`,
        `  -H ${shellQuote(`X-User-Id: ${conn.userId}`)} \\`,
        `  --data ${shellQuote(body)}`,
      ].join('\n');
    },
  },
};

const REC: Record<string, { zh: [string, string]; en: [string, string] }> = {
  'context-pack': {
    zh: ['记忆外接', 'REST / MCP / A2A 三路把记忆接到外部 AI'],
    en: [
      'Context Pack',
      'wire memory out via REST, MCP, or A2A',
    ],
  },
  'ask-ai': { zh: ['记忆查询', ''], en: ['Ask', ''] },
  'memory-lens': {
    zh: ['记忆提示', '浏览网页时自动浮出相关记忆'],
    en: ['Memory Lens', 'related memories surface as you browse'],
  },
  compose: {
    zh: ['回复助手', '输入框旁按你的风格给草稿'],
    en: ['Compose Assist', 'drafts beside the composer, in your voice'],
  },
  today: {
    zh: ['今日领航', '每天先看 Top 3 和会前准备'],
    en: ['Today Pilot', 'start the day with Top 3 and meeting prep'],
  },
  meeting: {
    zh: ['会议弹幕', '提醒直接飘在会议画面上,会后一页回放'],
    en: [
      'Meeting Pilot',
      'nudges drift over the meeting view, one-page replay after',
    ],
  },
  'jira-links': {
    zh: [
      'Jira 设计稿与后端依赖',
      '在 User Story 上直接看到设计入口和后端上线日期',
    ],
    en: [
      'Jira design & backend dates',
      'design entries and backend ship dates right on the story',
    ],
  },
  'scheduled-messages': {
    zh: ['定时消息管理', '可以假装"我"定时发消息,也可以管理 AI report'],
    en: [
      'Scheduled messages',
      'send later as yourself, and manage AI reports',
    ],
  },
  reaction: {
    zh: ['消息联动操作', '稍后提醒、自动回复,联动 OpenClaw 执行任务'],
    en: [
      'Message actions',
      'snooze, auto-reply, and run tasks via OpenClaw',
    ],
  },
  doubao: {
    zh: ['豆包互联', '手机上的豆包也能用你的记忆'],
    en: [
      'Memory on mobile',
      'your memory, available in Doubao on your phone',
    ],
  },
  capture: {
    zh: ['划词记住', '选中文字一键存为资料记忆'],
    en: ['Selection save', 'select text and keep it as a source memory'],
  },
  'message-analysis': {
    zh: ['消息分析入库', '分析过滤出我感兴趣的话题'],
    en: ['Message analysis', 'filters out the topics you care about'],
  },
  'import-ai': {
    zh: ['外部 AI 导入', '把 ChatGPT/Claude 历史带进记忆库'],
    en: [
      'Import AI history',
      'bring ChatGPT/Claude history into memory',
    ],
  },
  profile: {
    zh: ['用户画像', '看它眼里的你,可修正可导出'],
    en: ['Your profile', 'see how it models you — correct or export it'],
  },
  backup: {
    zh: ['记忆备份', '一键下载全部记忆的 backup zip,换机也不怕丢'],
    en: [
      'Memory backup',
      'one click to download a backup zip of everything',
    ],
  },
};

function uiLanguageToHelpLang(language: UiLanguage | undefined): HelpLang {
  return language === 'en-US' ? 'en' : 'zh';
}

function readLocalOverride(): HelpLang | null {
  try {
    const saved = localStorage.getItem(HELP_LANG_OVERRIDE_KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch {
    // ignore
  }
  return null;
}

function writeLocalOverride(lang: HelpLang | null): void {
  try {
    if (!lang) localStorage.removeItem(HELP_LANG_OVERRIDE_KEY);
    else localStorage.setItem(HELP_LANG_OVERRIDE_KEY, lang);
  } catch {
    // ignore
  }
}

async function readOptionsLanguage(): Promise<HelpLang> {
  try {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return 'zh';
    }
    const result = await chrome.storage.local.get([
      EXTENSION_UI_PREFERENCES_STORAGE_KEY,
    ]);
    const prefs = result[EXTENSION_UI_PREFERENCES_STORAGE_KEY] as
      | UiPreferences
      | undefined;
    return uiLanguageToHelpLang(prefs?.language || DEFAULT_UI_LANGUAGE);
  } catch {
    return 'zh';
  }
}

function revealPage(): void {
  document.documentElement.style.visibility = '';
}

function initHelpPage(): void {
  const root = document.getElementById('root');
  if (!root) {
    revealPage();
    return;
  }

  let pageOverride: HelpLang | null = readLocalOverride();
  let optionsLang: HelpLang = 'zh';
  let renderPrompt: () => void = () => undefined;
  let renderTray: () => void = () => undefined;
  let updateSendUi: () => void = () => undefined;
  let scheduledMsgReady = false;
  let isSending = false;

  const isEn = () => root.getAttribute('data-l') === 'en';

  const applyLang = (
    lang: HelpLang,
    { persistOverride }: { persistOverride?: boolean } = {},
  ) => {
    root.setAttribute('data-l', lang);
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    if (persistOverride) {
      pageOverride = lang;
      writeLocalOverride(lang);
    }
    renderPrompt();
    renderTray();
    updateSendUi();
  };

  const setLang = (lang: HelpLang) => {
    applyLang(lang, { persistOverride: true });
    syncLangResetVisibility();
  };

  const clearLangOverride = () => {
    pageOverride = null;
    writeLocalOverride(null);
    applyLang(optionsLang);
    syncLangResetVisibility();
  };

  const syncLangResetVisibility = () => {
    const reset = document.getElementById('langReset');
    if (reset) reset.hidden = !pageOverride;
  };

  (window as unknown as { setLang: (l: HelpLang) => void }).setLang = setLang;

  document.querySelectorAll('.lang-zh').forEach((btn) => {
    btn.addEventListener('click', () => setLang('zh'));
  });
  document.querySelectorAll('.lang-en').forEach((btn) => {
    btn.addEventListener('click', () => setLang('en'));
  });
  document.getElementById('langReset')?.addEventListener('click', () => {
    clearLangOverride();
  });
  syncLangResetVisibility();

  // Apply sync override immediately to avoid wrong-language flash
  if (pageOverride) {
    root.setAttribute('data-l', pageOverride);
    document.documentElement.lang = pageOverride === 'en' ? 'en' : 'zh-CN';
  }

  /* ===== 记忆外接 ===== */
  const presetSel = document.getElementById('feedPreset') as HTMLSelectElement | null;
  const customInput = document.getElementById('feedCustom') as HTMLInputElement | null;
  const customHint = document.getElementById('customHint');
  const promptText = document.getElementById('promptText');
  const promptMeta = document.getElementById('promptMeta');
  const restTakeawayText = document.getElementById('restTakeawayText');
  const restConnHint = document.getElementById('restConnHint');
  const mcpTakeawayText = document.getElementById('mcpTakeawayText');
  const mcpConnHint = document.getElementById('mcpConnHint');
  const mcpTakeawayChips = document.getElementById('mcpTakeawayChips');
  const mcpChips = document.getElementById('mcpToolChips');
  const mcpPreviewText = document.getElementById('mcpPreviewText');
  const mcpPreviewMeta = document.getElementById('mcpPreviewMeta');
  const a2aTakeawayText = document.getElementById('a2aTakeawayText');
  const a2aConnHint = document.getElementById('a2aConnHint');
  const a2aTakeawayChips = document.getElementById('a2aTakeawayChips');
  const a2aChips = document.getElementById('a2aPreviewChips');
  const a2aPreviewText = document.getElementById('a2aPreviewText');
  const a2aPreviewMeta = document.getElementById('a2aPreviewMeta');

  let memoryConn: MemoryConnection = {
    apiBase: normalizeApiBase(DEFAULT_MEMORY_SERVICE_BASE_URL),
    origin: serviceOriginFromApiBase(DEFAULT_MEMORY_SERVICE_BASE_URL),
    apiKey: '',
    userId: 'default',
    hasApiKey: false,
    fromStorage: false,
    userKey: null,
  };
  let mcpToolKey = 'memory_context_brief';
  let a2aPreviewKey = 'agent_card';
  let mcpTakeawayKey = 'cursor_http';
  let a2aTakeawayKey = 'agent_card';
  let renderMcpPreview: () => void = () => undefined;
  let renderA2aPreview: () => void = () => undefined;
  let renderTakeaways: () => void = () => undefined;
  let renderUserKeyCard: (busyMessage?: string) => void = () => undefined;

  const wireChipGroup = (
    host: HTMLElement | null,
    keys: string[],
    getLabel: (key: string, en: boolean) => string,
    getActive: () => string,
    setActive: (key: string) => void,
    onChange: () => void,
  ) => {
    if (!host) return;
    host.replaceChildren();
    for (const key of keys) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tool-chip' + (getActive() === key ? ' active' : '');
      btn.dataset.key = key;
      btn.textContent = getLabel(key, isEn());
      btn.addEventListener('click', () => {
        setActive(key);
        host.querySelectorAll('.tool-chip').forEach((node) => {
          const el = node as HTMLButtonElement;
          el.classList.toggle('active', el.dataset.key === key);
        });
        onChange();
      });
      host.appendChild(btn);
    }
  };

  const refreshChipLabels = (
    host: HTMLElement | null,
    getLabel: (key: string, en: boolean) => string,
  ) => {
    if (!host) return;
    const en = isEn();
    host.querySelectorAll('.tool-chip').forEach((node) => {
      const el = node as HTMLButtonElement;
      const key = el.dataset.key || '';
      el.textContent = getLabel(key, en);
    });
  };

  const connHintText = (en: boolean) => {
    if (!memoryConn.userKey) {
      return en
        ? `No access key yet — click "Create access key" above and the snippets will fill themselves in. Host ${memoryConn.origin} · user ${memoryConn.userId}.`
        : `还没有外接 key——点上方「生成外接 key」后,下面的片段会自动填好。地址 ${memoryConn.origin} · 用户 ${memoryConn.userId}。`;
    }
    return en
      ? `${memoryConn.origin} · user ${memoryConn.userId} · personal key included, scoped to you alone (do not forward)`
      : `${memoryConn.origin} · 用户 ${memoryConn.userId} · 已含只属于你的个人 key(勿转发给他人)`;
  };

  const buildRestTakeaway = (): string => {
    const preset = PRESETS[presetSel?.value || 'identity'] || PRESETS.identity;
    const auth = takeawayAuth(memoryConn);
    const query =
      preset.scope === 'custom'
        ? `scope=custom&q=${encodeURIComponent(
            (customInput?.value || '').trim() || 'Personal AI',
          )}`
        : `scope=${preset.scope}`;
    const url = `${memoryConn.apiBase}/context-pack?${query}`;
    return [
      `curl -sS ${shellQuote(url)} \\`,
      `  -H ${shellQuote(`Authorization: Bearer ${auth}`)} \\`,
      `  -H ${shellQuote(`X-User-Id: ${memoryConn.userId}`)}`,
    ].join('\n');
  };

  renderTakeaways = () => {
    if (restTakeawayText) restTakeawayText.textContent = buildRestTakeaway();
    if (mcpTakeawayText) {
      mcpTakeawayText.textContent =
        MCP_TAKEAWAYS[mcpTakeawayKey]?.build(memoryConn) || '';
    }
    if (a2aTakeawayText) {
      a2aTakeawayText.textContent =
        A2A_TAKEAWAYS[a2aTakeawayKey]?.build(memoryConn) || '';
    }
    const hint = connHintText(isEn());
    const missingKey = !memoryConn.userKey;
    for (const node of [restConnHint, mcpConnHint, a2aConnHint]) {
      if (!node) continue;
      node.textContent = hint;
      node.classList.toggle('warn', missingKey);
    }
    refreshChipLabels(mcpTakeawayChips, (key, en) =>
      en
        ? MCP_TAKEAWAYS[key]?.label.en || key
        : MCP_TAKEAWAYS[key]?.label.zh || key,
    );
    refreshChipLabels(a2aTakeawayChips, (key, en) =>
      en
        ? A2A_TAKEAWAYS[key]?.label.en || key
        : A2A_TAKEAWAYS[key]?.label.zh || key,
    );
  };

  renderMcpPreview = () => {
    if (!mcpPreviewText || !mcpPreviewMeta) return;
    const item = MCP_PREVIEWS[mcpToolKey];
    if (!item) return;
    const en = isEn();
    mcpPreviewText.textContent = en ? item.body.en : item.body.zh;
    mcpPreviewMeta.textContent = en ? item.meta.en : item.meta.zh;
    refreshChipLabels(mcpChips, (key, enLang) =>
      enLang
        ? MCP_PREVIEWS[key]?.label.en || key
        : MCP_PREVIEWS[key]?.label.zh || key,
    );
  };

  renderA2aPreview = () => {
    if (!a2aPreviewText || !a2aPreviewMeta) return;
    const item = A2A_PREVIEWS[a2aPreviewKey];
    if (!item) return;
    const en = isEn();
    a2aPreviewText.textContent = (en ? item.body.en : item.body.zh).split(
      '{memory-service}',
    ).join(memoryConn.origin);
    a2aPreviewMeta.textContent = en ? item.meta.en : item.meta.zh;
    refreshChipLabels(a2aChips, (key, enLang) =>
      enLang
        ? A2A_PREVIEWS[key]?.label.en || key
        : A2A_PREVIEWS[key]?.label.zh || key,
    );
  };

  wireChipGroup(
    mcpTakeawayChips,
    Object.keys(MCP_TAKEAWAYS),
    (key, en) =>
      en
        ? MCP_TAKEAWAYS[key]?.label.en || key
        : MCP_TAKEAWAYS[key]?.label.zh || key,
    () => mcpTakeawayKey,
    (key) => {
      mcpTakeawayKey = key;
    },
    () => renderTakeaways(),
  );
  wireChipGroup(
    a2aTakeawayChips,
    Object.keys(A2A_TAKEAWAYS),
    (key, en) =>
      en
        ? A2A_TAKEAWAYS[key]?.label.en || key
        : A2A_TAKEAWAYS[key]?.label.zh || key,
    () => a2aTakeawayKey,
    (key) => {
      a2aTakeawayKey = key;
    },
    () => renderTakeaways(),
  );
  wireChipGroup(
    mcpChips,
    Object.keys(MCP_PREVIEWS),
    (key, en) =>
      en
        ? MCP_PREVIEWS[key]?.label.en || key
        : MCP_PREVIEWS[key]?.label.zh || key,
    () => mcpToolKey,
    (key) => {
      mcpToolKey = key;
    },
    () => renderMcpPreview(),
  );
  wireChipGroup(
    a2aChips,
    Object.keys(A2A_PREVIEWS),
    (key, en) =>
      en
        ? A2A_PREVIEWS[key]?.label.en || key
        : A2A_PREVIEWS[key]?.label.zh || key,
    () => a2aPreviewKey,
    (key) => {
      a2aPreviewKey = key;
    },
    () => renderA2aPreview(),
  );

  let promptFetchToken = 0;

  renderPrompt = () => {
    if (!presetSel || !promptText || !promptMeta || !customInput || !customHint) {
      renderTakeaways();
      renderMcpPreview();
      renderA2aPreview();
      return;
    }
    const p = PRESETS[presetSel.value];
    if (!p) return;
    const en = isEn();
    Array.from(presetSel.options).forEach((o) => {
      o.textContent = o.getAttribute(en ? 'data-en' : 'data-zh') || o.textContent;
    });
    customInput.placeholder = en
      ? 'Recent activity on the Personal AI project'
      : 'Personal AI 项目的近期动态';
    const isCustom = presetSel.value === 'custom';
    customInput.classList.toggle('visible', isCustom);
    customHint.style.display = isCustom ? 'block' : 'none';

    // Show demo immediately, then replace with live pack when the service answers.
    promptText.textContent = en ? p.en : p.zh;
    promptMeta.textContent =
      (en ? p.meta.en : p.meta.zh) +
      (en ? ' · loading live…' : ' · 正在拉取…');

    const token = ++promptFetchToken;
    const customQ = (customInput.value || '').trim();
    if (isCustom && !customQ) {
      promptMeta.textContent = en
        ? 'Enter a topic above, then the live pack will load · experimental'
        : '先在上方输入主题,再拉取实时结果 · 实验性';
    } else {
      void fetchContextPack(memoryConn, p.scope, customQ).then((live) => {
        if (token !== promptFetchToken) return;
        if (live.ok && live.prompt) {
          promptText.textContent = live.prompt;
          promptMeta.textContent = live.meta;
        } else {
          promptMeta.textContent =
            (en ? p.meta.en : p.meta.zh) +
            (en
              ? ` · demo fallback (${live.detail || 'unreachable'})`
              : ` · 演示回退(${live.detail || '不可达'})`);
        }
      });
    }

    renderTakeaways();
    renderMcpPreview();
    renderA2aPreview();
    renderUserKeyCard();
  };

  presetSel?.addEventListener('change', () => renderPrompt());
  let customDebounce: ReturnType<typeof setTimeout> | null = null;
  customInput?.addEventListener('input', () => {
    if (presetSel?.value !== 'custom') return;
    renderTakeaways();
    if (customDebounce) clearTimeout(customDebounce);
    customDebounce = setTimeout(() => renderPrompt(), 400);
  });

  document.querySelectorAll('.proto-tab').forEach((node) => {
    const tab = node as HTMLButtonElement;
    tab.addEventListener('click', () => {
      const proto = tab.getAttribute('data-proto') || 'rest';
      document.querySelectorAll('.proto-tab').forEach((other) => {
        const el = other as HTMLButtonElement;
        const on = el.getAttribute('data-proto') === proto;
        el.classList.toggle('active', on);
        el.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      document.querySelectorAll('.proto-pane').forEach((pane) => {
        pane.classList.toggle(
          'active',
          pane.getAttribute('data-proto-pane') === proto,
        );
      });
    });
  });

  const flashCopied = (btn: HTMLButtonElement, keep: string) => {
    btn.textContent = '✓';
    setTimeout(() => {
      btn.textContent = keep;
    }, 1400);
  };

  const bindCopy = (
    btnId: string,
    getText: () => string | null | undefined,
    successLabel?: () => string,
  ) => {
    document.getElementById(btnId)?.addEventListener('click', function onCopy() {
      const text = getText();
      if (!text) return;
      const b = this as HTMLButtonElement;
      const keep = successLabel ? b.innerHTML : b.textContent || 'copy';
      void navigator.clipboard.writeText(text).then(() => {
        if (successLabel) {
          b.textContent = successLabel();
          setTimeout(() => {
            b.innerHTML = keep;
          }, 1400);
        } else {
          flashCopied(b, keep);
        }
      });
    });
  };

  bindCopy('copyRestTakeaway', () => restTakeawayText?.textContent, () =>
    isEn() ? '✅ Copied' : '✅ 已复制',
  );
  bindCopy('copyRestTakeawayMini', () => restTakeawayText?.textContent);
  bindCopy('copyMcpTakeaway', () => mcpTakeawayText?.textContent, () =>
    isEn() ? '✅ Copied' : '✅ 已复制',
  );
  bindCopy('copyMcpTakeawayMini', () => mcpTakeawayText?.textContent);
  bindCopy('copyA2aTakeaway', () => a2aTakeawayText?.textContent, () =>
    isEn() ? '✅ Copied' : '✅ 已复制',
  );
  bindCopy('copyA2aTakeawayMini', () => a2aTakeawayText?.textContent);
  bindCopy('copyMcpPreview', () => mcpPreviewText?.textContent);
  bindCopy('copyA2aPreview', () => a2aPreviewText?.textContent);

  (window as unknown as { copyPromptText: (btn: HTMLButtonElement) => void }).copyPromptText =
    (btn: HTMLButtonElement) => {
      if (!promptText) return;
      void navigator.clipboard.writeText(promptText.textContent || '').then(() => {
        flashCopied(btn, 'copy');
      });
    };

  /* ===== 外接 key（tier-2 个人凭证） ===== */
  const userKeyStatus = document.getElementById('userKeyStatus');
  const userKeyHint = document.getElementById('userKeyHint');
  const userKeyValue = document.getElementById('userKeyValue');
  const userKeyText = document.getElementById('userKeyText');
  const userKeyIssue = document.getElementById('userKeyIssue') as HTMLButtonElement | null;
  const userKeyRevoke = document.getElementById('userKeyRevoke') as HTMLButtonElement | null;

  renderUserKeyCard = (busyMessage?: string) => {
    const en = isEn();
    const key = memoryConn.userKey;
    if (userKeyStatus) {
      userKeyStatus.textContent = key
        ? en
          ? `Active key ${key.keyPrefix}… · read-only · bound to ${memoryConn.userId}`
          : `已有 key ${key.keyPrefix}… · 只读 · 绑定 ${memoryConn.userId}`
        : en
          ? `No access key for ${memoryConn.userId} yet`
          : `${memoryConn.userId} 还没有外接 key`;
    }
    if (userKeyValue) userKeyValue.hidden = !key;
    if (userKeyText) userKeyText.textContent = key?.token || '';
    if (userKeyRevoke) userKeyRevoke.hidden = !key;
    if (userKeyIssue) {
      const label = key
        ? en ? 'Rotate key' : '重新生成'
        : en ? 'Create access key' : '生成外接 key';
      userKeyIssue.textContent = label;
    }
    if (userKeyHint) {
      userKeyHint.textContent =
        busyMessage ??
        (key
          ? en
            ? 'Read-only and scoped to you. Stored locally in this browser — the server keeps only a hash, so rotate if you lose it.'
            : '只读、只能访问你自己的数据。明文仅存在本浏览器,服务端只留哈希,丢了就重新生成。'
          : en
            ? 'Issued only when you ask. Ordinary API traffic never mints one.'
            : '只有你点击时才会签发,普通 API 调用不会自动创建。');
      userKeyHint.classList.toggle('warn', !key);
    }
  };

  const refreshConnection = async (busyMessage?: string) => {
    memoryConn = await loadMemoryConnection();
    if (memoryConn.userKey) {
      // The stored plaintext is worthless once the server revokes the row.
      const active = await fetchUserKeyMetadata(memoryConn).catch(() => null);
      if (active && active.id !== memoryConn.userKey.id) {
        await chrome.storage.local.remove(USER_API_KEY_STORAGE_KEY);
        memoryConn = { ...memoryConn, userKey: null };
      }
    }
    renderTakeaways();
    renderA2aPreview();
    renderUserKeyCard(busyMessage);
    renderPrompt();
    void updateContextPackReadiness();
  };

  const updateContextPackReadiness = async () => {
    const check = document.getElementById('contextPackReadyCheck');
    const label = document.getElementById('contextPackReadyLabel');
    const state = document.getElementById('contextPackReadyState');
    if (!check || !label || !state) return;
    const en = isEn();
    try {
      const headers: Record<string, string> = {};
      if (memoryConn.userKey?.token) {
        headers.Authorization = `Bearer ${memoryConn.userKey.token}`;
      } else if (memoryConn.apiKey) {
        headers.Authorization = `Bearer ${memoryConn.apiKey}`;
        headers['X-User-Id'] = memoryConn.userId;
      } else {
        headers['X-User-Id'] = memoryConn.userId;
      }
      const res = await fetch(`${memoryConn.apiBase}/context-pack?scope=identity_preferences`, {
        headers,
      });
      if (res.ok) {
        check.className = 'check ok';
        check.querySelector('.ico')!.textContent = '✓';
        label.textContent = en
          ? 'Memory Service connected · context-pack ready'
          : 'Memory Service 已连接 · context-pack 可用';
        state.textContent = en ? 'Ready' : '已就绪';
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      check.className = 'check todo';
      check.querySelector('.ico')!.textContent = 'ⓘ';
      label.textContent = en
        ? `Cannot reach ${memoryConn.apiBase}/context-pack`
        : `无法访问 ${memoryConn.apiBase}/context-pack`;
      state.textContent = en ? 'Check Options' : '检查 Options';
    }
  };

  userKeyIssue?.addEventListener('click', () => {
    const en = isEn();
    userKeyIssue.disabled = true;
    renderUserKeyCard(en ? 'Issuing…' : '正在签发…');
    void issueUserKey(memoryConn)
      .then(() => refreshConnection())
      .catch((err: Error) => {
        renderUserKeyCard(
          en
            ? `Could not issue a key: ${err.message}`
            : `签发失败：${err.message}`,
        );
      })
      .finally(() => {
        userKeyIssue.disabled = false;
      });
  });

  userKeyRevoke?.addEventListener('click', () => {
    const id = memoryConn.userKey?.id;
    if (!id) return;
    userKeyRevoke.disabled = true;
    void revokeUserKey(memoryConn, id)
      .then(() => refreshConnection())
      .finally(() => {
        userKeyRevoke.disabled = false;
      });
  });

  bindCopy('copyUserKey', () => userKeyText?.textContent);

  void refreshConnection();

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (
        !changes.envConfig &&
        !changes.userinfo &&
        !changes[USER_API_KEY_STORAGE_KEY]
      ) {
        return;
      }
      void refreshConnection();
    });
  }

  /* ===== 结果预览 toggle ===== */
  document.querySelectorAll('.pv-toggle').forEach((node) => {
    const t = node as HTMLButtonElement;
    (t as HTMLButtonElement & { __label?: string }).__label = t.innerHTML;
    t.addEventListener('click', () => {
      const extra = document.getElementById(t.getAttribute('data-pv') || '');
      if (!extra) return;
      const frameSrc = t.getAttribute('data-frame');
      // Show container first so iframe layout is non-zero when its script auto-plays
      const showing = extra.classList.toggle('visible');
      if (frameSrc) {
        const f = extra.querySelector('iframe') as HTMLIFrameElement | null;
        if (f) {
          if (!f.getAttribute('src')) {
            f.src = frameSrc;
          } else if (showing) {
            // Re-open: reload so the animation plays again
            try {
              f.contentWindow?.location.reload();
            } catch {
              f.src = frameSrc;
            }
          }
        }
      }
      if (t.getAttribute('data-swap')) {
        const stat = t.closest('.pv')?.querySelector('.pv-body');
        if (stat) stat.classList.toggle('hidden', showing);
      }
      const label = (t as HTMLButtonElement & { __label?: string }).__label || '';
      t.innerHTML = showing
        ? isEn()
          ? '▼ Hide preview'
          : '▼ 收起预览'
        : label;
    });
  });

  /* ===== 目录 scrollspy ===== */
  const spyLinks = Array.from(
    document.querySelectorAll('#sidebar a[data-spy]'),
  ) as HTMLAnchorElement[];
  const spyTargets = spyLinks
    .map((a) => document.getElementById(a.getAttribute('data-spy') || ''))
    .filter((el): el is HTMLElement => Boolean(el));
  let currentSpy: string | null = null;

  const setSpy = (id: string) => {
    if (id === currentSpy) return;
    currentSpy = id;
    spyLinks.forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-spy') === id);
    });
  };

  const updateSpy = () => {
    if (
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 4
    ) {
      let last: HTMLElement | null = null;
      spyTargets.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) last = el;
      });
      if (last) {
        setSpy(last.id);
        return;
      }
    }
    const line = window.innerHeight * 0.3;
    let best: HTMLElement | null = null;
    let bestD = Infinity;
    spyTargets.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const d =
        r.top <= line && r.bottom >= line ? -1 : Math.abs(r.top - line);
      if (d < bestD) {
        bestD = d;
        best = el;
      }
    });
    if (best) setSpy(best.id);
  };

  window.addEventListener('scroll', updateSpy, { passive: true });
  window.addEventListener('resize', updateSpy);
  spyLinks.forEach((a) => {
    a.addEventListener('click', () => {
      const el = document.getElementById(a.getAttribute('data-spy') || '');
      if (el && el.tagName === 'DETAILS') {
        (el as HTMLDetailsElement).open = true;
      }
    });
  });

  /* ===== 分享托盘 ===== */
  let selected: string[] = [];
  try {
    const raw = localStorage.getItem(HELP_SHARE_SELECTED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        selected = parsed.filter((id) => typeof id === 'string' && REC[id]);
      }
    }
  } catch {
    // ignore
  }

  const tray = document.getElementById('shareTray');
  const trayCnt = document.getElementById('trayCnt');
  const trayChips = document.getElementById('trayChips');
  const trayCopy = document.getElementById('trayCopy') as HTMLTextAreaElement | null;
  const trayRecipient = document.getElementById(
    'trayRecipient',
  ) as HTMLInputElement | null;
  const traySendBtn = document.getElementById(
    'traySendBtn',
  ) as HTMLButtonElement | null;
  const traySendNote = document.getElementById('traySendNote');
  const traySendResult = document.getElementById('traySendResult');
  const traySendDefaultHtml = traySendBtn?.innerHTML || '';

  const openScheduledMessagesSetup = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      chrome.windows.create({
        url: chrome.runtime.getURL('scheduled-messages.html'),
        type: 'popup',
        width: 1280,
        height: 700,
        focused: true,
      });
    }
  };

  const checkScheduledMsgReady = async (): Promise<boolean> => {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return false;
      const result = await chrome.storage.local.get(['scheduledMessagesConfig']);
      const config = result.scheduledMessagesConfig as
        | { sheetId?: string }
        | undefined;
      return !!(config && config.sheetId);
    } catch {
      return false;
    }
  };

  updateSendUi = () => {
    if (!traySendBtn || !traySendNote) return;
    const en = isEn();
    const recipient = (trayRecipient?.value || '').trim();
    const canSend =
      scheduledMsgReady && Boolean(recipient) && !isSending && Boolean(trayCopy?.value);

    if (scheduledMsgReady) {
      traySendNote.textContent = en
        ? 'Sends via scheduled messages · ready'
        : '发送走「定时消息」通道 · 已就绪';
    } else {
      traySendNote.innerHTML = en
        ? 'Sends via scheduled messages · <a href="#" id="traySetupLink">needs setup</a>'
        : '发送走「定时消息」通道 · <a href="#" id="traySetupLink">需先配置</a>';
      document.getElementById('traySetupLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        openScheduledMessagesSetup();
      });
    }

    traySendBtn.disabled = !canSend;
    traySendBtn.classList.toggle('loading', isSending);
    if (isSending) {
      traySendBtn.textContent = en ? 'Sending…' : '发送中…';
    } else {
      traySendBtn.innerHTML = traySendDefaultHtml;
    }
  };

  const setSendResult = (ok: boolean, message: string) => {
    if (!traySendResult) return;
    traySendResult.hidden = false;
    traySendResult.className = `tray-result ${ok ? 'ok' : 'err'}`;
    traySendResult.textContent = `${ok ? '✅' : '❌'} ${message}`;
  };

  const handleTraySend = async () => {
    if (!traySendBtn || !trayCopy || !trayRecipient) return;
    const recipient = trayRecipient.value.trim();
    if (!recipient || !scheduledMsgReady || isSending) {
      if (!scheduledMsgReady) {
        setSendResult(
          false,
          isEn()
            ? 'Scheduled messages not configured yet'
            : '定时消息尚未配置，请先完成初始化',
        );
        openScheduledMessagesSetup();
      }
      return;
    }

    isSending = true;
    updateSendUi();
    if (traySendResult) traySendResult.hidden = true;

    try {
      const formattedUsername = recipient.toLowerCase().replace(/\s+/g, '.');
      const scheduleTime = new Date(Date.now() + 60 * 1000);
      const { dateStr: scheduleDate, timeStr: scheduleTimeStr } =
        formatLocalScheduleDateTime(scheduleTime);

      const response = (await chrome.runtime.sendMessage({
        type: 'ADD_SCHEDULED_MESSAGE',
        data: {
          Topic: 'Personal AI 推荐',
          Content: trayCopy.value,
          Schedule_Date: scheduleDate,
          Schedule_Time: scheduleTimeStr,
          Push_Method: 'AsMe',
          Target_Type: 'private',
          Glip_User_Name: formattedUsername,
        },
      })) as { success?: boolean; error?: string } | undefined;

      if (response?.success) {
        setSendResult(
          true,
          isEn()
            ? 'Scheduled — will arrive within about 1 minute'
            : '消息已安排发送！将在1分钟内送达',
        );
      } else {
        setSendResult(
          false,
          response?.error || (isEn() ? 'Send failed' : '发送失败'),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : isEn()
            ? 'Send failed'
            : '发送失败';
      setSendResult(false, message);
    } finally {
      isSending = false;
      updateSendUi();
    }
  };

  const label = (id: string) => {
    const r = REC[id];
    return isEn() ? r.en[0] : r.zh[0];
  };
  const desc = (id: string) => {
    const r = REC[id];
    return isEn() ? r.en[1] : r.zh[1];
  };

  const persistSelected = () => {
    try {
      localStorage.setItem(HELP_SHARE_SELECTED_KEY, JSON.stringify(selected));
    } catch {
      // ignore
    }
  };

  renderTray = () => {
    if (!trayCnt || !trayChips || !trayCopy) return;
    const en = isEn();
    trayCnt.textContent = String(selected.length);
    document.querySelectorAll('.rec-btn').forEach((node) => {
      const b = node as HTMLButtonElement;
      const on = selected.indexOf(b.getAttribute('data-rec') || '') >= 0;
      b.classList.toggle('on', on);
      if (on) b.textContent = en ? '✓ Added' : '✓ 已选';
      else
        b.innerHTML =
          '<span class="l-zh">+ 推荐</span><span class="l-en">+ Share</span>';
    });
    if (!selected.length) {
      trayChips.innerHTML =
        '<span class="empty">' +
        (en
          ? 'Nothing selected — hit "+ Share" on any card'
          : '还没选功能——去任意功能卡点「+ 推荐」') +
        '</span>';
      trayCopy.value =
        (en ? 'Install: ' : '安装:') +
        STORE +
        '\n' +
        (en ? 'or see the wiki: ' : '或者查看 wiki:') +
        WIKI;
      updateSendUi();
      return;
    }
    trayChips.innerHTML = selected
      .map((id) => `<span class="chip" data-id="${id}">${label(id)}</span>`)
      .join('');
    const first = selected[0];
    const d = desc(first);
    let text = d
      ? (en ? 'Sharing a small tool — ' : '推荐个小工具,') + d
      : en
        ? `Sharing a small tool with ${label(first)}`
        : `推荐个小工具,有「${label(first)}」`;
    if (selected.length > 1) {
      text +=
        '\n' +
        (en ? 'It also does: ' : '还可以做到:') +
        selected.slice(1).map(label).join(en ? ', ' : '、') +
        (en ? ' and more' : ' 等');
    }
    text +=
      '\n\n' +
      (en ? 'Install: ' : '安装:') +
      STORE +
      '\n' +
      (en ? 'or see the wiki: ' : '或者查看 wiki:') +
      WIKI;
    trayCopy.value = text;
    updateSendUi();
  };

  document.querySelectorAll('.rec-btn').forEach((node) => {
    const b = node as HTMLButtonElement;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = b.getAttribute('data-rec') || '';
      const i = selected.indexOf(id);
      if (i >= 0) selected.splice(i, 1);
      else selected.push(id);
      persistSelected();
      renderTray();
      if (selected.length) tray?.classList.add('open');
    });
  });

  trayChips?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const id = target?.getAttribute?.('data-id');
    if (!id) return;
    const i = selected.indexOf(id);
    if (i >= 0) selected.splice(i, 1);
    persistSelected();
    renderTray();
  });

  document.getElementById('trayPill')?.addEventListener('click', () => {
    tray?.classList.toggle('open');
  });

  document.getElementById('trayCopyBtn')?.addEventListener('click', function onTrayCopy() {
    if (!trayCopy) return;
    const b = this as HTMLButtonElement;
    const keep = b.innerHTML;
    void navigator.clipboard.writeText(trayCopy.value).then(() => {
      b.textContent = isEn() ? '✅ Copied' : '✅ 已复制';
      setTimeout(() => {
        b.innerHTML = keep;
      }, 1400);
    });
  });

  trayRecipient?.addEventListener('input', () => updateSendUi());
  traySendBtn?.addEventListener('click', () => {
    void handleTraySend();
  });

  // Configure CTA buttons that deep-link into extension pages
  document.querySelectorAll('.check .go').forEach((node) => {
    const btn = node as HTMLButtonElement;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = (btn.textContent || '').toLowerCase();
      let url = 'desktop-app.html';
      if (text.includes('授权') || text.includes('authorize')) {
        url = 'scheduled-messages.html';
      } else if (text.includes('配置') || text.includes('configure')) {
        url = 'options.html';
      }
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        chrome.tabs.create({ url: chrome.runtime.getURL(url) });
      } else {
        window.open(url, '_blank');
      }
    });
  });

  const finishInit = (lang: HelpLang) => {
    applyLang(lang);
    updateSpy();
    if (location.hash === '#share') {
      tray?.classList.add('open');
      window.setTimeout(() => {
        tray?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
    }
    revealPage();
  };

  void (async () => {
    optionsLang = await readOptionsLanguage();
    scheduledMsgReady = await checkScheduledMsgReady();
    const initial = pageOverride || optionsLang;
    finishInit(initial);

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        const prefsChange = changes[EXTENSION_UI_PREFERENCES_STORAGE_KEY];
        if (prefsChange) {
          const prefs = prefsChange.newValue as UiPreferences | undefined;
          optionsLang = uiLanguageToHelpLang(
            prefs?.language || DEFAULT_UI_LANGUAGE,
          );
          if (!pageOverride) applyLang(optionsLang);
        }
        if (changes.scheduledMessagesConfig) {
          const config = changes.scheduledMessagesConfig.newValue as
            | { sheetId?: string }
            | undefined;
          scheduledMsgReady = !!(config && config.sheetId);
          updateSendUi();
        }
      });
    }
  })();
}

// Hide until language resolved (inline bootstrap may already have set override)
document.documentElement.style.visibility = 'hidden';
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHelpPage);
} else {
  initHelpPage();
}
