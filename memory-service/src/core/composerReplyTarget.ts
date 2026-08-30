import type { ComposerOwnerIdentity } from './composerEvidenceSlots.js';
import { normalizeCueValue } from './cueMatching.js';
import type {
  ComposerAssistRequest,
  ComposerContextItem,
} from '../types/index.js';

export type ComposerReplyTargetState =
  | 'addressed'
  | 'not_addressed'
  | 'skipped';

export interface ComposerReplyTarget {
  state: ComposerReplyTargetState;
  reason?: string;
  addressees: string[];
  incomingText?: string;
}

const TEAM_ADDRESS_PATTERN =
  /@(?:team|all|everyone|here|channel)\b|hi team|hey team|hello team|@所有人|各位同事|大家好/i;

const GREETING_PREFIX_PATTERN =
  /^(?:hi|hey|hello|dear|btw)\b[,:]?\s+/i;

const ADDRESSEE_STOP_PATTERN =
  /^(?:attached|please|thanks|thank|cc|we|i|i'll|i'm|it|it's|the|this|that|just|wanted|following|regarding|fyi|btw)\b/i;

const ENGLISH_NAME_TOKEN_PATTERN = /^[A-Z][a-zA-Z'.-]+$/;
const ALL_CAPS_ACRONYM_PATTERN = /^[A-Z]{2,5}$/;
const CJK_NAME_PATTERN = /^[\u3400-\u9fff]{2,4}$/;

function compactOwnerKey(value: string): string {
  return normalizeCueValue(value).replace(/[^a-z0-9\u3400-\u9fff]/g, '');
}

export function authorValuesMatchOwner(
  values: Array<string | undefined | null>,
  identity: ComposerOwnerIdentity,
): boolean {
  const ownerKeys = new Set<string>();
  for (const name of identity.names) {
    const normalized = normalizeCueValue(name);
    if (normalized.includes(' ') && normalized.length >= 4) {
      ownerKeys.add(normalized);
    }
    const compact = compactOwnerKey(name);
    if (compact.length >= 5) ownerKeys.add(compact);
  }

  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeCueValue(value);
    if (!normalized) continue;
    if (ownerKeys.has(normalized)) return true;
    const compact = compactOwnerKey(value.replace(/^GLIP_PERSON\./i, ''));
    if (compact.length >= 5 && ownerKeys.has(compact)) return true;
    const id = normalized.replace(/^glip person /, '').replace(/\s+/g, '');
    if (/^\d{6,}$/.test(id) && identity.stopwords.has(id)) return true;
  }
  return false;
}

export function contextItemMatchesOwner(
  item: ComposerContextItem,
  identity: ComposerOwnerIdentity,
): boolean {
  if (item.metadata?.isSelf === true || item.metadata?.authorRole === 'owner') {
    return true;
  }
  const authorValues = item.metadata?.authorValues;
  return authorValuesMatchOwner(
    [
      item.sender,
      ...(Array.isArray(authorValues) ? (authorValues as string[]) : []),
    ],
    identity,
  );
}

function isOwnerAuthored(
  item: ComposerContextItem,
  identity: ComposerOwnerIdentity,
): boolean {
  return contextItemMatchesOwner(item, identity);
}

function isReplyItem(item: ComposerContextItem): boolean {
  return (
    item.type === 'message' ||
    item.type === 'thread_reply' ||
    item.type === 'thread_root' ||
    item.type === 'jira_comment'
  );
}

function applyReplyItems(
  request: ComposerAssistRequest,
): ComposerContextItem[] {
  if (request.contextItems?.length) {
    return request.contextItems.filter(
      (item) => isReplyItem(item) && Boolean(item.text || item.title),
    );
  }
  return (request.visibleMessages ?? [])
    .filter((message) => Boolean(message.text))
    .map((message) => ({
      type: 'message' as const,
      id: message.id,
      sender: message.sender,
      text: message.text,
      timestampLabel: message.timestampLabel,
    }));
}

function latestIncomingItem(
  items: ComposerContextItem[],
  identity: ComposerOwnerIdentity,
): ComposerContextItem | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (!isOwnerAuthored(items[index], identity)) return items[index];
  }
  return undefined;
}

function isNameToken(token: string): boolean {
  if (!token) return false;
  if (ALL_CAPS_ACRONYM_PATTERN.test(token)) return false;
  if (ENGLISH_NAME_TOKEN_PATTERN.test(token)) return true;
  if (CJK_NAME_PATTERN.test(token)) return true;
  return false;
}

