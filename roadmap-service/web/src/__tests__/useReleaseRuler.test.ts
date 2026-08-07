import { describe, expect, it } from 'vitest';
import {
  applyReleaseFilter,
  buildReleaseSheetConfig,
  catchRelease,
  extractSheetId,
  isMajorRelease,
  kindsInParsed,
  normFilter,
  normShow,
  parseReleaseRows,
  phaseKind,
  pickSplit,
  relParsed,
  relSegments,
  releaseMatcher,
} from '../composables/useReleaseRuler';

const rows = [
  { Release: '26.3.130', Phase: 'FF', Date: '2026-07-26T16:00:00.000Z' },
  { Release: '26.3.130', Phase: 'Re', Date: '2026-07-29T16:00:00.000Z' },
  { Release: '26.3.130', Phase: 'Stage', Date: '2026-07-30T16:00:00.000Z' },
  { Release: '26.3.130', Phase: 'Pro', Date: '2026-08-04T16:00:00.000Z' },
  { Release: '26.3.130', Phase: 'Multi-region', Date: '2026-08-06T16:00:00.000Z' },
  { Release: '26.3.140', Phase: 'FF', Date: '2026-08-09T16:00:00.000Z' },
  { Release: '26.3.140', Phase: 'Pro', Date: '2026-08-18T16:00:00.000Z' },
  { Release: 'RIO 26.3.141', Phase: 'Pro', Date: '2026-08-20T16:00:00.000Z' },
  { Release: '26.3.135', Phase: 'FF', Date: '2026-08-02T16:00:00.000Z' },
  { Release: '26.3.135', Phase: 'Pro', Date: '2026-08-06T16:00:00.000Z' },
];

