import { randomUUID } from 'node:crypto';

import type { BridgeConfig } from './config.js';
import type {
  BindingType,
  BridgePairResult,
  BridgeServiceStatus,
  MemoSyncRequest,
  MobileBriefingRequest,
  NoticeSyncRequest,
  QueryInjectRequest,
  ReminderSyncRequest,
  SendExperimentRequest,
  StableMemorySyncRequest,
  SyncResult,
  ThreadBinding,
  ThreadRecord,
} from './types.js';
import type { MemoItem } from './memoTypes.js';
import { smartFormat } from './memoFormatter.js';
import {
  convertToMemoItems,
  convertRemindersToMemoItems,
} from './memoClassifier.js';
import { writeNmToken } from './nativeMessaging/manifestInstaller.js';
import { StateStore, type BridgeStateFile } from './persistence.js';
import type {
  BrowserSendOptions,
  BrowserSessionAdapter,
  BrowserThreadSnapshot,
} from './browserSession.js';

function nowIso(): string {
  return new Date().toISOString();
}

const MEMORY_SYNC_SEED_MESSAGE = [
  '建立长期记忆同步线程。',
  '后续我会在这个线程里同步稳定画像、长期偏好与记忆，请把它们作为长期记忆沉淀。',
  '当前只需要简要回复“长期记忆线程已就绪”。',
].join('');

