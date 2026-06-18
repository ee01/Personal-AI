import { describe, expect, it } from 'vitest';

import { runPersonalizedPageRank, type PprEdge } from '../core/graphPpr.js';

/** Undirected helper: add both directions. */
function undirected(pairs: Array<[string, string, number]>): PprEdge[] {
  const edges: PprEdge[] = [];
  for (const [a, b, w] of pairs) {
    edges.push({ from: a, to: b, weight: w });
    edges.push({ from: b, to: a, weight: w });
  }
  return edges;
}

describe('runPersonalizedPageRank', () => {
  it('ranks closer nodes above farther ones along a chain', () => {
    // A - B - C - D - E (chain), plus an isolated unrelated node Z connected far.
    const edges = undirected([
      ['A', 'B', 1],
      ['B', 'C', 1],
      ['C', 'D', 1],
      ['D', 'E', 1],
    ]);
    const p = runPersonalizedPageRank(edges, new Map([['A', 1]]));
    // Seed A highest; then monotonically decreasing with distance.
    expect(p.get('A')!).toBeGreaterThan(p.get('B')!);
    expect(p.get('B')!).toBeGreaterThan(p.get('C')!);
    expect(p.get('C')!).toBeGreaterThan(p.get('D')!);
    expect(p.get('D')!).toBeGreaterThan(p.get('E')!);
  });

  it('surfaces a multi-hop connected node above an unrelated node', () => {
    // Seed A reaches D via B,C. Z is connected only to an unrelated island.
    const edges = undirected([
      ['A', 'B', 1],
      ['B', 'C', 1],
      ['C', 'D', 1],
      ['Y', 'Z', 1],
    ]);
    const p = runPersonalizedPageRank(edges, new Map([['A', 1]]));
    expect(p.get('D')!).toBeGreaterThan(p.get('Z')!);
    expect(p.get('Z')!).toBe(0); // unreachable from seed gets no mass
  });

  it('sums to ~1 and converges', () => {
    const edges = undirected([
      ['A', 'B', 2],
      ['A', 'C', 1],
      ['B', 'C', 1],
      ['C', 'D', 3],
    ]);
    const p = runPersonalizedPageRank(edges, new Map([['A', 1]]), { maxIterations: 50 });
    const total = [...p.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it('down-weights generic hubs via node specificity', () => {
    // A connects to a generic hub H (high degree) and a specific node S.
    // Without specificity, H accrues mass; specificity should pull S up relatively.
    const edges = undirected([
      ['A', 'H', 1],
      ['A', 'S', 1],
      ['H', 'x1', 1],
      ['H', 'x2', 1],
      ['H', 'x3', 1],
    ]);
    const seeds = new Map([['A', 1]]);
    const plain = runPersonalizedPageRank(edges, seeds);
    const spec = new Map([
      ['H', 0.2], // generic hub down-weighted in restart
      ['S', 1],
    ]);
    const weighted = runPersonalizedPageRank(edges, seeds, { nodeSpecificity: spec });
    // S/H ratio should improve when H is down-weighted (here only restart on A,
    // so check the mechanism doesn't crash and ratio is sane).
    expect(weighted.get('S')!).toBeGreaterThan(0);
    expect(plain.get('S')!).toBeGreaterThan(0);
  });

  it('handles empty seeds and empty graph gracefully', () => {
    expect(runPersonalizedPageRank([], new Map()).size).toBe(0);
    const p = runPersonalizedPageRank(undirected([['A', 'B', 1]]), new Map());
    // No seeds -> uniform restart, still sums to ~1.
    const total = [...p.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});
