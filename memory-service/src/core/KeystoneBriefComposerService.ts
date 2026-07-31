import type Database from 'better-sqlite3';

import type {
  KeystoneBrief,
  KeystoneBriefAuthority,
  KeystoneBriefClaim,
  KeystoneBriefSceneAnchors,
  KeystoneBriefSourceRef,
  KeystoneBriefSubjectType,
} from '../types/index.js';
import { now } from '../utils/time.js';
import { getLLMClient } from '../llm/LLMClient.js';
import {
  KeystoneBriefService,
  type UpsertKeystoneBriefInput,
} from './KeystoneBriefService.js';

interface ReflectionSeedRow {
  id: string;
  topic_key: string;
  title: string;
  priority: number;
  salience: number;
  current_hypothesis: string | null;
  open_questions_json: string | null;
  latest_summary: string | null;
  metadata_json: string | null;
  updated_at: number;
}

interface EvidenceRow {
  id: string;
  content: string;
  summary: string | null;
  source_type: string;
  source_url: string | null;
  source_title: string | null;
  sender: string | null;
  group_id: string | null;
  group_name: string | null;
  timestamp: number;
  entities_json: string | null;
  matched_projects_json: string | null;
  metadata_json: string | null;
  importance: number;
  scope: string | null;
}

interface SubjectSeed {
  key: string;
  label: string;
  subjectType: KeystoneBriefSubjectType;
  priority: number;
  thread: ReflectionSeedRow;
}

export interface KeystoneBriefComposerRunSummary {
  scannedThreads: number;
  discoveredSubjects: number;
  eligibleSubjects: number;
  composed: number;
  ready: number;
  partial: number;
  stale: number;
  candidate: number;
  skippedUnchanged: number;
  skippedProtected: number;
  skippedInsufficientEvidence: number;
  failed: number;
  briefIds: string[];
  errors: string[];
}

interface ComposerOptions {
  maxBriefs?: number;
  scanThreads?: number;
  lookbackDays?: number;
}

type KeystoneBriefOutputLanguage = 'zh-CN' | 'en-US';

interface KeystoneBriefLocalizedContent {
  summary: string;
  claims: string[];
  openQuestions: string[];
}

interface KeystoneBriefLocalizationInput extends KeystoneBriefLocalizedContent {
  language: KeystoneBriefOutputLanguage;
  subjectLabel: string;
}

type KeystoneBriefLocalizer = (
  input: KeystoneBriefLocalizationInput,
) => Promise<KeystoneBriefLocalizedContent>;

const AUTO_COMPOSITION_VERSION = 'auto-reflection-grounded-v2';
const DEFAULT_MAX_BRIEFS = 2;
const DEFAULT_SCAN_THREADS = 80;
const DEFAULT_LOOKBACK_DAYS = 180;
const MAX_EVIDENCE = 8;
const BRIEF_FRESHNESS_SECONDS = 90 * 86400;
const MIN_EVIDENCE_TEXT = 36;

const GENERIC_ANCHORS = new Set([
  'action',
  'actions',
  'current',
  'decision',
  'estimate',
  'fact',
  'follow',
  'message',
  'nova',
  'project',
  'reflection',
  'ringcentral',
  'status',
  'summary',
  'team',
  'thread',
  'update',
]);

