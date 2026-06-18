import type {
  ContextCue,
  ContextRecallMatch,
  MemoryCueFact,
  SceneFrame,
  SceneFrameSurface,
} from '../types/index.js';
import {
  buildCueKey,
  type ContextCueOutcomePolicy,
} from './MemoryOutcomeLoopService.js';

export interface CueCompilerResult {
  matches: ContextRecallMatch[];
  compiledCount: number;
  suppressedCount: number;
  policySuppressedCount: number;
  boostedCount: number;
  needsMoreEvidenceCount: number;
}

export class CueCompilerService {
  attachCuesToMatches(input: {
    sceneFrame: SceneFrame;
    matches: ContextRecallMatch[];
    facts: MemoryCueFact[];
    policyResolver?: (cue: ContextCue) => ContextCueOutcomePolicy | undefined;
  }): CueCompilerResult {
    const cuesByMatch = new Map<string, ContextCue>();
    let suppressedCount = 0;
    let policySuppressedCount = 0;
    let boostedCount = 0;
    let needsMoreEvidenceCount = 0;

    for (const match of input.matches) {
      let cue = compileCueForMatch(input.sceneFrame, match, input.facts);
      if (!cue) continue;
      if (cue.compileStatus === 'compiled') {
        const policy = input.policyResolver?.(cue);
        if (policy?.action === 'suppress') {
          cue = {
            ...cue,
            cueText: '',
            compileStatus: 'suppressed',
            suppressReason: 'outcome_policy',
            outcomePolicy: policy,
          };
          policySuppressedCount += 1;
          suppressedCount += 1;
        } else if (policy?.action === 'boost') {
          cue = {
            ...cue,
            confidence: roundConfidence(cue.confidence + policy.strength * 0.08),
            outcomePolicy: policy,
          };
          boostedCount += 1;
        }
        cuesByMatch.set(match.id, cue);
      } else if (cue.compileStatus === 'needs_more_evidence') {
        needsMoreEvidenceCount += 1;
      } else {
        suppressedCount += 1;
      }
    }

    const matches = input.matches.map((match) => {
      const cue = cuesByMatch.get(match.id);
      if (!cue) return match;
      const policySuppressed = cue.suppressReason === 'outcome_policy';
      return {
        ...match,
        cue,
        score:
          cue.outcomePolicy?.action === 'boost'
            ? Math.min(1, match.score + cue.outcomePolicy.strength * 0.06)
            : match.score,
        suppressionReason: policySuppressed
          ? 'outcome_policy_suppressed'
          : match.suppressionReason,
        displayPriority:
          policySuppressed
            ? ('hidden' as const)
            : match.displayPriority === 'hidden'
            ? match.displayPriority
            : ('p1' as const),
        metadata: {
          ...(match.metadata ?? {}),
          cueCompiler: {
            cueId: cue.id,
            actionType: cue.actionType,
            compileStatus: cue.compileStatus,
            evidenceMatchIds: cue.evidenceMatchIds,
            whyNow: cue.whyNow,
            cueKey: cue.cueKey,
            outcomePolicy: cue.outcomePolicy,
          },
        },
      };
    });

    return {
      matches,
      compiledCount: Array.from(cuesByMatch.values()).filter(
        (cue) => cue.compileStatus === 'compiled',
      ).length,
      suppressedCount,
      policySuppressedCount,
      boostedCount,
      needsMoreEvidenceCount,
    };
  }
}

function compileCueForMatch(
  sceneFrame: SceneFrame,
  match: ContextRecallMatch,
  facts: MemoryCueFact[],
): ContextCue | null {
  if (sceneFrame.sceneType !== 'jira_estimate') return null;
  if (!hasStrongEstimateScene(sceneFrame)) {
    return buildUnattachedCue(sceneFrame, match, 'weak_scene_anchor');
  }

  const matchFacts = facts.filter((fact) =>
    fact.sourceRefs.some((ref) => ref.id === match.id || ref.id === String(match.id)),
  );
  const unitFact = selectFact(matchFacts, 'estimate.unit');
  if (!unitFact) {
    return matchFacts.length
      ? buildUnattachedCue(sceneFrame, match, 'weak_fact')
      : buildNeedsEvidenceCue(sceneFrame, match);
  }

  const fieldFact = selectFact(matchFacts, 'jira.field');
  const closePolicyFact = selectFact(matchFacts, 'close_policy');
  const dueDateFact = selectFact(matchFacts, 'due_date_policy');
  const surface = sceneFrame.surface;
  const actionType = surface === 'compose_assist' ? 'draft_hint' : 'remember';
  const field =
    fieldFact?.object ||
    unitFact.qualifiers?.field ||
    'estimate';
  const sourceRefs = mergeSourceRefs([
    unitFact,
    fieldFact,
    closePolicyFact,
    dueDateFact,
  ]);
  if (!sourceRefs.length) return buildNeedsEvidenceCue(sceneFrame, match);

  const cueText = buildCueText({
    actionType,
    issueKey: sceneFrame.anchors.issueKey,
    unitFact,
    fieldFact,
    closePolicyFact,
    dueDateFact,
  });
  const confidence = roundConfidence(
    Math.max(unitFact.confidence, match.score || 0.62),
  );
  const cueKey = buildCueKey({
    sceneFrame,
    actionType,
    unit: unitFact.object,
    field,
  });

  return {
    id: `context-cue:${stableHash(
      [
        cueKey,
        sceneFrame.sceneType,
        surface,
        match.id,
        unitFact.id,
        fieldFact?.id,
        closePolicyFact?.id,
        dueDateFact?.id,
      ]
        .filter(Boolean)
        .join(':'),
    )}`,
    cueKey,
    cueText,
    actionType,
    surfaceEligibility: getSurfaceEligibility(surface),
    sourceRefs,
    evidenceMatchIds: [match.id],
    whyNow: buildWhyNow(sceneFrame),
    confidence,
    riskLevel: sceneFrame.riskLevel,
    compileStatus: 'compiled',
  };
}

