import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getActionReviewWarningLabel,
  getActionReviewWarnings,
  getActiveMeetingActionItems,
  mergeActionItemReviewStates,
  mergeManualActionTimelineEvents,
} from '../actionItemReview.ts';

test('getActionReviewWarnings surfaces incomplete follow-up fields', () => {
  const warnings = getActionReviewWarnings({
    id: 'action-needs-review',
    title: 'Send customer recap',
    owner: 'Unknown',
    status: 'pending',
    reviewState: 'suggested',
  });

  assert.deepEqual(warnings, [
    'missing-owner',
    'missing-deadline',
    'missing-evidence',
  ]);
  assert.deepEqual(warnings.map(getActionReviewWarningLabel), [
    '补负责人',
    '补截止',
    '缺依据',
  ]);
});

test('getActionReviewWarnings accepts evidence-backed assigned items', () => {
  const warnings = getActionReviewWarnings({
    id: 'action-ready',
    title: 'Send customer recap',
    owner: 'Bella',
    deadline: 'Friday',
    status: 'pending',
    reviewState: 'confirmed',
    evidence: 'Bella will send the recap by Friday.',
  });

  assert.deepEqual(warnings, []);
});

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

test('mergeActionItemReviewStates keeps manually added items when generated list is full', () => {
  const merged = mergeActionItemReviewStates(
    Array.from({ length: 12 }, (_, index) => ({
      id: `action-llm-${index}`,
      title: `Generated action ${index}`,
      owner: `Owner ${index}`,
      deadline: `Week ${index}`,
      status: 'pending' as const,
      reviewState: 'suggested' as const,
      source: 'llm' as const,
    })),
    [
      {
        id: 'action-manual-1',
        title: 'Send corrected customer recap',
        owner: 'Esone',
        deadline: 'Friday',
        status: 'pending',
        reviewState: 'confirmed',
        reviewedAt: 123,
        editedAt: 123,
        source: 'manual',
      },
    ],
  );

  assert.equal(merged.length, 12);
  assert.ok(
    merged.some((item) => item.id === 'action-manual-1'),
    'manual action item should survive refresh even when generated items fill the cap',
  );
  assert.equal(merged.filter((item) => item.source === 'llm').length, 11);
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

test('mergeManualActionTimelineEvents restores manual action anchors after refresh', () => {
  const merged = mergeManualActionTimelineEvents(
    [
      {
        id: 'timeline-topic-1',
        type: 'topic',
        title: 'Budget review',
        description: 'Budget review started',
        timestamp: '10:05',
      },
    ],
    [
      {
        id: 'action-manual-1',
        title: 'Send corrected customer recap',
        owner: '',
        deadline: 'Friday',
        status: 'pending',
        reviewState: 'confirmed',
        source: 'manual',
        evidence: 'Alex asked for the written recap before Friday.',
        timestamp: '10:12',
      },
    ],
    [
      {
        id: 'timeline-manual-action-123',
        type: 'action',
        title: 'Send corrected customer recap',
        description: 'Esone · Send corrected customer recap',
        timestamp: '10:12',
      },
    ],
  );

  const manualEvent = merged.find(
    (event) => event.actionItemId === 'action-manual-1',
  );
  assert.ok(manualEvent);
  assert.equal(manualEvent.id, 'timeline-manual-action-123');
  assert.equal(manualEvent.speaker, '待分配');
  assert.match(manualEvent.description, /Alex asked/);
  assert.match(manualEvent.description, /Friday/);
});

test('mergeManualActionTimelineEvents updates edited manual action anchors', () => {
  const merged = mergeManualActionTimelineEvents(
    [
      {
        id: 'timeline-action-manual-1',
        type: 'action',
        title: 'Old recap title',
        description: 'Alex · Old recap title',
        timestamp: '10:12',
        actionItemId: 'action-manual-1',
      },
    ],
    [
      {
        id: 'action-manual-1',
        title: 'Send edited customer recap',
        owner: 'Bella',
        deadline: 'Monday',
        status: 'pending',
        reviewState: 'confirmed',
        source: 'manual',
        timestamp: '10:12',
      },
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'Send edited customer recap');
  assert.equal(merged[0].speaker, 'Bella');
  assert.match(merged[0].description, /Monday/);
});

test('mergeManualActionTimelineEvents removes dismissed manual action anchors', () => {
  const merged = mergeManualActionTimelineEvents(
    [
      {
        id: 'timeline-topic-1',
        type: 'topic',
        title: 'Budget review',
        description: 'Budget review started',
        timestamp: '10:05',
      },
      {
        id: 'timeline-action-manual-1',
        type: 'action',
        title: 'Send corrected customer recap',
        description: 'Esone · Send corrected customer recap',
        timestamp: '10:12',
        actionItemId: 'action-manual-1',
      },
    ],
    [
      {
        id: 'action-manual-1',
        title: 'Send corrected customer recap',
        owner: 'Esone',
        status: 'pending',
        reviewState: 'dismissed',
        source: 'manual',
      },
    ],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'timeline-topic-1');
});
