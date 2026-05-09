import assert from 'node:assert/strict';

import {
  DashboardDataManager,
  DashboardMessageHandler,
  buildProjectDashboardLaunchPath,
  buildMilestoneClassToken,
  buildMilestoneMarkerText,
  buildProjectFocusItems,
  buildProjectFocusSummary,
  buildProjectHealthSummary,
  buildProjectStatusEvidenceItems,
  buildProjectStatusUpdateDraft,
  compareProjectsByDashboardPriority,
  parseProjectDashboardLaunchContext,
  projectMatchesDashboardLaunchContext,
  rankProjectSuggestionNames,
} from '../src/utils/dashboardIntegration.ts';

const storageState: Record<string, any> = {};

(globalThis as any).chrome = {
  storage: {
    local: {
      async get(keys?: string | string[] | Record<string, any>) {
        if (!keys) return { ...storageState };
        if (typeof keys === 'string') return { [keys]: storageState[keys] };
        if (Array.isArray(keys)) {
          return keys.reduce<Record<string, any>>((acc, key) => {
            acc[key] = storageState[key];
            return acc;
          }, {});
        }
        return Object.keys(keys).reduce<Record<string, any>>((acc, key) => {
          acc[key] = storageState[key] ?? keys[key];
          return acc;
        }, {});
      },
      async set(items: Record<string, any>) {
        Object.assign(storageState, items);
      },
      async remove(keys: string | string[]) {
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          delete storageState[key];
        }
      },
    },
  },
};

function sendMessage(handler: DashboardMessageHandler, request: any): Promise<any> {
  return new Promise((resolve) => {
    void handler.handleMessage(request, resolve);
  });
}

async function verifyCreateProjectKeepsMilestonesAndPersists() {
  const manager = new DashboardDataManager();
  const created = await manager.createProject({
    name: 'Launch Risk Map',
    description: 'Project health summary test',
    platformConfig: ['sdk', 'qa'],
    milestones: [
      { id: 'ms-alpha', label: 'Alpha', date: '2026-05-05' },
      { id: 'ms-ga', label: 'GA', date: '2026-06-10' },
    ],
  });

  assert.equal(created.success, true);
  assert.equal(created.project?.id, 'launch-risk-map');
  assert.equal(created.project?.milestones.length, 2);

  const saved = storageState.projectDashboardFishboneProjects;
  assert.equal(saved.version, 1);
  assert.equal(saved.projects.some((project: any) => project.id === 'launch-risk-map'), true);

  const reloadedManager = new DashboardDataManager();
  const projects = await reloadedManager.getProjectData('launch-risk-map');

  assert.equal(projects.length, 1);
  assert.deepEqual(
    projects[0].milestones.map((milestone: any) => milestone.label),
    ['Alpha', 'GA'],
  );
}

async function verifyCreateProjectKeepsUndatedMilestones() {
  const manager = new DashboardDataManager();
  const created = await manager.createProject({
    name: 'Undated Milestone Plan',
    milestones: [
      { id: 'ms-discovery', label: 'Discovery' },
      { id: 'ms-ga', label: 'GA', date: '2026-06-10' },
    ],
  });

  assert.equal(created.success, true);
  assert.deepEqual(
    created.project?.milestones.map((milestone: any) => ({
      label: milestone.label,
      date: milestone.date,
    })),
    [
      { label: 'Discovery', date: undefined },
      { label: 'GA', date: '2026-06-10' },
    ],
  );
}

async function verifyDashboardHandlerAddsTaskItems() {
  const handler = new DashboardMessageHandler();
  const created = await sendMessage(handler, {
    type: 'ADD_PROJECT',
    name: 'Handler Project',
    description: 'Created through message handler',
    milestones: [{ id: 'ms-beta', label: 'Beta', date: '2026-05-12' }],
  });

  assert.equal(created.success, true);

  const addedTask = await sendMessage(handler, {
    type: 'ADD_PROJECT_ITEM',
    projectId: created.project.id,
    itemType: 'task',
    itemData: {
      id: 'task-handler-check',
      type: 'dep',
      title: 'Confirm blocker owner',
      status: 'blocked',
      eta: '2026-04-29',
      anchorPosition: 66,
    },
  });

  assert.equal(addedTask.success, true);

  const loaded = await sendMessage(handler, {
    type: 'GET_PROJECT_DATA',
    projectId: created.project.id,
  });

  assert.equal(loaded.success, true);
  assert.equal(loaded.projects.length, 1);
  assert.equal(loaded.projects[0].tasks[0].title, 'Confirm blocker owner');
  assert.equal(loaded.projects[0].tasks[0].anchorPosition, 66);

  const updatedTask = await sendMessage(handler, {
    type: 'UPDATE_PROJECT_ITEM',
    projectId: created.project.id,
    itemType: 'task',
    itemId: 'task-handler-check',
    changes: {
      anchorPosition: 88.5,
      eta: '2026-05-08',
    },
  });

  assert.equal(updatedTask.success, true);

  const loadedAfterUpdate = await sendMessage(handler, {
    type: 'GET_PROJECT_DATA',
    projectId: created.project.id,
  });

  assert.equal(loadedAfterUpdate.success, true);
  assert.equal(loadedAfterUpdate.projects[0].tasks[0].anchorPosition, 88.5);
  assert.equal(loadedAfterUpdate.projects[0].tasks[0].eta, '2026-05-08');
}

