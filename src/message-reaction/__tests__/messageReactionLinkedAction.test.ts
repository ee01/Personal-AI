import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LINKED_ACTION_RUNTIME_MESSAGE_TYPE,
  getMessageReactionActionDefinitions,
} from '../messageReactionLayout.js';
import { translateStaticText } from '../../i18n/staticTranslations.js';
import {
  buildLinkedActionConfigLaunchReceipt,
  buildPendingLinkedActionConfig,
} from '../linkedActionEntry.js';
import {
  buildPendingFollowThreadConfig,
  getPendingFollowThreadOriginalDatetime,
  isPendingFollowThreadConfigFresh,
} from '../followThreadPendingConfig.js';
import {
  buildFollowThreadConfigLaunchReceipt,
  buildFollowThreadCancelReceipt,
  buildFollowThreadCancelConfirmReceipt,
  buildFollowThreadDraftBoundaryReceipt,
  buildFollowThreadExtendedReceipt,
  buildFollowThreadHitStatusText,
  buildFollowThreadListSnapshotReceipt,
  buildFollowThreadManagementStatusReceipt,
  formatFollowThreadExpiry,
  buildFollowThreadSaveResultReceipt,
  getFollowThreadExtendedExpiry,
  getFollowThreadNotifyMethodText,
  isFollowThreadRuleExpired,
} from '../followThreadPresentation.js';

const toEnglish = (text: string): string => translateStaticText(text, 'en-US');

test('toolbar keeps linked action in the fourth functional slot', () => {
  const actions = getMessageReactionActionDefinitions({
    enableSnooze: true,
    enableFollowThread: true,
    enableAutoReply: true,
    enableLinkedAction: true,
  });

  assert.deepEqual(
    actions.map((action) => action.key),
    ['snooze', 'followThread', 'autoReply', 'linkedAction'],
  );
  assert.equal(actions[3]?.label, '联动操作');
  assert.deepEqual(
    actions.map((action) => action.compactLabel),
    ['稍后', '关注', '答复', '联动'],
  );
  assert.deepEqual(
    actions.map((action) => action.compactAlign || 'start'),
    ['start', 'start', 'end', 'start'],
  );
  assert.equal(
    actions[3]?.runtimeMessageType,
    LINKED_ACTION_RUNTIME_MESSAGE_TYPE,
  );
});

test('toolbar replaces auto-reply with follow-up ask on own messages', () => {
  const actions = getMessageReactionActionDefinitions(
    {
      enableSnooze: true,
      enableFollowThread: true,
      enableAutoReply: true,
      enableLinkedAction: true,
    },
    { isOwnMessage: true },
  );

  assert.deepEqual(
    actions.map((action) => action.key),
    ['snooze', 'followThread', 'followupAsk', 'linkedAction'],
  );
  assert.equal(actions[2]?.label, '跟进追问');
  assert.equal(actions[2]?.compactLabel, '跟进');
});

test('toolbar exposes English button labels through the shared i18n map', () => {
  const otherMessageActions = getMessageReactionActionDefinitions(
    {
      enableSnooze: true,
      enableFollowThread: true,
      enableAutoReply: true,
      enableLinkedAction: true,
    },
    { isOwnMessage: false },
    toEnglish,
  );

  assert.deepEqual(
    otherMessageActions.map((action) => action.label),
    ['Remind', 'Watch', 'Reply', 'Openclaw'],
  );
  assert.deepEqual(
    otherMessageActions.map((action) => action.compactLabel),
    ['Remind', 'Watch', 'Reply', 'Openclaw'],
  );

  const ownMessageActions = getMessageReactionActionDefinitions(
    {
      enableSnooze: true,
      enableFollowThread: true,
      enableAutoReply: true,
      enableLinkedAction: true,
    },
    { isOwnMessage: true },
    toEnglish,
  );

  assert.deepEqual(
    ownMessageActions.map((action) => action.label),
    ['Remind', 'Watch', 'Followup', 'Openclaw'],
  );
});

test('toolbar respects linked-action toggle filtering', () => {
  const actions = getMessageReactionActionDefinitions({
    enableSnooze: false,
    enableFollowThread: true,
    enableAutoReply: false,
    enableLinkedAction: true,
  });

  assert.deepEqual(
    actions.map((action) => action.key),
    ['followThread', 'linkedAction'],
  );
});

