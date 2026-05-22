import type {
  CalendarEventSyncItem,
  ContextAssistResponse,
  TodayPilotMeetingPrepRecord,
  TodayPilotMeetingPrepResolveResponse,
} from './services/MemoryServiceClient';
import { readRingCentralCalendarEvents } from './context-assist/ringCentralCalendar';
import { normalizeEnvConfigShape, type EnvConfigType } from './utils';
import {
  extractRingCentralVideoJoinUrl,
  isRingCentralNativeJoinEnabledFromConfig,
  loadRingCentralNativeJoinEnabled,
  openRingCentralVideoNativeJoin,
  parseRingCentralVideoJoinTarget,
  shouldPreserveDefaultNativeJoinClick,
  watchRingCentralNativeJoinEnabled,
} from './ringcentralNativeJoin';
import {
  sanitizeContextExternalUrl,
  sanitizeExploreRoute,
} from './web-intelligence/contextRecallGuards';

const HOST_ID = 'pai-meeting-prep-host';
const DESCRIPTION_BOX_SELECTOR = [
  '#upcoming-meeting-detail-description-box',
  '[data-test-automation-id="upcoming-meeting-detail-description-box"]',
].join(', ');
const DETAIL_ROOT_SELECTORS = [
  '[data-test-automation-id="upcoming-meeting-detail-container"]',
  '[data-test-automation-id="video-detail-upcoming-meeting"]',
  '[data-test-automation-id="video__rightPanel"]',
  '[data-test-automation-id*="upcoming-meeting-detail"]',
];
const SELECTED_EVENT_ITEM_SELECTORS = [
  '[data-at="calendar-event-item-wrapper"][data-calendar-event-item-id][aria-selected="true"]',
  '[data-at="calendar-event-item-wrapper"][data-calendar-event-item-id][aria-current="true"]',
  '[data-at="calendar-event-item-wrapper"][data-calendar-event-item-id][data-selected="true"]',
  '[data-at="calendar-event-item-wrapper"][data-calendar-event-item-id][class*="selected"]',
  '[data-at="calendar-event-item-wrapper"][data-calendar-event-item-id][class*="active"]',
].join(', ');
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const REFRESH_INTERVAL_MS = 2500;

interface MeetingPrepState {
  enabled: boolean;
  events: CalendarEventSyncItem[];
  selectedEvent: CalendarEventSyncItem | null;
  assist: ContextAssistResponse | null;
  prep: TodayPilotMeetingPrepRecord | null;
  loading: boolean;
  syncLabel: string;
  error: string;
}

class RingCentralVideoHomePrep {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private observer: MutationObserver | null = null;
  private refreshTimer: number | null = null;
  private syncTimer: number | null = null;
  private assistRequestSeq = 0;
  private lastPrepEventKey: string | null = null;
  private hostListenersAttached = false;
  private nativeJoinEnabled = true;
  private nativeJoinConfigWatcherAttached = false;
  private nativeJoinInterceptorAttached = false;
  private config: EnvConfigType | null = null;
  private state: MeetingPrepState = {
    enabled: true,
    events: [],
    selectedEvent: null,
    assist: null,
    prep: null,
    loading: false,
    syncLabel: '未同步',
    error: '',
  };

  async start(): Promise<void> {
    this.config = await this.loadConfig();
    this.initNativeJoinConfig();
    this.initNativeJoinInterceptor();

    this.state.enabled =
      this.config.CONTEXT_ASSIST_ENABLED !== false &&
      this.config.MEETING_PREP_ENABLED !== false &&
      this.config.TODAY_PILOT_MEETING_PREP_ENABLED !== false;

    if (this.state.enabled || this.nativeJoinEnabled) {
      await this.syncRingCentralCalendar({
        forceRingCentral: this.nativeJoinEnabled,
      });
    }

    if (!this.state.enabled) {
      this.removeHost();
    }
    this.refreshSelectedMeeting();
    if (this.state.enabled) {
      this.render();
    }

    this.observer = new MutationObserver(() => this.scheduleRefresh());
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    window.addEventListener('resize', this.scheduleRefresh);
    this.syncTimer = window.setInterval(
      () =>
        void this.syncRingCentralCalendar({
          forceRingCentral: this.nativeJoinEnabled,
        }),
      SYNC_INTERVAL_MS,
    );
  }

  private async loadConfig(): Promise<EnvConfigType> {
    const response = await sendRuntimeMessage<{ envConfig?: EnvConfigType }>({
      type: 'PERSONAL_AI_GET_ENV_CONFIG',
    }).catch(() => null);
    return normalizeEnvConfigShape(response?.envConfig || {});
  }

