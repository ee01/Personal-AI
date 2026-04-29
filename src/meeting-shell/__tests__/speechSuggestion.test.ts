import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMeetingPilotSpeechSuggestion,
  classifyMeetingPilotSpeechGuidanceInput,
  detectMeetingSpeechLanguage,
} from '../speechSuggestion';
import { createMeetingPilotSessionSnapshot } from '../protocol';

function makeSession(
  overrides: Parameters<typeof createMeetingPilotSessionSnapshot>[0] = {},
) {
  return createMeetingPilotSessionSnapshot({
    meetingId: 'speech-test-meeting',
    tabId: 11,
    url: 'https://v.ringcentral.com/conf/on/speech-test',
    title: 'Mobile Project Sync',
    status: 'recording',
    currentTopic: 'mobile 项目风险',
    summary: '团队正在讨论 mobile release 风险。',
    transcript: [
      {
        id: 'c1',
        speaker: 'Alice',
        text: 'mobile 项目现在最大的风险是什么？',
        ts: 1000,
      },
    ],
    ...overrides,
  });
}

test('detectMeetingSpeechLanguage follows recent meeting language', () => {
  assert.equal(
    detectMeetingSpeechLanguage(['大家看一下 mobile 项目的风险']),
    'zh',
  );
  assert.equal(
    detectMeetingSpeechLanguage(['What is the current blocker?']),
    'en',
  );
});

test('classifyMeetingPilotSpeechGuidanceInput stores stable identity as profile', async () => {
  const result = await classifyMeetingPilotSpeechGuidanceInput(
    { text: '我是 mobile 项目的 tech lead' },
    async () =>
      JSON.stringify({
        scope: 'long_term_profile',
        itemType: 'fact',
        itemKey: 'role',
        itemValue: '用户是 mobile 项目的 tech lead',
        sessionNote: '',
        confidence: 0.91,
        reason: 'stable role',
      }),
  );

  assert.equal(result.scope, 'long_term_profile');
  assert.equal(result.itemType, 'fact');
  assert.equal(result.itemKey, 'role');
  assert.match(result.itemValue, /mobile/);
});

test('classifyMeetingPilotSpeechGuidanceInput keeps meeting-only context out of profile', async () => {
  const result = await classifyMeetingPilotSpeechGuidanceInput({
    text: '这次会议我是主持人，需要提醒 mobile 项目的风险',
  });

  assert.equal(result.scope, 'session_only');
  assert.match(result.sessionNote, /mobile 项目的风险/);
});

test('classifyMeetingPilotSpeechGuidanceInput downgrades low-confidence profile to session', async () => {
  const result = await classifyMeetingPilotSpeechGuidanceInput(
    { text: '我可能负责这个项目的一部分' },
    async () =>
      JSON.stringify({
        scope: 'long_term_profile',
        itemType: 'fact',
        itemKey: 'responsibility',
        itemValue: '用户可能负责这个项目的一部分',
        sessionNote: '',
        confidence: 0.52,
        reason: 'uncertain',
      }),
  );

  assert.equal(result.scope, 'session_only');
  assert.match(result.sessionNote, /负责这个项目/);
});

test('buildMeetingPilotSpeechSuggestion uses session context in fallback', async () => {
  const session = makeSession({
    speechGuidanceContext: {
      sessionNotes: [
        {
          id: 'note-1',
          text: '本次会议需要提醒 mobile 项目的 QA 风险',
          createdAt: 1200,
        },
      ],
      profileRefs: [],
      updatedAt: 1200,
    },
  });

  const suggestion = await buildMeetingPilotSpeechSuggestion({
    session,
    now: 2000,
  });

  assert.equal(suggestion.source, 'session_context');
  assert.equal(suggestion.intent, 'add_context');
  assert.match(suggestion.text, /QA 风险/);
  assert.ok(
    suggestion.evidenceRefs?.some((ref) => ref.kind === 'session_context'),
  );
});

test('buildMeetingPilotSpeechSuggestion keeps language aligned to transcript over notes', async () => {
  const session = makeSession({
    currentTopic: 'mobile 项目风险',
    summary: '团队正在讨论风险。',
    transcript: [
      {
        id: 'c-en',
        speaker: 'Alice',
        text: 'What is the current QA risk for the mobile project?',
        ts: 1000,
      },
    ],
    speechGuidanceContext: {
      sessionNotes: [
        {
          id: 'note-cn',
          text: '本次会议需要提醒 mobile 项目的 QA 风险',
          createdAt: 1200,
        },
      ],
      profileRefs: [],
      updatedAt: 1200,
    },
  });

  const suggestion = await buildMeetingPilotSpeechSuggestion({
    session,
    now: 2000,
  });

  assert.equal(suggestion.language, 'en');
  assert.match(suggestion.text, /^I can add/);
});
