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
const MIN_ASSIST_CONFIDENCE = 0.58;

type GuardState = 'ready';

interface ActiveComposerSession {
  target: ComposerTarget;
  snapshot: SiteContextSnapshot;
  contextKey: string;
  draftText: string;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

export class ComposerGuardController {
  private root: HTMLDivElement | null = null;
  private activeSession: ActiveComposerSession | null = null;
  private latestAssist: ComposerAssistResponse | null = null;
  private requestTimer: number | null = null;
  private positionTimer: number | null = null;
  private requestSeq = 0;
  private dismissedContexts = new Map<string, number>();
  private outsidePointerHandler: ((event: PointerEvent) => void) | null = null;

  start(): void {
    if (hasSensitiveUrlSignal(window.location.href)) {
      return;
    }

    this.injectStyles();
    document.addEventListener('focusin', this.handleFocusIn, true);
    document.addEventListener('input', this.handleInput, true);
    document.addEventListener('keydown', this.handleKeyDown, true);
    window.addEventListener('scroll', this.schedulePositionRefresh, true);
    window.addEventListener('resize', this.schedulePositionRefresh);
  }

  private handleFocusIn = (event: FocusEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    this.activateFromElement(target, false);
  };

  private handleInput = (event: Event): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!this.activeSession || !target) return;
    if (!isComposerElement(target)) return;
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

    const context = findActiveComposerContext(document, window.location, fromElement);
    if (!context) {
      return;
    }

    if (isSensitiveEditableElement(context.target.element)) {
      this.clear();
      return;
    }

    const draftText = readComposerText(context.target);
    const contextKey = `${context.snapshot.contextKey}|${context.target.mode || 'composer'}`;
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
      const response = await new Promise<ComposerAssistResponse>((resolve, reject) => {
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
              reject(new Error(rawResponse.error || 'composer_assist_failed'));
              return;
            }
            resolve(rawResponse?.result || rawResponse);
          },
        );
      });

      if (requestSeq !== this.requestSeq || this.activeSession?.contextKey !== session.contextKey) {
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

  private buildAssistRequest(session: ActiveComposerSession): ComposerAssistRequest {
    const snapshot = session.snapshot;
    return {
      surface: snapshot.surface,
      contextType: snapshot.contextType,
      title: snapshot.title,
      url: snapshot.url,
      draftText: session.draftText,
      primaryText: snapshot.primaryText,
      secondaryTexts: snapshot.secondaryTexts,
      keywords: snapshot.keywords,
      identifiers: snapshot.identifiers,
      visibleMessages: snapshot.visibleMessages,
      threadRoot: snapshot.threadRoot,
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
    root.addEventListener('mouseenter', () => this.setTargetGlow(true));
    root.addEventListener('mouseleave', () => this.setTargetGlow(false));

    this.outsidePointerHandler = (event: PointerEvent) => {
      if (!this.root || this.root.contains(event.target as Node)) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target && isComposerElement(target)) return;
      this.setTargetGlow(false);
    };
    document.addEventListener('pointerdown', this.outsidePointerHandler, true);

    return root;
  }

  private hasUsefulAssist(): boolean {
    return Boolean(
      this.latestAssist?.available &&
        this.latestAssist.insertText &&
        this.latestAssist.confidence >= MIN_ASSIST_CONFIDENCE,
    );
  }

  private renderIfUseful(): void {
    if (!this.hasUsefulAssist()) {
      this.removeAffordance();
      return;
    }

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
        <div class="pai-composer-guard-label">建议内容</div>
        <div class="pai-composer-guard-text">${escapeHtml(preview)}</div>
      </div>
    `;

    root.querySelector('[data-action="insert"]')?.addEventListener('click', () => {
      this.insertLatestAssist();
    });

    this.positionRoot();
  }

  private buildSuggestionPreview(assist: ComposerAssistResponse): string {
    const insertText = assist.insertText || '';
    const preview = insertText
      .replace(/^Personal AI context to consider before replying:\s*/i, '')
      .replace(/^Personal AI context pack \(review before sending\):\s*/i, '')
      .replace(/^Personal AI context for .*?:\s*/i, '')
      .trim();
    return preview.length > 520 ? `${preview.slice(0, 520).trimEnd()}...` : preview;
  }

  private insertLatestAssist(): void {
    if (!this.activeSession || !this.latestAssist?.insertText) return;
    insertTextIntoComposer(this.activeSession.target, this.latestAssist.insertText);
    this.clear();
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
    if (this.outsidePointerHandler) {
      document.removeEventListener('pointerdown', this.outsidePointerHandler, true);
      this.outsidePointerHandler = null;
    }
    this.root?.remove();
    this.root = null;
  }

  private removeAffordance(): void {
    this.setTargetGlow(false);
    if (this.outsidePointerHandler) {
      document.removeEventListener('pointerdown', this.outsidePointerHandler, true);
      this.outsidePointerHandler = null;
    }
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
    const rect = this.activeSession.target.element.getBoundingClientRect();
    const top = Math.max(8, Math.min(window.innerHeight - 36, rect.top - 12));
    const left = Math.max(8, Math.min(window.innerWidth - 36, rect.right - 28));
    this.root.style.top = `${top}px`;
    this.root.style.left = `${left}px`;
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
        border: 1px solid rgba(222, 61, 61, 0.28);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 14px 34px rgba(91, 24, 24, 0.18);
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
      .pai-composer-guard-label {
        color: #c62828;
        font-weight: 700;
        margin-bottom: 6px;
      }
      .pai-composer-guard-text {
        color: #374151;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 12px;
      }
      .pai-composer-guard-target-glow {
        outline: 1px solid rgba(218, 48, 48, 0.42) !important;
        box-shadow:
          0 0 0 3px rgba(218, 48, 48, 0.12),
          0 0 20px rgba(218, 48, 48, 0.3) !important;
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