  private initNativeJoinConfig(): void {
    if (this.config) {
      this.nativeJoinEnabled = isRingCentralNativeJoinEnabledFromConfig(
        this.config,
      );
    }

    void loadRingCentralNativeJoinEnabled().then((enabled) => {
      this.nativeJoinEnabled = enabled;
      if (enabled) {
        void this.syncRingCentralCalendar({ forceRingCentral: true });
      }
    });

    if (this.nativeJoinConfigWatcherAttached) {
      return;
    }

    watchRingCentralNativeJoinEnabled((enabled) => {
      this.nativeJoinEnabled = enabled;
      if (enabled) {
        void this.syncRingCentralCalendar({ forceRingCentral: true });
      }
    });
    this.nativeJoinConfigWatcherAttached = true;
  }

  private initNativeJoinInterceptor(): void {
    if (this.nativeJoinInterceptorAttached) {
      return;
    }

    document.addEventListener('click', this.handleNativeJoinClick, true);
    this.nativeJoinInterceptorAttached = true;
  }

  private handleNativeJoinClick = (event: MouseEvent): void => {
    if (
      !this.nativeJoinEnabled ||
      shouldPreserveVideoHomeNativeJoinClick(event)
    ) {
      return;
    }

    const trigger = findVideoHomeJoinButton(event);
    if (!trigger) {
      return;
    }

    const target = this.findNativeJoinTarget(trigger);
    if (!target) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openRingCentralVideoNativeJoin(target);
  };

  private findNativeJoinTarget(trigger: HTMLElement) {
    const wrapper = trigger.closest<HTMLElement>(
      '[data-at="calendar-event-item-wrapper"][data-calendar-event-item-id]',
    );
    const externalId = wrapper?.getAttribute('data-calendar-event-item-id');
    const eventTarget = this.findEventNativeJoinTarget(externalId);
    if (eventTarget) {
      return eventTarget;
    }

    const detailContainer = trigger.closest<HTMLElement>(
      '[data-test-automation-id="upcoming-meeting-detail-container"], [data-test-automation-id="video-detail-upcoming-meeting"], [data-test-automation-id="video__rightPanel"]',
    );
    const nearbyUrl = findRingCentralVideoJoinUrlNearElement(
      wrapper || detailContainer || trigger,
    );
    const nearbyTarget = nearbyUrl
      ? parseRingCentralVideoJoinTarget(nearbyUrl)
      : null;
    if (nearbyTarget) {
      return nearbyTarget;
    }

    const routeTarget = this.findEventNativeJoinTarget(
      getVideoHomeRouteEventId(),
    );
    if (routeTarget) {
      return routeTarget;
    }

    this.refreshSelectedMeeting();
    return this.state.selectedEvent?.joinUrl
      ? parseRingCentralVideoJoinTarget(this.state.selectedEvent.joinUrl)
      : null;
  }

  private findEventNativeJoinTarget(externalId: string | null | undefined) {
    if (!externalId) {
      return null;
    }

    const event = findEventByExternalId(this.state.events, externalId);
    return event?.joinUrl
      ? parseRingCentralVideoJoinTarget(event.joinUrl)
      : null;
  }