test('linked action pending config freshness uses request time, not message time', () => {
  const messageTimestamp = Date.parse('2026-05-15T09:30:00Z');
  const requestedAt = Date.parse('2026-05-24T09:30:00Z');

  const pendingConfig = buildPendingLinkedActionConfig(
    {
      sender: 'Alicia Chen',
      groupName: 'Release Room',
      content: 'Please follow up with the release owner before tomorrow noon.',
      messageId: 'msg-1',
      timestamp: messageTimestamp,
      messageLink: 'https://app.ringcentral.com/messages/12345/msg-1',
    },
    requestedAt,
  );

  assert.equal(pendingConfig.timestamp, requestedAt);
  assert.equal(pendingConfig.messageTimestamp, messageTimestamp);
});

test('linked action launch receipt separates config opening from execution', () => {
  const receipt = buildLinkedActionConfigLaunchReceipt();

  assert.match(receipt, /已打开联动操作配置/);
  assert.match(receipt, /当前只是草稿入口/);
  assert.match(receipt, /尚未创建 RuntimeAction/);
  assert.match(receipt, /未调用 OpenClaw/);
  assert.match(receipt, /不会回扫历史消息/);
  assert.match(receipt, /后续新消息命中后/);
  assert.match(receipt, /动作队列/);
  assert.match(receipt, /审批设置/);
});

test('follow-thread pending config preserves original message time separately from request freshness', () => {
  const messageTimestamp = '2026-05-15T09:30:00Z';
  const requestedAt = Date.parse('2026-05-31T08:20:00Z');

  const pendingConfig = buildPendingFollowThreadConfig(
    {
      postId: 'msg-1',
      sender: 'Alicia Chen',
      groupId: '12345',
      groupName: 'Release Team',
      content: 'Please follow up with the release owner before tomorrow noon.',
      timestamp: messageTimestamp,
      messageLink: 'https://app.ringcentral.com/messages/12345/msg-1',
    },
    requestedAt,
  );

  assert.equal(pendingConfig.requestedAt, requestedAt);
  assert.equal(pendingConfig.messageTimestamp, messageTimestamp);
  assert.equal(
    getPendingFollowThreadOriginalDatetime(pendingConfig),
    messageTimestamp,
  );
  assert.equal(
    isPendingFollowThreadConfigFresh(pendingConfig, requestedAt + 60_000),
    true,
  );
  assert.equal(
    isPendingFollowThreadConfigFresh(
      pendingConfig,
      requestedAt + 6 * 60_000,
    ),
    false,
  );
});

test('follow-thread presentation separates config launch from active watch state', () => {
  assert.match(buildFollowThreadConfigLaunchReceipt(), /尚未开始关注/);
  assert.match(buildFollowThreadConfigLaunchReceipt(), /保存规则后/);

  const receipt = buildFollowThreadDraftBoundaryReceipt({
    groupName: 'Release Team',
    notifyMethod: 'bot,chrome',
    notifyFrequency: 'merged',
    expiryDays: '14',
  });

  assert.equal(receipt.title, '关注后续创建边界');
  assert.match(receipt.scopeText, /Release Team/);
  assert.match(receipt.scopeText, /不只看原发送人/);
  assert.match(receipt.lifetimeText, /14 天后自动过期/);
  assert.match(receipt.matchingText, /reply\/thread\/@提及\/引用\/关键词/);
  assert.match(receipt.matchingText, /语义匹配/);
  assert.match(receipt.activationText, /点击保存后/);
  assert.match(receipt.activationText, /不会启用 Watch/);
  assert.match(receipt.deliveryText, /Bot \+ Chrome 通知/);
  assert.match(receipt.deliveryText, /合并推送/);
  assert.match(receipt.boundaryText, /不会回扫历史消息/);
  assert.match(receipt.boundaryText, /不会立刻发送通知/);
  assert.match(receipt.boundaryText, /不会创建自动答复或联动操作/);
});

