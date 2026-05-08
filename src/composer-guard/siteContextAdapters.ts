import { normalizeContextPageUrl } from '../web-intelligence/contextRecallGuards';
import type {
  ComposerSurface,
  ComposerTarget,
  SiteContextAdapter,
  SiteContextSnapshot,
  VisibleMessageSnapshot,
} from './types';

const MAX_VISIBLE_MESSAGES = 8;
const MAX_MESSAGE_TEXT = 280;
const MAX_PRIMARY_TEXT = 1800;
const MAX_GENERIC_TEXT = 600;
const COMPOSER_SELECTOR = [
  'textarea',
  'input[type="text"]',
  'input:not([type])',
  '[contenteditable="true"]',
  '[role="textbox"]',
  '.ql-editor',
  '.ProseMirror',
  '#prompt-textarea',
  '[data-testid="chat-input"]',
].join(', ');

function normalizeText(text?: string | null): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function clip(text: string, maxLength: number): string {
  const normalized = normalizeText(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function signature(text: string): string {
  const compact = normalizeText(text).slice(-500);
  let hash = 0;
  for (let index = 0; index < compact.length; index += 1) {
    hash = ((hash << 5) - hash + compact.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function collectKeywords(parts: string[]): string[] | undefined {
  const keywords = new Set<string>();

  for (const part of parts) {
    const text = normalizeText(part);
    if (!text) continue;

    const jiraKeys = text.match(/\b[A-Z][A-Z0-9]{1,9}-\d+\b/g) || [];
    jiraKeys.forEach((key) => keywords.add(key));

    const mentions = text.match(/@[a-zA-Z0-9._-]+/g) || [];
    mentions.forEach((mention) => keywords.add(mention));
  }

  const list = Array.from(keywords).slice(0, 10);
  return list.length > 0 ? list : undefined;
}

function isElementVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none'
  );
}

function closestComposerElement(element?: Element | null): HTMLElement | null {
  if (!element) return null;
  const candidate = element.closest(COMPOSER_SELECTOR);
  return candidate instanceof HTMLElement ? candidate : null;
}

function targetFromElement(
  element: HTMLElement,
  mode: ComposerTarget['mode'],
): ComposerTarget | null {
  const tag = element.tagName.toLowerCase();
  const placeholder =
    element.getAttribute('placeholder') ||
    element.getAttribute('aria-label') ||
    element.getAttribute('data-placeholder') ||
    undefined;

  if (tag === 'textarea') {
    return { element, kind: 'textarea', placeholder, mode };
  }

  if (tag === 'input') {
    return { element, kind: 'input', placeholder, mode };
  }

  if (
    element.isContentEditable ||
    element.getAttribute('role') === 'textbox' ||
    element.classList.contains('ql-editor') ||
    element.classList.contains('ProseMirror') ||
    element.id === 'prompt-textarea'
  ) {
    return { element, kind: 'contenteditable', placeholder, mode };
  }

  return null;
}

function firstVisibleComposer(
  doc: Document,
  mode: ComposerTarget['mode'],
  selector = COMPOSER_SELECTOR,
): ComposerTarget | null {
  const candidates = Array.from(doc.querySelectorAll<HTMLElement>(selector));
  for (const candidate of candidates) {
    if (!isElementVisible(candidate)) continue;
    const target = targetFromElement(candidate, mode);
    if (target) return target;
  }
  return null;
}

function getContextTextContent(root?: Element | null): string {
  if (!root) return '';
  const clone = root.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      [
        'script',
        'style',
        'noscript',
        'nav',
        'header',
        'footer',
        'iframe',
        '.pai-context-bubble',
        '.pai-context-card',
        '.pai-context-toast',
        '.pai-composer-guard',
        '#pai-context-bubble-styles',
      ].join(', '),
    )
    .forEach((node) => node.remove());
  return normalizeText(clone.innerText || clone.textContent || '');
}

function getRingCentralConversationId(location: Location): string | null {
  const match = location.pathname.match(/^\/messages\/([^/?#]+)/);
  return match?.[1] || null;
}

function getRingCentralConversationTitle(doc: Document): string {
  const heading = doc.querySelector<HTMLElement>('main h1, main [role="heading"]');
  return normalizeText(heading?.textContent || doc.title);
}

function getMessageText(card: HTMLElement): string {
  const body =
    card.querySelector<HTMLElement>('[data-name="text"]') ||
    card.querySelector<HTMLElement>('[data-name="body"]') ||
    card.querySelector<HTMLElement>('[data-test-automation-id*="message"]');
  return clip(body?.textContent || card.textContent || '', MAX_MESSAGE_TEXT);
}

function toVisibleMessage(card: HTMLElement): VisibleMessageSnapshot | null {
  const text = getMessageText(card);
  if (!text) return null;

  return {
    id: card.getAttribute('data-id') || undefined,
    sender:
      normalizeText(card.querySelector<HTMLElement>('[data-name="name"]')?.textContent) ||
      undefined,
    text,
    timestampLabel:
      normalizeText(card.querySelector<HTMLElement>('[data-name="time"]')?.textContent) ||
      undefined,
  };
}

function getVisibleRingCentralCards(doc: Document): HTMLElement[] {
  const stream = doc.querySelector<HTMLElement>('#message-chat-stream-wrapper');
  const cards = Array.from(
    doc.querySelectorAll<HTMLElement>(
      [
        '.conversation-card-wrapper[data-id]',
        '[data-name="reply-tree-conversation-card"][data-id]',
      ].join(', '),
    ),
  );

  if (!stream) return cards.slice(-MAX_VISIBLE_MESSAGES);

  const streamRect = stream.getBoundingClientRect();
  const visibleCards = cards.filter((card) => {
    const rect = card.getBoundingClientRect();
    return rect.bottom > streamRect.top && rect.top < streamRect.bottom;
  });

  return (visibleCards.length > 0 ? visibleCards : cards).slice(-MAX_VISIBLE_MESSAGES);
}

function getRingCentralThreadRoot(doc: Document): VisibleMessageSnapshot | undefined {
  const replyTree = doc.querySelector<HTMLElement>(
    '[data-test-automation-id="conversation-reply-post-tree"]',
  );
  if (!replyTree) return undefined;

  const rootCard =
    replyTree.querySelector<HTMLElement>('.conversation-card-wrapper[data-id]') ||
    replyTree.querySelector<HTMLElement>('[data-name="reply-tree-conversation-card"][data-id]');
  return rootCard ? toVisibleMessage(rootCard) || undefined : undefined;
}

function findRingCentralComposer(
  doc: Document,
  fromElement?: Element | null,
): ComposerTarget | null {
  const focused = closestComposerElement(fromElement);
  const element =
    focused ||
    doc.querySelector<HTMLElement>('.ql-editor[contenteditable="true"]') ||
    firstVisibleComposer(doc, 'main', '.ql-editor[contenteditable="true"]')?.element;

  if (!element) return null;

  const placeholder = normalizeText(
    element.getAttribute('data-placeholder') ||
      element.getAttribute('aria-label') ||
      element.getAttribute('placeholder') ||
      '',
  ).toLowerCase();
  const inReplyTree = Boolean(
    element.closest('[data-test-automation-id="conversation-reply-post-tree"]'),
  );
  const mode = inReplyTree || placeholder.includes('reply') ? 'thread' : 'main';
  return targetFromElement(element, mode);
}

const ringCentralMessageAdapter: SiteContextAdapter = {
  id: 'ringcentral-message',
  match(location) {
    return (
      location.hostname === 'app.ringcentral.com' &&
      /^\/messages\/[^/?#]+/.test(location.pathname)
    );
  },
  buildSnapshot(doc, location) {
    const url = normalizeContextPageUrl(location.href);
    const conversationId = getRingCentralConversationId(location);
    const title = getRingCentralConversationTitle(doc);
    const cards = getVisibleRingCentralCards(doc);
    const visibleMessages = cards
      .map((card) => toVisibleMessage(card))
      .filter((message): message is VisibleMessageSnapshot => message != null);
    const primaryText = clip(
      visibleMessages
        .map((message) =>
          [message.sender, message.timestampLabel, message.text].filter(Boolean).join(': '),
        )
        .join('\n'),
      MAX_PRIMARY_TEXT,
    );

    if (!url || !conversationId || !title || !primaryText) return null;

    const activeComposer = findRingCentralComposer(doc, doc.activeElement);
    const threadRoot =
      activeComposer?.mode === 'thread' ? getRingCentralThreadRoot(doc) : undefined;
    const groupId =
      cards
        .map((card) => card.getAttribute('groupid'))
        .find((value): value is string => Boolean(value)) || conversationId;
    const messageIds = visibleMessages.map((message) => message.id).filter(Boolean);
    const surface = threadRoot ? 'ringcentral_thread' : 'ringcentral_message';
    const contextKey = [
      'ringcentral',
      conversationId,
      surface,
      title,
      threadRoot?.id || '',
      messageIds.slice(-3).join(','),
      signature(primaryText),
    ].join('|');

    return {
      adapterId: this.id,
      surface,
      contextType: 'message_thread',
      contextKey,
      title,
      url,
      primaryText,
      secondaryTexts: threadRoot ? [threadRoot.text] : undefined,
      keywords: collectKeywords([title, primaryText, threadRoot?.text || '']),
      identifiers: {
        conversationId,
        groupId,
        threadRootPostId: threadRoot?.id,
      },
      visibleMessages,
      threadRoot,
      sourceTypes: ['glip', 'meeting', 'jira', 'web', 'manual', 'system'],
    };
  },
  findComposer: findRingCentralComposer,
};

function getJiraIssueKey(location: Location, doc: Document): string | null {
  const fromPath = location.pathname.match(/\/browse\/([A-Z][A-Z0-9]{1,9}-\d+)/);
  if (fromPath?.[1]) return fromPath[1];
  const issueKey = doc.querySelector<HTMLElement>('[data-issue-key], #key-val');
  return (
    issueKey?.getAttribute('data-issue-key') ||
    normalizeText(issueKey?.textContent || '') ||
    null
  );
}

const jiraIssueAdapter: SiteContextAdapter = {
  id: 'jira-issue',
  match(location) {
    return /\/browse\/[A-Z][A-Z0-9]{1,9}-\d+/.test(location.pathname);
  },
  buildSnapshot(doc, location) {
    const url = normalizeContextPageUrl(location.href);
    const issueKey = getJiraIssueKey(location, doc);
    const summary =
      normalizeText(
        doc.querySelector<HTMLElement>('#summary-val, .issue-header-content h1')?.textContent,
      ) || doc.title;
    const description = clip(
      getContextTextContent(
        doc.querySelector<HTMLElement>(
          '#description-val, [data-testid="issue.views.field.rich-text.description"]',
        ),
      ),
      MAX_GENERIC_TEXT,
    );
    const status = normalizeText(
      doc.querySelector<HTMLElement>('#status-val, [data-testid="issue.fields.status"]')
        ?.textContent,
    );
    const primaryText = clip(
      [issueKey, summary, status, description].filter(Boolean).join('\n'),
      MAX_PRIMARY_TEXT,
    );

    if (!url || !issueKey || !primaryText) return null;

    return {
      adapterId: this.id,
      surface: 'jira_issue',
      contextType: 'jira_issue',
      contextKey: `jira:${issueKey}|${signature(primaryText)}`,
      title: `${issueKey}: ${summary}`,
      url,
      primaryText,
      secondaryTexts: status ? [status] : undefined,
      keywords: collectKeywords([issueKey, summary, description]),
      identifiers: { issueKey },
      sourceTypes: ['jira', 'glip', 'meeting', 'web', 'manual', 'system'],
    };
  },
  findComposer(doc, fromElement) {
    const focused = closestComposerElement(fromElement);
    if (focused) return targetFromElement(focused, 'comment');
    return firstVisibleComposer(doc, 'comment');
  },
};

function detectWebAgentProvider(location: Location): ComposerSurface | null {
  const host = location.hostname.toLowerCase();
  if (host === 'chat.openai.com' || host === 'chatgpt.com' || host.endsWith('.chatgpt.com')) {
    return 'chatgpt';
  }
  if (host === 'claude.ai' || host.endsWith('.claude.ai')) {
    return 'claude';
  }
  if (host === 'gemini.google.com' || host === 'bard.google.com') {
    return 'gemini';
  }
  if (host === 'www.doubao.com' || host === 'doubao.com' || host.endsWith('.doubao.com')) {
    return 'doubao';
  }
  return null;
}

function getWebAgentTurns(doc: Document): string[] {
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>(
      [
        '[data-message-author-role]',
        '[data-testid*="conversation-turn"]',
        '[data-testid*="message"]',
        'article',
      ].join(', '),
    ),
  )
    .filter(isElementVisible)
    .map((element) => clip(element.innerText || element.textContent || '', 360))
    .filter(Boolean);

  const unique: string[] = [];
  for (const candidate of candidates) {
    if (!unique.includes(candidate)) unique.push(candidate);
  }
  return unique.slice(-6);
}

const webAgentAdapter: SiteContextAdapter = {
  id: 'web-agent',
  match(location) {
    return detectWebAgentProvider(location) != null;
  },
  buildSnapshot(doc, location) {
    const provider = detectWebAgentProvider(location);
    const url = normalizeContextPageUrl(location.href);
    const title = normalizeText(doc.title) || provider || location.hostname;
    const turns = getWebAgentTurns(doc);
    const primaryText = clip([title, ...turns].join('\n'), MAX_PRIMARY_TEXT);

    if (!provider || !url || !primaryText) return null;

    return {
      adapterId: this.id,
      surface: provider,
      contextType: 'web_agent_prompt',
      contextKey: `web-agent:${provider}|${location.origin}${location.pathname}|${signature(primaryText)}`,
      title,
      url,
      primaryText,
      secondaryTexts: turns,
      keywords: collectKeywords([title, ...turns]),
      provider,
      identifiers: { provider },
      sourceTypes: [
        'ai_chat',
        'doubao',
        'glip',
        'jira',
        'meeting',
        'web',
        'manual',
        'system',
      ],
    };
  },
  findComposer(doc, fromElement) {
    const focused = closestComposerElement(fromElement);
    if (focused) return targetFromElement(focused, 'prompt');

    const providerSpecificSelector = [
      '#prompt-textarea',
      'textarea[data-id="root"]',
      'textarea',
      '.ProseMirror',
      '[contenteditable="true"][role="textbox"]',
      '[data-testid="chat-input"]',
      '[role="textbox"]',
    ].join(', ');
    return firstVisibleComposer(doc, 'prompt', providerSpecificSelector);
  },
};

const genericPageAdapter: SiteContextAdapter = {
  id: 'generic-page',
  match() {
    return true;
  },
  buildSnapshot(doc, location) {
    const url = normalizeContextPageUrl(location.href);
    const title = normalizeText(doc.title);
    const root = doc.querySelector('main, article, [role="main"]') || doc.body;
    const snippet = clip(getContextTextContent(root), MAX_GENERIC_TEXT);

    if (!url || (!title && !snippet)) return null;

    const primaryText = snippet || title;
    return {
      adapterId: this.id,
      surface: 'generic_agent',
      contextType: 'web_agent_prompt',
      contextKey: `page:${url}|${title}|${signature(primaryText)}`,
      title: title || url,
      url,
      primaryText,
      keywords: collectKeywords([title, primaryText]),
      sourceTypes: ['web', 'manual', 'system', 'meeting', 'glip', 'jira'],
    };
  },
  findComposer() {
    return null;
  },
};

export const siteContextAdapters: SiteContextAdapter[] = [
  ringCentralMessageAdapter,
  jiraIssueAdapter,
  webAgentAdapter,
];

export function findActiveComposerContext(
  doc: Document,
  location: Location,
  fromElement?: Element | null,
): { adapter: SiteContextAdapter; target: ComposerTarget; snapshot: SiteContextSnapshot } | null {
  for (const adapter of siteContextAdapters) {
    if (!adapter.match(location, doc)) continue;
    const target = adapter.findComposer(doc, fromElement);
    if (!target) continue;
    const snapshot = adapter.buildSnapshot(doc, location);
    if (!snapshot) continue;
    return { adapter, target, snapshot };
  }
  return null;
}

export function buildPassiveContextSnapshot(
  doc: Document,
  location: Location,
): SiteContextSnapshot | null {
  for (const adapter of [...siteContextAdapters, genericPageAdapter]) {
    if (!adapter.match(location, doc)) continue;
    const snapshot = adapter.buildSnapshot(doc, location);
    if (snapshot) return snapshot;
  }
  return null;
}

export function readComposerText(target: ComposerTarget): string {
  const element = target.element as HTMLTextAreaElement | HTMLInputElement;
  if (target.kind === 'textarea' || target.kind === 'input') {
    return normalizeText(element.value);
  }
  return normalizeText(target.element.innerText || target.element.textContent || '');
}

export function insertTextIntoComposer(target: ComposerTarget, text: string): void {
  const element = target.element as HTMLTextAreaElement | HTMLInputElement;
  const insertion = text.trim();
  if (!insertion) return;

  target.element.focus({ preventScroll: true });

  if (target.kind === 'textarea' || target.kind === 'input') {
    const current = element.value || '';
    const start = element.selectionStart ?? current.length;
    const end = element.selectionEnd ?? current.length;
    const prefix = current.slice(0, start);
    const suffix = current.slice(end);
    const separatorBefore = prefix && !/\n\s*$/.test(prefix) ? '\n\n' : '';
    const separatorAfter = suffix && !/^\s*\n/.test(suffix) ? '\n\n' : '';
    element.value = `${prefix}${separatorBefore}${insertion}${separatorAfter}${suffix}`;
    const nextCursor = `${prefix}${separatorBefore}${insertion}`.length;
    element.setSelectionRange(nextCursor, nextCursor);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: insertion }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  const prefix = readComposerText(target) ? '\n\n' : '';
  const insertedText = `${prefix}${insertion}`;
  const selection = document.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(target.element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const insertedWithCommand = document.queryCommandSupported?.('insertText')
    ? document.execCommand('insertText', false, insertedText)
    : false;
  if (!insertedWithCommand) {
    target.element.appendChild(document.createTextNode(insertedText));
  }
  target.element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: 'insertText',
      data: insertedText,
    }),
  );
  target.element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function isComposerElement(element: Element | null | undefined): boolean {
  return Boolean(closestComposerElement(element || null));
}
