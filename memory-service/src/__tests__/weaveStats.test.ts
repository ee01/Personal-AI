import { describe, expect, it } from 'vitest';

import { buildWeaveStats } from '../core/weaveStats.js';

const DAY = 86_400;
const T0 = 1_700_000_000;

describe('buildWeaveStats (P0-5)', () => {
  it('marks crossSource when ≥2 distinct sources', () => {
    const w = buildWeaveStats([
      { source: 'ringcentral', timestamp: T0 },
      { source: 'jira', timestamp: T0 + 100 },
    ]);
    expect(w.sourceCount).toBe(2);
    expect(w.sourceKinds.sort()).toEqual(['jira', 'ringcentral']);
    expect(w.crossSource).toBe(true);
  });

  it('marks crossSource when a single source spans ≥7 days', () => {
    const w = buildWeaveStats([
      { source: 'ringcentral', timestamp: T0 },
      { source: 'ringcentral', timestamp: T0 + 17 * DAY },
    ]);
    expect(w.sourceCount).toBe(1);
    expect(w.daySpanDays).toBe(17);
    expect(w.crossSource).toBe(true);
  });

  it('does NOT mark crossSource for single source within a week (anti-inflation)', () => {
    const w = buildWeaveStats([
      { source: 'ringcentral', timestamp: T0 },
      { source: 'ringcentral', timestamp: T0 + 3 * DAY },
    ]);
    expect(w.sourceCount).toBe(1);
    expect(w.daySpanDays).toBe(3);
    expect(w.crossSource).toBe(false);
  });

  it('counts distinct entities (entity-type id + linked entity id)', () => {
    const w = buildWeaveStats([
      { type: 'entity', id: 'e-1', source: 'graph', timestamp: T0 },
      { type: 'message', id: 'm-1', source: 'jira', timestamp: T0 + DAY, entity: { id: 'e-2' } },
      { type: 'message', id: 'm-2', source: 'jira', timestamp: T0, entity: { id: 'e-1' } },
    ]);
    expect(w.entityCount).toBe(2); // e-1, e-2
  });

  it('is case-insensitive and ignores empty sources', () => {
    const w = buildWeaveStats([
      { source: 'Jira', timestamp: T0 },
      { source: 'jira', timestamp: T0 },
      { source: '', timestamp: T0 },
    ]);
    expect(w.sourceCount).toBe(1);
  });

  it('handles empty / single-item input safely', () => {
    expect(buildWeaveStats([]).crossSource).toBe(false);
    expect(buildWeaveStats([{ source: 'jira', timestamp: T0 }]).crossSource).toBe(false);
    expect(buildWeaveStats([{ source: 'jira' }]).daySpanDays).toBe(0);
  });
});