function hasStrongEstimateScene(sceneFrame: SceneFrame): boolean {
  if (!sceneFrame.anchors.issueKey && !sceneFrame.anchors.projects?.length) {
    return false;
  }
  return Boolean(
    sceneFrame.fieldHints?.some(
      (hint) => hint.field === 'estimate' || hint.field === 'original_estimate',
    ),
  );
}

function selectFact(
  facts: MemoryCueFact[],
  predicate: string,
): MemoryCueFact | undefined {
  return facts
    .filter((fact) => fact.predicate === predicate)
    .sort((left, right) => right.confidence - left.confidence)[0];
}

function buildCueText(input: {
  actionType: ContextCue['actionType'];
  issueKey?: string;
  unitFact: MemoryCueFact;
  fieldFact?: MemoryCueFact;
  closePolicyFact?: MemoryCueFact;
  dueDateFact?: MemoryCueFact;
}): string {
  const subject = input.issueKey || input.unitFact.subject || '这个 Jira';
  const field =
    input.fieldFact?.object ||
    input.unitFact.qualifiers?.field ||
    'estimate';
  const alternative = input.unitFact.qualifiers?.alternative;
  const tail = [
    alternative ? `也提到 ${alternative} 可作为拆分口径` : '',
    input.closePolicyFact ? input.closePolicyFact.object : '',
    input.dueDateFact ? input.dueDateFact.object : '',
  ].filter(Boolean);

  if (input.actionType === 'draft_hint') {
    return [
      `我先按${input.unitFact.object}口径处理 ${subject} 的 ${field}`,
      alternative ? `必要时再补 ${alternative} 拆分` : '',
      input.closePolicyFact ? 'close 没有硬性要求我会单独说明' : '',
    ]
      .filter(Boolean)
      .join('，')
      .replace(/，$/g, '')
      .concat('。');
  }

  return [
    `上次 ${subject} 的 ${field} 口径是${input.unitFact.object}`,
    tail.length ? `；${tail.join('；')}` : '',
    '。',
  ].join('');
}

function buildWhyNow(sceneFrame: SceneFrame): string {
  const fields = sceneFrame.fieldHints
    ?.filter((hint) => hint.field === 'estimate' || hint.field === 'original_estimate')
    .map((hint) => hint.field)
    .join(', ');
  const issue = sceneFrame.anchors.issueKey
    ? `${sceneFrame.anchors.issueKey} `
    : '';
  return `当前场景命中 ${issue}${fields || 'estimate'} 字段锚点。`;
}

function getSurfaceEligibility(surface: SceneFrameSurface): SceneFrameSurface[] {
  if (surface === 'compose_assist') return ['compose_assist'];
  if (surface === 'memory_lens') return ['memory_lens'];
  return [surface];
}

function mergeSourceRefs(facts: Array<MemoryCueFact | undefined>) {
  const refs = new Map<string, ContextCue['sourceRefs'][number]>();
  for (const fact of facts) {
    for (const ref of fact?.sourceRefs ?? []) {
      refs.set(`${ref.type}:${ref.id}`, ref);
    }
  }
  return Array.from(refs.values()).slice(0, 4);
}

function buildNeedsEvidenceCue(
  sceneFrame: SceneFrame,
  match: ContextRecallMatch,
): ContextCue {
  return {
    id: `context-cue:${stableHash(`${sceneFrame.sceneType}:${match.id}:needs`)}`,
    cueText: '',
    actionType: 'ask',
    surfaceEligibility: getSurfaceEligibility(sceneFrame.surface),
    sourceRefs: [],
    evidenceMatchIds: [match.id],
    whyNow: buildWhyNow(sceneFrame),
    confidence: 0,
    riskLevel: sceneFrame.riskLevel,
    compileStatus: 'needs_more_evidence',
    suppressReason: 'weak_fact',
  };
}

function buildUnattachedCue(
  sceneFrame: SceneFrame,
  match: ContextRecallMatch,
  reason: NonNullable<ContextCue['suppressReason']>,
): ContextCue {
  return {
    id: `context-cue:${stableHash(`${sceneFrame.sceneType}:${match.id}:${reason}`)}`,
    cueText: '',
    actionType: 'remember',
    surfaceEligibility: getSurfaceEligibility(sceneFrame.surface),
    sourceRefs: [],
    evidenceMatchIds: [match.id],
    whyNow: buildWhyNow(sceneFrame),
    confidence: 0,
    riskLevel: sceneFrame.riskLevel,
    compileStatus: 'suppressed',
    suppressReason: reason,
  };
}

function roundConfidence(value: number): number {
  return Number(Math.max(0.2, Math.min(0.95, value)).toFixed(2));
}

function stableHash(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
