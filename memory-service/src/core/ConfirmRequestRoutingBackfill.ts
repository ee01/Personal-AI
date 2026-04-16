import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';

import { ConfirmRequestRepository } from '../repositories/ConfirmRequestRepository.js';
import { now } from '../utils/time.js';

interface LegacyConfirmRequestRow {
  id: string;
  question: string;
  context: string | null;
  evidence_refs_json: string | null;
  category: string | null;
  related_entity_id: string | null;
  priority: string | null;
  state: string;
  routing: string | null;
  reason_code: string | null;
  source_anchor: string | null;
  gap_type: string | null;
  snooze_until: number | null;
  expires_at: number | null;
  created_at: number;
  updated_at: number | null;
}

export interface LegacyConfirmRoutingBackfillOptions {
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  currentTime?: number;
}

export interface LegacyConfirmRoutingBackfillSummary {
  dryRun: boolean;
  force: boolean;
  scanned: number;
  updated: number;
  backfilledDedupeKeys: number;
  dedupeSummary?: ReturnType<ConfirmRequestRepository['dedupePendingRequests']>;
  before: {
    decisionPending: number;
    watchPending: number;
    watchSnoozed: number;
    legacyPending: number;
  };
  after: {
    decisionPending: number;
    watchPending: number;
    watchSnoozed: number;
    legacyPending: number;
  };
  samples: Array<{
    id: string;
    question: string;
    fromRouting: string | null;
    fromState: string;
    toRouting: 'decision' | 'watch';
    toState: 'pending' | 'snoozed';
    reasonCode: string;
    sourceAnchor: string;
    gapType: string;
  }>;
}

type LegacyClassification = {
  routing: 'decision' | 'watch';
  state: 'pending' | 'snoozed';
  reasonCode:
    | 'authority_required'
    | 'approval_required'
    | 'future_monitoring'
    | 'owner_eta_gap'
    | 'artifact_gap';
  gapType: 'decision_blocker' | 'future_monitoring' | 'owner_eta' | 'artifact_check';
  sourceAnchor: string;
};

const APPROVAL_PATTERN =
  /审批|批准|授权|approval|approve|permission|决定怎么做|帮我决定|should we|是否要|选方向/iu;
const FUTURE_MONITORING_PATTERN =
  /会不会|是否会|未来|接下来|有没有计划|是否有计划|迁移|重命名|调整|变化|变更|roadmap|plan|rename|migrate|change/iu;
const OWNER_ETA_PATTERN =
  /负责人|owner|eta|时间表|上线时间|何时|什么时候|进展|deadline|due date|排期|发布日期|时间点/iu;
const ARTIFACT_PATTERN =
  /release note|release notes|文档|链接|sheet|spreadsheet|ticket|issue|artifact|历史记录|历史案例|history|record|记录/iu;

const TOPIC_NOISE_PATTERNS = [
  /请确认/giu,
  /是否会/giu,
  /是否有/giu,
  /会不会/giu,
  /未来/giu,
  /近期/giu,
  /后续/giu,
  /有没有计划/giu,
  /有计划/giu,
  /变更计划/giu,
  /发生变化/giu,
  /如有/giu,
  /预计/giu,
  /时间和内容是什么/giu,
  /时间和原因是什么/giu,
  /具体/giu,
  /何时/giu,
  /什么时候/giu,
  /是否存在/giu,
  /可能/giu,
  /计划/giu,
  /继续保持/giu,
];

