import { getIndexedDBData } from './storage.js';
import {
  isScheduledMessagesInitialized,
  showInitRequiredDialog,
} from './scheduled-messages/ScheduledMessagesUtils.js';
import { formatLocalScheduleDateTime } from './scheduled-messages/scheduleDateTime.js';

type ComposeTargetType = 'private' | 'group';

interface PersonRecord {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  name?: string;
  display_name?: string;
  email?: string;
}

interface GroupRecord {
  id?: number | string;
  set_abbreviation?: string;
  name?: string;
  is_team?: boolean;
  type?: string;
}

export interface GlipComposeTarget {
  chatId: string;
  targetType: ComposeTargetType;
  glipUserName?: string;
  glipTeamId?: string;
  label: string;
  isThreadReply: boolean;
}

interface ComposeExtractionResult {
  content: string;
  hasMentions: boolean;
  unsupportedTeamMention: boolean;
  unresolvedMentions: string[];
  transformedMentions: string[];
}

interface ComposeScheduleRequest {
  topic: string;
  content: string;
  scheduledAt: string;
  chatId: string;
  targetType: ComposeTargetType;
  glipUserName?: string;
  glipTeamId?: string;
  sourceUrl: string;
  isThreadReply: boolean;
  warnings: {
    hasMentions: boolean;
    unsupportedTeamMention: boolean;
    unresolvedMentions: string[];
  };
}

interface CreateComposeScheduleResponse {
  success?: boolean;
  messageId?: string;
  error?: string;
  reason?: string;
  ringCentralSenderConfigured?: boolean;
}

export interface QuickScheduleOption {
  id: string;
  label: string;
  date: Date;
}

interface ComposerState {
  button: HTMLButtonElement;
  composer: HTMLElement;
  pending: boolean;
  placement: 'toolbar' | 'floating';
  toolbar: HTMLElement | null;
  anchorButton: HTMLElement | null;
}

const STYLE_ID = 'pai-glip-compose-scheduler-styles';
const SCHEDULE_BUTTON_CLASS = 'pai-glip-compose-schedule-btn';
const SCHEDULE_BUTTON_VERSION = 'main-composer-v2';
const POPOVER_CLASS = 'pai-glip-compose-schedule-popover';
const TOAST_CLASS = 'pai-glip-compose-schedule-toast';
const COMPOSER_SELECTOR = '.ql-editor[contenteditable="true"]';
const INLINE_REPLY_SELECTOR = [
  '[data-test-automation-id="reply-inline-input"]',
  '[data-test-automation-id="conversation-reply-post-tree"]',
  '.conversation-reply-inline-input',
  '.message-action-bar-inline-reply',
].join(', ');
const ACTION_BUTTON_SELECTOR = 'button, [role="button"]';
const TOOLBAR_CANDIDATE_SELECTOR = [
  '[role="toolbar"]',
  '[data-test-automation-id*="toolbar" i]',
  '[data-testid*="toolbar" i]',
  '[data-test-id*="toolbar" i]',
  '[class*="toolbar" i]',
  '[class*="button-bar" i]',
  '[class*="buttonBar"]',
  '[class*="compose-actions" i]',
  '[class*="composer-actions" i]',
].join(', ');
const processedComposers = new WeakMap<HTMLElement, ComposerState>();
let scanObserverAttached = false;
let scrollListenerAttached = false;
let currentPopover: HTMLElement | null = null;
let currentPopoverComposer: HTMLElement | null = null;
let personCache: Map<string, string> | null = null;
let groupCache: Map<string, GroupRecord> | null = null;

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMentionPrefix(value: string): string {
  return value.replace(/^@+/, '').trim();
}

export function normalizeGlipPersonNameForStorage(input: string): string {
  const withoutPrefix = stripMentionPrefix(input)
    .replace(/[<>]/g, '')
    .trim();
  const localPart = withoutPrefix.includes('@')
    ? withoutPrefix.split('@')[0]
    : withoutPrefix;
  const separator = localPart.includes('.') ? /\./ : /\s+/;
  const parts = localPart
    .split(separator)
    .map((part) => part.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''))
    .filter(Boolean);

  return parts.length >= 2 ? parts.join('.') : '';
}

