/**
 * Personalized PageRank for associative graph recall (P0-3).
 *
 * Background: HippoRAG (NeurIPS'24) frames the entity graph as a hippocampal
 * index and uses Personalized PageRank to do single-pass "pattern completion"
 * — surfacing entities that are graph-connected to the query's seed entities,
 * even when they're 2-3 hops away and not lexically/semantically similar. This
 * is the retrieval substrate for the cross-source "weave" that plain vector
 * recall misses.
 *
 * This module is pure (no DB) so it is unit-testable in isolation. The
 * RecallEngine builds a bounded subgraph around the seeds and calls runPpr.
 */

export interface PprEdge {
  from: string;
  to: string;
  weight: number;
}

export interface PprOptions {
  /**
   * Damping factor (probability of following an edge vs teleporting back to the
   * seeds). Default 0.5 — restart-heavy, like HippoRAG, so PPR stays near the
   * query's seed entities rather than drifting to globally central hubs.
   */
  damping?: number;
  /** Max power-iteration steps. Default 20. */
  maxIterations?: number;
  /** L1 convergence tolerance. Default 1e-6. */
  tolerance?: number;
  /**
   * Per-node specificity multiplier applied to the restart distribution
   * (HippoRAG's IDF analogue: down-weight high-degree generic hubs). Default 1.
   */
  nodeSpecificity?: Map<string, number>;
}

/**
 * Run Personalized PageRank.
 *
 * @param edges     directed edges (caller adds both directions for an
 *                  undirected approximation). Non-positive weights are ignored.
 * @param seedWeights restart mass per seed node (need not be normalized).
 * @returns a map of node id -> stationary probability (sums to ~1).
 */
export function runPersonalizedPageRank(
  edges: PprEdge[],
  seedWeights: Map<string, number>,
  options: PprOptions = {},
): Map<string, number> {
  const damping = options.damping ?? 0.5;
  const maxIterations = options.maxIterations ?? 20;
  const tolerance = options.tolerance ?? 1e-6;
  const spec = options.nodeSpecificity;

  // --- Build node index ---
  const idToIdx = new Map<string, number>();
  const nodes: string[] = [];
  const ensure = (id: string): number => {
    let idx = idToIdx.get(id);
    if (idx === undefined) {
      idx = nodes.length;
      idToIdx.set(id, idx);
      nodes.push(id);
    }
    return idx;
  };
  for (const id of seedWeights.keys()) ensure(id);
  const outAdj: Array<Array<{ to: number; w: number }>> = [];
  const outSum: number[] = [];
  const touch = (idx: number) => {
    while (outAdj.length <= idx) {
      outAdj.push([]);
      outSum.push(0);
    }
  };
  for (const e of edges) {
    if (!(e.weight > 0)) continue;
    const u = ensure(e.from);
    const v = ensure(e.to);
    touch(u);
    touch(v);
    outAdj[u].push({ to: v, w: e.weight });
    outSum[u] += e.weight;
  }
  const n = nodes.length;
  if (n === 0) return new Map();
  touch(n - 1);

  // --- Restart distribution r (seedWeight * specificity, normalized) ---
  const r = new Float64Array(n);
  let rSum = 0;
  for (const [id, w] of seedWeights) {
    const idx = idToIdx.get(id)!;
    const s = spec?.get(id) ?? 1;
    const val = Math.max(0, w) * (s > 0 ? s : 1);
    r[idx] += val;
    rSum += val;
  }
  if (rSum <= 0) {
    // No usable seed mass — fall back to uniform restart.
    for (let i = 0; i < n; i++) r[i] = 1 / n;
  } else {
    for (let i = 0; i < n; i++) r[i] /= rSum;
  }

  // --- Power iteration ---
  let p = Float64Array.from(r);
  for (let iter = 0; iter < maxIterations; iter++) {
    const next = new Float64Array(n);
    for (let i = 0; i < n; i++) next[i] = (1 - damping) * r[i];

    let danglingMass = 0;
    for (let u = 0; u < n; u++) {
      if (outSum[u] <= 0) {
        danglingMass += p[u];
        continue;
      }
      const share = damping * p[u];
      for (const { to, w } of outAdj[u]) {
        next[to] += share * (w / outSum[u]);
      }
    }
    // Redistribute dangling mass along the restart vector.
    if (danglingMass > 0) {
      const dm = damping * danglingMass;
      for (let i = 0; i < n; i++) next[i] += dm * r[i];
    }

    let diff = 0;
    for (let i = 0; i < n; i++) diff += Math.abs(next[i] - p[i]);
    p = next;
    if (diff < tolerance) break;
  }

  const result = new Map<string, number>();
  for (let i = 0; i < n; i++) result.set(nodes[i], p[i]);
  return result;
}
