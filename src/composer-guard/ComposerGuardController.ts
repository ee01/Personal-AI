import {
  hasSensitiveUrlSignal,
  isSensitiveControlDescriptor,
} from '../web-intelligence/contextRecallGuards';
import {
  findActiveComposerContext,
  insertTextIntoComposer,
  isComposerElement,
  readComposerText,
} from './siteContextAdapters';
import {
  DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
  getComposerAssistPreviewText,
  getNextComposerAssistThreshold,
  normalizeComposerAssistThreshold,
  sanitizeComposerAssistInsertText,
} from './assistPreviewPolicy';
import {
  CONFIDENCE_THRESHOLD_CONFIG_KEY,
  ENV_CONFIG_KEY,
  isComposerAssistEnabledFromConfig,
} from './assistConfig';
import type {
  ComposerAssistRequest,
  ComposerAssistResponse,
  ComposerTarget,
  SiteContextSnapshot,
} from './types';

const ROOT_ID = 'pai-composer-guard-root';
const STYLE_ID = 'pai-composer-guard-styles';
const REQUEST_DEBOUNCE_MS = 700;
const DISMISS_TTL_MS = 30 * 60 * 1000;
const FEEDBACK_EVENTS_KEY = 'composerGuardFeedbackEvents';
const MAX_FEEDBACK_EVENTS = 100;
const ICON_SIZE = 24;
const ICON_IMAGE_SIZE = 22;
const ICON_INSET = 6;
const POPOVER_GAP = 6;
const VIEWPORT_MARGIN = 8;
const MIN_POPOVER_HEIGHT = 140;
const DEFAULT_POPOVER_HEIGHT = 260;

type GuardState = 'ready';
type AssistFeedbackKind = 'accepted' | 'rejected';

interface ActiveComposerSession {
  target: ComposerTarget;
  snapshot: SiteContextSnapshot;
  contextKey: string;
  draftText: string;
  draftRevision: number;
}

interface ComposerGuardFeedbackEvent {
  kind: AssistFeedbackKind;
  timestamp: number;
  thresholdBefore: number;
  thresholdAfter: number;
  confidence?: number;
  suggestionType?: ComposerAssistResponse['suggestionType'];
  surface?: SiteContextSnapshot['surface'];
  scenario?: SiteContextSnapshot['scenario'];
  contextType?: SiteContextSnapshot['contextType'];
  contextKey?: string;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function looksLikeSendableComposerText(text?: string): boolean {
  const cleaned = sanitizeComposerAssistInsertText(text);
  if (!cleaned) return false;
  if (/^我理解当前是在讨论[:：]/.test(cleaned)) return false;
  if (/^我这边先补充几个相关点[:：]/.test(cleaned)) return false;
  if (/^我补充一下相关背景[:：]/.test(cleaned)) return false;
  if (/Personal AI context|Please review/i.test(cleaned)) return false;
  return true;
}

function isSensitiveEditableElement(element: HTMLElement): boolean {
  const input = element as HTMLInputElement;
  return isSensitiveControlDescriptor({
    type: input.type || element.getAttribute('type'),
    autocomplete: element.getAttribute('autocomplete'),
    name: element.getAttribute('name'),
    id: element.id,
    ariaLabel: element.getAttribute('aria-label'),
    placeholder:
      element.getAttribute('placeholder') ||
      element.getAttribute('data-placeholder'),
    inputMode: element.getAttribute('inputmode'),
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getChromeLocal<T extends Record<string, unknown>>(
  keys: string | string[],
): Promise<T> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      resolve({} as T);
      return;
    }
    chrome.storage.local.get(keys, (result) => resolve(result as T));
  });
}

function setChromeLocal(items: Record<string, unknown>): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) {
      resolve();
      return;
    }
    chrome.storage.local.set(items, () => resolve());
  });
}

function isUsableViewportRect(rect: DOMRect): boolean {
  return (
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.right) &&
    Number.isFinite(rect.bottom) &&
    Number.isFinite(rect.left) &&
    rect.width >= 4 &&
    rect.height >= 4 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

function getUsableElementRect(element: HTMLElement): DOMRect | null {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return null;
  }

  const rect = element.getBoundingClientRect();
  if (isUsableViewportRect(rect)) {
    return rect;
  }

  for (const clientRect of Array.from(element.getClientRects())) {
    const domRect = DOMRect.fromRect(clientRect);
    if (isUsableViewportRect(domRect)) {
      return domRect;
    }
  }

  return null;
}

