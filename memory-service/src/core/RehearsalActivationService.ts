import type Database from 'better-sqlite3';

import {
  loadComposerOwnerIdentity,
  type ComposerOwnerIdentity,
} from './composerEvidenceSlots.js';
import { cueValuesMatch, isCueStopword } from './cueMatching.js';
import {
  hasStableCue,
  normalizeCues,
  RehearsalService,
} from './RehearsalService.js';
import type {
  ContextRecallDisplayPriority,
  ContextRecallMatch,
  ContextRecallRequest,
  Rehearsal,
  RehearsalActivationCues,
} from '../types/index.js';

const AUTO_ACTIVE_THRESHOLD = 0.82;
const STRONG_DISPLAY_THRESHOLD = 0.72;
const WEAK_DISPLAY_THRESHOLD = 0.55;
const AGING_SECONDS = 30 * 86400;

interface SceneCues extends RehearsalActivationCues {
  text: string;
}

interface MatchScore {
  score: number;
  matchedCues: RehearsalActivationCues;
  whyRelevant: string[];
  displayPriority: ContextRecallDisplayPriority;
}

export class RehearsalActivationService {
  private readonly rehearsalService: RehearsalService;

  constructor(
    private readonly db: Database.Database,
    private readonly userId = 'default',
  ) {
    this.rehearsalService = new RehearsalService(db);
  }

  getMatches(request: ContextRecallRequest, limit: number): ContextRecallMatch[] {
    if (request.sourceTypes?.length && !request.sourceTypes.includes('rehearsal')) {
      return [];
    }
    const scene = extractSceneCues(request);
    const rehearsals = this.rehearsalService.listActivatable();
    const matches: ContextRecallMatch[] = [];
    const ownerIdentity = loadComposerOwnerIdentity(this.db, this.userId);

    for (const rehearsal of rehearsals) {
      const score = scoreRehearsal(rehearsal, request, scene, ownerIdentity);
      if (!score || score.displayPriority === 'hidden') continue;

      if (rehearsal.status === 'candidate') {
        if (
          score.score < AUTO_ACTIVE_THRESHOLD ||
          rehearsal.confidence < AUTO_ACTIVE_THRESHOLD ||
          !hasStableCue(rehearsal.activationCues)
        ) {
          continue;
        }
      }

      const activation = this.rehearsalService.recordMatchedActivation({
        rehearsalId: rehearsal.id,
        surface: request.surface,
        contextType: request.contextType,
        sceneKey: buildSceneKey(request, scene),
        score: score.score,
        displayPriority: score.displayPriority,
        matchedCues: score.matchedCues,
      });

      matches.push(toContextRecallMatch(rehearsal, score, activation.id));
    }

    return matches
      .sort((a, b) => {
        const priorityDelta =
          displayPriorityRank(b.displayPriority) -
          displayPriorityRank(a.displayPriority);
        if (priorityDelta !== 0) return priorityDelta;
        return b.score - a.score;
      })
      .slice(0, Math.max(0, limit));
  }
}

