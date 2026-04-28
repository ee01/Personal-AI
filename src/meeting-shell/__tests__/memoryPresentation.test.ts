import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMeetingPilotContextRecallRequest,
  contextMatchToMeetingPilotMemoryRef,
  recallItemToMeetingPilotMemoryRef,
} from '../memoryPresentation';
import type {
  ContextRecallMatch,
  RecallItem,
} from '../../services/MemoryServiceClient';

function recallItem(partial: Partial<RecallItem>): RecallItem {
  return {
    id: 'r1',
    score: 0.5,
    source: 'meeting',
    content: 'hello',
    ...partial,
  } as RecallItem;
}

function contextMatch(partial: Partial<ContextRecallMatch>): ContextRecallMatch {
  return {
    id: 'm1',
    type: 'message',
    title: 'Untitled',
    snippet: 'snippet',
    score: 0.5,
    sourceLabel: 'meeting',
    ...partial,
  } as ContextRecallMatch;
}

test('buildMeetingPilotContextRecallRequest: builds passive request with cleaned text', () => {
  const req = buildMeetingPilotContextRecallRequest({
    excludeMeetingId: 'm-current',
    meetingTitle: 'Project Sync',
    currentTopic: 'Launch',
    summary: 'Discussing rollout',
    transcriptSummary:
      'Alice: ship Friday.\nMeeting Pilot is recording this meeting.\nBob: agreed.',
    meetingMetadata: 'Meeting: Project Sync',
  });
  assert.equal(req.surface, 'meeting_passive');
  assert.equal(req.contextType, 'meeting');
  assert.equal(req.title, 'Project Sync');
  assert.match(req.primaryText || '', /Alice: ship Friday/);
  assert.doesNotMatch(req.primaryText || '', /Meeting Pilot is recording/i);
  assert.equal(req.limit, 3);
  assert.deepEqual(req.sourceTypes, ['meeting', 'manual', 'web', 'glip']);
});

test('contextMatchToMeetingPilotMemoryRef: forwards exploreLink and whyMatched', () => {
  const ref = contextMatchToMeetingPilotMemoryRef(
    contextMatch({
      id: 'mem-1',
      title: 'Decision: ship Friday.',
      snippet: 'Decision: ship Friday.',
      sourceUrl: 'https://example.com/x',
      exploreLink: '#/thread/abc?focus=mem-1',
      whyMatched: 'matched topic launch',
    }),
  );
  assert.equal(ref.id, 'mem-1');
  assert.equal(ref.snippet, 'Decision: ship Friday.');
  assert.equal(ref.exploreLink, '#/thread/abc?focus=mem-1');
  assert.equal(ref.whyMatched, 'matched topic launch');
  assert.equal(ref.sourceUrl, 'https://example.com/x');
});

test('contextMatchToMeetingPilotMemoryRef: blacklists pure boilerplate snippet', () => {
  const ref = contextMatchToMeetingPilotMemoryRef(
    contextMatch({
      title: 'No active screen share is detected.',
      snippet: 'No active screen share is detected.',
    }),
  );
  assert.equal(ref.snippet, '');
});

test('recallItemToMeetingPilotMemoryRef: drops boilerplate lines from full snippet', () => {
  const ref = recallItemToMeetingPilotMemoryRef(
    recallItem({
      content:
        'No active screen share is detected.\nDecision: ship Friday.\nMeeting Pilot is recording this meeting.',
      previewText: 'Decision: ship Friday.',
    }),
  );
  assert.match(ref.fullSnippet || '', /Decision: ship Friday\./);
  assert.doesNotMatch(ref.fullSnippet || '', /No active screen share/i);
  assert.doesNotMatch(ref.fullSnippet || '', /Meeting Pilot is recording/i);
});

test('recallItemToMeetingPilotMemoryRef: keeps non-boilerplate snippet', () => {
  const ref = recallItemToMeetingPilotMemoryRef(
    recallItem({
      previewText: 'Alice committed to the deploy plan.',
      content: 'Alice committed to the deploy plan.',
    }),
  );
  assert.equal(ref.snippet, 'Alice committed to the deploy plan.');
});
