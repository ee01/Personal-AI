import path from 'node:path';

import { UserContextManager } from '../src/core/UserContextManager.js';
import { ReflectionThreadService } from '../src/core/ReflectionThreadService.js';
import { ReflectionThreadRepository } from '../src/repositories/ReflectionThreadRepository.js';
import { ActionRepository } from '../src/repositories/ActionRepository.js';
import { ActionExecutor } from '../src/core/actions/ActionExecutor.js';
import { now } from '../src/utils/time.js';

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const userId = process.env.DEMO_USER_ID || 'esone.qiu';
const ticketKey = process.env.JIRA_TICKET_KEY || 'MTR-144628';
const ticketSummary =
  process.env.JIRA_TICKET_SUMMARY ||
  '[iOS] The search function in post meeting section is not working (duplicated)';
const executeAction = process.env.EXECUTE_ACTION === 'true';

async function main() {
  const currentTime = now();
  const marker = `jira-validation-${ticketKey.toLowerCase()}-${currentTime}`;

  const ucm = new UserContextManager(dataDir);
  const ctx = ucm.getContext(userId);
  const db = ctx.db;
  const repo = new ReflectionThreadRepository(db);
  const actionRepo = new ActionRepository(db);
  const reflectionService = new ReflectionThreadService(db, ctx.userDataManager, userId);

  const msg1 = `${marker}-msg-1`;
  const msg2 = `${marker}-msg-2`;

  db.prepare(
    `INSERT INTO messages_raw
      (id, content, source_type, sender, group_name, timestamp, importance, sentiment, created_at)
     VALUES (?, ?, 'manual', ?, ?, ?, ?, 'neutral', ?)`,
  ).run(
    msg1,
    `这是一个只读验证场景：我需要只读查询 Jira ticket ${ticketKey}（${ticketSummary}）的当前状态、assignee 和最近更新时间。不要写入任何外部系统。`,
    'seed.bot',
    'jira-validation',
    currentTime - 120,
    0.97,
    currentTime - 120,
  );

  db.prepare(
    `INSERT INTO messages_raw
      (id, content, source_type, sender, group_name, timestamp, importance, sentiment, created_at)
     VALUES (?, ?, 'manual', ?, ?, ?, ?, 'neutral', ?)`,
  ).run(
    msg2,
    `如果 Jira 工单 ${ticketKey} 仍未关闭，我需要把当前状态告诉用户；如果已经关闭，就记录事实即可。这是只读查询，不需要任何写操作。`,
    'seed.bot',
    'jira-validation',
    currentTime - 60,
    0.9,
    currentTime - 60,
  );

  const thread = repo.upsertThread({
    topicKey: `jira-ticket:${ticketKey.toLowerCase()}:${marker}`,
    title: `自我反思: 只读确认 Jira 工单 ${ticketKey} 状态`,
    status: 'active',
    priority: 9,
    salience: 0.95,
    sourceType: 'seed',
    sourceRefId: marker,
    currentHypothesis: `这是只读状态确认任务，需要查询 Jira 工单 ${ticketKey} 的当前状态，但绝不能做写入操作。`,
    openQuestions: [
      `只读查询 Jira 工单 ${ticketKey} 的当前状态、assignee 和更新时间。`,
      `拿到只读结果后，判断是否需要继续提醒用户。`,
    ],
    latestSummary: `需要只读确认 Jira 工单 ${ticketKey} 的当前状态。`,
    nextReflectionAt: currentTime,
    continueReason: `Need read-only Jira truth for ${ticketKey}.`,
  });

  repo.addLink(thread.id, 'message', msg1, 1, 'evidence');
  repo.addLink(thread.id, 'message', msg2, 1, 'research');

  const reflection = await reflectionService.runReflection(thread.id, {
    runType: 'jira_validation_seed',
    triggerType: 'manual',
    force: true,
  });

  let delegateAction = reflection.actions.find((action) => action.actionType === 'delegate_openclaw');
  let seedMode: 'generated_delegate' | 'fallback_delegate' = 'generated_delegate';
  if (!delegateAction) {
    seedMode = 'fallback_delegate';
    for (const action of reflection.actions) {
      if (action.threadId) {
        actionRepo.cancel(action.id, 'Replaced by Jira validation delegate seed');
      }
    }
    delegateAction = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: `只读查询 Jira 工单 ${ticketKey} 状态`,
      description: `读取 ${ticketKey} 的 status、assignee 和 updated 字段，验证 OpenClaw Jira 查询链路。`,
      params: {
        task: `请只读查询 Jira 工单 ${ticketKey} 的当前 status、assignee 和 updated 字段，并用简短中文总结结果。不要写入任何外部系统。`,
        ticket: ticketKey,
        fields: ['status', 'assignee', 'updated'],
        mode: 'read',
        targetSystem: 'jira',
      },
      requiresApproval: false,
      executionMode: 'manual',
      priority: 9,
      threadId: reflection.thread.id,
      runId: reflection.run.id,
      source: 'seed_jira_validation',
      sourceKind: 'seed_jira_validation',
      sourceRefId: marker,
      queueStatus: 'queued',
      confidence: 0.95,
      utilityScore: 0.9,
      urgencyScore: 0.7,
    });
    reflectionService.refreshThreadDocument(reflection.thread.id);
  } else if (
    delegateAction.params &&
    delegateAction.params.mode === 'read' &&
    (delegateAction.requiresApproval || delegateAction.executionMode !== 'manual')
  ) {
    db.prepare(
      `UPDATE proposed_actions
       SET requires_approval = 0,
           execution_mode = 'manual'
       WHERE id = ?`,
    ).run(delegateAction.id);
    delegateAction = actionRepo.getById(delegateAction.id)!;
    reflectionService.refreshThreadDocument(reflection.thread.id);
  }

  let executionResult: Record<string, unknown> | undefined;
  if (executeAction) {
    const executor = new ActionExecutor(db, ctx.userDataManager, userId);
    executionResult = await executor.executeAction(delegateAction.id);
  }

  console.log(
    JSON.stringify(
      {
        dataDir,
        userId,
        ticketKey,
        threadId: reflection.thread.id,
        runId: reflection.run.id,
        actionId: delegateAction.id,
        seedMode,
        actionType: delegateAction.actionType,
        actionTitle: delegateAction.title,
        actionMode: delegateAction.executionMode,
        requiresApproval: delegateAction.requiresApproval,
        params: delegateAction.params,
        executeAction,
        executionResult,
      },
      null,
      2,
    ),
  );

  await new Promise((resolve) => setTimeout(resolve, 1500));
  ucm.closeAll();
}

main().catch((error) => {
  console.error('[seed-jira-validation] Failed:', error);
  process.exit(1);
});
