import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appScriptPath = path.join(repoRoot, 'src/scheduled-messages/app-script-template.gs');
const managerPath = path.join(repoRoot, 'src/scheduled-messages/ScheduledMessagesManager.tsx');
const source = readFileSync(appScriptPath, 'utf8');
const managerSource = readFileSync(managerPath, 'utf8');
const logs = [];

const context = {
  console,
  Logger: {
    log(message) {
      logs.push(String(message));
    },
  },
};

vm.createContext(context);
vm.runInContext(source, context, { filename: appScriptPath });

function isoDate(value) {
  assert.equal(typeof value?.getTime, 'function', 'Expected getTimelineTargetDate to return a Date-like value');
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const row = {
  Timeline_Project: 'mThor',
  Timeline_Milestone: 'FF',
  Timeline_Offset: '0',
};

const cachedShape = {
  mThor: {
    currentRelease: '26.2',
    currentPhase: 'FF',
    releaseInfo: {
      FF: '05/06/2026',
    },
  },
};

const legacyFlatShape = {
  mThor: {
    FF: '05/06/2026',
    currentRelease: '26.2',
    currentPhase: 'FF',
  },
};

assert.equal(isoDate(context.getTimelineTargetDate(row, cachedShape)), '2026-05-06');
assert.equal(isoDate(context.getTimelineTargetDate(row, legacyFlatShape)), '2026-05-06');

const previousWorkingDayRow = {
  Timeline_Project: 'mThor',
  Timeline_Milestone: 'FF',
  Timeline_Offset: '-1',
};
const mondayMilestone = {
  mThor: {
    FF: '05/04/2026',
  },
};

assert.equal(isoDate(context.getTimelineTargetDate(previousWorkingDayRow, mondayMilestone)), '2026-05-01');

const cachedProjectInfo = context.getTimelineProjectInfo(cachedShape, 'mThor');
const legacyProjectInfo = context.getTimelineProjectInfo(legacyFlatShape, 'mThor');

assert.equal(
  context.replaceProjectVariablesInText('Release {currentRelease} is in {currentPhase}', cachedProjectInfo),
  'Release 26.2 is in FF'
);
assert.equal(
  context.replaceProjectVariablesInText('Release {currentRelease} is in {currentPhase}', legacyProjectInfo),
  'Release 26.2 is in FF'
);

assert.equal(context.getTimelineProjectInfo(cachedShape, 'Unknown'), null);

assert.match(
  managerSource,
  /fetch\(buildWebAppActionUrl\(webAppUrl, 'getTimelineCacheStatus'\), \{\s*method: 'GET',\s*credentials: 'omit',/s,
  'Timeline cache status probes should omit Chrome profile credentials'
);
assert.match(
  managerSource,
  /const init: RequestInit = \{\s*method: dryRunHelp\.method,\s*credentials: 'omit',/s,
  'Timeline dry-run probes should omit Chrome profile credentials'
);
assert.ok(
  managerSource.includes('Google 返回了 HTML 错误页'),
  'Timeline cache HTTP errors should summarize HTML error pages instead of dumping raw HTML'
);
assert.equal(
  managerSource.includes('复制 Rule 模板') ||
    managerSource.includes('复制样例 curl') ||
    managerSource.includes('复制诊断'),
  false,
  'Timeline cache status panel should keep troubleshooting actions compact'
);

console.log('scheduled messages timeline cache verification passed');