  private scheduleRefresh = (): void => {
    if (this.refreshTimer != null) return;
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      const changed = this.refreshSelectedMeeting();
      if (changed) {
        this.state.assist = null;
        this.state.prep = null;
        this.render();
        void this.loadMeetingPrep();
      } else {
        this.render();
      }
    }, REFRESH_INTERVAL_MS);
  };

  private async syncRingCentralCalendar(
    options: { forceRingCentral?: boolean; loadPrepAfterSync?: boolean } = {},
  ): Promise<void> {
    if (
      !options.forceRingCentral &&
      this.config?.MEETING_PREP_CALENDAR_SOURCE === 'outlook'
    ) {
      return;
    }
    try {
      const events = await readRingCentralCalendarEvents();
      this.state.events = events;
      if (events.length > 0) {
        const response = await sendRuntimeMessage<{
          result?: {
            created: number;
            updated: number;
            unchanged: number;
            total: number;
          };
        }>({
          type: 'CALENDAR_EVENTS_SYNC_REQUEST',
          sourceSystem: 'ringcentral_indexeddb',
          events,
        });
        const result = response?.result;
        this.state.syncLabel = result
          ? `已同步 ${result.total} 个会议，变化 ${
              result.created + result.updated
            }`
          : `已读取 ${events.length} 个会议`;
      } else {
        this.state.syncLabel = '未读取到本地会议';
      }
      this.state.error = '';
      this.refreshSelectedMeeting();
      if (this.state.enabled && options.loadPrepAfterSync !== false) {
        void this.loadMeetingPrep();
      }
    } catch (error) {
      console.warn('[TodayPilot] RingCentral calendar sync failed:', error);
      this.state.syncLabel = '本地日历读取失败';
      this.state.error =
        error instanceof Error ? error.message : 'calendar_sync_failed';
    } finally {
      this.render();
    }
  }

  private refreshSelectedMeeting(): boolean {
    const previous = this.state.selectedEvent;
    const previousKey = getEventKey(previous);

    const current = this.findSelectedEvent();
    const currentKey = getEventKey(current);
    this.state.selectedEvent = current;
    const changed = previousKey !== currentKey;
    if (changed) {
      this.assistRequestSeq += 1;
      this.lastPrepEventKey = null;
      this.state.assist = null;
      this.state.prep = null;
    }
    return changed;
  }

  private findSelectedEvent(): CalendarEventSyncItem | null {
    const activeEvents = this.state.events
      .filter((event) => !event.cancelled)
      .sort((a, b) => a.startTime - b.startTime);

    const routeMatch = findEventByExternalId(
      activeEvents,
      getVideoHomeRouteEventId(),
    );
    if (routeMatch) return routeMatch;

    const selectedItemMatch = findEventByExternalId(
      activeEvents,
      getSelectedCalendarEventIdFromDom(),
    );
    if (selectedItemMatch) return selectedItemMatch;

    const detailRoot = findMeetingDetailRoot();
    const detailTitle = getSelectedMeetingTitleFromDetail(detailRoot);
    const detailTitleMatch = findEventByDetailTitle(
      activeEvents,
      detailTitle,
      detailRoot,
    );
    if (detailTitleMatch) return detailTitleMatch;

    return null;
  }

  private async loadMeetingPrep(): Promise<void> {
    if (!this.state.selectedEvent || this.state.assist) return;

    const requestSeq = ++this.assistRequestSeq;
    const event = this.state.selectedEvent;
    const eventKey = getEventKey(event);
    this.state.loading = true;
    this.state.error = '';
    this.render();

    try {
      const response = await sendRuntimeMessage<{
        result?: TodayPilotMeetingPrepResolveResponse;
      }>({
        type: 'TODAY_PILOT_MEETING_PREP_REQUEST',
        request: {
          event,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          autoGenerate: false,
          forceGenerate: false,
        },
      });
      if (
        requestSeq !== this.assistRequestSeq ||
        eventKey !== getEventKey(this.state.selectedEvent)
      ) {
        return;
      }
      this.state.assist = response?.result?.assist || null;
      this.state.prep = response?.result?.prep || null;
      this.lastPrepEventKey = eventKey;
      await this.persistMeetingPilotHandoff();
    } catch (error) {
      if (requestSeq !== this.assistRequestSeq) return;
      console.warn('[TodayPilot] meeting prep failed:', error);
      this.state.error =
        error instanceof Error
          ? error.message
          : 'today_pilot_meeting_prep_failed';
    } finally {
      if (requestSeq === this.assistRequestSeq) {
        this.state.loading = false;
        this.render();
      }
    }
  }

  private async persistMeetingPilotHandoff(): Promise<void> {
    if (!this.state.selectedEvent || !this.state.assist?.insertText) return;
    if (!this.isPrepCurrent()) return;
    await chrome.storage.local.set({
      meetingPrepHandoff: {
        createdAt: Date.now(),
        expiresAt: Date.now() + 12 * 60 * 60 * 1000,
        event: this.state.selectedEvent,
        goal: '',
        text: this.state.assist.insertText,
        cueCards: this.state.assist.cueCards,
        evidence: this.state.assist.evidence,
        source: 'today_pilot',
        prepId: this.state.prep?.id,
        missionId: this.state.prep?.missionId,
        generatedMode: this.state.prep?.generatedMode,
      },
    });
  }

  private isPrepCurrent(): boolean {
    return Boolean(
      this.state.assist &&
        this.state.selectedEvent &&
        this.lastPrepEventKey === getEventKey(this.state.selectedEvent),
    );
  }

  private ensureHost(): HTMLElement | null {
    const target = findInjectionTarget();
    if (!target) {
      this.removeHost();
      return null;
    }

    const previousHost = this.host;
    const host =
      this.host ||
      (document.getElementById(HOST_ID) as HTMLElement | null) ||
      document.createElement('section');
    if (host !== previousHost) {
      this.hostListenersAttached = false;
    }
    host.id = HOST_ID;
    applyHostLayoutStyle(host);
    host.setAttribute('aria-label', 'Today Pilot meeting prep');
    mountHostAfterTarget(host, target);

    this.host = host;
    this.shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    if (!this.hostListenersAttached) {
      this.shadow.addEventListener('click', (event) => this.handleClick(event));
      this.hostListenersAttached = true;
    }
    return host;
  }

  private removeHost(): void {
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.hostListenersAttached = false;
  }

  private render(): void {
    if (!this.state.enabled) return;

    const event = this.state.selectedEvent;
    if (!event) {
      this.removeHost();
      return;
    }

    if (!this.ensureHost() || !this.shadow) return;

    const assist = this.state.assist;
    const prep = this.state.prep;
    const prepCurrent = this.isPrepCurrent();
    const displayAssist = assist && prepCurrent ? assist : null;
    const evidence = displayAssist ? getDisplayEvidence(displayAssist) : [];
    const cueCards = displayAssist
      ? getDisplayCueCards(displayAssist, event, evidence.length)
      : [];
    const iconUrl = chrome.runtime.getURL('icons/icon48.png');
    this.shadow.innerHTML = `
      <style>${styles()}</style>
      <div class="pai-card">
        <div class="pai-header">
          <div class="pai-title">
            <img class="pai-logo" src="${escapeHtmlAttribute(
              iconUrl,
            )}" alt="" />
            <span>Today Pilot 会前准备</span>
          </div>
          <button class="pai-icon" data-action="sync" title="刷新会前准备">↻</button>
        </div>
        <div class="pai-sub">${escapeHtml(
          getMeetingPrepSubtitle(
            this.state.loading,
            displayAssist,
            displayAssist ? prep : null,
            evidence.length,
            this.state.syncLabel,
          ),
        )}</div>
        <div class="pai-meeting">
          <div class="pai-meeting-title">${escapeHtml(
            event.title || '当前会议',
          )}</div>
          <div class="pai-time">${escapeHtml(
            formatMeetingTimeRange(event),
          )}</div>
          ${renderMeetingMeta(event)}
        </div>
        ${
          this.state.error
            ? `<div class="pai-error">${escapeHtml(this.state.error)}</div>`
            : ''
        }
        <div class="pai-assist-output" data-role="assist-output">
          ${
            !this.state.error && displayAssist?.summary
              ? `<div class="pai-empty">${escapeHtml(
                  displayAssist.summary,
                )}</div>`
              : ''
          }
          ${
            cueCards.length
              ? `<div class="pai-cues">${cueCards
                  .map(
                    (card) => `
                      <article class="pai-cue" data-kind="${escapeHtml(
                        card.kind,
                      )}">
                        <div class="pai-cue-title">${escapeHtml(
                          card.title,
                        )}</div>
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
                        <div>${escapeHtml(
                          item.sourceTitle ||
                            item.title ||
                            item.sourceLabel ||
                            'Memory',
                        )}</div>
                        <small>${escapeHtml(
                          item.whyMatched || item.sourceLabel || '',
                        )}</small>
                        ${renderEvidenceLinks(item)}
                      </div>
                    `,
                    )
                    .join('')}
                </details>`
              : ''
          }
        </div>
        <div class="pai-footer">
          <img class="pai-footer-icon" src="${escapeHtmlAttribute(
            iconUrl,
          )}" alt="" />
          <span>Provided by Personal AI</span>
        </div>
      </div>
    `;
  }

  private handleClick(event: Event): void {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const action =
      target?.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'sync') {
      void this.refreshMeetingPrep();
    }
  }

  private async refreshMeetingPrep(): Promise<void> {
    this.state.assist = null;
    this.state.prep = null;
    this.lastPrepEventKey = null;
    this.state.loading = true;
    this.state.error = '';
    this.render();
    await this.syncRingCentralCalendar({
      forceRingCentral: this.nativeJoinEnabled,
      loadPrepAfterSync: false,
    });
    if (!this.state.selectedEvent) {
      this.state.loading = false;
      this.render();
      return;
    }
    let prepareError = '';
    try {
      await this.prepareMeetingPrepBackfill();
    } catch (error) {
      prepareError =
        error instanceof Error ? error.message : 'today_pilot_prepare_failed';
      console.warn('[TodayPilot] meeting prep backfill failed:', error);
    }
    await this.loadMeetingPrep();
    if (prepareError && !this.state.assist) {
      this.state.error = prepareError;
      this.render();
    }
  }

  private async prepareMeetingPrepBackfill(): Promise<void> {
    if (!this.state.selectedEvent) {
      return;
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await sendRuntimeMessage({
      type: 'TODAY_PILOT_PREPARE_MEETINGS_REQUEST',
      request: {
        date: formatLocalDate(this.state.selectedEvent.startTime, timezone),
        timezone,
        horizonHours: 36,
        maxMeetings: 5,
        mode: 'nightly_llm',
      },
    });
  }
}

