import type {
  CalendarEventSyncItem,
  ContextAssistResponse,
} from './services/MemoryServiceClient';
import { readRingCentralCalendarEvents } from './context-assist/ringCentralCalendar';
import { normalizeEnvConfigShape, type EnvConfigType } from './utils';

const HOST_ID = 'pai-meeting-prep-host';
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const REFRESH_INTERVAL_MS = 2500;

interface MeetingPrepState {
  enabled: boolean;
  events: CalendarEventSyncItem[];
  selectedEvent: CalendarEventSyncItem | null;
  assist: ContextAssistResponse | null;
  loading: boolean;
  syncLabel: string;
  error: string;
  userGoal: string;
}

class RingCentralVideoHomePrep {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private observer: MutationObserver | null = null;
  private refreshTimer: number | null = null;
  private syncTimer: number | null = null;
  private assistRequestSeq = 0;
  private lastAssistKey: string | null = null;
  private readonly goalByEventKey = new Map<string, string>();
  private config: EnvConfigType | null = null;
  private state: MeetingPrepState = {
    enabled: true,
    events: [],
    selectedEvent: null,
    assist: null,
    loading: false,
    syncLabel: '未同步',
    error: '',
    userGoal: '',
  };

  async start(): Promise<void> {
    this.config = await this.loadConfig();
    this.state.enabled =
      this.config.CONTEXT_ASSIST_ENABLED !== false &&
      this.config.MEETING_PREP_ENABLED !== false;
    if (!this.state.enabled) {
      this.removeHost();
      return;
    }

    await this.syncRingCentralCalendar();
    this.refreshSelectedMeeting();
    this.render();

    this.observer = new MutationObserver(() => this.scheduleRefresh());
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener('resize', this.scheduleRefresh);
    this.syncTimer = window.setInterval(
      () => void this.syncRingCentralCalendar(),
      SYNC_INTERVAL_MS,
    );
  }

  private async loadConfig(): Promise<EnvConfigType> {
    const response = await sendRuntimeMessage<{ envConfig?: EnvConfigType }>({
      type: 'PERSONAL_AI_GET_ENV_CONFIG',
    }).catch(() => null);
    return normalizeEnvConfigShape(response?.envConfig || {});
  }

