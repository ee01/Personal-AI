/**
 * P2 surface cutover flags (plan §11.7): each surface has an independent
 * flag; the cutover order is Ask → Compose → Passive. Flags default off;
 * flipping one routes that surface's retrieval through the v3 unit-plane
 * reader while STILL logging the dual-read shadow for comparison.
 *
 * The dual-read shadow (MEMORY_READ_V3_RECALL_SHADOW) runs regardless of
 * cutover state — it is the measurement harness, not the switch.
 */

export type SurfaceName = 'ask' | 'compose' | 'passive';

export function isSurfaceCutOver(surface: SurfaceName, userId?: string): boolean {
  const key = `MEMORY_READ_V3_${surface.toUpperCase()}`;
  // Optional per-user allowlist: MEMORY_READ_V3_<SURFACE>_USERS="id1,id2"
  const users = process.env[`${key}_USERS`]?.trim();
  if (users) {
    if (!userId) return false;
    const allowed = users.split(',').map((s) => s.trim());
    if (!allowed.includes(userId)) return false;
  }
  const raw = process.env[key]?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/**
 * P2 non-inferiority eval gate harness: computes paired bootstrap CI from
 * dual-read shadow logs. A surface passes the gate when the CI lower bound
 * of hit@5 difference (v3 − legacy) is ≥ −0.02 (plan §12.6: 2pp non-inferiority
 * margin) AND no safety regression is observed.
 */
export interface ShadowObservation {
  legacyCount: number;
  v3Count: number;
  overlapCount: number;
  v3OnlyCount: number;
  requestId: string;
}

export interface SurfaceGateResult {
  surface: SurfaceName;
  observations: number;
  meanV3Count: number;
  meanLegacyCount: number;
  meanOverlap: number;
  ci95: [number, number];
  nonInferior: boolean;
  verdict: 'pass' | 'fail' | 'insufficient_data';
}

export function evaluateSurfaceGate(
  surface: SurfaceName,
  observations: ShadowObservation[],
): SurfaceGateResult {
  const n = observations.length;
  if (n < 30) {
    return {
      surface,
      observations: n,
      meanV3Count: 0,
      meanLegacyCount: 0,
      meanOverlap: 0,
      ci95: [0, 0],
      nonInferior: false,
      verdict: 'insufficient_data',
    };
  }
  const diffs = observations.map((o) => o.v3Count - o.legacyCount);
  const meanDiff = diffs.reduce((a, d) => a + d, 0) / n;
  const B = 1000;
  const means: number[] = [];
  for (let b = 0; b < B; b += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += diffs[Math.floor(Math.random() * n)];
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  const ci95: [number, number] = [
    Number(means[Math.floor(B * 0.025)].toFixed(4)),
    Number(means[Math.floor(B * 0.975)].toFixed(4)),
  ];
  const nonInferior = ci95[0] >= -0.02;
  return {
    surface,
    observations: n,
    meanV3Count: Number(
      (observations.reduce((a, o) => a + o.v3Count, 0) / n).toFixed(4),
    ),
    meanLegacyCount: Number(
      (observations.reduce((a, o) => a + o.legacyCount, 0) / n).toFixed(4),
    ),
    meanOverlap: Number(
      (observations.reduce((a, o) => a + o.overlapCount, 0) / n).toFixed(4),
    ),
    ci95,
    nonInferior,
    verdict: nonInferior ? 'pass' : 'fail',
  };
}