function findInjectionTarget(): HTMLElement | null {
  return findMeetingDetailRoot();
}

function mountHostAfterTarget(host: HTMLElement, target: HTMLElement): void {
  if (host.parentElement !== target || host.nextElementSibling) {
    target.appendChild(host);
  }
}

function applyHostLayoutStyle(host: HTMLElement): void {
  host.style.setProperty('display', 'block', 'important');
  host.style.setProperty('width', '100%', 'important');
  host.style.setProperty('max-width', '100%', 'important');
  host.style.setProperty('box-sizing', 'border-box', 'important');
  host.style.setProperty('flex', '0 0 100%', 'important');
  host.style.setProperty('align-self', 'stretch', 'important');
  host.style.setProperty('grid-column', '1 / -1', 'important');
  host.style.setProperty('clear', 'both', 'important');
  host.style.setProperty('position', 'relative', 'important');
  host.style.setProperty('z-index', '1', 'important');
}

function findMeetingDetailRoot(): HTMLElement | null {
  for (const selector of DETAIL_ROOT_SELECTORS) {
    const explicitRoot = Array.from(
      document.querySelectorAll<HTMLElement>(selector),
    ).find(
      (element) =>
        isDisplayedElement(element) &&
        !element.matches(DESCRIPTION_BOX_SELECTOR),
    );
    if (explicitRoot) {
      return explicitRoot;
    }
  }

  const descriptionBox = document.querySelector<HTMLElement>(
    DESCRIPTION_BOX_SELECTOR,
  );
  if (descriptionBox) {
    let current = descriptionBox.parentElement;
    while (current && current !== document.body) {
      const rect = current.getBoundingClientRect();
      if (rect.width >= 320 && rect.left >= window.innerWidth * 0.35) {
        return current;
      }
      current = current.parentElement;
    }
  }

  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('main, section, div'),
  )
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter(({ element, rect }) => {
      if (rect.width < 320 || rect.height < 260) return false;
      if (rect.left < window.innerWidth * 0.42) return false;
      const text = getVisibleText(element);
      return /participants|accepted|declined|join|conf|starts in|hi all/i.test(
        text,
      );
    })
    .sort(
      (a, b) => a.rect.width * a.rect.height - b.rect.width * b.rect.height,
    );
  return candidates[0]?.element || null;
}