  private scheduleRefresh = (): void => {
    if (this.refreshTimer != null) return;
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      const changed = this.refreshSelectedMeeting();
      if (changed) {
        this.state.assist = null;
        this.render();
        void this.generateAssist(false);
      } else {
        this.render();
      }
    }, REFRESH_INTERVAL_MS);
  };

  private async syncRingCentralCalendar(): Promise<void> {
    if (this.config?.MEETING_PREP_CALENDAR_SOURCE === 'outlook') return;
    try {
      const events = await readRingCentralCalendarEvents();
      this.state.events = events;
      if (events.length > 0) {
        const response = await sendRuntimeMessage<{
          result?: { created: number; updated: number; unchanged: number; total: number };
        }>({
          type: 'CALENDAR_EVENTS_SYNC_REQUEST',
          sourceSystem: 'ringcentral_indexeddb',
          events,
        });
        const result = response?.result;
        this.state.syncLabel = result
          ? `已同步 ${result.total} 个会议，变化 ${result.created + result.updated}`
          : `已读取 ${events.length} 个会议`;
      } else {
        this.state.syncLabel = '未读取到本地会议';
      }
      this.state.error = '';
      this.refreshSelectedMeeting();
    } catch (error) {
      console.warn('[ContextAssist] RingCentral calendar sync failed:', error);
      this.state.syncLabel = '本地日历读取失败';
      this.state.error = error instanceof Error ? error.message : 'calendar_sync_failed';
    } finally {
      this.render();
    }
  }

  private refreshSelectedMeeting(): boolean {
    const previous = this.state.selectedEvent;
    const previousKey = getEventKey(previous);
    if (previousKey) {
      this.goalByEventKey.set(previousKey, this.state.userGoal);
    }

    const current = this.findSelectedEvent();
    const currentKey = getEventKey(current);
    this.state.selectedEvent = current;
    const changed = previousKey !== currentKey;
    if (changed) {
      this.assistRequestSeq += 1;
      this.lastAssistKey = null;
      this.state.assist = null;
      this.state.userGoal = currentKey
        ? this.goalByEventKey.get(currentKey) || ''
        : '';
    }
    return changed;
  }

  private findSelectedEvent(): CalendarEventSyncItem | null {
    const pageText = getVisibleText(document.body).toLowerCase();
    const now = Date.now();
    const futureEvents = this.state.events
      .filter((event) => !event.cancelled && event.startTime >= now - 2 * 60 * 60 * 1000)
      .sort((a, b) => a.startTime - b.startTime);
    const visibleMatch = futureEvents.find((event) =>
      pageText.includes(event.title.toLowerCase().slice(0, 80)),
    );
    if (visibleMatch) return visibleMatch;
    return futureEvents[0] || null;
  }

  private async generateAssist(force: boolean): Promise<void> {
    if (!this.state.selectedEvent || (!force && this.state.assist)) return;

    const requestSeq = ++this.assistRequestSeq;
    const event = this.state.selectedEvent;
    const eventKey = getEventKey(event);
    const userGoal = this.state.userGoal;
    const assistKey = getAssistKey(event, userGoal);
    this.state.loading = true;
    this.state.error = '';
    this.render();

    try {
      const response = await sendRuntimeMessage<{ result?: ContextAssistResponse }>({
        type: 'CONTEXT_ASSIST_REQUEST',
        request: {
          surface: 'meeting_prep',
          contextType: 'meeting',
          title: event.title,
          url: window.location.href,
          userGoal,
          event,
          sourceTypes: ['calendar', 'meeting', 'glip', 'jira', 'web', 'manual', 'system'],
          limit: 5,
        },
      });
      if (
        requestSeq !== this.assistRequestSeq ||
        eventKey !== getEventKey(this.state.selectedEvent)
      ) {
        return;
      }
      this.state.assist = response?.result || null;
      this.lastAssistKey = assistKey;
    } catch (error) {
      if (requestSeq !== this.assistRequestSeq) return;
      console.warn('[ContextAssist] meeting prep failed:', error);
      this.state.error =
        error instanceof Error ? error.message : 'context_assist_failed';
    } finally {
      if (requestSeq === this.assistRequestSeq) {
        this.state.loading = false;
        this.render();
      }
    }
  }

  private async sendToMeetingPilot(): Promise<void> {
    if (!this.state.selectedEvent || !this.state.assist?.insertText) return;
    if (!this.isAssistCurrent()) {
      this.state.error = '会议目标已更新，请先重新生成建议。';
      this.render();
      return;
    }
    await chrome.storage.local.set({
      meetingPrepHandoff: {
        createdAt: Date.now(),
        expiresAt: Date.now() + 12 * 60 * 60 * 1000,
        event: this.state.selectedEvent,
        goal: this.state.userGoal.trim(),
        text: this.state.assist.insertText,
        cueCards: this.state.assist.cueCards,
        evidence: this.state.assist.evidence,
      },
    });
    this.state.syncLabel = '已发送到 Meeting Pilot';
    this.render();
  }

  private isAssistCurrent(): boolean {
    return Boolean(
      this.state.assist &&
        this.state.selectedEvent &&
        this.lastAssistKey ===
          getAssistKey(this.state.selectedEvent, this.state.userGoal),
    );
  }

  private ensureHost(): HTMLElement {
    if (this.host && document.documentElement.contains(this.host)) {
      return this.host;
    }

    const host = document.createElement('section');
    host.id = HOST_ID;
    host.setAttribute('aria-label', 'Personal AI meeting prep');
    const target = findInjectionTarget();
    if (target) {
      target.appendChild(host);
    } else {
      document.body.appendChild(host);
      host.style.position = 'fixed';
      host.style.right = '24px';
      host.style.bottom = '24px';
      host.style.width = '360px';
      host.style.zIndex = '2147483645';
    }
    this.host = host;
    this.shadow = host.attachShadow({ mode: 'open' });
    this.shadow.addEventListener('click', (event) => this.handleClick(event));
    this.shadow.addEventListener('input', (event) => this.handleInput(event));
    return host;
  }

  private removeHost(): void {
    this.host?.remove();
    this.host = null;
    this.shadow = null;
  }

  private render(): void {
    if (!this.state.enabled) return;
    this.ensureHost();
    if (!this.shadow) return;

    const event = this.state.selectedEvent;
    const assist = this.state.assist;
    const assistCurrent = this.isAssistCurrent();
    const assistStale = Boolean(assist && !assistCurrent);
    const cueCards = assist?.cueCards || [];
    const evidence = assist?.evidence || [];
    this.shadow.innerHTML = `
      <style>${styles()}</style>
      <div class="pai-card">
        <div class="pai-header">
          <div class="pai-title">
            <span class="pai-dot"></span>
            <span>Personal AI 会前准备</span>
          </div>
          <button class="pai-icon" data-action="sync" title="同步日历">↻</button>
        </div>
        <div class="pai-sub">${escapeHtml(this.state.syncLabel)}</div>
        ${
          event
            ? `
              <div class="pai-meeting">
                <div class="pai-meeting-title">${escapeHtml(event.title)}</div>
                <div class="pai-time">${escapeHtml(formatEventTime(event))}</div>
              </div>
              <textarea class="pai-goal" data-role="goal" rows="2" placeholder="补充本次会议目标，例如：同步某个依赖进展">${escapeHtml(this.state.userGoal)}</textarea>
              <div class="pai-actions">
                <button class="pai-primary" data-action="generate" type="button">
                  ${getGenerateButtonLabel(this.state.loading, Boolean(assist), assistStale)}
                </button>
                <button class="pai-secondary" data-action="handoff" type="button" ${assist?.insertText && assistCurrent ? '' : 'disabled'}>
                  发送到 Meeting Pilot
                </button>
              </div>
              <div class="pai-stale" data-role="stale" ${assistStale ? '' : 'hidden'}>目标已更新，请先更新建议后再发送。</div>
            `
            : `
              <div class="pai-empty">请选择一个 upcoming meeting，或等待 RingCentral 日历加载完成。</div>
            `
        }
        ${this.state.error ? `<div class="pai-error">${escapeHtml(this.state.error)}</div>` : ''}
        ${
          cueCards.length
            ? `<div class="pai-cues">${cueCards
                .map(
                  (card) => `
                    <article class="pai-cue" data-kind="${escapeHtml(card.kind)}">
                      <div class="pai-cue-title">${escapeHtml(card.title)}</div>
                      <div class="pai-cue-body">${escapeHtml(card.body)}</div>
                    </article>
                  `,
                )
                .join('')}</div>`
            : ''
        }
        ${
          evidence.length
            ? `<details class="pai-evidence">
                <summary>证据来源 (${evidence.length})</summary>
                ${evidence
                  .slice(0, 5)
                  .map(
                    (item) => `
                    <div class="pai-source">
                      <div>${escapeHtml(item.sourceTitle || item.title || item.sourceLabel || 'Memory')}</div>
                      <small>${escapeHtml(item.whyMatched || item.sourceLabel || '')}</small>
                    </div>
                  `,
                  )
                  .join('')}
              </details>`
            : ''
        }
      </div>
    `;
  }

  private handleClick(event: Event): void {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const action = target?.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'sync') {
      void this.syncRingCentralCalendar();
    } else if (action === 'generate') {
      void this.generateAssist(true);
    } else if (action === 'handoff') {
      void this.sendToMeetingPilot();
    }
  }

  private handleInput(event: Event): void {
    const target = event.target instanceof HTMLTextAreaElement ? event.target : null;
    if (target?.dataset.role === 'goal') {
      this.state.userGoal = target.value;
      const key = getEventKey(this.state.selectedEvent);
      if (key) {
        this.goalByEventKey.set(key, this.state.userGoal);
      }
      this.syncInteractiveState();
    }
  }

  private syncInteractiveState(): void {
    if (!this.shadow) return;
    const assistCurrent = this.isAssistCurrent();
    const assistStale = Boolean(this.state.assist && !assistCurrent);
    const handoff = this.shadow.querySelector<HTMLButtonElement>(
      '[data-action="handoff"]',
    );
    if (handoff) {
      handoff.disabled = !this.state.assist?.insertText || !assistCurrent;
    }
    const generate = this.shadow.querySelector<HTMLButtonElement>(
      '[data-action="generate"]',
    );
    if (generate) {
      generate.textContent = getGenerateButtonLabel(
        this.state.loading,
        Boolean(this.state.assist),
        assistStale,
      );
    }
    const stale = this.shadow.querySelector<HTMLElement>('[data-role="stale"]');
    if (stale) {
      stale.hidden = !assistStale;
    }
  }
}

