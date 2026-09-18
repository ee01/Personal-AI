import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FOLLOW_THREAD_PUSH_SCENARIO,
  MESSAGE_ANALYSIS_PUSH_SCENARIO,
  buildFollowThreadOriginalMessageInfo,
  isFollowThreadPushItem,
  resolveImmediateNotificationDelivery,
} from '../../messageAnalysisDelivery.js';
import {
  buildBotNotificationMessage,
  buildFollowThreadBotNotificationMessage,
  buildFollowThreadDigestBotNotificationMessage,
  isFollowThreadPush,
  resolveBotMessageTemplate,
  type NotificationData,
} from '../NotificationService.js';

function manualItem(overrides: Record<string, any> = {}): any {
  return {
    id: 'manual-1',
    text: 'Release blockers',
    notifyMethod: 'bot',
    expiredAt: 0,
    ...overrides,
  };
}

function followThreadItem(overrides: Record<string, any> = {}): any {
  return {
    id: 'follow-1',
    text: '关于以下内容的后续讨论："Beta scope"',
    notifyMethod: 'bot',
    expiredAt: 0,
    followThread: true,
    followConfig: {
      originalMessage: {
        postId: 'post-original-1',
        threadId: 'thread-1',
        teamId: 'team-123',
        teamName: 'RCV WT: AI Delegate',
        sender: 'Karan Bhujbal',
        content: 'Could you help to get the Beta scope finalized?',
        datetime: '2026-09-10T10:00:00.000Z',
        messageUrl: 'https://app.ringcentral.com/messages/team-123/post-original-1',
      },
    },
    ...overrides,
  };
}

function notificationData(overrides: Partial<NotificationData> = {}): NotificationData {
  return {
    teamId: 'team-123',
    teamName: 'RCV WT: AI Delegate',
    sender: 'Juan de Bravo',
    messageContent: 'Deploy to cmh09, cutting a new release',
    summary: 'Juan de Bravo 提出了发布步骤',
    datetime: '2026-09-12 15:21:24',
    postId: 'post-reply-1',
    matchedRule: '关于以下内容的后续讨论："Beta scope"',
    replyAdvice: '确认发布计划',
    ...overrides,
  };
}

test('plain concerned-item match stays on the message-analysis push scenario', () => {
  const delivery = resolveImmediateNotificationDelivery({
    manualItems: [manualItem()],
  });

  assert.equal(delivery.pushScenario, MESSAGE_ANALYSIS_PUSH_SCENARIO);
  assert.equal(delivery.followThreadPushItem, undefined);
  assert.equal(
    resolveBotMessageTemplate({ ...notificationData(), pushScenario: delivery.pushScenario }),
    'default',
  );
});

test('watch rule matched only through matched_rule still routes to follow_up', () => {
  // Regression: the LLM can match a 关注后续 rule via `matched_rule` without
  // returning `follow_thread_info`. This used to fall back to `message_analysis`,
  // pushing the follow-up through the message-analysis target and template.
  const delivery = resolveImmediateNotificationDelivery({
    manualItems: [manualItem(), followThreadItem()],
  });

  assert.equal(delivery.pushScenario, FOLLOW_THREAD_PUSH_SCENARIO);
  assert.equal(delivery.followThreadPushItem?.id, 'follow-1');
  assert.equal(isFollowThreadPushItem(delivery.followThreadPushItem), true);
});

test('LLM follow_thread_info keeps the follow_up scenario', () => {
  const delivery = resolveImmediateNotificationDelivery({
    manualItems: [],
    followThreadItem: followThreadItem(),
  });

  assert.equal(delivery.pushScenario, FOLLOW_THREAD_PUSH_SCENARIO);
  assert.equal(delivery.followThreadPushItem?.id, 'follow-1');
});

test('follow-thread pushes carry the original-message anchor', () => {
  const delivery = resolveImmediateNotificationDelivery({
    manualItems: [followThreadItem()],
  });

  assert.deepEqual(
    buildFollowThreadOriginalMessageInfo(delivery.followThreadPushItem),
    {
      sender: 'Karan Bhujbal',
      content: 'Could you help to get the Beta scope finalized?',
      datetime: '2026-09-10T10:00:00.000Z',
      messageUrl:
        'https://app.ringcentral.com/messages/team-123/post-original-1',
    },
  );
  assert.equal(buildFollowThreadOriginalMessageInfo(manualItem()), undefined);
});

test('follow-thread template is independent from the message-analysis template', () => {
  const data = notificationData({
    pushScenario: FOLLOW_THREAD_PUSH_SCENARIO,
    originalMessageInfo: buildFollowThreadOriginalMessageInfo(followThreadItem()),
  });

  const followThreadMessage = buildFollowThreadBotNotificationMessage(data);
  const analysisMessage = buildBotNotificationMessage(data);

  assert.notEqual(followThreadMessage, analysisMessage);
  assert.match(followThreadMessage, /📌 关注后续更新/);
  assert.match(followThreadMessage, /__关注话题__：/);
  assert.match(followThreadMessage, /__后续回复__：/);
  assert.match(followThreadMessage, /__原消息__（来自 Karan Bhujbal）/);
  assert.match(followThreadMessage, /监测到的「关注后续」新动态/);
  assert.doesNotMatch(followThreadMessage, /监测到您可能关注的消息/);

  // The message-analysis template keeps its own shape and footer.
  assert.match(analysisMessage, /__关注项__：/);
  assert.match(analysisMessage, /监测到您可能关注的消息/);
  assert.doesNotMatch(analysisMessage, /📌 关注后续更新/);
});

test('follow-thread digest uses its own template instead of the analysis wrapper', () => {
  const data = notificationData({
    pushScenario: 'follow_up',
    botMessageTemplate: 'follow_thread_digest',
    sender: 'Personal AI',
    messageContent: '📌 **关注后续汇总** (2 条新消息)\n\n**关注话题**: Beta scope',
    summary: '[关注后续合并通知] 2 条汇总',
  });

  assert.equal(resolveBotMessageTemplate(data), 'follow_thread_digest');
  assert.equal(isFollowThreadPush(data), true);

  const digestMessage = buildFollowThreadDigestBotNotificationMessage(data);
  assert.match(digestMessage, /📌 关注后续汇总/);
  assert.match(digestMessage, /汇总的「关注后续」新动态/);
  assert.doesNotMatch(digestMessage, /监测到您可能关注的消息/);
  assert.doesNotMatch(digestMessage, /__关注项__：/);
});

test('scenario default and explicit template override resolve deterministically', () => {
  assert.equal(
    resolveBotMessageTemplate({ ...notificationData(), pushScenario: 'follow_up' }),
    'follow_thread',
  );
  assert.equal(
    resolveBotMessageTemplate({
      ...notificationData(),
      pushScenario: 'follow_up',
      botMessageTemplate: 'default',
    }),
    'default',
  );
  assert.equal(
    resolveBotMessageTemplate({ ...notificationData(), pushScenario: 'message_analysis' }),
    'default',
  );
  assert.equal(resolveBotMessageTemplate(notificationData()), 'default');
});
