#!/usr/bin/env node
/**
 * One-off: poll OpenClaw by remoteRunId and apply envelope to a terminal action row.
 * Usage: node tools/reconcile-dead-letter-run.mjs <userId> <actionId>
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = process.env.MEMORY_SERVICE_ROOT || path.join(__dirname, '..');
const distRoot = path.join(appRoot, 'dist');

const userId = process.argv[2] || 'esone.qiu';
const actionId = process.argv[3] || '2162095e-8178-4c5e-b228-49660c68c74c';

const { UserContextManager } = await import(
  path.join(distRoot, 'core/UserContextManager.js')
);
const { ActionRepository } = await import(
  path.join(distRoot, 'repositories/ActionRepository.js')
);
const { ActionExecutor } = await import(
  path.join(distRoot, 'core/actions/ActionExecutor.js')
);
const { createAgentExecutor } = await import(
  path.join(distRoot, 'integrations/executors/executorFactory.js')
);
const { findEnabledExecutor } = await import(
  path.join(distRoot, 'integrations/executors/executorRegistry.js')
);
const { getUserRuntimeConfig } = await import(path.join(distRoot, 'runtimeConfig.js'));
const { readActionRemoteRunId } = await import(
  path.join(distRoot, 'integrations/executors/gatewayRunConfirm.js')
);
const { OpenClawDelegationService } = await import(
  path.join(distRoot, 'integrations/OpenClawDelegationService.js')
);

const baseDataDir = process.env.DATA_DIR || path.join(appRoot, 'data');
const manager = new UserContextManager(baseDataDir);
const ctx = manager.getContext(userId);
const repo = new ActionRepository(ctx.db);
const before = repo.getById(actionId);
if (!before) {
  console.error(JSON.stringify({ error: 'action not found', actionId }));
  process.exit(1);
}

const params = before.params || {};
const metadata =
  params.metadata && typeof params.metadata === 'object' ? params.metadata : {};
const requested = params.executor || metadata.executorId;
const runtimeConfig = getUserRuntimeConfig(ctx.userDataManager);
const executorInstance = findEnabledExecutor(runtimeConfig, requested);
if (!executorInstance) {
  console.error(JSON.stringify({ error: 'executor missing', requested }));
  process.exit(1);
}

const remoteRunId = readActionRemoteRunId(before.result);
if (!remoteRunId) {
  console.error(JSON.stringify({ error: 'no remoteRunId on action', actionId }));
  process.exit(1);
}

const delegationService = new OpenClawDelegationService(ctx.userDataManager);
const executor = createAgentExecutor(executorInstance, {
  delegationService,
  userId,
  defaultTimeoutMs: runtimeConfig.openClawTimeoutMs,
});
if (!executor.poll) {
  console.error(
    JSON.stringify({ error: 'poll unsupported', executorType: executorInstance.type }),
  );
  process.exit(1);
}

const envelope = await executor.poll(remoteRunId, undefined, {
  sessionKey:
    typeof before.result?.sessionKey === 'string' ? before.result.sessionKey : '',
  targetSystem:
    typeof params.targetSystem === 'string' ? params.targetSystem : undefined,
  mode: params.mode === 'write' ? 'write' : 'read',
  task: typeof params.task === 'string' ? params.task : before.title,
});

console.log(
  JSON.stringify(
    {
      phase: 'poll',
      status: envelope.status,
      summary: envelope.summary,
      artifactCount: envelope.artifacts?.length ?? 0,
      remoteRunId: envelope.remoteRunId,
    },
    null,
    2,
  ),
);

const actionExecutor = new ActionExecutor(ctx.db, ctx.userDataManager, userId);
const applied = await actionExecutor.applyWorkerEnvelope(actionId, envelope);
const after = repo.getById(actionId);

let deliveries = [];
try {
  deliveries = ctx.db
    .prepare(
      `SELECT source_ref, channel, lane, status, error, created_at
       FROM channel_delivery_events
       WHERE source_ref LIKE ?
       ORDER BY created_at DESC
       LIMIT 10`,
    )
    .all(`agent_task:${actionId}:%`);
} catch {
  deliveries = [];
}

console.log(
  JSON.stringify(
    {
      phase: 'applied',
      queueStatus: applied.queueStatus,
      resultStatus: applied.result?.status,
      resultSummary: applied.result?.summary,
      error: applied.error,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      phase: 'after',
      queueStatus: after?.queueStatus,
      state: after?.state,
      lastError: after?.lastError,
      finishedAt: after?.finishedAt,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ phase: 'deliveries', deliveries }, null, 2));
