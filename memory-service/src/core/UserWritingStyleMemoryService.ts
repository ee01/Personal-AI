import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { contentHash } from '../utils/hashing.js';
import { now } from '../utils/time.js';

type AmbientTraceAction =
  | 'sent_after_insert'
  | 'sent_without_insert'
  | 'edited_before_send'
  | 'deleted_before_send'
  | 'inserted'
  | 'wrong'
  | 'downstream_reaction'
  | string;

type AmbientTraceStrength = 'weak' | 'medium' | 'strong' | string;
type AmbientTracePolarity =
  | 'positive'
  | 'negative'
  | 'correction'
  | 'neutral'
  | string;

interface AmbientEvidenceRef {
  id: string;
  type?: string;
  title?: string;
  role?: string;
}

export interface AmbientWritingStyleTrace {
  id: string;
  userId: string;
  surface: string;
  sceneKey: string;
  action: AmbientTraceAction;
  strength: AmbientTraceStrength;
  polarity: AmbientTracePolarity;
  evidenceRefs?: AmbientEvidenceRef[];
  redactedDiff?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdAt: number;
}

interface WritingStyleMemoryRow {
  id: string;
  user_id: string;
  scope_key: string;
  scope_level: string;
  surface: string | null;
  audience_type: string | null;
  person_ids_json: string;
  group_ids_json: string;
  task_kind: string | null;
  language: string | null;
  preference_kind: string;
  positive_rules_json: string;
  negative_rules_json: string;
  examples_redacted_json: string;
  evidence_json: string;
  feature_counts_json: string;
  confidence: number;
  half_life_days: number;
  status: string;
  promoted_profile_item_id: string | null;
  created_at: number;
  updated_at: number;
}

interface ProfileItemRow {
  id: string;
  evidence_refs: string | null;
  mention_count: number;
}

interface StyleScope {
  scopeKey: string;
  scopeLevel: 'audience' | 'relationship' | 'surface' | 'global';
  surface?: string;
  audienceType?: string;
  personIds: string[];
  groupIds: string[];
  taskKind?: string;
  language?: string;
}

interface StyleRules {
  preferenceKind: string;
  positiveRules: string[];
  negativeRules: string[];
  features: string[];
}

export interface WritingStyleProcessResult {
  processed: boolean;
  memoryIds: string[];
  promotedProfileItemIds: string[];
}

const MAX_EVIDENCE = 30;
const ACTIVE_EVIDENCE_THRESHOLD = 3;
const ACTIVE_CONFIDENCE_THRESHOLD = 0.68;

const FEATURE_RULES: Record<
  string,
  { positive?: string; negative?: string; preferenceKind?: string }
> = {
  casual_opening_haha: {
    positive: '中文轻松聊天里可以自然使用“哈哈”开场。',
    preferenceKind: 'relationship_voice',
  },
  tilde_suffix: {
    positive: '关系轻松时可以偶尔用句尾“~”表达自然和松弛。',
    preferenceKind: 'punctuation',
  },
  more_direct: {
    positive: '优先直接给结论或下一步，不要先铺长情绪价值。',
    preferenceKind: 'tone',
  },
  lead_with_conclusion: {
    positive: '状态同步和求助回复里先给结论，再补必要上下文。',
    preferenceKind: 'structure',
  },
  same_intent_shorter_form: {
    positive: '保留原意时优先压短表达。',
    preferenceKind: 'length',
  },
  removed_preamble: {
    negative: '避免解释性开头和“我这边先补充几个相关点”这类 AI 式铺垫。',
    preferenceKind: 'anti_ai_style',
  },
  less_polite_preamble: {
    negative: '不要为了显得礼貌而增加过长铺垫。',
    preferenceKind: 'anti_ai_style',
  },
  over_enthusiastic_claim: {
    negative: '避免“我最喜欢聊了”这类夸张自我表态。',
    preferenceKind: 'anti_ai_style',
  },
  removed_over_enthusiastic_claim: {
    negative: '避免“我最喜欢聊了”这类夸张自我表态。',
    preferenceKind: 'anti_ai_style',
  },
  generic_future_promise: {
    negative: '避免“到时候看你具体想了解哪块”这类泛泛未来承诺。',
    preferenceKind: 'anti_ai_style',
  },
  removed_generic_future_promise: {
    negative: '避免“到时候看你具体想了解哪块”这类泛泛未来承诺。',
    preferenceKind: 'anti_ai_style',
  },
  performative_collaboration_phrase: {
    negative: '避免“咱们一起捣鼓下”这类表演式协作套话。',
    preferenceKind: 'anti_ai_style',
  },
  removed_performative_collaboration_phrase: {
    negative: '避免“咱们一起捣鼓下”这类表演式协作套话。',
    preferenceKind: 'anti_ai_style',
  },
  ai_tone_called_out: {
    negative: '如果对方反馈“AI 味”，降低过度热情、泛泛承诺和排比式客套。',
    preferenceKind: 'anti_ai_style',
  },
  avoids_parallel_politeness: {
    negative: 'peer 聊天里避免排比句和连续客套。',
    preferenceKind: 'anti_ai_style',
  },
};

