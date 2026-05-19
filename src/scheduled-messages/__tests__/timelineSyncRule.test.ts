import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import {
  TIMELINE_PROJECTS,
  buildJiraTimelineReleaseInfoSmartValue,
  buildJiraUrlEncodedSmartValue,
  buildTimelineSyncComponents,
  buildTimelineSyncComponentsFragment,
} from '../timelineProjects.js';
import { redactJiraRulePayloadForLog, redactJiraRuleTextForLog } from '../jiraRulePayloadSafety.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scheduledMessagesDir = resolve(__dirname, '..');

test('Timeline Sync components use GET cache webhooks for every Apps Script callback', () => {
  const components = buildTimelineSyncComponents();
  assert.equal(components.length, TIMELINE_PROJECTS.length * 3);

  for (const project of TIMELINE_PROJECTS) {
    const cacheWebhookIndex = components.findIndex((component: any) =>
      component.type === 'jira.issue.outgoing.webhook' &&
        String(component.value?.url || '').includes('action=cacheReleaseInfo') &&
        String(component.value?.url || '').includes(`project=${project.paramKey}`),
    );
    const cacheWebhook = components[cacheWebhookIndex] as any;

    assert.ok(cacheWebhook, `missing cache webhook for ${project.value}`);
    assert.equal(cacheWebhook.value.method, 'GET');
    assert.equal(cacheWebhook.value.contentType, 'empty');
    assert.equal(cacheWebhook.value.responseEnabled, true);
    assert.deepEqual(cacheWebhook.value.headers, []);
    assert.equal(
      cacheWebhook.value.url,
      `{{WEB_APP_URL}}?action=cacheReleaseInfo&project=${project.paramKey}&releaseInfo=${buildJiraTimelineReleaseInfoSmartValue(project.variableName)}`,
    );
    assert.equal(cacheWebhook.value.customBody, undefined);

    const variableAction = components[cacheWebhookIndex - 1] as any;
    assert.equal(variableAction.type, 'jira.create.variable');
    assert.equal(variableAction.value.query.value, '{{webhookResponse.body}}');

    assert.notEqual(
      components[cacheWebhookIndex + 1]?.type,
      'jira.comparator.condition',
      'cache failures must not stop syncing later projects',
    );
  }
});

test('Timeline Sync components fragment remains valid JSON array content', () => {
  const fragment = buildTimelineSyncComponentsFragment();
  const parsed = JSON.parse(`[${fragment}]`);

  assert.equal(parsed.length, TIMELINE_PROJECTS.length * 3);
  assert.equal(
    parsed.filter((component: any) => component.type === 'jira.create.variable').length,
    TIMELINE_PROJECTS.length,
  );
  assert.equal(
    parsed.filter((component: any) => component.type === 'jira.comparator.condition').length,
    0,
  );
});

test('Jira URL encoding helper keeps explicit %20 space encoding', () => {
  assert.equal(
    buildJiraUrlEncodedSmartValue('messageId'),
    '{{messageId.urlEncode.replaceAll("\\+","%20")}}',
  );
});

test('Jira Timeline release info helper strips apostrophes before GET query encoding', () => {
  assert.equal(
    buildJiraTimelineReleaseInfoSmartValue('mThorReleaseInfo'),
    '{{mThorReleaseInfo.replaceAll("\'","").urlEncode.replaceAll("\\+","%20")}}',
  );
});

test('Apps Script Timeline project map stays aligned with generated rule projects', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = TIMELINE_PROJECT_PARAM_MAP;`,
    context,
  );

  assert.deepEqual(
    Array.from(context.result).map((project: any) => ({
      project: project.project,
      paramKey: project.paramKey,
    })),
    TIMELINE_PROJECTS.map(project => ({
      project: project.value,
      paramKey: project.paramKey,
    })),
  );
});

test('Apps Script reports Timeline cache status without exposing release dates or internal cache keys', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const timestamp = Date.now() - (5 * 60 * 1000);
  const properties: Record<string, string> = {
    TIMELINE_CACHE_mThor: JSON.stringify({
      project: 'mThor',
      paramKey: 'mThor',
      updatedAt: new Date(timestamp).toISOString(),
      timestamp,
      releaseInfo: {
        currentRelease: '25.4.20',
        releaseInfo: {
          FF: '05/10/2026',
          Release: '05/20/2026',
        },
      },
    }),
  };
  const context = {
    Logger: { log: () => undefined },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
      }),
    },
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = getTimelineCacheStatus();`,
    context,
  );

  assert.equal(context.result.success, true);
  assert.equal(context.result.totalProjects, TIMELINE_PROJECTS.length);
  assert.equal(context.result.readyProjects, 1);
  assert.equal(context.result.missingProjects, TIMELINE_PROJECTS.length - 1);

  const mThorStatus = context.result.projects.find((project: any) => project.project === 'mThor');
  assert.equal(mThorStatus.status, 'ready');
  assert.deepEqual(Array.from(mThorStatus.milestoneKeys), ['FF', 'Release']);
  assert.doesNotMatch(JSON.stringify(context.result), /05\/10\/2026|05\/20\/2026/);
  assert.doesNotMatch(JSON.stringify(context.result), /TIMELINE_CACHE_/);
});

test('Apps Script preserves Timeline project metadata while reading wrapped milestone maps', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    releaseInfo: {
      mThor: {
        currentRelease: '26.2',
        currentPhase: 'FF',
        releaseInfo: {
          FF: '05/06/2026',
        },
      },
    },
    result: null as any,
    targetDate: null as any,
  };

  vm.runInNewContext(
    `${appScript}
const projectInfo = getTimelineProjectInfo(releaseInfo, 'mThor');
result = replaceProjectVariablesInText('Release {currentRelease} is in {currentPhase}', projectInfo);
targetDate = getTimelineTargetDate({ Timeline_Project: 'mThor', Timeline_Milestone: 'FF', Timeline_Offset: '0' }, releaseInfo);`,
    context,
  );

  assert.equal(context.result, 'Release 26.2 is in FF');
  assert.equal(context.targetDate.getFullYear(), 2026);
  assert.equal(context.targetDate.getMonth(), 4);
  assert.equal(context.targetDate.getDate(), 6);
});

test('Apps Script parses form-decoded Jira urlEncode releaseInfo with spaces and literal plus', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const releaseInfo =
    '{currentRelease=25.4.20, currentPhase=Regression, releaseInfo={=M/J Release 25.4.20, CF=11/13/2025, Product DF=, Literal Plus=A+B}}';
  const encoded = new URLSearchParams({ releaseInfo }).toString();
  const decodedReleaseInfo = new URLSearchParams(encoded).get('releaseInfo');
  const context = {
    Logger: { log: () => undefined },
    decodedReleaseInfo,
    result: null as any,
  };

  assert.match(encoded, /currentPhase/);
  assert.match(encoded, /\+/);
  assert.match(encoded, /A%2BB/);
  assert.equal(decodedReleaseInfo?.includes('+currentPhase'), false);

  vm.runInNewContext(
    `${appScript}\nresult = parseSingleProjectReleaseInfo(decodedReleaseInfo);`,
    context,
  );

  assert.equal(context.result.currentPhase, 'Regression');
  assert.equal(context.result.releaseInfo[''], 'M/J Release 25.4.20');
  assert.equal(context.result.releaseInfo['Product DF'], '');
  assert.equal(context.result.releaseInfo['Literal Plus'], 'A+B');
});

test('Apps Script parses nested Groovy arrays without flattening object values', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const groovyMap =
    '{currentRelease=25.4.20, releaseInfo={FF=11/13/2025}, blockers=[{key=MTR-1, count=2, active=true, tags=[api, qa]}, "quoted, value", false, null, 3.5]}';
  const context = {
    Logger: { log: () => undefined },
    groovyMap,
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = parseJiraJson(groovyMap);`,
    context,
  );

  assert.equal(context.result.currentRelease, '25.4.20');
  assert.equal(context.result.releaseInfo.FF, '11/13/2025');
  assert.equal(context.result.blockers[0].key, 'MTR-1');
  assert.equal(context.result.blockers[0].count, 2);
  assert.equal(context.result.blockers[0].active, true);
  assert.deepEqual(Array.from(context.result.blockers[0].tags), ['api', 'qa']);
  assert.equal(context.result.blockers[1], 'quoted, value');
  assert.equal(context.result.blockers[2], false);
  assert.equal(context.result.blockers[3], null);
  assert.equal(context.result.blockers[4], 3.5);
});

test('Apps Script parses unquoted Groovy keys containing apostrophes', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const groovyMap =
    "{currentRelease=26.2.30, releaseInfo={FF=6/9/2026, Kira's group DF=, Rollout 100%=7/1/2026}}";
  const context = {
    Logger: { log: () => undefined },
    groovyMap,
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = parseSingleProjectReleaseInfo(groovyMap);`,
    context,
  );

  assert.equal(context.result.currentRelease, '26.2.30');
  assert.equal(context.result.releaseInfo.FF, '6/9/2026');
  assert.equal(context.result.releaseInfo["Kira's group DF"], '');
  assert.equal(context.result.releaseInfo['Rollout 100%'], '7/1/2026');
});

