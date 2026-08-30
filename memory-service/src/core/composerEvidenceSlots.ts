import type Database from 'better-sqlite3';

import {
  isCueStopword,
  isInformativeTopicCue,
  normalizeCueValue,
} from './cueMatching.js';
import type {
  ComposerAssistEvidence,
  ComposerAssistRequest,
  ComposerAudienceType,
} from '../types/index.js';

export interface ComposerOwnerIdentity {
  names: string[];
  stopwords: Set<string>;
}

export type ComposerPriorKind =
  | 'writing_style'
  | 'decision_tendency'
  | 'scene_habit';

export type ComposerSpeechAct =
  | 'refuse'
  | 'chase'
  | 'conclude'
  | 'request_resource'
  | 'reply';

export type ComposerSituationScene =
  | 'thread_reply'
  | 'jira_comment'
  | 'web_prompt'
  | 'other';

export interface ComposerSituation {
  audienceType: ComposerAudienceType | 'unknown';
  scene: ComposerSituationScene;
  speechAct: ComposerSpeechAct;
}

export interface ComposerPersonalPrior {
  id: string;
  kind: ComposerPriorKind;
  summary: string;
  audienceType?: string;
  scene?: string;
  speechAct?: string;
}

export type ComposerPriorConstraint = 'writing_only' | 'stance_suggestion';

export interface ComposerPriorReceipt {
  used: boolean;
  constraint: ComposerPriorConstraint;
  summary: string;
  priors: Array<{
    id: string;
    kind: ComposerPriorKind;
    summary: string;
  }>;
}

export interface ComposerEvidenceSlots {
  topicEvidence: ComposerAssistEvidence[];
  personalPriors: ComposerPersonalPrior[];
  priorReceipt?: ComposerPriorReceipt;
}

const OWNER_NAME_KEY_PATTERN =
  /^(name|display_name|full_name|preferred_name|english_name|chinese_name|given_name|family_name|alias)(\.|$)/i;

const WRITING_PRIOR_PATTERN =
  /writing_style|语气|口吻|简短|concise|hedge|留余地|直接|directness|语气像/i;
const DECISION_PRIOR_PATTERN =
  /决定|decision|上次|一向|通常会|我一般|I usually|I tend/i;

const SPEECH_ACT_PATTERNS: Array<{ act: ComposerSpeechAct; pattern: RegExp }> = [
  { act: 'refuse', pattern: /不行|拒绝|can't|cannot|won't|没法|不同意|not going to/i },
  { act: 'chase', pattern: /催|follow[- ]?up|进度|ping|什么时候|deadline|blocked on/i },
  { act: 'conclude', pattern: /结论|决定|we should|就这样|ship it|结论是/i },
  {
    act: 'request_resource',
    pattern: /需要|申请|资源|bandwidth|headcount|can we get/i,
  },
];

const AUDIENCE_HINT_PATTERNS: Array<{
  type: ComposerAudienceType;
  pattern: RegExp;
}> = [
  { type: 'manager', pattern: /manager|上级|老板|vp\b|总监|汇报/i },
  { type: 'peer', pattern: /peer|同事|平级|队友/i },
  {
    type: 'direct_report',
    pattern: /direct report|下级|下属|report to me/i,
  },
];

function addIdentityForms(target: Set<string>, raw?: string | null): void {
  const normalized = normalizeCueValue(raw);
  if (!normalized || normalized.length < 2) return;
  if (isCueStopword(normalized)) return;
  target.add(normalized);
  for (const part of normalized.split(' ')) {
    if (part.length >= 2 && !isCueStopword(part)) target.add(part);
  }
}