function verifyProjectHealthSummary() {
  const health = buildProjectHealthSummary(
    {
      id: 'risk-project',
      name: 'Risk Project',
      milestones: [{ id: 'ga', label: 'GA', date: '2026-05-03' }],
      tasks: [
        { id: 'done', type: 'task', title: 'Done', status: 'done' },
        { id: 'blocked', type: 'dep', title: 'Blocked', status: 'blocked', eta: '2026-04-29' },
        { id: 'soon', type: 'task', title: 'Soon', status: 'progress', eta: '2026-05-02' },
      ],
    },
    new Date('2026-04-30T12:00:00+08:00'),
  );

  assert.equal(health.state, 'off-track');
  assert.equal(health.blockedTasks, 1);
  assert.equal(health.overdueTasks, 1);
  assert.equal(health.dueSoonTasks, 1);
  assert.equal(health.completedTasks, 1);
  assert.equal(health.upcomingMilestone?.label, 'GA');
}

function verifyProjectStatusUpdateDraft() {
  const project = {
    id: 'draft-project',
    name: 'Draft Project',
    milestones: [
      { id: 'alpha', label: 'Alpha' },
      { id: 'ga', label: 'GA', date: '2026-05-03' },
    ],
    tasks: [
      { id: 'done', type: 'task', title: 'Done', status: 'done' },
      {
        id: 'blocked',
        type: 'dep',
        title: 'Blocked API',
        status: 'blocked',
        eta: '2026-04-29',
        jira: [{ key: 'API-123', title: 'Fix blocked API' }],
      },
      {
        id: 'soon',
        type: 'task',
        title: 'Soon QA',
        status: 'progress',
        eta: '2026-05-02',
        platforms: {
          qa: { status: 'pending', assignee: 'Dana', jira: 'QA-9' },
        },
      },
    ],
  } as any;
  const now = new Date('2026-04-30T12:00:00+08:00');
  const draft = buildProjectStatusUpdateDraft(project, { now });
  const evidence = buildProjectStatusEvidenceItems(project, { now });

  assert.match(draft, /Draft Project 状态更新/);
  assert.match(draft, /状态：需处理 - 1 个阻塞项需要先处理/);
  assert.match(draft, /里程碑：Alpha 待定；GA 2026-05-03/);
  assert.match(draft, /证据来源：/);
  assert.match(draft, /\[阻塞\] Blocked API：ETA 2026-04-29；Jira API-123（本地任务状态 \/ ETA）/);
  assert.match(draft, /\[阻塞\] Blocked API \(ETA 2026-04-29；Jira API-123\)/);
  assert.match(draft, /先确认阻塞项负责人/);

  assert.deepEqual(
    evidence.map((item) => `${item.type}:${item.label}:${item.title}`),
    [
      'task:阻塞:Blocked API',
      'task:近 7 天到期:Soon QA',
      'milestone:里程碑:GA',
      'jira:Jira:API-123',
      'jira:Jira:QA-9',
      'platform:QA:Soon QA',
    ],
  );
}

function verifyProjectFocusItemsAndPrioritySorting() {
  const projects = [
    {
      id: 'steady',
      name: 'Steady Project',
      milestones: [{ id: 'steady-ga', label: 'GA', date: '2026-06-01' }],
      tasks: [
        { id: 'steady-done', type: 'task', title: 'Already shipped', status: 'done', eta: '2026-04-20' },
      ],
    },
    {
      id: 'soon',
      name: 'Soon Project',
      milestones: [{ id: 'soon-ga', label: 'GA', date: '2026-05-03' }],
      tasks: [
        { id: 'soon-qa', type: 'task', title: 'QA pass', status: 'testing', eta: '2026-05-02' },
      ],
    },
    {
      id: 'blocked',
      name: 'Blocked Project',
      milestones: [{ id: 'blocked-ga', label: 'GA', date: '2026-05-10' }],
      tasks: [
        { id: 'api', type: 'dep', title: 'API contract', status: 'blocked', eta: '2026-05-04' },
        { id: 'old-design', type: 'design', title: 'Old design', status: 'review', eta: '2026-04-25' },
      ],
    },
  ] as any[];

  const now = new Date('2026-04-30T12:00:00+08:00');
  const focusItems = buildProjectFocusItems(projects, { now, maxItems: 8 });

  assert.deepEqual(
    focusItems.map((item) => `${item.level}:${item.projectName}:${item.task.title}`),
    [
      'blocked:Blocked Project:API contract',
      'overdue:Blocked Project:Old design',
      'due-soon:Soon Project:QA pass',
    ],
  );

  const sorted = [...projects].sort((a, b) => compareProjectsByDashboardPriority(a, b, now));
  assert.deepEqual(sorted.map((project) => project.id), ['blocked', 'soon', 'steady']);

  const focusSummary = buildProjectFocusSummary(projects, { now, maxItems: 2 });
  assert.equal(focusSummary.totalItems, 3);
  assert.equal(focusSummary.visibleItems.length, 2);
  assert.equal(focusSummary.hiddenItems, 1);
  assert.deepEqual(
    focusSummary.visibleItems.map((item) => `${item.level}:${item.projectName}:${item.task.title}`),
    [
      'blocked:Blocked Project:API contract',
      'overdue:Blocked Project:Old design',
    ],
  );
}