test('follow-thread save receipt reports original-message index readiness', () => {
  const indexedReceipt = buildFollowThreadSaveResultReceipt({
    ruleName: '关于以下内容的后续讨论',
    indexedOriginal: true,
    notifyMethod: 'bot',
    notifyFrequency: 'immediate',
    expiryDays: 30,
  });

  assert.match(indexedReceipt, /已保存关注后续/);
  assert.match(indexedReceipt, /原消息索引已写入/);
  assert.match(indexedReceipt, /语义匹配都可用/);
  assert.match(indexedReceipt, /通知口径：Bot，即时提醒/);
  assert.match(indexedReceipt, /监听期限：30 天后自动过期/);
  assert.match(indexedReceipt, /没有回扫历史消息/);
  assert.match(indexedReceipt, /没有立刻发送通知/);

  const degradedReceipt = buildFollowThreadSaveResultReceipt({
    ruleName: 'Release owner check',
    indexedOriginal: false,
    notifyMethod: 'chrome',
    notifyFrequency: 'merged',
    expiryDays: '',
  });

  assert.match(degradedReceipt, /原消息索引未确认/);
  assert.match(degradedReceipt, /语义匹配可能降级/);
  assert.match(degradedReceipt, /通知口径：Chrome 通知，合并推送/);
  assert.match(degradedReceipt, /监听期限：手动结束/);
});

test('follow-thread list snapshot receipt explains local read scope and hidden system watches', () => {
  const receipt = buildFollowThreadListSnapshotReceipt({
    totalManualRules: 3,
    visibleRules: 1,
    hiddenSystemRules: 2,
    statusFilter: 'expired',
    sortBy: 'related',
    loadedAt: '2026-06-24T07:55:00Z',
  });

  assert.equal(receipt.title, '列表快照回执');
  assert.match(receipt.sourceText, /chrome\.storage\.local\.concernedItems/);
  assert.match(receipt.sourceText, /本次读取时间/);
  assert.match(receipt.visibilityText, /当前可见 1 条/);
  assert.match(receipt.visibilityText, /手动 Watch 规则总数 3 条/);
  assert.match(receipt.visibilityText, /系统 \/ Outreach 内部 Watch 隐藏 2 条/);
  assert.match(receipt.filterText, /当前筛选：已过期/);
  assert.match(receipt.filterText, /排序：关联数/);
  assert.match(receipt.filterText, /只改变本页展示/);
  assert.match(receipt.boundaryText, /不会取消、延长、补发通知/);
  assert.match(receipt.boundaryText, /重新索引原消息/);
  assert.match(receipt.boundaryText, /写入长期记忆或发送消息/);
});

test('follow-thread management helpers treat manual end as active and explain local-only operations', () => {
  const now = Date.parse('2026-06-24T08:00:00Z');
  const fiveDaysLater = now + 5 * 24 * 60 * 60 * 1000;

  assert.equal(isFollowThreadRuleExpired(0, now), false);
  assert.equal(isFollowThreadRuleExpired('', now), false);
  assert.equal(formatFollowThreadExpiry(0, now), '手动结束');
  assert.equal(formatFollowThreadExpiry('', now), '手动结束');
  assert.equal(isFollowThreadRuleExpired(now, now), true);
  assert.equal(formatFollowThreadExpiry(now, now), '已过期');
  assert.equal(isFollowThreadRuleExpired(now - 1_000, now), true);
  assert.equal(formatFollowThreadExpiry(now + 60 * 60 * 1000, now), '1 小时后');
  assert.equal(formatFollowThreadExpiry(fiveDaysLater, now), '5 天后');
  assert.equal(getFollowThreadExtendedExpiry(0, now), now + 7 * 24 * 60 * 60 * 1000);
  assert.equal(
    getFollowThreadExtendedExpiry(fiveDaysLater, now),
    fiveDaysLater + 7 * 24 * 60 * 60 * 1000,
  );
  assert.equal(
    getFollowThreadNotifyMethodText('bot,chrome'),
    'Bot + Chrome 通知',
  );

  const extendReceipt = buildFollowThreadExtendedReceipt({
    ruleName: 'Release owner check',
    expiredAt: getFollowThreadExtendedExpiry(0, now),
  });
  assert.equal(extendReceipt.tone, 'success');
  assert.match(extendReceipt.body, /只更新本地手动规则/);
  assert.match(extendReceipt.body, /不回扫历史消息/);
  assert.match(extendReceipt.body, /不立刻发送通知/);

  const cancelReceipt = buildFollowThreadCancelReceipt({
    ruleName: 'Release owner check',
  });
  assert.equal(cancelReceipt.tone, 'warning');
  assert.match(cancelReceipt.body, /已删除本地手动规则/);
  assert.match(cancelReceipt.body, /不会删除原消息/);
  assert.match(cancelReceipt.body, /不会立刻清理已写入 Memory Service 的历史索引/);

  const cancelConfirmReceipt = buildFollowThreadCancelConfirmReceipt({
    ruleName: 'Release owner check',
  });
  assert.equal(cancelConfirmReceipt.title, '取消关注待确认');
  assert.match(cancelConfirmReceipt.scopeText, /删除本机手动 Watch 规则/);
  assert.match(cancelConfirmReceipt.scopeText, /停止后续新消息匹配/);
  assert.match(cancelConfirmReceipt.boundaryText, /确认前不会修改本地列表/);
  assert.match(cancelConfirmReceipt.boundaryText, /不会删除 RingCentral 原消息/);
  assert.match(cancelConfirmReceipt.boundaryText, /不会补发或撤回通知/);
  assert.match(cancelConfirmReceipt.boundaryText, /不会立刻清理已写入 Memory Service 的历史索引/);
  assert.match(cancelConfirmReceipt.nextText, /确认取消/);
  assert.match(cancelConfirmReceipt.nextText, /返回/);
});