function getSelectedCalendarEventIdFromDom(): string | null {
  const selectedItem = document.querySelector<HTMLElement>(
    SELECTED_EVENT_ITEM_SELECTORS,
  );
  return selectedItem?.getAttribute('data-calendar-event-item-id') || null;
}

function getSelectedMeetingTitleFromDetail(
  detailRoot: HTMLElement | null,
): string | null {
  if (!detailRoot) return null;

  const headingSelectors = [
    'h1',
    'h2',
    'h3',
    '[role="heading"]',
    '[data-test-automation-id*="title"]',
    '[data-test-automation-id*="name"]',
  ].join(', ');
  const heading = Array.from(
    detailRoot.querySelectorAll<HTMLElement>(headingSelectors),
  )
    .map((element) => ({
      element,
      text: normalizeText(element.textContent || ''),
      rect: element.getBoundingClientRect(),
    }))
    .filter(({ element, text, rect }) => {
      return (
        isDisplayedElement(element) &&
        rect.left >= window.innerWidth * 0.35 &&
        isProbableMeetingTitle(text)
      );
    })
    .sort((a, b) => a.rect.top - b.rect.top)[0];

  if (heading?.text) {
    return heading.text;
  }

  const lines = collectVisibleTextLines(detailRoot).filter(
    isProbableMeetingTitle,
  );
  return lines[0] || null;
}

function collectVisibleTextLines(root: HTMLElement): string[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'h1, h2, h3, [role="heading"], div, span, p',
    ),
  )
    .filter((element) => isDisplayedElement(element))
    .map((element) => normalizeText(element.textContent || ''))
    .filter(Boolean);
}

function findEventByExternalId(
  events: CalendarEventSyncItem[],
  externalId: string | null,
): CalendarEventSyncItem | null {
  if (!externalId) return null;
  const normalizedExternalId = normalizeEventId(externalId);
  return (
    events.find((event) => {
      return (
        normalizeEventId(event.externalId) === normalizedExternalId ||
        normalizeEventId(event.seriesKey || '') === normalizedExternalId
      );
    }) || null
  );
}

