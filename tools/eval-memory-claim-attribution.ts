import { createHash } from 'node:crypto';
import fs from 'node:fs';

import type BetterSqlite3 from 'better-sqlite3';

import { MemoryClaimAttributionService } from '../memory-service/src/core/MemoryClaimAttributionService.js';
import { MemoryClaimCorrectionService } from '../memory-service/src/core/MemoryClaimCorrectionService.js';
import { MemoryClaimRepository } from '../memory-service/src/repositories/MemoryClaimRepository.js';
import {
  cleanupTestDb,
  getTestDb,
} from '../memory-service/src/__tests__/setup.js';
import type {
  ClaimAttributionReceipt,
  IngestClaimAttributionDecision,
  MemoryClaimCorrectionRequest,
  MemoryClaimEnvelope,
} from '../memory-service/src/types/index.js';

interface EvalInput {
  sourceMessageId: string;
  sourceType: string;
  sender?: string;
  metadata?: Record<string, unknown>;
  content: string;
}

interface ClaimExpectation {
  textIncludes: string;
  ownerKind?: string;
  speechMode?: string;
  polarity?: string;
  timeBasis?: string;
  verification?: string;
  commitment?: string;
  profileCandidate?: boolean;
  currentTruthCandidate?: boolean;
  actionCandidate?: boolean;
  passiveRecall?: string;
}

interface ExpectedBehavior {
  claimCount?: number;
  claimCountMin?: number;
  claimExpectations?: ClaimExpectation[];
  allOwners?: string;
  allPassiveRecall?: string;
  profileCandidateCount?: number;
  currentTruthCandidateCount?: number;
  actionCandidateCount?: number;
  assignedCount?: number;
  acceptedCount?: number;
  verifiedCompletionCount?: number;
  messageAttributionStatus?: string;
  rawPersisted?: boolean;
  rawSourceUnchanged?: boolean;
  receiptRequired?: boolean;
  receiptVisibility?: string;
  receiptStatus?: string;
  initialOwnerKind?: string;
  initialCurrentTruthCandidate?: boolean;
  correctedOwnerKind?: string;
  correctedSpeechMode?: string;
  correctedCurrentTruthCandidate?: boolean;
  correctedActionCandidate?: boolean;
  revision?: number;
  rawSourceChanged?: boolean;
  correctionSignal?: string;
}

interface MemoryClaimAttributionEvalCase {
  id: string;
  title: string;
  kind: string;
  scenario: string;
  sampleContext: {
    input: EvalInput;
    sourceProvenance?: Array<Record<string, unknown>>;
    forceResolverFailure?: boolean;
    correction?: MemoryClaimCorrectionRequest;
  };
  expectedBehavior: ExpectedBehavior;
}

type ScoreCategory =
  | 'attributionAccuracy'
  | 'policySafety'
  | 'commitmentBoundary'
  | 'failureClosure'
  | 'correctionIntegrity'
  | 'receiptNoiseControl';

interface ProofCheck {
  key: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
  categories: ScoreCategory[];
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-memory-claim-attribution.ts <case-json-path>');
}

const caseItem = JSON.parse(
  fs.readFileSync(casePath, 'utf8'),
) as MemoryClaimAttributionEvalCase;
const db = getTestDb();

