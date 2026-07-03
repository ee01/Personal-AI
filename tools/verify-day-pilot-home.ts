import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const overviewSource = readFileSync(
  new URL('../src/modals/components/OverviewPage.vue', import.meta.url),
  'utf8',
);
const shellSource = readFileSync(
  new URL('../src/modals/memory-exploring.vue', import.meta.url),
  'utf8',
);
const popupSource = readFileSync(
  new URL('../src/popup.tsx', import.meta.url),
  'utf8',
);
const clientSource = readFileSync(
  new URL('../src/services/MemoryServiceClient.ts', import.meta.url),
  'utf8',
);
const serverSource = readFileSync(
  new URL('../memory-service/src/server.ts', import.meta.url),
  'utf8',
);
const dayPilotRouteSource = readFileSync(
  new URL('../memory-service/src/routes/dayPilot.ts', import.meta.url),
  'utf8',
);
const dayPilotServiceSource = readFileSync(
  new URL('../memory-service/src/core/DayPilotService.ts', import.meta.url),
  'utf8',
);
const dayPilotMigrationSource = readFileSync(
  new URL(
    '../memory-service/src/storage/migrations/022_day_pilot.sql',
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

function verifyDayPilotStructure() {
  assertContains(overviewSource, /class="day-pilot-home"/, 'Day Pilot shell');
  assertContains(overviewSource, /今日 Mission/, 'mission section');
  assertContains(overviewSource, /需要你处理/, 'attention section');
  assertContains(overviewSource, /今日时间线/, 'timeline section');
  assertContains(overviewSource, /未读主题入口/, 'compact topic entry');
  assertContains(overviewSource, /生成上下文包/, 'context pack control');
  assertContains(overviewSource, /provider-segment/, 'provider selector');
  assertContains(overviewSource, /包含敏感原文/, 'sensitive handoff toggle');
  assertContains(
    overviewSource,
    /contextPackPreActionReceipt/,
    'context pack pre-action receipt builder',
  );
  assertContains(
    overviewSource,
    /上下文包范围/,
    'context pack pre-action receipt label',
  );
  assertContains(
    overviewSource,
    /复制只写入本机剪贴板，不会发送给外部 AI、批准\/执行或写回来源系统/,
    'context pack pre-copy no-send boundary',
  );
  assertContains(
    overviewSource,
    /card\.executionChannel === 'openclaw'/,
    'OpenClaw execution channel branch',
  );
  assertContains(
    overviewSource,
    /v-if="!card\.executionChannel"/,
    'execution cards hide context pack controls',
  );
  assertContains(
    overviewSource,
    /detectExecutionChannel/,
    'execution channel detector',
  );
  assertContains(
    overviewSource,
    /delegate\[_-\]\?openclaw\|openclaw_delegation/,
    'OpenClaw delegation detection',
  );
  assertContains(
    overviewSource,
    /missionEmptyMessage/,
    'degraded mission empty state',
  );
  assertContains(
    overviewSource,
    /记忆统计暂不可用/,
    'stats degraded source tag copy',
  );
  assertContains(
    overviewSource,
    /loadStats\(\)/,
    'stats refresh alongside Today Pilot load',
  );
  assertContains(
    overviewSource,
    /resetDayPilotDerivedCounts/,
    'failed Today Pilot load resets derived counters',
  );
  assertContains(
    overviewSource,
    /processedMissionFeedbackCount/,
    'post-feedback visible snapshot counter',
  );
  assertContains(
    overviewSource,
    /当前是反馈后的可见快照/,
    'post-feedback visible snapshot receipt',
  );
  assertContains(
    overviewSource,
    /不代表来源任务完成、消息已读、排程变更或外部系统已同步/,
    'post-feedback snapshot non-source-mutation boundary',
  );
  assertContains(
    overviewSource,
    /尚不能判断今天是否没有高优先级事项/,
    'failed Today Pilot copy avoids false empty success',
  );
  assertContains(
    overviewSource,
    /刚才错过了什么/,
    'catch-up section title',
  );
  assertContains(
    overviewSource,
    /补课回执/,
    'catch-up read-only receipt',
  );
  assertContains(
    overviewSource,
    /不会标已读、代回复、改排序或写回来源系统/,
    'catch-up no-read/no-write boundary',
  );
  assertContains(
    overviewSource,
    /catchUpWaitingOverlapCount/,
    'catch-up waiting/high-priority overlap counter',
  );
  assertContains(
    overviewSource,
    /catchUpHighPriorityItemIds/,
    'catch-up high-priority displayed id set',
  );
  assertContains(
    overviewSource,
    /等你回已在高优变化展示/,
    'catch-up overlap receipt copy',
  );
  assertContains(
    overviewSource,
    /不重复当成第二条待办/,
    'catch-up duplicate task boundary',
  );
}

function verifyRealDataSources() {
  assertContains(
    overviewSource,
    /client\.getTodayPilotToday\(/,
    'Today Pilot today source',
  );
  assertContains(
    overviewSource,
    /sendTodayPilotCardFeedback/,
    'Today Pilot feedback source',
  );
  assertContains(
    overviewSource,
    /renderTodayPilotContextPack/,
    'Today Pilot context pack source',
  );
  assertContains(
    overviewSource,
    /sendCardSignal\(card, 'useful'\)/,
    'useful feedback signal',
  );
  assertContains(
    overviewSource,
    /sendCardSignal\(card, 'wrong'\)/,
    'wrong feedback signal',
  );
  for (const directApi of [
    /client\.getConfirmRequests/,
    /client\.getActions\(/,
    /client\.getOutreach/,
    /client\.getSkillSuggestions/,
    /client\.getNotifications\(/,
    /client\.getReflectionThreads/,
  ]) {
    assertNotContains(
      overviewSource,
      directApi,
      `legacy frontend aggregate source: ${directApi}`,
    );
  }
  for (const oldBuilderUse of [
    /\.map\(buildDecisionMission\)/,
    /\.map\(buildActionMission\)/,
    /\.map\(buildOutreachSessionMission\)/,
    /\.map\(buildSkillSuggestionMission\)/,
    /\.map\(buildNotificationMission\)/,
    /\.map\(buildTopicMission\)/,
  ]) {
    assertNotContains(
      overviewSource,
      oldBuilderUse,
      `legacy mission builder usage: ${oldBuilderUse}`,
    );
  }
}

function verifyBackendDayPilotApi() {
  assertContains(
    serverSource,
    /dayPilotRoutes/,
    'Day Pilot route registration',
  );
  assertContains(
    dayPilotRouteSource,
    /\['\/day-pilot', '\/today-pilot'\]/,
    'Today Pilot canonical alias route loop',
  );
  assertContains(dayPilotRouteSource, /\$\{prefix\}\/today/, 'today API route');
  assertContains(
    dayPilotRouteSource,
    /\$\{prefix\}\/refresh/,
    'refresh API route',
  );
  assertContains(
    dayPilotRouteSource,
    /\$\{prefix\}\/cards\/:id\/feedback/,
    'feedback API route',
  );
  assertContains(
    dayPilotRouteSource,
    /\$\{prefix\}\/missions\/:id\/context-pack/,
    'context pack API route',
  );
  for (const table of [
    'day_briefs',
    'day_missions',
    'day_brief_cards',
    'day_brief_feedback',
  ]) {
    assertContains(
      dayPilotMigrationSource,
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`),
      `${table} migration`,
    );
  }
  for (const source of [
    'messages_raw',
    'calendar_events',
    'notification_records',
    'proposed_actions',
    'reflection_threads',
    'personal_skills',
    'relationship_radar_people',
  ]) {
    assertContains(
      dayPilotServiceSource,
      new RegExp(source),
      `${source} scanner`,
    );
  }
  assertContains(
    dayPilotServiceSource,
    /PROVIDER_PROFILES/,
    'provider-specific context pack profiles',
  );
  assertContains(
    dayPilotServiceSource,
    /prepareEvidenceForHandoff/,
    'redaction-aware context pack rendering',
  );
  assertContains(
    dayPilotServiceSource,
    /truncated: clamped\.truncated/,
    'context pack truncation metadata',
  );
  assertContains(
    dayPilotServiceSource,
    /usageIntent/,
    'context pack usage intent metadata',
  );
  assertContains(
    dayPilotServiceSource,
    /context_only_not_execution/,
    'context pack execution boundary metadata',
  );
  assertContains(
    dayPilotServiceSource,
    /Handoff Boundary/,
    'context pack body handoff boundary',
  );
  assertContains(
    clientSource,
    /truncated: boolean/,
    'client context pack truncation type',
  );
  assertContains(
    dayPilotServiceSource,
    /applyFeedbackSignal/,
    'feedback rank adjustment',
  );
  assertContains(
    dayPilotServiceSource,
    /ACTIONABLE_RELATIONSHIP_PATTERN/,
    'relationship radar actionability gate',
  );
  assertContains(
    dayPilotServiceSource,
    /ACTIONABLE_FOLLOWUP_PATTERN/,
    'general mission actionability gate',
  );
  assertContains(
    dayPilotServiceSource,
    /ACTIONABLE_QUESTION_PATTERN/,
    'question-only noise gate',
  );
  assertContains(
    dayPilotServiceSource,
    /hasConcreteFollowupSignal/,
    'generic mission fallback filter',
  );
  assertContains(
    dayPilotServiceSource,
    /hasAiToolShiftActionSignal/,
    'AI tool passive-news actionability gate',
  );
  assertContains(
    dayPilotServiceSource,
    /PASSIVE_AI_TOOL_NEWS_PATTERN/,
    'passive AI tool news noise filter',
  );
  assertContains(
    dayPilotServiceSource,
    /source_type = 'calendar' AND timestamp <= \?/,
    'raw calendar memories respect Today Pilot horizon',
  );
  assertContains(
    dayPilotServiceSource,
    /!ACTIONABLE_NOTIFICATION_TYPES\.has\(row\.type \|\| ''\)/,
    'ordinary notification actionability gate',
  );
  assertContains(
    dayPilotServiceSource,
    /relationshipCandidate\(row, currentTime\)/,
    'relationship radar current-time scoring',
  );
  assertContains(
    clientSource,
    /getTodayPilotToday/,
    'client getTodayPilotToday method',
  );
  assertContains(
    clientSource,
    /DayPilotCatchUpBrief/,
    'client catch-up brief type',
  );
  assertContains(
    clientSource,
    /getTodayPilotCatchUp/,
    'client getTodayPilotCatchUp method',
  );
  assertContains(
    dayPilotRouteSource,
    /\$\{prefix\}\/catch-up/,
    'Today Pilot catch-up API route',
  );
  assertContains(
    clientSource,
    /refreshTodayPilot/,
    'client refreshTodayPilot method',
  );
  assertContains(
    clientSource,
    /sendDayPilotCardFeedback/,
    'client feedback method',
  );
  assertContains(
    clientSource,
    /sendTodayPilotCardFeedback/,
    'canonical client feedback method',
  );
  assertContains(
    clientSource,
    /renderDayPilotContextPack/,
    'client context pack method',
  );
  assertContains(
    clientSource,
    /renderTodayPilotContextPack/,
    'canonical client context pack method',
  );
}

function verifyHomepageIsReadOnlyOrDelegating() {
  assertNotContains(
    overviewSource,
    /answerConfirmRequest/,
    'decision write API on homepage',
  );
  assertNotContains(
    overviewSource,
    /transitionConfirmRequestState/,
    'decision state transition API on homepage',
  );
  assertNotContains(
    overviewSource,
    /handleMuteTopic|handleMarkTopicAsRead|topic-action-btn|waterfallTopics/,
    'full topic triage controls on homepage',
  );
  assertContains(
    overviewSource,
    /\/actions\?actionId=|\/skills|\/timeline|\/search/,
    'delegating detail route',
  );
  assertNotContains(
    overviewSource,
    /Personal-AI 项目已进入测试阶段/,
    'old fake overview content',
  );
}

function verifyMissionCardsAreConcreteItems() {
  for (const groupedTitle of [
    '个事项需要你拍板',
    '个动作正在等待处理',
    '个主动询问需要关注',
    '条个人技能萃取建议',
    '个主题包含未读讨论',
    '条自我反思仍在跟踪',
  ]) {
    assertNotContains(
      overviewSource,
      new RegExp(groupedTitle),
      `grouped mission title: ${groupedTitle}`,
    );
  }

  assertContains(overviewSource, /mapDayPilotCard/, 'Day Pilot card mapper');
  assertContains(
    overviewSource,
    /const loaded = await loadContextPack\(card\)/,
    'context pack copy waits for generated pack',
  );
  assertContains(
    overviewSource,
    /上下文包生成失败，未复制/,
    'context pack copy failure does not claim success',
  );
  assertContains(
    overviewSource,
    /contextPackCopyReceipt/,
    'context pack copy receipt',
  );
  assertContains(
    overviewSource,
    /submitAmbientCalibrationTrace/,
    'Today Pilot context pack copy calibration trace',
  );
  assertContains(
    overviewSource,
    /action: 'copied_context'/,
    'Today Pilot context copy action trace',
  );
  assertContains(
    overviewSource,
    /rawTextStored: false/,
    'Today Pilot copy trace redacts raw context body',
  );
  assertContains(
    overviewSource,
    /rankingSummary/,
    'ranking and noise-control summary',
  );
  assertContains(
    overviewSource,
    /getTodayPilotSourceStatItems/,
    'shared Today Pilot source-stat item builder',
  );
  assertContains(
    overviewSource,
    /summarizeTodayPilotNoiseBreakdown/,
    'visible source-level noise breakdown',
  );
  assertContains(
    overviewSource,
    /displaySourceStats/,
    'display-visible source stats',
  );
  assertContains(
    overviewSource,
    /visibleDayPilotCardIds/,
    'display-visible interruption budget filter',
  );
  assertContains(
    overviewSource,
    /card\.cardType !== 'rehearsal_prompt'/,
    'hidden rehearsal prompts excluded from display counts',
  );
  assertContains(
    dayPilotServiceSource,
    /rehearsalCueReceipt/,
    'backend Today Pilot rehearsal cue receipt',
  );
  assertContains(
    overviewSource,
    /预演回执/,
    'visible Today Pilot rehearsal cue receipt',
  );
  assertContains(
    overviewSource,
    /条信号进入候选池/,
    'visible candidate-pool count',
  );
  assertContains(
    overviewSource,
    /条证据进入首页 mission/,
    'visible final selected-evidence count',
  );
  assertContains(
    overviewSource,
    /条候选未入选首页/,
    'visible candidate-not-selected count',
  );
  assertContains(
    overviewSource,
    /条前置降噪信号 · \$\{prefilteredNoiseBreakdown\}/,
    'visible prefiltered-noise source breakdown',
  );
  assertContains(
    dayPilotServiceSource,
    /sourceStatsWithSelectedCounts/,
    'backend selected source stats',
  );
  assertContains(
    dayPilotServiceSource,
    /selected: selected\.messages/,
    'message selected source stats',
  );
  assertContains(
    clientSource,
    /selected\?: number/,
    'client selected source stats type',
  );
  assertContains(
    overviewSource,
    /只有 Now\/高优先级且低隐私风险的 mission 会占用提醒预算/,
    'visible interruption-budget rationale',
  );
  assertContains(
    overviewSource,
    /已按当前预算截断/,
    'context pack truncation note',
  );
  assertContains(
    dayPilotServiceSource,
    /renderedEvidenceCount/,
    'context pack rendered evidence coverage',
  );
  assertContains(
    dayPilotServiceSource,
    /Source Scope/,
    'context pack source scope section',
  );
  assertContains(
    overviewSource,
    /contextPackSourceCoverageReceipt/,
    'context pack visible source coverage receipt',
  );
  assertContains(
    overviewSource,
    /Mission 反馈回执/,
    'visible Today Pilot feedback receipt',
  );
  assertContains(
    overviewSource,
    /missionFeedbackPendingCardIds/,
    'Today Pilot feedback pending lock state',
  );
  assertContains(
    overviewSource,
    /buildMissionFeedbackPendingReceipt/,
    'Today Pilot feedback pending receipt builder',
  );
  assertContains(
    overviewSource,
    /等待 Memory Service 确认前，这张 mission 仍保留当前状态/,
    'Today Pilot feedback pending no optimistic hide boundary',
  );
  assertContains(
    overviewSource,
    /尚未写入 Today Pilot 展示\/排序反馈/,
    'Today Pilot feedback pending no-write boundary',
  );
  assertContains(
    overviewSource,
    /buildMissionFeedbackReceipt/,
    'Today Pilot feedback receipt builder',
  );
  assertContains(
    overviewSource,
    /不会把来源任务、动作队列、决策、消息或外部系统标记为已完成/,
    'Today Pilot done feedback boundary',
  );
  assertContains(
    overviewSource,
    /这不是修改来源排程、日历或动作执行时间/,
    'Today Pilot later feedback boundary',
  );
  assertContains(
    overviewSource,
    /这不会删除原始记忆、证据或来源消息/,
    'Today Pilot mute feedback boundary',
  );
  assertContains(
    popupSource,
    /复制正文/,
    'popup context pack copy coverage receipt',
  );
}

function verifyDemoContentWasRemoved() {
  for (const fakeText of [
    'Personal-AI 项目已进入测试阶段',
    'Data Pipeline',
    '张三',
    '李四',
    'Clean Architecture',
    'Webpack 5',
  ]) {
    assertNotContains(
      overviewSource,
      new RegExp(fakeText),
      `old demo text: ${fakeText}`,
    );
  }
}

function verifyShellLabel() {
  assertContains(
    shellSource,
    /memoryExplorer\.nav\.today/,
    'sidebar Today Pilot label key',
  );
  assertNotContains(shellSource, /首页概览/, 'old overview label/comment');
}

function verifyPopupTopThree() {
  assertContains(
    popupSource,
    /topTodayPilotCards\(response\.brief\?\.cards \|\| \[\]\)/,
    'popup top 3 canonical card mapper',
  );
  assertContains(
    popupSource,
    /sendTodayPilotCardFeedback/,
    'popup feedback action',
  );
  assertContains(
    popupSource,
    /buildTodayPilotPopupFeedbackPendingNotice/,
    'popup feedback pending receipt builder',
  );
  assertContains(
    popupSource,
    /等待 Memory Service 确认前，这张 mission 仍保留当前状态/,
    'popup feedback pending keeps card visible',
  );
  assertContains(
    popupSource,
    /尚未写入 Today Pilot 展示\/排序反馈/,
    'popup feedback pending no-write boundary',
  );
  assertContains(
    popupSource,
    /反馈提交失败，原卡仍显示/,
    'popup feedback failure keeps card visible',
  );
  assertContains(
    popupSource,
    /todayPilotCards\.length > 0 \|\| todayPilotNotice/,
    'popup success receipt remains visible after last card is removed',
  );
  assertContains(
    popupSource,
    /disabled=\{feedbackPending\}/,
    'popup feedback pending locks both feedback buttons',
  );
  assertNotContains(
    popupSource,
    /setTodayPilotCards\(\(cards\) => cards\.filter\(\(item\) => item\.id !== card\.id\)\)/,
    'popup should not optimistically hide card before feedback confirmation',
  );
  assertContains(
    popupSource,
    /renderTodayPilotContextPack/,
    'popup canonical context pack renderer',
  );
  assertContains(popupSource, /today-pilot-card-why/, 'popup why-now line');
  assertContains(
    popupSource,
    /formatTodayPilotEvidenceMeta/,
    'popup evidence confidence metadata',
  );
  assertContains(
    popupSource,
    /formatTodayPilotContextPackReceipt/,
    'popup context pack receipt',
  );
  assertContains(
    popupSource,
    /submitTodayPilotContextCopyTrace/,
    'popup context pack copy calibration trace',
  );
  assertContains(
    popupSource,
    /action: 'copied_context'/,
    'popup context copy action trace',
  );
  assertContains(
    popupSource,
    /isTodayPilotExternalExecutionCard/,
    'popup external execution context-pack guard',
  );
  assertContains(
    popupSource,
    /getTodayPilotProcessingPath/,
    'popup external execution processing route',
  );
  assertContains(
    popupSource,
    /popup\.today\.reviewExternal/,
    'popup external execution review action',
  );
  assertContains(
    popupSource,
    /today-pilot-card-meta/,
    'popup compact evidence metadata line',
  );
  assertContains(
    popupSource,
    /buildTodayPilotPopupScopeReceipt/,
    'popup scope receipt builder',
  );
  assertContains(
    popupSource,
    /buildTodayPilotPopupRefreshFailureReceipt/,
    'popup refresh failure snapshot receipt builder',
  );
  assertContains(
    popupSource,
    /today-pilot-scope-receipt/,
    'popup scope receipt UI',
  );
  assertContains(
    popupSource,
    /这里只是 Top 3 快照，不会自动执行/,
    'popup Top 3 execution boundary copy',
  );
  assertContains(
    popupSource,
    /buildTodayPilotPopupSnapshotBasis/,
    'popup Top 3 snapshot-basis receipt builder',
  );
  assertContains(
    popupSource,
    /快照基准/,
    'popup Top 3 snapshot-basis copy',
  );
  assertContains(
    popupSource,
    /不会重新扫描来源、写反馈、发送消息或执行动作/,
    'popup Top 3 snapshot-basis no side effect boundary',
  );
  assertContains(
    popupSource,
    /候选未入选/,
    'popup candidate-not-selected split',
  );
  assertContains(
    popupSource,
    /summarizeTodayPilotNoiseBreakdown/,
    'popup prefiltered-noise source breakdown',
  );
  assertContains(
    popupSource,
    /刷新失败 · 仍显示上次 Top 3 快照/,
    'popup refresh failure keeps last snapshot visible',
  );
  assertContains(
    popupSource,
    /尚未确认当前 Memory Service 最新状态/,
    'popup refresh failure current-state boundary',
  );
  assertContains(popupSource, /稍后 6 小时/, 'popup later feedback toast');
  assertContains(
    popupSource,
    /setTodayPilotCards\(previousCards\)/,
    'popup feedback failure restores card',
  );
}

verifyDayPilotStructure();
verifyRealDataSources();
verifyBackendDayPilotApi();
verifyHomepageIsReadOnlyOrDelegating();
verifyMissionCardsAreConcreteItems();
verifyDemoContentWasRemoved();
verifyShellLabel();
verifyPopupTopThree();

console.log('verify-day-pilot-home: ok');
