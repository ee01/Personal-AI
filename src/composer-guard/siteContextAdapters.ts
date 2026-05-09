import { normalizeContextPageUrl } from '../web-intelligence/contextRecallGuards';
import type {
  ComposerContextItem,
  ComposerSurface,
  ComposerTarget,
  SiteContextAdapter,
  SiteContextSnapshot,
  VisibleMessageSnapshot,
} from './types';

export interface OwnerAuthoredLearningPayload {
  content: string;
  sourceType: 'jira';
  sender?: string;
  groupId?: string;
  groupName?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  timestamp?: number;
  metadata: Record<string, unknown>;
}

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
const RINGCENTRAL_COMPOSER_SELECTOR = '.ql-editor[contenteditable="true"]';
const WEB_AGENT_COMPOSER_SELECTORS: Record<string, string> = {
  chatgpt: [
    '#prompt-textarea',
    '[data-testid="composer-textarea"]',
    '[contenteditable="true"][data-testid*="prompt"]',
    'textarea[data-id="root"]',
  ].join(', '),
  claude: [
    'div[contenteditable="true"][aria-label*="prompt" i]',
    'div[contenteditable="true"][data-testid*="chat"]',
    '.ProseMirror[contenteditable="true"]',
    'textarea[aria-label*="prompt" i]',
  ].join(', '),
  gemini: [
    'rich-textarea [contenteditable="true"]',
    'div[contenteditable="true"][aria-label*="prompt" i]',
    'textarea[aria-label*="prompt" i]',
  ].join(', '),
  doubao: [
    '[data-testid="chat-input"]',
    '[contenteditable="true"][data-testid*="chat"]',
    '[contenteditable="true"][aria-label*="输入" i]',
    'textarea[placeholder*="输入" i]',
  ].join(', '),
};

function normalizeText(text?: string | null): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function normalizeIdentity(value?: string | null): string {
  return normalizeText(value)
    .replace(/^your profile and settings,?\s*/i, '')
    .replace(/^profile,?\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, ' ')
    .trim();
}

function identityCandidates(value?: string | null): string[] {
  const normalized = normalizeIdentity(value);
  if (!normalized) return [];
  const candidates = new Set<string>([normalized]);
  normalized
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .forEach((part) => candidates.add(part));
  if (normalized.includes('@')) {
    candidates.add(normalized.split('@')[0]);
  }
  return Array.from(candidates);
}

