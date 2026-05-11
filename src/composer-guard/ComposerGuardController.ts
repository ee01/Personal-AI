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
const ENV_CONFIG_KEY = 'envConfig';
const FEEDBACK_EVENTS_KEY = 'composerGuardFeedbackEvents';
const CONFIDENCE_THRESHOLD_CONFIG_KEY = 'COMPOSER_GUARD_CONFIDENCE_THRESHOLD';
export const DEFAULT_ASSIST_CONFIDENCE_THRESHOLD = 0.78;
const MIN_ADAPTIVE_ASSIST_CONFIDENCE = 0.62;
const MAX_ADAPTIVE_ASSIST_CONFIDENCE = 0.92;
const ACCEPT_THRESHOLD_ADJUSTMENT_RATE = 0.12;
const REJECT_THRESHOLD_ADJUSTMENT_RATE = 0.16;
const MAX_FEEDBACK_EVENTS = 100;
const ICON_SIZE = 32;
const VIEWPORT_MARGIN = 8;

type GuardState = 'ready';
type AssistFeedbackKind = 'accepted' | 'rejected';

interface ActiveComposerSession {
  target: ComposerTarget;
  snapshot: SiteContextSnapshot;
  contextKey: string;
  draftText: string;
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

function sanitizeComposerInsertText(text: string): string {
  return text
    .replace(/^Personal AI context to consider before replying:\s*/i, '')
    .replace(/^Personal AI context pack \(review before sending\):\s*/i, '')
    .replace(/^Personal AI context for [^\n]+:\s*/i, '')
    .replace(/\n?\s*Please review and edit before sending\.?\s*$/i, '')
    .replace(
      /\n?\s*Please verify against the current Jira state before posting\.?\s*$/i,
      '',
    )
    .trim();
}

function looksLikeSendableComposerText(text?: string): boolean {
  const cleaned = sanitizeComposerInsertText(text || '');
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

function roundThreshold(value: number): number {
  return Number(value.toFixed(3));
}

export function normalizeComposerAssistThreshold(
  value: unknown,
  fallback = DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
): number {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) {
    return roundThreshold(
      clamp(
        Number.isFinite(fallback)
          ? fallback
          : DEFAULT_ASSIST_CONFIDENCE_THRESHOLD,
        MIN_ADAPTIVE_ASSIST_CONFIDENCE,
        MAX_ADAPTIVE_ASSIST_CONFIDENCE,
      ),
    );
  }
  return roundThreshold(
    clamp(
      candidate,
      MIN_ADAPTIVE_ASSIST_CONFIDENCE,
      MAX_ADAPTIVE_ASSIST_CONFIDENCE,
    ),
  );
}

export function getNextComposerAssistThreshold(
  currentValue: number,
  feedbackKind: AssistFeedbackKind,
): number {
  const current = normalizeComposerAssistThreshold(currentValue);
  if (feedbackKind === 'accepted') {
    const delta =
      (current - MIN_ADAPTIVE_ASSIST_CONFIDENCE) *
      ACCEPT_THRESHOLD_ADJUSTMENT_RATE;
    return normalizeComposerAssistThreshold(current - delta);
  }

  const delta =
    (MAX_ADAPTIVE_ASSIST_CONFIDENCE - current) *
    REJECT_THRESHOLD_ADJUSTMENT_RATE;
  return normalizeComposerAssistThreshold(current + delta);
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

  start(): void {
    if (hasSensitiveUrlSignal(window.location.href)) {
      return;
    }

    this.injectStyles();
    void this.loadAssistConfidenceThreshold();
    document.addEventListener('focusin', this.handleFocusIn, true);
    document.addEventListener('input', this.handleInput, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    window.addEventListener('scroll', this.schedulePositionRefresh, true);
    window.addEventListener('resize', this.schedulePositionRefresh);
    if (typeof chrome !== 'undefined' && chrome?.storage?.onChanged) {
      chrome.storage.onChanged.addListener(this.handleStorageChanged);
    }
    this.activateFromElement(document.activeElement, true);
  }

  private handleStorageChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local' || !changes[ENV_CONFIG_KEY]) return;
    const nextConfig = changes[ENV_CONFIG_KEY].newValue as
      | Record<string, unknown>
      | undefined;
    this.assistConfidenceThreshold = normalizeComposerAssistThreshold(
      nextConfig?.[CONFIDENCE_THRESHOLD_CONFIG_KEY],
      this.assistConfidenceThreshold,
    );
    this.renderIfUseful();
  };

  private handleFocusIn = (event: FocusEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    this.activateFromElement(target, false);
  };

  private handleInput = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !isComposerElement(target)) return;
    if (!this.activeSession || !this.isEventFromActiveTarget(target)) {
      this.activateFromElement(target, true);
      return;
    }
    this.refreshActiveDraft();
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
      if (fromElement && isComposerElement(fromElement)) {
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

    const contextChanged = this.activeSession?.contextKey !== contextKey;
    this.activeSession = {
      target: context.target,
      snapshot: context.snapshot,
      contextKey,
      draftText,
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

  private refreshActiveDraft(): void {
    if (!this.activeSession) return;
    this.activeSession.draftText = readComposerText(this.activeSession.target);
    this.positionRoot();
  }

  private scheduleAssistRequest = (): void => {
    if (this.requestTimer != null) {
      window.clearTimeout(this.requestTimer);
    }
    this.requestTimer = window.setTimeout(() => {
      this.requestTimer = null;
      void this.requestAssist();
    }, REQUEST_DEBOUNCE_MS);
  };

  private async requestAssist(): Promise<void> {
    if (!this.activeSession) return;

    this.refreshActiveDraft();
    const session = this.activeSession;
    const requestSeq = ++this.requestSeq;

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
        this.activeSession?.contextKey !== session.contextKey
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
    const preview = this.buildSuggestionPreview(assist);
    const iconUrl = chrome.runtime.getURL('icons/icon48.png');

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
    });

    this.positionRoot();
  }