function findEventByDetailTitle(
  events: CalendarEventSyncItem[],
  detailTitle: string | null,
  detailRoot: HTMLElement | null,
): CalendarEventSyncItem | null {
  if (!detailTitle) return null;
  const normalizedDetailTitle = normalizeMeetingTitle(detailTitle);
  if (!normalizedDetailTitle) return null;

  const candidates = events.filter((event) => {
    const normalizedEventTitle = normalizeMeetingTitle(event.title);
    if (!normalizedEventTitle) return false;
    if (normalizedEventTitle === normalizedDetailTitle) return true;
    if (
      normalizedEventTitle.length >= 8 &&
      normalizedDetailTitle.includes(normalizedEventTitle)
    ) {
      return true;
    }
    return (
      normalizedDetailTitle.length >= 8 &&
      normalizedEventTitle.includes(normalizedDetailTitle)
    );
  });

  if (candidates.length <= 1) {
    return candidates[0] || null;
  }

  const detailText = getVisibleText(detailRoot).toLowerCase();
  const textMatch = candidates.find((event) => {
    const matchingValues = [
      formatShortTime(event.startTime),
      event.location || '',
      event.organizer?.name || '',
      event.organizer?.email || '',
    ].filter((value): value is string => Boolean(value));
    return matchingValues.some((value) =>
      detailText.includes(value.toLowerCase()),
    );
  });
  return textMatch || candidates[0];
}

function normalizeEventId(value: string): string {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

function normalizeMeetingTitle(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isProbableMeetingTitle(text: string): boolean {
  if (text.length < 3 || text.length > 180) return false;
  if (
    /^(video meetings|upcoming|past|notes|recordings|participants|accepted|declined|join)$/i.test(
      text,
    )
  ) {
    return false;
  }
  if (
    /^(starts in|conf rm|meeting id|passcode|please join using this link)/i.test(
      text,
    )
  ) {
    return false;
  }
  if (/^[A-Z][a-z]{2},\s+[A-Z][a-z]{2}\s+\d{1,2}/.test(text)) {
    return false;
  }
  if (/^\d{1,2}:\d{2}\s*(AM|PM)?\s*-/.test(text)) {
    return false;
  }
  return true;
}

function formatShortTime(value: number): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isDisplayedElement(
  element: Element | null | undefined,
): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0
  );
}

function findVideoHomeJoinButton(event: MouseEvent): HTMLElement | null {
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }

  return (
    target.closest<HTMLElement>(
      [
        'button[data-test-automation-id="calendar-event-item-join-button"]',
        'button[data-test-automation-id="join-meeting-button"]',
        'button[data-test-automation-id="mini-join-button"]',
      ].join(', '),
    ) || findJoinButtonLikeTarget(target)
  );
}

function findJoinButtonLikeTarget(target: Element): HTMLElement | null {
  const button = target.closest<HTMLElement>('button, [role="button"]');
  if (!button || !isDisplayedElement(button)) {
    return null;
  }

  const label = [
    button.getAttribute('aria-label'),
    button.getAttribute('title'),
    button.textContent,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/\bjoin\b/i.test(label)) {
    return null;
  }

  const surface = button.closest<HTMLElement>(
    [
      '[data-at*="calendar-event" i]',
      '[data-test-automation-id*="calendar-event" i]',
      '[data-test-automation-id*="meeting-detail" i]',
      '[data-test-automation-id="video__leftPanel"]',
      '[data-test-automation-id="video__rightPanel"]',
    ].join(', '),
  );
  return surface ? button : null;
}

function shouldPreserveVideoHomeNativeJoinClick(event: MouseEvent): boolean {
  return shouldPreserveDefaultNativeJoinClick(event);
}

function getVideoHomeRouteEventId(): string | null {
  const parts = location.pathname.split('/').filter(Boolean);
  const homeIndex = parts.findIndex(
    (part, index) => part === 'home' && parts[index - 1] === 'video',
  );
  const encodedEventId = homeIndex >= 0 ? parts[homeIndex + 1] : null;
  if (!encodedEventId) {
    return null;
  }

  return decodeVideoHomeRouteEventId(encodedEventId);
}

function decodeVideoHomeRouteEventId(encodedEventId: string): string | null {
  try {
    const normalized = decodeURIComponent(encodedEventId)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return window.atob(padded);
  } catch {
    return null;
  }
}

