import fs from 'node:fs';

import {
  KeystoneBriefService,
  type UpsertKeystoneBriefInput,
} from '../memory-service/src/core/KeystoneBriefService.js';
import { KeystoneBriefComposerService } from '../memory-service/src/core/KeystoneBriefComposerService.js';
import {
  cleanupTestDb,
  getTestDb,
} from '../memory-service/src/__tests__/setup.js';
import type {
  ContextRecallMatch,
  ContextRecallRequest,
  KeystoneBriefClaim,
  KeystoneBriefSourceRef,
} from '../memory-service/src/types/index.js';

interface KeystoneEvalCase {
  id: string;
  kind: string;
  title: string;
  sampleContext: {
    sourceProvenance?: Array<Record<string, unknown>>;
    autoCompose?: {
      threadTitle: string;
      latestSummary: string;
      currentHypothesis?: string;
      evidence: Array<{
        id: string;
        content: string;
        summary?: string;
        sourceType: string;
        sourceUrl?: string;
        sourceTitle?: string;
        sender?: string;
        groupId?: string;
        groupName?: string;
        timestamp: number;
        importance?: number;
      }>;
    };
    brief: {
      briefKey: string;
      title: string;
      subjectType: UpsertKeystoneBriefInput['subjectType'];
      status?: UpsertKeystoneBriefInput['status'];
      summary: string;
      externalSummary?: string;
      freshness?: UpsertKeystoneBriefInput['freshness'];
      claims?: KeystoneBriefClaim[];
      constraints?: KeystoneBriefClaim[];
      sceneAnchors?: UpsertKeystoneBriefInput['sceneAnchors'];
    };
    sources: KeystoneBriefSourceRef[];
    request: ContextRecallRequest;
    matches: ContextRecallMatch[];
  };
  expectedBehavior: {
    status: string;
    shouldMatch: boolean;
    presentationMode?: string;
    canCopyToDraft: boolean;
    hiddenSourceCount?: number;
    externalMustNotContain?: string[];
    externalMustContain?: string[];
  };
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-keystone-memory-briefs.ts <case-json-path>');
}

const caseItem = JSON.parse(
  fs.readFileSync(casePath, 'utf8'),
) as KeystoneEvalCase;
const db = getTestDb();

try {
  resetDb();
  const service = new KeystoneBriefService(db);
  const brief = caseItem.sampleContext.autoCompose
    ? await composeAutomatically(caseItem, service)
    : service.upsertComposedCandidate(buildInput(caseItem));
  const presentation = service.matchContext(
    caseItem.sampleContext.request,
    caseItem.sampleContext.matches,
  );
  const failures = judge(caseItem, brief, presentation);
  const scores = buildScores(caseItem, brief, presentation, failures);
  const status = failures.length ? 'fail' : 'pass';
  const overallScore = failures.length
    ? Math.min(49, average(Object.values(scores)))
    : average(Object.values(scores));

  console.log(
    JSON.stringify({
      status,
      verdict: status,
      scores,
      overallScore,
      why:
        failures[0] ||
        'Keystone brief readiness, scene matching, freshness, and privacy boundaries behaved as expected.',
      userConclusion: failures.length
        ? '不通过：关键简报在来源覆盖、场景命中、时效或外发边界上没有达到预期。'
        : '通过：关键简报只在证据与场景都足够时进入主视图，并保持原始证据与外发边界。',
      improvementSuggestions: failures.length
        ? failures
        : ['继续把真实的误综合、冲突和过期样本加入本 suite。'],
      actualOutput: {
        brief: summarizeBrief(brief),
        presentation: presentation
          ? {
              presentationMode: presentation.presentationMode,
              whyNow: presentation.whyNow,
              evidenceMatchIds: presentation.evidenceMatchIds,
              relatedMemoryCount: presentation.relatedMemoryCount,
            }
          : null,
        sourceProvenance: caseItem.sampleContext.sourceProvenance ?? [],
      },
    }),
  );
} finally {
  cleanupTestDb();
}