export function loadComposerOwnerIdentity(
  db: Database.Database,
  userId: string,
): ComposerOwnerIdentity {
  const stopwords = new Set<string>();
  addIdentityForms(stopwords, userId);
  for (const part of userId.split(/[._-]+/)) {
    addIdentityForms(stopwords, part);
  }

  try {
    const rows = db
      .prepare(
        `SELECT item_key, item_value
           FROM user_profile_items
          WHERE status IN ('active', 'pending_confirm')`,
      )
      .all() as Array<{ item_key: string; item_value: string }>;
    for (const row of rows) {
      if (OWNER_NAME_KEY_PATTERN.test(row.item_key)) {
        addIdentityForms(stopwords, row.item_value);
      }
    }
  } catch {
    // Profile table may be missing in a brand-new test db.
  }

  try {
    const users = db
      .prepare(
        `SELECT display_name, email, extension_number
           FROM rc_directory_users`,
      )
      .all() as Array<{
      display_name: string;
      email: string | null;
      extension_number: string | null;
    }>;
    const userKey = normalizeCueValue(userId).replace(/\s+/g, '');
    for (const user of users) {
      const email = normalizeCueValue(user.email);
      const local = email.split(' ')[0] || '';
      const compactLocal = local.replace(/\s+/g, '');
      if (
        compactLocal === userKey ||
        email.includes(userKey) ||
        normalizeCueValue(user.display_name).includes(userKey)
      ) {
        addIdentityForms(stopwords, user.display_name);
        addIdentityForms(stopwords, local);
        addIdentityForms(stopwords, user.extension_number);
      }
    }
  } catch {
    // Directory is optional.
  }

  return { names: Array.from(stopwords), stopwords };
}

export function isOwnerIdentityValue(
  value: string | undefined | null,
  identity: ComposerOwnerIdentity,
): boolean {
  const normalized = normalizeCueValue(value);
  if (!normalized) return false;
  if (identity.stopwords.has(normalized)) return true;
  for (const token of normalized.split(' ')) {
    if (identity.stopwords.has(token)) return true;
  }
  return false;
}

function hasAnyStructuredAnchor(item: ComposerAssistEvidence): boolean {
  const anchors = item.matchedAnchors;
  return Boolean(
    anchors?.people?.length ||
      anchors?.projects?.length ||
      anchors?.topics?.length ||
      anchors?.source?.length,
  );
}

export function hasNonSelfTopicAnchor(
  item: ComposerAssistEvidence,
  identity: ComposerOwnerIdentity,
): boolean {
  const anchors = item.matchedAnchors;
  if (!anchors) return false;

  const otherPeople = (anchors.people ?? []).filter(
    (person) =>
      !isOwnerIdentityValue(person, identity) && !isCueStopword(person),
  );
  if (otherPeople.length) return true;

  const projects = (anchors.projects ?? []).filter(
    (project) =>
      !isOwnerIdentityValue(project, identity) && isInformativeTopicCue(project),
  );
  if (projects.length) return true;

  const topics = (anchors.topics ?? []).filter(
    (topic) =>
      !isOwnerIdentityValue(topic, identity) && isInformativeTopicCue(topic),
  );
  if (topics.length) return true;

  const sources = (anchors.source ?? []).filter((source) => {
    if (/^(group|conversation|meeting|issue|url):/i.test(source)) return true;
    return (
      !isOwnerIdentityValue(source, identity) && isInformativeTopicCue(source)
    );
  });
  return sources.length > 0;
}

/**
 * A-slot gate. Constraint is on anchors, not author: a note the owner wrote
 * about NC Switcher is valid because the project is the anchor. A hit whose
 * only overlap is the owner's name is not.
 *
 * Items with no structured anchors keep the caller's overlap decision — FTS
 * chunks often omit matchedAnchors. Rehearsals must have a non-self anchor;
 * scene-cue status is not a free pass.
 */
export function qualifiesAsTopicEvidence(
  item: ComposerAssistEvidence,
  identity: ComposerOwnerIdentity,
): boolean {
  const isRehearsal =
    item.type === 'rehearsal' ||
    item.evidenceRole === 'rehearsal_cue' ||
    item.reasonType === 'prospective_cue';
  if (isRehearsal) return hasNonSelfTopicAnchor(item, identity);
  if (!hasAnyStructuredAnchor(item)) return true;
  return hasNonSelfTopicAnchor(item, identity);
}

