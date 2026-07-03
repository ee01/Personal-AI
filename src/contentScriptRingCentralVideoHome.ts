import type {
  CalendarEventSyncItem,
  ContextAssistResponse,
  StorylineOpportunity,
  StorylineSuggestedArtifact,
  TodayPilotMeetingPrepRecord,
  TodayPilotMeetingPrepPrepareResponse,
  TodayPilotMeetingPrepResolveResponse,
} from './services/MemoryServiceClient';
import { readRingCentralCalendarEvents } from './context-assist/ringCentralCalendar';
import {
  DEFAULT_RECALL_SOURCE_TYPES_WITHOUT_REHEARSAL,
  filterSceneRehearsalSourceTypes,
  normalizeEnvConfigShape,
  type EnvConfigType,
} from './utils';
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
const MEETING_PREP_HANDOFF_STORAGE_KEY = 'meetingPrepHandoff';
const MEETING_PREP_HANDOFFS_STORAGE_KEY = 'meetingPrepHandoffs';
const MEETING_PREP_HANDOFF_MAX_ITEMS = 8;
const STORYLINE_DISMISS_STORAGE_KEY = 'storylineOpportunityDismissals';
const STORYLINE_DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
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
  refreshReceipt: MeetingPrepRefreshReceipt | null;
  loading: boolean;
  syncLabel: string;
  error: string;
}

interface MeetingPrepRefreshReceipt {
  status: 'pending' | 'success' | 'warning' | 'failed';
  title: string;
  body: string;
  chips: string[];
  boundary: string;
}

interface MeetingPrepHandoffStorageItem {
  createdAt: number;
  expiresAt: number;
  event: CalendarEventSyncItem;
  goal: string;
  text: string;
  cueCards: ContextAssistResponse['cueCards'];
  evidence: ContextAssistResponse['evidence'];
  source: 'today_pilot';
  prepId?: string;
  missionId?: string;
  generatedMode?: string;
}

interface StorylineDismissReceipt {
  dismissKey: string;
  eventTitle: string;
  expiresAt: number;
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
  private storylineDismissals: Record<string, number> = {};
  private storylineDismissalsLoaded = false;
  private storylineDismissReceipt: StorylineDismissReceipt | null = null;
  private state: MeetingPrepState = {
    enabled: true,
    events: [],
    selectedEvent: null,
    assist: null,
    prep: null,
    refreshReceipt: null,
    loading: false,
    syncLabel: '未同步',
    error: '',
  };

  handleRouteChange(): void {
    if (this.deactivateForNonVideoHomeRoute()) {
      return;
    }
    if (this.state.enabled) {
      this.scheduleRefresh();
    }
    if (
      !this.state.events.length &&
      (this.state.enabled || this.nativeJoinEnabled)
    ) {
      void this.syncRingCentralCalendar({
        forceRingCentral: this.nativeJoinEnabled,
      });
    }
  }