function resetDb(): void {
  db.prepare('DELETE FROM keystone_brief_events').run();
  db.prepare('DELETE FROM keystone_brief_candidate_runs').run();
  db.prepare('DELETE FROM keystone_brief_sources').run();
  db.prepare('DELETE FROM keystone_briefs').run();
  db.prepare('DELETE FROM topic_memory_links').run();
  db.prepare('DELETE FROM reflection_runs').run();
  db.prepare('DELETE FROM reflection_threads').run();
  db.prepare("DELETE FROM messages_raw WHERE id LIKE 'keystone-eval-%'").run();
}

async function composeAutomatically(
  caseItem: KeystoneEvalCase,
  service: KeystoneBriefService,
) {
  const fixture = caseItem.sampleContext.autoCompose;
  if (!fixture) throw new Error('autoCompose fixture is required');
  const timestamp = Math.max(...fixture.evidence.map((item) => item.timestamp));
  db.prepare(
    `INSERT INTO reflection_threads
      (id, topic_key, title, status, priority, salience, source_type,
       current_hypothesis, open_questions_json, latest_summary, created_at, updated_at)
     VALUES (?, ?, ?, 'active', 9, 0.9, 'message', ?, '[]', ?, ?, ?)`,
  ).run(
    `keystone-eval-thread-${caseItem.id}`,
    `keystone-eval:${caseItem.id}`,
    fixture.threadTitle,
    fixture.currentHypothesis ?? null,
    fixture.latestSummary,
    timestamp - 60,
    timestamp,
  );
  const insert = db.prepare(
    `INSERT INTO messages_raw
      (id, content, summary, source_type, source_url, source_title, sender,
       group_id, group_name, timestamp, importance, metadata_json, scope, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 'work', ?)`,
  );
  for (const item of fixture.evidence) {
    insert.run(
      item.id,
      item.content,
      item.summary ?? null,
      item.sourceType,
      item.sourceUrl ?? null,
      item.sourceTitle ?? null,
      item.sender ?? null,
      item.groupId ?? null,
      item.groupName ?? null,
      item.timestamp,
      item.importance ?? 0.7,
      item.timestamp,
    );
  }
  const result = await new KeystoneBriefComposerService(db, async (input) => ({
    summary: input.summary,
    claims: input.claims,
    openQuestions: input.openQuestions,
  })).run({ maxBriefs: 2 });
  const brief = service.getByBriefKey(caseItem.sampleContext.brief.briefKey);
  if (!brief) {
    throw new Error(`automatic composer did not create expected brief: ${JSON.stringify(result)}`);
  }
  return brief;
}

function buildInput(caseItem: KeystoneEvalCase): UpsertKeystoneBriefInput {
  const brief = caseItem.sampleContext.brief;
  return {
    briefKey: brief.briefKey,
    title: brief.title,
    subjectType: brief.subjectType,
    scope: 'work',
    status: brief.status,
    summary: brief.summary,
    externalSummary: brief.externalSummary,
    freshness: brief.freshness,
    slots: {
      whyItMatters: '当前场景再次需要这组跨来源工作上下文。',
      currentState: brief.summary,
      stableFacts: brief.claims ?? [],
      decisions: [],
      constraints: brief.constraints ?? [],
      traps: [],
      peopleAndSources: [],
      nextUseCases: ['memory_lens'],
      openQuestions: [],
    },
    sourceMap: caseItem.sampleContext.sources,
    sceneAnchors: brief.sceneAnchors,
    displayPolicy: {
      defaultMode: 'chip',
      maxLines: 6,
      canCopyToDraft: true,
      externalSummaryOnly: true,
    },
    inputSummary: caseItem.title,
    evaluationTags: ['keystone-memory-briefs', caseItem.id],
  };
}