test('follow-thread management status receipt explains hits, delivery, and read-only boundaries', () => {
  const receipt = buildFollowThreadManagementStatusReceipt({
    relatedCount: 2,
    latestHitText: '5 分钟前',
    latestNotifiedAt: '2026-06-24T07:55:00Z',
    expiredAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
    notifyMethod: 'bot,chrome',
    notifyFrequency: 'merged',
  });

  assert.equal(receipt.title, '监听状态回执');
  assert.match(receipt.stateText, /仍在监听后续新消息/);
  assert.match(receipt.hitText, /已记录 2 条关联消息/);
  assert.match(receipt.hitText, /最新关联：5 分钟前/);
  assert.match(receipt.hitText, /最新通知：06\/24/);
  assert.match(receipt.deliveryText, /Bot \+ Chrome 通知/);
  assert.match(receipt.deliveryText, /合并推送/);
  assert.match(receipt.deliveryText, /不会补发或重发通知/);
  assert.match(receipt.boundaryText, /本机手动 Watch 规则快照/);
  assert.match(receipt.boundaryText, /不会回扫历史消息/);
  assert.match(receipt.boundaryText, /不会发送消息/);
  assert.match(receipt.boundaryText, /不会把关联记录改写成长期记忆/);
});

test('follow-thread management status treats empty hit lists as successful empty state', () => {
  const receipt = buildFollowThreadManagementStatusReceipt({
    relatedCount: 0,
    expiredAt: Date.now() - 1_000,
    notifyMethod: 'chrome',
  });

  assert.match(receipt.stateText, /已过期/);
  assert.match(receipt.stateText, /不会继续匹配新消息/);
  assert.match(receipt.hitText, /还没有关联消息/);
  assert.match(receipt.hitText, /不是读取失败/);
  assert.match(receipt.deliveryText, /Chrome 通知/);
  assert.match(receipt.deliveryText, /即时提醒/);
});

test('follow-thread hit status separates recorded notification from timeline expansion', () => {
  const notified = buildFollowThreadHitStatusText({
    notifiedAt: '2026-06-24T07:55:00Z',
    summary: 'Release owner confirmed.',
  });
  assert.match(notified, /已记录通知时间/);
  assert.match(notified, /06\/24/);
  assert.match(notified, /已有摘要/);
  assert.match(notified, /不会重新发送通知/);

  const localOnly = buildFollowThreadHitStatusText({});
  assert.match(localOnly, /未看到通知时间/);
  assert.match(localOnly, /本地关联记录/);
  assert.match(localOnly, /未记录摘要/);
  assert.match(localOnly, /不会重新发送通知/);
});