export function inferComposerSituation(
  request: ComposerAssistRequest,
  audienceType?: ComposerAudienceType,
): ComposerSituation {
  const scene: ComposerSituationScene =
    request.contextType === 'web_agent_prompt'
      ? 'web_prompt'
      : request.surface?.includes('jira') || request.audience?.issueKey
        ? 'jira_comment'
        : request.contextType === 'message_thread' ||
            request.surface?.includes('ringcentral')
          ? 'thread_reply'
          : 'other';

  const text = [
    request.draftText,
    request.primaryText,
    request.title,
    ...(request.secondaryTexts ?? []),
    ...(request.visibleMessages ?? []).map((item) => item.text || ''),
  ]
    .filter(Boolean)
    .join('\n');

  let speechAct: ComposerSpeechAct = 'reply';
  for (const candidate of SPEECH_ACT_PATTERNS) {
    if (candidate.pattern.test(text)) {
      speechAct = candidate.act;
      break;
    }
  }

  return {
    audienceType: audienceType || 'unknown',
    scene,
    speechAct,
  };
}

function isOwnerRelatedPrior(
  item: ComposerAssistEvidence,
  identity: ComposerOwnerIdentity,
): boolean {
  if (item.claimAttribution?.some((claim) => claim.ownerKind === 'self')) {
    return true;
  }
  if (item.metadata?.isSelf === true || item.metadata?.authorRole === 'owner') {
    return true;
  }
  if (item.type === 'rehearsal') return true;
  if (item.reasonType === 'prior_decision') return true;
  if (/user_core|profile|writing_style/i.test(item.sourceLabel || '')) {
    return true;
  }
  const haystack = [item.title, item.snippet, item.sourceTitle]
    .filter(Boolean)
    .join(' ');
  if (WRITING_PRIOR_PATTERN.test(haystack) || DECISION_PRIOR_PATTERN.test(haystack)) {
    return true;
  }
  return isOwnerIdentityValue(haystack, identity) &&
    (WRITING_PRIOR_PATTERN.test(haystack) || DECISION_PRIOR_PATTERN.test(haystack));
}

function classifyPriorKind(item: ComposerAssistEvidence): ComposerPriorKind {
  const haystack = [item.title, item.snippet, item.sourceLabel]
    .filter(Boolean)
    .join(' ');
  if (WRITING_PRIOR_PATTERN.test(haystack) || item.type === 'rehearsal') {
    return item.type === 'rehearsal' ? 'scene_habit' : 'writing_style';
  }
  if (item.reasonType === 'prior_decision' || DECISION_PRIOR_PATTERN.test(haystack)) {
    return 'decision_tendency';
  }
  return 'scene_habit';
}

function matchesSituationShape(
  item: ComposerAssistEvidence,
  situation: ComposerSituation,
): boolean {
  const haystack = [
    item.title,
    item.snippet,
    item.sourceTitle,
    ...(item.whyRelevant ?? []),
  ]
    .filter(Boolean)
    .join('\n');

  if (classifyPriorKind(item) === 'writing_style') return true;

  let audienceHit = situation.audienceType === 'unknown';
  for (const candidate of AUDIENCE_HINT_PATTERNS) {
    if (candidate.pattern.test(haystack)) {
      audienceHit = candidate.type === situation.audienceType;
      break;
    }
  }

  const sceneHit =
    situation.scene === 'other' ||
    (situation.scene === 'jira_comment' && /jira|issue|ticket/i.test(haystack)) ||
    (situation.scene === 'thread_reply' &&
      /glip|ringcentral|thread|回复|chat/i.test(haystack)) ||
    (situation.scene === 'web_prompt' && /prompt|chatgpt|claude|gemini/i.test(haystack)) ||
    item.type === 'rehearsal';

  let speechHit = situation.speechAct === 'reply';
  for (const candidate of SPEECH_ACT_PATTERNS) {
    if (candidate.pattern.test(haystack) && candidate.act === situation.speechAct) {
      speechHit = true;
      break;
    }
  }

  return audienceHit || sceneHit || speechHit;
}

function clipPrior(value: string, maxLength = 180): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function toPrior(
  item: ComposerAssistEvidence,
  situation: ComposerSituation,
): ComposerPersonalPrior {
  return {
    id: item.id,
    kind: classifyPriorKind(item),
    summary: clipPrior(item.snippet || item.title || item.id),
    audienceType: situation.audienceType,
    scene: situation.scene,
    speechAct: situation.speechAct,
  };
}

