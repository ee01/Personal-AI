import { describe, expect, it } from 'vitest';
import {
  buildCreateJiraPayload,
  buildDraftGroups,
  buildStateMessage,
  canDeleteItem,
  defaultPhaseDate,
  formatEstimate,
  isDraftItem,
  itemDisplayKey,
  pendingDepCount,
  pickTickerEntry,
  subTypeComesFromCreateMeta,
  tickerLabel,
  tooltipHintLine,
  trackMarkers,
  typeBadge,
} from '../composables/useRoadmapContract';
import { ROADMAP_CREATE_JIRA_SYSTEM_PROMPT } from '../composables/useCreateJiraAgentPrompt';
import type { RoadmapItem, RoadmapSub } from '../types';

function sub(overrides: Partial<RoadmapSub> = {}): RoadmapSub {
  return {
    id: 'sub1',
    key: null,
    title: 'child task',
    alias: null,
    owner: null,
    start: '2026-07-01',
    days: 14,
    temp: true,
    createdBy: 'Tester',
    version: 1,
    ...overrides,
  };
}

function item(overrides: Partial<RoadmapItem> = {}): RoadmapItem {
  return {
    key: 'NOVA-1',
    type: 'Epic',
    title: 'Imported epic',
    source: 'jira',
    jiraKey: 'NOVA-1',
    projectKey: 'NOVA',
    alias: null,
    quarter: '2026-Q3',
    estimate: 3,
    targetStart: '2026-07-01',
    targetEnd: '2026-08-01',
    scheduled: true,
    start: '2026-07-01',
    days: 30,
    lane: 0,
    expanded: false,
    version: 1,
    subs: [],
    markers: [],
    ...overrides,
  };
}

describe('draft detection', () => {
  it('treats a missing jiraKey as draft regardless of source', () => {
    expect(isDraftItem(item({ jiraKey: null }))).toBe(true);
    expect(isDraftItem(item({ source: 'manual', jiraKey: null }))).toBe(true);
  });

  it('does not treat a resolved manual item as draft', () => {
    const resolved = item({
      key: 'LOCAL-ab12cd34',
      source: 'manual',
      jiraKey: 'NOVA-900',
    });
    expect(isDraftItem(resolved)).toBe(false);
    expect(itemDisplayKey(resolved)).toBe('NOVA-900');
    expect(canDeleteItem(resolved)).toBe(false);
  });

  it('only allows deleting manual items without a Jira issue', () => {
    expect(canDeleteItem(item({ source: 'manual', jiraKey: null }))).toBe(true);
    expect(canDeleteItem(item({ source: 'jira', jiraKey: null }))).toBe(false);
  });

  it('falls back to the local key while no Jira issue exists', () => {
    expect(itemDisplayKey(item({ key: 'LOCAL-ab12cd34', jiraKey: null }))).toBe(
      'LOCAL-ab12cd34',
    );
  });
});

describe('display helpers', () => {
  it('renders an empty estimate as a dash instead of 0 / NaN', () => {
    expect(formatEstimate(null)).toBe('—');
    expect(formatEstimate(undefined)).toBe('—');
    expect(formatEstimate(0)).toBe('—');
    expect(formatEstimate(Number.NaN)).toBe('—');
    expect(formatEstimate(2)).toBe('2w');
  });

  it('maps canonical Jira casing onto the uppercase badge classes', () => {
    expect(typeBadge('Epic')).toEqual({ cls: 'type-EPIC', label: 'EPIC' });
    expect(typeBadge('Initiative')).toEqual({ cls: 'type-INIT', label: 'INIT' });
    expect(typeBadge('Task')).toEqual({ cls: 'type-TASK', label: 'TASK' });
    expect(typeBadge('Story').cls).toBe('type-TASK');
  });
});

describe('sub-type source', () => {
  /**
   * The backend sends `subType: null` for a Task-level parent on purpose; the
   * create modal must let that through instead of demanding a name the user
   * cannot know, because only the project's createmeta has it.
   */
  it('leaves the Task-level sub-task name to the extension', () => {
    expect(subTypeComesFromCreateMeta('Task')).toBe(true);
    expect(subTypeComesFromCreateMeta('Story')).toBe(true);
    expect(subTypeComesFromCreateMeta('User Story')).toBe(true);
    expect(subTypeComesFromCreateMeta('Bug')).toBe(true);
  });

  it('keeps the named child types under the user’s control', () => {
    expect(subTypeComesFromCreateMeta('Epic')).toBe(false);
    expect(subTypeComesFromCreateMeta('Initiative')).toBe(false);
    expect(subTypeComesFromCreateMeta('INIT')).toBe(false);
    expect(subTypeComesFromCreateMeta('')).toBe(false);
    expect(subTypeComesFromCreateMeta(null)).toBe(false);
  });
});

