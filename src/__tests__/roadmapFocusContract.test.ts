/**
 * Guards the Roadmap page → extension → memory seam.
 *
 * The page and the extension live in different build trees, so nothing but a
 * test that runs both halves catches a rename on one side: `postMessageState()`
 * emitted `team` while the content script read `teamId`, which silently
 * disabled focus sync for the entire life of the feature.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildStateMessage } from '../../roadmap-service/web/src/composables/useRoadmapContract.js';
import type { RoadmapItem } from '../../roadmap-service/web/src/types.js';
import {
  isSyntheticItemKey,
  readTeamId,
  toFocusSyncItem,
  type RoadmapStateMessage,
} from '../roadmapFocusContract.js';
import { reportAndRethrowMessageAnalysisError } from '../messageAnalysisError.js';
import { buildMessageFilterSystemPrompt } from '../prompts/messageAnalysis.js';
import type { EnvConfigType } from '../utils.js';
import { buildFocusProjectWatchRules } from '../watchRules.js';

function item(overrides: Partial<RoadmapItem> = {}): RoadmapItem {
  return {
    key: 'NOVA-1',
    type: 'Epic',
    title: 'Imported epic',
    source: 'jira',
    jiraKey: 'NOVA-1',
    projectKey: 'NOVA',
    alias: null,
    quarter: '2026-Q3',
    estimate: 3,
    targetStart: '2026-07-01',
    targetEnd: '2026-08-01',
    scheduled: true,
    start: '2026-07-06',
    days: 21,
    lane: 0,
    expanded: false,
    version: 1,
    subs: [],
    ...overrides,
  };
}

function stateOf(items: RoadmapItem[]): RoadmapStateMessage {
  return buildStateMessage({
    teamId: 'Sp1CSuq7w70L',
    teamName: 'Nova brandy',
    quarter: '2026-Q3',
    editable: true,
    items,
  }) as RoadmapStateMessage;
}

/** What the extension keeps out of `syncFocusSnapshot` before doing any work. */
function readsAsSyncable(state: RoadmapStateMessage): boolean {
  return Boolean(readTeamId(state) && state.editable);
}

test('the page state message is consumable by the extension reader', () => {
  const state = stateOf([item()]);

  assert.equal(readTeamId(state), 'Sp1CSuq7w70L');
  assert.equal(readsAsSyncable(state), true);
  // Both spellings must survive: older extension builds only read `team`.
  assert.equal(state.team, 'Sp1CSuq7w70L');
  assert.equal(state.teamId, 'Sp1CSuq7w70L');
});

test('a page bundle that only sends the legacy team field still syncs', () => {
  const state = stateOf([item()]);
  delete state.teamId;

  assert.equal(readTeamId(state), 'Sp1CSuq7w70L');
  assert.equal(readsAsSyncable(state), true);
});

test('sub-task activity is nested under priorityHints for memory', () => {
  const state = stateOf([
    item({
      subs: [
        {
          id: 's1',
          key: null,
          title: 'child',
          alias: null,
          owner: null,
          start: '2026-07-06',
          days: 7,
          temp: true,
          createdBy: 'Tester',
          version: 1,
        },
      ],
    }),
  ]);

  const synced = toFocusSyncItem(state.items![0]);
  assert.deepEqual(synced.priorityHints, { subActivity: true });
  // memory-service reads priorityHints.subActivity; a stray top-level copy
  // would be dropped on the floor without anyone noticing.
  assert.equal('subActivity' in synced, false);
});

test('start stays an ISO date string all the way through', () => {
  const state = stateOf([item()]);
  assert.equal(typeof state.items![0].start, 'string');

  const synced = toFocusSyncItem(state.items![0]);
  assert.equal(synced.start, '2026-07-06');
  assert.equal(typeof synced.days, 'number');
});

test('description is forwarded for paragraph context and is not a keyword', () => {
  const state = stateOf([
    item({ description: 'LaunchDarkly flags for composer and mobile' }),
  ]);
  assert.equal(
    state.items![0].description,
    'LaunchDarkly flags for composer and mobile',
  );
  const synced = toFocusSyncItem(state.items![0]);
  assert.equal(synced.description, 'LaunchDarkly flags for composer and mobile');
  assert.equal(synced.keywords, undefined);
});

