import type { CreateJiraPayload, CreateJiraResult } from './useRoadmapContract';

export type ImportItemPayload = {
  key: string;
  type: string;
  title: string;
  quarter?: string;
  estimate?: number;
  targetStart?: string;
  targetEnd?: string;
};

type BridgeRequestType =
  | 'pai-roadmap-import-jql'
  | 'pai-roadmap-create-jira'
  | 'pai-roadmap-ai-alias'
  | 'pai-roadmap-fetch-issue-dates'
  | 'pai-roadmap-import-tasks'
  | 'pai-roadmap-update-target-dates';

type BridgeResultType =
  | 'pai-roadmap-import-jql-result'
  | 'pai-roadmap-create-jira-result'
  | 'pai-roadmap-ai-alias-result'
  | 'pai-roadmap-fetch-issue-dates-result'
  | 'pai-roadmap-import-tasks-result'
  | 'pai-roadmap-update-target-dates-result';

const ACK_TIMEOUT_MS = 4_000;

function requestId(): string {
  return `req_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * 内容脚本收到请求后会立刻回执。没有回执说明扩展根本没接到这条消息（多数是
 * 扩展被重新加载后页面还是旧的注入），此时不该让用户一直看 loading。
 */
function waitForBridgeAck(
  ackType: string,
  id: string,
  timeoutMs = ACK_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('扩展未接收请求，请在 chrome://extensions 重新加载扩展后刷新本页'));
    }, timeoutMs);

    function onMessage(ev: MessageEvent) {
      const data = ev.data || {};
      if (data.type !== ackType || data.requestId !== id) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve();
    }

    window.addEventListener('message', onMessage);
  });
}

function waitForBridgeResult<T>(
  resultType: BridgeResultType,
  id: string,
  timeoutMs = 120_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('扩展响应超时'));
    }, timeoutMs);

    function onMessage(ev: MessageEvent) {
      const data = ev.data || {};
      if (data.type !== resultType || data.requestId !== id) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if (!data.ok) {
        reject(new Error(data.error || '扩展调用失败'));
        return;
      }
      resolve(data as T);
    }

    window.addEventListener('message', onMessage);
  });
}

async function callBridge<T>(
  type: BridgeRequestType,
  resultType: BridgeResultType,
  payload: Record<string, unknown>,
  timeoutMs?: number,
): Promise<T> {
  const id = requestId();
  const pending = waitForBridgeResult<T>(resultType, id, timeoutMs);
  window.postMessage(
    {
      type,
      requestId: id,
      ...payload,
    },
    '*',
  );
  return pending;
}

export async function bridgeImportJql(
  jql: string,
  quarters: string[],
): Promise<ImportItemPayload[]> {
  const id = requestId();
  const pending = waitForBridgeResult<{
    ok: true;
    items: ImportItemPayload[];
  }>('pai-roadmap-import-jql-result', id);
  const acked = waitForBridgeAck('pai-roadmap-import-jql-ack', id);
  // 两个 promise 各自挂空 handler：race 只用先到的那个，另一个的 reject 不该冒泡成未处理异常
  pending.catch(() => undefined);
  acked.catch(() => undefined);

  window.postMessage(
    { type: 'pai-roadmap-import-jql', requestId: id, jql, quarters },
    '*',
  );

  await Promise.race([acked, pending]);
  const result = await pending;
  return Array.isArray(result.items) ? result.items : [];
}

/**
 * Two-phase creation: the extension creates the parent issue (when `parent` is
 * set), resolves its key back into the roadmap itself, then creates the
 * children. Partial success is normal — read the per-row `error` fields.
 */
export async function bridgeCreateJira(
  payload: CreateJiraPayload,
): Promise<CreateJiraResult> {
  const result = await callBridge<{
    ok: true;
    result: CreateJiraResult;
  }>('pai-roadmap-create-jira', 'pai-roadmap-create-jira-result', {
    payload: payload as unknown as Record<string, unknown>,
  });
  return {
    parent: result.result?.parent,
    children: result.result?.children || [],
  };
}

/** Read Target End / due date from a Jira issue for external-dep ETA. */
export async function bridgeFetchIssueDates(
  jiraKey: string,
): Promise<string | null> {
  const id = requestId();
  const pending = waitForBridgeResult<{
    ok: true;
    targetEnd?: string | null;
  }>('pai-roadmap-fetch-issue-dates-result', id, 30_000);
  const acked = waitForBridgeAck('pai-roadmap-fetch-issue-dates-ack', id);
  pending.catch(() => undefined);
  acked.catch(() => undefined);
  window.postMessage(
    { type: 'pai-roadmap-fetch-issue-dates', requestId: id, jiraKey },
    '*',
  );
  await Promise.race([acked, pending]);
  const result = await pending;
  return result.targetEnd || null;
}

export type RemoteChildTask = {
  key: string;
  summary: string;
  epicKey: string;
  targetStart: string | null;
  targetEnd: string | null;
  assignee: string | null;
};

/** Search child Tasks under Epics via extension Options JIRA_API_TOKEN. */
export async function bridgeImportChildTasks(
  epicKeys: string[],
  linkField: string | null,
): Promise<RemoteChildTask[]> {
  const id = requestId();
  const pending = waitForBridgeResult<{
    ok: true;
    tasks: RemoteChildTask[];
  }>('pai-roadmap-import-tasks-result', id, 120_000);
  const acked = waitForBridgeAck('pai-roadmap-import-tasks-ack', id);
  pending.catch(() => undefined);
  acked.catch(() => undefined);
  window.postMessage(
    {
      type: 'pai-roadmap-import-tasks',
      requestId: id,
      epicKeys,
      linkField,
    },
    '*',
  );
  await Promise.race([acked, pending]);
  const result = await pending;
  return Array.isArray(result.tasks) ? result.tasks : [];
}

/**
 * Write Target Start/End via extension Options token.
 * Throws with message `jira_token_missing` when Options has no token.
 */
export async function bridgeUpdateTargetDates(
  jiraKey: string,
  start: string,
  end: string,
): Promise<void> {
  const id = requestId();
  const pending = waitForBridgeResult<{ ok: true }>(
    'pai-roadmap-update-target-dates-result',
    id,
    30_000,
  );
  const acked = waitForBridgeAck('pai-roadmap-update-target-dates-ack', id);
  pending.catch(() => undefined);
  acked.catch(() => undefined);
  window.postMessage(
    {
      type: 'pai-roadmap-update-target-dates',
      requestId: id,
      jiraKey,
      start,
      end,
    },
    '*',
  );
  await Promise.race([acked, pending]);
  await pending;
}
