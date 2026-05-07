import assert from 'node:assert/strict';

import { analyzeMessagesInBackground } from '../src/messageDealing.ts';
import { getEnvConfig } from '../src/utils.ts';
import { getTaskEnabled } from '../src/services/taskSchedulerDefinitions.ts';
import { loadRuntimeWatchRules } from '../src/watchRules.ts';

type StorageMap = Record<string, any>;

const storage: StorageMap = {
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
    message_analysis: {
      enabled: true,
    },
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
      if (callback) {
        callback(result);
      }
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
          'chrome notification should not be used for system-only match',
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
    console.log('mock fetch:', url);

    if (url.startsWith('http://mock-ollama/api/generate')) {
      const requestBody = init?.body ? JSON.parse(String(init.body)) : {};
      const prompt = String(requestBody?.prompt || '');

      if (prompt.includes('提取消息中的实体')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              entities: {
                people: ['James Lee'],
                projects: ['Migration Guide'],
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

      return new Response(
        JSON.stringify({
          response: JSON.stringify({
            data: [
              {
                team_name: 'SDK Updates',
                team_id: 'team-1',
                sender: 'James Lee',
                message_content: 'migration guide draft is ready',
                summary: '追问前已经命中 migration guide 的答案线索',
                datetime: '2026-04-15T00:00:00.000Z',
                post_id: 'post-1',
                matched_rule: '[RULE_REF:outreach:session-before-followup]',
                matched_rule_refs: ['outreach:session-before-followup'],
                matched_rule_ids: [],
                reply_advice: '',
                user_relation_type: 'general_interest',
                contextMessages: [
                  {
                    id: 'post-1',
                    sender: 'James Lee',
                    content: 'migration guide draft is ready',
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

    if (
      url.startsWith(
        'http://mock-memory/api/v1/outreach/templates/runtime-status',
      )
    ) {
      const now = Date.now();
      return new Response(
        JSON.stringify({
          items: [
            {
              template: {
                id: 'template-migration-guide',
                title: 'Migration guide follow-up',
                questionTemplate: 'migration guide 发布了吗？',
                targetType: 'group',
                targetRef: 'sdk-updates',
                enabled: true,
                syncState: 'synced',
                createdAt: now,
                updatedAt: now,
              },
              latestSession: {
                id: 'session-before-followup',
                targetType: 'group',
                targetRef: 'sdk-updates',
                renderedQuestion: 'migration guide 发布了吗？',
                status: 'waiting_reply',
                requiresApproval: false,
                followupCount: 0,
                maxFollowup: 2,
                createdAt: now,
                updatedAt: now,
              },
            },
          ],
          total: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.startsWith('http://mock-memory/api/v1/ingest')) {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      ingests.push(body);
      return new Response(
        JSON.stringify({ id: 'ingest-1', status: 'created' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (url.startsWith('http://mock-bot/')) {
      botMessages.push(init?.body ? JSON.parse(String(init.body)) : null);
      return new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected fetch ${url}`);
  };
}

async function main() {
  installChromeMock();
  installFetchMock();
  console.log('verify-memory-entry-message-flow starting');
  console.log('env config', await getEnvConfig());
  console.log('task enabled', await getTaskEnabled('message_analysis'));
  console.log(
    'raw concernedItems',
    await (globalThis as any).chrome.storage.local.get('concernedItems'),
  );
  console.log(
    'runtime watch rules',
    (await loadRuntimeWatchRules(storage.concernedItems)).map(
      (rule) => rule.ruleRef,
    ),
  );

  const result = (await Promise.race([
    analyzeMessagesInBackground(
      [
        {
          type: 'message',
          groupName: 'SDK Updates',
          groupId: 'team-1',
          standalone: [
            {
              creator: 'James Lee',
              time: '2026-04-15T00:00:00.000Z',
              id: 'post-1',
              text: 'migration guide draft is ready',
            },
          ],
        },
      ],
      'Current User',
      false,
    ),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('verify-memory-entry-message-flow timeout')),
        10000,
      ),
    ),
  ])) as Awaited<ReturnType<typeof analyzeMessagesInBackground>>;

  assert.ok(Array.isArray((result as any)?.data));
  assert.equal(ingests.length, 1, 'system-only match should still ingest');
  assert.equal(
    botMessages.length,
    0,
    'system-only match should not trigger bot notification',
  );
  assert.deepEqual(ingests[0]?.metadata?.matchedRules, [
    '[RULE_REF:outreach:session-before-followup]',
  ]);

  console.log('verify-memory-entry-message-flow: ok');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
