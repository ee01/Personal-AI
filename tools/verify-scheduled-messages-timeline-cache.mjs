import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appScriptPath = path.join(repoRoot, 'src/scheduled-messages/app-script-template.gs');
const managerPath = path.join(repoRoot, 'src/scheduled-messages/ScheduledMessagesManager.tsx');
const cacheStatusPath = path.join(repoRoot, 'src/scheduled-messages/timelineCacheStatus.ts');
const source = readFileSync(appScriptPath, 'utf8');
const managerSource = readFileSync(managerPath, 'utf8');
const cacheStatusSource = readFileSync(cacheStatusPath, 'utf8');
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

const paramKeyShape = {
  'Jupiter web': {
    currentRelease: '26.2',
    currentPhase: 'Regression',
    releaseInfo: {
      FF: '05/06/2026',
    },
  },
};

assert.equal(
  context.replaceProjectVariablesInText(
    'Release {currentRelease} is in {currentPhase}',
    context.getTimelineProjectInfo(paramKeyShape, 'jupiterWeb')
  ),
  'Release 26.2 is in Regression'
);
assert.equal(
  isoDate(context.getTimelineTargetDate({
    Timeline_Project: 'jupiterWeb',
    Timeline_Milestone: 'FF',
    Timeline_Offset: '0',
  }, paramKeyShape)),
  '2026-05-06'
);

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
    managerSource.includes('复制样例 curl'),
  false,
  'Timeline cache status panel should keep noisy single-purpose troubleshooting copy actions out'
);
assert.ok(
  managerSource.includes('复制诊断') &&
    managerSource.includes('buildTimelineCacheDiagnosticText') &&
    managerSource.includes('已复制 Timeline 缓存诊断到本机剪贴板') &&
    managerSource.includes('没有刷新缓存、没有写 Timeline 缓存，也没有保存或发送消息'),
  'Timeline cache status panel should provide a single local clipboard diagnostic handoff with a no-write boundary'
);
assert.ok(
  cacheStatusSource.includes('边界：不会写入 Timeline 缓存，也不代表真实 Jira Rule 已同步。'),
  'Timeline dry-run success should explain that the sample probe is not real Jira sync proof'
);
assert.ok(
  cacheStatusSource.includes('下一步：在 Jira 手动运行 Timeline Sync Rule 后刷新状态，确认真实缓存包含目标 Milestone。'),
  'Timeline dry-run success should keep the post-probe refresh path visible'
);
assert.ok(
  cacheStatusSource.includes('当前使用已有缓存，最近同步失败'),
  'Timeline cache headline should expose ready cache with a later failed sync attempt'
);
assert.ok(
  managerSource.includes('getTimelineCacheProjectStatusHeadline'),
  'Timeline cache status panel should use the shared status headline formatter'
);
assert.ok(
  managerSource.includes('getTimelineCacheScopeReceiptText') &&
    managerSource.includes('detailsExpanded') &&
    managerSource.includes('aria-label="查看 Timeline 缓存原因"') &&
    managerSource.includes('compactStatusText'),
  'Timeline cache status panel should keep the first view compact and move detailed reasons behind an info control'
);
assert.ok(
  cacheStatusSource.includes('不会写 Timeline 缓存、不会保存或发送消息'),
  'Timeline cache scope receipt should separate dry-run from writes and sends'
);

console.log('scheduled messages timeline cache verification passed');
