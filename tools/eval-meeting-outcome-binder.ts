import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MeetingOutcomeBinderService } from '../memory-service/src/core/MeetingOutcomeBinderService.js';
import type {
  ComposerAssistEvidence,
  ContextAssistCueCard,
  ContextAssistMeetingEvent,
  MeetingOutcomeBindInput,
  MeetingOutcomeCandidateSlot,
  MeetingOutcomeSlotStatus,
} from '../memory-service/src/types/index.js';

interface EvalLlmSlot {
  slotTitle: string;
  status: MeetingOutcomeSlotStatus;
  resultSummary?: string;
  confidence?: number;
  evidenceRefs?: string[];
}

interface ExpectedSlot {
  title: string;
  status: MeetingOutcomeSlotStatus;
  mentionState?: 'not_seen' | 'mentioned' | 'supported';
  evidenceKinds?: string[];
  resultIncludes?: string[];
}

interface MeetingOutcomeBinderEvalCase {
  id: string;
  title: string;
  kind: string;
  scenario: string;
  preview: {
    prepId?: string;
    event: ContextAssistMeetingEvent;
    userGoal?: string;
    cueCards?: ContextAssistCueCard[];
    questions?: string[];
    evidenceRefs?: ComposerAssistEvidence[];
    candidateSlots: MeetingOutcomeCandidateSlot[];
    sourceHash?: string;
  };
  meeting: MeetingOutcomeBindInput;
  llm?: {
    error?: string;
    slots?: EvalLlmSlot[];
  };
  expectedBehavior: {
    previewSlotTitles: string[];
    binderStatus: 'bound' | 'partial' | 'blocked';
    bindingMode: 'llm' | 'deterministic_fallback';
    bindingError?: string;
    slots: ExpectedSlot[];
    ask?: {
      query: string;
      minimumMatches?: number;
      includes?: string[];
      excludes?: string[];
    };
  };
}

interface ProofCheck {
  category:
    | 'preview_contract'
    | 'status_guard'
    | 'evidence_grounding'
    | 'persistence'
    | 'ask_read_boundary';
  key: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-meeting-outcome-binder.ts <case-json-path>');
}

const caseItem = JSON.parse(
  fs.readFileSync(casePath, 'utf8'),
) as MeetingOutcomeBinderEvalCase;
const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');
const requireFromMemoryService = createRequire(
  path.join(repoRoot, 'memory-service', 'package.json'),
);
const Database = requireFromMemoryService('better-sqlite3') as new (
  filename: string,
) => {
  exec(sql: string): void;
  close(): void;
};

let database: ReturnType<typeof createDatabase> | undefined;