test('Apps Script keeps quoted commas and equals signs inside Groovy map values', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const groovyMap =
    '{releaseInfo={"Product, DF"="11/13/2025", Notes="Alpha, Beta = ready", Escaped="A\\\\B"}}';
  const context = {
    Logger: { log: () => undefined },
    groovyMap,
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = parseJiraJson(groovyMap);`,
    context,
  );

  assert.equal(context.result.releaseInfo['Product, DF'], '11/13/2025');
  assert.equal(context.result.releaseInfo.Notes, 'Alpha, Beta = ready');
  assert.equal(context.result.releaseInfo.Escaped, 'A\\B');
});

test('Apps Script parses common Groovy quoted-string escapes', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const groovyMap =
    '{releaseInfo={FF="Line\\nOne", Unicode="Gate \\u2713", Backspace="A\\bB", FormFeed="A\\fB"}}';
  const context = {
    Logger: { log: () => undefined },
    groovyMap,
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = parseJiraJson(groovyMap);`,
    context,
  );

  assert.equal(context.result.releaseInfo.FF, 'Line\nOne');
  assert.equal(context.result.releaseInfo.Unicode, 'Gate ✓');
  assert.equal(context.result.releaseInfo.Backspace, 'A\bB');
  assert.equal(context.result.releaseInfo.FormFeed, 'A\fB');
});

test('Apps Script rejects invalid scheduled times instead of treating them as midnight', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}
result = {
  validMorning: parseTimeToMinutes('9:05'),
  validNoon: parseTimeToMinutes('12:00 PM'),
  invalidHour: parseTimeToMinutes('25:00'),
  invalidMinute: parseTimeToMinutes('09:60'),
  invalidText: parseTimeToMinutes('not-a-time')
};`,
    context,
  );

  assert.equal(context.result.validMorning, 545);
  assert.equal(context.result.validNoon, 720);
  assert.equal(context.result.invalidHour, null);
  assert.equal(context.result.invalidMinute, null);
  assert.equal(context.result.invalidText, null);
});

test('Apps Script compensates scheduled executor messages across midnight', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    Session: { getScriptTimeZone: () => 'Asia/Shanghai' },
    Utilities: {
      formatDate: (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
    },
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}
var headers = ['ID', 'Status', 'Push_Method', 'Schedule_Date', 'Schedule_Time', 'Topic', 'Content', 'Last_Exec', 'Exec_Log'];
var data = [
  headers,
  ['MSG_LATE', 'Active', 'Bot', '2026-05-02', '23:50', 'Late check', 'content', '', '待执行']
];
var now = new Date(2026, 4, 3, 0, 5);
result = findMatchingMessage(data, headers, now, {}, 'PAST_30_MINUTES', '2026-05-03', 0);`,
    context,
  );

  assert.equal(context.result.ID, 'MSG_LATE');
  assert.equal(context.result.matchMode, 'PAST_30_MINUTES');
});

test('Apps Script only returns AsMe messages to Jira when RingCentral sender is enabled', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    Session: { getScriptTimeZone: () => 'Asia/Shanghai' },
    Utilities: {
      formatDate: (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
    },
    disabled: null as any,
    enabled: null as any,
  };

  vm.runInNewContext(
    `${appScript}
var headers = ['ID', 'Status', 'Push_Method', 'Schedule_Date', 'Schedule_Time', 'Topic', 'Content', 'Glip_User_Name', 'Glip_Team_ID', 'Last_Exec', 'Exec_Log'];
var data = [
  headers,
  ['MSG_ASME', 'Active', 'AsMe', '2026-05-03', '09:00', 'As me', 'hello @John', 'esone.qiu', '', '', '']
];
var now = new Date(2026, 4, 3, 9, 0);
disabled = findMatchingMessage(data, headers, now, {}, 'CURRENT_MINUTE', '2026-05-03', 9, false);
enabled = findMatchingMessage(data, headers, now, {}, 'CURRENT_MINUTE', '2026-05-03', 9, true);`,
    context,
  );

  assert.equal(context.disabled, null);
  assert.equal(context.enabled.ID, 'MSG_ASME');
  assert.equal(context.enabled.targetType, 'ringcentral_sender');
  assert.equal(context.enabled.chatId, 'esone.qiu');
});

test('Apps Script uses Glip_Team_ID as RingCentral AsMe chatId for group targets', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    Session: { getScriptTimeZone: () => 'Asia/Shanghai' },
    Utilities: {
      formatDate: (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
    },
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}
var headers = ['ID', 'Status', 'Push_Method', 'Schedule_Date', 'Schedule_Time', 'Topic', 'Content', 'Glip_User_Name', 'Glip_Team_ID', 'Last_Exec', 'Exec_Log'];
var data = [
  headers,
  ['MSG_ASME_GROUP', 'Active', 'AsMe', '2026-05-03', '09:00', 'As me group', 'hello team', '', '123456789', '', '']
];
var now = new Date(2026, 4, 3, 9, 0);
result = findMatchingMessage(data, headers, now, {}, 'CURRENT_MINUTE', '2026-05-03', 9, true);`,
    context,
  );

  assert.equal(context.result.targetType, 'ringcentral_sender');
  assert.equal(context.result.chatId, '123456789');
});

test('Apps Script keeps no-time executor messages out of current-minute matching', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    Session: { getScriptTimeZone: () => 'Asia/Shanghai' },
    Utilities: {
      formatDate: (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
    },
    current: null as any,
    noTime: null as any,
  };

  vm.runInNewContext(
    `${appScript}
var headers = ['ID', 'Status', 'Push_Method', 'Schedule_Date', 'Schedule_Time', 'Topic', 'Content', 'Last_Exec', 'Exec_Log'];
var data = [
  headers,
  ['MSG_NO_TIME', 'Active', 'Bot', '2026-05-03', '', 'No-time bot', 'queued', '', ''],
  ['MSG_EXPLICIT', 'Active', 'Bot', '2026-05-03', '09:00', 'Explicit bot', 'scheduled', '', '']
];
var now = new Date(2026, 4, 3, 9, 0);
current = findMatchingMessage(data, headers, now, {}, 'CURRENT_MINUTE', '2026-05-03', 9, false);
noTime = findMatchingMessage(data, headers, now, {}, 'NO_TIME_SPECIFIED', '2026-05-03', 9, false);`,
    context,
  );

  assert.equal(context.current.ID, 'MSG_EXPLICIT');
  assert.equal(context.current.matchMode, 'CURRENT_MINUTE');
  assert.equal(context.noTime.ID, 'MSG_NO_TIME');
  assert.equal(context.noTime.matchMode, 'NO_TIME_SPECIFIED');
});

test('Apps Script keeps no-time RingCentral AsMe sender messages at the 09:00 default', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    Session: { getScriptTimeZone: () => 'Asia/Shanghai' },
    Utilities: {
      formatDate: (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
    },
    earlyQueue: null as any,
    atDefault: null as any,
  };

  vm.runInNewContext(
    `${appScript}
var headers = ['ID', 'Status', 'Push_Method', 'Schedule_Date', 'Schedule_Time', 'Topic', 'Content', 'Glip_User_Name', 'Glip_Team_ID', 'Last_Exec', 'Exec_Log'];
var data = [
  headers,
  ['MSG_ASME_NO_TIME', 'Active', 'AsMe', '2026-05-03', '', 'AsMe no time', 'hello', 'esone.qiu', '', '', '']
];
earlyQueue = findMatchingMessage(data, headers, new Date(2026, 4, 3, 8, 30), {}, 'NO_TIME_SPECIFIED', '2026-05-03', 8, true);
atDefault = findMatchingMessage(data, headers, new Date(2026, 4, 3, 9, 0), {}, 'CURRENT_MINUTE', '2026-05-03', 9, true);`,
    context,
  );

  assert.equal(context.earlyQueue, null);
  assert.equal(context.atDefault.ID, 'MSG_ASME_NO_TIME');
  assert.equal(context.atDefault.targetType, 'ringcentral_sender');
});

test('Apps Script leaves RingCentral AsMe sender messages unmarked until Jira confirms Dify success', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const headers = [
    'ID',
    'Topic',
    'Content',
    'Push_Method',
    'Glip_User_Name',
    'Glip_Team_ID',
    'Schedule_Date',
    'Schedule_Time',
    'Last_Exec',
    'Exec_Count',
    'Next_Exec',
    'Exec_Log',
    'Status',
  ];
  const data = [
    headers,
    ['MSG_ASME', 'As me', 'hello @John', 'AsMe', 'esone.qiu', '', '2026-05-03', '12:00', '', '0', '', '', 'Active'],
  ];
  const configRows = [
    ['Key', 'Value'],
    ['ringcentral_sender_enabled', 'true'],
    ['ringcentral_sender_client_id', 'client-id'],
    ['ringcentral_sender_client_secret', 'client-secret'],
    ['ringcentral_sender_jwt', 'jwt'],
    ['bot_automation_executor_rule_id', '2709'],
  ];
  const updates: any[] = [];
  const logs: any[] = [];
  const properties: Record<string, string> = {};
  const context = createMarkExecutedVmContext(data, updates, logs, properties, configRows);

  vm.runInNewContext(
    `${appScript}
result = getMessageCurrentTimeWithReleaseInfo({ currentTime: '2026-05-03 12:00', releaseInfo: {} });`,
    context,
  );

  assert.equal(context.result.executed, true);
  assert.equal(context.result.targetType, 'ringcentral_sender');
  assert.equal(context.result.messageId, 'MSG_ASME');
  assert.equal(context.result.chatId, 'esone.qiu');
  assert.equal(updates.length, 0);
  assert.equal(logs.length, 0);
});

test('Apps Script does not fire explicit executor messages before the scheduled minute', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    Session: { getScriptTimeZone: () => 'Asia/Shanghai' },
    Utilities: {
      formatDate: (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
    },
    early: null as any,
    onTime: null as any,
    late: null as any,
    midnightLate: null as any,
  };

  vm.runInNewContext(
    `${appScript}
var headers = ['ID', 'Status', 'Push_Method', 'Schedule_Date', 'Schedule_Time', 'Topic', 'Content', 'Last_Exec', 'Exec_Log'];
var data = [
  headers,
  ['MSG_EXACT', 'Active', 'Bot', '2026-05-04', '09:30', 'Exact check', 'content', '', '待执行']
];
early = findMatchingMessage(data, headers, new Date(2026, 4, 4, 9, 29), {}, 'CURRENT_MINUTE', '2026-05-04', 9);
onTime = findMatchingMessage(data, headers, new Date(2026, 4, 4, 9, 30), {}, 'CURRENT_MINUTE', '2026-05-04', 9);
late = findMatchingMessage(data, headers, new Date(2026, 4, 4, 9, 31), {}, 'CURRENT_MINUTE', '2026-05-04', 9);

var midnightData = [
  headers,
  ['MSG_MIDNIGHT', 'Active', 'Bot', '2026-05-04', '23:59', 'Midnight check', 'content', '', '待执行']
];
midnightLate = findMatchingMessage(midnightData, headers, new Date(2026, 4, 5, 0, 0), {}, 'CURRENT_MINUTE', '2026-05-05', 0);`,
    context,
  );

  assert.equal(context.early, null);
  assert.equal(context.onTime.ID, 'MSG_EXACT');
  assert.equal(context.late.ID, 'MSG_EXACT');
  assert.equal(context.midnightLate.ID, 'MSG_MIDNIGHT');
});

test('Apps Script does not compensate an already executed previous-day message across midnight', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    Session: { getScriptTimeZone: () => 'Asia/Shanghai' },
    Utilities: {
      formatDate: (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      },
    },
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}
var headers = ['ID', 'Status', 'Push_Method', 'Schedule_Date', 'Schedule_Time', 'Topic', 'Content', 'Last_Exec', 'Exec_Log'];
var data = [
  headers,
  ['MSG_LATE', 'Active', 'Bot', '2026-05-02', '23:50', 'Late check', 'content', '2026-05-02 23:50', '✅ 推送成功']
];
var now = new Date(2026, 4, 3, 0, 5);
result = findMatchingMessage(data, headers, now, {}, 'PAST_30_MINUTES', '2026-05-03', 0);`,
    context,
  );

  assert.equal(context.result, null);
});

