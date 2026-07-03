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
    /renderPrepReceipt/,
    'Video Home prep receipt renderer',
  );
  assertContains(
    videoHomeSource,
    /pai-prep-receipt/,
    'Video Home prep receipt styling',
  );
  assertContains(
    videoHomeSource,
    /高置信记忆 0 条/,
    'Video Home calendar-only prep subtitle boundary',
  );
  assertContains(
    videoHomeSource,
    /仅命中日历\/基础信息/,
    'Video Home calendar-only prep receipt boundary',
  );
  assertContains(
    videoHomeSource,
    /isCalendarOnlyMeetingPrepEvidence/,
    'Video Home calendar evidence background classifier',
  );
  assertContains(
    videoHomeSource,
    /sourceLabel[\s\S]+calendar/,
    'Video Home calendar source-label background guard',
  );
  assertContains(
    videoHomeSource,
    /规则 fallback/,
    'Video Home fallback prep receipt label',
  );
  assertContains(
    videoHomeSource,
    /高置信 \${stats\.visibleEvidence} 条/,
    'Video Home high-confidence receipt chip',
  );
  assertContains(
    videoHomeSource,
    /基础背景 \${stats\.backgroundEvidence} 条/,
    'Video Home basic-background receipt chip',
  );
  assertContains(
    videoHomeSource,
    /会中核对 owner \/ 下一步 \/ 风险/,
    'Video Home meeting-use boundary cue',
  );
  assertContains(
    videoHomeSource,
    /本机会写入 Meeting Pilot handoff/,
    'Video Home local handoff boundary receipt',
  );
  assertContains(
    videoHomeSource,
    /不会加入会议、录音、发消息、审批或写回日历\/外部系统/,
    'Video Home no-join/no-send handoff boundary',
  );
  assertContains(
    videoHomeSource,
    /刷新会前准备回执/,
    'Video Home refresh receipt label',
  );
  assertContains(
    videoHomeSource,
    /buildPendingRefreshReceipt/,
    'Video Home pending refresh receipt builder',
  );
  assertContains(
    videoHomeSource,
    /buildRefreshReceipt/,
    'Video Home final refresh receipt builder',
  );
  assertContains(
    videoHomeSource,
    /backfill 准备 \$\{prepareResult\.prepared\} \/ 跳过 \$\{prepareResult\.skipped\} \/ 失败 \$\{prepareResult\.failed\}/,
    'Video Home refresh receipt backfill counts',
  );
  assertContains(
    videoHomeSource,
    /读取预生成缓存/,
    'Video Home refresh receipt cached resolve state',
  );
  assertContains(
    videoHomeSource,
    /刷新只更新本地会前准备展示和 Meeting Pilot handoff 缓存/,
    'Video Home refresh receipt no external write boundary',
  );
  assertContains(
    videoHomeSource,
    /不会加入会议、开启录音、发送消息、创建任务、审批或写回日历\/外部系统/,
    'Video Home refresh receipt non-effect list',
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
  assertContains(
    videoHomeSource,
    /buildMeetingPrepHandoffGoal/,
    'Meeting Pilot handoff goal extraction',
  );
  assertNotContains(
    videoHomeSource,
    /goal:\s*''/,
    'Meeting Pilot empty goal handoff',
  );
  assertContains(videoHomeSource, /prepId/, 'Meeting Pilot prep id handoff');
  assertContains(
    videoHomeSource,
    /generatedMode/,
    'Meeting Pilot generated mode handoff',
  );
  assertContains(
    videoHomeSource,
    /MEETING_PREP_HANDOFFS_STORAGE_KEY/,
    'Meeting Pilot multi-handoff cache key',
  );
  assertContains(
    videoHomeSource,
    /pruneMeetingPrepHandoffs/,
    'Meeting Pilot handoff cache pruning',
  );
  assertContains(
    videoHomeSource,
    /MEETING_PREP_HANDOFF_MAX_ITEMS/,
    'Meeting Pilot handoff cache bound',
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
  assertContains(
    meetingPilotSource,
    /buildMeetingPrepHandoffGoalFromCards/,
    'Meeting Pilot legacy handoff goal fallback',
  );
  assertContains(
    meetingPilotSource,
    /本场关注/,
    'Meeting Pilot handoff goal label',
  );
  assertContains(
    meetingPilotSource,
    /meeting-prep-goal/,
    'Meeting Pilot handoff goal styling',
  );
  assertContains(
    meetingPilotSource,
    /MEETING_PREP_HANDOFFS_STORAGE_KEY/,
    'Meeting Pilot reads multi-handoff cache',
  );
  assertContains(
    meetingPilotSource,
    /selectMeetingPrepHandoffForSession/,
    'Meeting Pilot selects best relevant handoff',
  );
  assertContains(
    meetingPilotSource,
    /getMeetingPrepHandoffMatchScore/,
    'Meeting Pilot handoff relevance scoring',
  );
  assertContains(
    meetingPilotSource,
    /isMeetingPrepHandoffTimePlausible/,
    'Meeting Pilot title-match time guard',
  );
  assertContains(
    meetingPilotSource,
    /eventStart - earlyWindowMs[\s\S]+eventEnd \+ lateWindowMs/,
    'Meeting Pilot title handoff time window',
  );
  assertContains(
    meetingPilotSource,
    /getMeetingPrepHandoffMatchReceipt/,
    'Meeting Pilot handoff match receipt builder',
  );
  assertContains(
    meetingPilotSource,
    /Handoff 匹配回执/,
    'Meeting Pilot handoff match receipt UI label',
  );
  assertContains(
    meetingPilotSource,
    /Meeting ID 精确命中/,
    'Meeting Pilot exact meeting-id match receipt',
  );
  assertContains(
    meetingPilotSource,
    /标题 \+ 时间窗口命中/,
    'Meeting Pilot title time-window match receipt',
  );
  assertContains(
    meetingPilotSource,
    /标题关键词 \+ 时间窗口兜底/,
    'Meeting Pilot weak title fallback receipt',
  );
  assertContains(
    meetingPilotSource,
    /缓存 \$\{formatMeetingPrepHandoffDuration/,
    'Meeting Pilot handoff cache age chip',
  );
  assertContains(
    meetingPilotSource,
    /剩余 \$\{formatMeetingPrepHandoffRemaining/,
    'Meeting Pilot handoff remaining TTL chip',
  );
  assertContains(
    meetingPilotSource,
    /不会加入会议、开启录音、发消息、创建\/完成行动项、写回日历或外部系统/,
    'Meeting Pilot handoff non-effect boundary',
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
