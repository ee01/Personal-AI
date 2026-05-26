import assert from 'node:assert/strict';

import { processNewMessage } from '../src/agentWorkflow.ts';

const storage: Record<string, any> = {
  envConfig: {
    LLM_TYPE: 'local',
    OLLAMA_BASE_URL: 'http://mock-ollama',
    OLLAMA_MODEL: 'mock-model',
    OLLAMA_QUERY_MODEL: 'mock-model',
    MEMORY_SERVICE_BASE_URL: 'http://mock-memory/api/v1',
    LLM_REVIEW_BEFORE_SEND: false,
    BOT_API_BASE_URL: 'http://mock-bot',
    BOT_TOKEN: 'token',
    BOT_ID: 'bot-id',
  },
  userinfo: {
    fullName: 'Current User',
    username: 'current.user',
    userEmail: 'current@example.com',
  },
  concernedItems: [
    {
      id: 'manual-1',
      text: 'Only notify me when blocker is mentioned',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
    {
      id: 'outreach:legacy-system-item',
      source: 'outreach',
      text: 'legacy internal item that must be ignored',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
  ],
};

const ingests: any[] = [];
const botMessages: any[] = [];
const relationshipPrompts: string[] = [];
let runtimeStatusItems: any[] = [
  {
    template: {
      id: 'template-before-followup',
      title: 'SDK migration followup',
      questionTemplate: 'migration guide 发布了吗？',
      targetType: 'group',
      targetRef: 'sdk-updates',
      enabled: true,
      syncState: 'synced',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    latestSession: {
      id: 'session-before-followup',
      templateId: 'template-before-followup',
      targetType: 'group',
      targetRef: 'sdk-updates',
      targetResolvedLabel: 'SDK Updates',
      renderedQuestion: 'migration guide 发布了吗？',
      status: 'waiting_reply',
      requiresApproval: false,
      followupCount: 0,
      maxFollowup: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  },
];

function installChromeMock() {
  const local = {
    async get(
      keys: string | string[],
      callback?: (result: Record<string, any>) => void,
    ) {
      let result: Record<string, any>;
      if (Array.isArray(keys)) {
        result = Object.fromEntries(keys.map((key) => [key, storage[key]]));
      } else {
        result = { [keys]: storage[keys] };
      }
      if (callback) callback(result);
      return result;
    },
    async set(value: Record<string, any>) {
      Object.assign(storage, value);
    },
  };

  (globalThis as any).chrome = {
    storage: {
      local,
      onChanged: {
        addListener() {},
        removeListener() {},
      },
    },
    runtime: {
      getURL(path: string) {
        return `chrome-extension://mock/${path}`;
      },
    },
    notifications: {
      create() {
        throw new Error(
          'chrome notification should not run for system-only agentWorkflow match',
        );
      },
    },
  };
}

function installFetchMock() {
  (globalThis as any).fetch = async (
    input: string | URL,
    init?: RequestInit,
  ) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const prompt = String(body?.prompt || '');

    if (
      url.startsWith(
        'http://mock-memory/api/v1/outreach/templates/runtime-status',
      )
    ) {
      return new Response(
        JSON.stringify({
          items: runtimeStatusItems,
          total: runtimeStatusItems.length,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.startsWith('http://mock-memory/api/v1/entities')) {
      return new Response(
        JSON.stringify({ items: [], total: 0, limit: 20, offset: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.startsWith('http://mock-memory/api/v1/recall')) {
      return new Response(
        JSON.stringify({
          items: [],
          totalFound: 0,
          queryTimeMs: 1,
          channels: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.startsWith('http://mock-memory/api/v1/ingest')) {
      ingests.push(body);
      return new Response(
        JSON.stringify({ id: 'ingest-1', status: 'created' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.startsWith('http://mock-bot/')) {
      botMessages.push(body);
      return new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.startsWith('http://mock-ollama/api/generate')) {
      if (prompt.includes('<message_group')) {
        if (prompt.includes('low confidence blocker maybe mentioned')) {
          return new Response(
            JSON.stringify({
              response: JSON.stringify({
                data: [
                  {
                    shouldNotify: true,
                    shouldStore: true,
                    matched_rule: '[RULE_REF:manual:manual-1]',
                    matched_rule_refs: ['manual:manual-1'],
                    matched_rule_ids: [],
                    summary: 'possible manual blocker match',
                    confidence: '42%',
                  },
                ],
              }),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              data: [
                {
                  shouldNotify: false,
                  shouldStore: true,
                  matched_rule: '[RULE_REF:outreach:session-before-followup]',
                  matched_rule_refs: ['outreach:session-before-followup'],
                  matched_rule_ids: [],
                  summary: 'system-only outreach evidence matched',
                  confidence: 0.9,
                },
              ],
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (prompt.includes('实体') || prompt.includes('提取')) {
        if (prompt.includes('no named entity secret phrase should not persist')) {
          return new Response(
            JSON.stringify({
              response: JSON.stringify({
                entities: {
                  people: [],
                  projects: [],
                  topics: [],
                  resources: [],
                  webpages: [],
                  jiraTickets: [],
                  conversations: [],
                },
                metadata: {
                  sentiment: 'neutral',
                  priority: 'medium',
                  category: [],
                  tags: [],
                },
                actions: [],
              }),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              entities: {
                people: [{ name: 'James Lee' }, { name: 'Priya Shah' }],
                projects: [{ name: 'SDK Migration' }],
                topics: ['SDK Updates'],
                resources: [],
                webpages: [],
                jiraTickets: [],
                conversations: [],
              },
              metadata: {
                sentiment: 'neutral',
                priority: 'medium',
                category: [],
                tags: [],
              },
              actions: [],
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (prompt.includes('分析以下人物之间可能的关系')) {
        relationshipPrompts.push(prompt);
        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              relationships: [
                {
                  source: 'James Lee',
                  target: 'Priya Shah',
                  relationship: 'SDK migration collaborators',
                  confidence: 0.82,
                },
              ],
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (prompt.includes('分析以下消息的重要性')) {
        if (prompt.includes('no named entity secret phrase should not persist')) {
          return new Response(
            JSON.stringify({
              response: JSON.stringify({
                isImportant: true,
                shouldStore: true,
                priority: 'high',
                reason: 'secret-free audit trace check',
                tags: ['audit'],
              }),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        if (prompt.includes('architecture decision should be remembered')) {
          return new Response(
            JSON.stringify({
              response: JSON.stringify({
                isImportant: true,
                shouldStore: true,
                priority: 'high',
                reason: 'architecture decision should be preserved',
                tags: ['architecture'],
              }),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              isImportant: false,
              shouldStore: false,
              priority: 'medium',
              reason: 'store decision comes from system watch rule instead',
              tags: [],
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (prompt.includes('分析以下消息并提供回复建议')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              needsReply: false,
              replyText: '',
              priority: 'low',
              reason: 'no reply needed',
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({ response: JSON.stringify({ relationships: [] }) }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    throw new Error(`Unexpected fetch ${url}`);
  };
}

async function main() {
  installChromeMock();
  installFetchMock();

  const result = await processNewMessage({
    sender: 'James Lee',
    team_id: 'team-1',
    team_name: 'SDK Updates',
    content: 'migration guide draft is ready',
    datetime: '2026-04-15T00:00:00.000Z',
  });

  assert.equal(result.shouldStore, true);
  assert.equal(result.shouldNotify, false);
  assert.deepEqual(result.matchedRuleRefs, [
    'outreach:session-before-followup',
  ]);
  assert.equal(relationshipPrompts.length, 1);
  assert.equal(result.agentWorkflowTrace?.length, 6);
  assert.equal(result.agentWorkflowTrace?.[0].agentId, 'entityRecognizer');
  assert.equal(result.agentWorkflowTrace?.[1].agentId, 'notificationJudge');
  assert.match(
    result.agentWorkflowTrace?.[1].outputSummary || '',
    /outreach:session-before-followup/,
  );
  assert.match(relationshipPrompts[0], /James Lee, Priya Shah/);
  assert.deepEqual(result.enrichedData.relationships, [
    {
      source: 'James Lee',
      target: 'Priya Shah',
      relationship: 'SDK migration collaborators',
      confidence: 0.82,
    },
  ]);
  assert.equal(ingests.length, 1);
  assert.equal(ingests[0].content, 'migration guide draft is ready');
  assert.equal(
    ingests[0].metadata.summary,
    'system-only outreach evidence matched',
  );
  assert.equal(ingests[0].metadata.agentWorkflowTrace.length, 6);
  assert.match(
    result.agentWorkflowTrace?.[0].inputSummary || '',
    /migration guide draft is ready/,
  );
  assert.doesNotMatch(
    ingests[0].metadata.agentWorkflowTrace[0].inputSummary,
    /migration guide draft is ready/,
  );
  assert.match(
    ingests[0].metadata.agentWorkflowTrace[0].inputSummary,
    /message content omitted/,
  );
  assert.equal(botMessages.length, 0);

  storage.concernedItems = [
    {
      id: 'outreach:legacy-system-item',
      source: 'outreach',
      text: 'legacy internal item that must be ignored',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
  ];
  ingests.length = 0;
  botMessages.length = 0;
  relationshipPrompts.length = 0;

  const systemOnlyResult = await processNewMessage({
    sender: 'Priya Shah',
    team_id: 'team-1',
    team_name: 'SDK Updates',
    content: 'migration guide 发布了，后续迁移可以开始',
    datetime: '2026-04-15T00:05:00.000Z',
  });

  assert.equal(systemOnlyResult.shouldStore, true);
  assert.equal(systemOnlyResult.shouldNotify, false);
  assert.deepEqual(systemOnlyResult.matchedRuleRefs, [
    'outreach:session-before-followup',
  ]);
  assert.equal(ingests.length, 1);
  assert.equal(botMessages.length, 0);

  runtimeStatusItems = [];
  storage.concernedItems = [];
  ingests.length = 0;
  botMessages.length = 0;

  const relevanceOnlyResult = await processNewMessage({
    sender: 'Morgan Chen',
    team_id: 'team-2',
    team_name: 'Architecture',
    content: 'architecture decision should be remembered for the API split',
    datetime: '2026-04-15T00:10:00.000Z',
  });

  assert.equal(relevanceOnlyResult.shouldStore, true);
  assert.equal(relevanceOnlyResult.shouldNotify, false);
  assert.deepEqual(relevanceOnlyResult.matchedRuleRefs, []);
  assert.equal(
    relevanceOnlyResult.storageReview?.reasonSource,
    'relevanceJudgment',
  );
  assert.equal(
    relevanceOnlyResult.storageReview?.summary,
    'architecture decision should be preserved',
  );
  assert.equal(ingests.length, 1);
  assert.equal(
    ingests[0].metadata.summary,
    'architecture decision should be preserved',
  );
  assert.equal(
    ingests[0].metadata.storageReview.reasonSource,
    'relevanceJudgment',
  );
  assert.equal(ingests[0].metadata.storageReview.traceStatus, 'complete');

  runtimeStatusItems = [];
  storage.concernedItems = [];
  ingests.length = 0;
  botMessages.length = 0;

  const secretTraceContent =
    'no named entity secret phrase should not persist in trace metadata';
  const secretTraceResult = await processNewMessage({
    sender: 'Riley Park',
    team_id: 'team-secret',
    team_name: 'Private Ops',
    content: secretTraceContent,
    datetime: '2026-04-15T00:12:00.000Z',
  });

  assert.equal(secretTraceResult.shouldStore, true);
  assert.equal(ingests.length, 1);
  assert.equal(ingests[0].content, secretTraceContent);
  const persistedTraceText = JSON.stringify(
    ingests[0].metadata.agentWorkflowTrace,
  );
  assert.doesNotMatch(persistedTraceText, /secret phrase/);
  assert.match(persistedTraceText, /message content omitted/);
  assert.match(persistedTraceText, /query text omitted/);

  runtimeStatusItems = [];
  storage.concernedItems = [
    {
      id: 'manual-1',
      text: 'Only notify me when blocker is mentioned',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
  ];
  ingests.length = 0;
  botMessages.length = 0;

  const staleMatcherRefResult = await processNewMessage({
    sender: 'Morgan Chen',
    team_id: 'team-2',
    team_name: 'Architecture',
    content:
      'architecture decision should be remembered for the API split but this is not a blocker match',
    datetime: '2026-04-15T00:15:00.000Z',
  });

  assert.equal(staleMatcherRefResult.shouldStore, true);
  assert.equal(staleMatcherRefResult.shouldNotify, false);
  assert.deepEqual(staleMatcherRefResult.matchedRuleRefs, []);
  assert.equal(
    staleMatcherRefResult.storageReview?.reasonSource,
    'relevanceJudgment',
  );
  assert.equal(
    staleMatcherRefResult.storageReview?.summary,
    'architecture decision should be preserved',
  );
  assert.equal(ingests.length, 1);
  assert.equal(
    ingests[0].metadata.summary,
    'architecture decision should be preserved',
  );

  runtimeStatusItems = [];
  storage.concernedItems = [
    {
      id: 'manual-1',
      text: 'Only notify me when blocker is mentioned',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
  ];
  ingests.length = 0;
  botMessages.length = 0;

  const lowConfidenceManualResult = await processNewMessage({
    sender: 'Avery Wong',
    team_id: 'team-3',
    team_name: 'Escalations',
    content: 'low confidence blocker maybe mentioned',
    datetime: '2026-04-15T00:20:00.000Z',
  });

  assert.equal(lowConfidenceManualResult.shouldStore, true);
  assert.equal(lowConfidenceManualResult.shouldNotify, false);
  assert.equal(lowConfidenceManualResult.confidence, 0.42);
  assert.equal(lowConfidenceManualResult.notificationReview?.required, true);
  assert.equal(
    lowConfidenceManualResult.notificationReview?.reason,
    'low_confidence_notification',
  );
  assert.equal(lowConfidenceManualResult.notificationReview?.confidence, 0.42);
  assert.deepEqual(lowConfidenceManualResult.matchedRuleRefs, [
    'manual:manual-1',
  ]);
  assert.equal(ingests.length, 1);
  assert.equal(botMessages.length, 0);
  assert.equal(ingests[0].metadata.notificationReview.required, true);
  assert.equal(
    ingests[0].metadata.storageReview.notificationReviewRequired,
    true,
  );
  assert.equal(ingests[0].metadata.storageReview.confidence, 0.42);

  runtimeStatusItems = [];
  storage.concernedItems = [];
  storage.customAgents = [
    {
      id: 'legacyInvalidToolAgent',
      name: 'Legacy Invalid Tool Agent',
      description: 'Old custom agent with a removed tool',
      priority: 55,
      tools: ['removedWorkflowTool'],
    },
  ];
  ingests.length = 0;
  botMessages.length = 0;

  const invalidToolResult = await processNewMessage({
    sender: 'Taylor Kim',
    team_id: 'team-4',
    team_name: 'General',
    content:
      'architecture decision should be remembered even when a legacy custom tool is skipped',
    datetime: '2026-04-15T00:30:00.000Z',
  });
  const invalidToolStep = invalidToolResult.agentWorkflowTrace?.find(
    (step) => step.agentId === 'legacyInvalidToolAgent',
  );
  assert.ok(
    invalidToolStep,
    'legacy custom agents without an enabled flag should still run',
  );
  assert.equal(invalidToolStep?.status, 'skipped');
  assert.equal(invalidToolStep?.tools?.[0]?.status, 'skipped');
  assert.match(invalidToolStep?.outputSummary || '', /tool is not registered/);
  assert.equal(invalidToolResult.storageReview?.traceStatus, 'partial');
  assert.equal(invalidToolResult.storageReview?.toolSkippedCount, 1);
  assert.equal(ingests.length, 1);
  assert.equal(ingests[0].metadata.storageReview.traceStatus, 'partial');
  assert.equal(ingests[0].metadata.storageReview.toolSkippedCount, 1);

  runtimeStatusItems = [];
  storage.concernedItems = [];
  storage.customAgents = [
    {
      id: 'relevanceJudge',
      name: 'Duplicate Relevance Judge',
      description: 'Should not overwrite the built-in relevance result',
      priority: 75,
      tools: ['removedWorkflowTool'],
    },
  ];
  ingests.length = 0;
  botMessages.length = 0;

  const duplicateAgentResult = await processNewMessage({
    sender: 'Morgan Chen',
    team_id: 'team-5',
    team_name: 'Architecture',
    content:
      'architecture decision should be remembered even when duplicate Agent IDs exist',
    datetime: '2026-04-15T00:40:00.000Z',
  });
  const duplicateAgentStep = duplicateAgentResult.agentWorkflowTrace?.find(
    (step) =>
      step.agentId === 'relevanceJudge' &&
      step.agentName === 'Duplicate Relevance Judge',
  );
  assert.equal(duplicateAgentStep?.status, 'skipped');
  assert.match(
    duplicateAgentStep?.outputSummary || '',
    /duplicate agent id skipped/,
  );
  assert.equal(
    duplicateAgentResult.storageReview?.reasonSource,
    'relevanceJudgment',
  );
  assert.equal(
    duplicateAgentResult.storageReview?.summary,
    'architecture decision should be preserved',
  );
  assert.equal(duplicateAgentResult.storageReview?.traceStatus, 'partial');
  assert.equal(duplicateAgentResult.storageReview?.toolSkippedCount, 1);
  assert.equal(ingests.length, 1);
  assert.equal(
    ingests[0].metadata.storageReview.reasonSource,
    'relevanceJudgment',
  );
  assert.equal(
    ingests[0].metadata.summary,
    'architecture decision should be preserved',
  );
  delete storage.customAgents;

  console.log('verify-memory-entry-agent-workflow: ok');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