test('Apps Script treats End_Date as inclusive for periodic schedules', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}
var message = {
  Schedule_Date: '2026-05-01',
  End_Date: '2026-05-04',
  Repeat_Every: '1',
  Repeat_Unit: 'Day',
  Status: 'Active'
};
result = {
  runsOnEndDate: checkPeriodicSchedule(message, new Date(2026, 4, 4, 9, 0)),
  skipsAfterEndDate: checkPeriodicSchedule(message, new Date(2026, 4, 5, 9, 0)),
  doneAfterEndDateRun: shouldMarkAsDone(message, new Date(2026, 4, 4, 9, 0))
};`,
    context,
  );

  assert.equal(context.result.runsOnEndDate, true);
  assert.equal(context.result.skipsAfterEndDate, false);
  assert.equal(context.result.doneAfterEndDateRun, true);
});

test('Apps Script marks periodic messages done after reaching Repeat_Count on this send', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}
result = shouldMarkAsDone({
  Schedule_Date: '2026-05-01',
  Repeat_Every: '1',
  Repeat_Unit: 'Day',
  Repeat_Count: '1',
  Exec_Count: '0'
}, new Date(2026, 4, 1, 9, 0));`,
    context,
  );

  assert.equal(context.result, true);
});

test('Apps Script treats malformed Groovy map input as invalid cache data', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const malformedGroovyMap = '{currentRelease=25.4.20, releaseInfo={FF=11/13/2025';
  const context = {
    Logger: { log: () => undefined },
    malformedGroovyMap,
    parsed: null as any,
    projectInfo: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nparsed = parseJiraJson(malformedGroovyMap);\nprojectInfo = parseSingleProjectReleaseInfo(malformedGroovyMap);`,
    context,
  );

  assert.equal(JSON.stringify(context.parsed), '{}');
  assert.equal(context.projectInfo, null);
});

test('Apps Script cacheReleaseInfo response includes safe milestone diagnostics', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const releaseInfo =
    '{currentRelease=25.4.20, releaseInfo={FF=11/13/2025, Release=11/20/2025}}';
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    releaseInfo,
    result: null as any,
    status: null as any,
  };

  vm.runInNewContext(
    `${appScript}
result = doGet({ parameter: { action: 'cacheReleaseInfo', project: 'mThor', releaseInfo: releaseInfo } });
status = getTimelineCacheStatus();`,
    context,
  );

  const body = JSON.parse(context.result.text);
  const mThorStatus = context.status.projects.find((project: any) => project.project === 'mThor');
  assert.equal(body.success, true);
  assert.equal(body.project, 'mThor');
  assert.match(body.requestId, /^tl_mThor_/);
  assert.equal(body.milestoneCount, 2);
  assert.deepEqual(Array.from(body.milestoneKeys), ['FF', 'Release']);
  assert.equal(mThorStatus.lastAttempt.requestId, body.requestId);
  assert.equal(mThorStatus.lastAttempt.success, true);
  assert.doesNotMatch(context.result.text, /11\/13\/2025|11\/20\/2025/);
  assert.ok(properties.TIMELINE_CACHE_mThor, 'cache payload should be written');
});

test('Apps Script cacheReleaseInfo accepts POST JSON body without query encoding', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const releaseInfo =
    '{currentRelease=25.4.20, currentPhase=Regression, releaseInfo={=M/J Release 25.4.20, Product DF=, Literal Plus=A+B, Release=11/20/2025}}';
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    postBody: JSON.stringify({ project: 'mThor', releaseInfo }),
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = doPost({ parameter: { action: 'cacheReleaseInfo' }, postData: { contents: postBody } });`,
    context,
  );

  const body = JSON.parse(context.result.text);
  const cached = JSON.parse(properties.TIMELINE_CACHE_mThor);

  assert.equal(body.success, true);
  assert.equal(body.project, 'mThor');
  assert.equal(cached.releaseInfo.currentPhase, 'Regression');
  assert.equal(cached.releaseInfo.releaseInfo['Product DF'], '');
  assert.equal(cached.releaseInfo.releaseInfo['Literal Plus'], 'A+B');
});

test('Apps Script cacheReleaseInfo accepts form-urlencoded POST parameters as a compatibility fallback', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const releaseInfo =
    '{currentRelease=25.4.20, currentPhase=Regression, releaseInfo={Product DF=, Literal Plus=A+B, Release=11/20/2025}}';
  const postBody = new URLSearchParams({ project: 'mThor', releaseInfo }).toString();
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    postBody,
    releaseInfo,
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}
result = doPost({
  parameter: { action: 'cacheReleaseInfo', project: 'mThor', releaseInfo: releaseInfo },
  postData: { contents: postBody, type: 'application/x-www-form-urlencoded' }
});`,
    context,
  );

  const body = JSON.parse(context.result.text);
  const cached = JSON.parse(properties.TIMELINE_CACHE_mThor);

  assert.match(context.postBody, /Product\+DF/);
  assert.match(context.postBody, /A%2BB/);
  assert.equal(body.success, true);
  assert.equal(body.project, 'mThor');
  assert.equal(cached.releaseInfo.currentPhase, 'Regression');
  assert.equal(cached.releaseInfo.releaseInfo['Product DF'], '');
  assert.equal(cached.releaseInfo.releaseInfo['Literal Plus'], 'A+B');
});

test('Apps Script cacheReleaseInfo accepts standard JSON object releaseInfo body', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const releaseInfo = {
    currentRelease: '25.4.20',
    currentPhase: 'Regression',
    releaseInfo: {
      FF: '11/13/2025',
      Release: '11/20/2025',
    },
  };
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    postBody: JSON.stringify({ project: 'mThor', releaseInfo }),
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = doPost({ parameter: { action: 'cacheReleaseInfo' }, postData: { contents: postBody } });`,
    context,
  );

  const body = JSON.parse(context.result.text);
  const cached = JSON.parse(properties.TIMELINE_CACHE_mThor);

  assert.equal(body.success, true);
  assert.equal(body.project, 'mThor');
  assert.equal(body.milestoneCount, 2);
  assert.deepEqual(Array.from(body.milestoneKeys), ['FF', 'Release']);
  assert.equal(cached.releaseInfo.currentPhase, 'Regression');
  assert.equal(cached.releaseInfo.releaseInfo.FF, '11/13/2025');
  assert.doesNotMatch(context.result.text, /\[object Object\]/);
});