export class UserWritingStyleMemoryService {
  constructor(
    private readonly db: Database.Database,
    private readonly userId = 'default',
  ) {}

  processAmbientTrace(
    trace: AmbientWritingStyleTrace,
  ): WritingStyleProcessResult {
    if (trace.surface !== 'compose_assist') {
      return { processed: false, memoryIds: [], promotedProfileItemIds: [] };
    }

    const rules = buildStyleRules(trace);
    if (!rules.features.length) {
      return { processed: false, memoryIds: [], promotedProfileItemIds: [] };
    }

    const scopes = buildStyleScopes(trace);
    const memoryIds: string[] = [];
    const promotedProfileItemIds: string[] = [];

    const tx = this.db.transaction(() => {
      for (const scope of scopes) {
        const row = this.upsertMemory(trace, scope, rules);
        memoryIds.push(row.id);
        const profileItemId = this.promoteIfReady(row, scope, rules);
        if (profileItemId) promotedProfileItemIds.push(profileItemId);
      }
    });
    tx();

    return {
      processed: true,
      memoryIds,
      promotedProfileItemIds: Array.from(new Set(promotedProfileItemIds)),
    };
  }

  private upsertMemory(
    trace: AmbientWritingStyleTrace,
    scope: StyleScope,
    rules: StyleRules,
  ): WritingStyleMemoryRow {
    const currentTime = toSeconds(trace.createdAt || Date.now());
    const existing = this.db
      .prepare(
        `SELECT *
           FROM user_writing_style_memories
          WHERE user_id = ?
            AND scope_key = ?
            AND preference_kind = ?
          LIMIT 1`,
      )
      .get(this.userId, scope.scopeKey, rules.preferenceKind) as
      | WritingStyleMemoryRow
      | undefined;

    const evidence = mergeEvidence(
      existing?.evidence_json,
      buildEvidence(trace, scope),
    );
    const featureCounts = mergeFeatureCounts(
      existing?.feature_counts_json,
      rules.features,
    );
    const confidence = computeConfidence(evidence.length, featureCounts);
    const status = shouldPromote(evidence.length, featureCounts, confidence)
      ? 'active'
      : 'candidate';

    if (existing) {
      const positiveRules = mergeStrings(
        parseJson<string[]>(existing.positive_rules_json, []),
        rules.positiveRules,
      );
      const negativeRules = mergeStrings(
        parseJson<string[]>(existing.negative_rules_json, []),
        rules.negativeRules,
      );

      this.db
        .prepare(
          `UPDATE user_writing_style_memories
              SET positive_rules_json = ?,
                  negative_rules_json = ?,
                  evidence_json = ?,
                  feature_counts_json = ?,
                  confidence = ?,
                  status = ?,
                  updated_at = ?
            WHERE id = ?`,
        )
        .run(
          JSON.stringify(positiveRules),
          JSON.stringify(negativeRules),
          JSON.stringify(evidence),
          JSON.stringify(featureCounts),
          confidence,
          existing.status === 'active' ? 'active' : status,
          currentTime,
          existing.id,
        );

      return this.getMemory(existing.id);
    }

    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO user_writing_style_memories
          (id, user_id, scope_key, scope_level, surface, audience_type,
           person_ids_json, group_ids_json, task_kind, language,
           preference_kind, positive_rules_json, negative_rules_json,
           examples_redacted_json, evidence_json, feature_counts_json,
           confidence, half_life_days, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, 45, ?, ?, ?)`,
      )
      .run(
        id,
        this.userId,
        scope.scopeKey,
        scope.scopeLevel,
        scope.surface ?? null,
        scope.audienceType ?? null,
        JSON.stringify(scope.personIds),
        JSON.stringify(scope.groupIds),
        scope.taskKind ?? null,
        scope.language ?? null,
        rules.preferenceKind,
        JSON.stringify(rules.positiveRules),
        JSON.stringify(rules.negativeRules),
        JSON.stringify(evidence),
        JSON.stringify(featureCounts),
        confidence,
        status,
        currentTime,
        currentTime,
      );

    return this.getMemory(id);
  }

  private getMemory(id: string): WritingStyleMemoryRow {
    return this.db
      .prepare('SELECT * FROM user_writing_style_memories WHERE id = ?')
      .get(id) as WritingStyleMemoryRow;
  }

  private promoteIfReady(
    row: WritingStyleMemoryRow,
    scope: StyleScope,
    rules: StyleRules,
  ): string | null {
    if (row.status !== 'active') return null;

    const positiveRules = parseJson<string[]>(row.positive_rules_json, []);
    const negativeRules = parseJson<string[]>(row.negative_rules_json, []);
    if (!positiveRules.length && !negativeRules.length) return null;

    const currentTime = now();
    const itemKey = row.scope_key;
    const itemValue = formatProfileStyleValue(scope, positiveRules, negativeRules);
    const evidenceRefs = parseJson<unknown[]>(row.evidence_json, []).slice(-20);
    const existing = this.db
      .prepare(
        `SELECT id, evidence_refs, mention_count
           FROM user_profile_items
          WHERE item_key = ?
            AND status IN ('active', 'pending_confirm')
          ORDER BY user_confirmed DESC, updated_at DESC
          LIMIT 1`,
      )
      .get(itemKey) as ProfileItemRow | undefined;
    const confidence = clamp(row.confidence, 0.5, 0.94);
    const fingerprint = contentHash(
      `${itemKey.toLowerCase().trim()}:${itemValue.toLowerCase().trim()}`,
    );

    if (existing) {
      const mergedEvidence = mergeProfileEvidence(existing.evidence_refs, evidenceRefs);
      this.db
        .prepare(
          `UPDATE user_profile_items
              SET item_value = ?,
                  evidence_refs = ?,
                  source_kind = 'system',
                  confidence = ?,
                  user_confirmed = 1,
                  status = 'active',
                  salience_score = ?,
                  mention_count = ?,
                  last_seen = ?,
                  updated_at = ?,
                  fingerprint = ?
            WHERE id = ?`,
        )
        .run(
          itemValue,
          mergedEvidence.length ? JSON.stringify(mergedEvidence) : null,
          confidence,
          confidence,
          Math.max(existing.mention_count, evidenceRefs.length),
          currentTime,
          currentTime,
          fingerprint,
          existing.id,
        );
      this.markProfileDirty();
      this.linkProfileItem(row.id, existing.id);
      return existing.id;
    }

    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO user_profile_items
          (id, item_type, item_key, item_value, evidence_refs, source_kind,
           confidence, user_confirmed, status, salience_score, mention_count,
           last_seen, valid_from, valid_to, created_at, updated_at, fingerprint)
         VALUES (?, 'preference', ?, ?, ?, 'system', ?, 1, 'active', ?, ?, ?, null, null, ?, ?, ?)`,
      )
      .run(
        id,
        itemKey,
        itemValue,
        evidenceRefs.length ? JSON.stringify(evidenceRefs) : null,
        confidence,
        confidence,
        Math.max(1, evidenceRefs.length),
        currentTime,
        currentTime,
        currentTime,
        fingerprint,
      );

