import test from 'node:test';
import assert from 'node:assert/strict';

import type { ScheduledMessage } from '../types.js';
import {
  buildScheduledMessagesFilterReceipt,
  buildScheduledMessagesReviewUrl,
  buildScheduledMessagesTargetReceipt,
  filterScheduledMessagesForView,
  getScheduledMessageCategories,
  getScheduledMessagesFilterConditionCounts,
  getScheduledMessagesFilterReasonCounts,
  hasScheduledMessagesViewFilters,
  isSelfOnlyScheduledMessage,
  parseScheduledMessagesQueryFilters,
} from '../scheduledMessagesFilters.js';

const makeMessage = (overrides: Partial<ScheduledMessage>): ScheduledMessage => ({
  ID: overrides.ID || `msg_${Math.random()}`,
  Topic: overrides.Topic || 'Topic',
  Content: overrides.Content || 'Content',
  Push_Method: overrides.Push_Method || 'Bot',
  Target_Type: overrides.Target_Type || 'private',
  Status: overrides.Status || 'Active',
  ...overrides,
});

test('scheduled messages query parser extracts a single category filter', () => {
  assert.deepEqual(
    parseScheduledMessagesQueryFilters('?category=Snooze'),
    {
      categories: ['Snooze'],
      filterPendingReview: false,
      filterSelfOnly: false,
      configureRingCentralSender: false,
    },
  );
});

test('scheduled messages query parser supports repeated and comma-separated categories', () => {
  assert.deepEqual(
    parseScheduledMessagesQueryFilters('?category=Snooze&categories=%E6%8F%90%E9%86%92,AutoReply&filterPendingReview=true&filterSelfOnly=1&messageId=reply_123'),
    {
      categories: ['Snooze', '提醒', 'AutoReply'],
      filterPendingReview: true,
      filterSelfOnly: true,
      configureRingCentralSender: false,
      targetMessageId: 'reply_123',
    },
  );
});

test('scheduled messages query parser supports RingCentral sender config deep link', () => {
  assert.equal(
    parseScheduledMessagesQueryFilters('?configureRingCentralSender=true')
      .configureRingCentralSender,
    true,
  );
});

test('scheduled messages review URL preserves message id as a single query string', () => {
  assert.equal(
    buildScheduledMessagesReviewUrl('auto reply/123'),
    'scheduled-messages.html?filterPendingReview=true&messageId=auto+reply%2F123',
  );
});

test('scheduled message category parsing trims empty values', () => {
  assert.deepEqual(getScheduledMessageCategories(' Snooze, , AutoReply ,提醒 '), [
    'Snooze',
    'AutoReply',
    '提醒',
  ]);
});

test('scheduled messages self-only filter matches only the current single recipient', () => {
  assert.equal(
    isSelfOnlyScheduledMessage(makeMessage({ Glip_User_Name: 'esone.qiu' }), 'Esone.Qiu'),
    true,
  );
  assert.equal(
    isSelfOnlyScheduledMessage(makeMessage({ Glip_User_Name: 'Esone Qiu' }), 'esone.qiu'),
    true,
  );
  assert.equal(
    isSelfOnlyScheduledMessage(makeMessage({ Glip_User_Name: 'esone.qiu@ringcentral.com' }), 'esone.qiu'),
    true,
  );
  assert.equal(
    isSelfOnlyScheduledMessage(makeMessage({ Glip_User_Name: 'esone.qiu+john.doe' }), 'esone.qiu'),
    false,
  );
  assert.equal(
    isSelfOnlyScheduledMessage(makeMessage({ Glip_User_Name: 'Esone Qiu, John Doe' }), 'esone.qiu'),
    false,
  );
  assert.equal(
    isSelfOnlyScheduledMessage(makeMessage({ Glip_User_Name: 'john.doe' }), 'esone.qiu'),
    false,
  );
});

test('scheduled messages view filter composes pending review, self-only, and categories', () => {
  const messages = [
    makeMessage({ ID: 'pending-snooze', Status: 'PendingReview', Category: 'Snooze', Glip_User_Name: 'john.doe' }),
    makeMessage({ ID: 'pending-self', Status: 'PendingReview', Category: 'Snooze', Glip_User_Name: 'Esone Qiu' }),
    makeMessage({ ID: 'active-snooze', Status: 'Active', Category: 'Snooze', Glip_User_Name: 'john.doe' }),
    makeMessage({ ID: 'pending-other-category', Status: 'PendingReview', Category: 'AutoReply', Glip_User_Name: 'john.doe' }),
  ];

  const filtered = filterScheduledMessagesForView(messages, {
    selectedCategories: ['snooze'],
    filterPendingReview: true,
    filterSelfOnly: true,
    currentUsername: 'esone.qiu',
  });

  assert.deepEqual(filtered.map((message) => message.ID), ['pending-snooze']);
});