test('Apps Script cacheReleaseInfo dry-run validates payload without writing cache status', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const releaseInfo = {
    currentRelease: 'diagnostic',
    currentPhase: 'diagnostic',
    releaseInfo: {
      FF: '12/31/2026',
    },
  };
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    postBody: JSON.stringify({ project: 'mThor', dryRun: true, releaseInfo }),
    result: null as any,
    status: null as any,
  };

  vm.runInNewContext(
    `${appScript}
result = doPost({ parameter: { action: 'cacheReleaseInfo' }, postData: { contents: postBody, type: 'application/json' } });
status = getTimelineCacheStatus();`,
    context,
  );

  const body = JSON.parse(context.result.text);
  const mThorStatus = context.status.projects.find((project: any) => project.project === 'mThor');

  assert.equal(body.success, true);
  assert.equal(body.dryRun, true);
  assert.equal(body.wouldCache, true);
  assert.equal(body.project, 'mThor');
  assert.equal(body.paramKey, 'mThor');
  assert.equal(body.milestoneCount, 1);
  assert.deepEqual(Array.from(body.milestoneKeys), ['FF']);
  assert.equal(properties.TIMELINE_CACHE_mThor, undefined);
  assert.equal(properties.TIMELINE_SYNC_ATTEMPT_mThor, undefined);
  assert.equal(mThorStatus.status, 'missing');
  assert.equal(mThorStatus.lastAttempt, undefined);
});

test('Apps Script cacheReleaseInfo exposes only milestones with valid dates', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const releaseInfo =
    '{currentRelease=25.4.20, releaseInfo={=11/01/2025, Product DF=, BadIso=2026-05-10, InvalidDay=02/31/2026, FF=11/13/2025, Release=11/20/2025}}';
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    releaseInfo,
    result: null as any,
    status: null as any,
  };

  vm.runInNewContext(
    `${appScript}
result = doGet({ parameter: { action: 'cacheReleaseInfo', project: 'mThor', releaseInfo: releaseInfo } });
status = getTimelineCacheStatus();`,
    context,
  );

  const body = JSON.parse(context.result.text);
  const mThorStatus = context.status.projects.find((project: any) => project.project === 'mThor');

  assert.equal(body.success, true);
  assert.equal(body.milestoneCount, 2);
  assert.deepEqual(Array.from(body.milestoneKeys), ['FF', 'Release']);
  assert.deepEqual(Array.from(mThorStatus.milestoneKeys), ['FF', 'Release']);
  assert.equal(mThorStatus.milestoneKeys.includes(''), false);
  assert.doesNotMatch(JSON.stringify(mThorStatus), /Product DF|BadIso|InvalidDay/);
});

test('Apps Script cacheReleaseInfo rejects releaseInfo without usable milestone dates', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const releaseInfo =
    '{currentRelease=25.4.20, releaseInfo={=11/13/2025, Product DF=, BadIso=2026-05-10, InvalidDay=02/31/2026}}';
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    releaseInfo,
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = doGet({ parameter: { action: 'cacheReleaseInfo', project: 'mThor', releaseInfo: releaseInfo } });`,
    context,
  );

  const body = JSON.parse(context.result.text);
  assert.equal(body.success, false);
  assert.equal(body.errorCode, 'INVALID_RELEASE_INFO_SCHEMA');
  assert.match(body.parseError, /有效日期/);
  assert.equal(properties.TIMELINE_CACHE_mThor, undefined);
});

test('Apps Script Timeline target date safely ignores malformed milestone values and offsets', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}
var releaseInfo = { mThor: { releaseInfo: { FF: '11/13/2025', Empty: '', Numeric: 20260510, BadIso: '2026-05-10' } } };
var validDate = getTimelineTargetDate({ Timeline_Project: 'mThor', Timeline_Milestone: 'FF', Timeline_Offset: '-1' }, releaseInfo);
result = {
  empty: getTimelineTargetDate({ Timeline_Project: 'mThor', Timeline_Milestone: 'Empty', Timeline_Offset: '0' }, releaseInfo),
  numeric: getTimelineTargetDate({ Timeline_Project: 'mThor', Timeline_Milestone: 'Numeric', Timeline_Offset: '0' }, releaseInfo),
  badIso: getTimelineTargetDate({ Timeline_Project: 'mThor', Timeline_Milestone: 'BadIso', Timeline_Offset: '0' }, releaseInfo),
  badOffset: getTimelineTargetDate({ Timeline_Project: 'mThor', Timeline_Milestone: 'FF', Timeline_Offset: 'abc' }, releaseInfo),
  valid: validDate ? [validDate.getFullYear(), validDate.getMonth() + 1, validDate.getDate()] : null
};`,
    context,
  );

  assert.equal(context.result.empty, null);
  assert.equal(context.result.numeric, null);
  assert.equal(context.result.badIso, null);
  assert.equal(context.result.badOffset, null);
  assert.deepEqual(Array.from(context.result.valid), [2025, 11, 12]);
});

test('Apps Script cacheReleaseInfo reports actionable diagnostics for malformed POST JSON', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    postBody: '{"project":"mThor","releaseInfo": {currentRelease=25.4.20}}',
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = doPost({ parameter: { action: 'cacheReleaseInfo' }, postData: { contents: postBody, type: 'application/json' } });`,
    context,
  );

  const body = JSON.parse(context.result.text);

  assert.equal(body.success, false);
  assert.equal(body.status, 'ERROR');
  assert.equal(body.errorCode, 'INVALID_POST_JSON');
  assert.equal(body.action, 'cacheReleaseInfo');
  assert.match(body.requestId, /^tl_mThor_/);
  assert.equal(body.receivedContentType, 'application/json');
  assert.equal(body.bodyLength, context.postBody.length);
  assert.equal(body.requestContentType, 'application/json');
  assert.ok(body.requestBodyBytes >= body.bodyLength);
  assert.match(body.error, /POST JSON 解析失败/);
  assert.match(body.nextAction, /Method=GET/);
  assert.match(body.nextAction, /302/);
  assert.match(body.expectedBody, /urlEncode\.replaceAll/);
  assert.ok(Array.from(body.acceptedFormats).some((format: any) => String(format).includes('GET query')));
  assert.ok(Array.from(body.acceptedFormats).some((format: any) => String(format).includes('asJsonString')));
  assert.ok(Array.from(body.acceptedFormats).some((format: any) => String(format).includes('Groovy Map fallback')));
  assert.equal(body.expectedShape, '{releaseInfo={Milestone=MM/DD/YYYY, ...}}');
  assert.doesNotMatch(context.result.text, /25\.4\.20/);
});

test('Apps Script records malformed cache POST JSON attempts in Timeline cache status', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    postBody: '{"project":"mThor","releaseInfo": {currentRelease=25.4.20}}',
    result: null as any,
    status: null as any,
  };

  vm.runInNewContext(
    `${appScript}
result = doPost({ parameter: { action: 'cacheReleaseInfo' }, postData: { contents: postBody, type: 'application/json' } });
status = getTimelineCacheStatus();`,
    context,
  );

  const body = JSON.parse(context.result.text);
  const mThorStatus = context.status.projects.find((project: any) => project.project === 'mThor');

  assert.equal(body.success, false);
  assert.equal(body.errorCode, 'INVALID_POST_JSON');
  assert.equal(body.project, 'mThor');
  assert.equal(body.paramKey, 'mThor');
  assert.match(body.requestId, /^tl_mThor_/);
  assert.equal(mThorStatus.status, 'error');
  assert.equal(mThorStatus.cached, false);
  assert.equal(mThorStatus.lastAttempt.success, false);
  assert.equal(mThorStatus.lastAttempt.requestId, body.requestId);
  assert.equal(mThorStatus.lastAttempt.errorCode, 'INVALID_POST_JSON');
  assert.equal(mThorStatus.lastAttempt.requestContentType, 'application/json');
  assert.ok(mThorStatus.lastAttempt.requestBodyBytes >= context.postBody.length);
  assert.match(mThorStatus.lastAttempt.parseError, /POST JSON 解析失败/);
  assert.doesNotMatch(JSON.stringify(mThorStatus), /25\.4\.20/);
});

test('Apps Script does not record malformed cache dry-run POST JSON as a sync attempt', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    postBody: '{"project":"mThor","dryRun": true,"releaseInfo": {currentRelease=25.4.20}}',
    result: null as any,
    status: null as any,
  };

  vm.runInNewContext(
    `${appScript}
result = doPost({ parameter: { action: 'cacheReleaseInfo' }, postData: { contents: postBody, type: 'application/json' } });
status = getTimelineCacheStatus();`,
    context,
  );

  const body = JSON.parse(context.result.text);
  const mThorStatus = context.status.projects.find((project: any) => project.project === 'mThor');

  assert.equal(body.success, false);
  assert.equal(body.dryRun, true);
  assert.equal(body.errorCode, 'INVALID_POST_JSON');
  assert.equal(body.project, 'mThor');
  assert.equal(body.paramKey, 'mThor');
  assert.match(body.requestId, /^tl_mThor_/);
  assert.equal(properties.TIMELINE_SYNC_ATTEMPT_mThor, undefined);
  assert.equal(mThorStatus.status, 'missing');
  assert.equal(mThorStatus.lastAttempt, undefined);
});

test('Apps Script cacheReleaseInfo rejects cache payloads over Script Properties value limit', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const releaseInfo: Record<string, string> = {};
  for (let index = 0; index < 120; index++) {
    releaseInfo[`Gate ${index} ${'x'.repeat(80)}`] = `05/${String((index % 28) + 1).padStart(2, '0')}/2026`;
  }
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    postBody: JSON.stringify({
      project: 'mThor',
      releaseInfo: {
        currentRelease: '25.4.20',
        releaseInfo,
      },
    }),
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = doPost({ parameter: { action: 'cacheReleaseInfo' }, postData: { contents: postBody } });`,
    context,
  );

  const body = JSON.parse(context.result.text);
  assert.equal(body.success, false);
  assert.equal(body.errorCode, 'TIMELINE_CACHE_TOO_LARGE');
  assert.equal(body.project, 'mThor');
  assert.equal(body.maxBytes, 9 * 1024);
  assert.equal(body.limits.maxCachePropertyBytes, 9 * 1024);
  assert.ok(body.payloadBytes > body.maxBytes);
  assert.equal(body.milestoneCount, 120);
  assert.equal(Array.from(body.milestoneKeys).length, 20);
  assert.match(body.nextAction, /9KB/);
  assert.equal(properties.TIMELINE_CACHE_mThor, undefined);
  assert.doesNotMatch(context.result.text, /05\/01\/2026/);
});