describe('postMessage state', () => {
  it('emits teamId plus the legacy team alias and the memory fields', () => {
    const message = buildStateMessage({
      teamId: 'T1',
      teamName: 'Nova',
      quarter: '2026-Q3',
      editable: true,
      items: [
        item({ key: 'LOCAL-a1', source: 'manual', jiraKey: null, quarter: null, subs: [sub()] }),
      ],
    });

    expect(message.type).toBe('pai-roadmap-state');
    expect(message.teamId).toBe('T1');
    expect(message.team).toBe('T1');
    expect(message.items[0]).toEqual({
      key: 'LOCAL-a1',
      type: 'Epic',
      title: 'Imported epic',
      alias: null,
      quarter: '2026-Q3',
      targetStart: '2026-07-01',
      targetEnd: '2026-08-01',
      start: '2026-07-01',
      days: 30,
      isDraft: true,
      jiraKey: null,
      subActivity: true,
      description: null,
    });
  });

  it('marks resolved items as non-draft and carries the real key', () => {
    const message = buildStateMessage({
      teamId: 'T1',
      teamName: 'Nova',
      quarter: '2026-Q3',
      editable: true,
      items: [item({ key: 'LOCAL-a1', source: 'manual', jiraKey: 'NOVA-900' })],
    });
    expect(message.items[0].isDraft).toBe(false);
    expect(message.items[0].jiraKey).toBe('NOVA-900');
    expect(message.items[0].key).toBe('LOCAL-a1');
  });
});

describe('create-jira payload', () => {
  const fields = {
    teamId: 'T1',
    token: 'tok',
    projectKey: 'NOVA',
    issueType: 'Epic',
    subType: 'Task',
  };

  it('groups only items that still need creating', () => {
    const groups = buildDraftGroups([
      item({ key: 'LOCAL-a1', source: 'manual', jiraKey: null }),
      item({ key: 'NOVA-2', subs: [sub({ id: 's2' })] }),
      item({ key: 'NOVA-3', subs: [sub({ id: 's3', temp: false })] }),
    ]);
    expect(groups.map((g) => g.item.key)).toEqual(['LOCAL-a1', 'NOVA-2']);
  });

  it('sends a parent block for a draft main item', () => {
    const group = buildDraftGroups([
      item({
        key: 'LOCAL-ab12cd34',
        source: 'manual',
        jiraKey: null,
        title: 'Manual epic',
        subs: [sub({ id: 'd1', title: 'first child' })],
      }),
    ])[0];

    expect(buildCreateJiraPayload(group, fields)).toEqual({
      teamId: 'T1',
      token: 'tok',
      parent: {
        itemKey: 'LOCAL-ab12cd34',
        title: 'Manual epic',
        issueType: 'Epic',
        projectKey: 'NOVA',
        targetStart: '2026-07-01',
        targetEnd: '2026-08-01',
        fixVersion: null,
        description: null,
      },
      children: [
        {
          draftId: 'd1',
          title: 'first child',
          issueType: 'Task',
          projectKey: 'NOVA',
          parentItemKey: 'LOCAL-ab12cd34',
          parentJiraKey: null,
          fixVersion: null,
          assignee: null,
          description: null,
        },
      ],
    });
  });

  it('applies per-row fixVersion suggestions and a uniform override', () => {
    const group = buildDraftGroups([
      item({
        key: 'LOCAL-ab12cd34',
        source: 'manual',
        jiraKey: null,
        title: 'Manual epic',
        subs: [sub({ id: 'd1', title: 'first child' })],
      }),
    ])[0];

    expect(
      buildCreateJiraPayload(group, {
        ...fields,
        fixVersionByKey: {
          'LOCAL-ab12cd34': '26.3.220',
          d1: '26.4.10',
        },
      }).parent?.fixVersion,
    ).toBe('26.3.220');
    expect(
      buildCreateJiraPayload(group, {
        ...fields,
        fixVersionOverride: '26.5.0',
        fixVersionByKey: {
          'LOCAL-ab12cd34': '26.3.220',
          d1: '26.4.10',
        },
      }).children[0].fixVersion,
    ).toBe('26.5.0');
  });

  it('omits the parent and passes its key when the issue already exists', () => {
    const group = buildDraftGroups([
      item({ key: 'NOVA-7', jiraKey: 'NOVA-7', subs: [sub({ id: 'd2' })] }),
    ])[0];
    const payload = buildCreateJiraPayload(group, fields);

    expect(payload.parent).toBeNull();
    expect(payload.children[0].parentJiraKey).toBe('NOVA-7');
    expect(payload.children[0].parentItemKey).toBe('NOVA-7');
  });

  it('forwards draft descriptions on parent and children', () => {
    const group = buildDraftGroups([
      item({
        key: 'LOCAL-ab12cd34',
        source: 'manual',
        jiraKey: null,
        title: 'Manual epic',
        description: 'parent notes',
        subs: [sub({ id: 'd1', title: 'first child', description: 'child notes' })],
      }),
    ])[0];
    const payload = buildCreateJiraPayload(group, fields);
    expect(payload.parent?.description).toBe('parent notes');
    expect(payload.children[0].description).toBe('child notes');
  });
});