  private buildSuggestionPreview(assist: ComposerAssistResponse): string {
    const preview = sanitizeComposerInsertText(assist.insertText || '');
    return preview.length > 520
      ? `${preview.slice(0, 520).trimEnd()}...`
      : preview;
  }

  private insertLatestAssist(): void {
    if (!this.activeSession || !this.latestAssist?.insertText) return;
    const insertText = sanitizeComposerInsertText(this.latestAssist.insertText);
    if (!insertText) return;
    void this.recordAssistFeedback('accepted');
    insertTextIntoComposer(this.activeSession.target, insertText);
    this.clear();
  }

  private async loadAssistConfidenceThreshold(): Promise<void> {
    const result = await getChromeLocal<{
      envConfig?: Record<string, unknown>;
    }>(ENV_CONFIG_KEY);
    this.assistConfidenceThreshold = normalizeComposerAssistThreshold(
      result.envConfig?.[CONFIDENCE_THRESHOLD_CONFIG_KEY],
    );
    this.renderIfUseful();
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
    const top = clamp(rect.top - 12, VIEWPORT_MARGIN, maxTop);
    const left = clamp(rect.right - 28, VIEWPORT_MARGIN, maxLeft);
    this.root.classList.toggle('pai-composer-guard--near-left', left < 360);
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
        width: 32px;
        height: 32px;
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
        width: 32px;
        height: 32px;
        margin: 0;
        border: 0;
        border-radius: 999px;
        padding: 0;
        background: transparent;
        box-shadow: 0 4px 14px rgba(209, 42, 42, 0.26);
        cursor: pointer;
        transition: transform 140ms ease, box-shadow 140ms ease;
      }
      .pai-composer-guard-icon-button:hover {
        transform: scale(1.04);
        box-shadow: 0 5px 18px rgba(209, 42, 42, 0.42);
      }
      .pai-composer-guard-icon-button img {
        width: 28px;
        height: 28px;
        display: block;
        border-radius: 999px;
      }
      .pai-composer-guard-popover {
        position: absolute;
        right: 38px;
        top: -2px;
        width: min(320px, calc(100vw - 70px));
        max-height: 260px;
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
        left: 38px;
        transform: translateX(-8px) scale(0.98);
        transform-origin: left top;
      }
      .pai-composer-guard--near-left:hover .pai-composer-guard-popover {
        transform: translateX(0) scale(1);
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