test('Apps Script cacheReleaseInfo returns parse diagnostics without caching malformed Groovy maps', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const releaseInfo = '{currentRelease=25.4.20, releaseInfo={FF=11/13/2025';
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    releaseInfo,
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = doGet({ parameter: { action: 'cacheReleaseInfo', project: 'mThor', releaseInfo: releaseInfo } });`,
    context,
  );

  const body = JSON.parse(context.result.text);
  assert.equal(body.success, false);
  assert.equal(body.errorCode, 'PARSE_RELEASE_INFO_FAILED');
  assert.equal(body.project, 'mThor');
  assert.equal(body.paramKey, 'mThor');
  assert.match(body.parseError, /未闭合的嵌套结构/);
  assert.equal(body.expectedShape, '{releaseInfo={Milestone=MM/DD/YYYY, ...}}');
  assert.equal(Array.from(body.acceptedFormats).length, 4);
  assert.equal(body.limits.maxChars, 12000);
  assert.equal(body.limits.maxNestingDepth, 12);
  assert.match(body.nextAction, /必须用 GET/);
  assert.doesNotMatch(context.result.text, /11\/13\/2025/);
  assert.equal(properties.TIMELINE_CACHE_mThor, undefined);
});

test('Apps Script records failed Timeline sync attempts in cache status diagnostics', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const releaseInfo = '{currentRelease=25.4.20, releaseInfo=[]}';
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    releaseInfo,
    result: null as any,
    status: null as any,
  };

  vm.runInNewContext(
    `${appScript}
result = doGet({ parameter: { action: 'cacheReleaseInfo', project: 'mThor', releaseInfo: releaseInfo } });
status = getTimelineCacheStatus();`,
    context,
  );

  const body = JSON.parse(context.result.text);
  const mThorStatus = context.status.projects.find((project: any) => project.project === 'mThor');

  assert.equal(body.success, false);
  assert.equal(body.errorCode, 'INVALID_RELEASE_INFO_SCHEMA');
  assert.equal(mThorStatus.status, 'error');
  assert.equal(mThorStatus.cached, false);
  assert.equal(mThorStatus.lastAttempt.success, false);
  assert.equal(mThorStatus.lastAttempt.errorCode, 'INVALID_RELEASE_INFO_SCHEMA');
  assert.match(mThorStatus.lastAttempt.parseError, /releaseInfo 必须是非空对象/);
  assert.match(mThorStatus.lastAttempt.nextAction, /MM\/DD\/YYYY/);
  assert.doesNotMatch(JSON.stringify(mThorStatus), /25\.4\.20/);
});

test('Apps Script keeps ready cache usable while surfacing a later failed Timeline sync attempt', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const timestamp = Date.now() - (10 * 60 * 1000);
  const properties: Record<string, string> = {
    TIMELINE_CACHE_mThor: JSON.stringify({
      project: 'mThor',
      paramKey: 'mThor',
      updatedAt: new Date(timestamp).toISOString(),
      timestamp,
      releaseInfo: {
        currentRelease: '25.4.20',
        releaseInfo: {
          FF: '05/10/2026',
          Release: '05/20/2026',
        },
      },
    }),
    TIMELINE_SYNC_ATTEMPT_mThor: JSON.stringify({
      success: false,
      attemptedAt: new Date(timestamp + 60 * 1000).toISOString(),
      timestamp: timestamp + 60 * 1000,
      errorCode: 'TIMELINE_CACHE_TOO_LARGE',
      error: 'payload too large',
      nextAction: '减少同步字段后重新运行 Timeline Sync Rule。',
      payloadBytes: 10000,
      maxBytes: 9216,
    }),
  };
  const context = {
    Logger: { log: () => undefined },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
      }),
    },
    status: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nstatus = getTimelineCacheStatus();`,
    context,
  );

  const mThorStatus = context.status.projects.find((project: any) => project.project === 'mThor');
  assert.equal(mThorStatus.status, 'ready');
  assert.equal(mThorStatus.lastAttempt.success, false);
  assert.equal(mThorStatus.lastAttempt.errorCode, 'TIMELINE_CACHE_TOO_LARGE');
  assert.equal(mThorStatus.lastAttempt.nextAction, '减少同步字段后重新运行 Timeline Sync Rule。');
  assert.equal(mThorStatus.lastAttempt.payloadBytes, 10000);
  assert.doesNotMatch(JSON.stringify(mThorStatus), /05\/10\/2026|05\/20\/2026/);
});

test('Apps Script rejects oversized Groovy releaseInfo with a specific diagnostic', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}
var longValue = Array(JIRA_RELEASE_INFO_MAX_CHARS + 1).join('x');
result = parseSingleProjectReleaseInfoForCache('{releaseInfo={FF=' + longValue + '}}');`,
    context,
  );

  assert.equal(context.result.success, false);
  assert.equal(context.result.errorCode, 'RELEASE_INFO_TOO_LARGE');
  assert.match(context.result.parseError, /字符限制/);
});

test('Apps Script rejects over-nested Groovy releaseInfo with a specific diagnostic', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}
var deepValue = '1';
for (var i = 0; i < JIRA_GROOVY_MAX_NESTING_DEPTH + 2; i++) {
  deepValue = '{k' + i + '=' + deepValue + '}';
}
result = parseSingleProjectReleaseInfoForCache('{releaseInfo=' + deepValue + '}');`,
    context,
  );

  assert.equal(context.result.success, false);
  assert.equal(context.result.errorCode, 'RELEASE_INFO_TOO_DEEP');
  assert.match(context.result.parseError, /嵌套层级/);
});

test('Apps Script cacheReleaseInfo reports schema mismatch separately from parse errors', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const releaseInfo = '{currentRelease=25.4.20, releaseInfo=[]}';
  const properties: Record<string, string> = {};
  const context = {
    Logger: { log: () => undefined },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text: string) => {
        const output = {
          text,
          mimeType: '',
          setMimeType(mimeType: string) {
            output.mimeType = mimeType;
            return output;
          },
        };
        return output;
      },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
      }),
    },
    releaseInfo,
    result: null as any,
  };

  vm.runInNewContext(
    `${appScript}\nresult = doGet({ parameter: { action: 'cacheReleaseInfo', project: 'mThor', releaseInfo: releaseInfo } });`,
    context,
  );

  const body = JSON.parse(context.result.text);
  assert.equal(body.success, false);
  assert.equal(body.errorCode, 'INVALID_RELEASE_INFO_SCHEMA');
  assert.match(body.parseError, /releaseInfo 必须是非空对象/);
  assert.match(body.parseError, /currentRelease, releaseInfo/);
  assert.match(body.nextAction, /MM\/DD\/YYYY/);
  assert.equal(properties.TIMELINE_CACHE_mThor, undefined);
});

test('Executor rule marks sent messages through GET Apps Script callbacks with saved lookup variables', () => {
  const template = JSON.parse(
    readFileSync(resolve(scheduledMessagesDir, 'jira-rule-template.json'), 'utf8'),
  );
  const webhooks: any[] = [];
  const variables: Record<string, string> = {};

  const collectRuleNodes = (node: any) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (node.type === 'jira.create.variable') {
      variables[node.value?.name?.value] = node.value?.query?.value;
    }
    if (
      node.type === 'jira.issue.outgoing.webhook' &&
      String(node.value?.url || '').includes('action=markBotMessageExecuted')
    ) {
      webhooks.push(node);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        value.forEach(collectRuleNodes);
      } else if (value && typeof value === 'object') {
        collectRuleNodes(value);
      }
    }
  };

  collectRuleNodes(template);

  assert.equal(variables.messageId, '{{webhookResponse.body.messageId}}');
  assert.equal(variables.rowIndex, '{{webhookResponse.body.rowIndex}}');
  assert.equal(variables.executionKey, '{{webhookResponse.body.executionKey}}');
  assert.equal(webhooks.length, 7);
  for (const webhook of webhooks) {
    const url = webhook.value.url;

    assert.equal(webhook.value.method, 'GET');
    assert.equal(webhook.value.contentType, 'empty');
    assert.equal(webhook.value.responseEnabled, false);
    assert.equal(webhook.value.headers.length, 0);
    assert.match(url, /^\{\{WEB_APP_URL\}\}\?action=markBotMessageExecuted&/);
    assert.match(url, /messageId=\{\{messageId\.urlEncode\}\}/);
    assert.match(url, /rowIndex=\{\{rowIndex\}\}/);
    assert.match(url, /executionKey=\{\{executionKey\.urlEncode\}\}/);
    assert.doesNotMatch(url, /webhookResponse\.body\.rowIndex|webhookResponse\.body\.executionKey|topic=|content=/);
    assert.equal(webhook.value.customBody, undefined);
  }
  assert.equal(webhooks.filter(webhook => String(webhook.value.url).includes('success=true')).length, 6);
  assert.equal(webhooks.filter(webhook => String(webhook.value.url).includes('success=false')).length, 1);
});