export class ComposerGuardController {
  private root: HTMLDivElement | null = null;
  private activeSession: ActiveComposerSession | null = null;
  private latestAssist: ComposerAssistResponse | null = null;
  private requestTimer: number | null = null;
  private positionTimer: number | null = null;
  private requestSeq = 0;
  private dismissedContexts = new Map<string, number>();
  private assistConfidenceThreshold = DEFAULT_ASSIST_CONFIDENCE_THRESHOLD;
  private configLoaded = false;
  private composeAssistEnabled = false;

  start(): void {
    if (hasSensitiveUrlSignal(window.location.href)) {
      return;
    }

    document.addEventListener('focusin', this.handleFocusIn, true);
    document.addEventListener('input', this.handleInput, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    window.addEventListener('scroll', this.schedulePositionRefresh, true);
    window.addEventListener('resize', this.schedulePositionRefresh);
    if (typeof chrome !== 'undefined' && chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener(this.handleStorageChanged);
    }
    void this.loadComposerGuardConfig().then(() => {
      if (!this.composeAssistEnabled) return;
      this.injectStyles();
      this.activateFromElement(document.activeElement, true);
    });
  }

  private handleStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local' || !changes[ENV_CONFIG_KEY]) return;
    const nextConfig = changes[ENV_CONFIG_KEY].newValue as
      | Record<string, unknown>
      | undefined;
    const wasEnabled = this.composeAssistEnabled;
    this.configLoaded = true;
    this.applyComposerGuardConfig(nextConfig);
    if (!this.composeAssistEnabled) {
      this.clear();
      return;
    }
    if (!wasEnabled) {
      this.injectStyles();
      this.activateFromElement(document.activeElement, true);
      return;
    }
    this.renderIfUseful();
  };

  private handleFocusIn = (event: FocusEvent): void => {
    if (!this.canRunComposerAssist()) {
      this.clearIfConfigReadyAndDisabled();
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    this.activateFromElement(target, false);
  };

  private handleInput = (event: Event): void => {
    if (!this.canRunComposerAssist()) {
      this.clearIfConfigReadyAndDisabled();
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !isComposerElement(target)) return;
    if (!this.activeSession || !this.isEventFromActiveTarget(target)) {
      this.activateFromElement(target, true);
      return;
    }
    if (this.refreshActiveDraft()) {
      this.latestAssist = null;
      this.removeAffordance();
      this.scheduleAssistRequest();
    }
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.root) {
      this.dismissCurrentContext();
    }
  };

  private activateFromElement(
    fromElement?: Element | null,
    requestImmediately = false,
  ): void {
    if (!this.canRunComposerAssist()) {
      this.clearIfConfigReadyAndDisabled();
      return;
    }

    if (hasSensitiveUrlSignal(window.location.href)) {
      this.clear();
      return;
    }

    const context = findActiveComposerContext(
      document,
      window.location,
      fromElement,
    );
    if (!context) {
      if (fromElement && this.root?.contains(fromElement)) {
        return;
      }
      if (fromElement && isComposerElement(fromElement)) {
        this.clear();
      } else if (fromElement) {
        this.clear();
      }
      return;
    }

    if (isSensitiveEditableElement(context.target.element)) {
      this.clear();
      return;
    }

    const draftText = readComposerText(context.target);
    const contextKey = `${context.snapshot.contextKey}|${
      context.target.mode || 'composer'
    }`;
    if (this.isDismissed(contextKey)) {
      this.clear();
      return;
    }

    const previousTargetElement = this.activeSession?.target.element ?? null;
    const contextChanged = this.activeSession?.contextKey !== contextKey;
    const draftRevision = contextChanged
      ? 0
      : this.activeSession?.draftRevision ?? 0;
    if (
      previousTargetElement &&
      previousTargetElement !== context.target.element
    ) {
      previousTargetElement.classList.remove('pai-composer-guard-target-glow');
    }

    this.activeSession = {
      target: context.target,
      snapshot: context.snapshot,
      contextKey,
      draftText,
      draftRevision,
    };

    if (contextChanged) {
      this.latestAssist = null;
      this.removeAffordance();
    } else {
      this.renderIfUseful();
    }

    this.positionRoot();
    if (requestImmediately || contextChanged || !this.latestAssist) {
      this.scheduleAssistRequest();
    }
  }

