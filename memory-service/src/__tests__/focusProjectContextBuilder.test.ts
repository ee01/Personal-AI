import { describe, expect, it } from 'vitest';
import {
  buildFocusParagraphContext,
  buildFocusRowContext,
  selectFocusProjectsForBudget,
  type FocusProjectRecord,
} from '../core/FocusProjectContextBuilder.js';

describe('FocusProjectContextBuilder', () => {
  const projects: FocusProjectRecord[] = [
    {
      id: 'a1',
      name: 'Refactor media pipeline for low-end devices',
      displayName: '媒体重构',
      aliases: ['媒体重构'],
      teamRef: 'team-a',
      teamName: 'Nova',
      tier: 'focus',
      priority: 90,
      externalRef: { jiraKey: 'NOVA-1' },
    },
    {
      id: 'a2',
      name: 'Another long title that should lose budget race',
      displayName: '性能',
      teamRef: 'team-a',
      teamName: 'Nova',
      tier: 'focus',
      priority: 20,
      externalRef: { jiraKey: 'NOVA-2' },
    },
    {
      id: 'b1',
      name: 'Login redesign epic',
      displayName: '登录改版',
      teamRef: 'team-b',
      teamName: 'RCV',
      tier: 'focus',
      priority: 40,
      externalRef: { jiraKey: 'MTR-9' },
    },
  ];

  it('keeps a per-team floor under tight budget', () => {
    const selected = selectFocusProjectsForBudget(projects, {
      maxTotal: 2,
      perTeamFloor: 1,
    });
    const teams = new Set(selected.map((p) => p.teamRef));
    expect(teams.has('team-a')).toBe(true);
    expect(teams.has('team-b')).toBe(true);
    expect(selected).toHaveLength(2);
  });

  it('prefers alias/displayName in row context', () => {
    const text = buildFocusRowContext(projects, { maxTotal: 3, perTeamFloor: 1 });
    expect(text).toContain('媒体重构');
    expect(text).toContain('NOVA-1');
    expect(text).not.toContain('Refactor media pipeline for low-end devices');
  });

  const draft: FocusProjectRecord = {
    id: 'roadmap-team-a-local-ab12cd34',
    name: 'Hand-made backlog item awaiting a Jira issue',
    displayName: '手动条目',
    aliases: ['手动条目'],
    teamRef: 'team-a',
    teamName: 'Nova',
    tier: 'focus',
    priority: 70,
    externalRef: {
      itemKey: 'LOCAL-ab12cd34',
      jiraKey: null,
      isDraft: true,
    },
  };

  it('renders a draft by display name and never leaks its synthetic key', () => {
    const row = buildFocusRowContext([draft], { maxTotal: 3, perTeamFloor: 1 });
    expect(row).toContain('手动条目');
    expect(row).not.toContain('LOCAL-ab12cd34');
    expect(row).not.toContain('[');

    const paragraph = buildFocusParagraphContext([draft], {
      maxTotal: 3,
      perTeamFloor: 1,
    });
    expect(paragraph).toContain('手动条目');
    expect(paragraph).not.toContain('LOCAL-ab12cd34');
    expect(paragraph).not.toContain('(');
  });

  it('puts user description in paragraph notes and not the row line', () => {
    const withNotes: FocusProjectRecord = {
      ...draft,
      description: 'LaunchDarkly flags for composer and mobile',
    };
    const paragraph = buildFocusParagraphContext([withNotes], {
      maxTotal: 3,
      perTeamFloor: 1,
    });
    expect(paragraph).toContain('notes: LaunchDarkly flags for composer and mobile');
    const row = buildFocusRowContext([withNotes], { maxTotal: 3, perTeamFloor: 1 });
    expect(row).not.toContain('LaunchDarkly');
  });

  it('renders the real key once a draft is resolved to a Jira issue', () => {
    const resolved: FocusProjectRecord = {
      ...draft,
      externalRef: {
        itemKey: 'LOCAL-ab12cd34',
        jiraKey: 'NOVA-77',
        isDraft: false,
      },
    };
    const row = buildFocusRowContext([resolved], { maxTotal: 3, perTeamFloor: 1 });
    expect(row).toContain('[NOVA-77]');
    expect(row).not.toContain('LOCAL-ab12cd34');
  });
});