test('Executor rule keeps Bot API token hidden and redacted from diagnostic logs', () => {
  const template = JSON.parse(
    readFileSync(resolve(scheduledMessagesDir, 'jira-rule-template.json'), 'utf8'),
  );
  const botApiWebhooks: any[] = [];

  const collectBotApiWebhooks = (node: any) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (
      node.type === 'jira.issue.outgoing.webhook' &&
      String(node.value?.url || '').includes('{{BOT_API_BASE_URL}}/')
    ) {
      botApiWebhooks.push(node);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        value.forEach(collectBotApiWebhooks);
      } else if (value && typeof value === 'object') {
        collectBotApiWebhooks(value);
      }
    }
  };

  collectBotApiWebhooks(template);

  assert.equal(botApiWebhooks.length, 2);
  for (const webhook of botApiWebhooks) {
    const authHeader = webhook.value.headers.find((header: any) => header.name === 'Authorization');
    assert.equal(authHeader?.value?.keyOrValue, 'Bearer {{BOT_TOKEN}}');
    assert.equal(authHeader?.value?.secret, false);
  }

  const payload = {
    token: 'root-token',
    value: {
      headers: [
        {
          id: '_header_auth',
          name: 'Authorization',
          value: {
            keyOrValue: 'Bearer live-token',
            secret: true,
          },
        },
        {
          id: '_header_bot',
          name: 'bot',
          value: {
            keyOrValue: 'bot-id',
            secret: false,
          },
        },
      ],
    },
  };
  const redacted = redactJiraRulePayloadForLog(payload);

  assert.equal(redacted.value.headers[0].name, 'Authorization');
  assert.equal(redacted.value.headers[0].value.keyOrValue, '[REDACTED]');
  assert.equal(redacted.value.headers[1].value.keyOrValue, 'bot-id');
  assert.equal(payload.value.headers[0].value.keyOrValue, 'Bearer live-token');
  assert.doesNotMatch(JSON.stringify(redacted), /root-token|live-token/);
});

test('Executor rule sends RingCentral AsMe messages through the Dify workflow branch', () => {
  const template = JSON.parse(
    readFileSync(resolve(scheduledMessagesDir, 'jira-rule-template.json'), 'utf8'),
  );
  const ringCentralWebhooks: any[] = [];

  const collectRingCentralWebhooks = (node: any) => {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (
      node.type === 'jira.issue.outgoing.webhook' &&
      String(node.value?.url || '').includes('{{RINGCENTRAL_SENDER_DIFY_API_BASE_URL}}/workflows/run')
    ) {
      ringCentralWebhooks.push(node);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        value.forEach(collectRingCentralWebhooks);
      } else if (value && typeof value === 'object') {
        collectRingCentralWebhooks(value);
      }
    }
  };

  collectRingCentralWebhooks(template);

  assert.equal(ringCentralWebhooks.length, 1);
  const webhook = ringCentralWebhooks[0];
  const authHeader = webhook.value.headers.find((header: any) => header.name === 'Authorization');
  assert.equal(authHeader?.value?.keyOrValue, 'Bearer {{RINGCENTRAL_SENDER_DIFY_API_KEY}}');
  assert.equal(authHeader?.value?.secret, false);
  assert.match(webhook.value.customBody, /"clientId": "{{RINGCENTRAL_SENDER_CLIENT_ID}}"/);
  assert.match(webhook.value.customBody, /"clientSecret": "{{RINGCENTRAL_SENDER_CLIENT_SECRET}}"/);
  assert.match(webhook.value.customBody, /"jwt": "{{RINGCENTRAL_SENDER_JWT}}"/);
  assert.match(webhook.value.customBody, /"chatId": {{webhookResponse.body.chatId.asJsonString}}/);
  assert.match(webhook.value.customBody, /"message_text": {{webhookResponse.body.content.asJsonString}}/);

  const serializedRule = JSON.stringify(template);
  assert.match(serializedRule, /"first":"\{\{webhookResponse\.body\.data\.status\}\}","second":"succeeded"/);
  assert.match(serializedRule, /"first":"\{\{webhookResponse\.body\.data\.status\}\}","second":"failed"/);
  assert.match(serializedRule, /success=true&executionKey=\{\{executionKey\.urlEncode\}\}/);
  assert.match(serializedRule, /sentChatId=\{\{webhookResponse\.body\.data\.outputs\.chatId\.urlEncode\}\}/);
  assert.match(serializedRule, /sentPostId=\{\{webhookResponse\.body\.data\.outputs\.postId\.urlEncode\}\}/);
  assert.match(serializedRule, /sentAt=\{\{webhookResponse\.body\.data\.outputs\.sentAt\.urlEncode\}\}/);
  assert.match(serializedRule, /success=false&executionKey=\{\{executionKey\.urlEncode\}\}&error=\{\{webhookResponse\.body\.data\.error\.urlEncode\}\}/);
});

test('Jira rule payload redaction hides RingCentral sender credentials', () => {
  const payload = {
    value: {
      headers: [
        {
          name: 'Authorization',
          value: {
            keyOrValue: 'Bearer dify-token',
            secret: true,
          },
        },
      ],
      customBody: '{ "inputs": { "clientId": "visible-client-id", "clientSecret": "live-client-secret", "jwt": "live-jwt", "chatId": "esone.qiu" } }',
    },
  };

  const redacted = redactJiraRulePayloadForLog(payload);

  assert.equal(redacted.value.headers[0].value.keyOrValue, '[REDACTED]');
  assert.match(redacted.value.customBody, /"clientId": "visible-client-id"/);
  assert.match(redacted.value.customBody, /"clientSecret": "\[REDACTED\]"/);
  assert.match(redacted.value.customBody, /"jwt": "\[REDACTED\]"/);
  assert.match(redacted.value.customBody, /"chatId": "esone\.qiu"/);
  assert.doesNotMatch(JSON.stringify(redacted), /dify-token|live-client-secret|live-jwt/);

  const jiraError = 'A secret with key Bearer live-token does not exist. {"jwt":"live-jwt"}';
  const redactedError = redactJiraRuleTextForLog(jiraError);
  assert.match(redactedError, /Bearer \[REDACTED\]/);
  assert.doesNotMatch(redactedError, /live-token|live-jwt/);
});

test('Apps Script mark-executed path does not double-decode already decoded parameters', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');

  assert.match(appScript, /var APP_SCRIPT_VERSION = '2\.8\.4';/);
  assert.match(appScript, /const replacedTopic = getRequestParameterValue\(e\.parameter\.topic\);/);
  assert.match(appScript, /const replacedContent = getRequestParameterValue\(e\.parameter\.content\);/);
  assert.match(appScript, /const replacedTopic = getRequestParameterValue\(parameters\.topic\);/);
  assert.match(appScript, /const replacedContent = getRequestParameterValue\(parameters\.content\);/);
  assert.doesNotMatch(appScript, /decodeURIComponent\(e\.parameter\.(topic|content)\)/);
});

test('Apps Script builds safe stable execution keys for Jira mark callbacks', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Utilities: {
      formatDate: () => '202605031230',
    },
    Session: {
      getScriptTimeZone: () => 'UTC',
    },
    result: '',
    normalizedAgain: '',
  };

  vm.runInNewContext(
    `${appScript}
result = buildMessageExecutionKey({ rowIndex: 12, matchMode: 'CURRENT_MINUTE' }, 'MSG 1/%', new Date('2026-05-03T12:30:00Z'));
normalizedAgain = normalizeExecutionKey(result);`,
    context,
  );

  assert.match(context.result, /^ek_/);
  assert.doesNotMatch(context.result, /[\s/%]/);
  assert.equal(context.normalizedAgain, context.result);
});

test('Apps Script mark-executed accepts the last data row index without ID fallback', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const headers = [
    'ID',
    'Topic',
    'Content',
    'Push_Method',
    'Glip_User_Name',
    'Glip_Team_ID',
    'Schedule_Date',
    'Schedule_Time',
    'Last_Exec',
    'Exec_Count',
    'Next_Exec',
    'Exec_Log',
    'Status',
  ];
  const data = [
    headers,
    ['MSG-1', 'Original topic', 'Original content', 'Bot', 'esone.qiu', '', '2026-05-03', '12:00', '', '0', '', '', 'Active'],
  ];
  const updates: any[] = [];
  const logs: any[] = [];
  const properties: Record<string, string> = {};
  const context = createMarkExecutedVmContext(data, updates, logs, properties);

  vm.runInNewContext(
    `${appScript}\nresult = markBotMessageExecuted('', 2, true, '', 'Sent topic', 'Sent content', 'exec-last-row');`,
    context,
  );

  assert.equal(context.result.success, true);
  assert.equal(context.result.rowIndex, 2);
  assert.equal(context.result.duplicate, false);
  assert.equal(updates.some(update => update.row === 2 && update.value === 'Done'), true);
  assert.equal(logs.length, 1);
});