function identitiesMatch(authorValues: Array<string | undefined>, selfValues: string[]): boolean {
  const selfCandidates = new Set(selfValues.flatMap(identityCandidates));
  if (!selfCandidates.size) return false;
  return authorValues
    .flatMap(identityCandidates)
    .some((candidate) => selfCandidates.has(candidate));
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

function intersectsRect(a: DOMRect, b: DOMRect): boolean {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
}

function closestComposerElement(element?: Element | null): HTMLElement | null {
  if (!element) return null;
  const candidate = element.closest(COMPOSER_SELECTOR);
  return candidate instanceof HTMLElement ? candidate : null;
}

function getControlHint(element: HTMLElement): string {
  return normalizeText(
    [
      element.getAttribute('placeholder'),
      element.getAttribute('aria-label'),
      element.getAttribute('data-placeholder'),
      element.getAttribute('name'),
      element.getAttribute('id'),
      element.getAttribute('class'),
      element.getAttribute('role'),
    ]
      .filter(Boolean)
      .join(' '),
  ).toLowerCase();
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function isSearchLikeControl(element: HTMLElement): boolean {
  const tag = element.tagName.toLowerCase();
  const type = (element as HTMLInputElement).type || element.getAttribute('type') || '';
  const hint = getControlHint(element);
  const hasSearchHint =
    /\b(search|filter|query|find|quick search|jump to)\b/.test(hint) ||
    includesAny(hint, ['搜索', '筛选']);
  const hasComposerHint =
    /\b(comment|reply|message|prompt|chat)\b/.test(hint) ||
    includesAny(hint, ['评论', '回复', '消息', '输入']);
  return (
    type.toLowerCase() === 'search' ||
    element.getAttribute('role') === 'searchbox' ||
    hasSearchHint ||
    (tag === 'input' && !hasComposerHint)
  );
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
  const match = location.pathname.match(/^\/(?:l\/)?messages\/([^/?#]+)/);
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

function uniqueByDataId(elements: HTMLElement[]): HTMLElement[] {
  const seen = new Set<string>();
  const unique: HTMLElement[] = [];
  for (const element of elements) {
    const key = element.getAttribute('data-id') || element.textContent || `${unique.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(element);
  }
  return unique;
}

function getVisibleCardsInContainer(cards: HTMLElement[], container?: HTMLElement | null): HTMLElement[] {
  if (!container) return cards.slice(-MAX_VISIBLE_MESSAGES);
  const containerRect = container.getBoundingClientRect();
  const visibleCards = cards.filter((card) => {
    if (!isElementVisible(card)) return false;
    const rect = card.getBoundingClientRect();
    return intersectsRect(rect, containerRect);
  });
  return visibleCards.length > 0 ? visibleCards : cards;
}

function getRingCentralReplyTree(doc: Document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(
    '[data-test-automation-id="conversation-reply-post-tree"]',
  );
}

function getVisibleRingCentralMainCards(doc: Document): HTMLElement[] {
  const stream = doc.querySelector<HTMLElement>('#message-chat-stream-wrapper');
  const root: ParentNode = stream || doc;
  const replyTree = getRingCentralReplyTree(doc);
  const cards = Array.from(
    root.querySelectorAll<HTMLElement>('.conversation-card-wrapper[data-id]'),
  ).filter((card) => !replyTree?.contains(card));

  return getVisibleCardsInContainer(uniqueByDataId(cards), stream).slice(-MAX_VISIBLE_MESSAGES);
}

function getVisibleRingCentralThreadCards(doc: Document): HTMLElement[] {
  const replyTree = getRingCentralReplyTree(doc);
  if (!replyTree) return [];
  const cards = uniqueByDataId(
    Array.from(
      replyTree.querySelectorAll<HTMLElement>(
        [
          '.conversation-card-wrapper[data-id]',
          '[data-name="reply-tree-conversation-card"][data-id]',
        ].join(', '),
      ),
    ),
  );
  return getVisibleCardsInContainer(cards, replyTree).slice(-12);
}

function getRingCentralThreadRoot(doc: Document): VisibleMessageSnapshot | undefined {
  const replyTree = getRingCentralReplyTree(doc);
  if (!replyTree) return undefined;

  const rootCard =
    replyTree.querySelector<HTMLElement>('.conversation-card-wrapper[data-id]') ||
    replyTree.querySelector<HTMLElement>('[data-name="reply-tree-conversation-card"][data-id]');
  return rootCard ? toVisibleMessage(rootCard) || undefined : undefined;
}

function getElementUrl(element: Element): string | undefined {
  if (element instanceof HTMLAnchorElement) return element.href || undefined;
  if (element instanceof HTMLImageElement) return element.currentSrc || element.src || undefined;
  return undefined;
}

function getRingCentralMediaContextItems(card: HTMLElement): ComposerContextItem[] {
  const messageId = card.getAttribute('data-id') || undefined;
  const items: ComposerContextItem[] = [];
  const mediaElements = Array.from(
    card.querySelectorAll<HTMLElement>(
      [
        'img[alt]',
        'img[title]',
        'a[href*="/attachment"]',
        'a[href*="download"]',
        '[aria-label*="attachment" i]',
        '[title*="attachment" i]',
      ].join(', '),
    ),
  ).slice(0, 4);

  for (const element of mediaElements) {
    const isImage = element instanceof HTMLImageElement;
    const url = getElementUrl(element);
    if (url?.startsWith('data:')) continue;
    const label = clip(
      element.getAttribute('alt') ||
        element.getAttribute('title') ||
        element.getAttribute('aria-label') ||
        element.textContent ||
        url ||
        '',
      160,
    );
    if (!label && !url) continue;
    items.push({
      type: isImage ? 'image' : 'attachment',
      id: messageId ? `${messageId}:media:${items.length}` : undefined,
      title: label || (isImage ? 'image' : 'attachment'),
      text: label,
      url,
    });
  }

  return items;
}

function toMessageContextItem(
  message: VisibleMessageSnapshot,
  type: ComposerContextItem['type'],
): ComposerContextItem {
  return {
    type,
    id: message.id,
    sender: message.sender,
    text: message.text,
    timestampLabel: message.timestampLabel,
  };
}

function buildRingCentralContextItems(
  cards: HTMLElement[],
  mode: ComposerTarget['mode'],
): ComposerContextItem[] {
  const items: ComposerContextItem[] = [];
  const threadMode = mode === 'thread';
  cards.forEach((card, index) => {
    const message = toVisibleMessage(card);
    if (message) {
      items.push(
        toMessageContextItem(
          message,
          threadMode && index === 0 ? 'thread_root' : threadMode ? 'thread_reply' : 'message',
        ),
      );
    }
    items.push(...getRingCentralMediaContextItems(card));
  });
  if (threadMode && items.length > 18) {
    return [items[0], ...items.slice(-17)];
  }
  return items.slice(-18);
}

function formatContextItemForPrimary(item: ComposerContextItem): string {
  return clip(
    [item.sender, item.timestampLabel, item.title, item.text].filter(Boolean).join(': '),
    MAX_MESSAGE_TEXT,
  );
}

function collectPeopleFromMessages(messages: VisibleMessageSnapshot[]): string[] | undefined {
  const people = Array.from(
    new Set(messages.map((message) => normalizeText(message.sender)).filter(Boolean)),
  ).slice(0, 12);
  return people.length ? people : undefined;
}

function findRingCentralComposer(
  doc: Document,
  fromElement?: Element | null,
): ComposerTarget | null {
  const element = closestRingCentralComposerElement(fromElement);

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

function closestRingCentralComposerElement(element?: Element | null): HTMLElement | null {
  if (!element) return null;
  const candidate = element.closest(RINGCENTRAL_COMPOSER_SELECTOR);
  if (!(candidate instanceof HTMLElement)) return null;
  return isLikelyRingCentralComposer(candidate) ? candidate : null;
}

function isLikelyRingCentralComposer(element: HTMLElement): boolean {
  if (!isElementVisible(element) || isSearchLikeControl(element)) return false;
  if (!element.classList.contains('ql-editor') || !element.isContentEditable) {
    return false;
  }

  const hint = getControlHint(element);
  if (
    /\b(message|reply|comment|chat|composer)\b/.test(hint) ||
    includesAny(hint, ['消息', '回复', '评论', '输入'])
  ) {
    return true;
  }

  return Boolean(
    element.closest('[data-test-automation-id="conversation-reply-post-tree"]') ||
      element.closest('[data-test-automation-id*="compose"]') ||
      element.closest('[data-testid*="composer"]') ||
      element.closest('[data-test-id*="composer"]'),
  );
}

const ringCentralMessageAdapter: SiteContextAdapter = {
  id: 'ringcentral-message',
  match(location) {
    return (
      location.hostname === 'app.ringcentral.com' &&
      /^\/(?:l\/)?messages\/[^/?#]+/.test(location.pathname)
    );
  },
  buildSnapshot(doc, location) {
    const url = normalizeContextPageUrl(location.href);
    const conversationId = getRingCentralConversationId(location);
    const title = getRingCentralConversationTitle(doc);
    const activeComposer = findRingCentralComposer(doc, doc.activeElement);
    const threadMode = activeComposer?.mode === 'thread';
    const cards = threadMode
      ? getVisibleRingCentralThreadCards(doc)
      : getVisibleRingCentralMainCards(doc);
    const visibleMessages = cards
      .map((card) => toVisibleMessage(card))
      .filter((message): message is VisibleMessageSnapshot => message != null);
    const contextItems = buildRingCentralContextItems(cards, activeComposer?.mode || 'main');
    const primaryText = clip(
      contextItems
        .filter((item) => item.type !== 'attachment' && item.type !== 'image')
        .map(formatContextItemForPrimary)
        .join('\n'),
      MAX_PRIMARY_TEXT,
    );

    if (!url || !conversationId || !title || !primaryText) return null;

    const threadRoot =
      threadMode
        ? visibleMessages[0] || getRingCentralThreadRoot(doc)
        : undefined;
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
      scenario: threadMode ? 'thread_reply' : 'instant_message_reply',
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
      audience: {
        conversationTitle: title,
        conversationId,
        groupId,
        people: collectPeopleFromMessages(visibleMessages),
      },
      contextItems,
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

function getJiraCurrentUserIdentifiers(doc: Document): string[] {
  const identifiers = new Set<string>();
  const add = (value?: string | null) => {
    const normalized = normalizeText(value);
    if (normalized) identifiers.add(normalized);
  };

  [
    'ajs-remote-user',
    'ajs-remote-user-fullname',
    'ajs-user-id',
    'ajs-remote-user-key',
    'ajs-remote-user-email',
  ].forEach((name) => add(doc.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content));

  Array.from(
    doc.querySelectorAll<HTMLElement>(
      [
        '#header-details-user-fullname',
        '[data-testid="atlassian-navigation--profile-button"]',
        '[data-testid*="profile-button"]',
        '[aria-label*="profile" i]',
      ].join(', '),
    ),
  ).forEach((element) => {
    add(element.textContent);
    add(element.getAttribute('aria-label'));
    add(element.getAttribute('title'));
    add(element.getAttribute('data-username'));
    add(element.getAttribute('data-account-id'));
    add(element.getAttribute('data-user-key'));
  });

  return Array.from(identifiers);
}

function getJiraCommentId(root: HTMLElement, index: number): string {
  const raw =
    root.getAttribute('data-comment-id') ||
    root.getAttribute('data-id') ||
    root.id ||
    '';
  const match = raw.match(/comment[-_]?(\d+)/i) || raw.match(/(\d{3,})/);
  return match?.[1] || raw || `visible-comment-${index}`;
}

function getJiraCommentAuthorValues(root: HTMLElement): string[] {
  const author =
    root.querySelector<HTMLElement>('.user-hover, [data-testid*="user"], .author') ||
    root.querySelector<HTMLElement>('[rel][href*="ViewProfile"], [data-account-id]');
  return [
    normalizeText(author?.textContent),
    author?.getAttribute('rel') || undefined,
    author?.getAttribute('data-username') || undefined,
    author?.getAttribute('data-account-id') || undefined,
    author?.getAttribute('data-user-key') || undefined,
    root.getAttribute('data-author') || undefined,
    root.getAttribute('data-author-key') || undefined,
    root.getAttribute('data-account-id') || undefined,
  ].filter(Boolean) as string[];
}

export function markJiraSelfAuthoredComments(
  comments: ComposerContextItem[],
  currentUserIdentifiers: string[],
): ComposerContextItem[] {
  return comments.map((comment) => {
    if (comment.type !== 'jira_comment') return comment;
    const metadata = comment.metadata || {};
    const authorValues = [
      comment.sender,
      metadata.authorUsername as string | undefined,
      metadata.authorAccountId as string | undefined,
      metadata.authorUserKey as string | undefined,
    ];
    const isSelf = identitiesMatch(authorValues, currentUserIdentifiers);
    return {
      ...comment,
      metadata: {
        ...metadata,
        isSelf,
        ...(isSelf ? { authorRole: 'owner' } : {}),
      },
    };
  });
}

function getJiraVisibleComments(
  doc: Document,
  location: Location,
  issueKey: string,
): ComposerContextItem[] {
  const currentUserIdentifiers = getJiraCurrentUserIdentifiers(doc);
  const pageUrl = normalizeContextPageUrl(location.href) || location.href;
  const candidates = Array.from(
    doc.querySelectorAll<HTMLElement>(
      [
        '#issue_actions_container .action-body',
        '#issue_actions_container .activity-comment',
        '[data-testid*="comment"]',
        '[id*="comment"] .wiki-content',
      ].join(', '),
    ),
  )
    .filter(isElementVisible)
    .map((element, index) => {
      const text = clip(getContextTextContent(element), 500);
      if (!text) return null;
      const root =
        element.closest<HTMLElement>('.issue-data-block, .activity-comment, [id*="comment"]') ||
        element;
      const authorValues = getJiraCommentAuthorValues(root);
      const sender = authorValues[0] || '';
      const commentId = getJiraCommentId(root, index);
      const sourceUrl = `${pageUrl.split('#')[0]}#comment-${commentId}`;
      return {
        type: 'jira_comment' as const,
        id: commentId,
        sender: sender || undefined,
        text,
        url: sourceUrl,
        metadata: {
          issueKey,
          commentId,
          sourceUrl,
          authorUsername: authorValues[1] || sender || undefined,
          authorAccountId: authorValues[2] || undefined,
          authorUserKey: authorValues[3] || undefined,
          currentUserIdentifiers,
        },
      };
    })
    .filter((item): item is ComposerContextItem => item != null);

  const unique = new Map<string, ComposerContextItem>();
  for (const item of candidates) {
    const key = `${item.sender || ''}:${item.text || ''}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return markJiraSelfAuthoredComments(Array.from(unique.values()).slice(-8), currentUserIdentifiers);
}

function getJiraAttachmentContextItems(doc: Document): ComposerContextItem[] {
  const items: ComposerContextItem[] = [];
  const elements = Array.from(
    doc.querySelectorAll<HTMLElement>(
      [
        '#attachmentmodule img',
        '#attachmentmodule a[href]',
        'a[href*="/secure/attachment/"]',
        'a[href*="/attachment/"]',
        'img[src*="/secure/attachment/"]',
      ].join(', '),
    ),
  ).filter(isElementVisible);

  for (const element of elements.slice(0, 12)) {
    const url = getElementUrl(element);
    if (url?.startsWith('data:')) continue;
    const isImage =
      element instanceof HTMLImageElement ||
      /\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(url || '');
    const text = clip(
      element.getAttribute('alt') ||
        element.getAttribute('title') ||
        element.getAttribute('aria-label') ||
        element.textContent ||
        url ||
        '',
      180,
    );
    if (!text && !url) continue;
    items.push({
      type: isImage ? 'image' : 'attachment',
      title: text || (isImage ? 'image' : 'attachment'),
      text,
      url,
    });
  }

  const unique = new Map<string, ComposerContextItem>();
  for (const item of items) {
    const key = item.url || item.text || `${unique.size}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return Array.from(unique.values()).slice(0, 8);
}

function getJiraPeople(doc: Document): string[] | undefined {
  const people = Array.from(
    new Set(
      [
        '#assignee-val',
        '#reporter-val',
        '[data-testid*="assignee"]',
        '[data-testid*="reporter"]',
      ].flatMap((selector) =>
        Array.from(doc.querySelectorAll<HTMLElement>(selector)).map((element) =>
          normalizeText(element.textContent),
        ),
      ),
    ),
  )
    .filter(Boolean)
    .slice(0, 12);
  return people.length ? people : undefined;
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
    const comments = getJiraVisibleComments(doc, location, issueKey);
    const attachments = getJiraAttachmentContextItems(doc);
    const contextItems: ComposerContextItem[] = [
      { type: 'jira_summary', id: issueKey, text: summary },
      ...(description
        ? [{ type: 'jira_description' as const, id: `${issueKey}:description`, text: description }]
        : []),
      ...comments,
      ...attachments,
    ];

    return {
      adapterId: this.id,
      surface: 'jira_issue',
      contextType: 'jira_issue',
      scenario: 'jira_comment',
      contextKey: `jira:${issueKey}|${signature(primaryText)}`,
      title: `${issueKey}: ${summary}`,
      url,
      primaryText,
      secondaryTexts: status ? [status] : undefined,
      keywords: collectKeywords([issueKey, summary, description]),
      identifiers: { issueKey },
      audience: {
        issueKey,
        issueSummary: summary,
        people: getJiraPeople(doc),
      },
      contextItems,
      sourceTypes: ['jira', 'glip', 'meeting', 'web', 'manual', 'system'],
    };
  },
  findComposer(doc, fromElement) {
    const focused = closestJiraCommentComposerElement(fromElement);
    if (focused) return targetFromElement(focused, 'comment');
    return null;
  },
};

export function buildJiraOwnerCommentLearningPayloads(
  snapshot: SiteContextSnapshot,
): OwnerAuthoredLearningPayload[] {
  if (snapshot.contextType !== 'jira_issue') return [];
  const issueKey = snapshot.identifiers?.issueKey || snapshot.audience?.issueKey;
  if (!issueKey) return [];

  return (snapshot.contextItems || [])
    .filter(
      (item) =>
        item.type === 'jira_comment' &&
        item.text &&
        item.metadata?.authorRole === 'owner' &&
        item.metadata?.isSelf === true,
    )
    .map((item) => {
      const commentId = String(item.metadata?.commentId || item.id || '');
      const sourceUrl = String(item.metadata?.sourceUrl || item.url || snapshot.url);
      return {
        content: item.text || '',
        sourceType: 'jira' as const,
        sender: item.sender,
        groupId: issueKey,
        groupName: snapshot.title,
        sourceUrl,
        sourceTitle: snapshot.title,
        timestamp: Date.now(),
        metadata: {
          authorRole: 'owner',
          isSelf: true,
          issueKey,
          commentId,
          postId: `jira:${issueKey}:${commentId}`,
          sourceUrl,
          learningPurposes: ['owner-authored-comment', 'jira-comment-style'],
        },
      };
    });
}

function closestJiraCommentComposerElement(element?: Element | null): HTMLElement | null {
  const candidate = closestComposerElement(element);
  if (!candidate || !isLikelyJiraCommentComposer(candidate)) return null;
  return candidate;
}

function isLikelyJiraCommentComposer(element: HTMLElement): boolean {
  if (!isElementVisible(element) || isSearchLikeControl(element)) return false;
  if (element.tagName.toLowerCase() === 'input') return false;

  const hint = getControlHint(element);
  const commentAncestor = element.closest(
    [
      '[data-testid*="comment"]',
      '[aria-label*="comment" i]',
      '[id*="comment" i]',
      '[class*="comment" i]',
    ].join(', '),
  );

  return (
    /\b(comment|reply)\b/.test(hint) ||
    includesAny(hint, ['评论', '回复']) ||
    Boolean(commentAncestor)
  );
}

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
      scenario: 'web_agent_prompt',
      contextKey: `web-agent:${provider}|${location.origin}${location.pathname}|${signature(primaryText)}`,
      title,
      url,
      primaryText,
      secondaryTexts: turns,
      keywords: collectKeywords([title, ...turns]),
      provider,
      identifiers: { provider },
      audience: {
        conversationTitle: title,
        provider,
      },
      contextItems: turns.map((turn, index) => ({
        type: 'message',
        id: `turn-${index}`,
        text: turn,
      })),
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
    const provider = detectWebAgentProvider(doc.location);
    const providerSpecificSelector = provider
      ? WEB_AGENT_COMPOSER_SELECTORS[provider]
      : undefined;
    if (!providerSpecificSelector) return null;

    const focused =
      fromElement instanceof Element
        ? fromElement.closest(providerSpecificSelector)
        : null;
    if (focused instanceof HTMLElement) return targetFromElement(focused, 'prompt');
    return null;
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
