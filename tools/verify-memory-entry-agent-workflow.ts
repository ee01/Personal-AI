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
          items: [
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
          ],
          total: 1,
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
      if (!prompt) {
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
  assert.equal(botMessages.length, 0);

  console.log('verify-memory-entry-agent-workflow: ok');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
