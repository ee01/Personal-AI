import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldSurfaceMeetingPilotAlert } from '../alertPresentation.ts';

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