function scoreRehearsal(
  rehearsal: Rehearsal,
  request: ContextRecallRequest,
  scene: SceneCues,
  ownerIdentity?: ComposerOwnerIdentity,
): MatchScore | null {
  const cues = normalizeCues(rehearsal.activationCues);
  const matched: RehearsalActivationCues = {};
  let overlapScore = 0;

  overlapScore +=
    matchList(cues.people, scene.people, matched, 'people', ownerIdentity) * 0.12;
  overlapScore +=
    matchList(cues.projects, scene.projects, matched, 'projects', ownerIdentity) *
    0.34;
  overlapScore +=
    matchList(cues.topics, scene.topics, matched, 'topics', ownerIdentity) * 0.08;
  overlapScore +=
    matchList(cues.keywords, scene.keywords, matched, 'keywords', ownerIdentity) *
    0.06;
  overlapScore +=
    matchList(cues.groupIds, scene.groupIds, matched, 'groupIds', ownerIdentity) *
    0.38;
  overlapScore +=
    matchList(
      cues.conversationIds,
      scene.conversationIds,
      matched,
      'conversationIds',
      ownerIdentity,
    ) * 0.38;
  overlapScore +=
    matchList(cues.meetingIds, scene.meetingIds, matched, 'meetingIds', ownerIdentity) *
    0.36;
  overlapScore +=
    matchList(
      cues.calendarEventIds,
      scene.calendarEventIds,
      matched,
      'calendarEventIds',
      ownerIdentity,
    ) * 0.34;
  overlapScore +=
    matchList(cues.issueKeys, scene.issueKeys, matched, 'issueKeys', ownerIdentity) *
    0.36;
  overlapScore += matchUrl(cues.urls, request.url || request.sourceContext?.url, matched);
  overlapScore +=
    matchList(cues.surfaces, [request.surface], matched, 'surfaces', ownerIdentity) *
    0.04;

  if (!hasAnyCue(matched)) return null;

  const now = Math.floor(Date.now() / 1000);
  // Self-assessed rehearsal confidence must not be enough, on its own, to
  // clear the 0.55 display line. A real group/issue/project hit still can.
  const base = Math.max(0.06, Math.min(0.22, rehearsal.confidence * 0.2));
  let score = base + Math.min(0.7, overlapScore);
  if (rehearsal.priority >= 8) score += 0.05;
  const expired = Boolean(rehearsal.validUntil && rehearsal.validUntil < now);
  if (rehearsal.validFrom && rehearsal.validFrom > now) score -= 0.08;
  if (rehearsal.validUntil) {
    if (expired) score -= 0.1;
    else if (rehearsal.validUntil - now <= 3 * 86400) score += 0.04;
  }
  if (rehearsal.status === 'stale' && !expired) score -= 0.12;
  if (rehearsal.staleReason === 'aging_no_activation_30d') score -= 0.06;
  if (
    rehearsal.lastActivatedAt &&
    now - rehearsal.lastActivatedAt > AGING_SECONDS
  ) {
    score -= 0.06;
  }
  score -= Math.min(0.18, rehearsal.dismissedCount * 0.04);
  score = Math.max(0, Math.min(0.99, score));

  let displayPriority: ContextRecallDisplayPriority =
    score >= STRONG_DISPLAY_THRESHOLD
      ? 'p1'
      : score >= WEAK_DISPLAY_THRESHOLD
        ? 'p2'
        : 'hidden';
  const whyRelevant = buildWhyRelevant(matched);
  if (rehearsal.status === 'stale' && displayPriority === 'p1') {
    displayPriority = 'p2';
  }
  if (rehearsal.status === 'stale' && displayPriority !== 'hidden') {
    whyRelevant.unshift(staleReasonLabel(rehearsal.staleReason));
  }

  return {
    score,
    matchedCues: matched,
    whyRelevant: Array.from(new Set(whyRelevant)).slice(0, 4),
    displayPriority,
  };
}

function toContextRecallMatch(
  rehearsal: Rehearsal,
  score: MatchScore,
  activationId: string,
): ContextRecallMatch {
  const title = rehearsal.title || 'Rehearsal';
  return {
    id: rehearsal.id,
    type: 'rehearsal',
    score: score.score,
    title,
    snippet: clip(rehearsal.summary || rehearsal.content, 140),
    uiSummary: clip(rehearsal.summary || rehearsal.content, 220),
    sourceLabel: 'rehearsal',
    sourceTitle: 'Rehearsal',
    exploreLink: `#/rehearsals?rehearsalId=${encodeURIComponent(
      rehearsal.id,
    )}`,
    links: [],
    whyMatched: '预演线索命中当前场景',
    whyRelevant: score.whyRelevant,
    matchedAnchors: {
      people: score.matchedCues.people,
      topics: [
        ...(score.matchedCues.topics ?? []),
        ...(score.matchedCues.keywords ?? []),
      ].slice(0, 5),
      projects: score.matchedCues.projects,
      source: [
        ...(score.matchedCues.groupIds ?? []).map((item) => `group:${item}`),
        ...(score.matchedCues.conversationIds ?? []).map(
          (item) => `conversation:${item}`,
        ),
        ...(score.matchedCues.meetingIds ?? []).map((item) => `meeting:${item}`),
        ...(score.matchedCues.issueKeys ?? []).map((item) => `issue:${item}`),
      ].slice(0, 5),
    },
    reasonType: 'prospective_cue',
    evidenceRole: 'rehearsal_cue',
    displayPriority: score.displayPriority,
    metadata: {
      rehearsal: {
        id: rehearsal.id,
        activationId,
        scenarioType: rehearsal.scenarioType,
        status: rehearsal.status,
        summary: rehearsal.summary,
        content: rehearsal.content,
        sourceKind: rehearsal.sourceKind,
        sourceRefId: rehearsal.sourceRefId,
        validUntil: rehearsal.validUntil,
      },
      activationCues: rehearsal.activationCues,
      matchedCues: score.matchedCues,
      evidenceRefs: rehearsal.evidenceRefs,
    },
    timestamp: rehearsal.updatedAt,
  };
}