const TOPIC_STOP_WORDS = new Set([
  'will',
  'there',
  'any',
  'future',
  'planned',
  'plan',
  'plans',
  'change',
  'changes',
  'changing',
  'update',
  'updates',
  'upcoming',
  'continue',
  'timeline',
  'owner',
  'eta',
  'future_monitoring',
  'question',
  'details',
  'detail',
  'what',
  'when',
  'why',
  'how',
  '是否',
  '未来',
  '近期',
  '后续',
  '计划',
  '确认',
  '具体',
  '变更',
  '变化',
  '调整',
  '可能',
  '继续',
  '时间',
  '时间表',
  '负责人',
  '进展',
  '功能',
  '开发',
  '原因',
  '说明',
  '项目',
  '当前',
  '是否有',
  '是否会',
]);

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeTopicText(value: string): string {
  let normalized = value.normalize('NFKC').toLowerCase();
  for (const pattern of TOPIC_NOISE_PATTERNS) {
    normalized = normalized.replace(pattern, ' ');
  }
  return normalized.replace(/[^\p{L}\p{N}\s:_-]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function buildQuestionTopicAnchor(question: string, context: string | null): string {
  const normalized = normalizeTopicText([question, context ?? ''].filter(Boolean).join('\n'));
  const tokens =
    normalized.match(/[a-z0-9][a-z0-9._:-]{1,}|[\u4e00-\u9fff]{2,}/giu) ?? [];
  const unique = Array.from(
    new Set(
      tokens
        .map((item) => item.toLowerCase())
        .filter((item) => item.length >= 2 && !TOPIC_STOP_WORDS.has(item)),
    ),
  ).slice(0, 4);
  if (unique.length === 0) {
    const digest = createHash('sha1').update(question).digest('hex').slice(0, 12);
    return `topic:${digest}`;
  }
  return `topic:${unique.join('-').slice(0, 96)}`;
}

function inferSourceAnchor(row: LegacyConfirmRequestRow): string {
  if (row.related_entity_id?.trim()) {
    return `entity:${row.related_entity_id.trim()}`;
  }

  const evidenceRefs = safeJsonParse<string[]>(row.evidence_refs_json, []);
  const preferredPrefixes = [
    'reflection_thread:',
    'ask:',
    'ask_request:',
    'outreach:',
    'outreach_session:',
    'entity_property:',
    'entity:',
  ];
  for (const prefix of preferredPrefixes) {
    const match = evidenceRefs.find((ref) => ref.startsWith(prefix));
    if (match) {
      return match.replace(/^ask_request:/, 'ask:').replace(/^outreach_session:/, 'outreach:');
    }
  }

  return buildQuestionTopicAnchor(row.question, row.context);
}

function classifyLegacyRow(row: LegacyConfirmRequestRow): LegacyClassification {
  const combined = [row.question, row.context ?? ''].filter(Boolean).join('\n');
  const sourceAnchor = inferSourceAnchor(row);

  if (APPROVAL_PATTERN.test(combined)) {
    return {
      routing: 'decision',
      state: 'pending',
      reasonCode: 'authority_required',
      gapType: 'decision_blocker',
      sourceAnchor,
    };
  }
  if (OWNER_ETA_PATTERN.test(combined)) {
    return {
      routing: 'watch',
      state: 'snoozed',
      reasonCode: 'owner_eta_gap',
      gapType: 'owner_eta',
      sourceAnchor,
    };
  }
  if (FUTURE_MONITORING_PATTERN.test(combined)) {
    return {
      routing: 'watch',
      state: 'snoozed',
      reasonCode: 'future_monitoring',
      gapType: 'future_monitoring',
      sourceAnchor,
    };
  }
  if (ARTIFACT_PATTERN.test(combined)) {
    return {
      routing: 'watch',
      state: 'snoozed',
      reasonCode: 'artifact_gap',
      gapType: 'artifact_check',
      sourceAnchor,
    };
  }

  return {
    routing: 'watch',
    state: 'snoozed',
    reasonCode: 'future_monitoring',
    gapType: 'future_monitoring',
    sourceAnchor,
  };
}

function countLegacyPending(db: Database.Database): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM confirm_requests
       WHERE category = 'evidence_resolution'
         AND state = 'pending'
         AND routing IS NULL`,
    )
    .get() as { count: number };
  return row.count;
}

function buildSnapshot(
  db: Database.Database,
  repo: ConfirmRequestRepository,
): LegacyConfirmRoutingBackfillSummary['before'] {
  return {
    decisionPending: repo.countByRoutingAndState('decision', 'pending'),
    watchPending: repo.countByRoutingAndState('watch', 'pending'),
    watchSnoozed: repo.countByRoutingAndState('watch', 'snoozed'),
    legacyPending: countLegacyPending(db),
  };
}

export function reclassifyLegacyEvidenceResolutionConfirmRequests(
  db: Database.Database,
  options: LegacyConfirmRoutingBackfillOptions = {},
): LegacyConfirmRoutingBackfillSummary {
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const currentTime = options.currentTime ?? now();
  const repo = new ConfirmRequestRepository(db);
  const before = buildSnapshot(db, repo);

  const rows = db
    .prepare(
      `SELECT id, question, context, evidence_refs_json, category, related_entity_id, priority,
              state, routing, reason_code, source_anchor, gap_type, snooze_until, expires_at,
              created_at, updated_at
       FROM confirm_requests
       WHERE category = 'evidence_resolution'
         AND priority = 'normal'
         AND state IN ('pending', 'snoozed')
         AND (
           ? = 1
           OR routing IS NULL
           OR reason_code IS NULL
           OR source_anchor IS NULL
           OR gap_type IS NULL
         )
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .all(force ? 1 : 0, options.limit ?? 500) as LegacyConfirmRequestRow[];

  const samples = rows.slice(0, 20).map((row) => {
    const classified = classifyLegacyRow(row);
    return {
      id: row.id,
      question: row.question,
      fromRouting: row.routing,
      fromState: row.state,
      toRouting: classified.routing,
      toState: classified.state,
      reasonCode: classified.reasonCode,
      sourceAnchor: classified.sourceAnchor,
      gapType: classified.gapType,
    };
  });

  let updated = 0;
  let backfilledDedupeKeys = 0;
  let dedupeSummary: LegacyConfirmRoutingBackfillSummary['dedupeSummary'];

  if (!dryRun && rows.length > 0) {
    const apply = db.transaction(() => {
      for (const row of rows) {
        const classified = classifyLegacyRow(row);
        db.prepare(
          `UPDATE confirm_requests
           SET routing = ?,
               state = ?,
               reason_code = ?,
               source_anchor = ?,
               gap_type = ?,
               snooze_until = ?,
               expires_at = ?,
               updated_at = ?
           WHERE id = ?`,
        ).run(
          classified.routing,
          classified.state,
          classified.reasonCode,
          classified.sourceAnchor,
          classified.gapType,
          classified.state === 'snoozed' ? currentTime + 72 * 3600 : null,
          classified.state === 'snoozed'
            ? row.expires_at ?? row.created_at + 14 * 24 * 3600
            : null,
          currentTime,
          row.id,
        );
        updated += 1;
      }
    });
    apply();
    backfilledDedupeKeys = repo.backfillDedupeKeys();
    dedupeSummary = repo.dedupePendingRequests();
  }

  const after = buildSnapshot(db, repo);

  return {
    dryRun,
    force,
    scanned: rows.length,
    updated,
    backfilledDedupeKeys,
    dedupeSummary,
    before,
    after,
    samples,
  };
}