function judge(
  caseItem: KeystoneEvalCase,
  brief: ReturnType<KeystoneBriefService['upsertComposedCandidate']>,
  presentation: ReturnType<KeystoneBriefService['matchContext']>,
): string[] {
  const expected = caseItem.expectedBehavior;
  const failures: string[] = [];
  if (brief.status !== expected.status) {
    failures.push(`expected status=${expected.status}, got ${brief.status}.`);
  }
  if (Boolean(presentation) !== expected.shouldMatch) {
    failures.push(
      `expected shouldMatch=${expected.shouldMatch}, got ${Boolean(presentation)}.`,
    );
  }
  if (
    expected.presentationMode &&
    presentation?.presentationMode !== expected.presentationMode
  ) {
    failures.push(
      `expected presentationMode=${expected.presentationMode}, got ${presentation?.presentationMode ?? 'none'}.`,
    );
  }
  if (brief.displayPolicy.canCopyToDraft !== expected.canCopyToDraft) {
    failures.push(
      `expected canCopyToDraft=${expected.canCopyToDraft}, got ${brief.displayPolicy.canCopyToDraft}.`,
    );
  }
  if (
    expected.hiddenSourceCount !== undefined &&
    brief.displayPolicy.hiddenSourceCount !== expected.hiddenSourceCount
  ) {
    failures.push(
      `expected hiddenSourceCount=${expected.hiddenSourceCount}, got ${brief.displayPolicy.hiddenSourceCount}.`,
    );
  }
  const externalSummary = brief.externalSummary ?? '';
  for (const value of expected.externalMustNotContain ?? []) {
    if (externalSummary.toLowerCase().includes(value.toLowerCase())) {
      failures.push(`external summary leaked forbidden text: ${value}.`);
    }
  }
  for (const value of expected.externalMustContain ?? []) {
    if (!externalSummary.includes(value)) {
      failures.push(`external summary should contain ${value}.`);
    }
  }
  if (
    brief.writeReceipt.writesProfile ||
    brief.writeReceipt.sendsExternal ||
    brief.writeReceipt.createsTask ||
    brief.writeReceipt.updatesFacts
  ) {
    failures.push('brief write receipt crossed a P0 side-effect boundary.');
  }
  return failures;
}

function buildScores(
  caseItem: KeystoneEvalCase,
  brief: ReturnType<KeystoneBriefService['upsertComposedCandidate']>,
  presentation: ReturnType<KeystoneBriefService['matchContext']>,
  failures: string[],
): Record<string, number> {
  const expected = caseItem.expectedBehavior;
  return {
    sourceGrounding: brief.status === expected.status ? 100 : 0,
    sceneRelevance: Boolean(presentation) === expected.shouldMatch ? 100 : 0,
    statusAndFreshness:
      !expected.presentationMode ||
      presentation?.presentationMode === expected.presentationMode
        ? 100
        : 0,
    privacyAndProjection:
      brief.displayPolicy.canCopyToDraft === expected.canCopyToDraft &&
      !(expected.externalMustNotContain ?? []).some((value) =>
        (brief.externalSummary ?? '').toLowerCase().includes(value.toLowerCase()),
      )
        ? 100
        : 0,
    contractIntegrity: failures.some((failure) => failure.includes('write receipt'))
      ? 0
      : 100,
  };
}

function summarizeBrief(
  brief: ReturnType<KeystoneBriefService['upsertComposedCandidate']>,
) {
  return {
    id: brief.id,
    briefKey: brief.briefKey,
    title: brief.title,
    status: brief.status,
    summary: brief.summary,
    externalSummary: brief.externalSummary,
    freshness: brief.freshness,
    sourceCount: brief.sourceMap.length,
    sourceRefs: brief.sourceMap.map((source) => source.ref),
    displayPolicy: brief.displayPolicy,
    blockedReason: brief.blockedReason,
    writeReceipt: brief.writeReceipt,
  };
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