export function selectPersonalPriors(
  items: ComposerAssistEvidence[],
  topicEvidenceIds: Set<string>,
  identity: ComposerOwnerIdentity,
  situation: ComposerSituation,
): ComposerPersonalPrior[] {
  const ranked: Array<{ prior: ComposerPersonalPrior; rank: number }> = [];
  for (const item of items) {
    if (topicEvidenceIds.has(item.id)) continue;
    if (!isOwnerRelatedPrior(item, identity)) continue;
    if (!matchesSituationShape(item, situation)) continue;
    const prior = toPrior(item, situation);
    if (prior.kind === 'writing_style') continue;
    const rank = prior.kind === 'decision_tendency' ? 2 : 1;
    ranked.push({ prior, rank });
  }
  ranked.sort((left, right) => right.rank - left.rank);
  const unique = new Map<string, ComposerPersonalPrior>();
  for (const entry of ranked) {
    if (unique.size >= 2) break;
    if (!unique.has(entry.prior.id)) unique.set(entry.prior.id, entry.prior);
  }
  return Array.from(unique.values());
}

export function buildPriorReceipt(
  priors: ComposerPersonalPrior[],
  constraint: ComposerPriorConstraint = 'writing_only',
): ComposerPriorReceipt | undefined {
  if (!priors.length) return undefined;
  const canSuggestStance =
    constraint === 'stance_suggestion' &&
    priors.some((prior) => prior.kind === 'decision_tendency');
  const resolved: ComposerPriorConstraint = canSuggestStance
    ? 'stance_suggestion'
    : 'writing_only';
  return {
    used: true,
    constraint: resolved,
    summary: canSuggestStance
      ? '当前消息在向你征求决定时，历史决策倾向可以建议答应、拒绝或先不承诺；不能加码日期、版本、范围或新负责人。需你确认后才发送。'
      : '本人历史表达倾向只影响语气、长度和直接程度，不决定同意、拒绝或承诺。',
    priors: priors.map((prior) => ({
      id: prior.id,
      kind: prior.kind,
      summary: prior.summary,
    })),
  };
}

export function formatPersonalPriorsForGeneration(
  priors: ComposerPersonalPrior[],
  constraint: ComposerPriorConstraint = 'writing_only',
): string {
  if (!priors.length) return '';
  const lines = priors.map(
    (prior, index) => `[P${index + 1}] (${prior.kind}) ${prior.summary}`,
  );
  if (constraint === 'stance_suggestion') {
    return [
      '本人历史决策倾向（可建议立场，需用户确认后才发送）：',
      ...lines,
      '* 当前消息在向你征求决定时，草稿可以顺着这些倾向建议答应、拒绝或先不承诺。',
      '* 不要加码：不能从倾向里写出当前提问没有的日期、版本、范围、负责人和新承诺。',
      '* 这些不是当前这件事的事实；用户未确认前不算你已表态。',
    ].join('\n');
  }
  return [
    '本人历史表达倾向（只影响写法，不决定同意/拒绝/承诺）：',
    ...lines,
    '* 这些条目不能当作当前这件事的事实，也不能推出这次该答应或拒绝。立场必须来自当前上下文或主题证据。',
  ].join('\n');
}

export function partitionComposerEvidence(input: {
  overlapFiltered: ComposerAssistEvidence[];
  rawEvidence: ComposerAssistEvidence[];
  identity: ComposerOwnerIdentity;
  situation: ComposerSituation;
  canSuggestStance?: boolean;
}): ComposerEvidenceSlots {
  const topicEvidence = input.overlapFiltered.filter((item) =>
    qualifiesAsTopicEvidence(item, input.identity),
  );
  const topicIds = new Set(topicEvidence.map((item) => item.id));
  const personalPriors = selectPersonalPriors(
    input.rawEvidence,
    topicIds,
    input.identity,
    input.situation,
  );
  return {
    topicEvidence,
    personalPriors,
    priorReceipt: buildPriorReceipt(
      personalPriors,
      input.canSuggestStance ? 'stance_suggestion' : 'writing_only',
    ),
  };
}
