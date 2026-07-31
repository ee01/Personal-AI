#!/usr/bin/env node

const baseUrl = (
  process.env.MEMORY_SERVICE_BASE_URL || 'http://localhost:3210/api/v1'
).replace(/\/$/, '');
const userId = process.env.MEMORY_SERVICE_USER_ID || 'esone.qiu';
const apiKey = process.env.MEMORY_SERVICE_API_KEY || '';
const now = Math.floor(Date.now() / 1000);

const headers = {
  'content-type': 'application/json',
  'x-user-id': userId,
};
if (apiKey) headers.authorization = `Bearer ${apiKey}`;

const fixtures = [
  {
    briefKey: 'demo:workflow:ringcx-whatsapp-sms-reuse',
    title: 'WhatsApp 集成复用路径',
    subjectType: 'workflow',
    status: 'ready',
    summary: '先调研 RingCX WhatsApp 与 SMS 基础设施，避免直接设计第二套发送链路。',
    externalSummary: '先调研 WhatsApp 与 SMS 基础设施，再决定是否新增设计。',
    freshness: {
      state: 'fresh',
      reason: '本地体验 fixture：最近来源仍在有效期',
      expiresAt: now + 7 * 86400,
    },
    slots: {
      whyItMatters: '当前页面正在讨论 WhatsApp 接入方式。',
      currentState: '先复用现有 SMS 基础设施，再决定是否新增设计。',
      stableFacts: [
        {
          text: 'RingCX 已有 SMS 基础设施可供复用调研。',
          sourceRefs: ['message:demo-whatsapp-message', 'source_memory:demo-sms-notes'],
          confidence: 'high',
          authority: 'direct_message',
          validAsOf: now,
          staleRisk: 'low',
          projection: 'summary_ok',
        },
      ],
      decisions: [],
      constraints: [
        {
          text: '不要在调研前直接设计第二套发送链路。',
          sourceRefs: ['message:demo-whatsapp-message'],
          authority: 'direct_message',
          projection: 'summary_ok',
        },
      ],
      traps: [],
      peopleAndSources: [],
      nextUseCases: ['RingCentral thread reading', 'Jira estimate'],
      openQuestions: ['WhatsApp provider 的最终能力边界是什么？'],
    },
    sourceMap: [
      {
        ref: 'message:demo-whatsapp-message',
        sourceType: 'message',
        sourceId: 'demo-whatsapp-message',
        role: 'authority',
        title: 'WhatsApp integration discussion (demo)',
        timestamp: now,
        authority: 'direct_message',
        projection: 'summary_ok',
      },
      {
        ref: 'source_memory:demo-sms-notes',
        sourceType: 'source_memory',
        sourceId: 'demo-sms-notes',
        role: 'supporting',
        title: 'SMS architecture notes (demo)',
        timestamp: now - 3600,
        authority: 'source_memory',
        projection: 'local_only',
      },
    ],
    sceneAnchors: {
      projects: ['RingCX'],
      jiraKeys: [],
      people: [],
      topics: ['WhatsApp', 'SMS reuse'],
      surfaces: ['ringcentral_thread_reading'],
    },
    displayPolicy: {
      defaultMode: 'chip',
      maxLines: 6,
      canCopyToDraft: true,
      externalSummaryOnly: true,
    },
    inputSummary: 'P0 local experience fixture: WhatsApp/SMS reuse',
    evaluationTags: ['demo', 'p0', 'whatsapp-sms-reuse'],
  },
  {
    briefKey: 'demo:jira:task-estimate-policy',
    title: 'Task Estimate 口径',
    subjectType: 'jira_issue',
    status: 'ready',
    summary: '填写 Original Estimate 前先按团队既定人天口径拆分 DEV、QA 与风险缓冲。',
    freshness: {
      state: 'watching',
      reason: '本地体验 fixture：Jira 字段可变化，当前来源仍在有效期',
      expiresAt: now + 3 * 86400,
    },
    slots: {
      whyItMatters: '当前正在查看或填写 Jira estimate 字段。',
      currentState: '先复核当前字段，再按人天口径建议 estimate。',
      stableFacts: [
        {
          text: 'Original Estimate 使用团队既定人天口径。',
          sourceRefs: ['jira:demo-estimate-field', 'message:demo-estimate-policy'],
          confidence: 'high',
          authority: 'jira',
          validAsOf: now,
          staleRisk: 'medium',
          projection: 'summary_ok',
        },
      ],
      decisions: [],
      constraints: [
        {
          text: '简报只给口径，不自动写回 Jira。',
          sourceRefs: ['jira:demo-estimate-field'],
          authority: 'jira',
          projection: 'summary_ok',
        },
      ],
      traps: [],
      peopleAndSources: [],
      nextUseCases: ['Jira field inspection'],
      openQuestions: ['当前票的 QA 与风险缓冲是否有新证据？'],
    },
    sourceMap: [
      {
        ref: 'jira:demo-estimate-field',
        sourceType: 'jira',
        sourceId: 'demo-estimate-field',
        role: 'authority',
        title: 'Original Estimate field (demo)',
        timestamp: now,
        authority: 'jira',
        projection: 'summary_ok',
      },
      {
        ref: 'message:demo-estimate-policy',
        sourceType: 'message',
        sourceId: 'demo-estimate-policy',
        role: 'supporting',
        title: 'Estimate policy discussion (demo)',
        timestamp: now - 7200,
        authority: 'direct_message',
        projection: 'local_only',
      },
    ],
    sceneAnchors: {
      projects: [],
      jiraKeys: [],
      people: [],
      topics: ['Original Estimate', 'Task Estimate', 'person-days'],
      surfaces: ['jira_field_inspection'],
    },
    displayPolicy: {
      defaultMode: 'chip',
      maxLines: 6,
      canCopyToDraft: true,
      externalSummaryOnly: true,
    },
    inputSummary: 'P0 local experience fixture: Jira estimate policy',
    evaluationTags: ['demo', 'p0', 'jira-estimate'],
  },
];

for (const fixture of fixtures) {
  const response = await fetch(`${baseUrl}/keystone-briefs/mine`, {
    method: 'POST',
    headers,
    body: JSON.stringify(fixture),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Failed to seed ${fixture.briefKey}: HTTP ${response.status} ${JSON.stringify(payload)}`,
    );
  }
  console.log(`${payload.item.status}\t${payload.item.title}\t${payload.item.id}`);
}

console.log(`Seeded ${fixtures.length} Keystone briefs for ${userId} at ${baseUrl}.`);
