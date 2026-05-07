import test from 'node:test';
import assert from 'node:assert/strict';

import { inferActionItemFromText } from '../actionItems.ts';

test('inferActionItemFromText extracts owner before Chinese responsibility verb', () => {
  const item = inferActionItemFromText({
    text: '决定由 Esone 负责 Meeting Pilot 技术评审，DDL 下周三。',
    speaker: 'Alex Chen',
    chapterId: 'chapter-review',
    index: 0,
    ts: Date.UTC(2026, 4, 2, 8, 30),
  });

  assert.ok(item);
  assert.equal(item.owner, 'Esone');
  assert.equal(item.title, 'Meeting Pilot 技术评审');
  assert.equal(item.deadline, '下周三');
  assert.equal(
    item.evidence,
    '决定由 Esone 负责 Meeting Pilot 技术评审，DDL 下周三。',
  );
  assert.equal(item.source, 'heuristic');
  assert.equal(item.reviewState, 'suggested');
  assert.equal(item.chapterId, 'chapter-review');
});

test('inferActionItemFromText maps first-person follow-up to current speaker', () => {
  const item = inferActionItemFromText({
    text: 'Sprint 8 排期已拉通，QA 资源需要我来跟进。',
    speaker: 'Sarah Wang',
    chapterId: 'chapter-qa',
    index: 1,
    ts: Date.UTC(2026, 4, 2, 8, 31),
  });

  assert.ok(item);
  assert.equal(item.owner, 'Sarah Wang');
  assert.equal(item.title, 'QA 资源');
});

test('inferActionItemFromText ignores vague owner discussion without assignment', () => {
  const item = inferActionItemFromText({
    text: '今天先讨论 Q2 预算，然后看技术评审 owner。',
    speaker: 'Alex Chen',
    chapterId: 'chapter-budget',
    index: 2,
  });

  assert.equal(item, undefined);
});

test('inferActionItemFromText ignores deadline-only scheduling statements', () => {
  const item = inferActionItemFromText({
    text: '下周三继续讨论预算排期和技术评审节奏。',
    speaker: 'Alex Chen',
    chapterId: 'chapter-schedule',
    index: 3,
  });

  assert.equal(item, undefined);
});

test('inferActionItemFromText ignores confirmation-only meeting decisions', () => {
  const item = inferActionItemFromText({
    text: '确认保持当前 Meeting Pilot 技术评审计划。',
    speaker: 'Sarah Wang',
    chapterId: 'chapter-review',
    index: 4,
  });

  assert.equal(item, undefined);
});

test('inferActionItemFromText keeps explicit confirmation assignments', () => {
  const item = inferActionItemFromText({
    text: '请 Esone 确认 Meeting Pilot 技术评审材料，DDL 下周三。',
    speaker: 'Alex Chen',
    chapterId: 'chapter-review',
    index: 5,
  });

  assert.ok(item);
  assert.equal(item.owner, 'Esone');
  assert.equal(item.title, 'Meeting Pilot 技术评审材料');
  assert.equal(item.deadline, '下周三');
});

test('inferActionItemFromText extracts English owner and deadline', () => {
  const item = inferActionItemFromText({
    text: 'Bella will follow up the launch checklist by Friday.',
    speaker: 'Chris',
    chapterId: 'chapter-launch',
    index: 6,
  });

  assert.ok(item);
  assert.equal(item.owner, 'Bella');
  assert.equal(item.title, 'the launch checklist');
  assert.equal(item.deadline, 'Friday');
});
