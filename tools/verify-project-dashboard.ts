import assert from 'node:assert/strict';

import {
  DashboardDataManager,
  DashboardMessageHandler,
  buildProjectDashboardLaunchPath,
  buildProjectDashboardViewFilterCounts,
  buildProjectDashboardViewReason,
  buildProjectDataQualitySummary,
  buildProjectDecisionSummary,
  buildMilestoneClassToken,
  buildMilestoneMarkerText,
  buildProjectFocusItems,
  buildProjectFocusSummary,
  buildProjectFreshnessSummary,
  buildProjectHealthSummary,
  buildProjectReviewQueueSummary,
  buildProjectReviewSummary,
  buildProjectStatusEvidenceItems,
  buildProjectStatusUpdateDraft,
  buildProjectTaskRiskSummary,
  compareProjectsByDashboardPriority,
  filterProjectsByDashboardView,
  getProjectDashboardViewFilter,
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
  assert.equal(Number.isNaN(Date.parse(created.project?.lastStatusReviewAt || '')), false);

  const saved = storageState.projectDashboardFishboneProjects;
  assert.equal(saved.version, 1);
  assert.equal(saved.projects.some((project: any) => project.id === 'launch-risk-map'), true);
  assert.equal(Number.isNaN(Date.parse(saved.projects.find((project: any) => project.id === 'launch-risk-map')?.lastStatusReviewAt || '')), false);

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
    lastStatusReviewAt: '2026-04-30T08:00:00+08:00',
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
  assert.match(draft, /\[阻塞\] Blocked API：ETA 2026-04-29；中风险 67\/100；Jira API-123（本地任务状态 \/ ETA）/);
  assert.match(draft, /\[阻塞\] Blocked API \(ETA 2026-04-29；中风险 67\/100；Jira API-123\)/);
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
      lastStatusReviewAt: '2026-04-29T08:00:00+08:00',
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
  assert.deepEqual(
    focusItems.map((item) => `${item.task.id}:${item.risk.label}:${item.risk.score}`),
    ['api:中风险:65', 'old-design:低风险:33', 'soon-qa:低风险:29'],
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

function verifyProjectDashboardViewFilters() {
  const projects = [
    {
      id: 'steady',
      name: 'Steady Project',
      lastStatusReviewAt: '2026-04-29T08:00:00+08:00',
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
      ],
    },
    {
      id: 'empty',
      name: 'Empty Project',
      milestones: [{ id: 'empty-ga', label: 'GA', date: '2026-05-20' }],
      tasks: [],
    },
    {
      id: 'stale',
      name: 'Stale Project',
      milestones: [{ id: 'stale-ga', label: 'GA', date: '2026-01-15' }],
      tasks: [
        { id: 'closed', type: 'task', title: 'Closed work', status: 'closed', eta: '2026-01-10' },
      ],
    },
    {
      id: 'unscheduled',
      name: 'Unscheduled Project',
      milestones: [{ id: 'unscheduled-ga', label: 'GA' }],
      tasks: [
        { id: 'active', type: 'task', title: 'Needs date', status: 'progress' },
      ],
    },
    {
      id: 'poor-evidence',
      name: 'Poor Evidence Project',
      lastStatusReviewAt: '2026-04-29T08:00:00+08:00',
      milestones: [{ id: 'poor-ga', label: 'GA', date: '2026-06-20' }],
      tasks: [
        { id: 'active', type: 'task', title: 'Needs source', status: 'progress', eta: '2026-06-10' },
      ],
    },
  ] as any[];

  const now = new Date('2026-04-30T12:00:00+08:00');

  assert.equal(getProjectDashboardViewFilter(projects[0], now), 'on-track');
  assert.equal(getProjectDashboardViewFilter(projects[1], now), 'watch');
  assert.equal(getProjectDashboardViewFilter(projects[2], now), 'needs-action');
  assert.equal(getProjectDashboardViewFilter(projects[3], now), 'empty');
  assert.equal(getProjectDashboardViewFilter(projects[4], now), 'watch');
  assert.equal(getProjectDashboardViewFilter(projects[5], now), 'empty');
  assert.equal(getProjectDashboardViewFilter(projects[6], now), 'watch');
  assert.deepEqual(buildProjectDashboardViewReason(projects[6], now), {
    filter: 'watch',
    label: '需关注',
    headline: '证据覆盖 50%：0 个缺 ETA，1 个缺来源',
    detail: '补充 Jira 或平台来源，方便状态回溯',
    severity: 'warning',
  });

  assert.deepEqual(
    buildProjectDashboardViewFilterCounts(projects, now),
    {
      all: 7,
      'needs-action': 1,
      watch: 3,
      empty: 2,
      'on-track': 1,
    },
  );

  assert.deepEqual(
    filterProjectsByDashboardView(projects, 'needs-action', now).map((project) => project.id),
    ['blocked'],
  );
  assert.deepEqual(
    filterProjectsByDashboardView(projects, 'watch', now).map((project) => project.id),
    ['soon', 'stale', 'poor-evidence'],
  );
  assert.deepEqual(
    filterProjectsByDashboardView(projects, 'empty', now).map((project) => project.id),
    ['empty', 'unscheduled'],
  );
  assert.deepEqual(
    filterProjectsByDashboardView(projects, 'on-track', now).map((project) => project.id),
    ['steady'],
  );
  assert.deepEqual(
    filterProjectsByDashboardView(projects, 'all', now).map((project) => project.id),
    ['steady', 'soon', 'blocked', 'empty', 'stale', 'unscheduled', 'poor-evidence'],
  );
}

function verifyProjectDecisionSummary() {
  const summary = buildProjectDecisionSummary(
    {
      id: 'decision-project',
      name: 'Decision Project',
      lastStatusReviewAt: '2026-04-30T08:00:00+08:00',
      milestones: [{ id: 'ga', label: 'GA', date: '2026-05-06' }],
      tasks: [
        {
          id: 'blocked',
          type: 'dep',
          title: 'Resolve API dependency',
          status: 'blocked',
          eta: '2026-05-04',
          jira: [{ key: 'API-1', title: 'Resolve dependency' }],
        },
        {
          id: 'overdue',
          type: 'task',
          title: 'Finish QA checklist',
          status: 'testing',
          eta: '2026-04-28',
        },
        {
          id: 'due-soon',
          type: 'task',
          title: 'Review release notes',
          status: 'progress',
          eta: '2026-05-03',
        },
        {
          id: 'missing-eta',
          type: 'design',
          title: 'Confirm launch copy',
          status: 'review',
        },
        {
          id: 'done',
          type: 'task',
          title: 'Completed setup',
          status: 'done',
        },
      ],
    } as any,
    { now: new Date('2026-04-30T12:00:00+08:00') },
  );

  assert.equal(summary.nextAction, '先确认阻塞负责人和解除条件');
  assert.deepEqual(
    summary.signals.slice(0, 4).map((signal) => `${signal.id}:${signal.severity}`),
    ['blocked:critical', 'overdue:critical', 'due-soon:warning', 'missing-eta:info'],
  );
  assert.equal(summary.dataGaps.missingEtaTasks, 1);
  assert.equal(summary.dataGaps.missingSourceTasks, 3);
  assert.equal(summary.dataQuality.state, 'poor');
  assert.equal(summary.dataQuality.overallCoverage, 50);
}

function verifyProjectTaskRiskSummary() {
  const risk = buildProjectTaskRiskSummary(
    {
      id: 'activity-risk',
      name: 'Activity Risk',
      milestones: [{ id: 'ga', label: 'GA', date: '2026-05-03' }],
      tasks: [],
    } as any,
    {
      id: 'blocked-platform',
      type: 'task',
      title: 'Blocked platform rollout',
      status: 'blocked',
      eta: '2026-04-28',
      platforms: {
        qa: { status: 'blocked' },
      },
    } as any,
    { now: new Date('2026-04-30T12:00:00+08:00') },
  );

  assert.equal(risk.label, '高风险');
  assert.equal(risk.score, 86);
  assert.deepEqual(risk.drivers, [
    '任务阻塞',
    '过期 2 天',
    '缺 Jira / 平台来源',
    '1 个平台阻塞',
    'GA 里程碑临近',
  ]);
}

function verifyProjectDataQualitySummary() {
  const complete = buildProjectDataQualitySummary({
    id: 'complete-quality',
    name: 'Complete Quality',
    milestones: [],
    tasks: [
      {
        id: 'task-1',
        type: 'task',
        title: 'Ready task',
        status: 'progress',
        eta: '2026-05-10',
        jira: [{ key: 'READY-1', title: 'Ready task' }],
      },
    ],
  } as any);

  assert.equal(complete.state, 'complete');
  assert.equal(complete.overallCoverage, 100);

  const partial = buildProjectDataQualitySummary({
    id: 'partial-quality',
    name: 'Partial Quality',
    milestones: [],
    tasks: [
      {
        id: 'with-source',
        type: 'task',
        title: 'Has source',
        status: 'progress',
        eta: '2026-05-10',
        jira: [{ key: 'SRC-1', title: 'Has source' }],
      },
      {
        id: 'missing-source',
        type: 'task',
        title: 'Needs source',
        status: 'progress',
        eta: '2026-05-12',
      },
    ],
  } as any);

  assert.equal(partial.state, 'partial');
  assert.equal(partial.missingEtaTasks, 0);
  assert.equal(partial.missingSourceTasks, 1);
  assert.equal(partial.overallCoverage, 75);

  const poor = buildProjectDataQualitySummary({
    id: 'poor-quality',
    name: 'Poor Quality',
    milestones: [],
    tasks: [
      { id: 'missing-both', type: 'task', title: 'Missing both', status: 'progress' },
      { id: 'missing-source', type: 'task', title: 'Missing source', status: 'testing', eta: '2026-05-12' },
      { id: 'done', type: 'task', title: 'Done task', status: 'closed' },
    ],
  } as any);

  assert.equal(poor.state, 'poor');
  assert.equal(poor.activeTasks, 2);
  assert.equal(poor.missingEtaTasks, 1);
  assert.equal(poor.missingSourceTasks, 2);
  assert.equal(poor.etaCoverage, 50);
  assert.equal(poor.sourceCoverage, 0);
  assert.equal(poor.overallCoverage, 25);

  const draft = buildProjectStatusUpdateDraft({
    id: 'draft-quality',
    name: 'Draft Quality',
    milestones: [],
    tasks: [
      { id: 'missing-both', type: 'task', title: 'Missing both', status: 'progress' },
    ],
  } as any);

  assert.match(draft, /证据覆盖：证据不足 - 证据覆盖 0%：1 个缺 ETA，1 个缺来源/);
  assert.match(draft, /\[证据不足\] 0% 覆盖：1 个缺 ETA，1 个缺来源/);
}

function verifyProjectFreshnessSummary() {
  const now = new Date('2026-04-30T12:00:00+08:00');
  const staleProject = {
    id: 'stale',
    name: 'Stale Completed Project',
    milestones: [{ id: 'ga', label: 'GA', date: '2026-01-15' }],
    tasks: [
      { id: 'closed', type: 'task', title: 'Closed work', status: 'closed', eta: '2026-01-10' },
    ],
  } as any;
  const freshProject = {
    id: 'fresh',
    name: 'Fresh Completed Project',
    milestones: [{ id: 'ga', label: 'GA', date: '2026-06-10' }],
    tasks: [
      { id: 'closed', type: 'task', title: 'Closed work', status: 'closed', eta: '2026-06-01' },
    ],
  } as any;
  const unscheduledProject = {
    id: 'unscheduled',
    name: 'Unscheduled Project',
    milestones: [{ id: 'ga', label: 'GA' }],
    tasks: [
      { id: 'active', type: 'task', title: 'Needs date', status: 'progress' },
    ],
  } as any;

  const staleFreshness = buildProjectFreshnessSummary(staleProject, now);
  assert.equal(staleFreshness.state, 'stale');
  assert.equal(staleFreshness.latestDate, '2026-01-15');
  assert.equal(staleFreshness.daysSinceLatest, 105);

  const freshFreshness = buildProjectFreshnessSummary(freshProject, now);
  assert.equal(freshFreshness.state, 'fresh');
  assert.equal(freshFreshness.latestDate, '2026-06-10');

  const unscheduledFreshness = buildProjectFreshnessSummary(unscheduledProject, now);
  assert.equal(unscheduledFreshness.state, 'unscheduled');
  assert.equal(unscheduledFreshness.datedItems, 0);

  const decision = buildProjectDecisionSummary(staleProject, { now });
  assert.equal(decision.nextAction, '先刷新项目 ETA / 里程碑，确认计划仍有效');
  assert.equal(decision.signals.some((signal) => signal.id === 'stale-plan'), true);

  const draft = buildProjectStatusUpdateDraft(staleProject, { now });
  assert.match(draft, /数据新鲜度：计划陈旧 - 最近计划日期 2026-01-15 已过 105 天/);

  const evidence = buildProjectStatusEvidenceItems(staleProject, { now });
  assert.equal(evidence.some((item) => item.type === 'freshness' && item.label === '计划陈旧'), true);
  assert.equal(getProjectDashboardViewFilter(staleProject, now), 'watch');
  assert.equal(getProjectDashboardViewFilter(unscheduledProject, now), 'empty');

  const sorted = [freshProject, staleProject].sort((a, b) => compareProjectsByDashboardPriority(a, b, now));
  assert.deepEqual(sorted.map((project) => project.id), ['stale', 'fresh']);
}

function verifyProjectReviewSummary() {
  const now = new Date('2026-04-30T12:00:00+08:00');
  const currentProject = {
    id: 'current-review',
    name: 'Current Review',
    lastStatusReviewAt: '2026-04-28T10:00:00+08:00',
    milestones: [{ id: 'ga', label: 'GA', date: '2026-06-01' }],
    tasks: [{ id: 'active', type: 'task', title: 'Active work', status: 'progress', eta: '2026-05-20' }],
  } as any;
  const dueProject = {
    ...currentProject,
    id: 'due-review',
    name: 'Due Review',
    lastStatusReviewAt: '2026-04-21T10:00:00+08:00',
  };
  const overdueProject = {
    ...currentProject,
    id: 'overdue-review',
    name: 'Overdue Review',
    lastStatusReviewAt: '2026-04-10T10:00:00+08:00',
  };
  const unreviewedProject = {
    ...currentProject,
    id: 'unreviewed',
    name: 'Unreviewed',
    lastStatusReviewAt: undefined,
  };

  assert.equal(buildProjectReviewSummary(currentProject, now).state, 'current');
  assert.equal(buildProjectReviewSummary(dueProject, now).state, 'due');
  assert.equal(buildProjectReviewSummary(overdueProject, now).state, 'overdue');
  assert.equal(buildProjectReviewSummary(unreviewedProject, now).state, 'unreviewed');
  assert.equal(getProjectDashboardViewFilter(dueProject, now), 'watch');

  const decision = buildProjectDecisionSummary(overdueProject, { now });
  assert.equal(decision.nextAction, '复核状态草稿并记录本次项目检查');
  assert.equal(decision.signals.some((signal) => signal.id === 'status-review'), true);

  const draft = buildProjectStatusUpdateDraft(overdueProject, { now });
  assert.match(draft, /状态复核：复核过期 - 20 天未复核状态/);

  const evidence = buildProjectStatusEvidenceItems(unreviewedProject, { now });
  assert.equal(evidence.some((item) => item.type === 'review' && item.label === '未复核'), true);

  const sorted = [currentProject, overdueProject, dueProject, unreviewedProject]
    .sort((a, b) => compareProjectsByDashboardPriority(a, b, now));
  assert.deepEqual(sorted.map((project) => project.id), ['overdue-review', 'unreviewed', 'due-review', 'current-review']);
}

function verifyProjectReviewQueueSummary() {
  const now = new Date('2026-04-30T12:00:00+08:00');
  const projects = [
    {
      id: 'current-review',
      name: 'Current Review',
      lastStatusReviewAt: '2026-04-28T10:00:00+08:00',
      milestones: [{ id: 'ga', label: 'GA', date: '2026-06-01' }],
      tasks: [{ id: 'active', type: 'task', title: 'Active work', status: 'progress', eta: '2026-05-20' }],
    },
    {
      id: 'due-review',
      name: 'Due Review',
      lastStatusReviewAt: '2026-04-21T10:00:00+08:00',
      milestones: [{ id: 'ga', label: 'GA', date: '2026-05-20' }],
      tasks: [{ id: 'active', type: 'task', title: 'Active work', status: 'progress', eta: '2026-05-12' }],
    },
    {
      id: 'blocked-overdue-review',
      name: 'Blocked Overdue Review',
      lastStatusReviewAt: '2026-04-10T10:00:00+08:00',
      milestones: [{ id: 'ga', label: 'GA', date: '2026-05-03' }],
      tasks: [{ id: 'blocked', type: 'dep', title: 'Blocked work', status: 'blocked', eta: '2026-04-28' }],
    },
    {
      id: 'unreviewed',
      name: 'Unreviewed',
      milestones: [{ id: 'ga', label: 'GA', date: '2026-06-01' }],
      tasks: [{ id: 'active', type: 'task', title: 'Active work', status: 'progress', eta: '2026-05-20' }],
    },
  ] as any[];

  const queue = buildProjectReviewQueueSummary(projects, { now, maxItems: 2 });

  assert.equal(queue.totalItems, 3);
  assert.equal(queue.hiddenItems, 1);
  assert.deepEqual(
    queue.visibleItems.map((item) => `${item.projectId}:${item.label}:${item.severity}`),
    [
      'blocked-overdue-review:复核过期:critical',
      'unreviewed:未复核:warning',
    ],
  );
  assert.deepEqual(
    queue.visibleItems.map((item) => `${item.healthLabel}/${item.viewLabel}`),
    ['需处理/需处理', '正常/需关注'],
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
  verifyProjectDashboardViewFilters();
  verifyProjectDecisionSummary();
  verifyProjectTaskRiskSummary();
  verifyProjectDataQualitySummary();
  verifyProjectFreshnessSummary();
  verifyProjectReviewSummary();
  verifyProjectReviewQueueSummary();
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