try {
  const input = caseItem.sampleContext.input;
  insertRawMessage(db, input);
  const rawBefore = readRawMessage(db, input.sourceMessageId);
  const rawBeforeHash = hashText(rawBefore?.content ?? '');
  const repository = new MemoryClaimRepository(db);
  const attributionService = new MemoryClaimAttributionService(
    db,
    caseItem.sampleContext.forceResolverFailure
      ? {
          segmenter: () => {
            throw new Error('eval_forced_claim_resolver_failure');
          },
        }
      : undefined,
  );

  const decision = await Promise.resolve(
    attributionService.ensureForMessage(input.sourceMessageId),
  );
  const initialClaims = repository.getClaimsForMessage(input.sourceMessageId);
  let claims = initialClaims;
  let correctionResponse: ReturnType<MemoryClaimCorrectionService['correct']> | null = null;

  if (caseItem.sampleContext.correction) {
    const target = selectCorrectionTarget(initialClaims);
    if (!target) {
      throw new Error('Correction eval produced no active claim to correct.');
    }
    correctionResponse = new MemoryClaimCorrectionService(db).correct(
      target.id,
      caseItem.sampleContext.correction,
    );
    claims = repository.getClaimsForMessage(input.sourceMessageId);
  }

  const receipt = correctionResponse
    ? attributionService.buildReceipt(claims, {
        // The correction invalidated a previously eligible current-truth
        // candidate. Production consumers must surface that consequence as a
        // review receipt even though the corrected claim is now fail-closed.
        affectedHighResponsibility: true,
      })
    : decision.receipt;
  const messageState = repository.getMessageState(input.sourceMessageId);
  const rawAfter = readRawMessage(db, input.sourceMessageId);
  const rawAfterHash = hashText(rawAfter?.content ?? '');
  const actual = buildActual({
    decision,
    messageState: messageState?.status,
    initialClaims,
    claims,
    receipt,
    correctionResponse,
    rawBefore,
    rawAfter,
    rawBeforeHash,
    rawAfterHash,
  });
  const proofChecks = buildProofChecks(
    caseItem,
    initialClaims,
    claims,
    actual,
  );
  const failures = proofChecks.filter((check) => !check.passed);
  const status = failures.length === 0 ? 'pass' : 'fail';
  const scores = buildScores(proofChecks);

  console.log(
    JSON.stringify({
      status,
      verdict: status,
      scores,
      overallScore: average(Object.values(scores)),
      why:
        failures.length > 0
          ? `${failures[0].key}: expected ${formatValue(failures[0].expected)}, got ${formatValue(failures[0].actual)}`
          : `全部 ${proofChecks.length} 项生产契约检查通过；claims=${claims.length}，status=${messageState?.status ?? 'missing'}，receipt=${receipt?.visibility ?? 'silent'}。`,
      userConclusion:
        status === 'pass'
          ? buildPassingConclusion(caseItem.kind, receipt)
          : '不通过：主张归属、失败关闭、承诺状态、纠正完整性或低打扰回执至少有一项偏离预期。',
      improvementSuggestions:
        status === 'pass'
          ? ['继续加入脱敏的嵌套引用、否定、ASR 错词与中英混合样本，并保持 hard gate 为发布阻断项。']
          : failures.map(
              (failure) =>
                `${failure.key} 期望 ${formatValue(failure.expected)}，实际 ${formatValue(failure.actual)}。`,
            ),
      actualOutput: {
        sourceProvenance: caseItem.sampleContext.sourceProvenance ?? [],
        decision,
        messageState,
        initialClaims: initialClaims.map(summarizeClaim),
        claims: claims.map(summarizeClaim),
        receipt: receipt ?? null,
        correctionResponse: correctionResponse
          ? {
              claimId: correctionResponse.claimId,
              revision: correctionResponse.revision,
              invalidatedDerived: correctionResponse.invalidatedDerived,
              recomputeStatus: correctionResponse.recomputeStatus,
              rawSourceChanged: correctionResponse.rawSourceChanged,
            }
          : null,
        rawProof: {
          persistedBefore: Boolean(rawBefore),
          persistedAfter: Boolean(rawAfter),
          beforeHash: rawBeforeHash,
          afterHash: rawAfterHash,
          contentEqual: rawBefore?.content === rawAfter?.content,
        },
        actual,
        proofChecks,
      },
      topMatch: {
        id: claims[0]?.id ?? caseItem.id,
        title: claims[0]?.normalizedClaim ?? caseItem.title,
        sourceLabel: input.sourceType,
        displayPriority: status === 'pass' ? 'p1' : 'hidden',
        whyRelevant: proofChecks.map(
          (check) => `${check.key}=${check.passed ? 'pass' : 'fail'}`,
        ),
      },
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.log(
    JSON.stringify({
      status: 'error',
      verdict: 'error',
      scores: zeroScores(),
      overallScore: 0,
      why: message,
      userConclusion:
        'Memory Claim Attribution eval 执行失败，不能把 runner 异常当作归属失败关闭已经通过。',
      improvementSuggestions: [
        '检查 case 输入、migration、生产 attribution/correction service import 和 tsx runner 输出。',
      ],
      actualOutput: { error: message },
    }),
  );
  process.exitCode = 1;
} finally {
  cleanupTestDb();
}

function insertRawMessage(
  database: BetterSqlite3.Database,
  input: EvalInput,
): void {
  const timestamp = Math.floor(Date.now() / 1000);
  database
    .prepare(
      `INSERT INTO messages_raw (
         id, content, source_type, sender, timestamp, metadata_json,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.sourceMessageId,
      input.content,
      input.sourceType,
      input.sender ?? null,
      timestamp,
      JSON.stringify(input.metadata ?? {}),
      timestamp,
      timestamp,
    );
}

function readRawMessage(
  database: BetterSqlite3.Database,
  messageId: string,
): { id: string; content: string; metadata_json: string | null } | null {
  const row = database
    .prepare('SELECT id, content, metadata_json FROM messages_raw WHERE id = ?')
    .get(messageId) as
    | { id: string; content: string; metadata_json: string | null }
    | undefined;
  return row ?? null;
}

function selectCorrectionTarget(
  claims: MemoryClaimEnvelope[],
): MemoryClaimEnvelope | null {
  return (
    claims.find(
      (claim) =>
        claim.owner.kind === 'self' && claim.policy.currentTruthCandidate,
    ) ??
    claims[0] ??
    null
  );
}

function buildActual(args: {
  decision: IngestClaimAttributionDecision;
  messageState?: string;
  initialClaims: MemoryClaimEnvelope[];
  claims: MemoryClaimEnvelope[];
  receipt?: ClaimAttributionReceipt;
  correctionResponse: ReturnType<MemoryClaimCorrectionService['correct']> | null;
  rawBefore: { content: string } | null;
  rawAfter: { content: string } | null;
  rawBeforeHash: string;
  rawAfterHash: string;
}): Record<string, unknown> {
  const { initialClaims, claims, receipt, correctionResponse } = args;
  const initial = selectCorrectionTarget(initialClaims);
  const corrected = correctionResponse?.current;
  return {
    messageAttributionStatus: args.messageState ?? args.decision.status,
    claimCount: claims.length,
    profileCandidateCount: claims.filter(
      (claim) => claim.policy.profileCandidate,
    ).length,
    currentTruthCandidateCount: claims.filter(
      (claim) => claim.policy.currentTruthCandidate,
    ).length,
    actionCandidateCount: claims.filter(
      (claim) => claim.policy.actionCandidate,
    ).length,
    assignedCount: claims.filter((claim) => claim.commitment === 'assigned').length,
    acceptedCount: claims.filter((claim) => claim.commitment === 'accepted').length,
    verifiedCompletionCount: claims.filter(
      (claim) => claim.verification === 'verified_completion',
    ).length,
    allOwners:
      claims.length > 0 && claims.every((claim) => claim.owner.kind === claims[0].owner.kind)
        ? claims[0].owner.kind
        : 'mixed',
    allPassiveRecall:
      claims.length > 0 &&
      claims.every(
        (claim) =>
          claim.policy.passiveRecall === claims[0].policy.passiveRecall,
      )
        ? claims[0].policy.passiveRecall
        : 'mixed',
    rawPersisted: Boolean(args.rawAfter),
    rawSourceUnchanged:
      Boolean(args.rawBefore) &&
      Boolean(args.rawAfter) &&
      args.rawBefore?.content === args.rawAfter?.content &&
      args.rawBeforeHash === args.rawAfterHash,
    receiptRequired: Boolean(receipt),
    receiptVisibility: receipt?.visibility ?? 'silent',
    receiptStatus: receipt?.status,
    initialOwnerKind: initial?.owner.kind,
    initialCurrentTruthCandidate: initial?.policy.currentTruthCandidate,
    correctedOwnerKind: corrected?.owner.kind,
    correctedSpeechMode: corrected?.speechMode,
    correctedCurrentTruthCandidate: corrected?.policy.currentTruthCandidate,
    correctedActionCandidate: corrected?.policy.actionCandidate,
    revision: correctionResponse?.revision,
    rawSourceChanged: correctionResponse?.rawSourceChanged,
    correctionSignal: corrected?.signals.includes('user_correction')
      ? 'user_correction'
      : undefined,
  };
}

function buildProofChecks(
  evalCase: MemoryClaimAttributionEvalCase,
  initialClaims: MemoryClaimEnvelope[],
  claims: MemoryClaimEnvelope[],
  actual: Record<string, unknown>,
): ProofCheck[] {
  const expected = evalCase.expectedBehavior;
  const checks: ProofCheck[] = [];
  const add = (
    key: string,
    expectedValue: unknown,
    actualValue: unknown,
    categories: ScoreCategory[],
    comparator: (actualValue: unknown, expectedValue: unknown) => boolean = Object.is,
  ): void => {
    checks.push({
      key,
      expected: expectedValue,
      actual: actualValue,
      passed: comparator(actualValue, expectedValue),
      categories,
    });
  };

  if (expected.claimCount != null) {
    add(
      'claimCount',
      expected.claimCount,
      actual.claimCount,
      ['attributionAccuracy'],
    );
  }
  if (expected.claimCountMin != null) {
    add(
      'claimCountMin',
      expected.claimCountMin,
      actual.claimCount,
      ['attributionAccuracy'],
      (actualValue, expectedValue) => Number(actualValue) >= Number(expectedValue),
    );
  }

  for (const [index, claimExpectation] of (
    expected.claimExpectations ?? []
  ).entries()) {
    const claim = findClaim(claims, claimExpectation.textIncludes);
    add(
      `claimExpectations[${index}].matched`,
      true,
      Boolean(claim),
      ['attributionAccuracy'],
    );
    if (!claim) continue;
    const fieldMap: Array<[
      keyof ClaimExpectation,
      unknown,
      ScoreCategory[],
    ]> = [
      ['ownerKind', claim.owner.kind, ['attributionAccuracy']],
      ['speechMode', claim.speechMode, ['attributionAccuracy']],
      ['polarity', claim.polarity, ['attributionAccuracy']],
      ['timeBasis', claim.timeBasis, ['attributionAccuracy']],
      ['verification', claim.verification, ['attributionAccuracy']],
      [
        'commitment',
        claim.commitment,
        ['attributionAccuracy', 'commitmentBoundary'],
      ],
      ['profileCandidate', claim.policy.profileCandidate, ['policySafety']],
      [
        'currentTruthCandidate',
        claim.policy.currentTruthCandidate,
        ['policySafety'],
      ],
      ['actionCandidate', claim.policy.actionCandidate, ['policySafety']],
      ['passiveRecall', claim.policy.passiveRecall, ['policySafety']],
    ];
    for (const [field, actualValue, categories] of fieldMap) {
      if (claimExpectation[field] === undefined) continue;
      add(
        `claimExpectations[${index}].${field}`,
        claimExpectation[field],
        actualValue,
        categories,
      );
    }
  }

  const aggregateChecks: Array<[
    keyof ExpectedBehavior,
    ScoreCategory[],
  ]> = [
    ['allOwners', ['attributionAccuracy', 'policySafety', 'failureClosure']],
    ['allPassiveRecall', ['policySafety', 'failureClosure']],
    ['profileCandidateCount', ['policySafety', 'failureClosure']],
    ['currentTruthCandidateCount', ['policySafety', 'failureClosure']],
    ['actionCandidateCount', ['policySafety', 'commitmentBoundary', 'failureClosure']],
    ['assignedCount', ['commitmentBoundary']],
    ['acceptedCount', ['commitmentBoundary']],
    ['verifiedCompletionCount', ['commitmentBoundary', 'policySafety']],
    ['messageAttributionStatus', ['failureClosure']],
    ['rawPersisted', ['failureClosure', 'correctionIntegrity']],
    ['rawSourceUnchanged', ['failureClosure', 'correctionIntegrity']],
    ['receiptRequired', ['receiptNoiseControl']],
    ['receiptVisibility', ['receiptNoiseControl']],
    ['receiptStatus', ['receiptNoiseControl']],
    ['initialOwnerKind', ['correctionIntegrity']],
    ['initialCurrentTruthCandidate', ['correctionIntegrity', 'policySafety']],
    ['correctedOwnerKind', ['correctionIntegrity']],
    ['correctedSpeechMode', ['correctionIntegrity']],
    [
      'correctedCurrentTruthCandidate',
      ['correctionIntegrity', 'policySafety'],
    ],
    ['correctedActionCandidate', ['correctionIntegrity', 'policySafety']],
    ['revision', ['correctionIntegrity']],
    ['rawSourceChanged', ['correctionIntegrity']],
    ['correctionSignal', ['correctionIntegrity']],
  ];
  for (const [key, categories] of aggregateChecks) {
    if (expected[key] === undefined) continue;
    add(key, expected[key], actual[key], categories);
  }

  // An expected correction must compare the persisted pre-correction claim,
  // not only the post-correction response object.
  if (evalCase.sampleContext.correction) {
    add(
      'correction.initialClaimPersisted',
      true,
      initialClaims.length > 0,
      ['correctionIntegrity'],
    );
  }
  return checks;
}

function findClaim(
  claims: MemoryClaimEnvelope[],
  textIncludes: string,
): MemoryClaimEnvelope | undefined {
  const needle = textIncludes.trim().toLocaleLowerCase();
  return claims.find((claim) =>
    `${claim.sourceText}\n${claim.normalizedClaim}`
      .toLocaleLowerCase()
      .includes(needle),
  );
}

function summarizeClaim(claim: MemoryClaimEnvelope): Record<string, unknown> {
  return {
    id: claim.id,
    sourceSpan: claim.sourceSpan,
    sourceText: claim.sourceText,
    normalizedClaim: claim.normalizedClaim,
    owner: claim.owner,
    speechMode: claim.speechMode,
    polarity: claim.polarity,
    timeBasis: claim.timeBasis,
    verification: claim.verification,
    commitment: claim.commitment,
    confidence: claim.confidence,
    signals: claim.signals,
    policy: claim.policy,
    revision: claim.revision,
    corrected: claim.corrected,
  };
}

function buildScores(checks: ProofCheck[]): Record<ScoreCategory, number> {
  const categories: ScoreCategory[] = [
    'attributionAccuracy',
    'policySafety',
    'commitmentBoundary',
    'failureClosure',
    'correctionIntegrity',
    'receiptNoiseControl',
  ];
  return Object.fromEntries(
    categories.map((category) => [category, categoryScore(checks, category)]),
  ) as Record<ScoreCategory, number>;
}

function categoryScore(
  checks: ProofCheck[],
  category: ScoreCategory,
): number {
  const relevant = checks.filter((check) => check.categories.includes(category));
  if (relevant.length === 0) return 3;
  const ratio = relevant.filter((check) => check.passed).length / relevant.length;
  if (ratio === 1) return 3;
  if (ratio >= 0.75) return 2;
  if (ratio > 0) return 1;
  return 0;
}

function zeroScores(): Record<ScoreCategory, number> {
  return {
    attributionAccuracy: 0,
    policySafety: 0,
    commitmentBoundary: 0,
    failureClosure: 0,
    correctionIntegrity: 0,
    receiptNoiseControl: 0,
  };
}

function buildPassingConclusion(
  kind: string,
  receipt?: ClaimAttributionReceipt,
): string {
  if (kind === 'resolver_failure_fail_closed') {
    return '通过：受控归属解析失败保留了 raw，并以 failed 状态和零高责任候选关闭后续写入。';
  }
  if (kind === 'claim_correction_revision') {
    return '通过：用户纠正只追加 claim revision、重编消费 policy，原始消息保持不变。';
  }
  if (kind === 'low_noise_receipt') {
    return '通过：单一明确的本人主张在后台完成归属与门禁，没有增加新的用户界面回执。';
  }
  return `通过：生产 claim attribution 正确分离主张与高责任 policy${
    receipt ? `，仅按需返回 ${receipt.visibility} 回执` : ''
  }。`;
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Number(
    (values.reduce((total, value) => total + value, 0) / values.length).toFixed(
      2,
    ),
  );
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
