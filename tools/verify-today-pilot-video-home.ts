import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const videoHomeSource = readFileSync(
  new URL('../src/contentScriptRingCentralVideoHome.ts', import.meta.url),
  'utf8',
);
const backgroundSource = readFileSync(
  new URL('../src/background.ts', import.meta.url),
  'utf8',
);
const meetingPilotSource = readFileSync(
  new URL('../src/meeting-shell/meetingSidePanel.tsx', import.meta.url),
  'utf8',
);
const clientSource = readFileSync(
  new URL('../src/services/MemoryServiceClient.ts', import.meta.url),
  'utf8',
);
const routeSource = readFileSync(
  new URL('../memory-service/src/routes/dayPilot.ts', import.meta.url),
  'utf8',
);
const contextAssistSource = readFileSync(
  new URL(
    '../memory-service/src/core/ContextAssistService.ts',
    import.meta.url,
  ),
  'utf8',
);

function assertContains(source: string, pattern: RegExp, label: string) {
  assert.match(source, pattern, `${label} should be present`);
}

function assertNotContains(source: string, pattern: RegExp, label: string) {
  assert.doesNotMatch(source, pattern, `${label} should not be present`);
}

function verifyVideoHomeUsesTodayPilot() {
  assertContains(
    videoHomeSource,
    /TODAY_PILOT_MEETING_PREP_REQUEST/,
    'Video Home Today Pilot request message',
  );
  assertContains(
    videoHomeSource,
    /TODAY_PILOT_PREPARE_MEETINGS_REQUEST/,
    'Video Home refresh backfills Today Pilot meeting prep',
  );
  assertContains(
    videoHomeSource,
    /loadPrepAfterSync: false/,
    'Video Home refresh avoids racing cache reads before backfill',
  );
  assertNotContains(
    videoHomeSource,
    /CONTEXT_ASSIST_REQUEST/,
    'Video Home legacy Context Assist meeting prep request',
  );
  assertContains(
    videoHomeSource,
    /Today Pilot 会前准备/,
    'Video Home Today Pilot label',
  );
  assertContains(
    videoHomeSource,
    /autoGenerate: false/,
    'Video Home reads pre-generated prep without on-page generation',
  );
  assertNotContains(
    videoHomeSource,
    /本次目标|生成建议|重新生成|发送到 Meeting Pilot|userGoal|data-action="generate"|data-role="goal"/,
    'Video Home goal-input/on-demand generation UI',
  );
  assertContains(
    videoHomeSource,
    /source: 'today_pilot'/,
    'Meeting Pilot handoff source',
  );
  assertContains(videoHomeSource, /prepId/, 'Meeting Pilot prep id handoff');
  assertContains(
    videoHomeSource,
    /generatedMode/,
    'Meeting Pilot generated mode handoff',
  );
}

function verifyBackgroundHandlers() {
  assertContains(
    backgroundSource,
    /TODAY_PILOT_MEETING_PREP_REQUEST/,
    'background resolve handler',
  );
  assertContains(
    backgroundSource,
    /TODAY_PILOT_PREPARE_MEETINGS_REQUEST/,
    'background prepare handler',
  );
  assertContains(
    backgroundSource,
    /resolveTodayPilotMeetingPrep/,
    'background client resolve call',
  );
  assertContains(
    backgroundSource,
    /prepareTodayPilotMeetingPreps/,
    'background client prepare call',
  );
}

function verifyMeetingPilotConsumption() {
  assertContains(
    meetingPilotSource,
    /source\?: 'today_pilot' \| 'context_assist'/,
    'Meeting Pilot handoff source type',
  );
  assertContains(meetingPilotSource, /prepId\?: string/, 'prep id field');
  assertContains(meetingPilotSource, /Today Pilot/, 'Meeting Pilot label');
  assertContains(
    meetingPilotSource,
    /会前准备已带入/,
    'Meeting Pilot handoff copy',
  );
}

function verifyClientAndApi() {
  assertContains(
    clientSource,
    /resolveTodayPilotMeetingPrep/,
    'client resolve method',
  );
  assertContains(
    clientSource,
    /prepareTodayPilotMeetingPreps/,
    'client prepare method',
  );
  assertContains(
    routeSource,
    /\/today-pilot\/meeting-prep\/resolve/,
    'resolve API route',
  );
  assertContains(
    routeSource,
    /\/today-pilot\/meeting-prep\/prepare/,
    'prepare API route',
  );
  assertContains(
    contextAssistSource,
    /resolveFromContextAssist/,
    'Context Assist meeting prep delegation',
  );
}

verifyVideoHomeUsesTodayPilot();
verifyBackgroundHandlers();
verifyMeetingPilotConsumption();
verifyClientAndApi();

console.log('Today Pilot Video Home integration verified.');
