import fs from 'node:fs';

import { ContextAssistService } from '../memory-service/src/core/ContextAssistService.js';
import { ContextRecallService } from '../memory-service/src/core/ContextRecallService.js';
import { MemoryOutcomeLoopService } from '../memory-service/src/core/MemoryOutcomeLoopService.js';
import { EmbeddingClient } from '../memory-service/src/llm/EmbeddingClient.js';
import {
  cleanupTestDb,
  getTestDb,
} from '../memory-service/src/__tests__/setup.js';
import type {
  ComposerAssistRequest,
  ComposerAssistResponse,
  ContextCue,
  ContextRecallMatch,
  ContextRecallRequest,
  SourceType,
} from '../memory-service/src/types/index.js';

interface EvalMemory {
  id: string;
  chunkId: number;
  content: string;
  scope?: 'work' | 'personal';
  sourceType?: SourceType;
  sourceUrl?: string;
  sourceTitle?: string;
  sender?: string;
  groupId?: string;
  groupName?: string;
  relatedProject?: string | null;
  metadata?: Record<string, unknown>;
}

interface EstimateCueCase {
  id: string;
  title: string;
  kind: string;
  sampleContext?: {
    memories?: EvalMemory[];
    sourceProvenance?: Array<Record<string, unknown>>;
  };
  request?: ContextRecallRequest;
  composerRequest?: ComposerAssistRequest;
  expectedCue?: {
    expectNoCue?: boolean;
    expectNoMatch?: boolean;
    recallActionType?: ContextCue['actionType'];
    composerActionType?: ContextCue['actionType'];
    mustContain?: string[];
  };
  expectedScene?: {
    recallInteractionSceneType?: string;
    recallUserMode?: string;
    composerInteractionSceneType?: string;
    composerUserMode?: string;
    outcomeSceneKey?: string;
  };
  expectedOutcomes?: {
    memoryLensActions?: Array<'expanded' | 'not_relevant'>;
    composerActions?: Array<'inserted' | 'sent_after_insert' | 'wrong'>;
  };
  expectedPolicy?: {
    action?: 'boost' | 'suppress';
    skillSuggestion?: boolean;
  };
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-estimate-cue-compiler.ts <case-json-path>');
}

const caseItem = JSON.parse(fs.readFileSync(casePath, 'utf8')) as EstimateCueCase;
const db = getTestDb();
const currentTime = Math.floor(Date.now() / 1000);

(EmbeddingClient as unknown as {
  getInstance: () => Promise<EmbeddingClient>;
}).getInstance = async () => {
  throw new Error('Embedding disabled for estimate-cue-compiler eval');
};

try {
  resetDb();
  for (const memory of caseItem.sampleContext?.memories ?? []) {
    insertMemory(memory);
  }

  const recallService = new ContextRecallService(db);
  const assistService = new ContextAssistService(db);
  const recall = caseItem.request
    ? await recallService.recall({ ...caseItem.request, debug: true })
    : null;
  const recallAgain = caseItem.request
    ? await recallService.recall({ ...caseItem.request, debug: true })
    : null;
  const composer = caseItem.composerRequest
    ? await assistService.assistComposer({
        ...caseItem.composerRequest,
        debug: true,
      })
    : null;
  const composerAgain = caseItem.composerRequest
    ? await assistService.assistComposer({
        ...caseItem.composerRequest,
        debug: true,
      })
    : null;

  const outcomeSamples = buildOutcomeSamples(caseItem, recall?.topMatch, composer);
  const outcomeApplication = applyOutcomeSamples(caseItem, outcomeSamples);
  const recallAfterOutcome =
    caseItem.request && outcomeSamples.length
      ? await recallService.recall({ ...caseItem.request, debug: true })
      : null;
  const composerAfterOutcome =
    caseItem.composerRequest && outcomeSamples.length
      ? await assistService.assistComposer({
          ...caseItem.composerRequest,
          debug: true,
        })
      : null;
  const heuristic = judgeCase({
    caseItem,
    recall,
    recallAgain,
    recallAfterOutcome,
    composer,
    composerAgain,
    composerAfterOutcome,
    outcomeSamples,
    outcomeApplication,
  });
  const status = heuristic.failures.length
    ? 'fail'
    : heuristic.warnings.length
      ? 'warn'
      : 'pass';
  const scores = buildScores(heuristic);
  const overallScore =
    status === 'fail' ? Math.min(scoreAverage(scores), 49) : scoreAverage(scores);
  const proofSummary = buildProofSummary({
    caseItem,
    heuristic,
    recall,
    recallAgain,
    composer,
    composerAgain,
    recallAfterOutcome,
    composerAfterOutcome,
    outcomeSamples,
    outcomeApplication,
    status,
  });

  console.log(
    JSON.stringify({
      status,
      verdict: status,
      scores,
      overallScore,
      why: proofSummary.shortWhy,
      userConclusion: proofSummary.userConclusion,
      improvementSuggestions: heuristic.failures.length
        ? heuristic.failures
        : heuristic.warnings.length
          ? heuristic.warnings
          : proofSummary.nextSuggestions,
      proofSummary,
      actualOutput: {
        recall: summarizeRecall(recall),
        recallAfterOutcome: summarizeRecall(recallAfterOutcome),
        composer: summarizeComposer(composer),
        composerAfterOutcome: summarizeComposer(composerAfterOutcome),
        outcomes: outcomeSamples,
        outcomeApplication,
      },
      topMatch: summarizeMatch(recall?.topMatch),
      cue: summarizeCue(getRecallCue(recall?.topMatch) ?? getComposerCue(composer)),
      outcomeSamples,
    }),
  );
} finally {
  cleanupTestDb();
}