    this.markProfileDirty();
    this.linkProfileItem(row.id, id);
    return id;
  }

  private markProfileDirty(): void {
    try {
      this.db
        .prepare(
          `UPDATE profile_sync_state
              SET profile_dirty = 1
            WHERE id = 'singleton'`,
        )
        .run();
    } catch {
      // Older test schemas or partial databases can skip the dirty marker.
    }
  }

  private linkProfileItem(memoryId: string, profileItemId: string): void {
    this.db
      .prepare(
        `UPDATE user_writing_style_memories
            SET promoted_profile_item_id = ?
          WHERE id = ?`,
      )
      .run(profileItemId, memoryId);
  }
}

function buildStyleRules(trace: AmbientWritingStyleTrace): StyleRules {
  const redactedDiff = trace.redactedDiff ?? {};
  const metadata = trace.metadata ?? {};
  const features = uniqueStrings([
    ...readStringArray(redactedDiff.styleFeatureTags),
    ...readStringArray(redactedDiff.toneShiftTags),
    ...readStringArray(redactedDiff.formatShiftTags),
    ...readStringArray(redactedDiff.recipientReactionTags),
    ...readStringArray(metadata.styleFeatureTags),
    ...readStringArray(metadata.recipientReactionTags),
    ...readStringArray(metadata.reactionTags),
  ]);

  if (
    trace.action === 'downstream_reaction' &&
    String(metadata.reactionKind || '').toLowerCase() === 'ai_tone_called_out'
  ) {
    features.push('ai_tone_called_out');
  }
  if (redactedDiff.semanticRelation === 'same_intent_shorter_form') {
    features.push('same_intent_shorter_form');
  }

  const positiveRules: string[] = [];
  const negativeRules: string[] = [];
  const preferenceKinds: string[] = [];

  for (const feature of uniqueStrings(features)) {
    const rule = FEATURE_RULES[feature];
    if (!rule) continue;
    if (rule.positive) positiveRules.push(rule.positive);
    if (rule.negative) negativeRules.push(rule.negative);
    if (rule.preferenceKind) preferenceKinds.push(rule.preferenceKind);
  }

  if (!positiveRules.length && !negativeRules.length) {
    return {
      preferenceKind: 'relationship_voice',
      positiveRules: [],
      negativeRules: [],
      features: [],
    };
  }

  return {
    preferenceKind: pickPreferenceKind(preferenceKinds),
    positiveRules: uniqueStrings(positiveRules),
    negativeRules: uniqueStrings(negativeRules),
    features: uniqueStrings(features),
  };
}