test('scheduled messages view filter reports whether recovery UI is needed', () => {
  assert.equal(
    hasScheduledMessagesViewFilters({
      selectedCategories: [],
      filterPendingReview: false,
      filterSelfOnly: false,
    }),
    false,
  );
  assert.equal(
    hasScheduledMessagesViewFilters({
      selectedCategories: ['Snooze'],
      filterPendingReview: false,
      filterSelfOnly: false,
    }),
    true,
  );
});

test('scheduled messages filter receipt summarizes visible and hidden scope', () => {
  const messages = [
    makeMessage({ ID: 'pending-snooze', Status: 'PendingReview', Category: 'Snooze', Glip_User_Name: 'john.doe' }),
    makeMessage({ ID: 'pending-self', Status: 'PendingReview', Category: 'Snooze', Glip_User_Name: 'esone.qiu' }),
    makeMessage({ ID: 'active-snooze', Status: 'Active', Category: 'Snooze', Glip_User_Name: 'john.doe' }),
    makeMessage({ ID: 'pending-other-category', Status: 'PendingReview', Category: 'AutoReply', Glip_User_Name: 'john.doe' }),
  ];
  const filters = {
    selectedCategories: ['Snooze'],
    filterPendingReview: true,
    filterSelfOnly: true,
    currentUsername: 'esone.qiu',
  };

  assert.deepEqual(getScheduledMessagesFilterReasonCounts(messages, filters), {
    selfOnly: 1,
    notPendingReview: 1,
    categoryMismatch: 1,
  });

  const receipt = buildScheduledMessagesFilterReceipt(messages, filters);

  assert.ok(receipt);
  assert.equal(receipt.title, '列表筛选回执');
  assert.equal(receipt.summary, '当前显示 1/4 条，3 条暂时隐藏。');
  assert.equal(receipt.tone, 'info');
  assert.deepEqual(receipt.details, [
    '范围: 待审核 / 隐藏仅发给我的消息 / 类别 Snooze',
    '待审核条件: 1 条非待审核消息不满足当前筛选',
    '个人提醒条件: 1 条仅发给 esone.qiu 的消息不满足当前筛选',
    '个人提醒识别: 按 esone.qiu / Esone Qiu / 邮箱本地名 归一匹配；多人或群组消息不会被隐藏',
    '类别条件: 1 条消息没有匹配这些类别',
    '边界: 筛选只改变当前列表，不会暂停、删除、改期或同步 Sheet',
  ]);
});

test('scheduled messages filter receipt reports overlapping filter conditions', () => {
  const messages = [
    makeMessage({ ID: 'pending-snooze', Status: 'PendingReview', Category: 'Snooze', Glip_User_Name: 'john.doe' }),
    makeMessage({ ID: 'active-other-self', Status: 'Active', Category: 'AutoReply', Glip_User_Name: 'esone.qiu' }),
    makeMessage({ ID: 'active-snooze', Status: 'Active', Category: 'Snooze', Glip_User_Name: 'john.doe' }),
    makeMessage({ ID: 'pending-other-category', Status: 'PendingReview', Category: 'AutoReply', Glip_User_Name: 'john.doe' }),
  ];
  const filters = {
    selectedCategories: ['Snooze'],
    filterPendingReview: true,
    filterSelfOnly: true,
    currentUsername: 'esone.qiu',
  };

  assert.deepEqual(getScheduledMessagesFilterReasonCounts(messages, filters), {
    selfOnly: 1,
    notPendingReview: 1,
    categoryMismatch: 1,
  });
  assert.deepEqual(getScheduledMessagesFilterConditionCounts(messages, filters), {
    selfOnly: 1,
    notPendingReview: 2,
    categoryMismatch: 2,
    totalConditionMatches: 5,
    overlappingHiddenCount: 2,
  });

  const receipt = buildScheduledMessagesFilterReceipt(messages, filters);

  assert.ok(receipt);
  assert.equal(receipt.summary, '当前显示 1/4 条，3 条暂时隐藏。');
  assert.deepEqual(receipt.details, [
    '范围: 待审核 / 隐藏仅发给我的消息 / 类别 Snooze',
    '待审核条件: 2 条非待审核消息不满足当前筛选',
    '个人提醒条件: 1 条仅发给 esone.qiu 的消息不满足当前筛选',
    '个人提醒识别: 按 esone.qiu / Esone Qiu / 邮箱本地名 归一匹配；多人或群组消息不会被隐藏',
    '类别条件: 2 条消息没有匹配这些类别',
    '重叠: 部分隐藏消息同时命中多个条件，各条件相加会比隐藏总数多 2 次',
    '边界: 筛选只改变当前列表，不会暂停、删除、改期或同步 Sheet',
  ]);
});