function findRingCentralVideoJoinUrlNearElement(
  element: Element | null,
): string | null {
  if (!element) {
    return null;
  }

  const anchor = element.querySelector<HTMLAnchorElement>(
    'a[href*="v.ringcentral.com/join/"], a[href*="v.ringcentral.com/launcher/"], a[href*="v.ringcentral.com/conf/on/"]',
  );
  if (anchor?.href) {
    return anchor.href;
  }

  for (const attribute of Array.from(element.attributes || [])) {
    const url = extractRingCentralVideoJoinUrl(attribute.value);
    if (url) {
      return url;
    }
  }

  return extractRingCentralVideoJoinUrl(element.textContent || '');
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

function getEventKey(event: CalendarEventSyncItem | null): string | null {
  if (!event) return null;
  return (
    event.externalId ||
    event.seriesKey ||
    [event.title, event.startTime].filter(Boolean).join('@') ||
    null
  );
}

function escapeHtml(value: string | undefined): string {
  const div = document.createElement('div');
  div.textContent = value || '';
  return div.innerHTML;
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function renderEvidenceLinks(
  item: ContextAssistResponse['evidence'][number],
): string {
  const links: Array<{ label: string; url: string }> = [];
  const seen = new Set<string>();
  const addLink = (label: string, url: string | null): void => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    links.push({ label, url });
  };

  const safeExploreRoute = sanitizeExploreRoute(item.exploreLink);
  if (safeExploreRoute) {
    addLink(
      '在记忆中查看',
      chrome.runtime.getURL(`memory-exploring.html${safeExploreRoute}`),
    );
  }

  for (const link of item.links ?? []) {
    addLink(
      link.label || '打开来源',
      sanitizeContextExternalUrl(link.url, window.location.href),
    );
  }

  addLink(
    '打开来源',
    sanitizeContextExternalUrl(item.sourceUrl, window.location.href),
  );

  if (links.length === 0) return '';
  return `<div class="pai-source-actions">${links
    .map(
      (link) =>
        `<a href="${escapeHtmlAttribute(
          link.url,
        )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          link.label,
        )}</a>`,
    )
    .join('')}</div>`;
}

function getDisplayEvidence(
  assist: ContextAssistResponse,
): ContextAssistResponse['evidence'] {
  return assist.evidence.filter(isUsefulMeetingPrepEvidence).slice(0, 5);
}

function getDisplayCueCards(
  assist: ContextAssistResponse,
  event?: CalendarEventSyncItem | null,
  evidenceCount = getDisplayEvidence(assist).length,
): ContextAssistResponse['cueCards'] {
  const displayEvidenceIds = new Set(
    getDisplayEvidence(assist).map((item) => item.id),
  );
  return assist.cueCards
    .filter((card) => {
      if (card.id === 'missing-goal') {
        return false;
      }
      if (card.kind !== 'memory') {
        return true;
      }
      const evidenceIds = card.evidenceIds || [];
      return (
        evidenceIds.length === 0 ||
        evidenceIds.some((id) => displayEvidenceIds.has(id))
      );
    })
    .map((card) => {
      if (card.id !== 'brief') return card;
      const title = event?.title || assist.title || '本次会议';
      return {
        ...card,
        body: `${title} 已匹配到 ${evidenceCount} 条相关记忆。优先核对最近承诺、依赖进展和未关闭的问题。`,
      };
    });
}

