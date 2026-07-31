import { beforeEach, describe, expect, it } from 'vitest';

import {
  MemoryChangeLedgerService,
  extractMemoryChanges,
} from '../core/MemoryChangeLedgerService.js';
import { getTestDb } from './setup.js';

const db = getTestDb();

function clearLedger(): void {
  db.prepare('DELETE FROM memory_change_events').run();
  db.prepare('DELETE FROM memory_change_chains').run();
  db.prepare('DELETE FROM memory_change_extractions').run();
}

describe('MemoryChangeLedgerService', () => {
  beforeEach(clearLedger);

  it('extracts a release-date transition from explicit Chinese old/new text', () => {
    const extracted = extractMemoryChanges({
      sourceRefType: 'source_memory',
      sourceRefId: 'release-note',
      sourceKind: 'manual',
      text: '发布时间从 2026-07-18 调整为 2026-07-25。',
      metadata: { releaseId: 'desktop-8.1', releaseTitle: 'Desktop 8.1' },
      observedAt: 100,
    });

    expect(extracted.candidates).toHaveLength(1);
    expect(extracted.candidates[0]).toMatchObject({
      subjectKey: 'release:desktop-8.1',
      propertyKey: 'release.date',
      previousValue: { kind: 'date', normalized: '2026-07-18' },
      nextValue: { kind: 'date', normalized: '2026-07-25' },
    });
  });

  it('stores structured Goal diffs as separate property chains', () => {
    const service = new MemoryChangeLedgerService(db);
    const receipt = service.syncSource({
      sourceRefType: 'source_memory',
      sourceRefId: 'goal-update',
      sourceTitle: 'Q3 Personal AI Goal update',
      metadata: {
        goalId: 'personal-ai-q3',
        goalTitle: 'Personal AI Q3',
        authorityRole: 'owner_authored',
        changeEvents: [
          {
            field: 'Goal Scope',
            oldValue: ['Jira'],
            newValue: ['Jira', 'Meetings'],
            valueKind: 'set',
            reason: 'Meeting context is now in scope.',
            observedAt: 200,
          },
          {
            field: 'Success Metric',
            oldValue: '3 useful recalls/week',
            newValue: '5 accepted recalls/week',
            observedAt: 201,
          },
        ],
      },
    });

    expect(receipt.status).toBe('ready');
    expect(receipt.extractedCount).toBe(2);
    expect(receipt.projections).toHaveLength(2);
    expect(receipt.projections.map((item) => item.propertyKey).sort()).toEqual([
      'goal.scope',
      'goal.success_metric',
    ]);
    expect(receipt.projections.every((item) => item.status === 'last_observed')).toBe(true);
  });

  it('detects A to B to A reversals without flattening history', () => {
    const service = new MemoryChangeLedgerService(db);
    for (const [index, oldValue, newValue] of [
      [0, '0.2', '0.1'],
      [1, '0.1', '0.2'],
    ] as const) {
      service.syncSource({
        sourceRefType: 'source_memory',
        sourceRefId: `nova-1-${index}`,
        sourceTitle: 'NOVA-1 estimate history',
        metadata: {
          issueKey: 'NOVA-1',
          changeEvents: [
            {
              field: 'DEV Estimate',
              oldValue,
              newValue,
              observedAt: 10_000 + index * 10_000,
            },
          ],
        },
      });
    }

    const [projection] = service.getContextProjections({
      surface: 'web_passive',
      contextType: 'jira_issue',
      currentContext: { issueKey: 'NOVA-1' },
    });
    expect(projection.currentValue?.normalized).toBe(0.2);
    expect(projection.eventCount).toBe(2);
    expect(projection.reversalCount).toBe(1);
    expect(projection.history.at(-1)?.isReversal).toBe(true);
  });

  it('finds Jira change projections from an explicit issue key in the page URL', () => {
    const service = new MemoryChangeLedgerService(db);
    service.syncSource({
      sourceRefType: 'source_memory',
      sourceRefId: 'nova-url',
      sourceTitle: 'NOVA-9 estimate history',
      metadata: {
        issueKey: 'NOVA-9',
        changeEvents: [{ field: 'DEV Estimate', oldValue: '1', newValue: '2', observedAt: 20_000 }],
      },
    });

    const [projection] = service.getContextProjections({
      surface: 'web_passive',
      contextType: 'jira_issue',
      title: 'NOVA-9 estimate',
      url: 'https://jira.example.test/browse/NOVA-9',
    });

    expect(projection?.subjectKey).toBe('jira:NOVA-9');
  });

  it('marks same-window equal-authority disagreement as conflicted', () => {
    const service = new MemoryChangeLedgerService(db);
    for (const [id, nextValue] of [
      ['a', '2026-07-18'],
      ['b', '2026-07-25'],
    ] as const) {
      service.syncSource({
        sourceRefType: 'source_memory',
        sourceRefId: `release-${id}`,
        metadata: {
          releaseId: '8.2',
          changeEvents: [
            {
              field: 'Release Date',
              oldValue: '2026-07-11',
              newValue: nextValue,
              authorityRole: 'authoritative_source',
              observedAt: 30_000,
            },
          ],
        },
      });
    }

    const projections = service.findForAsk('8.2 的发布时间是什么？');
    expect(projections).toHaveLength(1);
    expect(projections[0].status).toBe('conflicted');
    expect(projections[0].conflictCount).toBe(1);
    expect(projections[0].currentValue).toBeUndefined();
    expect(projections[0].summary).toContain('候选冲突（2026-07-18 / 2026-07-25），当前值未知');
    expect(service.formatForPrompt(projections)).toContain('当前投影=未知（候选冲突）');
    expect(service.formatForPrompt(projections)).not.toContain('当前投影=2026-07-25');
  });

  it('uses a visible page value to resolve the current context without rewriting conflicted history', () => {
    const service = new MemoryChangeLedgerService(db);
    for (const [id, nextValue] of [
      ['a', '2026-07-18'],
      ['b', '2026-07-25'],
    ] as const) {
      service.syncSource({
        sourceRefType: 'source_memory',
        sourceRefId: `release-page-${id}`,
        metadata: {
          releaseId: '8.3',
          changeEvents: [{
            field: 'Release Date',
            oldValue: '2026-07-11',
            newValue: nextValue,
            authorityRole: 'authoritative_source',
            observedAt: 35_000,
          }],
        },
      });
    }

    const [pageProjection] = service.getContextProjections({
      surface: 'web_passive',
      contextType: 'webpage',
      entityHints: [{ kind: 'release_id', value: '8.3' }],
      currentContext: { visibleFields: [{ name: 'Release Date', value: '2026-07-30' }] },
    });
    expect(pageProjection.status).toBe('confirmed_current');
    expect(pageProjection.currentValue?.normalized).toBe('2026-07-30');
    expect(pageProjection.conflictCount).toBe(1);
    expect(pageProjection.boundary).toContain('冲突历史未被改写');

    const [storedProjection] = service.findForAsk('8.3 的发布时间是什么？');
    expect(storedProjection.status).toBe('conflicted');
    expect(storedProjection.currentValue).toBeUndefined();
  });

  it('reconciles current-page fields without rewriting stored history', () => {
    const service = new MemoryChangeLedgerService(db);
    service.syncSource({
      sourceRefType: 'source_memory',
      sourceRefId: 'nova-status',
      sourceTitle: 'NOVA-2 status',
      metadata: {
        issueKey: 'NOVA-2',
        changeEvents: [{ field: 'Status', oldValue: 'Open', newValue: 'In Progress', observedAt: 40_000 }],
      },
    });

    const [projection] = service.getContextProjections({
      surface: 'web_passive',
      contextType: 'jira_issue',
      currentContext: {
        issueKey: 'NOVA-2',
        visibleFields: [{ name: 'Status', value: 'Done' }],
      },
    });
    expect(projection.status).toBe('superseded_on_page');
    expect(projection.visiblePageValue?.normalized).toBe('done');
    expect(projection.currentValue?.normalized).toBe('in progress');

    const [stored] = service.findForAsk('NOVA-2 之前的状态变化');
    expect(stored.status).toBe('last_observed');
    expect(stored.currentValue?.normalized).toBe('in progress');
  });

  it('requires an explicit live Jira read before treating an owner comment as current', () => {
    const service = new MemoryChangeLedgerService(db);
    service.syncSource({
      sourceRefType: 'source_memory',
      sourceRefId: 'mtr-qa-comment',
      sourceTitle: 'MTR-148115 owner comment',
      sourceKind: 'jira_comment',
      text: 'Summary: QA Estimate Original: 1.01 New: 1.02',
      metadata: { issueKey: 'MTR-148115', ownerAuthored: true },
      observedAt: 60_000,
    });

    const [unverified] = service.getContextProjections({
      surface: 'web_passive',
      contextType: 'jira_issue',
      currentContext: { issueKey: 'MTR-148115' },
    });
    expect(unverified.propertyKey).toBe('estimate.qa');
    expect(unverified.status).toBe('last_observed');
    expect(unverified.currentValue?.normalized).toBe(1.02);
    expect(unverified.boundary).toContain('不等于权威系统已确认的当前值');

    const [verifiedEmpty] = service.getContextProjections({
      surface: 'web_passive',
      contextType: 'jira_issue',
      currentContext: {
        issueKey: 'MTR-148115',
        verifiedSourceFields: [{
          propertyKey: 'estimate.qa',
          name: 'QA Estimate',
          value: null,
          source: 'jira_rest',
          checkedAt: 60_100,
        }],
      },
    });
    expect(verifiedEmpty.status).toBe('superseded_at_source');
    expect(verifiedEmpty.currentValue?.normalized).toBeNull();
    expect(verifiedEmpty.boundary).toContain('确认当前为空');
  });

  it('keeps dismissed-source events auditable but removes their active projection', () => {
    const service = new MemoryChangeLedgerService(db);
    service.syncSource({
      sourceRefType: 'source_memory',
      sourceRefId: 'dismiss-me',
      sourceTitle: 'NOVA-3 priority',
      metadata: {
        issueKey: 'NOVA-3',
        changeEvents: [{ field: 'Priority', oldValue: 'P2', newValue: 'P1', observedAt: 50_000 }],
      },
    });
    service.setSourceActive('source_memory', 'dismiss-me', false);

    expect(service.getContextProjections({
      surface: 'web_passive',
      contextType: 'jira_issue',
      currentContext: { issueKey: 'NOVA-3' },
    })).toEqual([]);
    const receipt = service.getSourceLedger('source_memory', 'dismiss-me');
    expect(receipt.active).toBe(false);
    expect(receipt.events).toHaveLength(1);
    expect(receipt.projections[0]?.status).toBe('historical_only');
  });

  it('blocks subjectless changes and counts obvious UI noise', () => {
    const service = new MemoryChangeLedgerService(db);
    const blocked = service.syncSource({
      sourceRefType: 'source_memory',
      sourceRefId: 'subjectless',
      text: '发布时间从 7/18 调整为 7/25。',
    });
    expect(blocked.status).toBe('blocked');

    const noChange = service.syncSource({
      sourceRefType: 'source_memory',
      sourceRefId: 'noise',
      text: 'Collapse comment\nPress Enter',
      metadata: { issueKey: 'NOVA-4' },
    });
    expect(noChange.status).toBe('no_change');
    expect(noChange.excludedNoiseCount).toBe(2);
  });
});
