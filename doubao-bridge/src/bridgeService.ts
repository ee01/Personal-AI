import { randomUUID } from 'node:crypto';
import { format } from 'node:util';

import type { BridgeConfig } from './config.js';
import type {
  BindingType,
  BridgePairResult,
  BridgeStatus,
  MobileBriefingRequest,
  QueryInjectRequest,
  ReminderSyncRequest,
  StableMemorySyncRequest,
  SyncResult,
  ThreadBinding,
  ThreadRecord,
} from './types.js';
import { StateStore, type BridgeStateFile } from './persistence.js';
import type { BrowserSessionAdapter } from './browserSession.js';

function nowIso(): string {
  return new Date().toISOString();
}

function asThreadRecord(bindingType: BindingType, title: string, url?: string): ThreadRecord {
  const id = randomUUID();
  return {
    id,
    kind: bindingType,
    title,
    url,
    bindingType,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function renderStableMemory(items: StableMemorySyncRequest['items']): string {
  const lines = ['请记住以下长期稳定信息，只保留对未来回答有帮助的内容：'];
  for (const item of items) {
    lines.push(`- ${item.title}: ${item.body}`);
  }
  lines.push('');
  lines.push('请简要确认你记住了哪些要点。');
  return lines.join('\n');
}

function renderBriefing(payload: MobileBriefingRequest): string {
  const lines = [payload.title, ''];
  for (const bullet of payload.bullets) {
    lines.push(`- ${bullet}`);
  }
  lines.push('');
  lines.push('这只是当前会话上下文，不需要长期记住。');
  return lines.join('\n');
}

function renderQuery(payload: QueryInjectRequest): string {
  const lines = [
    `问题：${payload.query}`,
    `服务端检索结论：${payload.answer}`,
  ];
  if (payload.evidence?.length) {
    lines.push('', '证据：');
    for (const item of payload.evidence) {
      lines.push(`- ${item.title || 'evidence'}${item.source ? ` (${item.source})` : ''}: ${item.snippet || ''}`);
    }
  }
  lines.push('', '以上内容仅用于当前会话。');
  return lines.join('\n');
}

function renderReminders(payload: ReminderSyncRequest): string {
  const lines = ['今日提醒：'];
  for (const reminder of payload.reminders) {
    const due = reminder.dueAt ? ` [${reminder.dueAt}]` : '';
    const note = reminder.note ? ` - ${reminder.note}` : '';
    lines.push(`- ${reminder.title}${due}${note}`);
  }
  lines.push('', '请把它们当成当前会话提醒，不要长期记住全部原文。');
  return lines.join('\n');
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
  ) {}

  async init(): Promise<void> {
    this.state = await this.store.load();
    if (!this.state.pairToken) {
      this.state.pairToken = this.store.createToken();
      await this.store.save(this.state);
    }
  }

  private async persist(): Promise<void> {
    await this.store.save(this.state);
  }

  getHealth(): Record<string, unknown> {
    return {
      ok: true,
      service: 'doubao-bridge',
      version: '0.1.0',
      config: {
        host: this.config.host,
        port: this.config.port,
        headless: this.config.headless,
      },
    };
  }

  async pair(requestToken?: string): Promise<BridgePairResult> {
    if (requestToken && this.state.pairToken && requestToken !== this.state.pairToken) {
      throw new Error('Pair token mismatch');
    }

    if (!this.state.pairToken) {
      this.state.pairToken = this.store.createToken();
    }
    this.state.paired = true;
    this.state.authStatus = this.state.authStatus === 'unknown' ? 'needs_login' : this.state.authStatus;
    await this.persist();
    return {
      paired: true,
      token: this.state.pairToken,
      createdAt: nowIso(),
    };
  }

  async getStatus(): Promise<BridgeStatus> {
    const browserStatus = this.browser.status();
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

  async listThreads(): Promise<{ threads: ThreadRecord[]; bindings: Partial<Record<BindingType, ThreadBinding>> }> {
    return {
      threads: this.state.threads,
      bindings: this.state.bindings,
    };
  }

  async createMemorySyncThread(): Promise<ThreadRecord> {
    await this.browser.openThread(this.config.doubaoBaseUrl);
    const record = asThreadRecord('memory_sync', 'Memory Sync Thread', this.config.doubaoBaseUrl);
    this.state.threads.push(record);
    this.state.bindings.memory_sync = {
      bindingType: 'memory_sync',
      threadId: record.id,
      threadUrl: record.url,
      title: record.title,
      updatedAt: nowIso(),
    };
    this.state.authStatus = 'connected';
    await this.persist();
    return record;
  }

  async bindThread(bindingType: BindingType, thread: Partial<ThreadRecord> & { threadUrl?: string }): Promise<ThreadBinding> {
    if (thread.threadUrl) {
      await this.browser.openThread(thread.threadUrl);
    }

    const record: ThreadRecord = {
      id: thread.id || randomUUID(),
      kind: bindingType,
      title: thread.title || `${bindingType} thread`,
      url: thread.url || thread.threadUrl,
      bindingType,
      createdAt: thread.createdAt || nowIso(),
      updatedAt: nowIso(),
    };

    const existingIndex = this.state.threads.findIndex((item) => item.id === record.id);
    if (existingIndex >= 0) {
      this.state.threads[existingIndex] = record;
    } else {
      this.state.threads.push(record);
    }

    const binding: ThreadBinding = {
      bindingType,
      threadId: record.id,
      threadUrl: record.url,
      title: record.title,
      updatedAt: nowIso(),
    };

    this.state.bindings[bindingType] = binding;
    this.state.authStatus = 'connected';
    await this.persist();
    return binding;
  }

  async syncStableMemory(payload: StableMemorySyncRequest): Promise<SyncResult> {
    const transcript = renderStableMemory(payload.items);
    return this.sendToBinding('stable_memory', 'memory_sync', transcript, payload.threadId, payload.dryRun);
  }

  async syncMobileBriefing(payload: MobileBriefingRequest): Promise<SyncResult> {
    const transcript = renderBriefing(payload);
    return this.sendToBinding('mobile_briefing', 'mobile_context', transcript, payload.threadId, payload.dryRun);
  }

  async injectQuery(payload: QueryInjectRequest): Promise<SyncResult> {
    const transcript = renderQuery(payload);
    return this.sendToBinding('query_inject', 'mobile_context', transcript, payload.threadId, payload.dryRun);
  }

  async syncReminders(payload: ReminderSyncRequest): Promise<SyncResult> {
    const transcript = renderReminders(payload);
    return this.sendToBinding('reminder_sync', 'mobile_context', transcript, payload.threadId, payload.dryRun);
  }

  private async sendToBinding(
    kind: SyncResult['kind'],
    targetBindingType: BindingType,
    transcript: string,
    explicitThreadId?: string,
    dryRun = false,
  ): Promise<SyncResult> {
    const binding = this.state.bindings[targetBindingType];
    const threadId = explicitThreadId || binding?.threadId;
    const threadUrl = binding?.threadUrl || this.state.threads.find((thread) => thread.id === threadId)?.url;

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
      const result = await this.browser.sendTranscript(transcript, threadUrl);
      this.state.lastSyncAt = nowIso();
      this.state.lastError = result.sent ? undefined : 'Transcript was not sent';
      this.state.authStatus = result.sent ? 'connected' : this.state.authStatus;
      await this.persist();

      return {
        accepted: true,
        kind,
        targetBindingType,
        threadId,
        transcript,
        sentAt: nowIso(),
        error: result.sent ? undefined : 'No editable element found on the current Doubao page',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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
}
