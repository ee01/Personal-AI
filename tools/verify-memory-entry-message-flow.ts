import assert from 'node:assert/strict';

import { analyzeMessagesInBackground } from '../src/messageDealing.ts';
import { getEnvConfig } from '../src/utils.ts';
import { getTaskEnabled } from '../src/services/taskSchedulerDefinitions.ts';
import { loadRuntimeWatchRules } from '../src/watchRules.ts';
import { MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY } from '../src/messageAnalysisRuleDiagnostics.ts';
import { MESSAGE_ANALYSIS_DELIVERY_RECEIPT_KEY } from '../src/messageAnalysisDelivery.ts';

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
let failNextIngest = false;
const outreachBaselineAt = Math.floor(
  Date.parse('2026-04-14T23:00:00.000Z') / 1000,
);

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

      if (prompt.includes('Daily Standup')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              data: [
                {
                  team_name: 'Daily Standup',
                  team_id: 'daily-standup',
                  sender: 'Priya',
                  message_content: 'blocker update is ready',
                  summary: 'LLM hallucinated a release-only rule match',
                  datetime: '2026-04-15T01:00:00.000Z',
                  post_id: 'post-out-of-scope-1',
                  matched_rule:
                    '[RULE_REF:manual:release-only] Release blockers',
                  matched_rule_refs: ['manual:release-only'],
                  matched_rule_ids: [],
                  reply_advice: '',
                  user_relation_type: 'general_interest',
                  contextMessages: [],
                },
              ],
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (prompt.includes('missing sender context regression')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              data: [
                {
                  team_name: 'No Sender Room',
                  team_id: 'no-sender-room',
                  sender: '',
                  message_content:
                    'missing sender context regression should not satisfy a sender-scoped rule',
                  summary:
                    '模型返回了 sender-scoped ruleRef，但消息没有发送人上下文',
                  datetime: '2026-04-15T01:15:00.000Z',
                  post_id: 'post-missing-sender-context-1',
                  matched_rule:
                    '[RULE_REF:manual:sender-scoped] Sender scoped memory',
                  matched_rule_refs: ['manual:sender-scoped'],
                  matched_rule_ids: [],
                  reply_advice: '',
                  user_relation_type: 'general_interest',
                  contextMessages: [],
                },
              ],
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (prompt.includes('multi delivery regression')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              data: [
                {
                  team_name: 'Ops Triage',
                  team_id: 'ops-triage',
                  sender: 'Morgan Lee',
                  message_content:
                    'multi delivery regression should hit summary and alert',
                  summary: '同一条消息同时命中摘要规则和即时通知规则',
                  datetime: '2026-04-15T02:00:00.000Z',
                  post_id: 'post-multi-delivery-1',
                  matched_rule:
                    '[RULE_REF:manual:digest-only] Summary digest; [RULE_REF:manual:immediate-alert] Immediate alert',
                  matched_rule_refs: [
                    'manual:digest-only',
                    'manual:immediate-alert',
                  ],
                  matched_rule_ids: [],
                  reply_advice: '',
                  user_relation_type: 'general_interest',
                  contextMessages: [],
                },
              ],
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (prompt.includes('expired rule regression')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              data: [
                {
                  team_name: 'Expired Room',
                  team_id: 'expired-room',
                  sender: 'Taylor',
                  message_content:
                    'expired rule regression should not run stale storage',
                  summary: 'LLM tried to reuse an expired manual rule',
                  datetime: '2026-04-15T01:30:00.000Z',
                  post_id: 'post-expired-rule-1',
                  matched_rule:
                    '[RULE_REF:manual:expired-alert] Expired rule regression',
                  matched_rule_refs: ['manual:expired-alert'],
                  matched_rule_ids: [],
                  reply_advice: '',
                  user_relation_type: 'general_interest',
                  contextMessages: [],
                },
              ],
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (prompt.includes('delivery receipt failure regression')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              data: [
                {
                  team_name: 'Delivery Room',
                  team_id: 'delivery-room',
                  sender: 'Riley',
                  message_content:
                    'delivery receipt failure regression should still notify',
                  summary: '记忆写入失败但通知仍要尝试',
                  datetime: '2026-04-15T03:00:00.000Z',
                  post_id: 'post-delivery-failure-1',
                  matched_rule:
                    '[RULE_REF:manual:delivery-alert] Delivery alert',
                  matched_rule_refs: ['manual:delivery-alert'],
                  matched_rule_ids: [],
                  reply_advice: '',
                  user_relation_type: 'general_interest',
                  contextMessages: [],
                },
              ],
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (prompt.includes('auto reply skip regression')) {
        return new Response(
          JSON.stringify({
            response: JSON.stringify({
              data: [
                {
                  team_name: 'Support Handoff',
                  team_id: 'support-handoff',
                  sender: 'Nina',
                  message_content:
                    'auto reply skip regression should expose queue skip',
                  summary:
                    '自动答复规则命中但定时消息尚未初始化，应该显示未入队回执',
                  datetime: '2026-04-15T03:30:00.000Z',
                  post_id: 'post-auto-reply-skip-1',
                  matched_rule:
                    '[RULE_REF:manual:auto-reply-skip] Auto reply skip regression',
                  matched_rule_refs: ['manual:auto-reply-skip'],
                  matched_rule_ids: [],
                  reply_advice: '',
                  user_relation_type: 'general_interest',
                  contextMessages: [],
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
      const now = outreachBaselineAt;
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
      if (failNextIngest) {
        failNextIngest = false;
        return new Response(JSON.stringify({ error: 'mock ingest failure' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
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

  storage.concernedItems = [
    {
      id: 'expired-alert',
      text: 'Expired rule regression',
      expiredAt: Date.now() - 60_000,
      notifyMethod: 'bot',
      filterGroup: 'Expired Room',
    },
  ];
  storage[MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY] = [];
  ingests.length = 0;
  botMessages.length = 0;

  const expiredRuntimeRules = await loadRuntimeWatchRules(storage.concernedItems);
  assert.equal(
    expiredRuntimeRules.some((rule) => rule.ruleRef === 'manual:expired-alert'),
    false,
    'expired manual rules should not enter runtime watch rules',
  );

  await analyzeMessagesInBackground(
    [
      {
        type: 'message',
        groupName: 'Expired Room',
        groupId: 'expired-room',
        standalone: [
          {
            creator: 'Taylor',
            time: '2026-04-15T01:30:00.000Z',
            id: 'post-expired-rule-1',
            text: 'expired rule regression should not run stale storage',
          },
        ],
      },
    ],
    'Current User',
    false,
  );

  assert.equal(
    ingests.length,
    0,
    'expired manual rule refs must not ingest memory',
  );
  assert.equal(
    botMessages.length,
    0,
    'expired manual rule refs must not notify',
  );

  storage.concernedItems = [
    {
      id: 'release-only',
      text: 'Release blockers',
      expiredAt: 0,
      notifyMethod: 'bot',
      filterGroup: 'Release Chat',
    },
  ];
  ingests.length = 0;
  botMessages.length = 0;

  await analyzeMessagesInBackground(
    [
      {
        type: 'message',
        groupName: 'Daily Standup',
        groupId: 'daily-standup',
        standalone: [
          {
            creator: 'Priya',
            time: '2026-04-15T01:00:00.000Z',
            id: 'post-out-of-scope-1',
            text: 'blocker update is ready',
          },
        ],
      },
    ],
    'Current User',
    false,
  );

  assert.equal(
    ingests.length,
    0,
    'out-of-scope hallucinated rule refs must not ingest memory',
  );
  assert.equal(
    botMessages.length,
    0,
    'out-of-scope hallucinated rule refs must not notify',
  );
  const diagnostics = storage[MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY] || [];
  assert.equal(
    diagnostics.length,
    1,
    'out-of-scope hallucinated rule refs should leave a local rule diagnostic',
  );
  assert.equal(diagnostics[0].ruleRef, 'manual:release-only');
  assert.match(diagnostics[0].reason, /群组不在范围/);
  assert.match(diagnostics[0].reason, /Release Chat/);
  assert.match(diagnostics[0].reason, /Daily Standup/);

  storage.concernedItems = [
    {
      id: 'sender-scoped',
      text: 'Sender scoped memory',
      expiredAt: 0,
      notifyMethod: 'bot',
      filterGroup: 'No Sender Room',
      filterSender: 'Morgan Lee',
    },
  ];
  storage[MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY] = [];
  ingests.length = 0;
  botMessages.length = 0;

  await analyzeMessagesInBackground(
    [
      {
        type: 'message',
        groupName: 'No Sender Room',
        groupId: 'no-sender-room',
        standalone: [
          {
            time: '2026-04-15T01:15:00.000Z',
            id: 'post-missing-sender-context-1',
            text: 'missing sender context regression should not satisfy a sender-scoped rule',
          },
        ],
      },
    ],
    'Current User',
    false,
  );

  assert.equal(
    ingests.length,
    0,
    'sender-scoped rule refs must not ingest when sender context is missing',
  );
  assert.equal(
    botMessages.length,
    0,
    'sender-scoped rule refs must not notify when sender context is missing',
  );
  const missingSenderDiagnostics =
    storage[MESSAGE_ANALYSIS_RULE_DIAGNOSTICS_KEY] || [];
  assert.equal(
    missingSenderDiagnostics.length,
    1,
    'missing sender context should leave a local rule diagnostic',
  );
  assert.equal(missingSenderDiagnostics[0].ruleRef, 'manual:sender-scoped');
  assert.match(missingSenderDiagnostics[0].reason, /发送人上下文缺失/);
  assert.match(missingSenderDiagnostics[0].reason, /Morgan Lee/);

  storage.concernedItems = [
    {
      id: 'digest-only',
      text: 'Summary digest',
      expiredAt: 0,
      notifyMethod: 'bot',
      digestConfig: {
        enabled: true,
        frequency: 'daily',
        preferredHour: 9,
      },
    },
    {
      id: 'immediate-alert',
      text: 'Immediate alert',
      expiredAt: 0,
      notifyMethod: 'bot',
    },
  ];
  delete storage.digestQueues;
  ingests.length = 0;
  botMessages.length = 0;

  await analyzeMessagesInBackground(
    [
      {
        type: 'message',
        groupName: 'Ops Triage',
        groupId: 'ops-triage',
        standalone: [
          {
            creator: 'Morgan Lee',
            time: '2026-04-15T02:00:00.000Z',
            id: 'post-multi-delivery-1',
            text: 'multi delivery regression should hit summary and alert',
          },
        ],
      },
    ],
    'Current User',
    false,
  );

  assert.equal(ingests.length, 1, 'multi-rule match should still ingest once');
  assert.equal(
    botMessages.length,
    1,
    'digest-only first match must not suppress a later immediate notification rule',
  );
  const digestItems = storage.digestQueues?.concerned_items_daily?.items || [];
  assert.equal(
    digestItems.length,
    1,
    'multi-rule match should enqueue the digest-enabled rule once',
  );
  assert.equal(digestItems[0]?.data?.ruleId, 'digest-only');
  assert.equal(
    digestItems[0]?.id,
    'concerned_digest-only_post-multi-delivery-1',
  );

  storage.concernedItems = [
    {
      id: 'auto-reply-skip',
      text: 'Auto reply skip regression',
      expiredAt: 0,
      filterGroup: 'Support Handoff',
      autoReply: true,
      autoReplyConfig: {
        enabled: true,
        replyContent: 'I will take a look and follow up.',
        useAIGenerate: false,
        reviewMode: 'delayed',
        delayHours: 1,
      },
    },
  ];
  delete storage.scheduledMessagesConfig;
  ingests.length = 0;
  botMessages.length = 0;

  const autoReplySkipRun = (await analyzeMessagesInBackground(
    [
      {
        type: 'message',
        groupName: 'Support Handoff',
        groupId: 'support-handoff',
        standalone: [
          {
            creator: 'Nina',
            time: '2026-04-15T03:30:00.000Z',
            id: 'post-auto-reply-skip-1',
            text: 'auto reply skip regression should expose queue skip',
          },
        ],
      },
    ],
    'Current User',
    false,
  )) as any;

  assert.equal(ingests.length, 1, 'auto-reply skip should not block ingest');
  assert.equal(
    autoReplySkipRun.deliveryReceipt?.counters?.autoReplyHandled,
    0,
  );
  assert.equal(
    autoReplySkipRun.deliveryReceipt?.counters?.autoReplySkipped,
    1,
    'matched auto-reply rules that cannot queue should be visible',
  );
  assert.match(
    autoReplySkipRun.deliveryReceipt?.notes?.join('；') || '',
    /定时消息尚未初始化/,
  );
  assert.equal(
    storage[MESSAGE_ANALYSIS_DELIVERY_RECEIPT_KEY]?.counters?.autoReplySkipped,
    1,
    'stored delivery receipt should keep auto-reply skipped count',
  );

  storage.concernedItems = [
    {
      id: 'delivery-alert',
      text: 'Delivery alert',
      expiredAt: 0,
      notifyMethod: 'bot',
      filterGroup: 'Delivery Room',
    },
  ];
  ingests.length = 0;
  botMessages.length = 0;
  failNextIngest = true;

  const failedDeliveryRun = (await analyzeMessagesInBackground(
    [
      {
        type: 'message',
        groupName: 'Delivery Room',
        groupId: 'delivery-room',
        standalone: [
          {
            creator: 'Riley',
            time: '2026-04-15T03:00:00.000Z',
            id: 'post-delivery-failure-1',
            text: 'delivery receipt failure regression should still notify',
          },
        ],
      },
    ],
    'Current User',
    false,
  )) as any;

  assert.equal(ingests.length, 1, 'failed ingest should still be attempted');
  assert.equal(
    botMessages.length,
    1,
    'notification should still be attempted after a memory write failure',
  );
  assert.equal(
    failedDeliveryRun.deliveryReceipt?.status,
    'partial',
    'analyzeMessagesInBackground should return a finalized partial delivery receipt',
  );
  assert.equal(
    failedDeliveryRun.deliveryReceipt?.counters?.memoryWriteFailures,
    1,
  );
  assert.equal(
    failedDeliveryRun.deliveryReceipt?.counters?.immediateNotificationAttempts,
    1,
  );
  assert.equal(
    storage[MESSAGE_ANALYSIS_DELIVERY_RECEIPT_KEY]?.status,
    'partial',
    'stored delivery receipt should match the returned partial result',
  );

  console.log('verify-memory-entry-message-flow: ok');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