function buildStyleScopes(trace: AmbientWritingStyleTrace): StyleScope[] {
  const metadata = trace.metadata ?? {};
  const surface = normalizeSurface(
    readString(metadata.nativeSurface) ||
      readString(metadata.surface) ||
      inferSurfaceFromSceneKey(trace.sceneKey),
  );
  const taskKind = normalizeTaskKind(
    readString(metadata.taskKind) ||
      readString(metadata.scenario) ||
      readString(metadata.contextType),
  );
  const language =
    normalizeToken(readString(metadata.language)) ||
    inferLanguageFromStyle(trace);
  const audienceType =
    normalizeAudienceType(readString(metadata.audienceType)) ||
    normalizeAudienceType(readString(metadata.relationshipHint)) ||
    inferAudienceType(surface);
  const personIds = readStringArray(metadata.personIds);
  const relationshipKey = readString(metadata.relationshipKey);
  if (relationshipKey) personIds.push(relationshipKey);
  const groupIds = readStringArray(metadata.groupIds);
  const groupId = readString(metadata.groupId);
  if (groupId) groupIds.push(groupId);

  const scopes: StyleScope[] = [];
  scopes.push({
    scopeKey: buildScopeKey({
      surface,
      audienceType,
      taskKind,
      language,
    }),
    scopeLevel: 'audience',
    surface,
    audienceType,
    personIds: [],
    groupIds: [],
    taskKind,
    language,
  });

  if (personIds.length) {
    scopes.push({
      scopeKey: buildScopeKey({
        surface,
        audienceType,
        taskKind,
        language,
        suffix: `person_${stableSlug(personIds[0])}`,
      }),
      scopeLevel: 'relationship',
      surface,
      audienceType,
      personIds: uniqueStrings(personIds),
      groupIds: uniqueStrings(groupIds),
      taskKind,
      language,
    });
  }

  return dedupeScopes(scopes);
}

