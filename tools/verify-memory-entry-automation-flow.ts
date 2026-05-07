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
  },
  userinfo: {
    fullName: 'Current User',
    userEmail: 'current@example.com',
  },
  taskSchedulerStates: {
    message_analysis: { enabled: true },
  },
  concernedItems: [
    {
      id: 'leave-rule',
      text: 'Leave Chat 群有人发起请假消息，并且包含我的名字',
      expiredAt: 0,
      notifyMethod: 'bot',
      filterGroup: 'Leave Chat',
      automationPrompt:
        '从消息提取请假日期，请假前 3 小时修改 Glip 状态为 PTO，结束后改回 Available。',
    },
  ],
};

const ingests: any[] = [];
const plannedAutomations: any[] = [];

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
        throw new Error('chrome notification not expected in bot-only scenario');
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

    if (url.startsWith('http://mock-memory/api/v1/message-rules/plan')) {
      plannedAutomations.push(body);
      return new Response(
        JSON.stringify({
          deduped: false,
          actions: [
            { id: 'a1', actionType: 'notify_user' },
            { id: 'a2', actionType: 'delegate_openclaw' },
            { id: 'a3', actionType: 'delegate_openclaw' },
          ],
          detectedWindow: {
            startAt: Date.parse('2099-04-18T00:00:00.000Z'),
            endAt: Date.parse('2099-04-20T23:59:00.000Z'),
            startActionAt: Date.parse('2099-04-17T21:00:00.000Z'),
            restoreActionAt: Date.parse('2099-04-21T00:00:00.000Z'),
            label: '4/18~4/20',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.startsWith('http://mock-bot/')) {
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
                people: ['Current User'],
                projects: [],
                topics: ['Leave'],
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

      return new Response(
        JSON.stringify({
          response: JSON.stringify({
            data: [
              {
                team_name: 'Leave Chat',
                team_id: 'leave-chat',
                sender: 'Alice',
                message_content: 'Current User will be on leave 2099-04-18~2099-04-20.',
                summary: 'manual leave rule matched',
                datetime: '2099-04-16T09:00:00.000Z',
                post_id: 'post-leave-1',
                matched_rule:
                  '[RULE_REF:manual:leave-rule] [RULE_ID:0] Leave Chat 群有人发起请假消息，并且包含我的名字',
                matched_rule_refs: ['manual:leave-rule'],
                matched_rule_ids: [0],
                reply_advice: '',
                user_relation_type: 'general_interest',
                contextMessages: [
                  {
                    id: 'post-leave-1',
                    sender: 'Alice',
                    content: 'Current User will be on leave 2099-04-18~2099-04-20.',
                    datetime: '2099-04-16T09:00:00.000Z',
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
        groupName: 'Leave Chat',
        groupId: 'leave-chat',
        standalone: [
          {
            creator: 'Alice',
            time: '2099-04-16T09:00:00.000Z',
            id: 'post-leave-1',
            text: 'Current User will be on leave 2099-04-18~2099-04-20.',
            event: {
              title: 'Current User PTO',
              start: '2099-04-18',
              end: '2099-04-20',
              timeRange: '2099-04-18~2099-04-20',
              location: 'OOO',
              startAtMs: Date.parse('2099-04-18T00:00:00.000Z'),
              endAtMs: Date.parse('2099-04-20T23:59:00.000Z'),
              ignored: 'drop-me',
            },
          },
        ],
      },
    ],
    'Current User',
    false,
  );

  assert.ok(Array.isArray((result as any)?.data));
  assert.equal(ingests.length, 1, 'matched leave rule should still ingest');
  assert.equal(
    plannedAutomations.length,
    1,
    'matched leave rule should schedule automation planning once',
  );
  assert.equal(plannedAutomations[0].ruleRef, 'manual:leave-rule');
  assert.equal(
    plannedAutomations[0].requiresApproval,
    false,
    'message-rule automation should default to no approval',
  );
  assert.match(
    plannedAutomations[0].automationPrompt,
    /Glip.+PTO/i,
  );
  assert.equal(
    plannedAutomations[0].message.content,
    'Current User will be on leave 2099-04-18~2099-04-20.',
  );
  assert.deepEqual(plannedAutomations[0].message.event, {
    title: 'Current User PTO',
    start: '2099-04-18',
    end: '2099-04-20',
    timeRange: '2099-04-18~2099-04-20',
    location: 'OOO',
    startAtMs: Date.parse('2099-04-18T00:00:00.000Z'),
    endAtMs: Date.parse('2099-04-20T23:59:00.000Z'),
  });
  console.log('verify-memory-entry-automation-flow: ok');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
