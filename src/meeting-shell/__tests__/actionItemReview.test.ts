import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getActiveMeetingActionItems,
  mergeActionItemReviewStates,
} from '../actionItemReview.ts';

test('mergeActionItemReviewStates preserves review state by stable identity', () => {
  const merged = mergeActionItemReviewStates(
    [
      {
        id: 'action-llm-0',
        title: 'Send launch checklist',
        owner: 'Bella',
        deadline: 'Friday',
        status: 'pending',
        reviewState: 'suggested',
        source: 'llm',
      },
    ],
    [
      {
        id: 'action-old-1',
        title: 'Send launch checklist',
        owner: 'Bella',
        deadline: 'Friday',
        status: 'done',
        reviewState: 'confirmed',
        reviewedAt: 123,
        source: 'heuristic',
      },
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'action-llm-0');
  assert.equal(merged[0].status, 'done');
  assert.equal(merged[0].reviewState, 'confirmed');
  assert.equal(merged[0].reviewedAt, 123);
});

test('mergeActionItemReviewStates does not transfer state across id collision', () => {
  const merged = mergeActionItemReviewStates(
    [
      {
        id: 'action-llm-0',
        title: 'Prepare launch checklist',
        owner: 'Chris',
        deadline: 'Monday',
        status: 'pending',
        source: 'llm',
      },
    ],
    [
      {
        id: 'action-llm-0',
        title: 'Send launch checklist',
        owner: 'Bella',
        deadline: 'Friday',
        status: 'pending',
        reviewState: 'dismissed',
        reviewedAt: 123,
        source: 'llm',
      },
    ],
  );

  const newItem = merged.find(
    (item) => item.title === 'Prepare launch checklist',
  );
  const oldItem = merged.find((item) => item.title === 'Send launch checklist');

  assert.ok(newItem);
  assert.equal(newItem.reviewState, 'suggested');
  assert.equal(newItem.status, 'pending');
  assert.equal(newItem.reviewedAt, undefined);
  assert.ok(oldItem);
  assert.equal(oldItem.reviewState, 'dismissed');
});

test('mergeActionItemReviewStates keeps current items before stale carry-over', () => {
  const merged = mergeActionItemReviewStates(
    [
      {
        id: 'action-llm-0',
        title: 'Confirm launch owner',
        owner: 'Bella',
        deadline: 'Friday',
        status: 'pending',
        source: 'llm',
      },
      {
        id: 'action-llm-1',
        title: 'Send launch checklist',
        owner: 'Chris',
        deadline: 'Monday',
        status: 'pending',
        source: 'llm',
      },
    ],
    Array.from({ length: 12 }, (_, index) => ({
      id: `action-old-${index}`,
      title: `Dismissed stale item ${index}`,
      owner: 'Previous Owner',
      deadline: `Week ${index}`,
      status: 'pending' as const,
      reviewState: 'dismissed' as const,
      reviewedAt: 100 + index,
      source: 'heuristic' as const,
    })),
  );

  assert.equal(merged.length, 12);
  assert.ok(
    merged.some((item) => item.title === 'Confirm launch owner'),
    'first current action item remains visible',
  );
  assert.ok(
    merged.some((item) => item.title === 'Send launch checklist'),
    'second current action item remains visible',
  );
  assert.equal(
    merged.filter((item) => item.reviewState === 'dismissed').length,
    10,
  );
});

test('mergeActionItemReviewStates preserves manual action item edits after refresh', () => {
  const merged = mergeActionItemReviewStates(
    [
      {
        id: 'action-llm-0',
        title: 'Prepare launch checklist',
        owner: 'Bella',
        deadline: 'Friday',
        status: 'pending',
        source: 'llm',
      },
    ],
    [
      {
        id: 'action-llm-0',
        title: 'Send corrected launch checklist',
        owner: 'Bella Zhang',
        deadline: 'Next Monday',
        status: 'pending',
        reviewState: 'confirmed',
        reviewedAt: 123,
        editedAt: 456,
        generatedTitle: 'Prepare launch checklist',
        generatedOwner: 'Bella',
        generatedDeadline: 'Friday',
        source: 'llm',
      },
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'Send corrected launch checklist');
  assert.equal(merged[0].owner, 'Bella Zhang');
  assert.equal(merged[0].deadline, 'Next Monday');
  assert.equal(merged[0].reviewState, 'confirmed');
  assert.equal(merged[0].editedAt, 456);
  assert.equal(merged[0].generatedTitle, 'Prepare launch checklist');
});

test('mergeActionItemReviewStates preserves manual deadline added to generated item without deadline', () => {
  const merged = mergeActionItemReviewStates(
    [
      {
        id: 'action-llm-1',
        title: 'Confirm customer rollout',
        owner: 'Chris',
        status: 'pending',
        source: 'llm',
      },
    ],
    [
      {
        id: 'action-llm-1',
        title: 'Confirm customer rollout',
        owner: 'Chris',
        deadline: 'Wednesday',
        status: 'pending',
        reviewState: 'confirmed',
        reviewedAt: 123,
        editedAt: 456,
        generatedTitle: 'Confirm customer rollout',
        generatedOwner: 'Chris',
        generatedDeadline: '',
        source: 'llm',
      },
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].deadline, 'Wednesday');
  assert.equal(merged[0].generatedDeadline, '');
  assert.equal(merged[0].reviewState, 'confirmed');
});

test('getActiveMeetingActionItems excludes dismissed items', () => {
  const active = getActiveMeetingActionItems([
    {
      id: 'action-active',
      title: 'Prepare launch checklist',
      owner: 'Bella',
      status: 'pending',
      reviewState: 'confirmed',
    },
    {
      id: 'action-dismissed',
      title: 'Discuss vague owner',
      owner: 'Unknown',
      status: 'pending',
      reviewState: 'dismissed',
    },
  ]);

  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'action-active');
});