const THREAD_TITLE_PREFIX = /^(?:项目反思|实体反思|消息追踪|决策跟进|事实跟进|场景预演|reflection thread)\s*[:：]\s*/i;
const JIRA_KEY_PATTERN = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;
const SPECIFIC_PHRASE_PATTERNS = [
  /\b(?:Task|Original|DEV|QA|Epic)\s+Estimate\b/gi,
  /\bWhatsApp(?:\s+Business\s+API)?\b/gi,
  /\b(?:RingCX|OpenClaw|Baileys|Hermes|Story\s+Points?)\b/gi,
];

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanText(value: unknown, maxLength = 260): string {
  if (typeof value !== 'string') return '';
  const text = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(1, maxLength - 1)).trim()}…`;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
  );
}

function normalizedAnchor(value: string): string {
  return value
    .trim()
    .replace(/[：:，,。.;；!?！？()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isUsefulAnchor(value: string): boolean {
  const normalized = normalizedAnchor(value);
  if (normalized.length < 3 || normalized.length > 80) return false;
  return !GENERIC_ANCHORS.has(normalized);
}

function sourceAuthority(sourceType: string): KeystoneBriefAuthority {
  const normalized = sourceType.toLowerCase();
  if (normalized.includes('jira')) return 'jira';
  if (normalized.includes('meeting') || normalized.includes('calendar')) {
    return 'meeting';
  }
  if (normalized.includes('source_memory') || normalized === 'web') {
    return 'source_memory';
  }
  if (normalized.includes('reflection')) return 'reflection';
  if (normalized.includes('dream') || normalized.includes('ai')) return 'derived';
  return 'direct_message';
}

function sourceUrlFromRow(row: EvidenceRow): string | undefined {
  if (row.source_url?.trim()) return row.source_url.trim();
  const metadata = asRecord(parseJson(row.metadata_json, {}));
  const candidates = [metadata.groupUrl, metadata.url, metadata.sourceUrl];
  return candidates.find(
    (value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value),
  );
}

function excerptAround(value: string, needle: string, maxLength = 260): string {
  const index = value.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return cleanText(value, maxLength);
  const start = Math.max(0, index - 90);
  const end = Math.min(value.length, index + needle.length + 150);
  return cleanText(value.slice(start, end), maxLength);
}

function sourceText(row: EvidenceRow, subjectLabel?: string): string {
  const summary = cleanText(row.summary, 260);
  if (
    summary.length >= MIN_EVIDENCE_TEXT &&
    (!subjectLabel || summary.toLowerCase().includes(subjectLabel.toLowerCase()))
  ) {
    return summary;
  }
  return subjectLabel
    ? excerptAround(row.content, subjectLabel)
    : summary.length >= MIN_EVIDENCE_TEXT
      ? summary
      : cleanText(row.content, 260);
}

function rowDirectlyMentionsSubject(row: EvidenceRow, subject: SubjectSeed): boolean {
  const needle = subject.label.toLowerCase();
  return [row.content, row.summary, row.source_title, row.group_name]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
    .includes(needle);
}

function directSubjectSummary(row: EvidenceRow, subjectLabel: string): string {
  const summary = cleanText(row.summary, 260);
  return summary.length >= MIN_EVIDENCE_TEXT &&
    summary.toLowerCase().includes(subjectLabel.toLowerCase())
    ? summary
    : '';
}

function hasJiraSourceAnchor(row: EvidenceRow, jiraKey: string): boolean {
  if (row.source_type.toLowerCase().includes('jira')) return true;
  const escapedKey = jiraKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const jiraBrowsePattern = new RegExp(`/browse/${escapedKey}(?:\\b|[/?#])`, 'i');
  return jiraBrowsePattern.test(row.source_url || '') ||
    jiraBrowsePattern.test(row.content) ||
    new RegExp(`^${escapedKey}\\b`, 'i').test(row.source_title || '');
}

function rowRef(row: EvidenceRow): string {
  return `${row.source_type}:${row.id}`;
}

function sourceSignature(rows: EvidenceRow[]): string {
  return rows
    .map((row) => `${rowRef(row)}@${row.timestamp}`)
    .sort()
    .join('|');
}

function existingSignature(brief: KeystoneBrief): string {
  return brief.sourceMap
    .map((source) => `${source.ref}@${source.timestamp ?? 0}`)
    .sort()
    .join('|');
}

function resolveOutputLanguage(db: Database.Database): KeystoneBriefOutputLanguage {
  const row = db
    .prepare(
      `SELECT item_value
       FROM user_profile_items
       WHERE status = 'active' AND item_key = 'language_preference'
       ORDER BY user_confirmed DESC, updated_at DESC
       LIMIT 1`,
    )
    .get() as { item_value: string } | undefined;
  return /english|英文|en-us|\ben\b/i.test(row?.item_value || '')
    ? 'en-US'
    : 'zh-CN';
}

async function localizeBriefContentWithLlm(
  input: KeystoneBriefLocalizationInput,
): Promise<KeystoneBriefLocalizedContent> {
  const targetLanguage = input.language === 'en-US' ? 'English' : 'Simplified Chinese';
  const result = await getLLMClient().generateJSON<KeystoneBriefLocalizedContent>(
    JSON.stringify({
      subjectLabel: input.subjectLabel,
      summary: input.summary,
      claims: input.claims,
      openQuestions: input.openQuestions,
    }),
    {
      scenario: 'summary',
      temperature: 0.1,
      maxTokens: 1200,
      timeoutMs: 20_000,
      retryCount: 0,
      systemPrompt: [
        `Translate all user-facing prose in the supplied JSON into ${targetLanguage}.`,
        'Return JSON only with exactly these keys: summary, claims, openQuestions.',
        'Preserve array length and ordering. Do not add, remove, infer, summarize, or change any fact.',
        'Preserve names, product names, group names, URLs, IDs, Jira keys, numbers, and quoted source terms in their original language.',
      ].join(' '),
    },
  );
  if (
    !cleanText(result.summary, 2000) ||
    !Array.isArray(result.claims) ||
    result.claims.length !== input.claims.length ||
    !Array.isArray(result.openQuestions) ||
    result.openQuestions.length !== input.openQuestions.length
  ) {
    throw new Error('keystone_brief_localization_invalid');
  }
  return {
    summary: cleanText(result.summary, 360),
    claims: result.claims.map((value) => cleanText(value, 260)),
    openQuestions: result.openQuestions.map((value) => cleanText(value, 180)),
  };
}

export class KeystoneBriefComposerService {
  private readonly briefService: KeystoneBriefService;

  constructor(
    private readonly db: Database.Database,
    private readonly localizeBriefContent: KeystoneBriefLocalizer = localizeBriefContentWithLlm,
  ) {
    this.briefService = new KeystoneBriefService(db);
  }

  async run(options: ComposerOptions = {}): Promise<KeystoneBriefComposerRunSummary> {
    const maxBriefs = Math.max(
      1,
      Math.min(options.maxBriefs ?? DEFAULT_MAX_BRIEFS, 10),
    );
    const scanThreads = Math.max(
      maxBriefs,
      Math.min(options.scanThreads ?? DEFAULT_SCAN_THREADS, 250),
    );
    const lookbackDays = Math.max(
      30,
      Math.min(options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS, 730),
    );
    const summary: KeystoneBriefComposerRunSummary = {
      scannedThreads: 0,
      discoveredSubjects: 0,
      eligibleSubjects: 0,
      composed: 0,
      ready: 0,
      partial: 0,
      stale: 0,
      candidate: 0,
      skippedUnchanged: 0,
      skippedProtected: 0,
      skippedInsufficientEvidence: 0,
      failed: 0,
      briefIds: [],
      errors: [],
    };

    const threads = this.loadReflectionSeeds(scanThreads);
    const outputLanguage = resolveOutputLanguage(this.db);
    const compositionVersion = `${AUTO_COMPOSITION_VERSION}-${outputLanguage}`;
    summary.scannedThreads = threads.length;
    const subjects = this.discoverSubjects(threads);
    summary.discoveredSubjects = subjects.length;
    const claimedEvidenceSignatures = new Set(
      this.briefService
        .list({ includeHidden: true, limit: 500 })
        .map((brief) => existingSignature(brief)),
    );

    for (const subject of subjects) {
      if (summary.composed >= maxBriefs) break;
      try {
        const evidence = this.loadEvidence(subject, lookbackDays);
        if (evidence.length < 2) {
          summary.skippedInsufficientEvidence += 1;
          continue;
        }
        summary.eligibleSubjects += 1;
        const evidenceSignature = sourceSignature(evidence);
        const existing = this.briefService.getByBriefKey(subject.key);
        if (
          existing &&
          (existing.status === 'hidden' ||
            (existing.status === 'blocked' && existing.repairState === 'needs_repair'))
        ) {
          summary.skippedProtected += 1;
          claimedEvidenceSignatures.add(evidenceSignature);
          continue;
        }
        if (
          existing &&
          !existing.compositionVersion.startsWith('auto-')
        ) {
          summary.skippedProtected += 1;
          claimedEvidenceSignatures.add(evidenceSignature);
          continue;
        }
        if (
          existing &&
          existingSignature(existing) === evidenceSignature &&
          existing.compositionVersion === compositionVersion
        ) {
          summary.skippedUnchanged += 1;
          continue;
        }
        if (!existing && claimedEvidenceSignatures.has(evidenceSignature)) {
          summary.skippedUnchanged += 1;
          continue;
        }

        const brief = this.briefService.upsertComposedCandidate(
          await this.composeInput(subject, evidence, outputLanguage),
        );
        summary.composed += 1;
        claimedEvidenceSignatures.add(evidenceSignature);
        summary.briefIds.push(brief.id);
        if (brief.status === 'ready') summary.ready += 1;
        else if (brief.status === 'partial') summary.partial += 1;
        else if (brief.status === 'stale') summary.stale += 1;
        else summary.candidate += 1;
      } catch (error) {
        summary.failed += 1;
        summary.errors.push(
          `${subject.key}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return summary;
  }

  private loadReflectionSeeds(limit: number): ReflectionSeedRow[] {
    return this.db
      .prepare(
        `SELECT id, topic_key, title, priority, salience, current_hypothesis,
                open_questions_json, latest_summary, metadata_json, updated_at
         FROM reflection_threads
         WHERE status IN ('active', 'paused')
           AND (latest_summary IS NOT NULL OR current_hypothesis IS NOT NULL)
         ORDER BY priority DESC, salience DESC, updated_at DESC
         LIMIT ?`,
      )
      .all(limit) as ReflectionSeedRow[];
  }

  private discoverSubjects(threads: ReflectionSeedRow[]): SubjectSeed[] {
    const bestByKey = new Map<string, SubjectSeed>();
    for (const thread of threads) {
      for (const subject of this.subjectsForThread(thread)) {
        const existing = bestByKey.get(subject.key);
        if (!existing || subject.priority > existing.priority) {
          bestByKey.set(subject.key, subject);
        }
      }
    }
    return Array.from(bestByKey.values()).sort((a, b) => b.priority - a.priority);
  }

  private subjectsForThread(thread: ReflectionSeedRow): SubjectSeed[] {
    const text = [
      thread.title.replace(THREAD_TITLE_PREFIX, ''),
      thread.latest_summary,
      thread.current_hypothesis,
      thread.topic_key,
    ]
      .filter(Boolean)
      .join('\n');
    const subjects: SubjectSeed[] = [];
    const jiraKeys = uniqueStrings(text.match(JIRA_KEY_PATTERN) ?? []);
    for (const jiraKey of jiraKeys.slice(0, 3)) {
      subjects.push({
        key: `jira:${jiraKey.toUpperCase()}`,
        label: jiraKey.toUpperCase(),
        subjectType: 'jira_issue',
        priority: 100 + thread.priority + thread.salience,
        thread,
      });
    }

    const phrases: string[] = [];
    for (const pattern of SPECIFIC_PHRASE_PATTERNS) {
      phrases.push(...(text.match(pattern) ?? []));
    }
    const projectName = this.resolveProjectName(thread.topic_key);
    if (projectName) phrases.push(projectName);
    for (const phrase of uniqueStrings(phrases).slice(0, 4)) {
      if (!isUsefulAnchor(phrase)) continue;
      const canonicalLabel = /whatsapp/i.test(phrase)
        ? 'WhatsApp'
        : /story\s+points?/i.test(phrase)
          ? 'Story Points'
          : phrase;
      const normalized = normalizedAnchor(canonicalLabel);
      const subjectType: KeystoneBriefSubjectType = /estimate|whatsapp|workflow/i.test(
        phrase,
      )
        ? 'workflow'
        : projectName && normalized === normalizedAnchor(projectName)
          ? 'project'
          : 'topic';
      subjects.push({
        key: `${subjectType}:${normalized}`,
        label: canonicalLabel,
        subjectType,
        priority: 50 + thread.priority + thread.salience,
        thread,
      });
    }
    return subjects;
  }

  private resolveProjectName(topicKey: string): string | undefined {
    if (!topicKey.startsWith('project:')) return undefined;
    const id = topicKey.slice('project:'.length);
    const row = this.db
      .prepare('SELECT name FROM watched_projects WHERE id = ?')
      .get(id) as { name: string } | undefined;
    return row?.name?.trim() || undefined;
  }

  private loadEvidence(subject: SubjectSeed, lookbackDays: number): EvidenceRow[] {
    const cutoff = now() - lookbackDays * 86400;
    const escaped = subject.label.replace(/[\\%_]/g, '\\$&');
    const like = `%${escaped}%`;
    const rows = this.db
      .prepare(
        `SELECT id, content, summary, source_type, source_url, source_title,
                sender, group_id, group_name, timestamp, entities_json,
                matched_projects_json, metadata_json, importance, scope
         FROM messages_raw
         WHERE timestamp >= ?
           AND COALESCE(scope, 'work') = 'work'
           AND (
             content LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR
             source_title LIKE ? ESCAPE '\\' OR metadata_json LIKE ? ESCAPE '\\'
           )
         ORDER BY importance DESC, timestamp DESC
         LIMIT 24`,
      )
      .all(cutoff, like, like, like, like) as EvidenceRow[];

    const result: EvidenceRow[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (
        seen.has(row.id) ||
        !rowDirectlyMentionsSubject(row, subject) ||
        sourceText(row, subject.label).length < MIN_EVIDENCE_TEXT
      ) {
        continue;
      }
      const authority = sourceAuthority(row.source_type);
      if (authority === 'reflection' || authority === 'derived') continue;
      seen.add(row.id);
      result.push(row);
      if (result.length >= MAX_EVIDENCE) break;
    }
    if (
      subject.subjectType === 'jira_issue' &&
      (!result.some((row) => directSubjectSummary(row, subject.label)) ||
        !result.some((row) => hasJiraSourceAnchor(row, subject.label)))
    ) {
      return [];
    }
    return result;
  }

  private async composeInput(
    subject: SubjectSeed,
    evidence: EvidenceRow[],
    outputLanguage: KeystoneBriefOutputLanguage,
  ): Promise<UpsertKeystoneBriefInput> {
    const sourceMap = evidence.map((row, index) => this.toSourceRef(row, index));
    const sourceRefs = new Set(sourceMap.map((source) => source.ref));
    const directEvidence = evidence.filter((row) =>
      directSubjectSummary(row, subject.label),
    );
    const claimEvidence = directEvidence.length ? directEvidence : evidence;
    const rawFacts = claimEvidence
      .map((row) => this.toClaim(row, subject.label))
      .filter((claim) => claim.text && claim.sourceRefs.every((ref) => sourceRefs.has(ref)))
      .slice(0, 4);
    const latestSourceAt = Math.max(...evidence.map((row) => row.timestamp));
    const expiresAt = latestSourceAt + BRIEF_FRESHNESS_SECONDS;
    const stale = expiresAt <= now();
    const directSummaries = evidence
      .map((row) => directSubjectSummary(row, subject.label))
      .filter(Boolean);
    const summaries = uniqueStrings(
      directSummaries.length
        ? directSummaries
        : evidence.map((row) => sourceText(row, subject.label)),
    ).slice(0, 2);
    const reflectionSummary = cleanText(subject.thread.latest_summary, 360);
    const summaryText = reflectionSummary
      .toLowerCase()
      .includes(subject.label.toLowerCase())
      ? reflectionSummary
      : cleanText(summaries.join('；'), 360);
    const rawOpenQuestions = parseJson<unknown[]>(
      subject.thread.open_questions_json,
      [],
    )
      .map((value) => cleanText(value, 180))
      .filter(Boolean)
      .slice(0, 4);
    const localized = await this.localizeBriefContent({
      language: outputLanguage,
      subjectLabel: subject.label,
      summary: summaryText || `${subject.label} has accumulated evidence from multiple sources.`,
      claims: rawFacts.map((claim) => claim.text),
      openQuestions: rawOpenQuestions,
    });
    const facts = rawFacts.map((claim, index) => ({
      ...claim,
      text: localized.claims[index] || claim.text,
    }));
    const english = outputLanguage === 'en-US';
    const people = uniqueStrings(evidence.map((row) => row.sender)).slice(0, 6);
    const sceneAnchors = this.buildSceneAnchors(subject, evidence);

    return {
      briefKey: subject.key,
      title: english ? `${subject.label} Keystone Brief` : `${subject.label} 关键简报`,
      subjectType: subject.subjectType,
      scope: 'work',
      status: stale ? 'stale' : 'ready',
      summary: localized.summary,
      sourceAsOf: latestSourceAt,
      freshness: {
        state: stale ? 'stale_risk' : 'watching',
        reason: stale
          ? english
            ? 'The newest source is outside the automatic brief freshness window; new evidence is required.'
            : '最新来源已超过自动简报有效期，需要新证据刷新'
          : english
            ? `${sourceMap.length} independent sources checked in the background`
            : `后台已核对 ${sourceMap.length} 条独立来源`,
        expiresAt,
      },
      slots: {
        whyItMatters: english
          ? `Multiple traceable sources have accumulated around ${subject.label}; review the synthesis first, then inspect the original memories.`
          : `围绕 ${subject.label} 已积累多条可回溯证据，可先看综合结论再下钻原始记忆。`,
        currentState: localized.summary || facts[0]?.text,
        stableFacts: facts,
        decisions: [],
        constraints: [],
        traps: [],
        peopleAndSources: people.map((name) => ({
          name,
          role: english ? 'Discussion participant' : '相关讨论参与人',
          sourceRefs: sourceMap
            .filter((source) => source.metadata?.sender === name)
            .map((source) => source.ref),
        })),
        nextUseCases: uniqueStrings([
          sceneAnchors.surfaces.includes('ringcentral_thread_reading')
            ? english ? 'RingCentral thread reading' : '阅读 RingCentral 会话'
            : undefined,
          sceneAnchors.jiraKeys.length
            ? english ? 'Jira issue reading' : '阅读 Jira 事项'
            : undefined,
          english ? 'Memory Lens passive recall' : 'Memory Lens 被动召回',
        ]),
        openQuestions: localized.openQuestions,
      },
      sourceMap,
      sceneAnchors,
      displayPolicy: {
        defaultMode: 'chip',
        maxLines: 8,
        canCopyToDraft: true,
        externalSummaryOnly: true,
      },
      compositionVersion: `${AUTO_COMPOSITION_VERSION}-${outputLanguage}`,
      inputSummary: sourceSignature(evidence),
      evaluationTags: ['automatic', 'reflection_seeded', 'source_grounded'],
    };
  }

  private toSourceRef(row: EvidenceRow, index: number): KeystoneBriefSourceRef {
    const authority = sourceAuthority(row.source_type);
    return {
      ref: rowRef(row),
      sourceType: row.source_type,
      sourceId: row.id,
      role: index === 0 ? 'authority' : 'supporting',
      title: row.source_title || row.group_name || row.sender || undefined,
      url: sourceUrlFromRow(row),
      timestamp: row.timestamp,
      authority,
      projection: 'summary_ok',
      hidden: false,
      snippet: cleanText(row.content, 260),
      metadata: {
        sender: row.sender ?? undefined,
        groupId: row.group_id ?? undefined,
        groupName: row.group_name ?? undefined,
        scope: row.scope ?? 'work',
      },
    };
  }

  private toClaim(row: EvidenceRow, subjectLabel: string): KeystoneBriefClaim {
    const authority = sourceAuthority(row.source_type);
    return {
      text: sourceText(row, subjectLabel),
      sourceRefs: [rowRef(row)],
      confidence: row.importance >= 0.75 ? 'high' : 'medium',
      authority,
      validAsOf: row.timestamp,
      staleRisk: now() - row.timestamp > 60 * 86400 ? 'medium' : 'low',
      projection: 'summary_ok',
      actor: row.sender ?? undefined,
    };
  }

  private buildSceneAnchors(
    subject: SubjectSeed,
    evidence: EvidenceRow[],
  ): KeystoneBriefSceneAnchors {
    const jiraKeys = uniqueStrings([
      ...(subject.label.match(JIRA_KEY_PATTERN) ?? []),
      ...evidence.flatMap((row) => row.content.match(JIRA_KEY_PATTERN) ?? []),
    ]).slice(0, 8);
    const projects = uniqueStrings([
      subject.subjectType === 'project' ? subject.label : undefined,
      ...evidence.flatMap((row) =>
        parseJson<unknown[]>(row.matched_projects_json, []).map((value) =>
          typeof value === 'string' ? value : undefined,
        ),
      ),
      ...evidence.map((row) => row.group_name),
    ]).slice(0, 8);
    const people = uniqueStrings(evidence.map((row) => row.sender)).slice(0, 8);
    const surfaces = uniqueStrings([
      evidence.some((row) => row.group_id || row.source_type === 'glip')
        ? 'ringcentral_thread_reading'
        : undefined,
      jiraKeys.length || evidence.some((row) => row.source_type.includes('jira'))
        ? 'jira_field_inspection'
        : undefined,
      evidence.some((row) => row.source_type === 'web') ? 'web_reading' : undefined,
    ]);
    return {
      projects,
      jiraKeys: jiraKeys.map((key) => key.toUpperCase()),
      people,
      topics: uniqueStrings([subject.label]),
      surfaces,
    };
  }
}