function verifyMilestoneDisplayFallbacks() {
  assert.equal(buildMilestoneClassToken('Alpha'), 'alpha');
  assert.equal(buildMilestoneClassToken('GA'), 'ga');
  assert.equal(buildMilestoneClassToken('Internal Design Review'), 'internal-design-review');
  assert.equal(buildMilestoneClassToken('  '), 'milestone');

  assert.equal(buildMilestoneMarkerText('Alpha', 0), 'AL');
  assert.equal(buildMilestoneMarkerText('GA', 1), 'GA');
  assert.equal(buildMilestoneMarkerText('Milestone 12', 2), '12');
  assert.equal(buildMilestoneMarkerText('设计评审', 3), '设计');
  assert.equal(buildMilestoneMarkerText('', 4), '5');
}

async function verifyBlankProjectNameIsRejected() {
  const manager = new DashboardDataManager();
  const result = await manager.createProject({
    name: '   ',
    description: 'Blank names should not create a hidden dashboard project',
  });

  assert.equal(result.success, false);
  assert.equal(result.error, '项目名称不能为空');
}

async function verifySyncReadinessIsExplicitAboutLocalData() {
  const manager = new DashboardDataManager();
  const result = await manager.syncProjectData('all');

  assert.equal(result.success, true);
  assert.match(result.summary, /真实数据源尚未接入/);
  assert.equal(Number.isNaN(Date.parse(result.checkedAt)), false);
  assert.deepEqual(
    result.sources.map((source) => `${source.label}:${source.status}:${source.configured}`),
    ['Jira:not_configured:false', 'GitHub:not_configured:false', 'Confluence:not_configured:false'],
  );
  assert.deepEqual(
    result.sources.map((source) => Boolean(source.detail && source.nextStep)),
    [true, true, true],
  );
}

function verifyProjectSuggestionsRespectPrompt() {
  const suggestions = rankProjectSuggestionNames(
    [
      { name: 'Billing Settings Migration' },
      { name: 'Mobile Timeline Refresh' },
      { name: 'Project Dashboard Focus Queue' },
      { name: 'Project Dashboard Focus Queue' },
      { name: 'Dashboard Import Guard' },
      { name: '  ' },
    ],
    'dashboard focus',
  );

  assert.deepEqual(suggestions, [
    'Project Dashboard Focus Queue',
    'Dashboard Import Guard',
  ]);

  assert.deepEqual(
    rankProjectSuggestionNames([{ name: 'Short' }, { name: 'Longer Project Name' }], '', 1),
    ['Longer Project Name'],
  );
}

function verifyProjectDashboardLaunchContext() {
  const path = buildProjectDashboardLaunchPath({
    projectId: 'memory-project-123',
    projectName: 'Project Dashboard Focus Queue',
  });
  const query = path.slice(path.indexOf('?'));
  const context = parseProjectDashboardLaunchContext(query);

  assert.equal(path.startsWith('project-dashboard.html?'), true);
  assert.deepEqual(context, {
    hasContext: true,
    projectId: 'memory-project-123',
    projectName: 'Project Dashboard Focus Queue',
  });
  assert.deepEqual(parseProjectDashboardLaunchContext(''), { hasContext: false });
  assert.equal(
    projectMatchesDashboardLaunchContext(
      { id: 'memory-project-123', name: 'Renamed Local Project' },
      context,
    ),
    true,
  );
  assert.equal(
    projectMatchesDashboardLaunchContext(
      { id: 'local-only', name: 'Project Dashboard Focus Queue' },
      context,
    ),
    true,
  );
  assert.equal(
    projectMatchesDashboardLaunchContext(
      { id: 'other', name: 'Other Project' },
      context,
    ),
    false,
  );
}

async function main() {
  await verifyCreateProjectKeepsMilestonesAndPersists();
  await verifyCreateProjectKeepsUndatedMilestones();
  await verifyDashboardHandlerAddsTaskItems();
  verifyProjectHealthSummary();
  verifyProjectStatusUpdateDraft();
  verifyProjectFocusItemsAndPrioritySorting();
  verifyMilestoneDisplayFallbacks();
  await verifyBlankProjectNameIsRejected();
  await verifySyncReadinessIsExplicitAboutLocalData();
  verifyProjectSuggestionsRespectPrompt();
  verifyProjectDashboardLaunchContext();

  console.log('verify-project-dashboard: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
