/**
 * Shared Agent Result reporting contract.
 * User Task text describes work only. Format belongs to this system prompt.
 */

const GENERIC_TARGET_SYSTEMS = new Set([
  'agent_task',
  'openclaw',
  'a2a',
  'unknown',
  'generic',
]);

const JIRA_KEY_RE = /\b[A-Z][A-Z0-9]{1,19}-\d+\b/g;
const URL_RE = /\bhttps?:\/\/[^\s)\]>'"]+/gi;

const NOTIFY_METADATA_KEYS = new Set([
  'notifyTemplate',
  'notifyTarget',
  'successReceipt',
  'notifyVia',
  'suppressRecoveryNotifications',
]);

export const NOTIFY_EVIDENCE_FIELDS = ['entity_key', 'url', 'title', 'assignee'] as const;
export type NotifyEvidenceField = (typeof NOTIFY_EVIDENCE_FIELDS)[number];

export type AgentResultPromptRuntime = 'openclaw' | 'acp' | 'worker';

export type AgentResultPromptInput = {
  task: string;
  mode: 'read' | 'write';
  targetSystem?: string;
  threadId?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
};

export type TaskReceiptHints = {
  likelySourceSystem?: string;
  entityKeys: string[];
  urls: string[];
};

export function isGenericTargetSystem(value?: string): boolean {
  const normalized = value?.trim().toLowerCase();
  return !normalized || GENERIC_TARGET_SYSTEMS.has(normalized);
}

export function readNotifyTemplateFromMetadata(
  metadata?: Record<string, unknown>,
): string | undefined {
  const value = metadata?.notifyTemplate;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function omitNotifyFieldsFromExecutorMetadata(
  metadata?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (NOTIFY_METADATA_KEYS.has(key)) continue;
    next[key] = value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Turn a free-text notify template into evidence fields the executor should
 * collect. This is not the Glip output format.
 */
export function extractNotifyEvidenceFields(template?: string): NotifyEvidenceField[] {
  const text = template?.trim() ?? '';
  if (!text) return [];
  const fields = new Set<NotifyEvidenceField>();
  const hasMarkdownLink = /\[[^\]]+\]\([^)]+\)/.test(text);
  if (hasMarkdownLink || /链接|超链接|\blinks?\b/i.test(text)) {
    fields.add('url');
    fields.add('entity_key');
  }
  if (/assignee|assginee|负责人|经办人|@INIT|@[A-Za-z]/.test(text)) {
    fields.add('assignee');
  }
  if (/\bsummary\b|标题|主题/i.test(text) || (hasMarkdownLink && /\]\([^)]+\)\s+\S/.test(text))) {
    fields.add('title');
  }
  if (
    /[A-Za-z][A-Za-z0-9]*-xxx\b|[A-Z][A-Z0-9]+-\d+/.test(text) ||
    /\b(jira|epic|issue|ticket|工单)\b/i.test(text) ||
    (/\bxxx\b/i.test(text) && text.includes('*'))
  ) {
    fields.add('entity_key');
    if (!fields.has('title') && text.includes('*')) fields.add('title');
  }
  return NOTIFY_EVIDENCE_FIELDS.filter((field) => fields.has(field));
}

export function detectTaskReceiptHints(
  task: string,
  targetSystem?: string,
): TaskReceiptHints {
  const text = String(task || '');
  const entityKeys = uniqueMatches(text, JIRA_KEY_RE);
  const urls = uniqueMatches(text, URL_RE);
  const lowered = text.toLowerCase();

  let likelySourceSystem: string | undefined;
  if (!isGenericTargetSystem(targetSystem)) {
    likelySourceSystem = targetSystem!.trim();
  } else if (entityKeys.length > 0 || /\bjira\b|工单|epic|jql/i.test(text)) {
    likelySourceSystem = 'jira';
  } else if (/google\s*sheets?|spreadsheet|工作表|表格/i.test(text)) {
    likelySourceSystem = 'google_sheets';
  } else if (/calendar|日程|日历/i.test(text)) {
    likelySourceSystem = 'calendar';
  } else if (/\bgithub\b|gitlab|pull request|\bpr\b/i.test(lowered)) {
    likelySourceSystem = 'github';
  } else if (urls.length > 0 || /browser|chrome|打开页面|网页/i.test(text)) {
    likelySourceSystem = 'chrome';
  } else if (/file|path|仓库|repo|filesystem|本地文件/i.test(lowered)) {
    likelySourceSystem = 'filesystem';
  }

  return { likelySourceSystem, entityKeys, urls };
}