function splitNamePhrase(phrase: string): string[] {
  const tokens = phrase
    .replace(/[，,]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const names: string[] = [];
  for (let index = 0; index < tokens.length; ) {
    const token = tokens[index];
    if (ADDRESSEE_STOP_PATTERN.test(token) || !isNameToken(token)) break;
    const next = tokens[index + 1];
    if (next && isNameToken(next) && !ADDRESSEE_STOP_PATTERN.test(next)) {
      names.push(`${token} ${next}`);
      index += 2;
      continue;
    }
    names.push(token);
    index += 1;
  }
  return names;
}

export function extractPrimaryAddressees(text: string): string[] {
  const names = new Set<string>();
  const source = (text || '').replace(/<[^>]+>/g, ' ').trim();
  if (!source) return [];

  if (TEAM_ADDRESS_PATTERN.test(source)) {
    names.add('@team');
  }

  for (const match of source.matchAll(
    /@([A-Z][a-zA-Z'.-]+(?:\s+[A-Z][a-zA-Z'.-]+){0,2}|[\u3400-\u9fff]{2,4})/g,
  )) {
    names.add(match[1].trim());
  }

  const greetingMatch = source.match(GREETING_PREFIX_PATTERN);
  if (greetingMatch) {
    const remainder = source.slice(greetingMatch[0].length);
    const vocative = remainder.match(
      /^((?:[A-Z][a-zA-Z'.-]+|[\u3400-\u9fff]{2,4})(?:\s+(?:[A-Z][a-zA-Z'.-]+|[\u3400-\u9fff]{2,4})){0,7})/,
    );
    if (vocative?.[1]) {
      for (const name of splitNamePhrase(vocative[1])) names.add(name);
    }
  }

  return Array.from(names);
}

function ownerNameCandidates(identity: ComposerOwnerIdentity): string[] {
  return identity.names
    .map((name) => normalizeCueValue(name))
    .filter((name) => name.length >= 4 || name.includes(' '));
}

export function ownerIsPrimaryAddressee(
  addressees: string[],
  identity: ComposerOwnerIdentity,
  text: string,
): boolean {
  if (addressees.includes('@team')) return true;
  const haystack = normalizeCueValue(text);
  const ownerNames = ownerNameCandidates(identity);
  for (const name of ownerNames) {
    if (haystack.includes(name)) {
      const inAddressees = addressees.some(
        (addressee) => normalizeCueValue(addressee) === name,
      );
      if (inAddressees) return true;
    }
  }
  for (const addressee of addressees) {
    const normalized = normalizeCueValue(addressee);
    if (ownerNames.some((name) => name === normalized || normalized.includes(name))) {
      return true;
    }
  }
  return false;
}

export function resolveComposerReplyTarget(
  request: ComposerAssistRequest,
  identity: ComposerOwnerIdentity,
): ComposerReplyTarget {
  if (
    request.contextType === 'web_agent_prompt' ||
    request.contextType === 'jira_issue'
  ) {
    return { state: 'skipped', addressees: [] };
  }

  const items = applyReplyItems(request);
  const incoming = latestIncomingItem(items, identity);
  if (!incoming) {
    return { state: 'skipped', addressees: [], reason: 'no_incoming_message' };
  }

  const text = incoming.text || incoming.title || '';
  const addressees = extractPrimaryAddressees(text);
  if (addressees.length === 0) {
    return {
      state: 'addressed',
      addressees,
      incomingText: text,
      reason: 'no_named_addressee',
    };
  }
  if (ownerIsPrimaryAddressee(addressees, identity, text)) {
    return {
      state: 'addressed',
      addressees,
      incomingText: text,
      reason: 'owner_named',
    };
  }
  return {
    state: 'not_addressed',
    addressees,
    incomingText: text,
    reason: 'named_other_people',
  };
}

const DECISION_ASK_PATTERN =
  /[?？]|\blet'?s\b|\bcan you\b|\bcould you\b|\bwould you\b|\bwill you\b|\bplease\b|能不能|可不可以|是否|要不要|方便.*吗|帮忙|看看/i;

export function currentAskInvitesDecision(text?: string): boolean {
  const source = (text || '').trim();
  if (!source) return false;
  return DECISION_ASK_PATTERN.test(source);
}

export function applyOwnerAuthorshipToRequest(
  request: ComposerAssistRequest,
  identity: ComposerOwnerIdentity,
): ComposerAssistRequest {
  if (!request.contextItems?.length) return request;
  return {
    ...request,
    contextItems: request.contextItems.map((item) => {
      if (!contextItemMatchesOwner(item, identity)) return item;
      return {
        ...item,
        metadata: {
          ...(item.metadata || {}),
          isSelf: true,
          authorRole: 'owner',
        },
      };
    }),
  };
}
