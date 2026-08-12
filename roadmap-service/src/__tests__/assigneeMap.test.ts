import { describe, expect, it } from 'vitest';
import {
  importedTaskSpan,
  migrateAssigneeMapKey,
  normalizeAssigneeMap,
  parseAssigneeMap,
} from '../core/assigneeMap.js';

describe('importedTaskSpan', () => {
  const epic = { start: '2026-08-01', days: 30 };

  it('uses both Target dates when present', () => {
    expect(importedTaskSpan(epic, '2026-08-03', '2026-08-10')).toEqual({
      start: '2026-08-03',
      days: 8,
    });
  });

  it('mirrors parent when both Targets missing', () => {
    expect(importedTaskSpan(epic, null, null)).toEqual({
      start: '2026-08-01',
      days: 30,
    });
  });

  it('starts at Target Start for two weeks, clamped to parent end', () => {
    expect(importedTaskSpan(epic, '2026-08-25', null)).toEqual({
      start: '2026-08-25',
      days: 6,
    });
  });

  it('ends at Target End looking back two weeks, clamped to parent start', () => {
    expect(importedTaskSpan(epic, null, '2026-08-05')).toEqual({
      start: '2026-08-01',
      days: 5,
    });
  });
});

describe('assignee map helpers', () => {
  it('parses and normalizes keys to lowercase', () => {
    expect(parseAssigneeMap('{"Ray":"Ray Zhang"}')).toEqual({
      ray: 'Ray Zhang',
    });
    expect(normalizeAssigneeMap({ Vivi: 'Vivi Wang', '': 'x' })).toEqual({
      vivi: 'Vivi Wang',
    });
  });

  it('migrates map key on member rename', () => {
    expect(
      migrateAssigneeMapKey({ ray: 'Ray Zhang' }, 'ray', 'Ray Zhang'),
    ).toEqual({ 'ray zhang': 'Ray Zhang' });
  });
});