test('Apps Script mark-executed records RingCentral post metadata in Logs for Glip markers', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const headers = [
    'ID',
    'Topic',
    'Content',
    'Push_Method',
    'Glip_User_Name',
    'Glip_Team_ID',
    'Schedule_Date',
    'Schedule_Time',
    'Last_Exec',
    'Exec_Count',
    'Next_Exec',
    'Exec_Log',
    'Status',
  ];
  const data = [
    headers,
    ['MSG-1', 'Original topic', 'Original content', 'AsMe', 'esone.qiu', '', '2026-05-03', '12:00', '', '0', '', '', 'Active'],
  ];
  const updates: any[] = [];
  const logs: any[] = [];
  const properties: Record<string, string> = {};
  const context = createMarkExecutedVmContext(data, updates, logs, properties);

  vm.runInNewContext(
    `${appScript}\nresult = markBotMessageExecuted('MSG-1', 2, true, '', 'Sent topic', 'Sent content', 'exec-with-post-id', 'chat-1', 'post-1', '2026-05-03T12:00:00Z');`,
    context,
  );

  assert.equal(context.result.success, true);
  assert.ok(
    updates.some(
      (update) =>
        update.row === 2 &&
        update.col === headers.indexOf('Exec_Log') + 1 &&
        update.value === '✅ 推送成功',
    ),
  );
  assert.equal(logs.length, 1);
  const logRow = logs[0][0];
  assert.equal(logRow[PUSH_LOG_HEADERS.indexOf('Execution_Key')], context.result.executionKey);
  assert.equal(logRow[PUSH_LOG_HEADERS.indexOf('Sent_Chat_ID')], 'chat-1');
  assert.equal(logRow[PUSH_LOG_HEADERS.indexOf('Sent_Post_ID')], 'post-1');
  assert.equal(logRow[PUSH_LOG_HEADERS.indexOf('Sent_At')], '2026-05-03T12:00:00Z');
});

test('Apps Script mark-executed falls back to message ID when row index moved', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const headers = [
    'ID',
    'Topic',
    'Content',
    'Push_Method',
    'Glip_User_Name',
    'Glip_Team_ID',
    'Schedule_Date',
    'Schedule_Time',
    'Last_Exec',
    'Exec_Count',
    'Next_Exec',
    'Exec_Log',
    'Status',
  ];
  const data = [
    headers,
    ['MSG-OTHER', 'Other topic', 'Other content', 'Bot', 'esone.qiu', '', '2026-05-03', '12:00', '', '0', '', '', 'Active'],
    ['MSG-1', 'Original topic', 'Original content', 'Bot', 'esone.qiu', '', '2026-05-03', '12:00', '', '0', '', '', 'Active'],
  ];
  const updates: any[] = [];
  const logs: any[] = [];
  const properties: Record<string, string> = {};
  const context = createMarkExecutedVmContext(data, updates, logs, properties);

  vm.runInNewContext(
    `${appScript}\nresult = markBotMessageExecuted('MSG-1', 2, true, '', 'Sent topic', 'Sent content', 'exec-moved-row');`,
    context,
  );

  assert.equal(context.result.success, true);
  assert.equal(context.result.rowIndex, 3);
  assert.equal(context.result.duplicate, false);
  assert.equal(updates.some(update => update.row === 3 && update.value === 'Done'), true);
  assert.equal(updates.some(update => update.row === 2 && update.value === 'Done'), false);
  assert.equal(logs.length, 1);
});

test('Apps Script mark-executed treats the header row as invalid and falls back by ID', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const headers = [
    'ID',
    'Topic',
    'Content',
    'Push_Method',
    'Glip_User_Name',
    'Glip_Team_ID',
    'Schedule_Date',
    'Schedule_Time',
    'Last_Exec',
    'Exec_Count',
    'Next_Exec',
    'Exec_Log',
    'Status',
  ];
  const data = [
    headers,
    ['MSG-1', 'Original topic', 'Original content', 'Bot', 'esone.qiu', '', '2026-05-03', '12:00', '', '0', '', '', 'Active'],
  ];
  const updates: any[] = [];
  const logs: any[] = [];
  const properties: Record<string, string> = {};
  const context = createMarkExecutedVmContext(data, updates, logs, properties);

  vm.runInNewContext(
    `${appScript}\nresult = markBotMessageExecuted('MSG-1', 1, true, '', 'Sent topic', 'Sent content', 'exec-header-row');`,
    context,
  );

  assert.equal(context.result.success, true);
  assert.equal(context.result.rowIndex, 2);
  assert.equal(updates.some(update => update.row === 1), false);
  assert.equal(updates.some(update => update.row === 2 && update.value === 'Done'), true);
  assert.equal(logs.length, 1);
});

test('Apps Script mark-executed skips duplicate execution keys without double logging', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const headers = [
    'ID',
    'Topic',
    'Content',
    'Push_Method',
    'Glip_User_Name',
    'Glip_Team_ID',
    'Schedule_Date',
    'Schedule_Time',
    'Last_Exec',
    'Exec_Count',
    'Next_Exec',
    'Exec_Log',
    'Status',
  ];
  const data = [
    headers,
    ['MSG-1', 'Original topic', 'Original content', 'Bot', 'esone.qiu', '', '2026-05-03', '12:00', '', '0', '', '', 'Active'],
  ];
  const updates: any[] = [];
  const logs: any[] = [];
  const properties: Record<string, string> = {};
  const context = createMarkExecutedVmContext(data, updates, logs, properties);

  vm.runInNewContext(
    `${appScript}
first = markBotMessageExecuted('MSG-1', 2, true, '', 'Sent topic', 'Sent content', 'exec-duplicate');
second = markBotMessageExecuted('MSG-1', 2, true, '', 'Sent topic', 'Sent content', 'exec-duplicate');`,
    context,
  );

  assert.equal(context.first.success, true);
  assert.equal(context.first.duplicate, false);
  assert.equal(context.second.success, true);
  assert.equal(context.second.duplicate, true);
  assert.equal(logs.length, 1);
  assert.equal(updates.filter(update => update.row === 2 && update.value === 'Done').length, 1);
  assert.equal(Object.keys(properties).length, 1);
});

test('Apps Script mark-executed returns duplicate before resolving changed sheet rows', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const headers = [
    'ID',
    'Topic',
    'Content',
    'Push_Method',
    'Glip_User_Name',
    'Glip_Team_ID',
    'Schedule_Date',
    'Schedule_Time',
    'Last_Exec',
    'Exec_Count',
    'Next_Exec',
    'Exec_Log',
    'Status',
  ];
  const initialData = [
    headers,
    ['MSG-1', 'Original topic', 'Original content', 'Bot', 'esone.qiu', '', '2026-05-03', '12:00', '', '0', '', '', 'Active'],
  ];
  const changedData = [headers];
  const firstUpdates: any[] = [];
  const secondUpdates: any[] = [];
  const firstLogs: any[] = [];
  const secondLogs: any[] = [];
  const properties: Record<string, string> = {};
  const firstContext = createMarkExecutedVmContext(initialData, firstUpdates, firstLogs, properties);
  const secondContext = createMarkExecutedVmContext(changedData, secondUpdates, secondLogs, properties);

  vm.runInNewContext(
    `${appScript}\nresult = markBotMessageExecuted('MSG-1', 2, true, '', 'Sent topic', 'Sent content', 'exec-row-deleted');`,
    firstContext,
  );
  vm.runInNewContext(
    `${appScript}\nresult = markBotMessageExecuted('MSG-1', 2, true, '', 'Sent topic', 'Sent content', 'exec-row-deleted');`,
    secondContext,
  );

  assert.equal(firstContext.result.success, true);
  assert.equal(firstContext.result.duplicate, false);
  assert.equal(secondContext.result.success, true);
  assert.equal(secondContext.result.duplicate, true);
  assert.equal(secondContext.result.messageId, 'MSG-1');
  assert.equal(secondContext.result.rowIndex, 2);
  assert.equal(firstLogs.length, 1);
  assert.equal(secondLogs.length, 0);
  assert.equal(secondUpdates.length, 0);
});

test('Apps Script clears stale Next_Exec when a one-time message is marked done', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const headers = [
    'ID',
    'Topic',
    'Content',
    'Push_Method',
    'Glip_User_Name',
    'Glip_Team_ID',
    'Schedule_Date',
    'Schedule_Time',
    'Last_Exec',
    'Exec_Count',
    'Next_Exec',
    'Exec_Log',
    'Status',
  ];
  const data = [
    headers,
    ['MSG-ONE', 'One-time topic', 'content', 'Bot', 'esone.qiu', '', '2026-05-03', '12:00', '', '0', '2026-05-03 12:00', '', 'Active'],
  ];
  const updates: any[] = [];
  const logs: any[] = [];
  const properties: Record<string, string> = {};
  const context = createMarkExecutedVmContext(data, updates, logs, properties);

  vm.runInNewContext(
    `${appScript}\nresult = markBotMessageExecuted('MSG-ONE', 2, true, '', 'Sent topic', 'Sent content', 'exec-clear-one-time');`,
    context,
  );

  assert.equal(context.result.success, true);
  assert.deepEqual(
    updates.filter(update => update.row === 2 && update.col === 11).map(update => update.value),
    [''],
  );
  assert.equal(updates.some(update => update.row === 2 && update.col === 13 && update.value === 'Done'), true);
});

