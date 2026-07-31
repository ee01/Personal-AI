import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ActionReadinessService } from '../memory-service/src/core/ActionReadinessService.js';
import { MarkdownManager } from '../memory-service/src/core/MarkdownManager.js';
import { ReflectionResearcher } from '../memory-service/src/core/ReflectionResearcher.js';
import { ReflectionThreadService } from '../memory-service/src/core/ReflectionThreadService.js';
import { ReflectionWorker } from '../memory-service/src/core/ReflectionWorker.js';
import { ActionExecutor } from '../memory-service/src/core/actions/ActionExecutor.js';
import { ActionRepository } from '../memory-service/src/repositories/ActionRepository.js';
import { ReflectionThreadRepository } from '../memory-service/src/repositories/ReflectionThreadRepository.js';
import { UserDataManager } from '../memory-service/src/storage/UserDataManager.js';
import {
  cleanupTestDb,
  getTestDb,
} from '../memory-service/src/__tests__/setup.js';
import { now } from '../memory-service/src/utils/time.js';

interface ActionReadinessEvalCase {
  id: string;
  title: string;
  kind:
    | 'auth_scope_block'
    | 'probe_unlock'
    | 'missing_input'
    | 'missing_proof'
    | 'reflection_suppression';
  scenario?: string;
  action?: Record<string, unknown>;
  expectedBehavior: Record<string, unknown>;
}