test('draft detection agrees across all four item states', () => {
  const imported = item({ key: 'NOVA-1', source: 'jira', jiraKey: 'NOVA-1' });
  const freshDraft = item({
    key: 'LOCAL-ab12cd34',
    source: 'manual',
    jiraKey: null,
  });
  const resolvedManual = item({
    key: 'LOCAL-ab12cd34',
    source: 'manual',
    jiraKey: 'NOVA-900',
  });

  const state = stateOf([imported, freshDraft, resolvedManual]);
  assert.deepEqual(
    state.items!.map((row) => row.isDraft),
    [false, true, false],
  );
  assert.deepEqual(
    state.items!.map((row) => toFocusSyncItem(row).isDraft),
    [false, true, false],
  );
  assert.deepEqual(
    state.items!.map((row) => toFocusSyncItem(row).jiraKey),
    ['NOVA-1', null, 'NOVA-900'],
  );

  // Fourth state: a stale page bundle that predates manual items and sends no
  // `jiraKey` at all. There the key IS the Jira key, so only the synthetic
  // LOCAL- prefix can mark a draft.
  const stale = toFocusSyncItem({ key: 'NOVA-1', title: 'Imported epic' });
  assert.equal(stale.isDraft, false);
  assert.equal(isSyntheticItemKey('LOCAL-ab12cd34'), true);
  assert.equal(
    toFocusSyncItem({ key: 'LOCAL-ab12cd34', title: 'Manual' }).isDraft,
    true,
  );
});

test('a draft watch rule carries no synthetic key', () => {
  const state = stateOf([
    item({
      key: 'LOCAL-ab12cd34',
      source: 'manual',
      jiraKey: null,
      title: '低端机首帧优化',
      alias: '低端机',
    }),
  ]);
  const synced = toFocusSyncItem(state.items![0]);

  // memory-service derives the id from the immutable item key and mirrors
  // isDraft / jiraKey into externalRef; the rule builder reads it back.
  const [rule] = buildFocusProjectWatchRules([
    {
      id: `roadmap-Sp1CSuq7w70L-local-ab12cd34`,
      displayName: String(synced.displayName),
      name: String(synced.title),
      teamRef: readTeamId(state),
      teamName: 'Nova brandy',
      aliases: ['低端机'],
      externalRef: {
        itemKey: String(synced.key),
        jiraKey: synced.jiraKey as string | null,
        isDraft: Boolean(synced.isDraft),
      },
      targetStart: synced.targetStart as string | null,
      targetEnd: synced.targetEnd as string | null,
    },
  ]);

  assert.equal(rule.text.includes('LOCAL-'), false);
  assert.equal(rule.text.includes('exact Jira key'), false);
  assert.equal(rule.text.includes('has no Jira issue yet'), true);
  assert.equal(rule.text.includes('低端机'), true);
});

test('a resolved item goes back to exact-key matching', () => {
  const [rule] = buildFocusProjectWatchRules([
    {
      id: 'roadmap-Sp1CSuq7w70L-local-ab12cd34',
      displayName: '低端机',
      teamRef: 'Sp1CSuq7w70L',
      teamName: 'Nova brandy',
      aliases: ['低端机', 'NOVA-900'],
      externalRef: {
        itemKey: 'LOCAL-ab12cd34',
        jiraKey: 'NOVA-900',
        isDraft: false,
      },
    },
  ]);

  assert.equal(rule.text.includes('[NOVA-900]'), true);
  assert.equal(rule.text.includes('LOCAL-'), false);
});

test('a focus project watch rule can enter the message analysis prompt', () => {
  const [rule] = buildFocusProjectWatchRules([
    {
      id: 'demo-project',
      displayName: 'Demo project',
      teamName: 'Demo team',
      externalRef: {
        itemKey: 'DEMO-1',
        jiraKey: 'DEMO-1',
        isDraft: false,
      },
    },
  ]);

  const prompt = buildMessageFilterSystemPrompt({
    concernedItems: [rule],
    username: 'Test User',
    envConfig: { ANALYZE_BY_GROUP: true } as EnvConfigType,
  });

  assert.match(prompt, /\[RULE_REF:project:demo-project\]/);
  assert.match(prompt, /Focus project \[DEMO-1\] Demo project/);
});

test('background-safe analysis error handling rethrows the original error', () => {
  const originalError = new Error('primary analysis failure');

  assert.throws(
    () => reportAndRethrowMessageAnalysisError(originalError),
    (error) => error === originalError,
  );
});