function isUsefulMeetingPrepEvidence(
  item: ContextAssistResponse['evidence'][number],
): boolean {
  const snippet = item.snippet?.trim() || '';
  if (!snippet) return false;

  const labelText = [
    item.sourceLabel,
    item.sourceTitle,
    item.title,
    item.whyMatched,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const fullText = `${labelText} ${snippet}`.toLowerCase();
  const looksLikeCalendarOnly =
    /calendar event|ringcentral video|会议:\s*ringcentral video/.test(fullText);
  const hasWorkSignal =
    /\b(mtr|jira|glip|thread|message|bug|issue|follow|dependency|blocked)\b/i.test(
      fullText,
    ) || /承诺|依赖|进展|问题|风险|决定|待办|阻塞/.test(fullText);

  return !looksLikeCalendarOnly || hasWorkSignal;
}

function getMeetingPrepSubtitle(
  loading: boolean,
  assist: ContextAssistResponse | null,
  prep: TodayPilotMeetingPrepRecord | null,
  evidenceCount: number,
  syncLabel: string,
): string {
  const syncSuffix =
    syncLabel && syncLabel !== '未同步' ? ` · ${syncLabel}` : '';
  if (loading) return `正在读取 Today Pilot 会前准备${syncSuffix}`;
  if (!assist) return `Today Pilot 暂未为这场会议生成提前准备${syncSuffix}`;
  if (!assist.available || evidenceCount === 0) {
    return `暂无高置信记忆，仍可查看会议基础信息${syncSuffix}`;
  }
  if (prep?.generatedMode === 'nightly_llm') {
    return `已提前准备 · ${evidenceCount} 条证据${syncSuffix}`;
  }
  if (prep?.generatedMode === 'on_demand_llm') {
    return `已准备目标版本 · ${evidenceCount} 条证据${syncSuffix}`;
  }
  return `已准备 fallback · ${evidenceCount} 条证据${syncSuffix}`;
}

function formatMeetingTimeRange(event: CalendarEventSyncItem): string {
  const start = formatMeetingDateTime(event.startTime);
  const end = formatMeetingDateTime(event.endTime);
  if (start && end) return `${start} - ${end}`;
  return start || end || '时间待确认';
}

function formatMeetingDateTime(value?: number): string {
  if (!value) return '';
  return toCalendarDate(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatLocalDate(value: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(toCalendarDate(value));
}

function toCalendarDate(value: number): Date {
  return new Date(value > 10_000_000_000 ? value : value * 1000);
}

function renderMeetingMeta(event: CalendarEventSyncItem): string {
  const organizer = event.organizer?.name || event.organizer?.email;
  const attendeeCount = event.attendees?.length || 0;
  const parts = [
    organizer ? `Organizer: ${organizer}` : '',
    attendeeCount ? `${attendeeCount} attendees` : '',
  ].filter(Boolean);
  if (parts.length === 0) return '';
  return `<div class="pai-time">${escapeHtml(parts.join(' · '))}</div>`;
}

function styles(): string {
  return `
    :host {
      display: block;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      margin-top: 18px;
      margin-bottom: 18px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #1f2937;
    }
    .pai-card {
      border: 2px solid #ff385c;
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 6px 18px rgba(244, 63, 94, 0.12);
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
    .pai-logo {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      flex: 0 0 auto;
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
    .pai-goal-label {
      display: block;
      margin-top: 12px;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
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
    .pai-assist-output[hidden] {
      display: none !important;
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
    .pai-source-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }
    .pai-source-actions a {
      color: #0b66b2;
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
    }
    .pai-source-actions a:hover {
      text-decoration: underline;
    }
    .pai-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      border-top: 1px solid #f1f5f9;
      margin-top: 12px;
      padding-top: 8px;
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
    }
    .pai-footer-icon {
      width: 14px;
      height: 14px;
      border-radius: 4px;
    }
  `;
}

let ringCentralVideoHomePrepStarted = false;
let ringCentralVideoHomeRouteWatcherAttached = false;
let ringCentralVideoHomeLastHref = location.href;

function isRingCentralVideoHomeRoute(): boolean {
  return (
    location.hostname === 'app.ringcentral.com' &&
    location.pathname.startsWith('/video/home')
  );
}

function startRingCentralVideoHomePrepIfNeeded(): void {
  if (ringCentralVideoHomePrepStarted || !isRingCentralVideoHomeRoute()) {
    return;
  }

  ringCentralVideoHomePrepStarted = true;
  void new RingCentralVideoHomePrep().start();
}

function scheduleRingCentralVideoHomePrepCheck(): void {
  window.setTimeout(startRingCentralVideoHomePrepIfNeeded, 0);
}

function checkRingCentralVideoHomeRoute(): void {
  if (location.href === ringCentralVideoHomeLastHref) {
    startRingCentralVideoHomePrepIfNeeded();
    return;
  }

  ringCentralVideoHomeLastHref = location.href;
  startRingCentralVideoHomePrepIfNeeded();
}

function watchRingCentralVideoHomeRoute(): void {
  if (ringCentralVideoHomeRouteWatcherAttached) {
    return;
  }

  const originalPushState = history.pushState.bind(history);
  history.pushState = ((...args: Parameters<History['pushState']>) => {
    const result = originalPushState(...args);
    scheduleRingCentralVideoHomePrepCheck();
    return result;
  }) as History['pushState'];

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = ((...args: Parameters<History['replaceState']>) => {
    const result = originalReplaceState(...args);
    scheduleRingCentralVideoHomePrepCheck();
    return result;
  }) as History['replaceState'];

  window.addEventListener('popstate', scheduleRingCentralVideoHomePrepCheck);
  window.addEventListener('hashchange', scheduleRingCentralVideoHomePrepCheck);
  window.setInterval(checkRingCentralVideoHomeRoute, 500);
  ringCentralVideoHomeRouteWatcherAttached = true;
}

if (location.hostname === 'app.ringcentral.com') {
  watchRingCentralVideoHomeRoute();
  startRingCentralVideoHomePrepIfNeeded();
}
