import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { UserContextManager } from '../src/core/UserContextManager.js';
import { ReflectionThreadService } from '../src/core/ReflectionThreadService.js';
import { ActionRepository } from '../src/repositories/ActionRepository.js';
import { ActionExecutor } from '../src/core/actions/ActionExecutor.js';
import { now } from '../src/utils/time.js';

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data-demo');
const userId = process.env.DEMO_USER_ID || 'demo';

function resetDemoData(db: any) {
  db.exec(`
    DELETE FROM proposed_action_attempts;
    DELETE FROM proposed_actions;
    DELETE FROM topic_memory_links;
    DELETE FROM reflection_runs;
    DELETE FROM dream_runs;
    DELETE FROM reflection_threads;
    DELETE FROM confirm_requests;
    DELETE FROM notification_records;
    DELETE FROM opinion_items;
    DELETE FROM social_edges;
    DELETE FROM user_profile_items;
    DELETE FROM entity_properties;
    DELETE FROM relationships;
    DELETE FROM memory_metadata;
    DELETE FROM watched_projects;
    DELETE FROM chunks;
    DELETE FROM chunks_fts;
    DELETE FROM messages_raw;
    DELETE FROM entities;
  `);
}

async function main() {
  const ucm = new UserContextManager(dataDir);
  const ctx = ucm.getContext(userId);
  const db = ctx.db;
  const currentTime = now();

  resetDemoData(db);

  const orbitEntityId = 'entity-project-orbit';
  const mayaEntityId = 'entity-person-maya-chen';
  const opsEntityId = 'entity-org-ops';
  const watchedProjectId = 'watched-project-orbit';

  db.prepare(
    `INSERT INTO entities
      (id, type, name, description, importance, mention_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(orbitEntityId, 'Project', 'Project Orbit', 'AI assistant release train for March', 0.92, 6, currentTime, currentTime);
  db.prepare(
    `INSERT INTO entities
      (id, type, name, description, importance, mention_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(mayaEntityId, 'Person', 'Maya Chen', 'Engineering owner for Orbit integration', 0.84, 5, currentTime, currentTime);
  db.prepare(
    `INSERT INTO entities
      (id, type, name, description, importance, mention_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(opsEntityId, 'Organization', 'Ops Platform', 'Deployment pipeline and release automation team', 0.73, 2, currentTime, currentTime);

  db.prepare(
    `INSERT INTO watched_projects
      (id, entity_id, name, description, aliases_json, tracked_properties_json, is_active, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).run(
    watchedProjectId,
    orbitEntityId,
    'Project Orbit',
    'Release train tracked for demo validation',
    JSON.stringify(['Orbit', 'Release Orbit']),
    JSON.stringify(['release_date', 'risk_status']),
    9,
    currentTime,
    currentTime,
  );

  const message1Id = 'demo-msg-orbit-risk';
  const message2Id = 'demo-msg-user-preference';
  const message3Id = 'demo-msg-openclaw';

  db.prepare(
    `INSERT INTO messages_raw
      (id, content, source_type, sender, group_name, timestamp, entities_json, matched_projects_json, importance, sentiment, created_at)
     VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, ?, 'concerned', ?)`,
  ).run(
    message1Id,
    'Project Orbit integration milestone slipped by two days. Maya said the release is still possible, but deployment checks are flaky and risk is rising.',
    'maya.chen',
    'orbit-war-room',
    currentTime - 7200,
    JSON.stringify([
      { id: orbitEntityId, name: 'Project Orbit', type: 'Project' },
      { id: mayaEntityId, name: 'Maya Chen', type: 'Person' },
    ]),
    JSON.stringify([watchedProjectId]),
    0.94,
    currentTime - 7200,
  );

  db.prepare(
    `INSERT INTO messages_raw
      (id, content, source_type, sender, group_name, timestamp, entities_json, matched_projects_json, importance, sentiment, created_at)
     VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, ?, 'positive', ?)`,
  ).run(
    message2Id,
    'The user prefers concise Chinese status updates with an explicit next step, and dislikes vague risk wording.',
    'assistant-notes',
    'personal-ai',
    currentTime - 5400,
    JSON.stringify([{ id: orbitEntityId, name: 'Project Orbit', type: 'Project' }]),
    JSON.stringify([watchedProjectId]),
    0.81,
    currentTime - 5400,
  );

  db.prepare(
    `INSERT INTO messages_raw
      (id, content, source_type, sender, group_name, timestamp, entities_json, matched_projects_json, importance, sentiment, created_at)
     VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, ?, 'neutral', ?)`,
  ).run(
    message3Id,
    'OpenClaw can fetch deployment diff context for Orbit, but the query has not been executed yet.',
    'ops.bot',
    'orbit-war-room',
    currentTime - 3600,
    JSON.stringify([
      { id: orbitEntityId, name: 'Project Orbit', type: 'Project' },
      { id: opsEntityId, name: 'Ops Platform', type: 'Organization' },
    ]),
    JSON.stringify([watchedProjectId]),
    0.77,
    currentTime - 3600,
  );

  db.prepare(
    `INSERT INTO entity_properties
      (entity_id, property_key, property_value, value_type, source_author, source_authority, source_context, tx_start, confidence, status, action_type)
     VALUES (?, ?, ?, 'string', ?, 'peer', ?, ?, ?, 'active', 'update')`,
  ).run(
    orbitEntityId,
    'risk_status',
    'yellow',
    'maya.chen',
    'Updated after integration slippage discussion',
    currentTime - 3500,
    0.86,
  );
  const riskPropertyId = Number(db.prepare('SELECT last_insert_rowid() AS id').get().id);

  db.prepare(
    `INSERT INTO user_profile_items
      (id, item_type, item_key, item_value, evidence_refs, source_kind, confidence, user_confirmed, status, salience_score, mention_count, last_seen, created_at, updated_at, fingerprint)
     VALUES (?, 'preference', ?, ?, ?, 'inferred', ?, 0, 'active', ?, 2, ?, ?, ?, ?)`,
  ).run(
    'profile-pref-status-style',
    'status_update_style',
    'Prefer concise Chinese status summaries with one explicit next step.',
    JSON.stringify([{ messageId: message2Id, snippet: 'concise Chinese status updates', ts: currentTime - 5400 }]),
    0.88,
    0.91,
    currentTime - 5400,
    currentTime - 5400,
    currentTime - 5400,
    'demo-profile-pref-style',
  );

  const confirmRequestId = 'confirm-orbit-release-push';
  db.prepare(
    `INSERT INTO confirm_requests
      (id, question, context, options_json, evidence_refs_json, category, related_entity_id, priority, state, created_at)
     VALUES (?, ?, ?, ?, ?, 'release_risk', ?, 'high', 'pending', ?)`,
  ).run(
    confirmRequestId,
    '是否要立即把 Project Orbit 的发布风险推送给用户？',
    'Maya 认为还能赶上，但现有线索显示部署检查不稳定，且梦境回放也指向同一风险。',
    JSON.stringify([
      { label: '立即推送', value: 'push_now' },
      { label: '先观察', value: 'wait' },
    ]),
    JSON.stringify([message1Id, message3Id]),
    orbitEntityId,
    currentTime - 1800,
  );

  const reflectionService = new ReflectionThreadService(db, ctx.userDataManager, userId);
  reflectionService.recordOnlineReflectionSignal(
    {
      query: 'Project Orbit 最近有什么需要我决策的变化？',
      recalledItems: [
        { id: message1Id, type: 'message', content: 'Orbit risk rising', score: 0.93 },
        { id: message2Id, type: 'message', content: 'User prefers concise Chinese updates', score: 0.88 },
      ],
      llmResponse: 'Project Orbit release risk increased and likely needs a user-facing decision push.',
      usedItemIds: [message1Id, message2Id],
    },
    {
      newFacts: [
        { entity: 'Project Orbit', key: 'risk_status', value: 'yellow', confidence: 0.86 },
      ],
      userPreferences: [
        'User prefers concise Chinese decision summaries with an explicit next step.',
      ],
      improvements: [
        'Need a clearer trigger for when release-risk signals should be pushed to the user.',
      ],
      shouldStore: true,
    },
  );

  reflectionService.ingestConfirmRequest(confirmRequestId);
  reflectionService.ingestEntityPropertySignal(riskPropertyId);
  reflectionService.ingestProfileSignal('profile-pref-status-style');
  reflectionService.ingestMessageSignal(message1Id);
  reflectionService.ingestMessageSignal(message3Id);

  reflectionService.recordDreamRun({
    sourceType: 'entity',
    sourceRefId: orbitEntityId,
    title: 'Project Orbit',
    summary: 'Dream replay connected the release slip, deployment flakiness, and Maya ownership into one risk thread.',
    insights: [
      'Risk is not isolated to schedule; deployment instability is the common driver.',
      'The user likely wants a shorter decision brief instead of a long narrative.',
    ],
    risks: [
      'If deployment diff is not queried soon, the release confidence may be overstated.',
    ],
    relationships: [
      { from: 'Project Orbit', to: 'Ops Platform', type: 'depends_on', context: 'Release stability depends on deployment checks.' },
      { from: 'Maya Chen', to: 'Project Orbit', type: 'owns_risk_followup', context: 'Maya is the current signal owner.' },
    ],
    markdownPath: 'dreams/project-orbit-demo.md',
  });

  for (const thread of reflectionService.listDueThreads(20)) {
    await reflectionService.runReflection(thread.id, {
      runType: 'demo_bootstrap',
      triggerType: 'seed',
      force: true,
    });
  }

  const actionRepo = new ActionRepository(db);
  const threadList = reflectionService.listThreads({ status: 'all', limit: 20 }).items;
  const primaryThreadId = threadList[0]?.id;

  const queuedManualAction = actionRepo.create({
    actionType: 'create_confirm_request',
    title: '补一个更精简的用户确认问题',
    description: '把 Orbit 风险问题压缩成一句确认题，供用户快速选择。',
    params: {
      question: '是否需要今天就推送 Orbit 风险摘要？',
      context: '用于验证 manual queued action。',
      options: [
        { label: '推送', value: 'push' },
        { label: '不推送', value: 'skip' },
      ],
      relatedEntityId: orbitEntityId,
      priority: 'normal',
    },
    executionMode: 'manual',
    priority: 7,
    threadId: primaryThreadId,
    source: 'demo_seed',
    sourceKind: 'demo_seed',
    sourceRefId: 'seed-manual-confirm',
  });

  const failingAction = actionRepo.create({
    actionType: 'query_external_tool',
    title: '调用 OpenClaw 查询部署 diff',
    description: '验证外部工具调用失败时的动作回退路径。',
    params: {
      path: '/query',
      body: {
        query: 'Project Orbit deployment diff',
      },
    },
    executionMode: 'manual',
    priority: 8,
    threadId: primaryThreadId,
    source: 'demo_seed',
    sourceKind: 'demo_seed',
    sourceRefId: 'seed-openclaw-query',
  });

  const notifyAction = actionRepo.create({
    actionType: 'notify_user',
    title: 'Orbit 风险摘要',
    description: 'Project Orbit 的风险已经达到需要简短推送的程度。',
    params: {
      title: 'Orbit 风险摘要',
      body: 'Project Orbit: 风险上升，建议决定是否立即推送发布风险给用户。',
      payload: {
        threadId: primaryThreadId,
        source: 'demo_seed',
      },
    },
    executionMode: 'auto',
    priority: 9,
    threadId: primaryThreadId,
    source: 'demo_seed',
    sourceKind: 'demo_seed',
    sourceRefId: 'seed-notify-user',
  });

  const executor = new ActionExecutor(db, userId);
  await executor.executeAction(notifyAction.id);
  await executor.executeAction(failingAction.id);

  const summary = {
    dataDir,
    userId,
    counts: {
      threads: reflectionService.listThreads({ status: 'all', limit: 50 }).total,
      actions: actionRepo.list({ queueStatus: 'all', limit: 50 }).total,
      confirmRequests: Number(
        (db.prepare("SELECT COUNT(*) AS count FROM confirm_requests WHERE state = 'pending'").get() as { count: number }).count,
      ),
    },
    queuedManualActionId: queuedManualAction.id,
    failingActionId: failingAction.id,
    succeededNotifyActionId: notifyAction.id,
  };

  console.log(JSON.stringify(summary, null, 2));
  await new Promise((resolve) => setTimeout(resolve, 1500));
  ucm.closeAll();
}

main().catch((error) => {
  console.error('[seed-reflection-demo] Failed:', error);
  process.exit(1);
});
