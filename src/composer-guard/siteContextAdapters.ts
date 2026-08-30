import { normalizeContextPageUrl } from '../web-intelligence/contextRecallGuards.js';
import type {
  ActiveElementSnapshot,
  ComposerContextItem,
  ComposerSurface,
  ComposerTarget,
  InteractionSceneSnapshot,
  InteractionSceneSurface,
  InteractionSceneType,
  InteractionSceneUserMode,
  SiteContextAdapter,
  SiteContextSnapshot,
  VisibleFactSnapshot,
  VisibleFieldSnapshot,
  VisibleMessageSnapshot,
} from './types.js';

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

// Keep a hard cap: 8 unbounded Glip cards can be megabytes of pasted logs.
export const MAX_VISIBLE_MESSAGES = 8;
// 4000 ≈ one long Glip technical post. Distinctive tokens (Jira keys, build
// versions, WAC/download tails) often sit after a short-paragraph 280 cut.
export const MAX_MESSAGE_TEXT = 4000;
// Joined thread summary: ~two long posts or several medium ones.
export const MAX_PRIMARY_TEXT = 8000;
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
export const WEB_AGENT_SOURCE_TYPES = [
  'ai_chat',
  'chatgpt',
  'doubao',
  'doubao_chat',
  'codex_cli',
  'claude_code_cli',
  'cursor_agent_cli',
  'glip',
  'jira',
  'meeting',
  'calendar',
  'web',
  'manual',
  'source_memory',
  'system',
  'markdown',
  'reflection',
  'reflection_thread',
  'rehearsal',
];
const WEB_AGENT_SELF_SOURCE_TYPES_BY_PROVIDER: Record<string, string[]> = {
  chatgpt: ['chatgpt'],
  doubao: ['doubao', 'doubao_chat'],
  codex_cli: ['codex_cli'],
  claude_code_cli: ['claude_code_cli'],
  cursor_agent_cli: ['cursor_agent_cli'],
};

export function getWebAgentSourceTypesForProvider(
  provider?: string | null,
): string[] {
  const currentProvider = normalizeText(provider).toLowerCase();
  const selfSourceTypes = new Set(
    WEB_AGENT_SELF_SOURCE_TYPES_BY_PROVIDER[currentProvider] ?? [],
  );
  if (!selfSourceTypes.size) return [...WEB_AGENT_SOURCE_TYPES];
  return WEB_AGENT_SOURCE_TYPES.filter(
    (sourceType) => !selfSourceTypes.has(sourceType),
  );
}

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

function identitiesMatch(
  authorValues: Array<string | undefined>,
  selfValues: string[],
): boolean {
  const selfCandidates = new Set(selfValues.flatMap(identityCandidates));
  if (!selfCandidates.size) return false;
  return authorValues
    .flatMap(identityCandidates)
    .some((candidate) => selfCandidates.has(candidate));
}

function compactIdentity(value?: string | null): string {
  return normalizeIdentity(value).replace(/[^a-z0-9]/g, '');
}

function ringCentralIdentityKeys(value?: string | null): string[] {
  const normalized = normalizeIdentity(value);
  if (!normalized) return [];
  const keys = new Set<string>([normalized]);
  const withoutGlipPrefix = normalized.replace(/^glip_person\./, '');
  if (withoutGlipPrefix) keys.add(withoutGlipPrefix);
  const compact = compactIdentity(withoutGlipPrefix || normalized);
  if (compact.length >= 5) keys.add(compact);
  if (normalized.includes('@')) {
    const local = normalized.split('@')[0];
    keys.add(local);
    const compactLocal = compactIdentity(local);
    if (compactLocal.length >= 5) keys.add(compactLocal);
  }
  return Array.from(keys);
}

function ringCentralIdentitiesMatch(
  authorValues: Array<string | undefined>,
  selfValues: string[],
): boolean {
  const selfKeys = new Set(selfValues.flatMap(ringCentralIdentityKeys));
  if (!selfKeys.size) return false;
  return authorValues
    .flatMap(ringCentralIdentityKeys)
    .some((key) => selfKeys.has(key));
}

function readJsonLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readLocalStorageValue(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

function collectIdentityValues(
  add: (value?: unknown) => void,
  value: unknown,
  depth = 0,
): void {
  if (value == null || depth > 3) return;
  if (typeof value === 'string' || typeof value === 'number') {
    add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.slice(0, 16).forEach((item) => collectIdentityValues(add, item, depth + 1));
    return;
  }
  if (typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  [
    'displayName',
    'email',
    'extensionId',
    'id',
    'accountId',
    'personId',
    'contactId',
    'glipId',
    'extension',
    'username',
    'name',
    'rcUserId',
  ].forEach((key) => collectIdentityValues(add, record[key], depth + 1));
}

const PAI_INJECTED_UI_SELECTOR = [
  '.pai-composer-guard',
  '#pai-composer-guard-root',
  '.pai-context-bubble',
  '.pai-context-card',
  '.pai-context-peek',
  '.message-reaction-toolbar',
  '.snooze-icon',
].join(', ');

export function isIgnoredComposerContextMedia(input: {
  url?: string;
  label?: string;
  element?: Element | null;
}): boolean {
  if (input.element?.closest?.(PAI_INJECTED_UI_SELECTOR)) return true;
  const url = (input.url || '').trim();
  if (
    /^(chrome-extension|chrome|moz-extension|safari-extension):/i.test(url)
  ) {
    return true;
  }
  const label = normalizeText(input.label);
  return (
    /^personal ai$/i.test(label) && /\/icons\/icon\d+\.png(\?|$)/i.test(url)
  );
}

const COMPOSER_CHROME_ONLY_RE =
  /^(improve|draft for me|send|reply|ai writer)$/i;

export function sanitizeRingCentralComposerChromeText(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized || COMPOSER_CHROME_ONLY_RE.test(normalized)) return '';
  return normalized
    .replace(/\s+(Improve|Draft for me)$/g, (suffix, _label, offset, source) => {
      const before = String(source).slice(0, offset).trim();
      if (/[.!?。！？]$/.test(before) || before.length >= 40) return '';
      return suffix;
    })
    .trim();
}

export function isRingCentralComposerCard(card: HTMLElement): boolean {
  if (card.matches?.(RINGCENTRAL_COMPOSER_SELECTOR)) return true;
  return Boolean(card.querySelector(RINGCENTRAL_COMPOSER_SELECTOR));
}

export function clipSiteContextText(text: string, maxLength: number): string {
  const normalized = normalizeText(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function clip(text: string, maxLength: number): string {
  return clipSiteContextText(text, maxLength);
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
  return (
    a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom
  );
}

function closestComposerElement(element?: Element | null): HTMLElement | null {
  if (!element) return null;
  const candidate = element.closest(COMPOSER_SELECTOR);
  return isHTMLElementLike(candidate) ? candidate : null;
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
  const type =
    (element as HTMLInputElement).type || element.getAttribute('type') || '';
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

  if (isJiraRichTextEditorFrame(element)) {
    return { element, kind: 'richiframe', placeholder, mode };
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
        '.pai-context-peek',
        '.pai-context-selection-trigger',
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
  const heading = doc.querySelector<HTMLElement>(
    'main h1, main [role="heading"]',
  );
  return normalizeText(heading?.textContent || doc.title);
}

function getRingCentralCurrentUserIdentifiers(doc: Document): string[] {
  const identifiers = new Set<string>();
  const add = (value?: unknown) => {
    const normalized = normalizeText(
      typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : '',
    );
    if (!normalized) return;
    identifiers.add(normalized);
    const withoutGlipPrefix = normalized.replace(/^GLIP_PERSON\./i, '');
    if (withoutGlipPrefix && withoutGlipPrefix !== normalized) {
      identifiers.add(withoutGlipPrefix);
    }
  };

  collectIdentityValues(add, readLocalStorageValue('ownExtension'));
  collectIdentityValues(add, readLocalStorageValue('displayName'));
  collectIdentityValues(add, readLocalStorageValue('userinfo'));
  extraComposerOwnerIdentifiers.forEach(add);

  const accountUD = window.localStorage.getItem('global.account.UD') || '';
  add(accountUD);
  const sessionData = readJsonLocalStorage<unknown>(
    'global.account.ACCOUNT_SESSION_DATA_LIST',
    [],
  );
  const sessionList = Array.isArray(sessionData)
    ? sessionData
    : Object.values((sessionData || {}) as Record<string, unknown>);
  const sessionMap =
    !Array.isArray(sessionData) && sessionData
      ? (sessionData as Record<string, unknown>)
      : {};
  const accountInfo =
    (accountUD &&
      (sessionMap[accountUD] as Record<string, unknown> | undefined)) ||
    sessionList.find((item) => {
      if (!item || typeof item !== 'object') return false;
      const record = item as Record<string, unknown>;
      const ids = [record.accountId, record.id, record.extensionId].map(
        (value) => String(value || ''),
      );
      return accountUD
        ? ids.includes(String(accountUD))
        : Boolean(record.displayName);
    });

  collectIdentityValues(add, accountInfo);

  Array.from(
    doc.querySelectorAll<HTMLElement>(
      [
        '[data-test-automation-id*="profile" i]',
        '[data-testid*="profile" i]',
        '[aria-label*="profile" i]',
        '[title*="profile" i]',
      ].join(', '),
    ),
  ).forEach((element) => {
    add(element.textContent);
    add(element.getAttribute('aria-label'));
    add(element.getAttribute('title'));
  });

  return Array.from(identifiers);
}

function getMessageText(card: HTMLElement): string {
  if (isRingCentralComposerCard(card)) return '';
  const body =
    card.querySelector<HTMLElement>('[data-name="text"]') ||
    card.querySelector<HTMLElement>('[data-name="body"]') ||
    card.querySelector<HTMLElement>('[data-test-automation-id*="message"]');
  if (body) {
    return clip(normalizeText(body.textContent || ''), MAX_MESSAGE_TEXT);
  }

  const clone = card.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(
      [
        'button',
        '[role="button"]',
        RINGCENTRAL_COMPOSER_SELECTOR,
        PAI_INJECTED_UI_SELECTOR,
      ].join(', '),
    )
    .forEach((node) => node.remove());
  return clip(
    sanitizeRingCentralComposerChromeText(clone.textContent || ''),
    MAX_MESSAGE_TEXT,
  );
}

const extraComposerOwnerIdentifiers: string[] = [];

export function addComposerOwnerIdentifiers(
  values: Array<string | undefined | null>,
): void {
  for (const value of values) {
    const normalized = normalizeText(String(value || ''));
    if (!normalized) continue;
    extraComposerOwnerIdentifiers.push(normalized);
    const local = normalized.split('@')[0];
    if (local && local !== normalized) extraComposerOwnerIdentifiers.push(local);
  }
}

export function hydrateComposerOwnerIdentifiersFromExtensionStorage(): void {
  try {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) return;
    chrome.storage.local.get(['userinfo'], (result: {
      userinfo?: { username?: string; userEmail?: string; email?: string };
    }) => {
      addComposerOwnerIdentifiers([
        result.userinfo?.username,
        result.userinfo?.userEmail,
        result.userinfo?.email,
      ]);
    });
  } catch {
    // Content scripts without storage access still rely on page localStorage.
  }
}

function pickRingCentralDisplaySender(authorValues: string[]): string | undefined {
  return (
    authorValues.find(
      (value) =>
        value &&
        !/^\d+$/.test(value) &&
        !/^GLIP_PERSON\./i.test(value),
    ) || undefined
  );
}

export function inheritAuthorValuesIfMissing(
  current: string[],
  previous: string[],
): string[] {
  return current.length ? current : previous;
}

export function inheritCollapsedGlipAuthors(
  messages: Array<{ sender?: string; authorValues: string[] }>,
): Array<{ sender?: string; authorValues: string[] }> {
  let lastAuthorValues: string[] = [];
  let lastSender: string | undefined;
  return messages.map((message) => {
    const authorValues = inheritAuthorValuesIfMissing(
      message.authorValues,
      lastAuthorValues,
    );
    if (authorValues.length) lastAuthorValues = authorValues;
    const sender =
      message.sender ||
      pickRingCentralDisplaySender(authorValues) ||
      lastSender;
    if (sender) lastSender = sender;
    return { sender, authorValues };
  });
}

function toVisibleMessage(card: HTMLElement): VisibleMessageSnapshot | null {
  const text = getMessageText(card);
  if (!text) return null;

  return {
    id: card.getAttribute('data-id') || undefined,
    sender:
      normalizeText(
        card.querySelector<HTMLElement>('[data-name="name"]')?.textContent,
      ) || undefined,
    text,
    timestampLabel:
      normalizeText(
        card.querySelector<HTMLElement>('[data-name="time"]')?.textContent,
      ) || undefined,
  };
}

function getRingCentralMessageAuthorValues(card: HTMLElement): string[] {
  const avatar = card.querySelector<HTMLElement>('[data-name="avatar"]');
  const avatarUid = avatar?.getAttribute('data-uid') || '';
  const avatarId = avatarUid.replace(/^GLIP_PERSON\./i, '');
  return [
    card.querySelector<HTMLElement>('[data-name="name"]')?.textContent ||
      undefined,
    card.getAttribute('data-sender-name') || undefined,
    card.getAttribute('data-sender-id') || undefined,
    card.getAttribute('data-creator-id') || undefined,
    avatarUid || undefined,
    avatarId || undefined,
  ]
    .filter(Boolean)
    .map((value) => normalizeText(value));
}

function uniqueByDataId(elements: HTMLElement[]): HTMLElement[] {
  const seen = new Set<string>();
  const unique: HTMLElement[] = [];
  for (const element of elements) {
    const key =
      element.getAttribute('data-id') ||
      element.textContent ||
      `${unique.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(element);
  }
  return unique;
}

function getVisibleCardsInContainer(
  cards: HTMLElement[],
  container?: HTMLElement | null,
): HTMLElement[] {
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

  return getVisibleCardsInContainer(uniqueByDataId(cards), stream)
    .filter((card) => !isRingCentralComposerCard(card))
    .slice(-MAX_VISIBLE_MESSAGES);
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
  return getVisibleCardsInContainer(cards, replyTree)
    .filter((card) => !isRingCentralComposerCard(card))
    .slice(-12);
}

function getRingCentralThreadRoot(
  doc: Document,
): VisibleMessageSnapshot | undefined {
  const replyTree = getRingCentralReplyTree(doc);
  if (!replyTree) return undefined;

  const rootCard =
    replyTree.querySelector<HTMLElement>(
      '.conversation-card-wrapper[data-id]',
    ) ||
    replyTree.querySelector<HTMLElement>(
      '[data-name="reply-tree-conversation-card"][data-id]',
    );
  return rootCard ? toVisibleMessage(rootCard) || undefined : undefined;
}

function getElementUrl(element: Element): string | undefined {
  if (element instanceof HTMLAnchorElement) return element.href || undefined;
  if (element instanceof HTMLImageElement)
    return element.currentSrc || element.src || undefined;
  return undefined;
}

function getRingCentralMediaContextItems(
  card: HTMLElement,
): ComposerContextItem[] {
  if (isRingCentralComposerCard(card)) return [];
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
    if (
      isIgnoredComposerContextMedia({
        url,
        label,
        element,
      })
    ) {
      continue;
    }
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

function buildRingCentralMessageSnapshots(
  cards: HTMLElement[],
): Array<{
  card: HTMLElement;
  message: VisibleMessageSnapshot;
  authorValues: string[];
}> {
  const drafts = cards.flatMap((card) => {
    const message = toVisibleMessage(card);
    if (!message) return [];
    return [
      {
        card,
        message,
        authorValues: getRingCentralMessageAuthorValues(card),
      },
    ];
  });
  const inherited = inheritCollapsedGlipAuthors(
    drafts.map((draft) => ({
      sender: draft.message.sender,
      authorValues: draft.authorValues,
    })),
  );
  return drafts.map((draft, index) => ({
    card: draft.card,
    message: {
      ...draft.message,
      sender: inherited[index]?.sender,
    },
    authorValues: inherited[index]?.authorValues ?? draft.authorValues,
  }));
}

function buildRingCentralContextItems(
  cards: HTMLElement[],
  mode: ComposerTarget['mode'],
  currentUserIdentifiers: string[],
): ComposerContextItem[] {
  const items: ComposerContextItem[] = [];
  const threadMode = mode === 'thread';
  const snapshots = buildRingCentralMessageSnapshots(cards);
  const snapshotByCard = new Map(
    snapshots.map((snapshot) => [snapshot.card, snapshot]),
  );
  cards.forEach((card, index) => {
    const snapshot = snapshotByCard.get(card);
    if (snapshot) {
      const isSelf = ringCentralIdentitiesMatch(
        snapshot.authorValues,
        currentUserIdentifiers,
      );
      const item = toMessageContextItem(
        snapshot.message,
        threadMode && index === 0
          ? 'thread_root'
          : threadMode
          ? 'thread_reply'
          : 'message',
      );
      items.push({
        ...item,
        metadata: {
          ...(item.metadata || {}),
          authorValues: snapshot.authorValues,
          isSelf,
          ...(isSelf ? { authorRole: 'owner' } : {}),
        },
      });
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
    [item.sender, item.timestampLabel, item.title, item.text]
      .filter(Boolean)
      .join(': '),
    MAX_MESSAGE_TEXT,
  );
}

function collectPeopleFromMessages(
  messages: VisibleMessageSnapshot[],
): string[] | undefined {
  const people = Array.from(
    new Set(
      messages.map((message) => normalizeText(message.sender)).filter(Boolean),
    ),
  ).slice(0, 12);
  return people.length ? people : undefined;
}

export function markRingCentralSelfAuthoredMessages(
  items: ComposerContextItem[],
  currentUserIdentifiers: string[],
): ComposerContextItem[] {
  return items.map((item) => {
    if (
      item.type !== 'message' &&
      item.type !== 'thread_root' &&
      item.type !== 'thread_reply'
    ) {
      return item;
    }
    const metadata = item.metadata || {};
    const authorValues = [
      item.sender,
      ...((metadata.authorValues as string[] | undefined) || []),
    ];
    const isSelf = ringCentralIdentitiesMatch(
      authorValues,
      currentUserIdentifiers,
    );
    return {
      ...item,
      metadata: {
        ...metadata,
        isSelf,
        ...(isSelf ? { authorRole: 'owner' } : {}),
      },
    };
  });
}

function collectPeopleFromRingCentralContextItems(
  items: ComposerContextItem[],
): string[] | undefined {
  const people = Array.from(
    new Set(
      items
        .filter(
          (item) =>
            item.type === 'message' ||
            item.type === 'thread_reply' ||
            item.type === 'thread_root',
        )
        .filter((item) => item.metadata?.isSelf !== true)
        .map((item) => normalizeText(item.sender))
        .filter(Boolean),
    ),
  ).slice(0, 12);
  return people.length ? people : undefined;
}

export function buildRingCentralComposerContextKey(input: {
  conversationId: string;
  surface: Extract<ComposerSurface, 'ringcentral_message' | 'ringcentral_thread'>;
  threadRootId?: string;
  mode?: ComposerTarget['mode'];
}): string {
  return [
    'ringcentral',
    input.conversationId,
    input.surface,
    input.threadRootId || '',
    input.mode || (input.surface === 'ringcentral_thread' ? 'thread' : 'main'),
  ].join('|');
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

function closestRingCentralComposerElement(
  element?: Element | null,
): HTMLElement | null {
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
    element.closest(
      '[data-test-automation-id="conversation-reply-post-tree"]',
    ) ||
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
  buildSnapshot(doc, location, target) {
    const url = normalizeContextPageUrl(location.href);
    const conversationId = getRingCentralConversationId(location);
    const title = getRingCentralConversationTitle(doc);
    const activeComposer =
      target || findRingCentralComposer(doc, doc.activeElement);
    const threadMode = activeComposer?.mode === 'thread';
    const cards = threadMode
      ? getVisibleRingCentralThreadCards(doc)
      : getVisibleRingCentralMainCards(doc);
    const currentUserIdentifiers = getRingCentralCurrentUserIdentifiers(doc);
    const visibleMessages = buildRingCentralMessageSnapshots(cards).map(
      (snapshot) => snapshot.message,
    );
    const contextItems = buildRingCentralContextItems(
      cards,
      activeComposer?.mode || 'main',
      currentUserIdentifiers,
    );
    const primaryText = clip(
      contextItems
        .filter((item) => item.type !== 'attachment' && item.type !== 'image')
        .map(formatContextItemForPrimary)
        .join('\n'),
      MAX_PRIMARY_TEXT,
    );

    if (!url || !conversationId || !title || !primaryText) return null;

    const threadRoot = threadMode
      ? visibleMessages[0] || getRingCentralThreadRoot(doc)
      : undefined;
    const groupId =
      cards
        .map((card) => card.getAttribute('groupid'))
        .find((value): value is string => Boolean(value)) || conversationId;
    const surface = threadRoot ? 'ringcentral_thread' : 'ringcentral_message';
    const contextKey = buildRingCentralComposerContextKey({
      conversationId,
      surface,
      threadRootId: threadRoot?.id,
      mode: activeComposer?.mode,
    });

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
        people:
          collectPeopleFromRingCentralContextItems(contextItems) ||
          (currentUserIdentifiers.length
            ? undefined
            : collectPeopleFromMessages(visibleMessages)),
      },
      contextItems,
      sourceTypes: [
        'glip',
        'manual',
        'source_memory',
        'markdown',
        'web',
        'jira',
        'system',
        'reflection',
        'reflection_thread',
        'rehearsal',
      ],
    };
  },
  findComposer: findRingCentralComposer,
};

function getJiraIssueKey(location: Location, doc: Document): string | null {
  const fromPath = location.pathname.match(
    /\/browse\/([A-Z][A-Z0-9]{1,9}-\d+)/,
  );
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
  ].forEach((name) =>
    add(doc.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content),
  );

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
    root.querySelector<HTMLElement>(
      '.user-hover, [data-testid*="user"], .author',
    ) ||
    root.querySelector<HTMLElement>(
      '[rel][href*="ViewProfile"], [data-account-id]',
    );
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
    .map((element, index): ComposerContextItem | null => {
      const text = clip(getContextTextContent(element), 500);
      if (!text) return null;
      const root =
        element.closest<HTMLElement>(
          '.issue-data-block, .activity-comment, [id*="comment"]',
        ) || element;
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
  return markJiraSelfAuthoredComments(
    Array.from(unique.values()).slice(-8),
    currentUserIdentifiers,
  );
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

const JIRA_ESTIMATE_FIELD_PATTERN =
  /\b(?:dev\s+estimate\s+new|dev\s+estimate|original\s+estimate|remaining\s+estimate|time\s+estimate|story\s*points?|estimate)\b|估算|预估|工时|人天|人日/i;
const JIRA_FIELD_VALUE_PATTERN =
  /(?:DEV\s+Estimate\s+New|DEV\s+Estimate|Original\s+Estimate|Remaining\s+Estimate|Time\s+Estimate|Story\s*Points?|Estimate)\s*[:：]?\s*([0-9]+(?:\.[0-9]+)?(?:\s*(?:h|hour|hours|d|day|days|sp|SP|人天|人日))?)/gi;

function getJiraVisibleFields(doc: Document): VisibleFieldSnapshot[] | undefined {
  const fields: VisibleFieldSnapshot[] = [];
  const addField = (name?: string | null, value?: string | null, rawText?: string | null) => {
    const normalizedName = normalizeText(name);
    const normalizedValue = normalizeText(value);
    if (
      !normalizedName ||
      !normalizedValue ||
      !JIRA_ESTIMATE_FIELD_PATTERN.test(normalizedName)
    ) {
      return;
    }
    fields.push({
      name: clip(normalizedName, 120),
      value: clip(normalizedValue, 120),
      rawText: clip(rawText || `${normalizedName}: ${normalizedValue}`, 240),
    });
  };

  doc
    .querySelectorAll<HTMLElement>(
      [
        '#details-module .item',
        '#peoplemodule .item',
        '.issue-data-block',
        '[data-testid*="issue.views.field"]',
        '[data-testid*="issue-field"]',
        '[data-test-id*="issue-field"]',
      ].join(', '),
    )
    .forEach((root) => {
      const label =
        normalizeText(
          root.querySelector<HTMLElement>(
            '.name, .field-label, label, [data-testid*="label"], [data-test-id*="label"]',
          )?.textContent,
        ) ||
        normalizeText(root.getAttribute('data-testid')) ||
        normalizeText(root.getAttribute('data-test-id'));
      const value =
        normalizeText(
          root.querySelector<HTMLElement>(
            '.value, [data-testid*="value"], [data-test-id*="value"], [data-testid*="readview"], [data-test-id*="readview"]',
          )?.textContent,
        ) ||
        normalizeText(root.textContent).replace(label, '').trim();
      addField(label, value, root.textContent);
    });

  const pageText = (doc.body?.innerText || doc.body?.textContent || '').replace(
    /\s+/g,
    ' ',
  );
  for (const match of pageText.matchAll(JIRA_FIELD_VALUE_PATTERN)) {
    addField(match[0].replace(match[1] || '', ''), match[1], match[0]);
  }

  const byKey = new Map<string, VisibleFieldSnapshot>();
  for (const field of fields) {
    const key = `${field.name.toLowerCase()}:${field.value.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, field);
  }
  return byKey.size ? Array.from(byKey.values()).slice(0, 12) : undefined;
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
        doc.querySelector<HTMLElement>('#summary-val, .issue-header-content h1')
          ?.textContent,
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
      doc.querySelector<HTMLElement>(
        '#status-val, [data-testid="issue.fields.status"]',
      )?.textContent,
    );
    const visibleFields = getJiraVisibleFields(doc);
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
        ? [
            {
              type: 'jira_description' as const,
              id: `${issueKey}:description`,
              text: description,
            },
          ]
        : []),
      ...comments,
      ...attachments,
    ];

    return {
      adapterId: this.id,
      surface: 'jira_issue',
      contextType: 'jira_issue',
      scenario: 'jira_comment',
      contextKey: `jira:${issueKey}|${signature(
        [
          primaryText,
          ...(visibleFields ?? []).map((field) => `${field.name}:${field.value}`),
        ].join('\n'),
      )}`,
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
      visibleFields,
      contextItems,
      sourceTypes: [
        'jira',
        'glip',
        'meeting',
        'web',
        'manual',
        'source_memory',
        'system',
        'reflection',
        'reflection_thread',
        'rehearsal',
      ],
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
  const issueKey =
    snapshot.identifiers?.issueKey || snapshot.audience?.issueKey;
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
      const sourceUrl = String(
        item.metadata?.sourceUrl || item.url || snapshot.url,
      );
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

function closestJiraCommentComposerElement(
  element?: Element | null,
): HTMLElement | null {
  if (isHTMLElementLike(element) && isJiraRichTextEditorFrame(element)) {
    return isLikelyJiraCommentComposer(element, element) ? element : null;
  }
  const candidate = closestComposerElement(element);
  if (!candidate || !isLikelyJiraCommentComposer(candidate, element)) return null;
  return candidate;
}

function isLikelyJiraCommentComposer(
  element: HTMLElement,
  fromElement?: Element | null,
): boolean {
  if (!isElementVisible(element) || isSearchLikeControl(element)) return false;
  if (element.tagName.toLowerCase() === 'input') return false;

  const hint = getControlHint(element);
  const commentSelector = [
    '[data-testid*="comment"]',
    '[data-test-id*="comment"]',
    '[aria-label*="comment" i]',
    '[id*="comment" i]',
    '[class*="comment" i]',
    '[data-testid*="issue-comment"]',
    '[data-test-id*="issue-comment"]',
    '[data-testid*="add-comment"]',
    '[data-test-id*="add-comment"]',
  ].join(', ');
  const commentAncestor = element.closest(commentSelector);
  const fromCommentAncestor = fromElement?.closest?.(commentSelector);
  const nearbyComposerContainer = element.closest(
    [
      '[data-testid*="issue.activity"]',
      '[data-testid*="issue-activity"]',
      '[data-testid*="comment-container"]',
      '[data-test-id*="comment-container"]',
      'form',
    ].join(', '),
  );

  return (
    /\b(comment|reply)\b/.test(hint) ||
    includesAny(hint, ['评论', '回复']) ||
    Boolean(commentAncestor) ||
    Boolean(fromCommentAncestor) ||
    Boolean(
      nearbyComposerContainer &&
        /comment|评论|回复|add/i.test(
          normalizeText(nearbyComposerContainer.textContent).slice(0, 500),
        ),
    )
  );
}

function isJiraRichTextEditorFrame(
  element: Element | null | undefined,
): element is HTMLIFrameElement {
  if (!isHTMLElementLike(element)) return false;
  if (element.tagName.toLowerCase() !== 'iframe') return false;
  const id = element.id || '';
  const className =
    typeof element.className === 'string' ? element.className : '';
  return (
    /^mce_\d+_ifr$/i.test(id) ||
    /tox-edit-area__iframe|mce-edit-area/i.test(className) ||
    Boolean(
      element.closest(
        [
          '#addcomment',
          '#addcomment-inner',
          '.field-group.comment-input',
          '.wiki-edit-content',
          '[id*="comment" i]',
          '[class*="comment" i]',
        ].join(', '),
      ),
    )
  );
}

function getRichTextFrameDocument(element: HTMLElement): Document | null {
  if (!isJiraRichTextEditorFrame(element)) return null;
  try {
    return element.contentDocument || element.contentWindow?.document || null;
  } catch {
    return null;
  }
}

function getRichTextFrameBody(element: HTMLElement): HTMLElement | null {
  const body = getRichTextFrameDocument(element)?.body;
  return isHTMLElementLike(body) ? body : null;
}

function detectWebAgentProvider(location: Location): ComposerSurface | null {
  const host = location.hostname.toLowerCase();
  if (
    host === 'chat.openai.com' ||
    host === 'chatgpt.com' ||
    host.endsWith('.chatgpt.com')
  ) {
    return 'chatgpt';
  }
  if (host === 'claude.ai' || host.endsWith('.claude.ai')) {
    return 'claude';
  }
  if (host === 'gemini.google.com' || host === 'bard.google.com') {
    return 'gemini';
  }
  if (
    host === 'www.doubao.com' ||
    host === 'doubao.com' ||
    host.endsWith('.doubao.com')
  ) {
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
      scenario: 'compose_to_ai',
      contextKey: `web-agent:${provider}|${location.origin}${
        location.pathname
      }|${signature(primaryText)}`,
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
      sourceTypes: getWebAgentSourceTypesForProvider(provider),
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
    if (focused instanceof HTMLElement)
      return targetFromElement(focused, 'prompt');
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
      sourceTypes: [
        'web',
        'manual',
        'source_memory',
        'system',
        'meeting',
        'glip',
        'jira',
        'reflection',
        'reflection_thread',
        'rehearsal',
      ],
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
): {
  adapter: SiteContextAdapter;
  target: ComposerTarget;
  snapshot: SiteContextSnapshot;
} | null {
  for (const adapter of siteContextAdapters) {
    if (!adapter.match(location, doc)) continue;
    const target = adapter.findComposer(doc, fromElement);
    if (!target) continue;
    const snapshot = adapter.buildSnapshot(doc, location, target);
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

export function buildInteractionSceneSnapshot(
  snapshot: SiteContextSnapshot,
  options: {
    surface?: InteractionSceneSurface;
    target?: ComposerTarget | null;
    selectedText?: string;
    nearbyText?: string;
    activeElement?: Element | null;
  } = {},
): InteractionSceneSnapshot {
  const target = options.target ?? null;
  const sceneType = inferInteractionSceneType(snapshot, {
    target,
    selectedText: options.selectedText,
  });
  const userMode = inferInteractionUserMode(sceneType, target, options.selectedText);
  const surface = options.surface ?? (target ? 'compose_assist' : 'memory_lens');
  const identifiers = snapshot.identifiers ?? {};
  const participants = snapshot.audience?.people?.slice(0, 8);
  const visibleFacts = buildVisibleFacts(snapshot);
  const nearbyMessages = buildInteractionNearbyMessages(snapshot);
  const sourceAnchorHints = [
    ...(snapshot.keywords ?? []),
    ...(options.nearbyText ? [options.nearbyText] : []),
  ].filter(Boolean).slice(0, 10);

  return compactInteractionScene({
    sceneType,
    surface,
    userMode,
    url: snapshot.url,
    title: snapshot.title,
    issueKey: identifiers.issueKey || snapshot.audience?.issueKey,
    conversationId: identifiers.conversationId || snapshot.audience?.conversationId,
    groupId: identifiers.groupId || snapshot.audience?.groupId,
    participants,
    activeElement: buildActiveElementSnapshot(
      target?.element ||
        (isHTMLElementLike(options.activeElement) ? options.activeElement : null),
      userMode,
    ),
    visibleFacts,
    draftText:
      target && surface === 'compose_assist'
        ? clip(readComposerText(target), 520)
        : undefined,
    selectedText: options.selectedText ? clip(options.selectedText, 520) : undefined,
    nearbyMessages,
    sourceAnchorHints,
    admission: buildInteractionAdmission(sceneType, userMode, {
      snapshot,
      visibleFacts,
      nearbyMessages,
      selectedText: options.selectedText,
    }),
  });
}

function inferInteractionSceneType(
  snapshot: SiteContextSnapshot,
  options: { target?: ComposerTarget | null; selectedText?: string },
): InteractionSceneType {
  if (options.selectedText) return 'selection_memory_search';
  const target = options.target ?? null;
  if (snapshot.contextType === 'jira_issue') {
    if (target?.mode === 'comment') return 'jira_comment_composing';
    return 'jira_issue_reading';
  }
  if (snapshot.contextType === 'message_thread') {
    if (target) return 'ringcentral_reply_composing';
    return isEstimateDiscussionSnapshot(snapshot)
      ? 'ringcentral_estimate_discussion'
      : 'ringcentral_thread_reading';
  }
  if (snapshot.contextType === 'web_agent_prompt') {
    return target ? 'web_ai_prompt_composing' : 'web_reading';
  }
  return 'web_reading';
}

function inferInteractionUserMode(
  sceneType: InteractionSceneType,
  target?: ComposerTarget | null,
  selectedText?: string,
): InteractionSceneUserMode {
  if (selectedText) return 'select_text';
  if (target?.mode === 'comment' || sceneType === 'jira_comment_composing') {
    return 'comment';
  }
  if (
    target?.mode === 'thread' ||
    target?.mode === 'main' ||
    sceneType === 'ringcentral_reply_composing'
  ) {
    return 'reply';
  }
  if (target?.mode === 'prompt' || sceneType === 'web_ai_prompt_composing') {
    return 'compose';
  }
  return 'read';
}

function buildActiveElementSnapshot(
  element: HTMLElement | null,
  mode: InteractionSceneUserMode,
): ActiveElementSnapshot {
  if (!element) {
    return { kind: 'none', hasFocus: false };
  }
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute('role') || undefined;
  const richFrameBody = getRichTextFrameBody(element);
  const kind: ActiveElementSnapshot['kind'] =
    tag === 'textarea'
      ? 'textarea'
      : tag === 'input'
      ? 'input'
      : richFrameBody
      ? 'editor'
      : element.isContentEditable || element.getAttribute('contenteditable')
      ? 'contenteditable'
      : tag === 'button'
      ? 'button'
      : tag === 'a'
      ? 'link'
      : role === 'textbox'
      ? 'editor'
      : 'other';
  const container = element.closest(
    [
      '[data-testid*="comment"]',
      '[data-test-id*="comment"]',
      '[data-testid*="composer"]',
      '[data-test-id*="composer"]',
      'form',
      '[role="dialog"]',
    ].join(', '),
  );
  const containerText =
    isHTMLElementLike(container)
      ? clip(normalizeText(container.textContent), 180)
      : undefined;
  const activeElement =
    typeof document !== 'undefined' ? document.activeElement : null;
  return {
    kind,
    role,
    mode,
    label:
      element.getAttribute('aria-label') ||
      element.getAttribute('data-placeholder') ||
      undefined,
    placeholder:
      element.getAttribute('placeholder') ||
      element.getAttribute('data-placeholder') ||
      undefined,
    nearbyText:
      clip(
        normalizeText(
          richFrameBody?.innerText ||
            richFrameBody?.textContent ||
            element.textContent,
        ),
        180,
      ) || undefined,
    containerRole:
      isHTMLElementLike(container)
        ? container.getAttribute('role') || container.tagName.toLowerCase()
        : undefined,
    containerLabel: containerText,
    selectorFingerprint: buildElementFingerprint(element),
    hasFocus:
      activeElement === element ||
      Boolean(activeElement && element.contains(activeElement)),
  };
}

function isHTMLElementLike(value: unknown): value is HTMLElement {
  if (!value || typeof value !== 'object') return false;
  if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
    return true;
  }
  const candidate = value as Partial<HTMLElement>;
  return (
    typeof candidate.tagName === 'string' &&
    typeof candidate.getAttribute === 'function'
  );
}

function buildElementFingerprint(element: HTMLElement): string | undefined {
  const parts = [
    element.tagName.toLowerCase(),
    element.getAttribute('role'),
    element.getAttribute('data-testid'),
    element.getAttribute('data-test-id'),
    element.id ? `#${element.id}` : '',
    element.classList.length
      ? `.${Array.from(element.classList).slice(0, 3).join('.')}`
      : '',
  ]
    .filter(Boolean)
    .join(' ');
  return parts ? clip(parts, 160) : undefined;
}

function buildVisibleFacts(snapshot: SiteContextSnapshot): VisibleFactSnapshot[] | undefined {
  const issueKey = snapshot.identifiers?.issueKey || snapshot.audience?.issueKey;
  const facts: VisibleFactSnapshot[] = [];
  for (const field of snapshot.visibleFields ?? []) {
    facts.push({
      kind: 'jira_field',
      name: field.name,
      value: field.value,
      rawText: field.rawText,
      source: 'current_page',
      issueKey,
      confidence: 0.94,
    });
  }
  const seen = new Set<string>();
  const deduped = facts.filter((fact) => {
    const key = `${fact.kind}:${fact.name || ''}:${fact.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.length ? deduped.slice(0, 16) : undefined;
}

function buildInteractionNearbyMessages(
  snapshot: SiteContextSnapshot,
): VisibleMessageSnapshot[] | undefined {
  const messages = [
    ...(snapshot.threadRoot ? [snapshot.threadRoot] : []),
    ...(snapshot.visibleMessages ?? []),
  ]
    .filter((message) => normalizeText(message.text))
    .slice(0, 8);
  return messages.length ? messages : undefined;
}

function buildInteractionAdmission(
  sceneType: InteractionSceneType,
  userMode: InteractionSceneUserMode,
  input: {
    snapshot: SiteContextSnapshot;
    visibleFacts?: VisibleFactSnapshot[];
    nearbyMessages?: VisibleMessageSnapshot[];
    selectedText?: string;
  },
): InteractionSceneSnapshot['admission'] {
  const reasons: string[] = [];
  if (input.selectedText) reasons.push('selected_text');
  if (input.snapshot.identifiers?.issueKey) reasons.push('issue_key');
  if (input.visibleFacts?.length) reasons.push('visible_facts');
  if (input.nearbyMessages?.length) reasons.push('nearby_messages');
  if (input.snapshot.keywords?.length) reasons.push('source_anchors');

  if (userMode === 'comment' || userMode === 'reply' || userMode === 'compose') {
    return { state: 'composer_ready', reasons, confidence: 0.9 };
  }
  if (
    sceneType === 'jira_issue_reading' ||
    sceneType === 'ringcentral_estimate_discussion' ||
    sceneType === 'selection_memory_search' ||
    reasons.length >= 2
  ) {
    return { state: 'passive_ready', reasons, confidence: 0.82 };
  }
  return { state: 'unknown', reasons, confidence: 0.44 };
}

function isEstimateDiscussionSnapshot(snapshot: SiteContextSnapshot): boolean {
  const text = [
    snapshot.title,
    snapshot.primaryText,
    ...(snapshot.secondaryTexts ?? []),
    ...(snapshot.visibleMessages ?? []).map((message) => message.text),
    ...(snapshot.keywords ?? []),
  ]
    .join('\n');
  return (
    /\b[A-Z][A-Z0-9]+-\d+\b/i.test(text) &&
    /\b(?:estimate|estimated|estimation|story\s*points?|sp|dev\s+estimate|original\s+estimate)\b|估算|预估|人天|人日|工时/i.test(
      text,
    )
  );
}

function compactInteractionScene(
  value: InteractionSceneSnapshot,
): InteractionSceneSnapshot {
  const entries = Object.entries(value).filter(([, entry]) => {
    if (entry == null) return false;
    if (typeof entry === 'string') return entry.length > 0;
    if (Array.isArray(entry)) return entry.length > 0;
    return true;
  });
  return Object.fromEntries(entries) as InteractionSceneSnapshot;
}

export function readComposerText(target: ComposerTarget): string {
  const element = target.element as HTMLTextAreaElement | HTMLInputElement;
  if (target.kind === 'textarea' || target.kind === 'input') {
    return normalizeText(element.value);
  }
  if (target.kind === 'richiframe') {
    const body = getRichTextFrameBody(target.element);
    return normalizeText(body?.innerText || body?.textContent || '');
  }
  return normalizeText(
    target.element.innerText || target.element.textContent || '',
  );
}

export interface ComposerTextSnapshot {
  kind: ComposerTarget['kind'];
  value?: string;
  html?: string;
  selectionStart?: number;
  selectionEnd?: number;
}

export interface ComposerSelectionSnapshot {
  kind: ComposerTarget['kind'];
  selectionStart?: number;
  selectionEnd?: number;
  range?: Range;
}

function isNodeInsideElement(node: Node, element: HTMLElement): boolean {
  return node === element || element.contains(node);
}

function getSelectionRangeInside(
  element: HTMLElement,
  ownerDocument: Document = element.ownerDocument,
): Range | null {
  const selection = ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (
    isNodeInsideElement(range.startContainer, element) &&
    isNodeInsideElement(range.endContainer, element)
  ) {
    return range;
  }
  return null;
}

function cloneSelectionRangeInside(
  element: HTMLElement,
  ownerDocument: Document = element.ownerDocument,
): Range | null {
  try {
    return getSelectionRangeInside(element, ownerDocument)?.cloneRange() || null;
  } catch {
    return null;
  }
}

function getTextSelectionOffsets(
  element: HTMLElement,
  ownerDocument: Document = element.ownerDocument,
): { selectionStart: number; selectionEnd: number } | null {
  const range = getSelectionRangeInside(element, ownerDocument);
  if (!range) return null;
  try {
    const beforeStart = ownerDocument.createRange();
    beforeStart.selectNodeContents(element);
    beforeStart.setEnd(range.startContainer, range.startOffset);
    const beforeEnd = ownerDocument.createRange();
    beforeEnd.selectNodeContents(element);
    beforeEnd.setEnd(range.endContainer, range.endOffset);
    return {
      selectionStart: beforeStart.toString().length,
      selectionEnd: beforeEnd.toString().length,
    };
  } catch {
    return null;
  }
}

function restoreTextSelectionOffsets(
  element: HTMLElement,
  selectionStart: number | undefined,
  selectionEnd: number | undefined,
  ownerDocument: Document = element.ownerDocument,
): boolean {
  if (!Number.isFinite(selectionStart) || !Number.isFinite(selectionEnd)) {
    return false;
  }
  const start = Math.max(0, Number(selectionStart));
  const end = Math.max(start, Number(selectionEnd));
  const showText = ownerDocument.defaultView?.NodeFilter.SHOW_TEXT ?? 4;
  const walker = ownerDocument.createTreeWalker(element, showText);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  const resolveBoundary = (offset: number): { node: Node; offset: number } => {
    let remaining = offset;
    for (const node of textNodes) {
      const length = node.data.length;
      if (remaining <= length) {
        return { node, offset: remaining };
      }
      remaining -= length;
    }
    if (textNodes.length) {
      const last = textNodes[textNodes.length - 1];
      return { node: last, offset: last.data.length };
    }
    return { node: element, offset: element.childNodes.length };
  };

  try {
    const startBoundary = resolveBoundary(start);
    const endBoundary = resolveBoundary(end);
    const range = ownerDocument.createRange();
    range.setStart(startBoundary.node, startBoundary.offset);
    range.setEnd(endBoundary.node, endBoundary.offset);
    setSelectionRange(range, ownerDocument);
    return true;
  } catch {
    return false;
  }
}

function collapseRangeToEnd(element: HTMLElement): Range {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  return range;
}

function getTextAroundRange(
  element: HTMLElement,
  range: Range,
): { before: string; after: string } {
  const before = document.createRange();
  before.selectNodeContents(element);
  before.setEnd(range.startContainer, range.startOffset);

  const after = document.createRange();
  after.selectNodeContents(element);
  after.setStart(range.endContainer, range.endOffset);

  return {
    before: before.toString(),
    after: after.toString(),
  };
}

function setSelectionRange(
  range: Range,
  ownerDocument: Document = range.startContainer.ownerDocument,
): void {
  const selection = ownerDocument.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
}

export function captureComposerSelectionSnapshot(
  target: ComposerTarget,
): ComposerSelectionSnapshot | null {
  const element = target.element as HTMLTextAreaElement | HTMLInputElement;
  if (target.kind === 'textarea' || target.kind === 'input') {
    return {
      kind: target.kind,
      selectionStart: element.selectionStart ?? element.value.length,
      selectionEnd: element.selectionEnd ?? element.value.length,
    };
  }

  if (target.kind === 'richiframe') {
    const body = getRichTextFrameBody(target.element);
    if (!body) return null;
    const range = cloneSelectionRangeInside(body, body.ownerDocument);
    return range ? { kind: target.kind, range } : null;
  }

  const range = cloneSelectionRangeInside(target.element);
  return range ? { kind: target.kind, range } : null;
}

export function restoreComposerSelectionSnapshot(
  target: ComposerTarget,
  snapshot: ComposerSelectionSnapshot | null | undefined,
): boolean {
  if (!snapshot || snapshot.kind !== target.kind) return false;
  const element = target.element as HTMLTextAreaElement | HTMLInputElement;

  if (target.kind === 'textarea' || target.kind === 'input') {
    const valueLength = element.value.length;
    const selectionStart = Math.min(
      snapshot.selectionStart ?? valueLength,
      valueLength,
    );
    const selectionEnd = Math.min(
      snapshot.selectionEnd ?? selectionStart,
      valueLength,
    );
    target.element.focus({ preventScroll: true });
    element.setSelectionRange(selectionStart, selectionEnd);
    return true;
  }

  if (!snapshot.range) return false;

  const selectionRoot =
    target.kind === 'richiframe'
      ? getRichTextFrameBody(target.element)
      : target.element;
  if (!selectionRoot) return false;

  try {
    if (
      !isNodeInsideElement(snapshot.range.startContainer, selectionRoot) ||
      !isNodeInsideElement(snapshot.range.endContainer, selectionRoot)
    ) {
      return false;
    }
    selectionRoot.focus({ preventScroll: true });
    setSelectionRange(snapshot.range, selectionRoot.ownerDocument);
    return true;
  } catch {
    return false;
  }
}

export function captureComposerTextSnapshot(
  target: ComposerTarget,
): ComposerTextSnapshot {
  const element = target.element as HTMLTextAreaElement | HTMLInputElement;
  if (target.kind === 'textarea' || target.kind === 'input') {
    return {
      kind: target.kind,
      value: element.value || '',
      selectionStart: element.selectionStart ?? element.value.length,
      selectionEnd: element.selectionEnd ?? element.value.length,
    };
  }

  if (target.kind === 'richiframe') {
    const body = getRichTextFrameBody(target.element);
    const selection = body
      ? getTextSelectionOffsets(body, body.ownerDocument)
      : null;
    return {
      kind: target.kind,
      html: body?.innerHTML || '',
      ...(selection ?? {}),
    };
  }

  const selection = getTextSelectionOffsets(target.element);
  return {
    kind: target.kind,
    html: target.element.innerHTML,
    ...(selection ?? {}),
  };
}

export function restoreComposerTextSnapshot(
  target: ComposerTarget,
  snapshot: ComposerTextSnapshot,
): boolean {
  const element = target.element as HTMLTextAreaElement | HTMLInputElement;

  if (
    (target.kind === 'textarea' || target.kind === 'input') &&
    typeof snapshot.value === 'string'
  ) {
    target.element.focus({ preventScroll: true });
    element.value = snapshot.value;
    const selectionStart = Math.min(
      snapshot.selectionStart ?? snapshot.value.length,
      snapshot.value.length,
    );
    const selectionEnd = Math.min(
      snapshot.selectionEnd ?? selectionStart,
      snapshot.value.length,
    );
    element.setSelectionRange(selectionStart, selectionEnd);
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'historyUndo',
        data: null,
      }),
    );
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (target.kind === 'richiframe' && typeof snapshot.html === 'string') {
    const body = getRichTextFrameBody(target.element);
    if (!body) return false;
    body.innerHTML = snapshot.html;
    body.focus({ preventScroll: true });
    if (
      !restoreTextSelectionOffsets(
        body,
        snapshot.selectionStart,
        snapshot.selectionEnd,
        body.ownerDocument,
      )
    ) {
      const range = body.ownerDocument.createRange();
      range.selectNodeContents(body);
      range.collapse(false);
      setSelectionRange(range, body.ownerDocument);
    }
    dispatchRichTextFrameInput(target.element, body, 'historyUndo', null);
    return true;
  }

  if (typeof snapshot.html === 'string') {
    target.element.focus({ preventScroll: true });
    target.element.innerHTML = snapshot.html;
    if (
      !restoreTextSelectionOffsets(
        target.element,
        snapshot.selectionStart,
        snapshot.selectionEnd,
      )
    ) {
      const range = collapseRangeToEnd(target.element);
      setSelectionRange(range);
    }
    target.element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        inputType: 'historyUndo',
        data: null,
      }),
    );
    target.element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  return false;
}

export function insertTextIntoComposer(
  target: ComposerTarget,
  text: string,
): boolean {
  const element = target.element as HTMLTextAreaElement | HTMLInputElement;
  const insertion = text.trim();
  if (!insertion) return false;
  if (
    element.disabled ||
    element.readOnly ||
    element.getAttribute('aria-disabled') === 'true' ||
    element.getAttribute('contenteditable') === 'false'
  ) {
    return false;
  }

  if (target.kind === 'textarea' || target.kind === 'input') {
    target.element.focus({ preventScroll: true });
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
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: insertion,
      }),
    );
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (target.kind === 'richiframe') {
    return insertTextIntoRichTextFrame(target.element, insertion);
  }

  target.element.focus({ preventScroll: true });
  const activeRange =
    getSelectionRangeInside(target.element) ||
    collapseRangeToEnd(target.element);
  const surroundingText = getTextAroundRange(target.element, activeRange);
  const separatorBefore =
    surroundingText.before && !/\n\s*$/.test(surroundingText.before)
      ? '\n\n'
      : '';
  const separatorAfter =
    surroundingText.after && !/^\s*\n/.test(surroundingText.after)
      ? '\n\n'
      : '';
  const insertedText = `${separatorBefore}${insertion}${separatorAfter}`;
  setSelectionRange(activeRange);

  const insertedWithCommand = document.queryCommandSupported?.('insertText')
    ? document.execCommand('insertText', false, insertedText)
    : false;
  if (!insertedWithCommand) {
    activeRange.deleteContents();
    const insertedNode = document.createTextNode(insertedText);
    activeRange.insertNode(insertedNode);
    activeRange.setStartAfter(insertedNode);
    activeRange.collapse(true);
    setSelectionRange(activeRange);
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
  return true;
}

export function replaceComposerText(
  target: ComposerTarget,
  text: string,
): boolean {
  const element = target.element as HTMLTextAreaElement | HTMLInputElement;
  const replacement = text.trim();
  if (!replacement) return false;
  if (
    element.disabled ||
    element.readOnly ||
    element.getAttribute('aria-disabled') === 'true' ||
    element.getAttribute('contenteditable') === 'false'
  ) {
    return false;
  }

  if (target.kind === 'textarea' || target.kind === 'input') {
    target.element.focus({ preventScroll: true });
    element.value = replacement;
    element.setSelectionRange(replacement.length, replacement.length);
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertReplacementText',
        data: replacement,
      }),
    );
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (target.kind === 'richiframe') {
    return replaceTextInRichTextFrame(target.element, replacement);
  }

  const ownerDocument = target.element.ownerDocument;
  target.element.focus({ preventScroll: true });
  target.element.textContent = replacement;

  const endRange = ownerDocument.createRange();
  endRange.selectNodeContents(target.element);
  endRange.collapse(false);
  setSelectionRange(endRange, ownerDocument);
  target.element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType: 'insertReplacementText',
      data: replacement,
    }),
  );
  target.element.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function dispatchRichTextFrameInput(
  frame: HTMLElement,
  body: HTMLElement,
  inputType: string,
  data: string | null,
): void {
  body.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      inputType,
      data,
    }),
  );
  body.dispatchEvent(new Event('change', { bubbles: true }));
  frame.dispatchEvent(new Event('input', { bubbles: true }));
  frame.dispatchEvent(new Event('change', { bubbles: true }));
}

function insertTextIntoRichTextFrame(frame: HTMLElement, insertion: string): boolean {
  const body = getRichTextFrameBody(frame);
  if (!body) return false;
  const frameDocument = body.ownerDocument;
  body.focus({ preventScroll: true });

  const currentText = normalizeText(body.innerText || body.textContent || '');
  const insertedText = `${currentText ? '\n\n' : ''}${insertion}`;
  let inserted = false;
  try {
    inserted = frameDocument.queryCommandSupported?.('insertText')
      ? frameDocument.execCommand('insertText', false, insertedText)
      : false;
  } catch {
    inserted = false;
  }

  if (!inserted) {
    const textNode = frameDocument.createTextNode(insertedText);
    const selection = frameDocument.getSelection();
    const range =
      selection && selection.rangeCount > 0
        ? selection.getRangeAt(0)
        : frameDocument.createRange();
    if (!selection || selection.rangeCount === 0) {
      range.selectNodeContents(body);
      range.collapse(false);
    }
    range.deleteContents();
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  dispatchRichTextFrameInput(frame, body, 'insertText', insertedText);
  return true;
}

function replaceTextInRichTextFrame(
  frame: HTMLElement,
  replacement: string,
): boolean {
  const body = getRichTextFrameBody(frame);
  if (!body) return false;
  const frameDocument = body.ownerDocument;
  body.focus({ preventScroll: true });
  body.textContent = replacement;

  const endRange = frameDocument.createRange();
  endRange.selectNodeContents(body);
  endRange.collapse(false);
  setSelectionRange(endRange, frameDocument);
  dispatchRichTextFrameInput(
    frame,
    body,
    'insertReplacementText',
    replacement,
  );
  return true;
}

export function isComposerElement(
  element: Element | null | undefined,
): boolean {
  return Boolean(
    closestComposerElement(element || null) ||
      (isHTMLElementLike(element) && isJiraRichTextEditorFrame(element)),
  );
}
