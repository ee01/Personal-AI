/** Paired bootstrap 95% CI for storyline-level means (macro over storylines). */
export function bootstrapStorylineCi(
  valuesByStoryline: Map<string, number[]>,
  iterations = 2000,
  seed = 42,
): { mean: number; ci_low: number; ci_high: number; n_storylines: number } {
  const storylines = [...valuesByStoryline.keys()];
  if (storylines.length === 0) {
    return { mean: 0, ci_low: 0, ci_high: 0, n_storylines: 0 };
  }

  const rng = mulberry32(seed);
  const means: number[] = [];

  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (let j = 0; j < storylines.length; j++) {
      const key = storylines[Math.floor(rng() * storylines.length)]!;
      const vals = valuesByStoryline.get(key)!;
      const pick = vals[Math.floor(rng() * vals.length)]!;
      sum += pick;
    }
    means.push(sum / storylines.length);
  }

  means.sort((a, b) => a - b);
  const mean = means.reduce((a, b) => a + b, 0) / means.length;
  const lo = means[Math.floor(0.025 * means.length)] ?? 0;
  const hi = means[Math.floor(0.975 * means.length)] ?? 0;
  return { mean, ci_low: lo, ci_high: hi, n_storylines: storylines.length };
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function storylineBucketsFromOutcomes(
  outcomes: Array<{ probe: { storyline_key: string }; composite: number }>,
): Map<string, number[]> {
  const m = new Map<string, number[]>();
  for (const o of outcomes) {
    const k = o.probe.storyline_key;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(o.composite);
  }
  return m;
}