interface ProofCheck {
  key: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

const casePath = process.argv[2];
if (!casePath) {
  throw new Error('Usage: eval-action-readiness-contracts.ts <case-json-path>');
}

const caseItem = JSON.parse(
  fs.readFileSync(casePath, 'utf8'),
) as ActionReadinessEvalCase;
const db = getTestDb();
const actionRepo = new ActionRepository(db);
const originalFetch = globalThis.fetch;
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readiness-eval-'));
const userDataManager = new UserDataManager();
userDataManager.initialize(tempDir);
userDataManager.writeFile(
  'config.json',
  JSON.stringify({
    openClawEnabled: true,
    openClawBaseUrl: 'https://openclaw.eval.local',
    openClawApiKey: 'eval-key',
    reflectionEnabled: true,
  }),
);

try {
  const actual = await runScenario(caseItem);
  const proofChecks = buildProofChecks(
    actual,
    caseItem.expectedBehavior ?? {},
  );
  const failures = proofChecks.filter((check) => !check.passed);
  const scores = {
    preDispatchGate: scoreChecks(proofChecks, [
      'attemptCount',
      'retryCount',
      'networkCalls',
      'decision',
      'secondResultStatus',
    ]),
    sideEffectBoundary: scoreChecks(proofChecks, [
      'probeOnly',
      'originalActionExecuted',
      'originalTaskAbsent',
      'approvalMissing',
      'actionResultCount',
      'dispatchState',
      'secondDispatchState',
    ]),
    contractState: scoreChecks(
      proofChecks,
      proofChecks
        .filter((check) => check.key.toLowerCase().includes('status'))
        .map((check) => check.key),
    ),
    queueHygiene: scoreChecks(proofChecks, [
      'queueStatus',
      'secondQueueStatus',
      'recoveryDelta',
      'persistedReflectionActionCount',
      'returnedActionCount',
      'readinessLinkCount',
    ]),
  };
  const verdict = failures.length > 0 ? 'fail' : 'pass';

  console.log(
    JSON.stringify({
      status: verdict,
      verdict,
      scores,
      overallScore: scoreAverage(scores),
      why:
        failures.length > 0
          ? `${failures[0].key}: expected ${formatValue(failures[0].expected)}, got ${formatValue(failures[0].actual)}`
          : 'dispatch 前门禁、probe 无原任务边界、证据要求和队列抑制均符合预期。',
      userConclusion:
        failures.length > 0
          ? '不通过：至少一个场景仍可能在未就绪时消耗执行、泄露原任务或制造队列债务。'
          : '通过：已知阻断会在原动作执行前生效，重测不提交原任务，成功后才恢复原操作入口。',
      improvementSuggestions:
        failures.length > 0
          ? failures.map(
              (failure) =>
                `${failure.key} 期望 ${formatValue(failure.expected)}，实际 ${formatValue(failure.actual)}。`,
            )
          : [
              '上线前继续用真实 OpenClaw/Jira/Drive 凭据做人工 smoke test；本地 eval 不证明线上 connector 当前可用。',
            ],
      actualOutput: {
        scenario: caseItem.scenario,
        ...actual,
        proofChecks,
        notProved:
          '网络响应由本地 fixture 模拟；未验证线上 OpenClaw、Jira、Drive 或其他第三方系统的实时可用性。',
      },
      topMatch: {
        id: String(actual.contractScope ?? caseItem.id),
        title: caseItem.title,
        sourceLabel: String(actual.contractScope ?? 'action readiness'),
        displayPriority: String(actual.contractStatus ?? verdict),
        whyRelevant: proofChecks
          .filter((check) => check.passed)
          .slice(0, 5)
          .map((check) => `${check.key}=${formatValue(check.actual)}`),
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
        preDispatchGate: 0,
        sideEffectBoundary: 0,
        contractState: 0,
        queueHygiene: 0,
      },
      overallScore: 0,
      why: message,
      userConclusion: 'Action Readiness eval 执行失败，无法判断门禁是否有效。',
      improvementSuggestions: [
        '检查临时数据库迁移、OpenClaw fixture 和场景 runner 的错误。',
      ],
      actualOutput: { error: message },
    }),
  );
  process.exitCode = 1;
} finally {
  globalThis.fetch = originalFetch;
  fs.rmSync(tempDir, { recursive: true, force: true });
  cleanupTestDb();
}

async function runScenario(
  input: ActionReadinessEvalCase,
): Promise<Record<string, unknown>> {
  switch (input.kind) {
    case 'auth_scope_block':
      return runAuthScopeBlock(input);
    case 'probe_unlock':
      return runProbeUnlock(input);
    case 'missing_input':
      return runMissingInput(input);
    case 'missing_proof':
      return runMissingProof(input);
    case 'reflection_suppression':
      return runReflectionSuppression(input);
  }
}

async function runAuthScopeBlock(
  input: ActionReadinessEvalCase,
): Promise<Record<string, unknown>> {
  const action = input.action ?? {};
  let networkCalls = 0;
  globalThis.fetch = (async () => {
    networkCalls += 1;
    return jsonResponse(401, { error: 'unauthorized' });
  }) as typeof fetch;

  const first = actionRepo.create({
    actionType: 'delegate_openclaw',
    title: '查询第一条 Jira 事实',
    params: {
      task: String(action.firstTask ?? '查询第一条 Jira 事实。'),
      mode: action.mode === 'write' ? 'write' : 'read',
      targetSystem: String(action.targetSystem ?? 'jira'),
    },
    executionMode: 'auto',
    requiresApproval: false,
    queueStatus: 'queued',
  });
  const executor = new ActionExecutor(db, userDataManager, 'eval-user');
  const firstResult = await executor.executeAction(first.id);
  const recoveryBefore = countRows(
    `SELECT COUNT(*) AS count
       FROM proposed_actions
      WHERE source_kind = 'delegation_recovery'`,
  );

  const second = actionRepo.create({
    actionType: 'delegate_openclaw',
    title: '查询第二条 Jira 事实',
    params: {
      task: String(action.secondTask ?? '查询第二条 Jira 事实。'),
      mode: action.mode === 'write' ? 'write' : 'read',
      targetSystem: String(action.targetSystem ?? 'jira'),
    },
    executionMode: 'auto',
    requiresApproval: false,
    queueStatus: 'queued',
  });
  const secondResult = await executor.executeAction(second.id);
  const recoveryAfter = countRows(
    `SELECT COUNT(*) AS count
       FROM proposed_actions
      WHERE source_kind = 'delegation_recovery'`,
  );
  const updatedSecond = actionRepo.getById(second.id);
  const readiness = new ActionReadinessService(
    db,
    userDataManager,
    'eval-user',
  );

  return {
    contractScope: 'openclaw:global',
    firstQueueStatus: firstResult.queueStatus,
    contractStatus: readiness.getByScopeKey('openclaw:global')?.status,
    secondResultStatus: secondResult.result?.status,
    secondDispatchState: secondResult.readinessReceipt?.dispatchState,
    secondQueueStatus: updatedSecond?.queueStatus,
    retryCount: updatedSecond?.retryCount,
    attemptCount: countRows(
      'SELECT COUNT(*) AS count FROM proposed_action_attempts WHERE action_id = ?',
      second.id,
    ),
    networkCalls,
    recoveryDelta: recoveryAfter - recoveryBefore,
  };
}

async function runProbeUnlock(
  input: ActionReadinessEvalCase,
): Promise<Record<string, unknown>> {
  const action = input.action ?? {};
  const originalTask = String(
    action.task ?? '把 release.zip 上传到 Google Drive。',
  );
  const queued = actionRepo.create({
    actionType: 'delegate_openclaw',
    title: '上传发布文件',
    params: {
      task: originalTask,
      mode: action.mode === 'read' ? 'read' : 'write',
      targetSystem: String(action.targetSystem ?? 'google_drive'),
    },
    executionMode: 'manual',
    requiresApproval: action.requiresApproval !== false,
    queueStatus: 'queued',
  });
  const readiness = new ActionReadinessService(
    db,
    userDataManager,
    'eval-user',
  );
  readiness.recordDelegationOutcome(queued, {
    status: 'auth_error',
    summary: 'Google Drive connector authorization expired.',
    artifacts: [],
  });
  const initialStatus = readiness.checkAction(queued).receipt.status;
  const requestBodies: unknown[] = [];
  globalThis.fetch = (async (_request, init) => {
    requestBodies.push(parseBody(init?.body));
    return jsonResponse(200, {
      output_text: JSON.stringify({
        status: 'success',
        summary: 'Google Drive capability is reachable.',
        artifacts: [
          {
            kind: 'readiness_probe',
            title: 'Drive readiness',
            content: 'Connector authorization and capability metadata are available.',
            metadata: {
              sourceSystem: 'google_drive',
              entityKey: 'readiness-probe',
              verification: 'connector_capability_check',
              observedFields: ['connection', 'authorization', 'capability'],
            },
          },
        ],
      }),
    });
  }) as typeof fetch;

  const probe = await readiness.probeAction(queued);
  const requestText = JSON.stringify(requestBodies[0] ?? {});
  const updated = actionRepo.getById(queued.id);

  return {
    contractScope: `openclaw:${String(action.targetSystem ?? 'google_drive')}:${action.mode === 'read' ? 'read' : 'write'}`,
    initialStatus,
    decision: probe.decision,
    contractStatus: probe.receipt.status,
    globalStatus: readiness.getByScopeKey('openclaw:global')?.status,
    queueStatus: updated?.queueStatus,
    approvalMissing: !updated?.approvedAt,
    networkCalls: requestBodies.length,
    probeOnly: probe.probeReceipt.probeOnly,
    originalActionExecuted: probe.probeReceipt.originalActionExecuted,
    probePromptContainsBoundary: requestText.includes('Readiness probe only'),
    originalTaskAbsent: !requestText.includes(originalTask),
  };
}

async function runMissingInput(
  input: ActionReadinessEvalCase,
): Promise<Record<string, unknown>> {
  const action = input.action ?? {};
  const requiredInputs = Array.isArray(action.requiredInputs)
    ? action.requiredInputs.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];
  let networkCalls = 0;
  globalThis.fetch = (async () => {
    networkCalls += 1;
    return jsonResponse(500, { error: 'unexpected network call' });
  }) as typeof fetch;
  const queued = actionRepo.create({
    actionType: 'delegate_openclaw',
    title: '上传消息附件',
    params: {
      ...(asRecord(action.params) ?? {}),
      task: String(action.task ?? '上传附件到目标目录。'),
      mode: action.mode === 'read' ? 'read' : 'write',
      targetSystem: String(action.targetSystem ?? 'google_drive'),
      readinessRequiredInputs: requiredInputs,
    },
    executionMode: 'manual',
    requiresApproval: true,
    queueStatus: 'queued',
  });
  const readiness = new ActionReadinessService(
    db,
    userDataManager,
    'eval-user',
  );
  const check = readiness.checkAction(queued);
  const probe = await readiness.probeAction(queued);
  const updated = actionRepo.getById(queued.id);