try {
  database = createDatabase();
  let previewSlotIds = new Map<string, string>();
  const llmClient = {
    generateJSON: async () => {
      if (caseItem.llm?.error) throw new Error(caseItem.llm.error);
      return {
        slots: (caseItem.llm?.slots || []).map((slot) => ({
          slotId: previewSlotIds.get(slot.slotTitle) || slot.slotTitle,
          status: slot.status,
          resultSummary: slot.resultSummary,
          confidence: slot.confidence,
          evidenceRefs: slot.evidenceRefs || [],
        })),
      };
    },
  };
  const service = new MeetingOutcomeBinderService(
    database as never,
    'esone.qiu',
    { llmClient: llmClient as never },
  );
  const preview = service.previewFromMeetingPrep({
    prepId: caseItem.preview.prepId || `prep-${caseItem.id}`,
    event: caseItem.preview.event,
    userGoal: caseItem.preview.userGoal,
    cueCards: caseItem.preview.cueCards || [],
    questions: caseItem.preview.questions || [],
    evidenceRefs: caseItem.preview.evidenceRefs || [],
    candidateSlots: caseItem.preview.candidateSlots,
    sourceHash: caseItem.preview.sourceHash || `source-${caseItem.id}`,
    generatedAt: 1_789_920_000,
  });
  previewSlotIds = new Map(preview.slots.map((slot) => [slot.title, slot.id]));

  const bound = await service.bindMeetingSession({
    ...caseItem.meeting,
    binderId: preview.id,
  });
  const expected = caseItem.expectedBehavior;
  const proofChecks: ProofCheck[] = [
    checkSet(
      'preview_contract',
      'previewSlotTitles',
      expected.previewSlotTitles,
      preview.slots.map((slot) => slot.title),
    ),
    check(
      'preview_contract',
      'previewSlotsStartPlanned',
      true,
      preview.slots.every(
        (slot) => slot.status === 'planned' && slot.mentionState === 'not_seen',
      ),
    ),
    check('status_guard', 'binderStatus', expected.binderStatus, bound.status),
    check('status_guard', 'bindingMode', expected.bindingMode, bound.bindingMode),
  ];

  if (expected.bindingError) {
    proofChecks.push(
      check(
        'evidence_grounding',
        'bindingError',
        expected.bindingError,
        bound.bindingError,
      ),
    );
  }

  for (const expectedSlot of expected.slots) {
    const actualSlot = bound.slots.find(
      (slot) => slot.title === expectedSlot.title,
    );
    proofChecks.push(
      check(
        'status_guard',
        `slot:${expectedSlot.title}:status`,
        expectedSlot.status,
        actualSlot?.status,
      ),
    );
    if (expectedSlot.mentionState) {
      proofChecks.push(
        check(
          'status_guard',
          `slot:${expectedSlot.title}:mentionState`,
          expectedSlot.mentionState,
          actualSlot?.mentionState,
        ),
      );
    }
    if (expectedSlot.evidenceKinds) {
      proofChecks.push(
        checkSet(
          'evidence_grounding',
          `slot:${expectedSlot.title}:evidenceKinds`,
          expectedSlot.evidenceKinds,
          (actualSlot?.evidence || []).map((item) => item.kind),
        ),
      );
    }
    for (const fragment of expectedSlot.resultIncludes || []) {
      proofChecks.push(
        check(
          'evidence_grounding',
          `slot:${expectedSlot.title}:resultIncludes:${fragment}`,
          true,
          Boolean(actualSlot?.resultSummary?.includes(fragment)),
        ),
      );
    }
  }

  const persisted = service.getByMeetingId(caseItem.meeting.meetingId);
  proofChecks.push(
    check('persistence', 'meetingIdLookup', bound.id, persisted?.id),
    check(
      'persistence',
      'persistedSlotsMatch',
      JSON.stringify(bound.slots),
      JSON.stringify(persisted?.slots),
    ),
  );

  let askText = '';
  let relevantCount = 0;
  if (expected.ask) {
    const relevant = service.findRelevant(expected.ask.query, 3);
    relevantCount = relevant.length;
    askText = service.formatForAsk(relevant);
    proofChecks.push(
      check(
        'ask_read_boundary',
        'minimumRelevantBinders',
        true,
        relevant.length >= (expected.ask.minimumMatches || 1),
      ),
    );
    for (const fragment of expected.ask.includes || []) {
      proofChecks.push(
        check(
          'ask_read_boundary',
          `askIncludes:${fragment}`,
          true,
          askText.includes(fragment),
        ),
      );
    }
    for (const fragment of expected.ask.excludes || []) {
      proofChecks.push(
        check(
          'ask_read_boundary',
          `askExcludes:${fragment}`,
          false,
          askText.includes(fragment),
        ),
      );
    }
  }

  const failures = proofChecks.filter((proof) => !proof.passed);
  const status = failures.length ? 'fail' : 'pass';
  const categories: ProofCheck['category'][] = [
    'preview_contract',
    'status_guard',
    'evidence_grounding',
    'persistence',
    'ask_read_boundary',
  ];
  const scores = Object.fromEntries(
    categories.map((category) => {
      const checks = proofChecks.filter((proof) => proof.category === category);
      return [
        category,
        checks.length && checks.every((proof) => proof.passed) ? 3 : 0,
      ];
    }),
  );

  console.log(
    JSON.stringify({
      status,
      verdict: status,
      scores,
      overallScore: average(Object.values(scores)),
      why: failures.length
        ? `${failures[0].key}: expected ${formatValue(failures[0].expected)}, got ${formatValue(failures[0].actual)}`
        : `会前 ${preview.slots.length} 个目标已按 ${bound.slots.length} 个结果装订；Ask 命中 ${relevantCount} 个相关 binder。`,
      userConclusion: failures.length
        ? '不通过：会前目标、证据装订、持久化或 Ask 只读消费至少有一项不符合预期。'
        : '通过：目标只在匹配证据支持时闭环，弱证据会降级，结果可持久化并被 Ask 只读引用。',
      improvementSuggestions: failures.length
        ? failures.map(
            (failure) =>
              `${failure.key} 期望 ${formatValue(failure.expected)}，实际 ${formatValue(failure.actual)}。`,
          )
        : [
            '继续补充真实 recurring meeting 的改期、同名会议和跨语言议程样本。',
          ],
      actualOutput: {
        preview: {
          id: preview.id,
          status: preview.status,
          slots: preview.slots,
        },
        bound: {
          id: bound.id,
          meetingId: bound.meetingId,
          status: bound.status,
          bindingMode: bound.bindingMode,
          bindingError: bound.bindingError,
          slots: bound.slots,
        },
        ask: {
          query: expected.ask?.query,
          relevantCount,
          formattedContext: askText,
        },
        proofChecks,
      },
      topMatch: {
        id: bound.id,
        title: bound.eventTitle,
        sourceLabel: bound.bindingMode || bound.status,
        displayPriority: bound.status,
        whyRelevant: [
          `slots=${bound.slots.length}`,
          `evidence=${bound.slots.reduce((sum, slot) => sum + slot.evidence.length, 0)}`,
          `askMatches=${relevantCount}`,
        ],
      },
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.log(
    JSON.stringify({
      status: 'error',
      verdict: 'error',
      scores: {
        preview_contract: 0,
        status_guard: 0,
        evidence_grounding: 0,
        persistence: 0,
        ask_read_boundary: 0,
      },
      overallScore: 0,
      why: message,
      userConclusion: 'Meeting Outcome Binder eval 执行失败，无法判断结果装订质量。',
      improvementSuggestions: ['检查 migration、case 结构和 tsx runner 输出。'],
      actualOutput: { error: message },
    }),
  );
  process.exitCode = 1;
} finally {
  database?.close();
}

function createDatabase() {
  const database = new Database(':memory:');
  const migration = fs.readFileSync(
    path.join(
      repoRoot,
      'memory-service',
      'src',
      'storage',
      'migrations',
      '056_meeting_outcome_binders.sql',
    ),
    'utf8',
  );
  database.exec(migration);
  return database;
}

function check(
  category: ProofCheck['category'],
  key: string,
  expected: unknown,
  actual: unknown,
): ProofCheck {
  return { category, key, expected, actual, passed: Object.is(expected, actual) };
}

function checkSet(
  category: ProofCheck['category'],
  key: string,
  expected: string[],
  actual: string[],
): ProofCheck {
  const normalizedExpected = [...new Set(expected)].sort();
  const normalizedActual = [...new Set(actual)].sort();
  return {
    category,
    key,
    expected: normalizedExpected,
    actual: normalizedActual,
    passed: JSON.stringify(normalizedExpected) === JSON.stringify(normalizedActual),
  };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