test('Apps Script reactivates Done one-time messages rescheduled to a future time', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const headers = [
    'ID',
    'Topic',
    'Content',
    'Push_Method',
    'Glip_User_Name',
    'Glip_Team_ID',
    'Schedule_Date',
    'Schedule_Time',
    'Last_Exec',
    'Exec_Count',
    'Next_Exec',
    'Exec_Log',
    'Status',
  ];
  const data = [
    headers,
    ['MSG-ONE', 'One-time topic', 'content', 'Bot', 'esone.qiu', '', '2026-05-03', '12:30', '2026-05-03 12:00', '1', '', '✅ 推送成功', 'Done'],
  ];
  const updates: any[] = [];
  const logs: any[] = [];
  const properties: Record<string, string> = {};
  const context = createMarkExecutedVmContext(data, updates, logs, properties) as any;
  context.data = data;
  context.now = new Date(2026, 4, 3, 12, 0);
  context.Utilities.formatDate = (date: Date, _timeZone: string, format: string) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    const dateText = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const timeText = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    if (format === 'yyyy-MM-dd HH:mm:ss') {
      return `${dateText} ${timeText}:${pad(date.getSeconds())}`;
    }
    if (format === 'yyyy-MM-dd HH:mm') {
      return `${dateText} ${timeText}`;
    }
    if (format === 'yyyy-MM-dd') {
      return dateText;
    }
    return `${dateText.replace(/-/g, '')}${timeText.replace(':', '')}`;
  };

  vm.runInNewContext(
    `${appScript}
result = reactivateDoneFutureOneTimeMessages(
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Messages'),
  data,
  data[0],
  now
);`,
    context,
  );

  assert.equal(context.result, 1);
  assert.equal(data[1][headers.indexOf('Status')], 'Active');
  assert.equal(data[1][headers.indexOf('Last_Exec')], '');
  assert.equal(data[1][headers.indexOf('Exec_Log')], '待执行');
  assert.equal(data[1][headers.indexOf('Next_Exec')], '2026-05-03 12:30');
  assert.equal(updates.some(update => update.row === 2 && update.col === 13 && update.value === 'Active'), true);
  assert.equal(updates.some(update => update.row === 2 && update.col === 9 && update.value === ''), true);
  assert.equal(updates.some(update => update.row === 2 && update.col === 12 && update.value === '待执行'), true);
  assert.equal(updates.some(update => update.row === 2 && update.col === 11 && update.value === '2026-05-03 12:30'), true);
});

test('Apps Script clears Next_Exec when a periodic message reaches End_Date', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const headers = [
    'ID',
    'Topic',
    'Content',
    'Push_Method',
    'Glip_User_Name',
    'Glip_Team_ID',
    'Schedule_Date',
    'Schedule_Time',
    'End_Date',
    'Repeat_Every',
    'Repeat_Unit',
    'Repeat_Count',
    'Last_Exec',
    'Exec_Count',
    'Next_Exec',
    'Exec_Log',
    'Status',
  ];
  const data = [
    headers,
    ['MSG-END', 'End-date topic', 'content', 'Bot', 'esone.qiu', '', '2026-05-01', '12:00', '2026-05-01', '1', 'Day', '', '', '0', '2026-05-02', '', 'Active'],
  ];
  const updates: any[] = [];
  const logs: any[] = [];
  const properties: Record<string, string> = {};
  const context = createMarkExecutedVmContext(data, updates, logs, properties);

  vm.runInNewContext(
    `${appScript}\nresult = markBotMessageExecuted('MSG-END', 2, true, '', 'Sent topic', 'Sent content', 'exec-clear-end-date');`,
    context,
  );

  assert.equal(context.result.success, true);
  assert.deepEqual(
    updates.filter(update => update.row === 2 && update.col === 15).map(update => update.value),
    [''],
  );
  assert.equal(updates.some(update => update.row === 2 && update.col === 17 && update.value === 'Done'), true);
});

test('Apps Script clears Next_Exec when a periodic message reaches Repeat_Count', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const headers = [
    'ID',
    'Topic',
    'Content',
    'Push_Method',
    'Glip_User_Name',
    'Glip_Team_ID',
    'Schedule_Date',
    'Schedule_Time',
    'Repeat_Every',
    'Repeat_Unit',
    'Repeat_Count',
    'Last_Exec',
    'Exec_Count',
    'Next_Exec',
    'Exec_Log',
    'Status',
  ];
  const data = [
    headers,
    ['MSG-COUNT', 'Repeat-count topic', 'content', 'Bot', 'esone.qiu', '', '2026-05-01', '12:00', '1', 'Day', '1', '', '0', '2026-05-02', '', 'Active'],
  ];
  const updates: any[] = [];
  const logs: any[] = [];
  const properties: Record<string, string> = {};
  const context = createMarkExecutedVmContext(data, updates, logs, properties);

  vm.runInNewContext(
    `${appScript}\nresult = markBotMessageExecuted('MSG-COUNT', 2, true, '', 'Sent topic', 'Sent content', 'exec-clear-repeat-count');`,
    context,
  );

  assert.equal(context.result.success, true);
  assert.deepEqual(
    updates.filter(update => update.row === 2 && update.col === 14).map(update => update.value),
    [''],
  );
  assert.equal(updates.some(update => update.row === 2 && update.col === 16 && update.value === 'Done'), true);
});

const PUSH_LOG_HEADERS = [
  'Timestamp',
  'Message_ID',
  'Topic',
  'Content',
  'Push_Method',
  'Target',
  'Status',
  'Error',
  'Exec_Count',
  'Execution_Key',
  'Sent_Chat_ID',
  'Sent_Post_ID',
  'Sent_At',
];

function createMarkExecutedVmContext(
  data: string[][],
  updates: any[],
  logs: any[],
  properties: Record<string, string>,
  configRows: string[][] = [],
) {
  const messageSheet = {
    getDataRange: () => ({
      getDisplayValues: () => data,
    }),
    getRange: (row: number, col: number) => ({
      setValue: (value: unknown) => updates.push({ row, col, value }),
    }),
  };
  const logsSheet = {
    getDataRange: () => ({
      getDisplayValues: () => [PUSH_LOG_HEADERS],
    }),
    insertRowAfter: () => undefined,
    getRange: () => ({
      setValues: (values: unknown[][]) => logs.push(values),
    }),
  };
  const configSheet = {
    getDataRange: () => ({
      getDisplayValues: () => configRows,
    }),
  };

  return {
    Logger: { log: () => undefined },
    Session: {
      getScriptTimeZone: () => 'UTC',
    },
    Utilities: {
      formatDate: (_date: Date, _timeZone: string, format: string) => {
        if (format === 'yyyy-MM-dd HH:mm:ss') {
          return '2026-05-03 12:00:00';
        }
        if (format === 'yyyy-MM-dd HH:mm') {
          return '2026-05-03 12:00';
        }
        if (format === 'yyyy-MM-dd') {
          return '2026-05-03';
        }
        return '202605031200';
      },
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name: string) => {
          if (name === 'Messages') {
            return messageSheet;
          }
          if (name === 'Logs') {
            return logsSheet;
          }
          if (name === 'Config') {
            return configSheet;
          }
          return null;
        },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties[key] || null,
        setProperty: (key: string, value: string) => {
          properties[key] = value;
        },
        deleteProperty: (key: string) => {
          delete properties[key];
        },
        getProperties: () => ({ ...properties }),
      }),
    },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => undefined,
        releaseLock: () => undefined,
      }),
    },
    result: null as any,
    first: null as any,
    second: null as any,
  };
}

test('Apps Script parses schedule date strings as local calendar dates', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const previousTimeZone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  const context = {
    result: null as Date | null,
  };

  try {
    vm.runInNewContext(
      `${appScript}\nresult = parseScheduleDate('2026-01-05');`,
      context,
    );

    assert.equal(context.result?.getFullYear(), 2026);
    assert.equal(context.result?.getMonth(), 0);
    assert.equal(context.result?.getDate(), 5);
    assert.equal(context.result?.getDay(), 1);
  } finally {
    if (previousTimeZone === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = previousTimeZone;
    }
  }
});

test('Apps Script AI body variables remain valid JSON after escaping multiline content', () => {
  const appScript = readFileSync(resolve(scheduledMessagesDir, 'app-script-template.gs'), 'utf8');
  const context = {
    Logger: { log: () => undefined },
    bodyTemplate: '{"topic":"{Topic}","content":"{Content}","team":"{TeamID}"}',
    topic: 'Release "RC" summary',
    content: 'line 1\nline 2 with C:\\\\temp',
    teamId: 'team\\id',
    result: '',
  };

  vm.runInNewContext(
    `${appScript}\nresult = replaceAIBodyVariables(bodyTemplate, topic, content, teamId);`,
    context,
  );

  const parsed = JSON.parse(context.result);
  assert.equal(parsed.topic, context.topic);
  assert.equal(parsed.content, context.content);
  assert.equal(parsed.team, context.teamId);
});
