import { WorkerAcpClient, type AcpSpawnFn } from './acpClient.js';
import { defaultCursorAcpCommand } from './cursorCommand.js';
import type { ClaimedTask } from './protocol.js';

export interface LocalExecutorSettings {
  cwd?: string;
  acpCodexCommand?: string;
  acpClaudeCommand?: string;
  acpCursorCommand?: string;
  cursorAgentCommand?: string;
  mcpUrl?: string;
  mcpBearer?: string;
  userId?: string;
  spawnFn?: AcpSpawnFn;
  timeoutMs?: number;
}

function splitCommand(raw: string | undefined, fallback: { command: string; args: string[] }) {
  if (!raw?.trim()) return fallback;
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  return { command: parts[0] || fallback.command, args: parts.slice(1) };
}

function extractPromptText(result: unknown, updates: Array<Record<string, unknown>>): string {
  const chunks: string[] = [];
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (Array.isArray(obj.output)) {
      for (const part of obj.output) {
        if (part && typeof part === 'object' && typeof (part as { text?: string }).text === 'string') {
          chunks.push((part as { text: string }).text);
        }
      }
    }
    if (typeof obj.text === 'string') chunks.push(obj.text);
  }
  for (const update of updates) {
    const nested = (update.update || update) as Record<string, unknown>;
    const content = nested.content as { text?: string } | undefined;
    if (typeof content?.text === 'string') chunks.push(content.text);
    if (typeof nested.text === 'string') chunks.push(nested.text);
  }
  return chunks.join('');
}

function parseEnvelope(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const tryParse = (raw: string) => {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  let parsed = tryParse(trimmed);
  if (!parsed) {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) parsed = tryParse(trimmed.slice(start, end + 1));
  }
  if (parsed && typeof parsed.status === 'string') {
    const status = parsed.status === 'success' ? 'succeeded' : parsed.status;
    return {
      status,
      summary: typeof parsed.summary === 'string' ? parsed.summary : text.slice(0, 500),
      artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
      transcript: typeof parsed.transcript === 'string' ? parsed.transcript : undefined,
      payload: parsed.payload,
    };
  }
  if (trimmed) {
    return {
      status: 'error',
      summary: trimmed.slice(0, 500),
      artifacts: [],
      payload: { rawText: trimmed },
    };
  }
  return { status: 'error', summary: 'ACP 未返回可解析结果', artifacts: [] };
}

export async function runClaimedTask(
  task: ClaimedTask,
  settings: LocalExecutorSettings = {},
): Promise<Record<string, unknown>> {
  const type = task.executor?.type || 'acp-codex';
  const cwd = settings.cwd || task.executor?.cwd || process.cwd();
  const timeoutMs =
    settings.timeoutMs ||
    (typeof task.request?.timeoutMs === 'number' ? task.request.timeoutMs : 600_000);
  const fallback =
    type === 'acp-claude-code'
      ? {
          command: process.env.ACP_CLAUDE_COMMAND || 'npx',
          args: process.env.ACP_CLAUDE_ARGS
            ? process.env.ACP_CLAUDE_ARGS.split(/\s+/).filter(Boolean)
            : ['-y', '@agentclientprotocol/claude-code-acp'],
        }
      : type === 'acp-cursor'
        ? defaultCursorAcpCommand()
        : {
          command: process.env.ACP_CODEX_COMMAND || 'npx',
          args: process.env.ACP_CODEX_ARGS
            ? process.env.ACP_CODEX_ARGS.split(/\s+/).filter(Boolean)
            : ['-y', '@agentclientprotocol/codex-acp'],
        };
  const override =
    type === 'acp-claude-code'
      ? settings.acpClaudeCommand
      : type === 'acp-cursor'
        ? settings.acpCursorCommand
        : settings.acpCodexCommand;
  const cmd = splitCommand(override, fallback);
  const mcpUrl = settings.mcpUrl || task.memory?.mcpUrl;
  const mcpBearer = settings.mcpBearer;
  const userId = settings.userId || task.memory?.userId;
  const mcpServers =
    mcpUrl && mcpBearer
      ? [
          {
            name: 'personal-memory',
            type: 'streamable-http',
            url: mcpUrl,
            headers: {
              Authorization: `Bearer ${mcpBearer}`,
              ...(userId ? { 'X-User-Id': userId } : {}),
            },
          },
        ]
      : [];

  const client = new WorkerAcpClient({
    command: cmd.command,
    args: cmd.args,
    cwd,
    env: {
      INITIAL_AGENT_MODE: task.request?.mode === 'write' ? 'agent' : 'read-only',
      NO_BROWSER: '1',
      ...(settings.cursorAgentCommand
        ? { CURSOR_AGENT_COMMAND: settings.cursorAgentCommand }
        : {}),
    },
    spawnFn: settings.spawnFn,
    requestTimeoutMs: timeoutMs,
  });

  try {
    await client.start();
    await client.initialize();
    const { sessionId } = await client.newSession({ cwd, mcpServers });
    const promptText = [
      '你是 Personal AI 通过远程 Worker ACP 调用的执行代理。',
      `Mode: ${task.request?.mode || 'read'}`,
      `Action ID: ${task.request?.actionId || task.actionId}`,
      task.request?.targetSystem ? `Target system: ${task.request.targetSystem}` : undefined,
      '',
      '用户的 Task 只描述要做什么，不负责规定回报格式。',
      '完成后最后一条消息必须是且仅是 JSON 信封：',
      '{"status":"success|capability_missing|auth_error|need_human_decision|error","summary":"...","artifacts":[{"kind":"note","title":"...","content":"...","metadata":{}}]}',
      'success 时每个碰到的外部对象交一张收据：metadata.sourceSystem、entityKey、verification，读任务加 observedFields，写任务加 operation/changedFields。',
      '',
      'Task:',
      task.request?.task || '',
      '',
      '[Personal AI] 回报格式由系统规定，不在 Task 里。',
    ]
      .filter((line) => line !== undefined)
      .join('\n');
    const promptResult = await client.prompt({
      sessionId,
      prompt: [{ type: 'text', text: promptText }],
    });
    const text = extractPromptText(promptResult, client.updates);
    const envelope = parseEnvelope(text);
    return {
      ...envelope,
      remoteRunId: sessionId,
      payload: {
        ...((envelope.payload as Record<string, unknown>) || {}),
        acpSessionId: sessionId,
      },
    };
  } finally {
    client.close();
  }
}