function findInjectionTarget(): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('main, section, div'))
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ element, rect }) => {
      if (rect.width < 320 || rect.height < 260) return false;
      if (rect.left < window.innerWidth * 0.42) return false;
      const text = getVisibleText(element);
      return /participants|accepted|declined|join|conf|starts in|hi all/i.test(text);
    })
    .sort((a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height);
  return candidates[0]?.element || null;
}

function getVisibleText(root: Element | null): string {
  if (!root) return '';
  return (root.textContent || '').replace(/\s+/g, ' ').trim();
}

function sendRuntimeMessage<T>(message: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.success === false) {
        reject(new Error(response.error || 'runtime_message_failed'));
        return;
      }
      resolve(response as T);
    });
  });
}

function formatEventTime(event: CalendarEventSyncItem): string {
  const start = new Date(event.startTime);
  const end = event.endTime ? new Date(event.endTime) : null;
  const date = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const startTime = start.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = end
    ? end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';
  return `${date} ${startTime}${endTime ? ` - ${endTime}` : ''}`;
}

function getEventKey(event: CalendarEventSyncItem | null): string | null {
  if (!event) return null;
  return (
    event.externalId ||
    event.seriesKey ||
    [event.title, event.startTime].filter(Boolean).join('@') ||
    null
  );
}

