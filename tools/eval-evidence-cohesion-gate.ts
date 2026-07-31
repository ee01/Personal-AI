import fs from 'node:fs';

import {
  EvidenceCohesionGateService,
  type EvidenceCohesionRequest,
  type EvidenceCohesionState,
} from '../memory-service/src/core/EvidenceCohesionGateService.js';

interface EvidenceCohesionEvalCase {
  id: string;
  title: string;
  kind: string;
  scenario: string;
  request: EvidenceCohesionRequest;
  expectedBehavior: {
    state: EvidenceCohesionState;
    includedEvidenceRefs: string[];
    excludedEvidenceRefs: string[];
    shouldBlock: boolean;
    silent: boolean;
  };
}

interface ProofCheck {
  key: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-evidence-cohesion-gate.ts <case-json-path>');
}

const caseItem = JSON.parse(
  fs.readFileSync(casePath, 'utf8'),
) as EvidenceCohesionEvalCase;

try {
  const result = new EvidenceCohesionGateService().evaluate(caseItem.request);
  const expected = caseItem.expectedBehavior;
  const baselineIncluded = caseItem.request.candidates.map(
    (candidate) => candidate.evidenceRef,
  );
  const expectedIncluded = new Set(expected.includedEvidenceRefs);
  const expectedExcluded = new Set(expected.excludedEvidenceRefs);
  const actualIncluded = new Set(result.includedEvidenceRefs);
  const actualExcluded = new Set(
    result.excluded.map((item) => item.evidenceRef),
  );
  const baselineLeakRefs = baselineIncluded.filter((ref) =>
    expectedExcluded.has(ref),
  );
  const gatedLeakRefs = result.includedEvidenceRefs.filter((ref) =>
    expectedExcluded.has(ref),
  );
  const retainedRefs = result.includedEvidenceRefs.filter((ref) =>
    expectedIncluded.has(ref),
  );
  const unexpectedDrops = expected.includedEvidenceRefs.filter(
    (ref) => !actualIncluded.has(ref),
  );
  const shouldBlock = isBlockingState(result.state);
  const baselinePrecision = percentage(
    expected.includedEvidenceRefs.filter((ref) => baselineIncluded.includes(ref))
      .length,
    baselineIncluded.length,
  );
  const gatedPrecision = percentage(
    retainedRefs.length,
    result.includedEvidenceRefs.length,
    expected.includedEvidenceRefs.length === 0 &&
      result.includedEvidenceRefs.length === 0
      ? 100
      : 0,
  );
  const requiredEvidenceRecall = percentage(
    retainedRefs.length,
    expected.includedEvidenceRefs.length,
    100,
  );
  const leakageReduction = percentage(
    baselineLeakRefs.length - gatedLeakRefs.length,
    baselineLeakRefs.length,
    gatedLeakRefs.length === 0 ? 100 : 0,
  );
  const proofChecks: ProofCheck[] = [
    check('state', expected.state, result.state),
    checkSet(
      'includedEvidenceRefs',
      expected.includedEvidenceRefs,
      result.includedEvidenceRefs,
    ),
    checkSet(
      'excludedEvidenceRefs',
      expected.excludedEvidenceRefs,
      [...actualExcluded],
    ),
    check('shouldBlock', expected.shouldBlock, shouldBlock),
    check('silent', expected.silent, result.receipt.silent),
    {
      key: 'crossTopicLeakCount',
      expected: 0,
      actual: gatedLeakRefs.length,
      passed: gatedLeakRefs.length === 0,
    },
    {
      key: 'requiredEvidenceRecall',
      expected: 100,
      actual: requiredEvidenceRecall,
      passed: requiredEvidenceRecall === 100,
    },
  ];
  if (baselineLeakRefs.length > 0) {
    proofChecks.push({
      key: 'leakageReducedFromBaseline',
      expected: true,
      actual: gatedLeakRefs.length < baselineLeakRefs.length,
      passed: gatedLeakRefs.length < baselineLeakRefs.length,
    });
  }

  const failures = proofChecks.filter((proof) => !proof.passed);
  const status = failures.length > 0 ? 'fail' : 'pass';
  const scores = {
    stateSelection: proofChecks.find((proof) => proof.key === 'state')?.passed
      ? 100
      : 0,
    evidencePrecision: gatedPrecision,
    evidenceRetention: requiredEvidenceRecall,
    leakageReduction,
    actionBoundary:
      proofChecks.find((proof) => proof.key === 'shouldBlock')?.passed
        ? 100
        : 0,
  };

  console.log(
    JSON.stringify({
      status,
      verdict: status,
      scores,
      overallScore: average(Object.values(scores)),
      why:
        failures.length > 0
          ? `${failures[0].key}: expected ${formatValue(failures[0].expected)}, got ${formatValue(failures[0].actual)}`
          : baselineLeakRefs.length > 0
            ? `consume-all 基线会带入 ${baselineLeakRefs.length} 条跨题证据，Gate 后为 ${gatedLeakRefs.length} 条，必需证据保留率 ${requiredEvidenceRecall}%。`
            : `该场景未制造伪泄漏；Gate 保留了 ${retainedRefs.length} 条必需证据并正确选择 ${result.state}。`,
      userConclusion:
        failures.length > 0
          ? '不通过：证据对齐判断仍存在错删、漏删或错误阻断。'
          : baselineLeakRefs.length > 0
            ? '通过：跨题证据被移出消费集合，同时保留了场景所需证据。'
            : '通过：Gate 没有为了过滤而破坏宽泛查询或冲突证据的正确保留。',
      improvementSuggestions:
        failures.length > 0
          ? failures.map(
              (failure) =>
                `${failure.key} 期望 ${formatValue(failure.expected)}，实际 ${formatValue(failure.actual)}。`,
            )
          : [
              '继续从线上 memory service 抽样新增 subject/scene/claim-slot 组合，保持零串场与必需证据全保留。',
            ],
      actualOutput: {
        state: result.state,
        receipt: result.receipt,
        baseline: {
          includedEvidenceRefs: baselineIncluded,
          leakRefs: baselineLeakRefs,
          precision: baselinePrecision,
        },
        gated: {
          includedEvidenceRefs: result.includedEvidenceRefs,
          excluded: result.excluded,
          leakRefs: gatedLeakRefs,
          precision: gatedPrecision,
          requiredEvidenceRecall,
          leakageReduction,
          unexpectedDrops,
        },
        proofChecks,
      },
      topMatch: {
        id: result.primaryCluster?.id ?? caseItem.id,
        title: result.primaryCluster?.label ?? caseItem.title,
        sourceLabel: result.receipt.primarySubject ?? result.state,
        displayPriority: result.state,
        whyRelevant: [
          `baselineLeaks=${baselineLeakRefs.length}`,
          `gatedLeaks=${gatedLeakRefs.length}`,
          `requiredRecall=${requiredEvidenceRecall}%`,
          `clusters=${result.receipt.clusterCount}`,
        ],
      },
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.log(
    JSON.stringify({
      status: 'error',
      verdict: 'error',
      scores: {
        stateSelection: 0,
        evidencePrecision: 0,
        evidenceRetention: 0,
        leakageReduction: 0,
        actionBoundary: 0,
      },
      overallScore: 0,
      why: message,
      userConclusion: 'Evidence Cohesion Gate eval 执行失败，无法判断取证边界。',
      improvementSuggestions: ['检查场景结构、Gate import 和 tsx runner 输出。'],
      actualOutput: { error: message },
    }),
  );
  process.exitCode = 1;
}

function isBlockingState(state: EvidenceCohesionState): boolean {
  return (
    state === 'split_required' ||
    state === 'insufficient_anchor' ||
    state === 'blocked_cross_scene'
  );
}

function check(key: string, expected: unknown, actual: unknown): ProofCheck {
  return {
    key,
    expected,
    actual,
    passed: Object.is(expected, actual),
  };
}

function checkSet(
  key: string,
  expected: string[],
  actual: string[],
): ProofCheck {
  const normalizedExpected = [...new Set(expected)].sort();
  const normalizedActual = [...new Set(actual)].sort();
  return {
    key,
    expected: normalizedExpected,
    actual: normalizedActual,
    passed: JSON.stringify(normalizedExpected) === JSON.stringify(normalizedActual),
  };
}

function percentage(
  numerator: number,
  denominator: number,
  emptyValue = 0,
): number {
  if (denominator <= 0) return emptyValue;
  return Math.round((numerator / denominator) * 100);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