function buildScopeKey(args: {
  surface?: string;
  audienceType?: string;
  taskKind?: string;
  language?: string;
  suffix?: string;
}): string {
  return [
    'writing_style',
    args.surface || 'any_surface',
    args.audienceType || 'any_audience',
    args.taskKind || 'any_task',
    args.language || 'any_language',
    args.suffix,
  ]
    .filter(Boolean)
    .join('.');
}

function buildEvidence(
  trace: AmbientWritingStyleTrace,
  scope: StyleScope,
): Record<string, unknown> {
  return {
    traceId: trace.id,
    action: trace.action,
    polarity: trace.polarity,
    strength: trace.strength,
    sceneKey: trace.sceneKey,
    scopeKey: scope.scopeKey,
    evidenceRefs: (trace.evidenceRefs ?? []).slice(0, 8).map((ref) => ({
      id: ref.id,
      type: ref.type,
      title: ref.title,
      role: ref.role,
    })),
    observedAt: toSeconds(trace.createdAt || Date.now()),
  };
}

function mergeEvidence(
  rawExisting: string | undefined,
  incoming: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const existing = parseJson<Array<Record<string, unknown>>>(rawExisting, []);
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of existing) {
    const key = String(item.traceId || JSON.stringify(item));
    byId.set(key, item);
  }
  byId.set(String(incoming.traceId || JSON.stringify(incoming)), incoming);
  return Array.from(byId.values()).slice(-MAX_EVIDENCE);
}

function mergeFeatureCounts(
  rawExisting: string | undefined,
  features: string[],
): Record<string, number> {
  const counts = parseJson<Record<string, number>>(rawExisting, {});
  for (const feature of features) {
    counts[feature] = (counts[feature] ?? 0) + 1;
  }
  return counts;
}

