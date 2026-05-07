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
const MIN_DRAFT_CHARS_FOR_AUTO = 6;
const DISMISS_TTL_MS = 30 * 60 * 1000;

type GuardState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

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

function escapeHtmlAttribute(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });
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
    if (this.activeSession.draftText.length >= MIN_DRAFT_CHARS_FOR_AUTO) {
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
      this.render('idle');
    } else {
      this.render(this.latestAssist?.available ? 'ready' : 'idle');
    }

    this.positionRoot();
    if (requestImmediately || draftText.length >= MIN_DRAFT_CHARS_FOR_AUTO) {
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

    this.render('loading');
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
      this.render(response.available ? 'ready' : 'empty');
    } catch (error) {
      console.warn('[ComposerGuard] assist request failed:', error);
      if (requestSeq === this.requestSeq) {
        this.latestAssist = null;
        this.render('error');
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

    this.outsidePointerHandler = (event: PointerEvent) => {
      if (!this.root || this.root.contains(event.target as Node)) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target && isComposerElement(target)) return;
      this.hidePreview();
    };
    document.addEventListener('pointerdown', this.outsidePointerHandler, true);

    return root;
  }

  private render(state: GuardState): void {
    if (!this.activeSession) return;

    const root = this.ensureRoot();
    root.dataset.state = state;
    const assist = this.latestAssist;
    const evidenceCount = assist?.evidence?.length || 0;
    const title =
      assist?.title ||
      (this.activeSession.snapshot.contextType === 'web_agent_prompt'
        ? 'AI context'
        : '推荐上下文');
    const summary =
      state === 'loading'
        ? '正在查找相关记忆...'
        : state === 'empty'
          ? '暂未命中强相关记忆'
          : state === 'error'
            ? '记忆提词暂不可用'
            : assist?.summary || '基于当前输入框补充 Personal AI 记忆';
    const insertDisabled = !assist?.available || !assist.insertText;
    const previewDisabled = !assist?.available;

    root.innerHTML = `
      <div class="pai-composer-guard-shell">
        <button class="pai-composer-guard-chip" data-action="request" type="button" title="查找当前输入框相关记忆">
          <span class="pai-composer-guard-dot"></span>
          <span>${escapeHtml(title)}</span>
        </button>
        <button class="pai-composer-guard-icon" data-action="preview" type="button" ${previewDisabled ? 'disabled' : ''} title="预览将插入的上下文">
          预览
        </button>
        <button class="pai-composer-guard-icon pai-composer-guard-insert" data-action="insert" type="button" ${insertDisabled ? 'disabled' : ''} title="插入到当前输入框，不会发送">
          插入
        </button>
        <button class="pai-composer-guard-close" data-action="dismiss" type="button" title="忽略本次上下文">×</button>
      </div>
      <div class="pai-composer-guard-status">${escapeHtml(summary)}${evidenceCount ? ` · ${evidenceCount} 条来源` : ''}</div>
      ${assist?.available ? this.renderPreviewCard(assist) : ''}
    `;

    root.querySelector('[data-action="request"]')?.addEventListener('click', () => {
      void this.requestAssist();
    });
    root.querySelector('[data-action="preview"]')?.addEventListener('click', () => {
      root.classList.toggle('pai-composer-guard-preview-open');
    });
    root.querySelector('[data-action="insert"]')?.addEventListener('click', () => {
      this.insertLatestAssist();
    });
    root.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => {
      this.dismissCurrentContext();
    });

    this.positionRoot();
  }

  private renderPreviewCard(assist: ComposerAssistResponse): string {
    const insertText = assist.insertText || '';
    const preview = insertText.length > 1200 ? `${insertText.slice(0, 1200)}...` : insertText;
    const evidence = assist.evidence
      .slice(0, 3)
      .map((item, index) => {
        const source = item.sourceTitle || item.sourceLabel || item.title || `来源 ${index + 1}`;
        const sourceUrl = item.sourceUrl || item.exploreLink || '';
        const sourceHtml = sourceUrl
          ? `<a href="${escapeHtmlAttribute(sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(source)}</a>`
          : escapeHtml(source);
        return `
          <li>
            <strong>${sourceHtml}</strong>
            <span>${escapeHtml(item.snippet)}</span>
          </li>
        `;
      })
      .join('');

    return `
      <div class="pai-composer-guard-preview">
        <div class="pai-composer-guard-preview-head">
          <span>${assist.previewRequired ? '插入前请预览' : '可插入上下文'}</span>
          <span class="pai-composer-guard-risk">${escapeHtml(assist.riskLevel)}</span>
        </div>
        <pre>${escapeHtml(preview)}</pre>
        <ul>${evidence}</ul>
      </div>
    `;
  }

  private insertLatestAssist(): void {
    if (!this.activeSession || !this.latestAssist?.insertText) return;
    insertTextIntoComposer(this.activeSession.target, this.latestAssist.insertText);
    this.render('ready');
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
    this.activeSession = null;
    this.latestAssist = null;
    if (this.outsidePointerHandler) {
      document.removeEventListener('pointerdown', this.outsidePointerHandler, true);
      this.outsidePointerHandler = null;
    }
    this.root?.remove();
    this.root = null;
  }

  private hidePreview(): void {
    this.root?.classList.remove('pai-composer-guard-preview-open');
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
    const top = Math.max(12, Math.min(window.innerHeight - 72, rect.bottom + 8));
    const left = Math.max(12, Math.min(window.innerWidth - 360, rect.right - 320));
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
        width: min(340px, calc(100vw - 24px));
        color: #172033;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        line-height: 1.35;
        pointer-events: auto;
      }
      .pai-composer-guard-shell {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px;
        border: 1px solid rgba(49, 73, 108, 0.16);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 12px 32px rgba(25, 38, 58, 0.18);
      }
      .pai-composer-guard button {
        margin: 0;
        border: 0;
        border-radius: 6px;
        font: inherit;
        cursor: pointer;
        white-space: nowrap;
      }
      .pai-composer-guard button:disabled {
        cursor: default;
        opacity: 0.42;
      }
      .pai-composer-guard-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        max-width: 142px;
        padding: 6px 8px;
        background: #eef5ff;
        color: #164a7a;
        font-weight: 600;
      }
      .pai-composer-guard-chip span:last-child {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pai-composer-guard-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #2f80ed;
        flex: 0 0 auto;
      }
      .pai-composer-guard[data-state="loading"] .pai-composer-guard-dot {
        animation: paiComposerPulse 0.9s ease-in-out infinite alternate;
      }
      .pai-composer-guard-icon,
      .pai-composer-guard-close {
        padding: 6px 7px;
        background: #f6f8fb;
        color: #334155;
      }
      .pai-composer-guard-insert:not(:disabled) {
        background: #172033;
        color: #fff;
      }
      .pai-composer-guard-close {
        margin-left: auto;
        width: 26px;
        font-size: 16px;
        line-height: 1;
      }
      .pai-composer-guard-status {
        margin-top: 5px;
        padding: 6px 8px;
        border-radius: 7px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 8px 22px rgba(25, 38, 58, 0.12);
        color: #526071;
      }
      .pai-composer-guard-preview {
        display: none;
        margin-top: 7px;
        padding: 10px;
        max-height: 330px;
        overflow: auto;
        border: 1px solid rgba(49, 73, 108, 0.16);
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 18px 44px rgba(25, 38, 58, 0.2);
      }
      .pai-composer-guard-preview-open .pai-composer-guard-preview {
        display: block;
      }
      .pai-composer-guard-preview-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
        font-weight: 700;
      }
      .pai-composer-guard-risk {
        padding: 2px 6px;
        border-radius: 999px;
        background: #f1f5f9;
        color: #475569;
        font-size: 11px;
        text-transform: uppercase;
      }
      .pai-composer-guard-preview pre {
        margin: 0;
        padding: 8px;
        max-height: 150px;
        overflow: auto;
        border-radius: 6px;
        background: #f8fafc;
        color: #1f2937;
        white-space: pre-wrap;
        font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      .pai-composer-guard-preview ul {
        margin: 9px 0 0;
        padding: 0;
        list-style: none;
      }
      .pai-composer-guard-preview li {
        display: grid;
        gap: 2px;
        padding: 7px 0;
        border-top: 1px solid #eef2f7;
      }
      .pai-composer-guard-preview li strong,
      .pai-composer-guard-preview li a {
        color: #1d4f82;
        text-decoration: none;
      }
      .pai-composer-guard-preview li span {
        color: #526071;
      }
      @keyframes paiComposerPulse {
        from { opacity: 0.35; transform: scale(0.85); }
        to { opacity: 1; transform: scale(1.12); }
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
