import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMeetingPilotAlertReceipt,
  shouldSurfaceMeetingPilotAlert,
} from '../alertPresentation.ts';

test('shouldSurfaceMeetingPilotAlert hides current-speaker context updates', () => {
  assert.equal(
    shouldSurfaceMeetingPilotAlert({
      level: 'P2',
      title: '当前主讲人切换',
      body: 'Alex 正在主讲，当前对话上下文已刷新。',
      source: 'summary',
    }),
    false,
  );

  assert.equal(
    shouldSurfaceMeetingPilotAlert({
      level: 'P2',
      title: 'Current speaker updated',
      body: 'Alex is speaking now and the meeting context refreshed.',
      source: 'summary',
    }),
    false,
  );
});

test('shouldSurfaceMeetingPilotAlert keeps actionable alerts visible', () => {
  assert.equal(
    shouldSurfaceMeetingPilotAlert({
      level: 'P1',
      title: 'You were mentioned',
      body: 'Alex asked Esone to confirm the rollout date.',
      source: 'mention',
    }),
    true,
  );

  assert.equal(
    shouldSurfaceMeetingPilotAlert({
      level: 'P0',
      title: 'Screen action requested',
      body: 'Please scroll to the blocker list.',
      source: 'action',
    }),
    true,
  );
});

test('buildMeetingPilotAlertReceipt explains source-specific action and boundary', () => {
  const now = 1_779_325_200_000;
  const mention = buildMeetingPilotAlertReceipt({
    level: 'P0',
    title: '你被点名',
    body: 'Alex 要求你确认 owner。',
    source: 'mention',
    createdAt: now - 30_000,
  }, { now });
  assert.match(mention.reason, /立即看/);
  assert.match(mention.reason, /点名/);
  assert.match(mention.nextStep, /当场回应/);
  assert.match(mention.boundary, /不会替你发言/);
  assert.match(mention.boundary, /外部任务/);
  assert.match(mention.signal, /新近信号/);
  assert.match(mention.signal, /transcript|会中事件/);
  assert.match(mention.signal, /别把它当成已经回应/);

  const action = buildMeetingPilotAlertReceipt({
    level: 'P1',
    title: '行动项',
    body: 'Esone 需要周三前发评审材料。',
    source: 'action',
    createdAt: now - 8 * 60_000,
  }, { now });
  assert.match(action.reason, /owner|deadline/);
  assert.match(action.nextStep, /负责人/);
  assert.match(action.nextStep, /transcript 依据/);
  assert.match(action.boundary, /不会自动进入跟进清单/);
  assert.match(action.signal, /较旧信号/);
  assert.match(action.signal, /owner、deadline 和依据句/);

  const memory = buildMeetingPilotAlertReceipt({
    level: 'P2',
    title: '历史决策提醒',
    body: '上次已经决定先锁定 QA。',
    source: 'memory',
  }, { now });
  assert.match(memory.reason, /旁路参考/);
  assert.match(memory.reason, /历史记忆|预演提醒/);
  assert.match(memory.boundary, /不会修改记忆/);
  assert.match(memory.signal, /信号时间未知/);
  assert.match(memory.signal, /不是新事实/);
});