function extractSceneCues(request: ContextRecallRequest): SceneCues {
  const scene: SceneCues = { text: '' };
  const textParts = [
    request.title,
    request.primaryText,
    ...(request.secondaryTexts ?? []),
    request.sourceContext?.title,
    request.sourceContext?.topic,
    ...(request.sourceContext?.participants ?? []),
    ...(request.entityHints ?? []).map((hint) => hint.value),
  ].filter((value): value is string => Boolean(value));
  const text = textParts.join(' ');
  scene.text = text;

  addList(scene, 'people', request.sourceContext?.participants);
  for (const hint of request.entityHints ?? []) {
    if (/person|participant|sender/i.test(hint.kind)) addList(scene, 'people', [hint.value]);
    else if (/project/i.test(hint.kind)) addList(scene, 'projects', [hint.value]);
    else if (/jira|issue/i.test(hint.kind)) addList(scene, 'issueKeys', [hint.value]);
    else if (/group/i.test(hint.kind)) addList(scene, 'groupIds', [hint.value]);
    else if (/conversation/i.test(hint.kind)) addList(scene, 'conversationIds', [hint.value]);
    else if (/meeting/i.test(hint.kind)) addList(scene, 'meetingIds', [hint.value]);
    else if (/calendar/i.test(hint.kind)) addList(scene, 'calendarEventIds', [hint.value]);
    else addList(scene, 'topics', [hint.value]);
  }
  addList(scene, 'groupIds', [request.sourceContext?.groupId]);
  addList(scene, 'conversationIds', [request.sourceContext?.conversationId]);
  addList(scene, 'meetingIds', [request.sourceContext?.meetingId]);
  addList(scene, 'calendarEventIds', [request.sourceContext?.calendarEventId]);
  addList(scene, 'issueKeys', [request.sourceContext?.issueKey]);
  addList(scene, 'issueKeys', text.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? []);
  addList(scene, 'people', text.match(/@[A-Za-z][A-Za-z0-9._-]{1,40}/g)?.map((v) => v.slice(1)));
  addList(
    scene,
    'people',
    text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g) ?? [],
  );
  addList(scene, 'projects', extractProjectNames(text));
  addList(scene, 'topics', extractTopicTerms(text));
  addList(scene, 'keywords', extractKeywordTerms(text));
  return normalizeCues(scene) as SceneCues;
}

function extractProjectNames(text: string): string[] {
  const results: string[] = [];
  for (const match of text.matchAll(/\bProject\s+([A-Za-z][A-Za-z0-9_-]{2,30})\b/g)) {
    results.push(match[1]);
  }
  for (const match of text.matchAll(/项目\s*[:：]?\s*([A-Za-z0-9\u3400-\u9fff_-]{2,30})/g)) {
    results.push(match[1]);
  }
  return results;
}

function extractTopicTerms(text: string): string[] {
  return (
    text.match(
      /\b(?:Claude(?:\s+Code)?|Codex|Composer|Cursor|GPT[-\s]?5(?:\.5)?|MCP|Nova|OpenAI|Personal AI|RingClaw|Runstead|budget|quota|migration|release|review)\b/gi,
    ) ?? []
  );
}

function extractKeywordTerms(text: string): string[] {
  const words = text.match(/[A-Za-z][A-Za-z0-9_-]{3,40}|[\u3400-\u9fff]{2,12}/g) ?? [];
  return Array.from(new Set(words)).slice(0, 40);
}