export function hasUnsupportedTeamMentionText(text: string): boolean {
  return /(^|[\s([{])@(team|all|everyone|here)\b/i.test(text);
}

export function buildComposeScheduleTopic(content: string): string {
  const firstLine = normalizeWhitespace(content)
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return '定时发送消息';
  }

  const clipped = firstLine.length > 40 ? `${firstLine.slice(0, 40)}...` : firstLine;
  return `定时发送: ${clipped}`;
}

export function buildQuickScheduleOptions(now = new Date()): QuickScheduleOption[] {
  const inMinutes = (id: string, label: string, minutes: number): QuickScheduleOption => ({
    id,
    label,
    date: new Date(now.getTime() + minutes * 60 * 1000),
  });
  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);

  return [
    inMinutes('in-1-minute', '1 分钟后', 1),
    inMinutes('in-30-minutes', '30 分钟后', 30),
    inMinutes('in-1-hour', '1 小时后', 60),
    {
      id: 'tomorrow-9',
      label: '明天 9 点',
      date: tomorrowMorning,
    },
  ];
}

export function buildComposeScheduleRequest(params: {
  content: string;
  scheduledAt: Date;
  target: GlipComposeTarget;
  sourceUrl?: string;
  warnings?: ComposeScheduleRequest['warnings'];
}): ComposeScheduleRequest {
  return {
    topic: buildComposeScheduleTopic(params.content),
    content: params.content,
    scheduledAt: params.scheduledAt.toISOString(),
    chatId: params.target.chatId,
    targetType: params.target.targetType,
    glipUserName: params.target.glipUserName,
    glipTeamId: params.target.glipTeamId,
    sourceUrl:
      params.sourceUrl ||
      (typeof window !== 'undefined' ? window.location.href : ''),
    isThreadReply: params.target.isThreadReply,
    warnings: params.warnings || {
      hasMentions: false,
      unsupportedTeamMention: false,
      unresolvedMentions: [],
    },
  };
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

function isLikelyGlipComposer(element: HTMLElement): boolean {
  if (!element.isContentEditable || !isElementVisible(element)) {
    return false;
  }

  if (
    element.closest(INLINE_REPLY_SELECTOR)
  ) {
    return false;
  }

  if (
    element.closest(
      [
        '.message-reaction-toolbar',
        '.snooze-menu',
        '.snooze-picker',
        '.pai-composer-guard',
        `.${POPOVER_CLASS}`,
        `.${TOAST_CLASS}`,
      ].join(', '),
    )
  ) {
    return false;
  }

  return Boolean(
    element.closest('[data-test-automation-id="message-input"]') ||
      element.closest('.message-input-main') ||
      element.getAttribute('aria-label')?.toLowerCase().includes('message input') ||
      element.closest('[data-test-automation-id*="compose"]') ||
      element.closest('[data-testid*="composer"]') ||
      element.closest('[data-test-id*="composer"]'),
  );
}

function getConversationIdFromLocation(): string {
  const match = window.location.pathname.match(/^\/(?:l\/)?messages\/(\d+)/);
  return match?.[1] || '';
}

function getConversationTitle(): string {
  const titleElement =
    document.querySelector('[data-name="conversationTitle"]') ||
    document.querySelector('.conversation-header [class*="title"]') ||
    document.querySelector('[class*="TeamName"]') ||
    document.querySelector('header [role="heading"]');

  return normalizeWhitespace(titleElement?.textContent || '');
}

async function getPersonCache(): Promise<Map<string, string>> {
  if (personCache) {
    return personCache;
  }

  personCache = new Map();
  try {
    const persons = await getIndexedDBData('Glip', 'person');
    (Array.isArray(persons) ? persons : []).forEach((person: PersonRecord) => {
      const id = String(person.id || '').trim();
      if (!id) return;

      const fullName =
        `${person.first_name || ''} ${person.last_name || ''}`.trim() ||
        person.display_name ||
        person.name ||
        person.email ||
        '';
      const normalized = normalizeGlipPersonNameForStorage(fullName);
      if (normalized) {
        personCache!.set(id, normalized);
      }
    });
  } catch (error) {
    console.warn('读取 Glip person 缓存失败，@ 人名将退回文本解析:', error);
  }

  return personCache;
}

async function getGroupCache(): Promise<Map<string, GroupRecord>> {
  if (groupCache) {
    return groupCache;
  }

  groupCache = new Map();
  try {
    const groups = await getIndexedDBData('Glip', 'group');
    (Array.isArray(groups) ? groups : []).forEach((group: GroupRecord) => {
      const id = String(group.id || '').trim();
      if (id) {
        groupCache!.set(id, group);
      }
    });
  } catch (error) {
    console.warn('读取 Glip group 缓存失败，当前聊天目标将退回 URL 判断:', error);
  }

  return groupCache;
}

function getMentionElementId(element: HTMLElement): string {
  const rel = element.getAttribute('rel');
  if (rel) {
    try {
      const parsed = JSON.parse(rel);
      const id = String(parsed?.id || '').trim();
      if (id) return id;
    } catch {
      // ignore invalid rel payloads
    }
  }

  const raw =
    element.dataset.id ||
    element.dataset.uid ||
    element.dataset.cid ||
    element.getAttribute('data-test-automation-value') ||
    '';
  return raw.replace(/^GLIP_PERSON\./, '').trim();
}

function looksLikeMentionElement(element: HTMLElement): boolean {
  const text = element.textContent?.trim() || '';
  return Boolean(
    text.startsWith('@') &&
      (
        element.matches('span[role="link"], a.at_mention_compose, [data-id], [data-uid], [data-cid]') ||
        element.className.toString().includes('mention')
      ),
  );
}

function isBlockElement(element: HTMLElement): boolean {
  return /^(P|DIV|LI)$/i.test(element.tagName);
}

function appendTextWithBoundary(parts: string[], text: string): void {
  if (!text) return;
  parts.push(text);
}

async function extractComposerContent(composer: HTMLElement): Promise<ComposeExtractionResult> {
  const persons = await getPersonCache();
  const parts: string[] = [];
  const transformedMentions: string[] = [];
  const unresolvedMentions: string[] = [];

  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendTextWithBoundary(parts, node.textContent || '');
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (node.tagName === 'BR') {
      parts.push('\n');
      return;
    }

    if (looksLikeMentionElement(node)) {
      const rawMention = node.textContent?.trim() || '';
      const mentionId = getMentionElementId(node);
      const normalizedFromId = mentionId ? persons.get(mentionId) : '';
      const normalizedFromText = normalizeGlipPersonNameForStorage(rawMention);
      const normalized = normalizedFromId || normalizedFromText;

      if (hasUnsupportedTeamMentionText(rawMention)) {
        parts.push(rawMention);
      } else if (normalized) {
        const mentionText = `@${normalized}`;
        parts.push(mentionText);
        transformedMentions.push(mentionText);
      } else {
        parts.push(rawMention);
        if (rawMention) {
          unresolvedMentions.push(rawMention);
        }
      }
      return;
    }

    node.childNodes.forEach(visit);
    if (isBlockElement(node)) {
      parts.push('\n');
    }
  };

  composer.childNodes.forEach(visit);
  const content = normalizeWhitespace(parts.join(''));

  return {
    content,
    hasMentions: /(^|\s)@\S+/.test(content),
    unsupportedTeamMention: hasUnsupportedTeamMentionText(content),
    unresolvedMentions: Array.from(new Set(unresolvedMentions)),
    transformedMentions: Array.from(new Set(transformedMentions)),
  };
}

function looksLikePrivateConversationTitle(title: string): boolean {
  if (!title || /[,，]/.test(title)) {
    return false;
  }
  return Boolean(normalizeGlipPersonNameForStorage(title));
}

async function resolveComposeTarget(composer: HTMLElement): Promise<GlipComposeTarget | null> {
  const conversationId = getConversationIdFromLocation();
  if (!conversationId) {
    return null;
  }

  const groups = await getGroupCache();
  const group = groups.get(conversationId);
  const title = getConversationTitle();
  const groupName = group?.set_abbreviation || group?.name || title || conversationId;
  const isThreadReply = Boolean(
    composer.closest('[data-test-automation-id="conversation-reply-post-tree"]') ||
      composer.closest('.conversation-reply-inline-input'),
  );
  const groupType = String(group?.type || '').toLowerCase();
  const isKnownPrivate = Boolean(
    group &&
      group.is_team !== true &&
      groupType !== 'team' &&
      looksLikePrivateConversationTitle(title),
  );

  if (!isKnownPrivate) {
    return {
      chatId: conversationId,
      targetType: 'group',
      glipTeamId: conversationId,
      label: groupName,
      isThreadReply,
    };
  }

  const glipUserName = normalizeGlipPersonNameForStorage(title);
  if (!glipUserName) {
    return {
      chatId: conversationId,
      targetType: 'group',
      glipTeamId: conversationId,
      label: groupName,
      isThreadReply,
    };
  }

  return {
    chatId: conversationId,
    targetType: 'private',
    glipUserName,
    label: title,
    isThreadReply,
  };
}

function formatDateTimeInputValue(date: Date): string {
  const { dateStr, timeStr } = formatLocalScheduleDateTime(date);
  return `${dateStr}T${timeStr}`;
}

function parseDateTimeInputValue(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDefaultCustomScheduleTime(): Date {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return date;
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${SCHEDULE_BUTTON_CLASS} {
      position: relative;
      box-sizing: border-box;
      flex: 0 0 auto;
      padding: 0;
      color: #1d4ed8;
      background: transparent;
      border: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font: inherit;
      vertical-align: middle;
      transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
    }
    .${SCHEDULE_BUTTON_CLASS}[data-pai-placement="floating"] {
      position: fixed;
      z-index: 2147483645;
      width: 28px;
      height: 28px;
      border: 1px solid rgba(37, 99, 235, 0.28);
      border-radius: 999px;
      color: #1d4ed8;
      background: #ffffff;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.16);
    }
    .${SCHEDULE_BUTTON_CLASS}[data-pai-placement="floating"]:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(37, 99, 235, 0.22);
    }
    .${SCHEDULE_BUTTON_CLASS}[data-pai-placement="toolbar"] {
      z-index: auto;
      width: 32px;
      height: 32px;
      min-width: 32px;
      max-width: 32px;
      flex: 0 0 32px;
      flex-shrink: 0;
      margin-inline-start: 4px;
      border-radius: 6px;
      color: #334155;
      box-shadow: none;
      line-height: 1;
      overflow: visible;
      white-space: nowrap;
    }
    .${SCHEDULE_BUTTON_CLASS}[data-pai-placement="toolbar"]:hover {
      background: rgba(15, 23, 42, 0.08);
      color: #0f172a;
      transform: none;
      box-shadow: none;
    }
    .${SCHEDULE_BUTTON_CLASS}[data-pai-toolbar-pin="more"] {
      position: fixed;
      z-index: 2147483645;
      margin: 0;
    }
    .${SCHEDULE_BUTTON_CLASS}:disabled {
      opacity: 0.58;
      cursor: wait;
      transform: none;
    }
    .pai-glip-compose-schedule-brand {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 9px;
      height: 9px;
      border-radius: 2px;
      background-image: var(--pai-compose-icon-url);
      background-size: cover;
      background-position: center;
      opacity: 1;
      pointer-events: none;
      z-index: 2;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.96), 0 1px 2px rgba(15, 23, 42, 0.16);
    }
    .${SCHEDULE_BUTTON_CLASS}[data-pai-placement="floating"] .pai-glip-compose-schedule-brand {
      top: 1px;
      right: 1px;
      width: 8px;
      height: 8px;
    }
    .${SCHEDULE_BUTTON_CLASS} svg {
      width: 22px !important;
      height: 22px !important;
      min-width: 22px;
      display: block;
      position: relative;
      z-index: 1;
      color: #334155;
    }
    .${POPOVER_CLASS} {
      position: fixed;
      z-index: 2147483646;
      width: 292px;
      box-sizing: border-box;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 8px;
      background: #ffffff;
      box-shadow: 0 14px 40px rgba(15, 23, 42, 0.18);
      color: #172033;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      line-height: 1.4;
    }
    .pai-glip-compose-schedule-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
      font-weight: 600;
    }
    .pai-glip-compose-schedule-close {
      width: 24px;
      height: 24px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #64748b;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
    }
    .pai-glip-compose-schedule-close:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    .pai-glip-compose-schedule-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
    }
    .pai-glip-compose-schedule-option,
    .pai-glip-compose-schedule-confirm,
    .pai-glip-compose-schedule-secondary {
      border: 1px solid rgba(37, 99, 235, 0.18);
      border-radius: 6px;
      background: rgba(37, 99, 235, 0.06);
      color: #1d4ed8;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 10px;
      text-align: center;
    }
    .pai-glip-compose-schedule-option:hover,
    .pai-glip-compose-schedule-confirm:hover,
    .pai-glip-compose-schedule-secondary:hover {
      background: rgba(37, 99, 235, 0.12);
    }
    .pai-glip-compose-schedule-custom {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 10px;
    }
    .pai-glip-compose-schedule-custom input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      color: #0f172a;
      font-size: 13px;
      padding: 7px 8px;
    }
    .pai-glip-compose-schedule-target {
      color: #475569;
      font-size: 12px;
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pai-glip-compose-schedule-warning {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 6px;
      color: #9a3412;
      font-size: 12px;
      margin: 8px 0;
      padding: 8px;
    }
    .pai-glip-compose-schedule-error {
      color: #b91c1c;
      font-size: 12px;
      min-height: 16px;
      margin-top: 6px;
    }
    .${TOAST_CLASS} {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483647;
      max-width: min(420px, calc(100vw - 40px));
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 10px 12px;
      border-radius: 8px;
      background: #0f172a;
      color: #ffffff;
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.28);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      line-height: 1.35;
    }
    .${TOAST_CLASS}.error {
      background: #991b1b;
    }
    .pai-glip-compose-toast-message {
      flex: 1 1 180px;
    }
    .pai-glip-compose-toast-action {
      border: 0;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.16);
      color: #ffffff;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      padding: 5px 8px;
    }
    .pai-glip-compose-toast-action:hover {
      background: rgba(255, 255, 255, 0.24);
    }
  `;
  document.head.appendChild(style);
}

function getClockIconSvg(): string {
  return `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="13" r="7" stroke="currentColor" stroke-width="2"></circle>
      <path d="M12 10v4l2.5 1.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
      <path d="M9 3h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
    </svg>
  `;
}

function isRejectedToolbarElement(element: HTMLElement): boolean {
  return Boolean(
    element.closest(
      [
        '.message-reaction-toolbar',
        '.snooze-menu',
        '.snooze-picker',
        '.reaction-settings-popup',
        `.${POPOVER_CLASS}`,
        `.${TOAST_CLASS}`,
      ].join(', '),
    ),
  );
}

function getActionButtonLabel(element: HTMLElement): string {
  return [
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.getAttribute('data-test-automation-id'),
    element.getAttribute('data-testid'),
    element.getAttribute('data-test-id'),
    element.className?.toString(),
    element.textContent,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isMoreActionButton(element: HTMLElement): boolean {
  if (element.classList.contains(SCHEDULE_BUTTON_CLASS) || isRejectedToolbarElement(element)) {
    return false;
  }

  const label = getActionButtonLabel(element);
  return (
    label.includes('more') ||
    label.includes('ellipsis') ||
    label.includes('更多') ||
    label === '...' ||
    label === '…'
  );
}

function getVisibleToolbarButtons(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(ACTION_BUTTON_SELECTOR)).filter(
    (button) =>
      !button.classList.contains(SCHEDULE_BUTTON_CLASS) &&
      !isRejectedToolbarElement(button) &&
      isElementVisible(button),
  );
}

function isStrongToolbarCandidate(element: HTMLElement): boolean {
  return Boolean(element.matches(TOOLBAR_CANDIDATE_SELECTOR));
}

function getMainComposerRoot(composer: HTMLElement): HTMLElement | null {
  return (
    composer.closest<HTMLElement>('[data-test-automation-id="message-input"]') ||
    composer.closest<HTMLElement>('.message-input-main') ||
    composer.closest<HTMLElement>('[data-test-automation-id*="compose"]') ||
    composer.closest<HTMLElement>('[data-testid*="composer"]') ||
    composer.closest<HTMLElement>('[data-test-id*="composer"]')
  );
}

function scoreComposerCandidate(composer: HTMLElement): number {
  const rect = composer.getBoundingClientRect();
  let score = 0;

  if (composer.closest('[data-test-automation-id="message-input"]')) {
    score += 1000;
  }
  if (composer.closest('.message-input-main')) {
    score += 600;
  }
  if (composer.getAttribute('aria-label')?.toLowerCase().includes('message input')) {
    score += 300;
  }
  if (composer.closest('[data-test-automation-id*="compose"]')) {
    score += 120;
  }
  if (rect.top >= 0 && rect.bottom <= window.innerHeight + 80) {
    score += 100;
  }

  score += Math.max(0, 240 - Math.abs(window.innerHeight - rect.bottom));
  score += Math.min(rect.width, 600) / 20;

  return score;
}

function getActiveComposer(): HTMLElement | null {
  const composers = Array.from(document.querySelectorAll<HTMLElement>(COMPOSER_SELECTOR))
    .filter(isLikelyGlipComposer);
  if (composers.length === 0) {
    return null;
  }

  return composers.reduce((best, composer) =>
    scoreComposerCandidate(composer) > scoreComposerCandidate(best)
      ? composer
      : best,
  );
}

function findMoreButton(root: HTMLElement): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>(ACTION_BUTTON_SELECTOR)).find(
      (button) => isElementVisible(button) && isMoreActionButton(button),
    ) || null
  );
}

function findToolbarContainerForAction(
  action: HTMLElement,
  composer: HTMLElement,
): HTMLElement | null {
  let current = action.parentElement;
  let fallback: HTMLElement | null = null;

  while (current && current !== document.body) {
    if (current === composer || current.contains(composer)) {
      break;
    }

    const buttonCount = getVisibleToolbarButtons(current).length;
    if (buttonCount >= 2 || (buttonCount >= 1 && isStrongToolbarCandidate(current))) {
      fallback = current;
      if (isStrongToolbarCandidate(current)) {
        return current;
      }
    }

    current = current.parentElement;
  }

  return fallback;
}

function getComposerToolbarSearchRoots(composer: HTMLElement): HTMLElement[] {
  const roots: HTMLElement[] = [];
  let current: HTMLElement | null = composer;
  for (let depth = 0; current && depth < 8; depth += 1) {
    roots.push(current);
    current = current.parentElement;
  }
  return roots;
}

function scoreToolbarCandidate(candidate: HTMLElement, composer: HTMLElement): number {
  if (
    candidate === composer ||
    isRejectedToolbarElement(candidate) ||
    !document.contains(candidate) ||
    !isElementVisible(candidate)
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  const buttons = getVisibleToolbarButtons(candidate);
  if (buttons.length === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  const composerRect = composer.getBoundingClientRect();
  const candidateRect = candidate.getBoundingClientRect();
  if (
    !candidate.contains(composer) &&
    (candidateRect.bottom < composerRect.top - 12 ||
      candidateRect.top > composerRect.bottom + 220)
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  const verticalGap = Math.min(
    Math.abs(candidateRect.top - composerRect.bottom),
    Math.abs(candidateRect.bottom - composerRect.bottom),
    Math.abs(candidateRect.top - composerRect.top),
  );
  let score = buttons.length * 2 - Math.min(verticalGap, 400) / 8;

  if (findMoreButton(candidate)) {
    score += 100;
  }
  if (isStrongToolbarCandidate(candidate)) {
    score += 30;
  }
  if (candidateRect.top >= composerRect.top - 4) {
    score += 20;
  }
  if (candidateRect.top >= composerRect.bottom - 8) {
    score += 35;
  }
  if (candidate.contains(composer)) {
    score -= 80;
  }

  return score;
}

function findComposerToolbar(composer: HTMLElement): HTMLElement | null {
  const candidates = new Set<HTMLElement>();
  const mainRoot = getMainComposerRoot(composer);
  if (mainRoot) {
    const mainMore = findMoreButton(mainRoot);
    const mainToolbar = mainMore ? findToolbarContainerForAction(mainMore, composer) : null;
    if (mainToolbar && mainRoot.contains(mainToolbar)) {
      return mainToolbar;
    }
  }

  const roots = mainRoot ? [mainRoot] : getComposerToolbarSearchRoots(composer);

  roots.forEach((root) => {
    Array.from(root.querySelectorAll<HTMLElement>(ACTION_BUTTON_SELECTOR)).forEach((button) => {
      if (!isMoreActionButton(button)) return;
      const toolbar = findToolbarContainerForAction(button, composer);
      if (toolbar) {
        candidates.add(toolbar);
      }
    });

    Array.from(root.querySelectorAll<HTMLElement>(TOOLBAR_CANDIDATE_SELECTOR)).forEach(
      (candidate) => {
        candidates.add(candidate);
      },
    );

    Array.from(root.children).forEach((child) => {
      if (child instanceof HTMLElement && !child.contains(composer)) {
        candidates.add(child);
      }
    });
  });

  let best: HTMLElement | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  candidates.forEach((candidate) => {
    const score = scoreToolbarCandidate(candidate, composer);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best;
}

function applyButtonPlacement(state: ComposerState, placement: ComposerState['placement']): void {
  state.placement = placement;
  state.button.dataset.paiPlacement = placement;
  delete state.button.dataset.paiToolbarPin;
  state.button.style.left = '';
  state.button.style.top = '';
  state.button.style.position = '';
}

function positionToolbarButtonBesideAnchor(state: ComposerState): boolean {
  const anchor = state.anchorButton;
  if (!anchor || !document.contains(anchor) || !isElementVisible(anchor)) {
    return false;
  }

  state.button.dataset.paiToolbarPin = 'more';
  state.button.style.position = 'fixed';
  if (!state.button.style.left) {
    state.button.style.left = '0px';
  }
  if (!state.button.style.top) {
    state.button.style.top = '0px';
  }

  const anchorRect = anchor.getBoundingClientRect();
  const buttonSize = 32;
  const gap = 6;
  const left = Math.max(
    8,
    Math.min(window.innerWidth - buttonSize - 8, anchorRect.right + gap),
  );
  const top = Math.max(
    8,
    Math.min(
      window.innerHeight - buttonSize - 8,
      anchorRect.top + (anchorRect.height - buttonSize) / 2,
    ),
  );

  state.button.style.left = `${left}px`;
  state.button.style.top = `${top}px`;
  return true;
}

function mountScheduleButton(state: ComposerState): void {
  const toolbar = findComposerToolbar(state.composer);
  if (toolbar) {
    const moreButton = findMoreButton(toolbar);
    applyButtonPlacement(state, 'toolbar');
    state.toolbar = toolbar;
    state.anchorButton = moreButton;

    if (state.button.parentElement !== document.body) {
      document.body.appendChild(state.button);
    }
    return;
  }

  applyButtonPlacement(state, 'floating');
  state.toolbar = null;
  state.anchorButton = null;
  if (state.button.parentElement !== document.body) {
    document.body.appendChild(state.button);
  }
}

function getScheduleButtonState(button: HTMLButtonElement): ComposerState | undefined {
  return (button as HTMLButtonElement & { __paiGlipComposeState?: ComposerState }).__paiGlipComposeState;
}

function shouldRemoveScheduleButton(
  button: HTMLButtonElement,
  state: ComposerState | undefined,
  activeComposer: HTMLElement | null,
): boolean {
  return (
    !state ||
    button.dataset.paiVersion !== SCHEDULE_BUTTON_VERSION ||
    button.closest(INLINE_REPLY_SELECTOR) !== null ||
    !activeComposer ||
    state.composer !== activeComposer ||
    !document.contains(state.composer) ||
    !isLikelyGlipComposer(state.composer)
  );
}

function positionButton(state: ComposerState): void {
  const rect = state.composer.getBoundingClientRect();
  if (!isElementVisible(state.composer) || rect.bottom < 0 || rect.top > window.innerHeight) {
    state.button.style.display = 'none';
    return;
  }

  state.button.style.display = 'inline-flex';
  if (state.placement === 'toolbar') {
    if (!positionToolbarButtonBesideAnchor(state)) {
      delete state.button.dataset.paiToolbarPin;
      state.button.style.left = '';
      state.button.style.top = '';
      state.button.style.position = '';
    }
    return;
  }

  const left = Math.max(8, Math.min(window.innerWidth - 38, rect.right - 38));
  const top = Math.max(8, Math.min(window.innerHeight - 38, rect.bottom - 34));
  state.button.style.left = `${left}px`;
  state.button.style.top = `${top}px`;
}

function positionPopover(anchor: HTMLElement, popover: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const width = 292;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
  const top =
    rect.top > 360
      ? Math.max(8, rect.top - popover.offsetHeight - 8)
      : Math.min(window.innerHeight - 16, rect.bottom + 8);
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function showToast(
  message: string,
  variant: 'success' | 'error' = 'success',
  actions: Array<{ label: string; onClick: () => void | Promise<void> }> = [],
): void {
  document.querySelectorAll(`.${TOAST_CLASS}`).forEach((toast) => toast.remove());

  const toast = document.createElement('div');
  toast.className = `${TOAST_CLASS}${variant === 'error' ? ' error' : ''}`;
  const messageElement = document.createElement('span');
  messageElement.className = 'pai-glip-compose-toast-message';
  messageElement.textContent = message;
  toast.appendChild(messageElement);

  actions.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pai-glip-compose-toast-action';
    button.textContent = action.label;
    button.addEventListener('click', async () => {
      try {
        await action.onClick();
      } catch (error) {
        console.warn('定时发送 toast 操作失败:', error);
      }
      toast.remove();
    });
    toast.appendChild(button);
  });

  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 8000);
}

function dispatchComposerEditEvent(composer: HTMLElement, eventName: 'input' | 'change'): void {
  const event =
    eventName === 'input' && typeof InputEvent === 'function'
      ? new InputEvent('input', {
          bubbles: true,
          inputType: 'deleteContentBackward',
        })
      : new Event(eventName, { bubbles: true });
  composer.dispatchEvent(event);
  getMainComposerRoot(composer)?.dispatchEvent(new Event(eventName, { bubbles: true }));
}

function clearComposerDraft(composer: HTMLElement): void {
  composer.innerHTML = '';
  dispatchComposerEditEvent(composer, 'input');
  dispatchComposerEditEvent(composer, 'change');
}

function closePopover(): void {
  currentPopover?.remove();
  currentPopover = null;
  currentPopoverComposer = null;
}

function openScheduledMessages(extraData: Record<string, unknown> = {}): void {
  void chrome.runtime
    .sendMessage({
      type: 'OPEN_SCHEDULED_MESSAGES',
      data: extraData,
    })
    .catch((error) => {
      console.warn('打开定时消息管理器失败:', error);
      window.open(chrome.runtime.getURL('scheduled-messages.html'), '_blank');
    });
}

function getSuccessToastMessage(
  response: CreateComposeScheduleResponse,
  warnings: ComposeScheduleRequest['warnings'],
): string {
  const notes: string[] = ['已创建定时消息'];
  if (warnings.unsupportedTeamMention) {
    notes.push('@team / @all 这类群体提及当前不保证生效，请改用具体 @人名');
  }
  if (warnings.unresolvedMentions.length > 0) {
    notes.push(`有 ${warnings.unresolvedMentions.length} 个 @ 提及未能规范化`);
  }
  if (warnings.hasMentions && response.ringCentralSenderConfigured === false) {
    notes.push('未配置 RingCentral sender，@ 可能会作为普通文本发送');
  }
  return notes.join('；');
}

async function createScheduledComposeMessage(
  request: ComposeScheduleRequest,
): Promise<CreateComposeScheduleResponse> {
  return chrome.runtime.sendMessage({
    type: 'CREATE_GLIP_COMPOSE_SCHEDULED_MESSAGE',
    data: request,
  });
}

async function submitSchedule(
  composer: HTMLElement,
  scheduledAt: Date,
  setError?: (message: string) => void,
): Promise<void> {
  const state = processedComposers.get(composer);
  if (!state || state.pending) return;

  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
    setError?.('请选择未来时间');
    return;
  }

  state.pending = true;
  state.button.disabled = true;
  setError?.('');

  try {
    const initialized = await isScheduledMessagesInitialized();
    if (!initialized) {
      closePopover();
      await showInitRequiredDialog('定时发送');
      return;
    }

    const [target, extraction] = await Promise.all([
      resolveComposeTarget(composer),
      extractComposerContent(composer),
    ]);

    if (!target) {
      setError?.('无法识别当前聊天目标');
      return;
    }

    if (!extraction.content) {
      setError?.('请先输入要定时发送的消息');
      return;
    }

    const request = buildComposeScheduleRequest({
      content: extraction.content,
      scheduledAt,
      target,
      warnings: {
        hasMentions: extraction.hasMentions,
        unsupportedTeamMention: extraction.unsupportedTeamMention,
        unresolvedMentions: extraction.unresolvedMentions,
      },
    });
    const response = await createScheduledComposeMessage(request);

    if (!response?.success) {
      setError?.(response?.error || '创建定时消息失败');
      return;
    }

    closePopover();
    clearComposerDraft(composer);
    showToast(getSuccessToastMessage(response, request.warnings), 'success', [
      {
        label: '管理',
        onClick: () => openScheduledMessages({ category: 'ComposeScheduled' }),
      },
      ...(request.warnings.hasMentions && response.ringCentralSenderConfigured === false
        ? [
            {
              label: '配置 @',
              onClick: () => openScheduledMessages({ configureRingCentralSender: true }),
            },
          ]
        : []),
    ]);
  } catch (error) {
    console.error('创建 Glip 定时发送失败:', error);
    setError?.(error instanceof Error ? error.message : '创建定时消息失败');
  } finally {
    state.pending = false;
    state.button.disabled = false;
  }
}

async function getPopoverDraftPreview(composer: HTMLElement): Promise<{
  target: GlipComposeTarget | null;
  extraction: ComposeExtractionResult;
}> {
  const [target, extraction] = await Promise.all([
    resolveComposeTarget(composer),
    extractComposerContent(composer),
  ]);
  return { target, extraction };
}

async function showSchedulePopover(composer: HTMLElement): Promise<void> {
  const state = processedComposers.get(composer);
  if (!state) return;

  if (currentPopover && currentPopoverComposer === composer) {
    closePopover();
    return;
  }

  closePopover();

  const popover = document.createElement('div');
  popover.className = POPOVER_CLASS;
  popover.innerHTML = `
    <div class="pai-glip-compose-schedule-header">
      <span>定时发送</span>
      <button type="button" class="pai-glip-compose-schedule-close" aria-label="关闭">×</button>
    </div>
    <div class="pai-glip-compose-schedule-target">正在读取当前草稿...</div>
    <div class="pai-glip-compose-schedule-options"></div>
    <div class="pai-glip-compose-schedule-custom">
      <input type="datetime-local" class="pai-glip-compose-schedule-input" />
      <button type="button" class="pai-glip-compose-schedule-confirm">按自定义时间创建</button>
    </div>
    <button type="button" class="pai-glip-compose-schedule-secondary">打开定时消息管理器</button>
    <div class="pai-glip-compose-schedule-error" aria-live="polite"></div>
  `;

  const targetElement = popover.querySelector<HTMLElement>('.pai-glip-compose-schedule-target');
  const optionsElement = popover.querySelector<HTMLElement>('.pai-glip-compose-schedule-options');
  const inputElement = popover.querySelector<HTMLInputElement>('.pai-glip-compose-schedule-input');
  const errorElement = popover.querySelector<HTMLElement>('.pai-glip-compose-schedule-error');
  const setError = (message: string) => {
    if (errorElement) {
      errorElement.textContent = message;
    }
  };

  if (inputElement) {
    inputElement.value = formatDateTimeInputValue(getDefaultCustomScheduleTime());
  }

  buildQuickScheduleOptions().forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pai-glip-compose-schedule-option';
    button.textContent = option.label;
    button.addEventListener('click', () => {
      void submitSchedule(composer, option.date, setError);
    });
    optionsElement?.appendChild(button);
  });

  popover
    .querySelector('.pai-glip-compose-schedule-close')
    ?.addEventListener('click', closePopover);
  popover
    .querySelector('.pai-glip-compose-schedule-secondary')
    ?.addEventListener('click', () => openScheduledMessages());
  popover
    .querySelector('.pai-glip-compose-schedule-confirm')
    ?.addEventListener('click', () => {
      const date = parseDateTimeInputValue(inputElement?.value || '');
      if (!date) {
        setError('请选择有效时间');
        return;
      }
      void submitSchedule(composer, date, setError);
    });

  document.body.appendChild(popover);
  currentPopover = popover;
  currentPopoverComposer = composer;
  positionPopover(state.button, popover);

  try {
    const { target, extraction } = await getPopoverDraftPreview(composer);
    const warnings: string[] = [];
    if (extraction.unsupportedTeamMention) {
      warnings.push('@team / @all 这类群体提及当前不保证生效');
    }
    if (extraction.unresolvedMentions.length > 0) {
      warnings.push('部分 @ 提及无法自动转成 first.last');
    }
    if (target?.isThreadReply) {
      warnings.push('会发送到当前聊天，不会保留 thread 回复位置');
    }

    if (targetElement) {
      targetElement.textContent = target
        ? `目标：${target.targetType === 'group' ? '群组' : '私聊'} ${target.label}`
        : '无法识别当前聊天目标';
    }

    warnings.forEach((warning) => {
      const warningElement = document.createElement('div');
      warningElement.className = 'pai-glip-compose-schedule-warning';
      warningElement.textContent = warning;
      popover.insertBefore(warningElement, popover.querySelector('.pai-glip-compose-schedule-error'));
    });
  } catch (error) {
    console.warn('读取定时发送草稿预览失败:', error);
    if (targetElement) {
      targetElement.textContent = '读取当前草稿失败，请稍后重试';
    }
  }

  positionPopover(state.button, popover);
}

function attachComposer(composer: HTMLElement): void {
  if (processedComposers.has(composer) || !isLikelyGlipComposer(composer)) {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = SCHEDULE_BUTTON_CLASS;
  button.title = '定时发送';
  button.setAttribute('aria-label', '定时发送');
  button.dataset.paiVersion = SCHEDULE_BUTTON_VERSION;
  button.innerHTML = `
    <span class="pai-glip-compose-schedule-brand" aria-hidden="true"></span>
    ${getClockIconSvg()}
  `;
  try {
    button.style.setProperty(
      '--pai-compose-icon-url',
      `url("${chrome.runtime.getURL('icons/icon48.png')}")`,
    );
  } catch {
    // The clock icon is still usable if the extension asset URL is unavailable.
  }

  const state: ComposerState = {
    button,
    composer,
    pending: false,
    placement: 'floating',
    toolbar: null,
    anchorButton: null,
  };
  (button as HTMLButtonElement & { __paiGlipComposeState?: ComposerState }).__paiGlipComposeState = state;
  processedComposers.set(composer, state);

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void showSchedulePopover(composer);
  });

  mountScheduleButton(state);
  positionButton(state);
}

function scanComposers(): void {
  const activeComposer = getActiveComposer();

  document
    .querySelectorAll<HTMLButtonElement>(`.${SCHEDULE_BUTTON_CLASS}`)
    .forEach((button) => {
      const state = getScheduleButtonState(button);
      if (shouldRemoveScheduleButton(button, state, activeComposer)) {
        if (state && currentPopoverComposer === state.composer) {
          closePopover();
        }
        if (state) {
          processedComposers.delete(state.composer);
        }
        button.remove();
      }
    });

  if (!activeComposer) {
    return;
  }

  const state = processedComposers.get(activeComposer);
  if (state) {
    mountScheduleButton(state);
    positionButton(state);
    return;
  }

  attachComposer(activeComposer);
}

function ensureGlobalListeners(): void {
  if (!scrollListenerAttached) {
    scrollListenerAttached = true;
    const schedulePositionRefresh = () => {
      requestAnimationFrame(() => {
        scanComposers();
        document
          .querySelectorAll<HTMLButtonElement>(`.${SCHEDULE_BUTTON_CLASS}`)
          .forEach((button) => {
            const state = getScheduleButtonState(button);
            if (state) {
              mountScheduleButton(state);
              positionButton(state);
            }
          });
        if (currentPopover && currentPopoverComposer) {
          const state = processedComposers.get(currentPopoverComposer);
          if (state) {
            positionPopover(state.button, currentPopover);
          }
        }
      });
    };
    window.addEventListener('resize', schedulePositionRefresh, { passive: true });
    window.addEventListener('scroll', schedulePositionRefresh, { passive: true, capture: true });
    window.setInterval(schedulePositionRefresh, 1500);
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (
        currentPopover &&
        target &&
        !target.closest(`.${POPOVER_CLASS}`) &&
        !target.closest(`.${SCHEDULE_BUTTON_CLASS}`)
      ) {
        closePopover();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closePopover();
      }
    });
  }

  if (!scanObserverAttached) {
    scanObserverAttached = true;
    const observer = new MutationObserver(() => {
      scanComposers();
      if (currentPopoverComposer && !document.contains(currentPopoverComposer)) {
        closePopover();
      }
      document
        .querySelectorAll<HTMLButtonElement>(`.${SCHEDULE_BUTTON_CLASS}`)
        .forEach((button) => {
          const state = getScheduleButtonState(button);
          const activeComposer = getActiveComposer();
          if (shouldRemoveScheduleButton(button, state, activeComposer)) {
            if (state) {
              if (currentPopoverComposer === state.composer) {
                closePopover();
              }
              processedComposers.delete(state.composer);
            }
            button.remove();
          } else if (state) {
            mountScheduleButton(state);
            positionButton(state);
          }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

export function initGlipComposeScheduler(): void {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }

  injectStyles();
  ensureGlobalListeners();
  scanComposers();
}