  return {
    contractScope: check.receipt.scopeKey,
    contractStatus: check.receipt.status,
    dispatchState: check.receipt.dispatchState,
    decision: probe.decision,
    requiredInputs: check.receipt.requiredInputs,
    networkCalls,
    retryCount: updated?.retryCount,
    queueStatus: updated?.queueStatus,
    originalActionExecuted: probe.probeReceipt.originalActionExecuted,
  };
}

async function runMissingProof(
  input: ActionReadinessEvalCase,
): Promise<Record<string, unknown>> {
  const action = input.action ?? {};
  let networkCalls = 0;
  globalThis.fetch = (async () => {
    networkCalls += 1;
    return jsonResponse(200, {
      output_text: JSON.stringify({
        status: 'success',
        summary: 'Status check completed.',
        artifacts: [],
      }),
    });
  }) as typeof fetch;
  const queued = actionRepo.create({
    actionType: 'delegate_openclaw',
    title: '检查 AI tool status',
    params: {
      task: String(action.task ?? '检查 AI tool status。'),
      mode: action.mode === 'write' ? 'write' : 'read',
      targetSystem: String(action.targetSystem ?? 'web_status'),
    },
    executionMode: 'manual',
    requiresApproval: false,
    queueStatus: 'queued',
  });
  const result = await new ActionExecutor(
    db,
    userDataManager,
    'eval-user',
  ).executeAction(queued.id);
  const updated = actionRepo.getById(queued.id);
  const resultPayload = asRecord(updated?.result?.payload);
  const readiness = new ActionReadinessService(
    db,
    userDataManager,
    'eval-user',
  );
  const scope = `openclaw:${String(action.targetSystem ?? 'web_status')}:${action.mode === 'write' ? 'write' : 'read'}`;
  const readinessReceipt = updated
    ? readiness.checkAction(updated).receipt
    : undefined;

  return {
    contractScope: scope,
    resultQueueStatus: result.queueStatus,
    resultStatus: updated?.result?.status,
    contractStatus: readiness.getByScopeKey(scope)?.status,
    dispatchState: readinessReceipt?.dispatchState,
    artifactValidation: resultPayload?.artifactValidation,
    networkCalls,
    attemptCount: countRows(
      'SELECT COUNT(*) AS count FROM proposed_action_attempts WHERE action_id = ?',
      queued.id,
    ),
    actionResultCount: countRows(
      'SELECT COUNT(*) AS count FROM action_results WHERE action_id = ?',
      queued.id,
    ),
  };
}