function extractThreadId(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/(?:chat|thread)\/([^/?#]+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function looksLikeThreadUrl(url?: string): boolean {
  return Boolean(extractThreadId(url));
}

function sameThreadUrl(left?: string, right?: string): boolean {
  const leftThreadId = extractThreadId(left);
  const rightThreadId = extractThreadId(right);
  if (leftThreadId && rightThreadId) {
    return leftThreadId === rightThreadId;
  }
  return left === right;
}

function normalizeThreadTitle(
  title: string | undefined,
  fallbackTitle: string,
): string {
  const trimmed = title?.trim();
  if (!trimmed) return fallbackTitle;
  if (/^(豆包|Doubao)(\s*[|:-].*)?$/i.test(trimmed)) {
    return fallbackTitle;
  }
  return trimmed;
}

function asThreadRecord(
  bindingType: BindingType,
  snapshot: Partial<BrowserThreadSnapshot> & Partial<ThreadRecord>,
  fallbackTitle: string,
  existingRecord?: ThreadRecord,
): ThreadRecord {
  const id =
    snapshot.id ||
    snapshot.threadId ||
    extractThreadId(snapshot.url) ||
    existingRecord?.id ||
    randomUUID();
  const title = normalizeThreadTitle(
    snapshot.title || existingRecord?.title,
    fallbackTitle,
  );
  const url = snapshot.url || existingRecord?.url;
  return {
    id,
    kind: bindingType,
    title,
    url,
    bindingType,
    createdAt: existingRecord?.createdAt || snapshot.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

function renderStableMemory(items: StableMemorySyncRequest['items']): string {
  const lines = [
    '请把以下长期稳定信息存入随手记，并保留对未来回答有帮助的要点：',
  ];
  for (const item of items) {
    lines.push(`- ${item.title}: ${item.body}`);
  }
  lines.push('');
  lines.push('请简要确认已存入随手记的要点。');
  return lines.join('\n');
}

function renderBriefing(payload: MobileBriefingRequest): string {
  const lines = ['请把以下近期重点记录到随手记：', '', payload.title, ''];
  for (const bullet of payload.bullets) {
    lines.push(`- ${bullet}`);
  }
  lines.push('');
  lines.push('请按近期重点的方式保存，方便我之后查看和回顾。');
  return lines.join('\n');
}

function renderQuery(payload: QueryInjectRequest): string {
  const lines = [`问题：${payload.query}`, `服务端检索结论：${payload.answer}`];
  if (payload.evidence?.length) {
    lines.push('', '证据：');
    for (const item of payload.evidence) {
      lines.push(
        `- ${item.title || 'evidence'}${item.source ? ` (${item.source})` : ''}: ${item.snippet || ''}`,
      );
    }
  }
  lines.push('', '以上内容仅用于当前会话。');
  return lines.join('\n');
}

function renderReminders(payload: ReminderSyncRequest): string {
  const lines = ['请在随手记中记录以下待办事项：'];
  for (const reminder of payload.reminders) {
    const due = reminder.dueAt ? ` [${reminder.dueAt}]` : '';
    const note = reminder.note ? ` - ${reminder.note}` : '';
    lines.push(`- ${reminder.title}${due}${note}`);
  }
  lines.push('', '请按待办方式保存，不要加已完成标记。');
  return lines.join('\n');
}

function renderNotices(payload: NoticeSyncRequest): string {
  const lines = [
    '下面是一些通知推送，请不要记录为待办，也不要当作长期记忆。',
    '请在我下次提问或下一次手机/耳机对话中，按自然口吻提醒我这些信息。',
    '',
  ];
  for (const notice of payload.notices) {
    const when = notice.sentAt ? ` [${notice.sentAt}]` : '';
    const body = notice.body ? ` - ${notice.body}` : '';
    lines.push(`- ${notice.title}${when}${body}`);
  }
  lines.push('', '这些内容属于通知推送，而不是待办事项。');
  return lines.join('\n');
}

function normalizeBrowserLifecycleError(message: string): string {
  if (/Target page, context or browser has been closed/i.test(message)) {
    return '豆包浏览器窗口已经被关闭了。请先重新点击“打开登录窗口”，确认桥接器浏览器恢复后，再继续创建或绑定线程。';
  }
  if (/Browser page not available/i.test(message)) {
    return '当前没有可用的豆包浏览器页面。请先点击“打开登录窗口”，再继续操作。';
  }
  if (/No editable element found/i.test(message)) {
    return '当前豆包页面里没有找到可输入区域。请先确认桥接器浏览器仍停留在可用的豆包页面。';
  }
  return message;
}

export class DoubaoBridgeService {
  private state: BridgeStateFile = {
    paired: false,
    authStatus: 'unknown',
    bindings: {},
    threads: [],
  };

  constructor(
    private readonly config: BridgeConfig,
    private readonly store: StateStore,
    private readonly browser: BrowserSessionAdapter,
    private readonly version = '0.0.0',
  ) {}

  async init(): Promise<void> {
    this.state = await this.store.load();
    if (!this.state.pairToken) {
      this.state.pairToken = this.store.createToken();
      await this.store.save(this.state);
    }
    if (this.state.pairToken) {
      await writeNmToken(this.state.pairToken).catch(() => undefined);
    }
  }

  private async persist(): Promise<void> {
    await this.store.save(this.state);
  }

  getHealth(): Record<string, unknown> {
    return {
      ok: true,
      service: 'desktop-app',
      version: this.version,
      config: {
        host: this.config.host,
        port: this.config.port,
        headless: this.config.headless,
      },
    };
  }

  async pair(requestToken?: string): Promise<BridgePairResult> {
    if (
      requestToken &&
      this.state.pairToken &&
      requestToken !== this.state.pairToken
    ) {
      throw new Error('Pair token mismatch');
    }

    if (!this.state.pairToken) {
      this.state.pairToken = this.store.createToken();
    }
    this.state.paired = true;
    this.state.authStatus =
      this.state.authStatus === 'unknown'
        ? 'needs_login'
        : this.state.authStatus;
    await this.persist();
    await writeNmToken(this.state.pairToken).catch(() => undefined);
    return {
      paired: true,
      token: this.state.pairToken,
      createdAt: nowIso(),
    };
  }

  async getStatus(): Promise<BridgeServiceStatus> {
    const browserStatus = this.browser.status();
    if (browserStatus.running) {
      try {
        const probedAuthStatus = await this.browser.probeAuthStatus();
        if (probedAuthStatus !== this.state.authStatus) {
          this.state.authStatus = probedAuthStatus;
          await this.persist();
        }
      } catch (error) {
        this.state.lastError =
          error instanceof Error ? error.message : String(error);
      }
    }

    return {
      paired: this.state.paired,
      authStatus: this.state.authStatus,
      browserRunning: browserStatus.running,
      currentUrl: browserStatus.currentUrl,
      pairToken: this.state.pairToken,
      bindings: this.state.bindings,
      threads: this.state.threads,
      lastSyncAt: this.state.lastSyncAt,
      lastError: this.state.lastError || browserStatus.lastError,
    };
  }

  async openLogin(): Promise<{ url: string }> {
    const url = await this.browser.openLogin();
    this.state.authStatus = 'needs_login';
    await this.persist();
    return { url };
  }

  async listThreads(): Promise<{
    threads: ThreadRecord[];
    bindings: Partial<Record<BindingType, ThreadBinding>>;
  }> {
    return {
      threads: this.state.threads,
      bindings: this.state.bindings,
    };
  }

  /**
   * Returns the set of Doubao thread ids that this app pushes sync transcripts
   * into. The Doubao explorer uses this to skip those conversations entirely.
   */
  getBoundThreadIds(): ReadonlySet<string> {
    const ids = new Set<string>();
    for (const binding of Object.values(this.state.bindings)) {
      if (binding?.threadId) {
        ids.add(binding.threadId);
      }
    }
    return ids;
  }

  async createMemorySyncThread(): Promise<ThreadRecord> {
    const existingBinding = this.state.bindings.memory_sync;
    const existingRecord = this.findThreadRecord(existingBinding?.threadId);
    if (
      existingBinding?.threadUrl &&
      looksLikeThreadUrl(existingBinding.threadUrl) &&
      existingRecord
    ) {
      return existingRecord;
    }

    const result = await this.browser.sendTranscript(MEMORY_SYNC_SEED_MESSAGE);
    if (!result.sent || !looksLikeThreadUrl(result.url)) {
      throw new Error(
        result.error ||
          'Unable to create a real Doubao memory-sync conversation',
      );
    }

    const record = this.upsertThreadRecord(
      asThreadRecord('memory_sync', result, '长期记忆同步线程', existingRecord),
    );
    this.state.bindings.memory_sync = this.bindingFromRecord(
      'memory_sync',
      record,
    );
    this.state.authStatus = 'connected';
    await this.persist();
    return record;
  }

  async bindThread(
    bindingType: BindingType,
    thread: Partial<ThreadRecord> & { threadUrl?: string },
  ): Promise<ThreadBinding> {
    let openedSnapshot: BrowserThreadSnapshot | undefined;
    if (thread.threadUrl) {
      openedSnapshot = await this.browser.openThread(thread.threadUrl);
    }

    const existingRecord = this.findThreadRecord(
      thread.id || openedSnapshot?.threadId,
    );
    const fallbackTitle =
      bindingType === 'memory_sync' ? '长期记忆同步线程' : '手机版对话';
    const resolvedUrl =
      (openedSnapshot?.url && looksLikeThreadUrl(openedSnapshot.url)
        ? openedSnapshot.url
        : undefined) ||
      thread.url ||
      thread.threadUrl;
    const resolvedThreadId =
      openedSnapshot?.threadId ||
      thread.id ||
      extractThreadId(thread.url || thread.threadUrl);
    const record = this.upsertThreadRecord(
      asThreadRecord(
        bindingType,
        {
          ...thread,
          url: resolvedUrl,
          title: thread.title || openedSnapshot?.title,
          threadId: resolvedThreadId,
        },
        fallbackTitle,
        existingRecord,
      ),
    );

    const binding = this.bindingFromRecord(bindingType, record);
    this.state.bindings[bindingType] = binding;
    this.state.authStatus = 'connected';
    await this.persist();
    return binding;
  }

  async bindMobileContextByTitle(title: string): Promise<ThreadBinding | null> {
    const found = await this.browser.findThreadByTitle(title);
    if (!found) return null;

    return this.bindThread('mobile_context', {
      threadUrl: found.url,
      title: found.title,
    });
  }

  async syncStableMemory(
    payload: StableMemorySyncRequest,
  ): Promise<SyncResult> {
    const transcript = renderStableMemory(payload.items);
    return this.sendToBinding(
      'stable_memory',
      'memory_sync',
      transcript,
      payload.threadId,
      payload.dryRun,
    );
  }

  async syncMobileBriefing(
    payload: MobileBriefingRequest,
  ): Promise<SyncResult> {
    const transcript = renderBriefing(payload);
    return this.sendToBinding(
      'mobile_briefing',
      'mobile_context',
      transcript,
      payload.threadId,
      payload.dryRun,
    );
  }

  async injectQuery(payload: QueryInjectRequest): Promise<SyncResult> {
    const transcript = renderQuery(payload);
    return this.sendToBinding(
      'query_inject',
      'mobile_context',
      transcript,
      payload.threadId,
      payload.dryRun,
    );
  }

  async syncReminders(payload: ReminderSyncRequest): Promise<SyncResult> {
    const transcript = renderReminders(payload);
    return this.sendToBinding(
      'reminder_sync',
      'mobile_context',
      transcript,
      payload.threadId,
      payload.dryRun,
    );
  }

  async syncNotices(payload: NoticeSyncRequest): Promise<SyncResult> {
    const transcript = renderNotices(payload);
    return this.sendToBinding(
      'notice_sync',
      'mobile_context',
      transcript,
      payload.threadId,
      payload.dryRun,
    );
  }

  /**
   * 同步随手记消息
   * 将消息智能分类后格式化为豆包随手记格式
   */
  async syncMemo(payload: MemoSyncRequest): Promise<SyncResult> {
    const transcript = smartFormat(payload.items, payload.context);
    return this.sendToBinding(
      'memo_sync',
      'mobile_context',
      transcript,
      payload.threadId,
      payload.dryRun,
    );
  }

  /**
   * 同步稳定的长期记忆到随手记
   * 自动分类并格式化
   */
  async syncStableMemoryAsMemo(
    payload: StableMemorySyncRequest,
  ): Promise<SyncResult> {
    const memoItems = convertToMemoItems(payload.items);
    const transcript = smartFormat(memoItems, 'stable');
    return this.sendToBinding(
      'stable_memory',
      'memory_sync',
      transcript,
      payload.threadId,
      payload.dryRun,
    );
  }

  /**
   * 同步提醒事项到随手记（作为待办）
   */
  async syncRemindersAsMemo(payload: ReminderSyncRequest): Promise<SyncResult> {
    const memoItems = convertRemindersToMemoItems(payload.reminders);
    const transcript = smartFormat(memoItems, 'reminder');
    return this.sendToBinding(
      'reminder_sync',
      'mobile_context',
      transcript,
      payload.threadId,
      payload.dryRun,
    );
  }

  async syncTodosAsMemo(payload: ReminderSyncRequest): Promise<SyncResult> {
    const memoItems = convertRemindersToMemoItems(payload.reminders);
    const transcript = smartFormat(memoItems, 'reminder');
    return this.sendToBinding(
      'todo_sync',
      'mobile_context',
      transcript,
      payload.threadId,
      payload.dryRun,
    );
  }

  async sendExperiment(payload: SendExperimentRequest): Promise<SyncResult> {
    return this.sendToBinding(
      'query_inject',
      payload.bindingType || 'mobile_context',
      payload.transcript,
      payload.threadId,
      payload.dryRun,
      {
        inputMode: payload.inputMode,
        sendMode: payload.sendMode,
        preSendDelayMs: payload.preSendDelayMs,
      },
    );
  }

  private async sendToBinding(
    kind: SyncResult['kind'],
    targetBindingType: BindingType,
    transcript: string,
    explicitThreadId?: string,
    dryRun = false,
    sendOptions?: BrowserSendOptions,
  ): Promise<SyncResult> {
    let binding = this.state.bindings[targetBindingType];
    if (
      targetBindingType === 'memory_sync' &&
      (!binding?.threadUrl || !looksLikeThreadUrl(binding.threadUrl))
    ) {
      await this.createMemorySyncThread();
      binding = this.state.bindings[targetBindingType];
    }

    const threadId = explicitThreadId || binding?.threadId;
    const existingRecord = this.findThreadRecord(threadId);
    const threadUrl = binding?.threadUrl || existingRecord?.url;

    if (dryRun) {
      return {
        accepted: true,
        kind,
        targetBindingType,
        threadId,
        transcript,
        sentAt: nowIso(),
      };
    }

    try {
      const result = await this.browser.sendTranscript(
        transcript,
        threadUrl,
        sendOptions,
      );
      const sentToRequestedThread =
        !threadUrl || !result.url || sameThreadUrl(threadUrl, result.url);
      const effectiveSent = result.sent && sentToRequestedThread;
      const effectiveError =
        result.error ||
        (!sentToRequestedThread
          ? 'Transcript was sent to a different thread than the bound mobile conversation'
          : undefined);
      const resolvedThreadId = effectiveSent
        ? result.threadId || threadId
        : threadId;
      const preservedTitle = binding?.title || existingRecord?.title;
      if (effectiveSent) {
        const updatedRecord = this.upsertThreadRecord(
          asThreadRecord(
            targetBindingType,
            {
              id: resolvedThreadId,
              url: result.url || threadUrl,
              title: preservedTitle || result.title,
              threadId: resolvedThreadId,
            },
            targetBindingType === 'memory_sync'
              ? preservedTitle || '长期记忆同步线程'
              : preservedTitle || '手机版对话',
            existingRecord,
          ),
        );
        this.state.bindings[targetBindingType] = this.bindingFromRecord(
          targetBindingType,
          updatedRecord,
        );
      }
      this.state.lastSyncAt = nowIso();
      this.state.lastError = effectiveSent
        ? undefined
        : effectiveError || 'Transcript was not sent';
      this.state.authStatus = effectiveSent
        ? 'connected'
        : this.state.authStatus;
      await this.persist();

      return {
        accepted: true,
        kind,
        targetBindingType,
        threadId: resolvedThreadId,
        transcript,
        sentAt: nowIso(),
        transportUsed: result.transportUsed,
        error: effectiveSent
          ? undefined
          : effectiveError ||
            'No editable element found on the current Doubao page',
        verified: result.verified,
        challengeDetected: result.challengeDetected,
        messageVisible: result.messageVisible,
        observedBodySnippet: result.observedBodySnippet,
      };
    } catch (error) {
      const message = normalizeBrowserLifecycleError(
        error instanceof Error ? error.message : String(error),
      );
      this.state.lastError = message;
      await this.persist();
      return {
        accepted: false,
        kind,
        targetBindingType,
        threadId,
        transcript,
        sentAt: nowIso(),
        error: message,
      };
    }
  }

  private findThreadRecord(threadId?: string): ThreadRecord | undefined {
    if (!threadId) return undefined;
    return this.state.threads.find((thread) => thread.id === threadId);
  }

  private upsertThreadRecord(record: ThreadRecord): ThreadRecord {
    const existingIndex = this.state.threads.findIndex(
      (item) =>
        item.id === record.id || (!!record.url && item.url === record.url),
    );
    if (existingIndex >= 0) {
      this.state.threads[existingIndex] = {
        ...this.state.threads[existingIndex],
        ...record,
        updatedAt: nowIso(),
      };
      return this.state.threads[existingIndex];
    }

    this.state.threads.push(record);
    return record;
  }

  private bindingFromRecord(
    bindingType: BindingType,
    record: ThreadRecord,
  ): ThreadBinding {
    return {
      bindingType,
      threadId: record.id,
      threadUrl: record.url,
      title: record.title,
      updatedAt: nowIso(),
    };
  }
}