describe('markers helpers', () => {
  it('counts pending deps and sorts track markers', () => {
    const row = item({
      markers: [
        {
          id: 'd1',
          kind: 'dep',
          label: 'no eta',
          date: null,
          createdBy: 't',
          version: 1,
        },
        {
          id: 'p1',
          kind: 'phase',
          phaseKind: 'production',
          label: 'Production',
          date: '2026-09-01',
          createdBy: 't',
          version: 1,
        },
        {
          id: 'd2',
          kind: 'dep',
          label: 'with eta',
          date: '2026-08-10',
          jiraKey: 'PLAT-1',
          etaSource: 'jira',
          createdBy: 't',
          version: 1,
        },
      ],
    });
    expect(pendingDepCount(row)).toBe(1);
    expect(trackMarkers(row).map((m) => m.id)).toEqual(['d2', 'p1']);
  });

  it('defaults phase dates past the bar end with stagger', () => {
    const row = item({
      start: '2026-08-01',
      days: 14,
      markers: [
        {
          id: 'p0',
          kind: 'phase',
          phaseKind: 'design',
          label: 'Design',
          date: '2026-08-20',
          createdBy: 't',
          version: 1,
        },
      ],
    });
    // end = Aug 14; +7 + 1*7 = Aug 28
    expect(defaultPhaseDate(row)).toBe('2026-08-28');
  });
});

describe('sync ticker', () => {
  function entry(
    overrides: Partial<import('../types').ActivityEntry> = {},
  ): import('../types').ActivityEntry {
    return {
      id: 'a1',
      teamId: 't1',
      at: Date.now(),
      actorName: 'Kevin',
      actorClientId: 'other',
      actorSource: 'anonymous',
      op: 'move',
      targetType: 'item',
      targetKey: 'NOVA-1',
      summary: { alias: 'Readiness' },
      text: 'Kevin 把 Readiness 从 2026-08-01 移到 2026-08-05',
      ...overrides,
    };
  }

  it('pickTickerEntry skips self and noise ops', () => {
    expect(pickTickerEntry([], 'me')).toBeNull();
    expect(
      pickTickerEntry(
        [entry({ actorClientId: 'me' }), entry({ id: 'a2', op: 'lock' })],
        'me',
      ),
    ).toBeNull();
    const hit = entry({ id: 'a3', actorClientId: 'other', op: 'add_sub' });
    expect(
      pickTickerEntry(
        [
          entry({ actorClientId: 'me' }),
          entry({ id: 'noise', op: 'expand' }),
          entry({ id: 'refresh', op: 'refresh_from_jira' }),
          hit,
        ],
        'me',
      ),
    ).toBe(hit);
  });

  it('tickerLabel strips actor prefix and truncates', () => {
    expect(tickerLabel(entry())).toBe(
      '把 Readiness 从 2026-08-01 移到 2026-08-05',
    );
    const long = entry({
      text: `Kevin ${'很长的动作文案'.repeat(20)}`,
    });
    const label = tickerLabel(long, 20);
    expect(label.endsWith('…')).toBe(true);
    expect(label.length).toBe(20);
  });
});

describe('draft description contract', () => {
  it('tooltip hint prefers description over the operation hint', () => {
    expect(tooltipHintLine('LaunchDarkly 开关覆盖 Web 与移动端', '双击修改备注名')).toBe(
      'LaunchDarkly 开关覆盖 Web 与移动端',
    );
    expect(tooltipHintLine(null, '双击修改备注名')).toBe('双击修改备注名');
    expect(tooltipHintLine('   ', '拖到右侧时间轴排期')).toBe('拖到右侧时间轴排期');
  });

  it('system prompt combines user description and allows rewrite', () => {
    expect(ROADMAP_CREATE_JIRA_SYSTEM_PROMPT).toContain(
      '该子任务用户填写的描述',
    );
    expect(ROADMAP_CREATE_JIRA_SYSTEM_PROMPT).toContain(
      '不必与用户输入逐字一致',
    );
    expect(ROADMAP_CREATE_JIRA_SYSTEM_PROMPT).toContain(
      '带用户描述的 draft 主任务以用户描述为基础润色',
    );
  });
});
