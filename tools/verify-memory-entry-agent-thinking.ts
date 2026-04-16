import assert from 'node:assert/strict';

import { IntelligentAgent } from '../src/agentThinking.ts';
import { buildRuntimeWatchRules } from '../src/watchRules.ts';
import type { TopicItemWithAutoReply } from '../src/message-reaction/AutoReplyHandler.ts';
import type { OutreachSession } from '../src/services/MemoryServiceClient.ts';

const storage: Record<string, any> = {
  envConfig: {
    ANALYZE_BY_GROUP: true,
    LLM_TYPE: 'local',
    OLLAMA_BASE_URL: 'http://mock-ollama',
    OLLAMA_MODEL: 'mock-model',
    OLLAMA_QUERY_MODEL: 'mock-model',
  },
};

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
      sendMessage(
        _message: unknown,
        callback?: (response: Record<string, any>) => void,
      ) {
        callback?.({ success: true, data: {} });
        return Promise.resolve({ success: true, data: {} });
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

    if (url.startsWith('http://mock-ollama/api/generate')) {
      if (prompt.includes('关注规则')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify([
              {
                post_id: 'post-thinking-1',
                summary: 'agentThinking 命中 outreach system rule',
                importanceLevel: 'low',
                needsProcessing: true,
                isNoiseMessage: false,
                matchedRuleRefs: ['outreach:session-before-followup'],
                matchedRuleIds: [],
                matchedRules: ['[RULE_REF:outreach:session-before-followup]'],
                nextAction: 'finish',
                tools: [],
                shouldStore: true,
                shouldNotify: false,
                confidence: 0.88,
                user_relation_type: 'general_interest',
                entities: {},
              },
            ]),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response(
        JSON.stringify({
          response: JSON.stringify({
            thought: 'done',
            nextAction: 'finish',
            tools: [],
          }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    throw new Error(`Unexpected fetch ${url}`);
  };
}

async function main() {
  installChromeMock();
  installFetchMock();

  const manualItems: TopicItemWithAutoReply[] = [
    {
      id: 'manual-1',
      text: 'Only notify me when blocker is mentioned',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
  ];
  const outreachSessions: OutreachSession[] = [
    {
      id: 'session-before-followup',
      targetType: 'group',
      targetRef: 'sdk-updates',
      renderedQuestion: 'migration guide 发布了吗？',
      status: 'waiting_reply',
      requiresApproval: false,
      followupCount: 0,
      maxFollowup: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const concernedRules = buildRuntimeWatchRules({
    manualItems,
    outreachSessions,
  });

  const agent = new IntelligentAgent();
  const result = await agent.analyze(
    {
      groupName: 'SDK Updates',
      groupId: 'team-1',
      posts: [
        {
          content: 'migration guide draft is ready',
          sender: 'James Lee',
          datetime: '2026-04-15T00:00:00.000Z',
          post_id: 'post-thinking-1',
        },
      ],
    },
    {
      type: 'message',
      analysisDepth: 'normal',
      maxActions: 1,
    },
    {
      currentUser: 'Current User',
      concernedRules,
      groupInfo: {
        id: 'team-1',
        name: 'SDK Updates',
        members: [],
      },
    },
  );

  assert.ok(Array.isArray(result));
  assert.equal(result.length, 1);
  console.log('agentThinking result', result[0]);
  assert.deepEqual(result[0].matchedRuleRefs, [
    'outreach:session-before-followup',
  ]);
  assert.equal(result[0].shouldStore, true);
  assert.equal(result[0].shouldNotify, false);

  console.log('verify-memory-entry-agent-thinking: ok');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