describe('useReleaseRuler', () => {
  it('extracts spreadsheet id from URL or bare id', () => {
    expect(
      extractSheetId(
        'https://docs.google.com/spreadsheets/d/1sWRtByTquVLKeyv_kQG7nkSjP6-JBbSbNIVv4I3UzTM/edit#gid=0',
      ),
    ).toBe('1sWRtByTquVLKeyv_kQG7nkSjP6-JBbSbNIVv4I3UzTM');
    expect(extractSheetId('1abc_DEF-1234567890')).toBe('1abc_DEF-1234567890');
  });

  it('normalizes phase kinds', () => {
    expect(phaseKind('FF')).toBe('ff');
    expect(phaseKind('Feature Freeze')).toBe('ff');
    expect(phaseKind('Regression')).toBe('re');
    expect(phaseKind('Stage')).toBe('stage');
    expect(phaseKind('Production')).toBe('pro');
    expect(phaseKind('Multi-region')).toBe('mr');
    expect(phaseKind('Custom Gate')).toBe('other');
  });

  it('parses rows and builds FF segments without RIO as its own band', () => {
    const parsed = parseReleaseRows(rows);
    expect(kindsInParsed(parsed)).toEqual(['ff', 're', 'stage', 'pro', 'mr']);
    expect(parsed.releases.map((r) => r.name)).toEqual([
      '26.3.130',
      '26.3.135',
      '26.3.140',
      'RIO 26.3.141',
    ]);
    const segs = relSegments(parsed, 'ff');
    expect(segs).toHaveLength(3);
    expect(segs[0].rel.name).toBe('26.3.130');
    expect(segs[1].rel.name).toBe('26.3.135');
    expect(segs[2].rel.name).toBe('26.3.140');
  });

  it('makes RIO its own segment when split is Pro', () => {
    const parsed = parseReleaseRows(rows);
    const segs = relSegments(parsed, 'pro');
    expect(segs.map((s) => s.rel.name)).toEqual([
      '26.3.130',
      '26.3.135',
      '26.3.140',
      'RIO 26.3.141',
    ]);
  });

  it('defaults split to FF and keeps split phase in shown set', () => {
    const parsed = parseReleaseRows(rows);
    expect(pickSplit(null, parsed)).toBe('ff');
    expect(normShow(['stage', 'pro'], parsed, 'ff')).toEqual([
      'ff',
      'stage',
      'pro',
    ]);
    expect(normShow([], parsed, 'ff')).toEqual([
      'ff',
      're',
      'stage',
      'pro',
      'mr',
    ]);
  });

  it('finds the next catchable Pro sprint', () => {
    const parsed = parseReleaseRows(rows);
    const end = parsed.phases.find(
      (p) => p.kind === 'ff' && p.release === '26.3.140',
    )!.date;
    const cr = catchRelease(end, parsed);
    expect(cr?.release).toBe('26.3.140');

    const majorOnly = applyReleaseFilter(parsed, {
      mode: 'major',
      pattern: '',
    }).parsed;
    const beforeMinor = majorOnly.phases.find(
      (p) => p.kind === 'ff' && p.release === '26.3.130',
    )!.date;
    expect(catchRelease(beforeMinor, majorOnly)?.release).toBe('26.3.130');
  });

  it('builds a persistable config from rows', () => {
    const cfg = buildReleaseSheetConfig({
      url: 'https://docs.google.com/spreadsheets/d/1sWRtByTquVLKeyv_kQG7nkSjP6-JBbSbNIVv4I3UzTM/edit',
      sheetName: '2026 phases',
      range: 'A1:C500',
      splitPhase: 'ff',
      showPhases: ['ff', 'stage', 'pro'],
      releaseFilter: { mode: 'major', pattern: '' },
      rows,
    });
    expect(cfg?.spreadsheetId).toBe(
      '1sWRtByTquVLKeyv_kQG7nkSjP6-JBbSbNIVv4I3UzTM',
    );
    expect(cfg?.splitPhase).toBe('ff');
    expect(cfg?.showPhases).toEqual(['ff', 'stage', 'pro']);
    expect(cfg?.releaseFilter).toEqual({ mode: 'major', pattern: '' });
    expect(cfg?.rows).toHaveLength(rows.length);
    expect(relParsed(cfg!).releases.map((r) => r.name)).toEqual([
      '26.3.130',
      '26.3.140',
    ]);
  });

  it('filters major / wildcard / regex with safe fallbacks', () => {
    expect(isMajorRelease('26.3.320')).toBe(true);
    expect(isMajorRelease('26.3.325')).toBe(false);
    expect(isMajorRelease('RIO 26.1.112')).toBe(false);

    const parsed = parseReleaseRows(rows);
    const major = applyReleaseFilter(parsed, { mode: 'major', pattern: '' });
    expect(major.parsed.releases.map((r) => r.name)).toEqual([
      '26.3.130',
      '26.3.140',
    ]);
    expect(major.dropped).toEqual(['26.3.135', 'RIO 26.3.141']);

    const wild = applyReleaseFilter(parsed, {
      mode: 'custom',
      pattern: '*0, RIO *',
    });
    expect(wild.parsed.releases.map((r) => r.name)).toEqual([
      '26.3.130',
      '26.3.140',
      'RIO 26.3.141',
    ]);

    const re = releaseMatcher('/\\d0$/');
    expect(re?.('26.3.130')).toBe(true);
    expect(re?.('26.3.135')).toBe(false);

    const bad = applyReleaseFilter(parsed, {
      mode: 'custom',
      pattern: '/(/',
    });
    expect(bad.invalid).toBe(true);
    expect(bad.parsed.releases).toHaveLength(parsed.releases.length);

    const empty = applyReleaseFilter(parsed, {
      mode: 'custom',
      pattern: 'NOPE*',
    });
    expect(empty.empty).toBe(true);
    expect(empty.parsed.releases).toHaveLength(parsed.releases.length);

    expect(normFilter({ mode: 'custom', pattern: '' })).toEqual({
      mode: 'all',
      pattern: '',
    });
  });
});