  async start(): Promise<void> {
    this.config = await this.loadConfig();
    await this.loadStorylineDismissals();
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

  private async loadStorylineDismissals(): Promise<void> {
    if (this.storylineDismissalsLoaded) return;
    this.storylineDismissalsLoaded = true;
    try {
      const stored = await chrome.storage.local.get([
        STORYLINE_DISMISS_STORAGE_KEY,
      ]);
      const raw = stored?.[STORYLINE_DISMISS_STORAGE_KEY];
      const nowMs = Date.now();
      const next: Record<string, number> = {};
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [key, expiresAt] of Object.entries(
          raw as Record<string, unknown>,
        )) {
          const numericExpiresAt = Number(expiresAt);
          if (key && numericExpiresAt > nowMs) {
            next[key] = numericExpiresAt;
          }
        }
      }
      this.storylineDismissals = next;
      await chrome.storage.local.set({
        [STORYLINE_DISMISS_STORAGE_KEY]: next,
      });
    } catch (error) {
      console.debug('[TodayPilot] storyline dismissal load failed:', error);
      this.storylineDismissals = {};
    }
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
      if (this.deactivateForNonVideoHomeRoute()) {
        return;
      }
      const changed = this.refreshSelectedMeeting();
      if (changed) {
      this.state.assist = null;
      this.state.prep = null;
      this.state.refreshReceipt = null;
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
      if (
        this.state.enabled &&
        options.loadPrepAfterSync !== false &&
        isRingCentralVideoHomeRoute()
      ) {
        void this.loadMeetingPrep();
      }
    } catch (error) {
      console.warn('[TodayPilot] RingCentral calendar sync failed:', error);
      this.state.syncLabel = '本地日历读取失败';
      this.state.error =
        error instanceof Error ? error.message : 'calendar_sync_failed';
    } finally {
      if (isRingCentralVideoHomeRoute()) {
        this.render();
      } else {
        this.deactivateForNonVideoHomeRoute();
      }
    }
  }

  private refreshSelectedMeeting(): boolean {
    if (!isRingCentralVideoHomeRoute()) {
      return this.clearRouteScopedState();
    }

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
      this.state.refreshReceipt = null;
      this.storylineDismissReceipt = null;
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

  private async loadMeetingPrep(options: {
    refresh?: {
      prepareResult?: TodayPilotMeetingPrepPrepareResponse | null;
      prepareError?: string;
    };
  } = {}): Promise<void> {
    if (
      !isRingCentralVideoHomeRoute() ||
      !this.state.selectedEvent ||
      this.state.assist
    ) {
      return;
    }

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
          sourceTypes: filterSceneRehearsalSourceTypes(
            undefined,
            this.config,
            DEFAULT_RECALL_SOURCE_TYPES_WITHOUT_REHEARSAL,
          ),
        },
      });
      if (
        !isRingCentralVideoHomeRoute() ||
        requestSeq !== this.assistRequestSeq ||
        eventKey !== getEventKey(this.state.selectedEvent)
      ) {
        return;
      }
      this.state.assist = response?.result?.assist || null;
      this.state.prep = response?.result?.prep || null;
      this.lastPrepEventKey = eventKey;
      if (options.refresh) {
        this.state.refreshReceipt = buildRefreshReceipt({
          event,
          prepareResult: options.refresh.prepareResult,
          prepareError: options.refresh.prepareError,
          resolve: response?.result || null,
          syncLabel: this.state.syncLabel,
        });
      }
      await this.persistMeetingPilotHandoff();
    } catch (error) {
      if (requestSeq !== this.assistRequestSeq) return;
      console.warn('[TodayPilot] meeting prep failed:', error);
      this.state.error =
        error instanceof Error
          ? error.message
          : 'today_pilot_meeting_prep_failed';
      if (options.refresh) {
        this.state.refreshReceipt = buildRefreshReceipt({
          event,
          prepareResult: options.refresh.prepareResult,
          prepareError: options.refresh.prepareError,
          resolveError: this.state.error,
          syncLabel: this.state.syncLabel,
        });
      }
    } finally {
      if (
        requestSeq === this.assistRequestSeq &&
        isRingCentralVideoHomeRoute()
      ) {
        this.state.loading = false;
        this.render();
      }
    }
  }

  private async persistMeetingPilotHandoff(): Promise<void> {
    if (!this.state.selectedEvent || !this.state.assist?.insertText) return;
    if (!this.isPrepCurrent()) return;
    const createdAt = Date.now();
    const goal = buildMeetingPrepHandoffGoal(
      this.state.assist,
      this.state.selectedEvent,
    );
    const handoff: MeetingPrepHandoffStorageItem = {
      createdAt,
      expiresAt: createdAt + 12 * 60 * 60 * 1000,
      event: this.state.selectedEvent,
      goal,
      text: this.state.assist.insertText,
      cueCards: this.state.assist.cueCards,
      evidence: this.state.assist.evidence,
      source: 'today_pilot',
      prepId: this.state.prep?.id,
      missionId: this.state.prep?.missionId,
      generatedMode: this.state.prep?.generatedMode,
    };
    const handoffKey = getMeetingPrepHandoffStorageKey(handoff);
    const existing = await chrome.storage.local.get([
      MEETING_PREP_HANDOFFS_STORAGE_KEY,
    ]);
    const handoffs = normalizeMeetingPrepHandoffStore(
      existing?.[MEETING_PREP_HANDOFFS_STORAGE_KEY],
    );
    handoffs[handoffKey] = handoff;
    await chrome.storage.local.set({
      [MEETING_PREP_HANDOFF_STORAGE_KEY]: handoff,
      [MEETING_PREP_HANDOFFS_STORAGE_KEY]: pruneMeetingPrepHandoffs(handoffs),
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
    if (!isRingCentralVideoHomeRoute()) {
      this.removeHost();
      return null;
    }

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
    if (!isRingCentralVideoHomeRoute()) {
      this.deactivateForNonVideoHomeRoute();
      return;
    }

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
    const storylineOpportunity =
      displayAssist && prep
        ? this.getVisibleStorylineOpportunity(displayAssist, prep, event)
        : null;
    const storylineDismissReceipt =
      displayAssist && prep && !storylineOpportunity
        ? this.getStorylineDismissReceipt(prep, event)
        : null;
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
        ${displayAssist && prep ? renderPrepReceipt(prep, displayAssist, evidence.length) : ''}
        ${this.state.refreshReceipt ? renderRefreshReceipt(this.state.refreshReceipt) : ''}
        <div class="pai-assist-output" data-role="assist-output">
          ${
            !this.state.error && displayAssist?.summary
              ? `<div class="pai-empty">${escapeHtml(
                  displayAssist.summary,
                )}</div>`
              : ''
          }
          ${
            storylineOpportunity && prep
              ? renderStorylineOpportunity(
                  storylineOpportunity,
                  prep,
                  event,
                )
              : ''
          }
          ${
            storylineDismissReceipt
              ? renderStorylineDismissReceipt(storylineDismissReceipt)
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
    } else if (action === 'storyline-generate') {
      this.openStorylineDraft();
    } else if (action === 'storyline-dismiss') {
      void this.dismissStorylineOpportunity();
    }
  }

  private getVisibleStorylineOpportunity(
    assist: ContextAssistResponse,
    prep: TodayPilotMeetingPrepRecord,
    event: CalendarEventSyncItem,
  ): StorylineOpportunity | null {
    const opportunity =
      prep.storylineOpportunity || assist.storylineOpportunity || null;
    if (
      !opportunity?.available ||
      opportunity.confidence < 0.55 ||
      !opportunity.oneLineReason
    ) {
      return null;
    }
    const dismissKey = getStorylineDismissKey(prep, event);
    if (dismissKey && this.storylineDismissals[dismissKey] > Date.now()) {
      return null;
    }
    return opportunity;
  }

  private getStorylineDismissReceipt(
    prep: TodayPilotMeetingPrepRecord,
    event: CalendarEventSyncItem,
  ): StorylineDismissReceipt | null {
    const dismissKey = getStorylineDismissKey(prep, event);
    if (
      !dismissKey ||
      !this.storylineDismissReceipt ||
      this.storylineDismissReceipt.dismissKey !== dismissKey ||
      this.storylineDismissReceipt.expiresAt <= Date.now()
    ) {
      return null;
    }
    return this.storylineDismissReceipt;
  }

  private openStorylineDraft(): void {
    const prep = this.state.prep;
    const event = this.state.selectedEvent;
    const assist = this.state.assist;
    if (!prep || !event || !assist || !this.isPrepCurrent()) return;
    const opportunity = this.getVisibleStorylineOpportunity(assist, prep, event);
    if (!opportunity) return;
    const params = new URLSearchParams({
      source: 'today_meeting_prep',
      prepId: prep.id,
      target: opportunity.suggestedArtifact || 'speaker_notes',
    });
    if (opportunity.audienceHint) {
      params.set('audience', opportunity.audienceHint);
    }
    const url = chrome.runtime.getURL(
      `memory-exploring.html#/storylines/draft?${params.toString()}`,
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private async dismissStorylineOpportunity(): Promise<void> {
    const prep = this.state.prep;
    const event = this.state.selectedEvent;
    if (!prep || !event) return;
    const dismissKey = getStorylineDismissKey(prep, event);
    if (!dismissKey) return;
    const expiresAt = Date.now() + STORYLINE_DISMISS_TTL_MS;
    this.storylineDismissals[dismissKey] = expiresAt;
    await chrome.storage.local.set({
      [STORYLINE_DISMISS_STORAGE_KEY]: this.storylineDismissals,
    });
    this.storylineDismissReceipt = {
      dismissKey,
      eventTitle: event.title || prep.eventTitle || '当前会议',
      expiresAt,
    };
    this.render();
  }

  private async refreshMeetingPrep(): Promise<void> {
    if (!isRingCentralVideoHomeRoute()) {
      this.deactivateForNonVideoHomeRoute();
      return;
    }
    this.state.assist = null;
    this.state.prep = null;
    this.lastPrepEventKey = null;
    this.state.refreshReceipt = buildPendingRefreshReceipt(
      this.state.selectedEvent,
      this.state.syncLabel,
    );
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
    let prepareResult: TodayPilotMeetingPrepPrepareResponse | null = null;
    let prepareError = '';
    try {
      prepareResult = await this.prepareMeetingPrepBackfill();
    } catch (error) {
      prepareError =
        error instanceof Error ? error.message : 'today_pilot_prepare_failed';
      console.warn('[TodayPilot] meeting prep backfill failed:', error);
    }
    await this.loadMeetingPrep({
      refresh: {
        prepareResult,
        prepareError,
      },
    });
    if (prepareError && !this.state.assist) {
      this.state.error = prepareError;
      this.state.refreshReceipt = buildRefreshReceipt({
        event: this.state.selectedEvent,
        prepareResult,
        prepareError,
        resolveError: prepareError,
        syncLabel: this.state.syncLabel,
      });
      this.render();
    }
  }

  private async prepareMeetingPrepBackfill(): Promise<TodayPilotMeetingPrepPrepareResponse | null> {
    if (!isRingCentralVideoHomeRoute() || !this.state.selectedEvent) {
      return null;
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await sendRuntimeMessage<{
      result?: TodayPilotMeetingPrepPrepareResponse;
      success?: boolean;
      error?: string;
    }>({
      type: 'TODAY_PILOT_PREPARE_MEETINGS_REQUEST',
      request: {
        date: formatLocalDate(this.state.selectedEvent.startTime, timezone),
        timezone,
        horizonHours: 36,
        maxMeetings: 5,
        mode: 'nightly_llm',
      },
    });
    if (response?.success === false) {
      throw new Error(response.error || 'today_pilot_prepare_failed');
    }
    return response?.result || null;
  }

  private deactivateForNonVideoHomeRoute(): boolean {
    if (isRingCentralVideoHomeRoute()) {
      return false;
    }
    this.clearRouteScopedState();
    this.removeHost();
    return true;
  }

  private clearRouteScopedState(): boolean {
    const hadRouteScopedState = Boolean(
      this.state.selectedEvent ||
      this.state.assist ||
      this.state.prep ||
      this.state.refreshReceipt ||
      this.state.loading ||
        this.state.error ||
        this.lastPrepEventKey ||
        this.storylineDismissReceipt,
    );
    if (!hadRouteScopedState) {
      return false;
    }
    this.assistRequestSeq += 1;
    this.state.selectedEvent = null;
    this.state.assist = null;
    this.state.prep = null;
    this.state.refreshReceipt = null;
    this.state.loading = false;
    this.state.error = '';
    this.lastPrepEventKey = null;
    this.storylineDismissReceipt = null;
    return true;
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

function getMeetingPrepHandoffStorageKey(
  handoff: MeetingPrepHandoffStorageItem,
): string {
  return [
    handoff.event.externalId,
    handoff.event.seriesKey,
    handoff.event.startTime,
    handoff.prepId,
  ]
    .filter(Boolean)
    .map((part) => encodeURIComponent(String(part)))
    .join('|');
}

function buildMeetingPrepHandoffGoal(
  assist: ContextAssistResponse,
  event: CalendarEventSyncItem,
): string {
  const cards = Array.isArray(assist.cueCards) ? assist.cueCards : [];
  const actionCard = cards.find((card) => {
    return card.kind === 'action' && (card.body || card.title);
  });
  const questionCard = cards.find((card) => {
    return card.kind === 'question' && (card.body || card.title);
  });
  const briefCard = cards.find((card) => {
    return card.kind === 'brief' && (card.body || card.title);
  });

  const candidates = [
    actionCard?.body || actionCard?.title || '',
    questionCard
      ? `会中确认：${questionCard.body || questionCard.title || ''}`
      : '',
    assist.summary || '',
    briefCard?.body || briefCard?.title || '',
  ];

  for (const candidate of candidates) {
    const goal = normalizeMeetingPrepGoalText(candidate, event.title);
    if (goal) {
      return goal;
    }
  }

  return normalizeMeetingPrepGoalText(
    `明确 ${event.title || '本场会议'} 的下一步、owner 和风险。`,
    event.title,
  );
}

function normalizeMeetingPrepGoalText(
  value: string | undefined,
  eventTitle: string | undefined,
  maxLength = 120,
): string {
  const normalizedTitle = normalizeMeetingTitle(eventTitle || '');
  const lines = String(value || '')
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/<[^>]*>/g, ' ')
        .replace(/^#+\s*/g, '')
        .replace(/^[\s>*-]+/g, '')
        .replace(/[`*_]+/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .filter((line) => normalizeMeetingTitle(line) !== normalizedTitle)
    .filter((line) => !/^today pilot (?:会前准备|meeting prep)/i.test(line));
  const firstLine = lines[0] || '';
  if (!firstLine) {
    return '';
  }
  return firstLine.length <= maxLength
    ? firstLine
    : `${firstLine.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function isMeetingPrepHandoffStorageItem(
  value: unknown,
): value is MeetingPrepHandoffStorageItem {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Partial<MeetingPrepHandoffStorageItem>;
  return Boolean(
    Number.isFinite(Number(item.createdAt)) &&
      Number.isFinite(Number(item.expiresAt)) &&
      item.event &&
      typeof item.event === 'object' &&
      String((item.event as CalendarEventSyncItem).title || '').trim() &&
      String(item.text || '').trim(),
  );
}

function normalizeMeetingPrepHandoffStore(
  value: unknown,
): Record<string, MeetingPrepHandoffStorageItem> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const store: Record<string, MeetingPrepHandoffStorageItem> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (isMeetingPrepHandoffStorageItem(item)) {
      store[key] = item;
    }
  }
  return store;
}

function pruneMeetingPrepHandoffs(
  store: Record<string, MeetingPrepHandoffStorageItem>,
): Record<string, MeetingPrepHandoffStorageItem> {
  const nowMs = Date.now();
  return Object.entries(store)
    .filter(([, handoff]) => Number(handoff.expiresAt) > nowMs)
    .sort((left, right) => right[1].createdAt - left[1].createdAt)
    .slice(0, MEETING_PREP_HANDOFF_MAX_ITEMS)
    .reduce<Record<string, MeetingPrepHandoffStorageItem>>(
      (next, [key, handoff]) => {
        next[key] = handoff;
        return next;
      },
      {},
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

  if (isCalendarOnlyMeetingPrepEvidence(item)) {
    return false;
  }

  return true;
}

function isCalendarOnlyMeetingPrepEvidence(
  item: ContextAssistResponse['evidence'][number],
): boolean {
  const labelText = [
    item.id,
    item.sourceLabel,
    item.sourceTitle,
    item.title,
    item.whyMatched,
    item.snippet,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    String(item.id || '').startsWith('calendar:') ||
    String(item.sourceLabel || '').toLowerCase() === 'calendar' ||
    /calendar event|ringcentral video|会议:\s*ringcentral video/.test(labelText)
  );
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
  if (!assist.available) {
    return `暂无高置信记忆，仍可查看会议基础信息${syncSuffix}`;
  }
  if (evidenceCount === 0) {
    const baseMode =
      prep?.generatedMode === 'deterministic_fallback'
        ? 'fallback'
        : prep?.generatedMode === 'on_demand_llm'
          ? '目标版本'
          : '基础版';
    return `已准备${baseMode} · 高置信记忆 0 条${syncSuffix}`;
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

function getMeetingPrepModeLabel(
  prep: TodayPilotMeetingPrepRecord,
): string {
  if (prep.status === 'fallback') {
    return '规则 fallback';
  }
  if (prep.generatedMode === 'on_demand_llm') {
    return '目标版本';
  }
  if (prep.generatedMode === 'nightly_llm') {
    return '提前准备';
  }
  return '基础准备';
}

function getMeetingPrepBoundaryText(
  prep: TodayPilotMeetingPrepRecord,
  assist: ContextAssistResponse,
  visibleEvidenceCount: number,
): string {
  const stats = getMeetingPrepReceiptStats(prep, assist, visibleEvidenceCount);
  if (prep.status === 'fallback') {
    return 'LLM 暂不可用时使用规则 fallback；先核对 owner、下一步和风险，刷新后可补齐更完整记忆。';
  }
  if (stats.visibleEvidence === 0 && stats.totalEvidence > 0) {
    return '仅命中日历/基础信息；它会带入 Meeting Pilot 作为准备背景，但不会伪装成高置信记忆。';
  }
  if (stats.totalEvidence === 0) {
    return '暂无可追溯记忆来源；先用日历信息明确 owner、下一步和风险，刷新后可补齐。';
  }
  if (stats.backgroundEvidence > 0) {
    return `${stats.visibleEvidence} 条高置信来源可展开，${stats.backgroundEvidence} 条日历或低信号来源只作为准备背景保留。`;
  }
  return '已按可追溯来源生成；可展开证据查看来源。';
}

function getMeetingPrepReceiptStats(
  prep: TodayPilotMeetingPrepRecord,
  assist: ContextAssistResponse,
  visibleEvidenceCount: number,
): {
  totalEvidence: number;
  visibleEvidence: number;
  backgroundEvidence: number;
} {
  const totalEvidence = Math.max(
    prep.evidenceRefs?.length || 0,
    assist.evidence?.length || 0,
  );
  const visibleEvidence = Math.min(
    Math.max(0, visibleEvidenceCount),
    totalEvidence,
  );
  return {
    totalEvidence,
    visibleEvidence,
    backgroundEvidence: Math.max(0, totalEvidence - visibleEvidence),
  };
}

function renderPrepReceipt(
  prep: TodayPilotMeetingPrepRecord,
  assist: ContextAssistResponse,
  visibleEvidenceCount: number,
): string {
  const stats = getMeetingPrepReceiptStats(prep, assist, visibleEvidenceCount);
  const modeLabel = getMeetingPrepModeLabel(prep);
  const receiptChips = [
    modeLabel,
    `高置信 ${stats.visibleEvidence} 条`,
    `基础背景 ${stats.backgroundEvidence} 条`,
  ];
  return `
    <section class="pai-prep-receipt" aria-label="Today Pilot 会前准备回执">
      <div class="pai-prep-receipt-head">
        ${receiptChips
          .map((label) => `<span>${escapeHtml(label)}</span>`)
          .join('')}
      </div>
      <div class="pai-prep-receipt-body">${escapeHtml(
        getMeetingPrepBoundaryText(prep, assist, visibleEvidenceCount),
      )}</div>
      <div class="pai-prep-receipt-handoff">
        本机会写入 Meeting Pilot handoff，只带入本场关注、cue cards 和证据背景；不会加入会议、录音、发消息、审批或写回日历/外部系统。
      </div>
      <div class="pai-prep-receipt-next">会中核对 owner / 下一步 / 风险</div>
    </section>
  `;
}

function buildPendingRefreshReceipt(
  event: CalendarEventSyncItem | null,
  syncLabel: string,
): MeetingPrepRefreshReceipt {
  return {
    status: 'pending',
    title: '刷新会前准备中',
    body: `${event?.title || '当前会议'} 正在重新读取本机会议列表，并请求 Today Pilot 为当天会议补齐预生成准备。`,
    chips: ['刷新中', syncLabel || '日历同步待确认'],
    boundary:
      '这一步只读取本机会议和 Personal AI 会前准备缓存，不会加入会议、录音、发消息或写回日历/外部系统。',
  };
}

function buildRefreshReceipt(input: {
  event: CalendarEventSyncItem | null;
  prepareResult?: TodayPilotMeetingPrepPrepareResponse | null;
  prepareError?: string;
  resolve?: TodayPilotMeetingPrepResolveResponse | null;
  resolveError?: string;
  syncLabel: string;
}): MeetingPrepRefreshReceipt {
  const { prepareResult, prepareError, resolve, resolveError } = input;
  const hasPrep = Boolean(resolve?.assist && resolve.prep);
  const status: MeetingPrepRefreshReceipt['status'] = resolveError
    ? 'failed'
    : prepareError
      ? hasPrep
        ? 'warning'
        : 'failed'
      : resolve?.source === 'none'
        ? 'warning'
        : 'success';
  const title =
    status === 'success'
      ? '刷新会前准备完成'
      : status === 'warning'
        ? '刷新会前准备部分完成'
        : '刷新会前准备未完成';
  const resolveLabel = getMeetingPrepResolveLabel(resolve, resolveError);
  const prepareLabel = prepareResult
    ? `backfill 准备 ${prepareResult.prepared} / 跳过 ${prepareResult.skipped} / 失败 ${prepareResult.failed}`
    : prepareError
      ? 'backfill 请求失败'
      : 'backfill 结果未返回';
  const warningText =
    prepareError ||
    resolveError ||
    prepareResult?.warnings?.find(Boolean) ||
    resolve?.warnings?.find(Boolean) ||
    '';
  const body = [
    `${input.event?.title || '当前会议'}：${prepareLabel}；${resolveLabel}。`,
    warningText ? `提示：${warningText}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const chips = [
    input.syncLabel || '日历同步待确认',
    prepareResult
      ? `准备 ${prepareResult.prepared}`
      : prepareError
        ? '准备失败'
        : '准备未确认',
    resolveLabel,
  ];
  return {
    status,
    title,
    body,
    chips,
    boundary:
      '刷新只更新本地会前准备展示和 Meeting Pilot handoff 缓存；不会加入会议、开启录音、发送消息、创建任务、审批或写回日历/外部系统。',
  };
}

function getMeetingPrepResolveLabel(
  resolve: TodayPilotMeetingPrepResolveResponse | null | undefined,
  resolveError?: string,
): string {
  if (resolveError) return 'resolve 失败';
  if (!resolve) return 'resolve 未返回';
  if (resolve.source === 'cached') return '读取预生成缓存';
  if (resolve.source === 'generated') return '已生成新准备';
  if (resolve.source === 'fallback') return '使用规则 fallback';
  return '暂无可用准备';
}

function renderRefreshReceipt(receipt: MeetingPrepRefreshReceipt): string {
  return `
    <section class="pai-refresh-receipt ${escapeHtmlAttribute(
      receipt.status,
    )}" aria-label="Today Pilot 刷新会前准备回执">
      <div class="pai-refresh-title">${escapeHtml(receipt.title)}</div>
      <div class="pai-refresh-chips">
        ${receipt.chips
          .map((label) => `<span>${escapeHtml(label)}</span>`)
          .join('')}
      </div>
      <div class="pai-refresh-body">${escapeHtml(receipt.body)}</div>
      <div class="pai-refresh-boundary">${escapeHtml(receipt.boundary)}</div>
    </section>
  `;
}

function getStorylineDismissKey(
  prep: TodayPilotMeetingPrepRecord,
  event: CalendarEventSyncItem,
): string {
  return [
    'today_meeting_prep',
    prep.id,
    prep.sourceHash,
    event.externalId || event.seriesKey || event.title,
  ]
    .filter(Boolean)
    .map((part) => encodeURIComponent(String(part)))
    .join('|');
}

function renderStorylineOpportunity(
  opportunity: StorylineOpportunity,
  prep: TodayPilotMeetingPrepRecord,
  event: CalendarEventSyncItem,
): string {
  const evidenceSummary = getStorylineEvidenceSummary(opportunity, prep);
  const clusters = (opportunity.evidenceClusters || [])
    .slice(0, 3)
    .map((cluster) => cluster.label)
    .join(' · ');
  const meta = [
    opportunity.audienceHint ? `受众：${opportunity.audienceHint}` : '',
    getStorylineEvidenceMetaLabel(evidenceSummary),
    opportunity.estimatedLengthMinutes
      ? `约 ${opportunity.estimatedLengthMinutes} 分钟`
      : '',
  ].filter(Boolean);
  const buttonLabel = opportunity.buttonLabel || '生成故事线草稿';
  return `
    <section class="pai-storyline" data-storyline-key="${escapeHtmlAttribute(
      getStorylineDismissKey(prep, event),
    )}">
      <div class="pai-storyline-main">
        <div class="pai-storyline-kicker">可生成 Storyline</div>
        <div class="pai-storyline-reason">${escapeHtml(
          opportunity.oneLineReason || '这场会有足够素材整理成可讲述故事线。',
        )}</div>
        ${
          clusters || meta.length
            ? `<div class="pai-storyline-meta">${escapeHtml(
                [clusters, ...meta].filter(Boolean).join(' · '),
              )}</div>`
            : ''
        }
        ${renderStorylineEntryReceipt(opportunity, prep)}
        <div class="pai-storyline-boundary">
          只打开草稿页；复核证据后手动复制，不会自动写回外部平台。
        </div>
      </div>
      <div class="pai-storyline-actions">
        <button class="pai-primary" data-action="storyline-generate" type="button">${escapeHtml(
          buttonLabel,
        )}</button>
        <button class="pai-secondary" data-action="storyline-dismiss" type="button">不需要</button>
      </div>
    </section>
  `;
}

function renderStorylineEntryReceipt(
  opportunity: StorylineOpportunity,
  prep: TodayPilotMeetingPrepRecord,
): string {
  const evidenceSummary = getStorylineEvidenceSummary(opportunity, prep);
  const evidenceChips = getStorylineEvidenceChips(evidenceSummary);
  const shareReviewSummary = getStorylineShareReviewSummary(prep);
  const chips = [
    `输出：${getStorylineArtifactLabel(opportunity.suggestedArtifact)}`,
    evidenceSummary.clusterCount ? `素材组 ${evidenceSummary.clusterCount}` : '',
    ...evidenceChips,
    opportunity.audienceHint ? `受众：${opportunity.audienceHint}` : '',
    opportunity.estimatedLengthMinutes
      ? `约 ${opportunity.estimatedLengthMinutes} 分钟`
      : '',
  ].filter(Boolean);
  const sourceKinds = getStorylineSourceKindLabels(opportunity, prep);
  const evidenceBoundary = evidenceSummary.countsDiffer
    ? '模型素材数与实际 refs 不一致；以 Draft 页 evidence refs、缺口和风险复核为准。'
    : '草稿页会重新核对 evidence refs、缺口和风险。';
  return `
    <div class="pai-storyline-receipt" aria-label="Storyline 入口回执">
      <div class="pai-storyline-receipt-title">入口回执</div>
      <div class="pai-storyline-receipt-chips">
        ${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join('')}
      </div>
      <div class="pai-storyline-receipt-body">
        ${escapeHtml(
          `素材来源：${sourceKinds || '以 Draft 页返回的 evidence refs 为准'}；点击后才调用 Draft API，${evidenceBoundary}`,
        )}
      </div>
      <div class="pai-storyline-receipt-review">
        ${escapeHtml(
          `外发复核：${formatStorylineShareReviewSummary(shareReviewSummary)}；当前只是素材入口，不是外发就绪稿。`,
        )}
      </div>
    </div>
  `;
}

function renderStorylineDismissReceipt(
  receipt: StorylineDismissReceipt,
): string {
  return `
    <section class="pai-storyline-dismiss-receipt" aria-label="Storyline 隐藏回执">
      <div class="pai-storyline-dismiss-title">Storyline 提示已隐藏</div>
      <div class="pai-storyline-dismiss-body">${escapeHtml(
        `只把「${receipt.eventTitle}」这条会前 Storyline 入口在本机隐藏到 ${formatStorylineDismissExpiry(
          receipt.expiresAt,
        )}；写入 chrome.storage.local.storylineOpportunityDismissals，不删除会前准备、证据、Draft 草稿或 Meeting Pilot handoff，也不会写回 Slides / Docs / RingCentral。`,
      )}</div>
    </section>
  `;
}

function formatStorylineDismissExpiry(expiresAtMs: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(expiresAtMs));
  } catch {
    return '约 30 天后';
  }
}

interface StorylineEvidenceSummary {
  clusterCount: number;
  clusterEvidenceCount: number;
  actualEvidenceRefCount: number;
  displayEvidenceCount: number;
  countsDiffer: boolean;
}

function getStorylineEvidenceSummary(
  opportunity: StorylineOpportunity,
  prep: TodayPilotMeetingPrepRecord,
): StorylineEvidenceSummary {
  const clusters = opportunity.evidenceClusters || [];
  const clusterEvidenceCount = clusters.reduce(
    (sum, cluster) => sum + cluster.evidenceCount,
    0,
  );
  const actualEvidenceRefCount = prep.evidenceRefs?.length || 0;
  return {
    clusterCount: clusters.length,
    clusterEvidenceCount,
    actualEvidenceRefCount,
    displayEvidenceCount: clusterEvidenceCount || actualEvidenceRefCount,
    countsDiffer:
      clusterEvidenceCount > 0 &&
      actualEvidenceRefCount > 0 &&
      clusterEvidenceCount !== actualEvidenceRefCount,
  };
}

function getStorylineEvidenceMetaLabel(
  summary: StorylineEvidenceSummary,
): string {
  if (summary.countsDiffer) {
    return `素材估计 ${summary.clusterEvidenceCount} 条 · 实际 refs ${summary.actualEvidenceRefCount} 条`;
  }
  return summary.displayEvidenceCount
    ? `${summary.displayEvidenceCount} 条素材`
    : '';
}

function getStorylineEvidenceChips(
  summary: StorylineEvidenceSummary,
): string[] {
  if (summary.countsDiffer) {
    return [
      `素材估计 ${summary.clusterEvidenceCount} 条`,
      `实际 refs ${summary.actualEvidenceRefCount} 条`,
    ];
  }
  return summary.displayEvidenceCount
    ? [`证据 ${summary.displayEvidenceCount} 条`]
    : [];
}

function getStorylineArtifactLabel(
  target: StorylineSuggestedArtifact | undefined,
): string {
  if (target === 'slides_outline') return 'Slides 提纲';
  if (target === 'ringcentral_post') return 'RingCentral 分享帖';
  if (target === 'docs_brief') return 'Docs 简报';
  return '口播稿';
}

function getStorylineSourceKindLabels(
  opportunity: StorylineOpportunity,
  prep: TodayPilotMeetingPrepRecord,
): string {
  const labelsByKind: Record<string, string> = {
    calendar: '日历',
    chunk: '记忆片段',
    document: '文档',
    glip: '消息',
    jira: 'Jira',
    meeting: '会议',
    message: '消息',
    ringcentral: '消息',
    source_memory: '资料记忆',
    source_memory_capsule: '资料记忆',
    web: '网页',
  };
  const labels = new Set<string>();
  const addLabel = (value: unknown): void => {
    const raw = String(value || '').trim();
    const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
    if (!normalized) return;
    labels.add(labelsByKind[normalized] || compactInlineLabel(raw, 18));
  };
  for (const cluster of opportunity.evidenceClusters || []) {
    for (const kind of cluster.sourceKinds || []) {
      addLabel(kind);
    }
  }
  for (const ref of prep.evidenceRefs || []) {
    addLabel(ref.sourceLabel || ref.type);
  }
  return Array.from(labels).slice(0, 5).join(' / ');
}

interface StorylineShareReviewSummary {
  privateEvidenceCount: number;
  redactionPreviewCount: number;
  riskOrOpenLoopCount: number;
}

function getStorylineShareReviewSummary(
  prep: TodayPilotMeetingPrepRecord,
): StorylineShareReviewSummary {
  return {
    privateEvidenceCount: prep.evidenceRefs?.length || 0,
    redactionPreviewCount: readRedactionList(
      prep.redaction,
      'redactionPreview',
    ).length,
    riskOrOpenLoopCount: readRedactionList(
      prep.redaction,
      'risksOrOpenLoops',
    ).length,
  };
}

function readRedactionList(
  redaction: Record<string, unknown> | undefined,
  key: string,
): string[] {
  const value = redaction?.[key];
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => compactInlineLabel(item, 120))
    .filter(Boolean);
}

function formatStorylineShareReviewSummary(
  summary: StorylineShareReviewSummary,
): string {
  const items = [`私有素材 ${summary.privateEvidenceCount} 条`];
  if (summary.redactionPreviewCount > 0) {
    items.push(`脱敏提示 ${summary.redactionPreviewCount} 条`);
  }
  if (summary.riskOrOpenLoopCount > 0) {
    items.push(`风险提醒 ${summary.riskOrOpenLoopCount} 条`);
  }
  return items.join(' / ');
}

function compactInlineLabel(value: unknown, maxLength: number): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
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
    .pai-prep-receipt {
      margin-top: 12px;
      padding: 10px 12px;
      border: 1px solid #d8e1ed;
      border-radius: 6px;
      background: #fbfdff;
    }
    .pai-prep-receipt-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      color: #334155;
      font-size: 12px;
      font-weight: 800;
    }
    .pai-prep-receipt-head span {
      padding: 2px 7px;
      border: 1px solid #cbd8e6;
      border-radius: 6px;
      background: #fff;
    }
    .pai-prep-receipt-body {
      margin-top: 6px;
      color: #64748b;
      font-size: 12px;
      line-height: 1.4;
      word-break: break-word;
    }
    .pai-prep-receipt-handoff {
      margin-top: 6px;
      color: #475569;
      font-size: 12px;
      line-height: 1.4;
      word-break: break-word;
    }
    .pai-prep-receipt-next {
      margin-top: 6px;
      color: #334155;
      font-size: 12px;
      font-weight: 800;
    }
    .pai-refresh-receipt {
      margin-top: 10px;
      padding: 10px 12px;
      border: 1px solid #d7dce5;
      border-radius: 6px;
      background: #f8fafc;
    }
    .pai-refresh-receipt.success {
      border-color: #bbf7d0;
      background: #f0fdf4;
    }
    .pai-refresh-receipt.warning {
      border-color: #fed7aa;
      background: #fff7ed;
    }
    .pai-refresh-receipt.failed {
      border-color: #fecaca;
      background: #fef2f2;
    }
    .pai-refresh-title {
      color: #1f2937;
      font-size: 12px;
      font-weight: 800;
    }
    .pai-refresh-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }
    .pai-refresh-chips span {
      padding: 2px 7px;
      border: 1px solid rgba(100, 116, 139, 0.28);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.72);
      color: #334155;
      font-size: 12px;
      font-weight: 700;
    }
    .pai-refresh-body,
    .pai-refresh-boundary {
      margin-top: 6px;
      color: #64748b;
      font-size: 12px;
      line-height: 1.4;
      word-break: break-word;
    }
    .pai-refresh-boundary {
      color: #475569;
    }
    .pai-assist-output[hidden] {
      display: none !important;
    }
    .pai-storyline {
      margin-top: 12px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 10px 12px;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      background: #f0f7ff;
    }
    .pai-storyline-kicker {
      color: #0b66b2;
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 3px;
    }
    .pai-storyline-reason {
      color: #1e293b;
      font-weight: 700;
      word-break: break-word;
    }
    .pai-storyline-meta {
      margin-top: 4px;
      color: #64748b;
      font-size: 12px;
      word-break: break-word;
    }
    .pai-storyline-receipt {
      margin-top: 8px;
      padding: 8px;
      border: 1px solid #c7ddf5;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.72);
    }
    .pai-storyline-receipt-title {
      color: #0f4f8f;
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 5px;
    }
    .pai-storyline-receipt-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .pai-storyline-receipt-chips span {
      padding: 2px 6px;
      border: 1px solid #bfd7ef;
      border-radius: 6px;
      background: #fff;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
    }
    .pai-storyline-receipt-body {
      margin-top: 6px;
      color: #475569;
      font-size: 12px;
      line-height: 1.35;
      word-break: break-word;
    }
    .pai-storyline-receipt-review {
      margin-top: 5px;
      color: #7c2d12;
      font-size: 12px;
      line-height: 1.35;
      word-break: break-word;
    }
    .pai-storyline-boundary {
      margin-top: 5px;
      color: #475569;
      font-size: 12px;
      line-height: 1.35;
      word-break: break-word;
    }
    .pai-storyline-dismiss-receipt {
      margin-top: 12px;
      padding: 9px 10px;
      border: 1px solid #d8e3ef;
      border-radius: 6px;
      background: #f8fafc;
    }
    .pai-storyline-dismiss-title {
      color: #334155;
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 4px;
    }
    .pai-storyline-dismiss-body {
      color: #64748b;
      font-size: 12px;
      line-height: 1.4;
      word-break: break-word;
    }
    .pai-storyline-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
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
    @media (max-width: 560px) {
      .pai-storyline {
        grid-template-columns: 1fr;
      }
      .pai-storyline-actions {
        justify-content: flex-start;
      }
    }
  `;
}

let ringCentralVideoHomePrepStarted = false;
let ringCentralVideoHomeRouteWatcherAttached = false;
let ringCentralVideoHomeLastHref = location.href;
let ringCentralVideoHomePrepInstance: RingCentralVideoHomePrep | null = null;

function isRingCentralVideoHomeRoute(): boolean {
  return (
    location.hostname === 'app.ringcentral.com' &&
    location.pathname.startsWith('/video/home')
  );
}

function startRingCentralVideoHomePrepIfNeeded(): void {
  if (ringCentralVideoHomePrepStarted) {
    ringCentralVideoHomePrepInstance?.handleRouteChange();
    return;
  }

  if (!isRingCentralVideoHomeRoute()) {
    return;
  }

  ringCentralVideoHomePrepStarted = true;
  ringCentralVideoHomePrepInstance = new RingCentralVideoHomePrep();
  void ringCentralVideoHomePrepInstance.start();
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