export function buildAgentResultSystemPrompt(
  input: AgentResultPromptInput,
  options: { runtime?: AgentResultPromptRuntime } = {},
): string {
  const runtime = options.runtime ?? 'openclaw';
  const hints = detectTaskReceiptHints(input.task, input.targetSystem);
  const notifyFields = extractNotifyEvidenceFields(readNotifyTemplateFromMetadata(input.metadata));
  const opening =
    runtime === 'acp'
      ? '你是 Personal AI 通过 ACP 调用的编码代理。优先用本地文件系统、git、测试和 CLI。需要记忆时用 personal-memory MCP，不要编造记忆。'
      : runtime === 'worker'
        ? '你是 Personal AI 通过远程 Worker ACP 调用的执行代理。'
        : '你是 Personal AI 派出的外部执行代理。';

  const hintLines = buildHintLines(input, hints, notifyFields);

  return [
    opening,
    '用户的 Task 只描述要做什么，不负责规定回报格式。回报格式由本系统提示词规定，不要向用户索要 JSON schema。',
    `Mode: ${input.mode}`,
    input.targetSystem && !isGenericTargetSystem(input.targetSystem)
      ? `Target system: ${input.targetSystem}`
      : undefined,
    ...hintLines,
    '',
    '工作方式：',
    '1. 先完成任务（读取或修改外部系统）。',
    '2. 用工具/API 回读确认真实结果。',
    '3. 最后一条助手消息必须是且仅是一个 JSON 信封，不要用 Markdown 当最终回复，也不要填写用户的通知模板。',
    '',
    'JSON 信封：',
    '{"status":"success|capability_missing|auth_error|need_human_decision|error","summary":"给人看的一两句结果","artifacts":[{"kind":"note","title":"...","content":"...","metadata":{}}],"payload":{}}',
    '',
    '收据规则（通用，适配各类任务）：',
    '- success 时，每个实际碰到的外部对象交一张 artifact 收据。',
    '- metadata.sourceSystem：jira / google_sheets / chrome / github / calendar / filesystem / …',
    '- metadata.entityKey：别人能搜到的 ID（如 NOVA-17023、URL、文件路径）。',
    '- metadata.verification：你怎么确认的（rest_api_readback、jql_requery、get_issue、page_url、git_status 等）。',
    '- 读任务：metadata.observedFields；写任务：metadata.operation + metadata.changedFields。',
    '- 分组/汇总读任务（按 Team 统计 INIT 等）：每个分组一张收据，metadata.entityKey 可用 team:<名称> 或 filter:<id>；metadata.initKeys 列出该组实际扫到的 issue key；metadata.entityUrl 放可复跑的 JQL 链接；metadata.verification=jql_requery。',
    '- content：短证据，例如 Committed=Yes after update。',
    '- 不能回读确认就不要 success。缺工具用 capability_missing；缺权限用 auth_error；需人选择用 need_human_decision，并带 payload.question / payload.options。',
    '- 查询/扫描类任务正确地查到 0 个符合条件的对象，是合法的 success，不是失败：交一张 kind="query_result" 的收据（不需要 entityKey），metadata.sourceSystem + metadata.query（实际查询语句，如 JQL）+ metadata.verification（如 jql_requery）+ metadata.matchCount=0，content 里说明检查过哪些候选、为什么都不满足条件。',
    '',
    '例子（Jira 写）：每个更新的 issue 一张收据，sourceSystem=jira, entityKey=NOVA-17023, verification=rest_api_readback, operation=update, changedFields=["Committed"]。',
    'Jira 对象收据（读或写都适用）：每个 issue 单独一张，kind=jira_issue 或 note；metadata.entityKey=NOVA-123；metadata.url=你实际请求的 Jira 实例上的 browse/self 链接（从 API 的 self / html 字段取，不要编造主机名）；title=issue summary；若 issue 有经办人则 metadata.assignee=显示名。列表/扫描任务不要把所有 key 只塞进一段纯文本而丢掉 url。',
    '例子（浏览器读）：sourceSystem=chrome, entityKey=页面 URL, verification=page_url, observedFields=["url","title"]。',
    '例子（文件/代码）：sourceSystem=filesystem, entityKey=路径, verification=git_status 或 file_read。',
    '- 产出文件的任务（调研报告、方案文档、幻灯片）：交一张 kind="file" 的收据，metadata.path 写相对用户数据目录的路径（如 research/xxx.md，不要写绝对路径或 ..），metadata.verification 说明怎么确认写成功（如 file_write / git_status），content 写一句产物摘要。文件本身由你写盘，账本只记路径。',
    '例子（查询 0 匹配）：kind=query_result, sourceSystem=jira, query="issueFunction in portfolioChildrenOf(...)", verification=jql_requery, matchCount=0。',
    '例子（文件产物）：kind=file, path="research/sqlite-vec-vs-lancedb.md", verification=file_write, content="p95 延迟对比与迁移成本结论"。',
    '',
    'Keep the summary concise and factual. Do not ask the user to specify this format.',
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

export function buildAgentResultUserPrompt(input: AgentResultPromptInput): string {
  const metadata = omitNotifyFieldsFromExecutorMetadata(input.metadata);
  return [
    input.threadId ? `Thread ID: ${input.threadId}` : undefined,
    input.runId ? `Run ID: ${input.runId}` : undefined,
    metadata ? `Context metadata: ${JSON.stringify(metadata)}` : undefined,
    '',
    'Task:',
    input.task,
    '',
    '[Personal AI] 回报格式由系统规定，不在 Task 里。完成后最后一条消息只输出 JSON 信封。不要输出通知模板或群消息正文。',
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

function buildHintLines(
  input: AgentResultPromptInput,
  hints: TaskReceiptHints,
  notifyFields: NotifyEvidenceField[],
): string[] {
  const lines: string[] = [];
  if (hints.likelySourceSystem) {
    lines.push(`Likely sourceSystem: ${hints.likelySourceSystem}`);
  }
  if (hints.entityKeys.length > 0) {
    lines.push(
      `Detected entity keys: ${hints.entityKeys.slice(0, 12).join(', ')}. Prefer one artifact per key.`,
    );
  }
  if (hints.urls.length > 0) {
    lines.push(`Detected URLs: ${hints.urls.slice(0, 6).join(', ')}`);
  }
  if (input.mode === 'write') {
    lines.push('This is a write task: confirm by readback before status=success.');
  }
  if (notifyFields.length > 0) {
    lines.push(
      `Notification evidence fields (collect on each listed object; do not write the announcement): ${notifyFields.join(', ')}.`,
    );
    lines.push(
      'A later formatter will turn artifacts into the user-facing notice. If a requested field was not on the object, say so in content; do not fabricate URLs, names, or keys.',
    );
  }
  return lines;
}

function uniqueMatches(text: string, pattern: RegExp): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  const cloned = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;
  while ((match = cloned.exec(text))) {
    const value = match[0];
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }
  return values;
}