function mergeProfileEvidence(
  rawExisting: string | null,
  incoming: unknown[],
): unknown[] {
  const existing = parseJson<unknown[]>(rawExisting ?? undefined, []);
  const values = [...existing, ...incoming];
  const seen = new Set<string>();
  const result: unknown[] = [];
  for (const value of values) {
    const key = JSON.stringify(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result.slice(-50);
}

function computeConfidence(
  evidenceCount: number,
  featureCounts: Record<string, number>,
): number {
  const featureTotal = Object.values(featureCounts).reduce(
    (sum, value) => sum + value,
    0,
  );
  const aiToneBonus = (featureCounts.ai_tone_called_out ?? 0) > 0 ? 0.1 : 0;
  const confidence =
    0.42 +
    Math.min(evidenceCount, 5) * 0.11 +
    Math.min(featureTotal, 8) * 0.015 +
    aiToneBonus;
  return Number(clamp(confidence, 0.45, 0.92).toFixed(3));
}

function shouldPromote(
  evidenceCount: number,
  featureCounts: Record<string, number>,
  confidence: number,
): boolean {
  const repeatedAiTone = (featureCounts.ai_tone_called_out ?? 0) >= 2;
  return (
    (evidenceCount >= ACTIVE_EVIDENCE_THRESHOLD &&
      confidence >= ACTIVE_CONFIDENCE_THRESHOLD) ||
    repeatedAiTone
  );
}

function formatProfileStyleValue(
  scope: StyleScope,
  positiveRules: string[],
  negativeRules: string[],
): string {
  const label = [
    scope.language === 'zh' ? '中文' : scope.language,
    scope.surface === 'ringcentral' ? 'RingCentral' : scope.surface,
    scope.audienceType === 'peer' ? 'peer 同事' : scope.audienceType,
    formatTaskKind(scope.taskKind),
  ]
    .filter(Boolean)
    .join(' ');
  const positive = positiveRules.length
    ? `可采用：${positiveRules.join('；')}`
    : '';
  const negative = negativeRules.length
    ? `避免：${negativeRules.join('；')}`
    : '';
  return `${label || '写作风格'}：${[positive, negative]
    .filter(Boolean)
    .join('。')}`;
}

function formatTaskKind(value?: string): string | undefined {
  if (!value) return undefined;
  if (value === 'casual_reply') return '轻松回复';
  if (value === 'status_update') return '状态同步';
  if (value === 'jira_comment') return 'Jira 评论';
  if (value === 'thread_reply') return 'thread 回复';
  return value;
}

function pickPreferenceKind(values: string[]): string {
  const ordered = [
    'anti_ai_style',
    'relationship_voice',
    'tone',
    'structure',
    'punctuation',
    'length',
  ];
  for (const item of ordered) {
    if (values.includes(item)) return item;
  }
  return values[0] || 'relationship_voice';
}

function normalizeSurface(value?: string): string | undefined {
  const token = normalizeToken(value);
  if (!token) return undefined;
  if (token.includes('ringcentral')) return 'ringcentral';
  if (token.includes('jira')) return 'jira';
  if (token.includes('docs')) return 'docs';
  if (token.includes('chatgpt') || token.includes('gemini')) return 'ai_chat';
  return token;
}

function inferSurfaceFromSceneKey(sceneKey: string): string | undefined {
  if (/ringcentral/i.test(sceneKey)) return 'ringcentral';
  if (/jira/i.test(sceneKey)) return 'jira';
  return undefined;
}

function normalizeTaskKind(value?: string): string | undefined {
  const token = normalizeToken(value);
  if (!token) return undefined;
  if (token === 'instant_message_reply' || token === 'message_thread') {
    return 'casual_reply';
  }
  if (token === 'thread_reply') return 'thread_reply';
  if (token === 'jira_comment' || token === 'jira_issue') return 'jira_comment';
  if (token.includes('status')) return 'status_update';
  return token;
}

function normalizeAudienceType(value?: string): string | undefined {
  const token = normalizeToken(value);
  if (!token) return undefined;
  if (/peer|colleague|同事/.test(token)) return 'peer';
  if (/manager|lead|老板|上级/.test(token)) return 'manager';
  if (/external|client|customer|客户/.test(token)) return 'external';
  return token;
}

function inferAudienceType(surface?: string): string | undefined {
  return surface === 'ringcentral' ? 'peer' : undefined;
}

function inferLanguageFromStyle(trace: AmbientWritingStyleTrace): string {
  const text = JSON.stringify({
    redactedDiff: trace.redactedDiff ?? {},
    metadata: trace.metadata ?? {},
  });
  if (/haha|tilde|哈哈|中文|zh/i.test(text)) return 'zh';
  return 'mixed';
}

function dedupeScopes(scopes: StyleScope[]): StyleScope[] {
  const seen = new Set<string>();
  return scopes.filter((scope) => {
    if (seen.has(scope.scopeKey)) return false;
    seen.add(scope.scopeKey);
    return true;
  });
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeToken(value?: string): string | undefined {
  if (!value) return undefined;
  const token = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\u4e00-\u9fff]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return token || undefined;
}

function stableSlug(value: string): string {
  return (
    normalizeToken(value)?.slice(0, 80) ||
    contentHash(value).slice(0, 12)
  );
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function mergeStrings(left: string[], right: string[]): string[] {
  return uniqueStrings([...left, ...right]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toSeconds(timestamp: number): number {
  return timestamp > 10_000_000_000
    ? Math.floor(timestamp / 1000)
    : Math.floor(timestamp);
}