  private isEventFromActiveTarget(target: Element): boolean {
    const activeTarget = this.activeSession?.target.element;
    return Boolean(
      activeTarget &&
        (activeTarget === target ||
          activeTarget.contains(target) ||
          target.contains(activeTarget)),
    );
  }

  private refreshActiveDraft(): boolean {
    if (!this.activeSession) return false;
    const nextDraftText = readComposerText(this.activeSession.target);
    const changed = nextDraftText !== this.activeSession.draftText;
    this.activeSession.draftText = nextDraftText;
    if (changed) {
      this.activeSession.draftRevision += 1;
    }
    this.positionRoot();
    return changed;
  }

  private scheduleAssistRequest = (): void => {
    if (!this.canRunComposerAssist()) return;
    if (this.requestTimer != null) {
      window.clearTimeout(this.requestTimer);
    }
    this.requestTimer = window.setTimeout(() => {
      this.requestTimer = null;
      void this.requestAssist();
    }, REQUEST_DEBOUNCE_MS);
  };

  private async requestAssist(): Promise<void> {
    if (!this.activeSession || !this.canRunComposerAssist()) return;

    this.refreshActiveDraft();
    const session = this.activeSession;
    const requestSeq = ++this.requestSeq;
    const draftRevision = session.draftRevision;

    const payload = this.buildAssistRequest(session);

    try {
      const response = await new Promise<ComposerAssistResponse>(
        (resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: 'COMPOSER_ASSIST_REQUEST',
              request: payload,
            },
            (rawResponse) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
              }
              if (rawResponse?.success === false) {
                reject(
                  new Error(rawResponse.error || 'composer_assist_failed'),
                );
                return;
              }
              resolve(rawResponse?.result || rawResponse);
            },
          );
        },
      );

      if (
        requestSeq !== this.requestSeq ||
        this.activeSession?.contextKey !== session.contextKey ||
        this.activeSession?.draftRevision !== draftRevision
      ) {
        return;
      }

      this.latestAssist = response;
      this.renderIfUseful();
    } catch (error) {
      console.warn('[ComposerGuard] assist request failed:', error);
      if (requestSeq === this.requestSeq) {
        this.latestAssist = null;
        this.removeAffordance();
      }
    }
  }

  private buildAssistRequest(
    session: ActiveComposerSession,
  ): ComposerAssistRequest {
    const snapshot = session.snapshot;
    return {
      surface: snapshot.surface,
      contextType: snapshot.contextType,
      scenario: snapshot.scenario,
      title: snapshot.title,
      url: snapshot.url,
      draftText: session.draftText,
      primaryText: snapshot.primaryText,
      secondaryTexts: snapshot.secondaryTexts,
      keywords: snapshot.keywords,
      identifiers: snapshot.identifiers,
      visibleMessages: snapshot.visibleMessages,
      threadRoot: snapshot.threadRoot,
      audience: snapshot.audience,
      contextItems: snapshot.contextItems,
      sourceTypes: snapshot.sourceTypes,
      automationLevel: 'L1',
    };
  }

  private ensureRoot(): HTMLDivElement {
    if (this.root) return this.root;

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'pai-composer-guard';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Personal AI composer guard');
    document.documentElement.appendChild(root);
    this.root = root;

    return root;
  }

  private hasUsefulAssist(): boolean {
    return Boolean(
      this.canRunComposerAssist() &&
        this.latestAssist?.available &&
        this.latestAssist.insertText &&
        looksLikeSendableComposerText(this.latestAssist.insertText) &&
        this.latestAssist.confidence >= this.assistConfidenceThreshold,
    );
  }

  private renderIfUseful(): void {
    if (!this.hasUsefulAssist()) {
      this.removeAffordance();
      return;
    }

    this.setTargetGlow(true);
    this.render('ready');
  }

  private render(state: GuardState): void {
    if (!this.activeSession || !this.latestAssist) return;

    const root = this.ensureRoot();
    root.dataset.state = state;
    const assist = this.latestAssist;
    const iconUrl = chrome.runtime.getURL('icons/icon48.png');
    const preview = this.buildSuggestionPreview(assist);

    root.innerHTML = `
      <button class="pai-composer-guard-icon-button" data-action="insert" type="button" title="插入建议内容">
        <img src="${iconUrl}" alt="Personal AI" />
      </button>
      <div class="pai-composer-guard-popover" aria-hidden="true">
        <div class="pai-composer-guard-header">
          <div class="pai-composer-guard-label">建议内容</div>
          <button class="pai-composer-guard-feedback-button" data-action="reject" type="button" title="减少这类建议" aria-label="减少这类建议">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 15.5v3.1c0 .8.7 1.4 1.5 1.4.5 0 .9-.2 1.2-.6l4.2-5.4c.4-.5.6-1.1.6-1.8V5.6c0-1-.8-1.8-1.8-1.8H7.1c-.7 0-1.4.4-1.7 1L2.7 11c-.5 1.2.4 2.5 1.7 2.5H10Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
              <path d="M19 4v10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="pai-composer-guard-text">${escapeHtml(preview)}</div>
      </div>
    `;

    const insertButton = root.querySelector('[data-action="insert"]');
    insertButton?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.insertLatestAssist();
    });
    insertButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if ((event as MouseEvent).detail === 0) {
        this.insertLatestAssist();
      }
    });
    const rejectButton = root.querySelector('[data-action="reject"]');
    rejectButton?.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.recordAssistFeedback('rejected');
      this.dismissCurrentContext();
    });
    rejectButton?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if ((event as MouseEvent).detail === 0) {
        void this.recordAssistFeedback('rejected');
        this.dismissCurrentContext();
      }
    });
    this.positionRoot();
  }

  private buildSuggestionPreview(assist: ComposerAssistResponse): string {
    return getComposerAssistPreviewText(assist.insertText, {
      forceFull: false,
    });
  }

  private insertLatestAssist(): void {
    if (!this.activeSession || !this.latestAssist?.insertText) return;
    const insertText = sanitizeComposerAssistInsertText(
      this.latestAssist.insertText,
    );
    if (!insertText) return;
    void this.recordAssistFeedback('accepted');
    insertTextIntoComposer(this.activeSession.target, insertText);
    this.clear();
  }

  private async loadComposerGuardConfig(): Promise<void> {
    const result = await getChromeLocal<{
      envConfig?: Record<string, unknown>;
    }>(ENV_CONFIG_KEY);
    this.configLoaded = true;
    this.applyComposerGuardConfig(result.envConfig);
  }

  private applyComposerGuardConfig(envConfig?: Record<string, unknown>): void {
    this.composeAssistEnabled = isComposerAssistEnabledFromConfig(envConfig);
    this.assistConfidenceThreshold = normalizeComposerAssistThreshold(
      envConfig?.[CONFIDENCE_THRESHOLD_CONFIG_KEY],
      this.assistConfidenceThreshold,
    );
  }

  private async recordAssistFeedback(kind: AssistFeedbackKind): Promise<void> {
    const session = this.activeSession;
    const assist = this.latestAssist;
    const result = await getChromeLocal<{
      envConfig?: Record<string, unknown>;
      composerGuardFeedbackEvents?: ComposerGuardFeedbackEvent[];
    }>([ENV_CONFIG_KEY, FEEDBACK_EVENTS_KEY]);
    const envConfig = result.envConfig || {};
    const currentThreshold = normalizeComposerAssistThreshold(
      envConfig[CONFIDENCE_THRESHOLD_CONFIG_KEY],
      this.assistConfidenceThreshold,
    );
    const nextThreshold = getNextComposerAssistThreshold(
      currentThreshold,
      kind,
    );
    this.assistConfidenceThreshold = nextThreshold;

    const event: ComposerGuardFeedbackEvent = {
      kind,
      timestamp: Date.now(),
      thresholdBefore: currentThreshold,
      thresholdAfter: nextThreshold,
      confidence: assist?.confidence,
      suggestionType: assist?.suggestionType,
      surface: session?.snapshot.surface,
      scenario: session?.snapshot.scenario,
      contextType: session?.snapshot.contextType,
      contextKey: session?.contextKey,
    };
    const events = Array.isArray(result.composerGuardFeedbackEvents)
      ? result.composerGuardFeedbackEvents
      : [];

    await setChromeLocal({
      [ENV_CONFIG_KEY]: {
        ...envConfig,
        [CONFIDENCE_THRESHOLD_CONFIG_KEY]: nextThreshold,
      },
      [FEEDBACK_EVENTS_KEY]: [...events, event].slice(-MAX_FEEDBACK_EVENTS),
    });
  }

  private canRunComposerAssist(): boolean {
    return this.configLoaded && this.composeAssistEnabled;
  }

  private clearIfConfigReadyAndDisabled(): void {
    if (this.configLoaded && !this.composeAssistEnabled) {
      this.clear();
    }
  }

  private dismissCurrentContext(): void {
    if (this.activeSession) {
      this.dismissedContexts.set(this.activeSession.contextKey, Date.now());
    }
    this.clear();
  }

  private isDismissed(contextKey: string): boolean {
    const dismissedAt = this.dismissedContexts.get(contextKey);
    if (!dismissedAt) return false;
    if (Date.now() - dismissedAt > DISMISS_TTL_MS) {
      this.dismissedContexts.delete(contextKey);
      return false;
    }
    return true;
  }

  private clear(): void {
    if (this.requestTimer != null) {
      window.clearTimeout(this.requestTimer);
      this.requestTimer = null;
    }
    this.setTargetGlow(false);
    this.activeSession = null;
    this.latestAssist = null;
    this.root?.remove();
    this.root = null;
  }

  private removeAffordance(): void {
    this.setTargetGlow(false);
    this.root?.remove();
    this.root = null;
  }

  private setTargetGlow(enabled: boolean): void {
    this.activeSession?.target.element.classList.toggle(
      'pai-composer-guard-target-glow',
      enabled,
    );
  }

  private schedulePositionRefresh = (): void => {
    if (this.positionTimer != null) return;
    this.positionTimer = window.setTimeout(() => {
      this.positionTimer = null;
      this.positionRoot();
    }, 80);
  };

  private positionRoot(): void {
    if (!this.root || !this.activeSession) return;
    const rect = this.getTargetAnchorRect();
    if (!rect) {
      this.removeAffordance();
      return;
    }

    const maxTop = Math.max(
      VIEWPORT_MARGIN,
      window.innerHeight - ICON_SIZE - VIEWPORT_MARGIN,
    );
    const maxLeft = Math.max(
      VIEWPORT_MARGIN,
      window.innerWidth - ICON_SIZE - VIEWPORT_MARGIN,
    );
    const topInsideTarget =
      rect.height >= ICON_SIZE + ICON_INSET * 2
        ? rect.top + ICON_INSET
        : rect.top + Math.max(0, (rect.height - ICON_SIZE) / 2);
    const leftInsideTarget =
      rect.width >= ICON_SIZE + ICON_INSET * 2
        ? rect.right - ICON_SIZE - ICON_INSET
        : rect.right - ICON_SIZE;
    const top = clamp(topInsideTarget, VIEWPORT_MARGIN, maxTop);
    const left = clamp(leftInsideTarget, VIEWPORT_MARGIN, maxLeft);
    const availableBelow = window.innerHeight - top - VIEWPORT_MARGIN;
    const availableAbove = top + ICON_SIZE - VIEWPORT_MARGIN;
    const opensAbove =
      availableBelow < DEFAULT_POPOVER_HEIGHT &&
      availableAbove > availableBelow;
    const availablePopoverHeight = clamp(
      opensAbove ? availableAbove : availableBelow,
      MIN_POPOVER_HEIGHT,
      DEFAULT_POPOVER_HEIGHT,
    );

    this.root.classList.toggle('pai-composer-guard--near-left', left < 360);
    this.root.classList.toggle('pai-composer-guard--above', opensAbove);
    this.root.style.setProperty(
      '--pai-composer-popover-max-height',
      `${Math.floor(availablePopoverHeight)}px`,
    );
    this.root.style.top = `${top}px`;
    this.root.style.left = `${left}px`;
  }

  private getTargetAnchorRect(): DOMRect | null {
    const targetElement = this.activeSession?.target.element;
    if (!targetElement) return null;

    const candidates: HTMLElement[] = [targetElement];
    const anchorSelectors = [
      '.ql-container',
      '.ProseMirror',
      '[role="textbox"]',
      '[contenteditable="true"]',
      '[data-test-automation-id*="compose"]',
      '[data-testid*="composer"]',
      '[data-testid*="chat-input"]',
      'form',
      'footer',
    ];

    for (const selector of anchorSelectors) {
      const closest = targetElement.closest(selector);
      if (closest instanceof HTMLElement && !candidates.includes(closest)) {
        candidates.push(closest);
      }
    }

    let parent = targetElement.parentElement;
    for (let depth = 0; parent && depth < 5; depth += 1) {
      if (
        parent !== document.body &&
        parent !== document.documentElement &&
        !candidates.includes(parent)
      ) {
        candidates.push(parent);
      }
      parent = parent.parentElement;
    }

    for (const candidate of candidates) {
      const rect = getUsableElementRect(candidate);
      if (rect) return rect;
    }

    return null;
  }

  private injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}.pai-composer-guard {
        position: fixed;
        z-index: 2147483646;
        width: ${ICON_SIZE}px;
        height: ${ICON_SIZE}px;
        --pai-composer-popover-max-height: ${DEFAULT_POPOVER_HEIGHT}px;
        color: #172033;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        line-height: 1.35;
        pointer-events: auto;
      }
      .pai-composer-guard-icon-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${ICON_SIZE}px;
        height: ${ICON_SIZE}px;
        margin: 0;
        border: 0;
        border-radius: 999px;
        padding: 0;
        background: transparent;
        box-shadow: 0 3px 10px rgba(209, 42, 42, 0.24);
        cursor: pointer;
        transition: transform 140ms ease, box-shadow 140ms ease;
      }
      .pai-composer-guard-icon-button:hover {
        transform: scale(1.04);
        box-shadow: 0 4px 14px rgba(209, 42, 42, 0.36);
      }
      .pai-composer-guard-icon-button img {
        width: ${ICON_IMAGE_SIZE}px;
        height: ${ICON_IMAGE_SIZE}px;
        display: block;
        border-radius: 999px;
      }
      .pai-composer-guard-popover {
        position: absolute;
        right: ${ICON_SIZE + POPOVER_GAP}px;
        top: -2px;
        width: min(320px, calc(100vw - 70px));
        max-height: min(${DEFAULT_POPOVER_HEIGHT}px, var(--pai-composer-popover-max-height));
        overflow: auto;
        padding: 10px 12px;
        border: 1px solid rgba(17, 24, 39, 0.12);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 14px 34px rgba(17, 24, 39, 0.16);
        color: #1f2937;
        opacity: 0;
        transform: translateX(8px) scale(0.98);
        transform-origin: right top;
        pointer-events: none;
        transition: opacity 130ms ease, transform 130ms ease;
      }
      .pai-composer-guard:hover .pai-composer-guard-popover {
        opacity: 1;
        transform: translateX(0) scale(1);
        pointer-events: auto;
      }
      .pai-composer-guard--near-left .pai-composer-guard-popover {
        right: auto;
        left: ${ICON_SIZE + POPOVER_GAP}px;
        transform: translateX(-8px) scale(0.98);
        transform-origin: left top;
      }
      .pai-composer-guard--near-left:hover .pai-composer-guard-popover {
        transform: translateX(0) scale(1);
      }
      .pai-composer-guard--above .pai-composer-guard-popover {
        top: auto;
        bottom: -2px;
        transform-origin: right bottom;
      }
      .pai-composer-guard--near-left.pai-composer-guard--above .pai-composer-guard-popover {
        transform-origin: left bottom;
      }
      .pai-composer-guard-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }
      .pai-composer-guard-label {
        color: #c62828;
        font-weight: 700;
      }
      .pai-composer-guard-feedback-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        width: 18px;
        height: 18px;
        margin: 0;
        border: 0;
        border-radius: 4px;
        padding: 0;
        color: #9ca3af;
        background: transparent;
        cursor: pointer;
      }
      .pai-composer-guard-feedback-button:hover {
        color: #c62828;
        background: rgba(198, 40, 40, 0.08);
      }
      .pai-composer-guard-feedback-button svg {
        width: 14px;
        height: 14px;
        display: block;
      }
      .pai-composer-guard-text {
        color: #374151;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 12px;
      }
      .pai-composer-guard-target-glow {
        outline: 1px solid rgba(218, 48, 48, 0.54) !important;
        box-shadow:
          0 0 0 3px rgba(218, 48, 48, 0.16),
          0 0 22px rgba(218, 48, 48, 0.38) !important;
        transition: box-shadow 140ms ease, outline-color 140ms ease;
      }
    `;
    document.documentElement.appendChild(style);
  }
}

let controller: ComposerGuardController | null = null;

export function startComposerGuardController(): void {
  if (controller) return;
  controller = new ComposerGuardController();
  controller.start();
}