async function runReflectionSuppression(
  input: ActionReadinessEvalCase,
): Promise<Record<string, unknown>> {
  const action = input.action ?? {};
  const proposalCount = Math.max(1, Number(action.proposalCount ?? 3));
  let networkCalls = 0;
  globalThis.fetch = (async () => {
    networkCalls += 1;
    return jsonResponse(500, { error: 'unexpected network call' });
  }) as typeof fetch;
  const seed = actionRepo.create({
    actionType: 'delegate_openclaw',
    title: 'Seed blocked OpenClaw gateway',
    params: {
      task: 'Probe Jira.',
      mode: 'read',
      targetSystem: String(action.targetSystem ?? 'jira'),
    },
    executionMode: 'auto',
    queueStatus: 'failed',
  });
  const readiness = new ActionReadinessService(
    db,
    userDataManager,
    'eval-user',
  );
  readiness.recordDelegationOutcome(seed, {
    status: 'auth_error',
    summary: 'OpenClaw gateway authorization failed.',
    artifacts: [],
    payload: { httpStatus: 401 },
  });

  const thread = new ReflectionThreadRepository(db).upsertThread({
    topicKey: `eval:readiness:${input.id}`,
    title: '项目反思: Action Readiness',
    status: 'active',
    priority: 8,
    salience: 0.9,
    nextReflectionAt: now(),
  });
  const originalPlan = ReflectionResearcher.prototype.plan;
  const originalGenerate = ReflectionWorker.prototype.generate;
  const originalReindexFile = MarkdownManager.prototype.reindexFile;
  ReflectionResearcher.prototype.plan = async () => [];
  MarkdownManager.prototype.reindexFile = async () => 0;
  ReflectionWorker.prototype.generate = async () => ({
    summary: '需要继续外部核实，但当前执行能力被阻断。',
    discoveries: [],
    openQuestions: ['Jira 状态是否变化？'],
    actionProposals: Array.from({ length: proposalCount }, (_, index) => ({
      actionType: 'delegate_openclaw' as const,
      title: `继续查询 Jira ${index + 1}`,
      params: {
        task: `查询 Jira issue ${index + 1}。`,
        mode: 'read',
        targetSystem: String(action.targetSystem ?? 'jira'),
      },
      executionMode: 'auto' as const,
      requiresApproval: false,
    })),
    markdownBody: '# readiness reflection',
  });

  try {
    const result = await new ReflectionThreadService(
      db,
      userDataManager,
      'eval-user',
    ).runReflection(thread.id, {
      runType: 'manual_revisit',
      triggerType: 'manual',
      force: true,
    });

    return {
      contractScope: 'openclaw:global',
      contractStatus: readiness.getByScopeKey('openclaw:global')?.status,
      generatedProposalCount: proposalCount,
      persistedReflectionActionCount: countRows(
        `SELECT COUNT(*) AS count
           FROM proposed_actions
          WHERE source_kind = 'reflection_run'`,
      ),
      returnedActionCount: result.actions.length,
      readinessLinkCount: countRows(
        `SELECT COUNT(*) AS count
           FROM action_readiness_links
          WHERE source_kind = 'reflection_thread'
            AND source_ref_id = ?`,
        thread.id,
      ),
      networkCalls,
    };
  } finally {
    ReflectionResearcher.prototype.plan = originalPlan;
    ReflectionWorker.prototype.generate = originalGenerate;
    MarkdownManager.prototype.reindexFile = originalReindexFile;
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function parseBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') return body ?? null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return body;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function countRows(sql: string, ...params: unknown[]): number {
  const row = db.prepare(sql).get(...params) as { count?: number } | undefined;
  return Number(row?.count ?? 0);
}

function buildProofChecks(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): ProofCheck[] {
  return Object.entries(expected).map(([key, expectedValue]) => ({
    key,
    expected: expectedValue,
    actual: actual[key],
    passed: valuesEqual(actual[key], expectedValue),
  }));
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
  if (expected && typeof expected === 'object') {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
  return actual === expected;
}

function scoreChecks(checks: ProofCheck[], keys: string[]): number {
  const selected = checks.filter((check) => keys.includes(check.key));
  if (selected.length === 0) return 100;
  return Math.round(
    (selected.filter((check) => check.passed).length / selected.length) * 100,
  );
}

function scoreAverage(scores: Record<string, number>): number {
  const values = Object.values(scores);
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