test('scheduled messages filter receipt marks counts as provisional while background enrichment runs', () => {
  const receipt = buildScheduledMessagesFilterReceipt(
    [
      makeMessage({ ID: 'pending-snooze', Status: 'PendingReview', Category: 'Snooze', Glip_User_Name: 'john.doe' }),
      makeMessage({ ID: 'active-snooze', Status: 'Active', Category: 'Snooze', Glip_User_Name: 'john.doe' }),
    ],
    {
      selectedCategories: ['Snooze'],
      filterPendingReview: true,
      filterSelfOnly: false,
    },
    { isBackgroundLoading: true },
  );

  assert.ok(receipt);
  assert.equal(receipt.title, '列表筛选回执：后台补齐中');
  assert.equal(receipt.summary, '当前显示 1/2 条，1 条暂时隐藏。');
  assert.ok(receipt.details.includes(
    '快照: 当前计数基于已读取的 Messages 行；Jira / Outreach / Done 回填仍在后台补齐，完成后筛选结果会自动刷新',
  ));
  assert.ok(receipt.details.includes(
    '边界: 筛选只改变当前列表，不会暂停、删除、改期或同步 Sheet',
  ));
});

test('scheduled messages filter receipt warns when self-only filter lacks identity', () => {
  const receipt = buildScheduledMessagesFilterReceipt(
    [
      makeMessage({ ID: 'self', Glip_User_Name: 'esone.qiu' }),
    ],
    {
      selectedCategories: [],
      filterPendingReview: false,
      filterSelfOnly: true,
    },
  );

  assert.ok(receipt);
  assert.equal(receipt.title, '列表筛选回执：需要账号信息');
  assert.equal(receipt.tone, 'warning');
  assert.equal(receipt.summary, '当前显示 1/1 条，0 条暂时隐藏。');
  assert.ok(receipt.details.includes('个人提醒条件: 当前账号未识别，隐藏仅发给我的消息暂未生效'));
});

test('scheduled messages target receipt explains focused message filter override', () => {
  const receipt = buildScheduledMessagesTargetReceipt({
    targetMessageId: 'done-1',
    targetMessage: makeMessage({
      ID: 'done-1',
      Topic: 'Done topic',
      Status: 'Done',
      Category: 'General',
      Glip_User_Name: 'john.doe',
    }),
    filters: {
      selectedCategories: ['Snooze'],
      filterPendingReview: true,
      filterSelfOnly: true,
      currentUsername: 'esone.qiu',
    },
  });

  assert.ok(receipt);
  assert.equal(receipt.title, '消息定位回执');
  assert.equal(receipt.tone, 'info');
  assert.equal(receipt.summary, '正在显示目标消息 done-1，当前状态 Done。');
  assert.deepEqual(receipt.details, [
    '目标: Done topic',
    '覆盖筛选: 待审核 / 隐藏仅发给我的消息 / 类别 Snooze',
    '待审核条件: 目标状态是 Done，普通待审核筛选会隐藏它',
    '个人提醒条件: 目标不是仅发给 esone.qiu 的个人提醒',
    '类别条件: 目标类别 General，普通类别筛选会隐藏它',
    '边界: 只是把目标行显示出来；不会批准、拒绝、暂停、删除、改期、发送或同步 Sheet',
    '恢复: 返回完整列表会清除 messageId 和筛选条件',
  ]);
});

test('scheduled messages target receipt warns when focused message is missing', () => {
  const receipt = buildScheduledMessagesTargetReceipt({
    targetMessageId: 'missing-1',
    targetMessage: null,
    filters: {
      selectedCategories: ['AutoReply'],
      filterPendingReview: true,
      filterSelfOnly: false,
    },
  });

  assert.ok(receipt);
  assert.equal(receipt.title, '消息定位回执：目标未找到');
  assert.equal(receipt.tone, 'warning');
  assert.equal(receipt.summary, '消息 missing-1 未在当前 Messages 表中找到。');
  assert.deepEqual(receipt.details, [
    '目标: Messages 行 missing-1',
    '当前筛选: 待审核 / 类别 AutoReply',
    '边界: 未找到目标时不会修改本地列表、Sheet 或执行状态',
    '恢复: 返回完整列表会清除 messageId 和筛选条件',
  ]);
});