function getAssistKey(event: CalendarEventSyncItem, userGoal: string): string {
  return `${getEventKey(event) || 'event'}::${userGoal.replace(/\s+/g, ' ').trim()}`;
}

function getGenerateButtonLabel(
  loading: boolean,
  hasAssist: boolean,
  assistStale: boolean,
): string {
  if (loading) return '生成中...';
  if (assistStale) return '更新建议';
  return hasAssist ? '刷新建议' : '生成建议';
}

function escapeHtml(value: string | undefined): string {
  const div = document.createElement('div');
  div.textContent = value || '';
  return div.innerHTML;
}

function styles(): string {
  return `
    :host {
      display: block;
      margin-top: 18px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #1f2937;
    }
    .pai-card {
      border: 1px solid #d8dee8;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 2px 8px rgba(31, 41, 55, 0.08);
      padding: 16px;
      font-size: 14px;
      line-height: 1.45;
    }
    .pai-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .pai-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 700;
    }
    .pai-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #0b7fc3;
      box-shadow: 0 0 0 3px rgba(11, 127, 195, 0.14);
    }
    .pai-icon {
      width: 30px;
      height: 30px;
      border-radius: 6px;
      border: 1px solid #c8d2df;
      background: #fff;
      color: #334155;
      cursor: pointer;
      font-size: 16px;
    }
    .pai-sub,
    .pai-time,
    .pai-source small {
      color: #64748b;
      font-size: 12px;
    }
    .pai-sub {
      margin-top: 4px;
    }
    .pai-meeting {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 6px;
      background: #f7fafc;
    }
    .pai-meeting-title {
      font-weight: 700;
      color: #111827;
    }
    .pai-goal {
      box-sizing: border-box;
      width: 100%;
      min-height: 58px;
      resize: vertical;
      margin-top: 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      font: inherit;
      color: #1f2937;
    }
    .pai-actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
    .pai-primary,
    .pai-secondary {
      border-radius: 6px;
      border: 1px solid transparent;
      padding: 7px 10px;
      font-weight: 700;
      cursor: pointer;
      font-size: 13px;
    }
    .pai-primary {
      background: #0b7fc3;
      color: #fff;
    }
    .pai-secondary {
      background: #fff;
      border-color: #c8d2df;
      color: #334155;
    }
    .pai-secondary:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .pai-empty,
    .pai-error,
    .pai-stale {
      margin-top: 12px;
      color: #64748b;
    }
    .pai-error {
      color: #b91c1c;
    }
    .pai-stale {
      color: #92400e;
      font-size: 12px;
    }
    .pai-cues {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }
    .pai-cue {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
      background: #fff;
    }
    .pai-cue[data-kind="brief"] {
      border-color: #b9d7ea;
      background: #f2f9fd;
    }
    .pai-cue-title {
      font-weight: 700;
      margin-bottom: 4px;
    }
    .pai-cue-body {
      color: #334155;
      word-break: break-word;
    }
    .pai-evidence {
      margin-top: 12px;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
      color: #475569;
    }
    .pai-evidence summary {
      cursor: pointer;
      font-weight: 700;
    }
    .pai-source {
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
    }
  `;
}

if (location.hostname === 'app.ringcentral.com' && location.pathname.startsWith('/video/home')) {
  void new RingCentralVideoHomePrep().start();
}
