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
const appendText = process.env.APPEND_TEXT || 'edited on 3/18';
const executeAction = process.env.EXECUTE_ACTION === 'true';

async function main() {
  const currentTime = now();
  const marker = `jira-title-edit-${ticketKey.toLowerCase()}-${currentTime}`;

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
    `用户明确要求对 Jira ticket ${ticketKey} 做一次真实写操作：把标题末尾追加文本 "${appendText}"。这是外部系统写入，不是只读查询。`,
    'seed.bot',
    'jira-write-validation',
    currentTime - 120,
    0.98,
    currentTime - 120,
  );

  db.prepare(
    `INSERT INTO messages_raw
      (id, content, source_type, sender, group_name, timestamp, importance, sentiment, created_at)
     VALUES (?, ?, 'manual', ?, ?, ?, ?, 'neutral', ?)`,
  ).run(
    msg2,
    `这次验证的目标不是通知用户，而是通过 OpenClaw 对 Jira 工单 ${ticketKey} 执行写操作，并在结果里明确给出最终标题。`,
    'seed.bot',
    'jira-write-validation',
    currentTime - 60,
    0.94,
    currentTime - 60,
  );

  const thread = repo.upsertThread({
    topicKey: `jira-ticket-edit:${ticketKey.toLowerCase()}:${marker}`,
    title: `自我反思: 修改 Jira 工单 ${ticketKey} 标题`,
    status: 'active',
    priority: 10,
    salience: 0.98,
    sourceType: 'seed',
    sourceRefId: marker,
    currentHypothesis: `需要对 Jira 工单 ${ticketKey} 执行真实写操作，在标题末尾追加 "${appendText}"，并返回最终标题。`,
    openQuestions: [
      `对 Jira 工单 ${ticketKey} 的标题末尾追加 "${appendText}"。`,
      '写操作完成后，最终标题是什么？',
    ],
    latestSummary: `需要对 Jira 工单 ${ticketKey} 执行一次真实标题修改。`,
    nextReflectionAt: currentTime,
    continueReason: `Need Jira title edit for ${ticketKey}.`,
  });

  repo.addLink(thread.id, 'message', msg1, 1, 'evidence');
  repo.addLink(thread.id, 'message', msg2, 1, 'research');

  const reflection = await reflectionService.runReflection(thread.id, {
    runType: 'jira_title_edit_seed',
    triggerType: 'manual',
    force: true,
  });

  let delegateAction = reflection.actions.find((action) => action.actionType === 'delegate_openclaw');
  let seedMode: 'generated_delegate' | 'fallback_delegate' = 'generated_delegate';

  if (!delegateAction) {
    seedMode = 'fallback_delegate';
    for (const action of reflection.actions) {
      actionRepo.cancel(action.id, 'Replaced by Jira title-edit validation delegate seed');
    }
    delegateAction = actionRepo.create({
      actionType: 'delegate_openclaw',
      title: `修改 Jira 工单 ${ticketKey} 标题`,
      description: `将 Jira 工单 ${ticketKey} 的标题末尾追加 "${appendText}"，并返回最终标题。`,
      params: {
        task: `请对 Jira 工单 ${ticketKey} 执行真实写操作：如果标题末尾还没有 "${appendText}"，就在标题末尾追加空格和 "${appendText}"。完成后返回最终标题。`,
        ticket: ticketKey,
        appendText,
        mode: 'write',
        targetSystem: 'jira',
      },
      requiresApproval: true,
      executionMode: 'manual',
      priority: 10,
      threadId: reflection.thread.id,
      runId: reflection.run.id,
      source: 'seed_jira_title_edit_validation',
      sourceKind: 'seed_jira_title_edit_validation',
      sourceRefId: marker,
      queueStatus: 'queued',
      confidence: 0.98,
      utilityScore: 0.9,
      urgencyScore: 0.9,
    });
  } else {
    const params = {
      ...(delegateAction.params ?? {}),
      task: `请对 Jira 工单 ${ticketKey} 执行真实写操作：如果标题末尾还没有 "${appendText}"，就在标题末尾追加空格和 "${appendText}"。完成后返回最终标题。`,
      ticket: ticketKey,
      appendText,
      mode: 'write',
      targetSystem: 'jira',
    };
    db.prepare(
      `UPDATE proposed_actions
       SET params_json = ?,
           requires_approval = 1,
           execution_mode = 'manual'
       WHERE id = ?`,
    ).run(JSON.stringify(params), delegateAction.id);
    delegateAction = actionRepo.getById(delegateAction.id)!;
  }

  reflectionService.refreshThreadDocument(reflection.thread.id);

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
        appendText,
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
  console.error('[seed-jira-title-edit-validation] Failed:', error);
  process.exit(1);
});
