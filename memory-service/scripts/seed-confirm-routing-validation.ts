import path from 'node:path';

import { UserContextManager } from '../src/core/UserContextManager.js';

const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const userId =
  process.env.DEMO_USER_ID || process.env.USER_ID || 'validation-user';
const scenario = process.env.VALIDATION_SCENARIO || 'mixed';

function buildScenarioSamples() {
  if (scenario === 'owner-eta-heavy') {
    return [
      {
        id: 'owner-1',
        question: 'Orbit 现在的负责人是谁？',
        context: '缺少明确 owner。',
        relatedEntityId: 'project-orbit',
      },
      {
        id: 'eta-1',
        question: 'Orbit 的上线时间是什么时候？',
        context: '缺少 ETA。',
        relatedEntityId: 'project-orbit',
      },
      {
        id: 'eta-2',
        question: 'AI Notes Edit BE 的排期是否已定？',
        context: '仍然缺少具体时间表。',
        relatedEntityId: 'project-orbit',
      },
      {
        id: 'owner-dup',
        question: '谁是 Orbit 现在的 owner？',
        context: '与 owner-1 属于同主题。',
        relatedEntityId: 'project-orbit',
      },
      {
        id: 'decision-1',
        question: '我们是否要继续推进 Orbit 迁移？',
        context: '不同答案会改变执行分支。',
        relatedEntityId: 'project-orbit',
      },
    ] as const;
  }

  if (scenario === 'future-monitoring-heavy') {
    return [
      {
        id: 'future-1',
        question: 'AI Notes Edit BE 会不会在本月调整发布时间？',
        context: '目前只有计划变动线索。',
        relatedEntityId: 'project-orbit',
      },
      {
        id: 'future-2',
        question: 'Orbit 是否还有新的 rename 计划？',
        context: '可能涉及后续命名调整。',
        relatedEntityId: 'project-orbit',
      },
      {
        id: 'future-3',
        question: '下个季度是否会迁移 Orbit 的接口？',
        context: '只看到 roadmap 传闻。',
        relatedEntityId: 'project-orbit',
      },
      {
        id: 'future-dup',
        question: 'AI Notes Edit BE 是否还有新的发布时间计划？',
        context: '与 future-1 属于同主题。',
        relatedEntityId: 'project-orbit',
      },
      {
        id: 'artifact-1',
        question: '发布文档里有没有明确下个里程碑？',
        context: '已有文档线索，但尚未核实。',
        relatedEntityId: 'project-orbit',
      },
      {
        id: 'decision-1',
        question: '我们是否要立即拍板 Orbit 的方案方向？',
        context: '这是一个真实分支选择。',
        relatedEntityId: 'project-orbit',
      },
    ] as const;
  }

  return [
    {
      id: 'legacy-future-1',
      question: 'AI Notes Edit BE 会不会在下周调整发布时间？',
      context: '目前没有明确结论，只知道可能还有计划变化。',
      relatedEntityId: 'project-orbit',
    },
    {
      id: 'legacy-owner-1',
      question: 'Project Orbit 现在的负责人是谁？',
      context: '缺少 owner 信息。',
      relatedEntityId: 'project-orbit',
    },
    {
      id: 'legacy-eta-1',
      question: 'AI Notes Edit BE 的上线时间是什么时候？',
      context: '只看到零散讨论，没有明确 ETA。',
      relatedEntityId: 'project-orbit',
    },
    {
      id: 'legacy-artifact-1',
      question: '发布说明文档里有没有明确写下一个里程碑？',
      context: '已有文档链接但还没查证。',
      relatedEntityId: 'project-orbit',
    },
    {
      id: 'legacy-decision-1',
      question: '我们是否要立即推进 Orbit 迁移方案？',
      context: '不同答案会触发不同后续动作。',
      relatedEntityId: 'project-orbit',
    },
    {
      id: 'legacy-future-dup',
      question: 'AI Notes Edit BE 是否还有新的发布时间计划？',
      context: '和 legacy-future-1 属于同主题。',
      relatedEntityId: 'project-orbit',
    },
  ] as const;
}

async function main() {
  const ucm = new UserContextManager(dataDir);
  const ctx = ucm.getContext(userId);
  const db = ctx.db;
  const now = Math.floor(Date.now() / 1000);

  db.exec(`DELETE FROM confirm_requests`);

  const insert = db.prepare(
    `INSERT INTO confirm_requests
      (id, question, context, options_json, evidence_refs_json, category, related_entity_id, priority, state, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'normal', 'pending', ?)`,
  );

  const samples = buildScenarioSamples();

  for (const sample of samples) {
    insert.run(
      sample.id,
      sample.question,
      sample.context,
      JSON.stringify([
        { label: '继续查证', value: 'continue' },
        { label: '先记录当前结论', value: 'record_current' },
        { label: '暂不处理', value: 'skip' },
      ]),
      JSON.stringify([]),
      'evidence_resolution',
      sample.relatedEntityId,
      now,
    );
  }

  db.prepare(
    `INSERT INTO confirm_requests
      (id, question, context, options_json, evidence_refs_json, category, related_entity_id, priority, state, routing, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'high', 'pending', 'decision', ?, ?)`,
  ).run(
    'control-property-change',
    'Property "owner" on Orbit may have changed. Accept the new value?',
    'High-value property change decision should stay in the main lane.',
    JSON.stringify([
      { label: 'Accept', value: 'accept' },
      { label: 'Reject', value: 'reject' },
    ]),
    JSON.stringify([]),
    'property_change',
    'project-orbit',
    now,
    now,
  );

  console.log(
    JSON.stringify(
      {
        dataDir,
        userId,
        scenario,
        insertedEvidenceResolution: samples.length,
        insertedControlDecision: 1,
      },
      null,
      2,
    ),
  );

  ucm.closeAll();
}

main().catch((error) => {
  console.error('[seed-confirm-routing-validation] Failed:', error);
  process.exit(1);
});