function resetDb(): void {
  db.prepare('DELETE FROM conversation_context_frames').run();
  db.prepare('DELETE FROM memory_feedback_events').run();
  db.prepare('DELETE FROM memory_outcome_events').run();
  db.prepare('DELETE FROM memory_outcome_policy_patches').run();
  db.prepare('DELETE FROM skill_platform_bindings').run();
  db.prepare('DELETE FROM skill_versions').run();
  db.prepare('DELETE FROM personal_skills').run();
  db.prepare('DELETE FROM memory_metadata').run();
  db.prepare('DELETE FROM messages_raw').run();
  db.prepare('DELETE FROM chunks').run();
  db.prepare(`INSERT INTO chunks_fts(chunks_fts) VALUES ('delete-all')`).run();
}

function insertMemory(memory: EvalMemory): void {
  const timestamp = currentTime - 60;
  const sourceType = memory.sourceType ?? 'glip';
  const metadata = memory.metadata ?? {};
  db.prepare(
    `INSERT INTO messages_raw
      (id, content, scope, source_type, source_url, source_title, sender,
       group_id, group_name, timestamp, importance, sentiment, metadata_json,
       created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.9, 'neutral', ?, ?)`,
  ).run(
    memory.id,
    memory.content,
    memory.scope ?? 'work',
    sourceType,
    memory.sourceUrl ?? `https://app.ringcentral.com/messages/${memory.id}`,
    memory.sourceTitle ?? memory.groupName ?? 'RingCentral 消息',
    memory.sender ?? 'eval',
    memory.groupId ?? 'estimate-eval',
    memory.groupName ?? 'Estimate Eval',
    timestamp,
    JSON.stringify(metadata),
    timestamp,
  );

  db.prepare(
    `INSERT INTO chunks
      (chunk_id, file_path, line_start, line_end, content, content_hash, scope,
       source, source_type, related_project, created_at)
     VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    memory.chunkId,
    `messages/${memory.id}`,
    memory.content,
    `hash-${memory.id}`,
    memory.scope ?? 'work',
    sourceType,
    sourceType,
    memory.relatedProject ?? null,
    timestamp,
  );

  db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
    memory.chunkId,
    [
      memory.content,
      typeof metadata.summary === 'string' ? metadata.summary : '',
      JSON.stringify(metadata.contextMessages || []),
      JSON.stringify(metadata.entities || {}),
      JSON.stringify(metadata.metadata || {}),
    ].join(' '),
  );
}

function judgeCase(input: {
  caseItem: EstimateCueCase;
  recall: Awaited<ReturnType<ContextRecallService['recall']>> | null;
  recallAgain: Awaited<ReturnType<ContextRecallService['recall']>> | null;
  recallAfterOutcome: Awaited<ReturnType<ContextRecallService['recall']>> | null;
  composer: ComposerAssistResponse | null;
  composerAgain: ComposerAssistResponse | null;
  composerAfterOutcome: ComposerAssistResponse | null;
  outcomeSamples: Array<Record<string, unknown>>;
  outcomeApplication: OutcomeApplicationSummary;
}): { failures: string[]; warnings: string[] } {
  const expected = input.caseItem.expectedCue ?? {};
  const recallCue = getRecallCue(input.recall?.topMatch);
  const recallCueAgain = getRecallCue(input.recallAgain?.topMatch);
  const composerCue = getComposerCue(input.composer);
  const composerCueAgain = getComposerCue(input.composerAgain);
  const failures: string[] = [];
  const warnings: string[] = [];
  checkExpectedScene(input, failures);

  if (expected.expectNoCue) {
    if (recallCue?.compileStatus === 'compiled') {
      failures.push('expected no compiled recall cue for weak scene.');
    }
    if (composerCue?.compileStatus === 'compiled') {
      failures.push('expected no compiled composer cue for weak scene.');
    }
    if (expected.expectNoMatch && (input.recall?.matches?.length ?? 0) > 0) {
      failures.push('expected no displayed Memory Lens match for current-page field echo.');
    }
    return { failures, warnings };
  }

  if (input.caseItem.request) {
    if (recallCue?.compileStatus !== 'compiled') {
      failures.push('recall top match did not include a compiled cue.');
    }
    if (
      expected.recallActionType &&
      recallCue?.actionType !== expected.recallActionType
    ) {
      failures.push(
        `expected recall cue action=${expected.recallActionType}, got ${recallCue?.actionType ?? 'none'}.`,
      );
    }
    if (!recallCue?.sourceRefs?.length) {
      failures.push('recall cue did not keep sourceRefs.');
    }
    if (
      recallCue?.id &&
      recallCueAgain?.id &&
      (recallCue.id !== recallCueAgain.id ||
        recallCue.cueText !== recallCueAgain.cueText)
    ) {
      failures.push('recall cue id/text was not stable across repeated runs.');
    }
  }

  if (input.caseItem.composerRequest) {
    if (composerCue?.compileStatus !== 'compiled') {
      failures.push('composer evidence did not include a compiled cue.');
    }
    if (
      expected.composerActionType &&
      composerCue?.actionType !== expected.composerActionType
    ) {
      failures.push(
        `expected composer cue action=${expected.composerActionType}, got ${composerCue?.actionType ?? 'none'}.`,
      );
    }
    if (!input.composer?.insertText) {
      failures.push('composer did not produce insertText from cue.');
    }
    if (
      composerCue?.id &&
      composerCueAgain?.id &&
      (composerCue.id !== composerCueAgain.id ||
        composerCue.cueText !== composerCueAgain.cueText)
    ) {
      failures.push('composer cue id/text was not stable across repeated runs.');
    }
  }

  const combinedText = [
    recallCue?.cueText,
    composerCue?.cueText,
    input.composer?.insertText,
  ].join('\n');
  for (const text of expected.mustContain ?? []) {
    if (!combinedText.includes(text)) {
      failures.push(`expected cue/insert text to include ${text}.`);
    }
  }

  for (const outcome of input.outcomeSamples) {
    const cueIds = getOutcomeCueIds(outcome);
    if (!cueIds.length) {
      failures.push(`outcome ${outcome.action ?? outcome.interaction} lost cueIds.`);
    }
    const cueKeys = getOutcomeCueKeys(outcome);
    if (!cueKeys.length) {
      failures.push(`outcome ${outcome.action ?? outcome.interaction} lost cueKeys.`);
    }
  }

  if (input.caseItem.expectedPolicy?.action) {
    const action = input.caseItem.expectedPolicy.action;
    if (action === 'suppress') {
      const suppressedCount = Number(
        input.recallAfterOutcome?.debug?.cueCompiler?.policySuppressedCount ?? 0,
      );
      const hasCompiledAfterOutcome = input.recallAfterOutcome?.matches.some(
        (match) => match.cue?.compileStatus === 'compiled',
      );
      if (suppressedCount < 1 || hasCompiledAfterOutcome) {
        failures.push('expected outcome policy to suppress the cue after negative feedback.');
      }
    }
    if (action === 'boost') {
      const boostedCue = getComposerCue(input.composerAfterOutcome);
      if (boostedCue?.outcomePolicy?.action !== 'boost') {
        failures.push('expected outcome policy to boost the cue after sent outcomes.');
      }
    }
    if (!input.outcomeApplication.patches.some((patch) => patch.action === action)) {
      failures.push(`expected outcome policy patch action=${action}.`);
    }
  }

  if (
    input.caseItem.expectedPolicy?.skillSuggestion &&
    input.outcomeApplication.skillSuggestionCount < 1
  ) {
    failures.push('expected repeated sent outcomes to create a Skill Foundry suggestion.');
  }

  if (input.recall?.debug?.sceneFrame?.sceneType !== 'jira_estimate' && input.caseItem.request) {
    warnings.push('recall debug.sceneFrame did not mark jira_estimate.');
  }
  if (
    input.composer &&
    Number(input.composer.debug?.recall?.cueCompiler?.compiledCount ?? 0) < 1
  ) {
    warnings.push('composer debug did not expose cueCompiler.compiledCount.');
  }

  return { failures, warnings };
}

function checkExpectedScene(
  input: {
    caseItem: EstimateCueCase;
    recall: Awaited<ReturnType<ContextRecallService['recall']>> | null;
    composer: ComposerAssistResponse | null;
  },
  failures: string[],
): void {
  const expected = input.caseItem.expectedScene;
  if (!expected) return;
  const recallScene = input.recall?.debug?.sceneFrame;
  const composerScene = input.composer?.debug?.recall?.sceneFrame as
    | Record<string, unknown>
    | undefined;
  if (
    expected.recallInteractionSceneType &&
    recallScene?.interactionSceneType !== expected.recallInteractionSceneType
  ) {
    failures.push(
      `expected recall interactionSceneType=${expected.recallInteractionSceneType}, got ${String(recallScene?.interactionSceneType ?? 'none')}.`,
    );
  }
  if (expected.recallUserMode && recallScene?.userMode !== expected.recallUserMode) {
    failures.push(
      `expected recall userMode=${expected.recallUserMode}, got ${String(recallScene?.userMode ?? 'none')}.`,
    );
  }
  if (
    expected.composerInteractionSceneType &&
    composerScene?.interactionSceneType !== expected.composerInteractionSceneType
  ) {
    failures.push(
      `expected composer interactionSceneType=${expected.composerInteractionSceneType}, got ${String(composerScene?.interactionSceneType ?? 'none')}.`,
    );
  }
  if (
    expected.composerUserMode &&
    composerScene?.userMode !== expected.composerUserMode
  ) {
    failures.push(
      `expected composer userMode=${expected.composerUserMode}, got ${String(composerScene?.userMode ?? 'none')}.`,
    );
  }
}

function getRecallCue(
  match: ContextRecallMatch | null | undefined,
): ContextCue | undefined {
  return match?.cue;
}

function getComposerCue(
  composer: ComposerAssistResponse | null,
): ContextCue | undefined {
  return composer?.evidence.find((item) => item.cue?.compileStatus === 'compiled')
    ?.cue;
}

interface OutcomeApplicationSummary {
  cueEventCount: number;
  patches: Array<{ action: string; cueKey: string; strength: number }>;
  skillSuggestionCount: number;
}

function applyOutcomeSamples(
  caseItem: EstimateCueCase,
  outcomeSamples: Array<Record<string, unknown>>,
): OutcomeApplicationSummary {
  const service = new MemoryOutcomeLoopService(db, 'eval');
  let cueEventCount = 0;
  const patches = new Map<string, { action: string; cueKey: string; strength: number }>();
  for (let index = 0; index < outcomeSamples.length; index += 1) {
    const outcome = outcomeSamples[index];
    if (outcome.surface === 'memory_lens') {
      const cueKey = getOutcomeCueKeys(outcome)[0];
      const cueId = getOutcomeCueIds(outcome)[0];
      const targetId = String(outcome.target_id ?? `eval-target-${index}`);
      const action = outcome.action === 'negative' ? 'negative' : 'positive';
      const result = service.processRecallFeedback({
        id: `${caseItem.id}:feedback:${index}`,
        surface: 'memory_lens',
        sceneKey: String(outcome.sceneKey ?? 'jira:MTR-148115'),
        targetId,
        targetType: String(outcome.target_type ?? 'chunk'),
        action,
        detail: JSON.stringify({
          cue_id: cueId,
          cue_key: cueKey,
          scene_anchor_signature: outcome.sceneKey ?? 'jira:MTR-148115',
          feedback_reason:
            action === 'negative' ? 'not_relevant_eval' : 'relevant_eval',
        }),
        createdAt: currentTime + index,
      });
      cueEventCount += result.cueEventCount;
      for (const patch of result.patches) {
        patches.set(patch.id, {
          action: patch.action,
          cueKey: patch.cueKey,
          strength: patch.strength,
        });
      }
      continue;
    }

    if (outcome.surface === 'compose_assist') {
      const result = service.processAmbientTrace({
        id: `${caseItem.id}:ambient:${index}`,
        surface: 'compose_assist',
        sceneKey: String(outcome.sceneKey ?? 'jira:MTR-148115'),
        action: String(outcome.action ?? 'inserted'),
        strength:
          outcome.action === 'sent_after_insert'
            ? 'strong'
            : outcome.action === 'wrong'
              ? 'strong'
              : 'medium',
        polarity:
          outcome.action === 'wrong'
            ? 'negative'
            : outcome.action === 'sent_after_insert' || outcome.action === 'inserted'
              ? 'positive'
              : 'neutral',
        evidenceRefs: outcome.evidenceRefs as any,
        redactedDiff: outcome.redactedDiff as any,
        metadata: outcome.metadata as Record<string, unknown> | undefined,
        createdAt: currentTime + index,
      } as any);
      cueEventCount += result.cueEventCount;
      for (const patch of result.patches) {
        patches.set(patch.id, {
          action: patch.action,
          cueKey: patch.cueKey,
          strength: patch.strength,
        });
      }
    }
  }
  const skillSuggestionCount = (
    db
      .prepare(
        `SELECT COUNT(*) AS count
           FROM personal_skills
          WHERE status = 'suggestion'
            AND suggested_from = 'memory_outcome_loop'`,
      )
      .get() as { count: number }
  ).count;
  return {
    cueEventCount,
    patches: Array.from(patches.values()),
    skillSuggestionCount,
  };
}

function buildOutcomeSamples(
  caseItem: EstimateCueCase,
  match: ContextRecallMatch | null | undefined,
  composer: ComposerAssistResponse | null,
): Array<Record<string, unknown>> {
  const outcomes: Array<Record<string, unknown>> = [];
  const recallCue = getRecallCue(match);
  for (const action of caseItem.expectedOutcomes?.memoryLensActions ?? []) {
    if (!recallCue || !match) continue;
    outcomes.push({
      surface: 'memory_lens',
      interaction:
        action === 'not_relevant'
          ? 'memory_relevance_trainer'
          : 'context_recall_feedback',
      action: action === 'not_relevant' ? 'negative' : 'positive',
      cue_id: recallCue.id,
      cue_key: recallCue.cueKey,
      cue_action_type: recallCue.actionType,
      cue_compile_status: recallCue.compileStatus,
      sceneKey: getOutcomeSceneKey(caseItem),
      target_id: match.id,
      target_type: match.type,
    });
  }

  const composerCue = getComposerCue(composer);
  for (const action of caseItem.expectedOutcomes?.composerActions ?? []) {
    if (!composerCue || !composer) continue;
    outcomes.push({
      surface: 'compose_assist',
      action,
      evidenceRefs: composer.evidence.map((item) => ({
        id: item.id,
        type: item.type,
        cueId: item.cue?.id,
        cueKey: item.cue?.cueKey,
        cue: summarizeCue(item.cue),
      })),
      sceneKey: getOutcomeSceneKey(caseItem),
      privacyClass: 'sensitive_redacted',
      redactedDiff: {
        rawTextStored: false,
        suggestionHash: stableHash(composer.insertText || ''),
        suggestionTextLength: composer.insertText?.length ?? 0,
      },
      metadata: {
        cueIds: [composerCue.id],
        cueKeys: composerCue.cueKey ? [composerCue.cueKey] : [],
        suggestionType: composer.suggestionType,
        confidence: composer.confidence,
      },
    });
  }

  return outcomes;
}

function getOutcomeSceneKey(caseItem: EstimateCueCase): string {
  return caseItem.expectedScene?.outcomeSceneKey || 'jira:MTR-148115';
}

function getOutcomeCueIds(outcome: Record<string, unknown>): string[] {
  const direct = typeof outcome.cue_id === 'string' ? [outcome.cue_id] : [];
  const metadata = outcome.metadata as Record<string, unknown> | undefined;
  const metadataIds = Array.isArray(metadata?.cueIds)
    ? metadata?.cueIds.filter((value): value is string => typeof value === 'string')
    : [];
  return [...direct, ...metadataIds];
}

function getOutcomeCueKeys(outcome: Record<string, unknown>): string[] {
  const direct = typeof outcome.cue_key === 'string' ? [outcome.cue_key] : [];
  const metadata = outcome.metadata as Record<string, unknown> | undefined;
  const metadataKeys = Array.isArray(metadata?.cueKeys)
    ? metadata?.cueKeys.filter((value): value is string => typeof value === 'string')
    : [];
  const evidenceRefs = Array.isArray(outcome.evidenceRefs)
    ? outcome.evidenceRefs
        .map((ref) => {
          if (!ref || typeof ref !== 'object') return undefined;
          const record = ref as Record<string, unknown>;
          if (typeof record.cueKey === 'string') return record.cueKey;
          const cue = record.cue as Record<string, unknown> | undefined;
          return typeof cue?.cueKey === 'string' ? cue.cueKey : undefined;
        })
        .filter((value): value is string => Boolean(value))
    : [];
  return Array.from(new Set([...direct, ...metadataKeys, ...evidenceRefs]));
}

function buildProofSummary(input: {
  caseItem: EstimateCueCase;
  heuristic: { failures: string[]; warnings: string[] };
  recall: Awaited<ReturnType<ContextRecallService['recall']>> | null;
  recallAgain: Awaited<ReturnType<ContextRecallService['recall']>> | null;
  recallAfterOutcome: Awaited<ReturnType<ContextRecallService['recall']>> | null;
  composer: ComposerAssistResponse | null;
  composerAgain: ComposerAssistResponse | null;
  composerAfterOutcome: ComposerAssistResponse | null;
  outcomeSamples: Array<Record<string, unknown>>;
  outcomeApplication: OutcomeApplicationSummary;
  status: string;
}): Record<string, unknown> {
  const recallCue = getRecallCue(input.recall?.topMatch);
  const recallCueAgain = getRecallCue(input.recallAgain?.topMatch);
  const composerCue = getComposerCue(input.composer);
  const composerCueAgain = getComposerCue(input.composerAgain);
  const primaryCue = recallCue ?? composerCue;
  const expectedNoCue = Boolean(input.caseItem.expectedCue?.expectNoCue);
  const sceneType =
    input.recall?.debug?.sceneFrame?.sceneType ??
    input.composer?.debug?.recall?.sceneFrame?.sceneType ??
    'unknown';
  const surface =
    input.recall?.debug?.sceneFrame?.surface ??
    input.composer?.debug?.recall?.sceneFrame?.surface ??
    (input.caseItem.request ? 'memory_lens' : 'compose_assist');
  const outcomeActions = input.outcomeSamples
    .map((outcome) => String(outcome.action ?? outcome.interaction ?? 'unknown'))
    .filter(Boolean);
  const cueIds = Array.from(
    new Set(input.outcomeSamples.flatMap((outcome) => getOutcomeCueIds(outcome))),
  );
  const cueKeys = Array.from(
    new Set(input.outcomeSamples.flatMap((outcome) => getOutcomeCueKeys(outcome))),
  );
  const cueStable =
    expectedNoCue ||
    (input.caseItem.request
      ? isCueStable(recallCue, recallCueAgain)
      : isCueStable(composerCue, composerCueAgain));
  const outcomeCueIdsRetained =
    input.outcomeSamples.length === 0 ||
    input.outcomeSamples.every((outcome) => getOutcomeCueIds(outcome).length > 0);

  const checks = expectedNoCue
    ? input.caseItem.expectedCue?.expectNoMatch
      ? [
          {
            label: '当前页面识别',
            status: sceneType === 'jira_estimate' ? 'pass' : 'warn',
            detail: `当前 sceneFrame = ${sceneType}，用于判断 Jira 页面字段 echo。`,
          },
          {
            label: '字段 echo 静默',
            status: (input.recall?.matches?.length ?? 0) > 0 ? 'fail' : 'pass',
            detail: (input.recall?.matches?.length ?? 0) > 0
              ? 'Jira 页面已显示字段值，但仍展示了 Lens match。'
              : 'Jira 页面已显示字段值，相关候选被静默。',
          },
        ]
      : [
        {
          label: '场景识别',
          status: sceneType === 'jira_estimate' ? 'fail' : 'pass',
          detail: `当前 sceneFrame = ${sceneType}，不是 jira_estimate 时不应生成 estimate cue。`,
        },
        {
          label: '误触发保护',
          status:
            primaryCue?.compileStatus === 'compiled' ||
            (input.caseItem.expectedCue?.expectNoMatch &&
              (input.recall?.matches?.length ?? 0) > 0)
              ? 'fail'
              : 'pass',
          detail: input.caseItem.expectedCue?.expectNoMatch
            ? (input.recall?.matches?.length ?? 0) > 0
              ? 'Jira 页面已显示字段值，但仍展示了 Lens match。'
              : 'Jira 页面已显示字段值，相关候选被静默。'
            : primaryCue?.compileStatus === 'compiled'
              ? '弱场景错误生成了 cue。'
              : '只召回相关记忆，但没有把 estimate 事实编译成提示。',
        },
      ]
    : [
        {
          label: '场景识别',
          status: sceneType === 'jira_estimate' ? 'pass' : 'warn',
          detail: `当前 sceneFrame = ${sceneType}。`,
        },
        {
          label: 'Cue 编译',
          status: primaryCue?.compileStatus === 'compiled' ? 'pass' : 'fail',
          detail: primaryCue?.compileStatus === 'compiled'
            ? `生成 ${primaryCue.actionType} cue。`
            : '没有生成 compiled cue。',
        },
        {
          label: '文案可用',
          status: getPrimaryCueText(primaryCue, input.composer) ? 'pass' : 'fail',
          detail: getPrimaryCueText(primaryCue, input.composer) || '缺少 cueText / insertText。',
        },
        {
          label: '稳定性',
          status: cueStable ? 'pass' : 'fail',
          detail: cueStable ? '重复运行时 cue id 和文案保持一致。' : '重复运行时 cue id 或文案发生变化。',
        },
        {
          label: 'Outcome 关联',
          status: outcomeCueIdsRetained ? 'pass' : 'fail',
          detail: outcomeActions.length
            ? `${outcomeActions.join(' / ')} 都保留 cueId。`
            : '本 case 没有 outcome action 样本。',
        },
        ...(input.caseItem.expectedPolicy?.action
          ? [
              {
                label: 'Policy 学习',
                status: input.outcomeApplication.patches.some(
                  (patch) => patch.action === input.caseItem.expectedPolicy?.action,
                )
                  ? 'pass'
                  : 'fail',
                detail: input.outcomeApplication.patches.length
                  ? `生成 policy patch：${input.outcomeApplication.patches
                      .map((patch) => patch.action)
                      .join(' / ')}。`
                  : '没有生成 policy patch。',
              },
            ]
          : []),
        ...(input.caseItem.expectedPolicy?.skillSuggestion
          ? [
              {
                label: 'Skill Foundry',
                status: input.outcomeApplication.skillSuggestionCount > 0 ? 'pass' : 'fail',
                detail:
                  input.outcomeApplication.skillSuggestionCount > 0
                    ? '重复成功的 estimate cue 已进入 Skill Foundry suggestion。'
                    : '没有创建 Skill Foundry suggestion。',
              },
            ]
          : []),
      ];

  return {
    caseGoal: buildCaseGoal(input.caseItem),
    shortWhy:
      input.heuristic.failures[0] ||
      input.heuristic.warnings[0] ||
      buildShortWhy(input.caseItem, expectedNoCue),
    userConclusion:
      input.status === 'fail'
        ? '不通过：cue 编译、稳定性或 outcome 关联没有达到预期。'
        : input.status === 'warn'
          ? '需关注：核心检查通过，但诊断字段还不完整。'
          : buildPassConclusion(input.caseItem, expectedNoCue),
    proves: buildProves(input.caseItem, expectedNoCue, outcomeActions),
    doesNotProve: [
      '不证明真实 Jira 页面 UI 已经在线上可见。',
      '不证明远端 10.32.56.212 已部署这批代码。',
      '不证明所有 estimate 场景都能泛化，只覆盖当前 fixture 形状。',
      '不证明 Ask、Day Pilot、Meeting Pilot、OpenClaw 等其他 surface 已完成同等接入。',
    ],
    nextSuggestions: [
      '把真实 Jira estimate / Glip 记忆样本继续加入本 suite，覆盖更多字段名和中英文混写。',
      '下一步若要证明线上体验，需要用已部署 memory-service 和真实 Jira 页面做浏览器验证。',
    ],
    sceneType,
    surface,
    primaryCue: summarizeCue(primaryCue),
    primaryCueText: getPrimaryCueText(primaryCue, input.composer),
    cueStable,
    cueIds,
    cueKeys,
    outcomeActions,
    outcomeCueIdsRetained,
    outcomeApplication: input.outcomeApplication,
    recallAfterOutcome: summarizeRecall(input.recallAfterOutcome),
    composerAfterOutcome: summarizeComposer(input.composerAfterOutcome),
    checks,
  };
}

function isCueStable(
  first: ContextCue | undefined,
  second: ContextCue | undefined,
): boolean {
  if (!first && !second) return true;
  if (!first || !second) return false;
  return first.id === second.id && first.cueText === second.cueText;
}

function getPrimaryCueText(
  cue: ContextCue | undefined,
  composer: ComposerAssistResponse | null,
): string {
  return String(cue?.cueText || composer?.insertText || '').trim();
}

function buildCaseGoal(caseItem: EstimateCueCase): string {
  if (caseItem.expectedCue?.expectNoMatch) {
    return '证明 Jira issue 页面已经显示 estimate 字段值时，Memory Lens 不复述同一字段值；同类提示应留给群聊/评论等讨论场景。';
  }
  if (caseItem.expectedCue?.expectNoCue) {
    return '证明只有 issue/status 相关但没有 estimate 字段锚点时，系统不会把“人天口径”强行提示出来。';
  }
  if (caseItem.request) {
    return '证明 Memory Lens 在 Jira Original Estimate 场景能把相关记忆编译成一句可读的 remember cue。';
  }
  return '证明 Compose Assist 在 Jira comment 场景能把同一记忆编译成可插入的 draft_hint。';
}

function buildShortWhy(
  caseItem: EstimateCueCase,
  expectedNoCue: boolean,
): string {
  if (caseItem.expectedCue?.expectNoMatch) {
    return 'Current Jira page field echo stayed silent and did not show a Lens card.';
  }
  if (expectedNoCue) return 'Weak status scene stayed related-only and did not compile an estimate cue.';
  if (caseItem.request) return 'Memory Lens compiled a stable Jira estimate remember cue with source refs and cueId-linked outcomes.';
  if (caseItem.expectedPolicy?.skillSuggestion) {
    return 'Compose Assist learned from repeated sent outcomes, boosted the cue, and created a Skill Foundry suggestion.';
  }
  return 'Compose Assist compiled a stable Jira estimate draft hint and retained cueIds/cueKeys in insert/send feedback.';
}

function buildPassConclusion(
  caseItem: EstimateCueCase,
  expectedNoCue: boolean,
): string {
  if (caseItem.expectedCue?.expectNoMatch) {
    return '通过：Jira 页面已显示 DEV Estimate New=0.4 时，Memory Lens 不再复述这个页面字段值。';
  }
  if (expectedNoCue) {
    return '通过：弱 status/blocker 场景没有生成 estimate cue，说明系统不会只因 issue 相关就提示人天口径。';
  }
  if (caseItem.request) {
    return caseItem.expectedPolicy?.action === 'suppress'
      ? '通过：Memory Lens 可以生成“人天口径” cue，并在重复不相关反馈后静默同类 cue。'
      : '通过：Memory Lens 可以生成“人天口径” remember cue，并把展开/不相关反馈挂回 cueId。';
  }
  return caseItem.expectedPolicy?.skillSuggestion
    ? '通过：Compose Assist 可以生成 draft_hint，发送后 boost，下次继续使用，并把重复成功模式送入 Skill Foundry suggestion。'
    : '通过：Compose Assist 可以生成“人天口径” draft_hint，并把插入/发送/错误反馈挂回 cueId。';
}

function buildProves(
  caseItem: EstimateCueCase,
  expectedNoCue: boolean,
  outcomeActions: string[],
): string[] {
  if (expectedNoCue) {
    return caseItem.expectedCue?.expectNoMatch
      ? [
          'Jira issue 页面已可见的 estimate 字段值不会再触发 Lens 卡片。',
          '这个保护只针对当前页面字段 echo，不影响群聊/评论里的同 ticket estimate 讨论。',
        ]
      : [
          'SceneFrame 没有把 status/blocker 场景误判成 jira_estimate。',
          '相关 estimate 记忆可以被召回，但不会被编译成误导性的业务 cue。',
        ];
  }
  const base = caseItem.request
    ? 'Memory Lens 能生成 read-only remember cue。'
    : 'Compose Assist 能生成可插入 draft_hint。';
  return [
    base,
    'cue 文案包含 MTR-148115、original estimate 和人天口径。',
    '重复运行时 cue id 和 cueText 稳定。',
    outcomeActions.length
      ? `这些用户行为样本可回连 cueId/cueKey：${outcomeActions.join(' / ')}。`
      : '本 case 没有定义 outcome action 样本。',
    ...(caseItem.expectedPolicy?.action
      ? [`Outcome Loop 会生成 ${caseItem.expectedPolicy.action} policy patch，并被下一次同类场景读取。`]
      : []),
    ...(caseItem.expectedPolicy?.skillSuggestion
      ? ['重复 sent_after_insert 会创建 Estimate wording helper 作为 Skill Foundry suggestion。']
      : []),
  ];
}

function buildScores(heuristic: {
  failures: string[];
  warnings: string[];
}): Record<string, number> {
  const failed = heuristic.failures.length > 0;
  return {
    cue_compilation: failed ? 0 : 3,
    cue_stability: failed ? 0 : heuristic.warnings.length ? 2 : 3,
    actionable_text: failed ? 0 : 3,
    outcome_linkage: failed ? 0 : 3,
  };
}

function scoreAverage(scores: Record<string, number>): number {
  const values = Object.values(scores);
  if (!values.length) return 0;
  return Math.round(
    (values.reduce((sum, value) => sum + value, 0) / (values.length * 3)) *
      100,
  );
}

function summarizeRecall(
  response: Awaited<ReturnType<ContextRecallService['recall']>> | null,
) {
  if (!response) return null;
  return {
    topMatch: summarizeMatch(response.topMatch),
    matches: response.matches.map(summarizeMatch),
    debug: response.debug,
  };
}

function summarizeComposer(response: ComposerAssistResponse | null) {
  if (!response) return null;
  return {
    available: response.available,
    suggestionType: response.suggestionType,
    insertText: response.insertText,
    evidence: response.evidence.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      cue: summarizeCue(item.cue),
    })),
    debug: response.debug,
  };
}

function summarizeMatch(match: ContextRecallMatch | null | undefined) {
  if (!match) return null;
  return {
    id: match.id,
    type: match.type,
    title: match.title,
    score: match.score,
    displayPriority: match.displayPriority,
    cue: summarizeCue(match.cue),
  };
}

function summarizeCue(cue?: ContextCue): Record<string, unknown> | null {
  if (!cue) return null;
  return {
    id: cue.id,
    cueKey: cue.cueKey,
    actionType: cue.actionType,
    compileStatus: cue.compileStatus,
    cueText: cue.cueText,
    confidence: cue.confidence,
    whyNow: cue.whyNow,
    outcomePolicy: cue.outcomePolicy,
    sourceRefCount: cue.sourceRefs?.length ?? 0,
  };
}

function stableHash(text: string): string {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
