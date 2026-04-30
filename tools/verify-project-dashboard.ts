import assert from 'node:assert/strict';

import {
  DashboardDataManager,
  DashboardMessageHandler,
  buildProjectHealthSummary,
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

async function main() {
  await verifyCreateProjectKeepsMilestonesAndPersists();
  await verifyDashboardHandlerAddsTaskItems();
  verifyProjectHealthSummary();

  console.log('verify-project-dashboard: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
