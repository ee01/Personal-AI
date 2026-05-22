import assert from 'node:assert/strict';

import { analyzeMessagesInBackground } from '../src/messageDealing.ts';

const storage: Record<string, any> = {
  envConfig: {
    ANALYSIS_TYPE: 'filter',
    ANALYZE_BY_GROUP: false,
    LLM_TYPE: 'local',
    OLLAMA_BASE_URL: 'http://mock-ollama',
    OLLAMA_MODEL: 'mock-model',
    OLLAMA_QUERY_MODEL: 'mock-model',
    FILTER_OWN_MESSAGES: true,
    MESSAGE_ANALYSIS_PUSH_TARGET: 'me',
    FOLLOW_UP_PUSH_TARGET: 'me',
    DECISION_CENTER_PUSH_TARGET: 'me',
    DREAM_INSIGHT_PUSH_TARGET: 'none',
    WEEKLY_REPORT_PUSH_TARGET: 'none',
    BOT_API_BASE_URL: 'http://mock-bot',
    BOT_TOKEN: 'token',
    BOT_ID: 'bot-id',
    MEMORY_SERVICE_BASE_URL: 'http://mock-memory/api/v1',
    OUTREACH_ENABLED: true,
    LLM_REVIEW_BEFORE_SEND: false,
  },
  userinfo: {
    fullName: 'Current User',
    userEmail: 'current@example.com',
  },
  taskSchedulerStates: {
    message_analysis: { enabled: true },
  },
  digestQueues: {},
  concernedItems: [
    {
      id: 'manual-1',
      text: 'Only notify me when blocker is mentioned',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
  ],
};

const ingests: any[] = [];
const botMessages: any[] = [];

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
    async remove(key: string) {
      delete storage[key];
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
      async sendMessage() {
        return { success: true };
      },
    },
    notifications: {
      create() {
        throw new Error(
          'chrome notification not expected in manual bot-only scenario',
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
        JSON.stringify({ items: [], total: 0, limit: 20, offset: 0 }),
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
      if (prompt.includes('提取消息中的实体')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              entities: {
                people: [],
                projects: [],
                topics: ['blocker'],
                resources: [],
                webpages: [],
                jiraTickets: [],
                conversations: [],
              },
              metadata: {
                sentiment: 'neutral',
                priority: 'high',
                category: [],
                tags: [],
              },
              actions: [],
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const activeRule = storage.concernedItems[0];
      return new Response(
        JSON.stringify({
          response: JSON.stringify({
            data: [
              {
                team_name: 'Team Standup',
                team_id: 'team-2',
                sender: 'Alice',
                message_content: 'There is a blocker in build pipeline',
                summary: 'manual blocker rule matched',
                datetime: '2026-04-15T00:00:00.000Z',
                post_id: 'post-manual-1',
                matched_rule: `[RULE_REF:manual:${activeRule.id}] [RULE_ID:0] ${activeRule.text}`,
                matched_rule_refs: [`manual:${activeRule.id}`],
                matched_rule_ids: [0],
                reply_advice: 'Please follow up on the blocker.',
                user_relation_type: 'general_interest',
                contextMessages: [
                  {
                    id: 'post-manual-1',
                    sender: 'Alice',
                    content: 'There is a blocker in build pipeline',
                    datetime: '2026-04-15T00:00:00.000Z',
                    isMainMessage: true,
                  },
                ],
              },
            ],
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

  const result = await analyzeMessagesInBackground(
    [
      {
        type: 'message',
        groupName: 'Team Standup',
        groupId: 'team-2',
        standalone: [
          {
            creator: 'Alice',
            time: '2026-04-15T00:00:00.000Z',
            id: 'post-manual-1',
            text: 'There is a blocker in build pipeline',
          },
        ],
      },
    ],
    'Current User',
    false,
  );

  assert.ok(Array.isArray((result as any)?.data));
  assert.equal(ingests.length, 1, 'manual match should ingest');
  assert.equal(
    botMessages.length,
    1,
    'manual notify bot flow should still work',
  );
  assert.match(JSON.stringify(botMessages[0]), /blocker/i);

  storage.concernedItems = [
    {
      id: 'digest-only',
      text: 'Only summarize blocker mentions later',
      expiredAt: 0,
      notifyMethod: '',
      digestConfig: {
        enabled: true,
        frequency: 'daily',
        preferredHour: 8,
      },
    },
  ];
  storage.digestQueues = {};
  ingests.length = 0;
  botMessages.length = 0;

  await analyzeMessagesInBackground(
    [
      {
        type: 'message',
        groupName: 'Team Standup',
        groupId: 'team-2',
        standalone: [
          {
            creator: 'Alice',
            time: '2026-04-15T00:00:00.000Z',
            id: 'post-manual-1',
            text: 'There is a blocker in build pipeline',
          },
        ],
      },
    ],
    'Current User',
    false,
  );

  const queuedDigestItems =
    storage.digestQueues?.concerned_items_daily?.items || [];
  assert.equal(ingests.length, 1, 'digest-only manual match should ingest');
  assert.equal(
    botMessages.length,
    0,
    'digest-only manual match should not send immediate bot notification',
  );
  assert.equal(
    queuedDigestItems.length,
    1,
    'digest-only manual match should be queued for scheduled summary',
  );
  assert.equal(queuedDigestItems[0].data.ruleId, 'digest-only');

  console.log('verify-memory-entry-manual-flow: ok');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