function matchList(
  cues: string[] | undefined,
  sceneValues: string[] | undefined,
  matched: RehearsalActivationCues,
  key: keyof RehearsalActivationCues,
  ownerIdentity?: ComposerOwnerIdentity,
): number {
  if (!cues?.length || !sceneValues?.length) return 0;
  const hits: string[] = [];
  for (const cue of cues) {
    if (isCueStopword(cue)) continue;
    if (
      key === 'people' &&
      ownerIdentity &&
      ownerIdentity.stopwords.has(normalizeForCompare(cue))
    ) {
      continue;
    }
    const cueNorm = normalizeForCompare(cue);
    if (!cueNorm) continue;
    for (const sceneValue of sceneValues) {
      if (isCueStopword(sceneValue)) continue;
      if (
        key === 'people' &&
        ownerIdentity &&
        ownerIdentity.stopwords.has(normalizeForCompare(sceneValue))
      ) {
        continue;
      }
      if (cueValuesMatch(cue, sceneValue)) {
        hits.push(cue);
        break;
      }
    }
  }
  const uniqueHits = Array.from(new Set(hits)).slice(0, 8);
  if (uniqueHits.length) {
    (matched as Record<string, string[]>)[key] = uniqueHits;
  }
  return Math.min(3, uniqueHits.length);
}

function matchUrl(
  cues: string[] | undefined,
  currentUrl: string | undefined,
  matched: RehearsalActivationCues,
): number {
  if (!cues?.length || !currentUrl) return 0;
  const normalizedCurrent = normalizeUrl(currentUrl);
  const hits = cues.filter((cue) => {
    const normalizedCue = normalizeUrl(cue);
    return (
      normalizedCue &&
      normalizedCurrent &&
      (normalizedCurrent === normalizedCue ||
        normalizedCurrent.startsWith(normalizedCue) ||
        normalizedCue.startsWith(normalizedCurrent))
    );
  });
  if (hits.length) matched.urls = hits.slice(0, 3);
  return hits.length ? 0.18 : 0;
}

function buildWhyRelevant(cues: RehearsalActivationCues): string[] {
  const reasons: string[] = [];
  for (const person of cues.people ?? []) reasons.push(`人物：${person}`);
  for (const project of cues.projects ?? []) reasons.push(`项目：${project}`);
  for (const issue of cues.issueKeys ?? []) reasons.push(`工单：${issue}`);
  for (const topic of [...(cues.topics ?? []), ...(cues.keywords ?? [])]) {
    reasons.push(`线索：${topic}`);
  }
  if (cues.groupIds?.length) reasons.push('同群聊');
  if (cues.conversationIds?.length) reasons.push('同会话');
  if (cues.meetingIds?.length || cues.calendarEventIds?.length) reasons.push('同会议');
  return Array.from(new Set(reasons)).slice(0, 4);
}

function staleReasonLabel(reason: string | undefined): string {
  if (reason === 'validity_expired') return '已过期，仅弱提示';
  if (reason === 'no_activation_90d') return '长期未命中，仅弱提示';
  if (reason === 'aging_no_activation_30d') return '近期未命中，降权提示';
  return '已降权，仅弱提示';
}

function hasAnyCue(cues: RehearsalActivationCues): boolean {
  return Object.values(cues).some((value) => Array.isArray(value) && value.length > 0);
}

function addList(
  target: RehearsalActivationCues,
  key: keyof RehearsalActivationCues,
  values: Array<string | undefined> | undefined,
): void {
  const cleaned = (values ?? [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (!cleaned.length) return;
  const existing = target[key] ?? [];
  (target as Record<string, string[]>)[key] = Array.from(
    new Set([...existing, ...cleaned]),
  );
}

function normalizeForCompare(value: string): string {
  return value
    .toLowerCase()
    .replace(/^[@#]+/, '')
    .replace(/^group:|^conversation:|^meeting:|^issue:/i, '')
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return value.trim().replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function buildSceneKey(request: ContextRecallRequest, scene: SceneCues): string {
  return [
    request.surface,
    request.contextType,
    request.sourceContext?.groupId || '',
    request.sourceContext?.conversationId || '',
    request.sourceContext?.meetingId || '',
    request.sourceContext?.issueKey || '',
    (scene.people ?? []).slice(0, 3).join(','),
    (scene.projects ?? []).slice(0, 2).join(','),
  ].join('|');
}

function displayPriorityRank(priority?: ContextRecallDisplayPriority): number {
  if (priority === 'p1') return 3;
  if (priority === 'p2') return 2;
  return 0;
}

function clip(value: string, maxLength: number): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}
