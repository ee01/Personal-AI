import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import type { PersonalMemoryEvent, ProbePoint, StorylineIndex } from "../types.js";

export async function loadEventsJsonl(path: string): Promise<PersonalMemoryEvent[]> {
  const events: PersonalMemoryEvent[] = [];
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    events.push(JSON.parse(trimmed) as PersonalMemoryEvent);
  }
  events.sort((a, b) => {
    const ta = Date.parse(a.observed_at);
    const tb = Date.parse(b.observed_at);
    if (ta !== tb) return ta - tb;
    return (a.replay_seq ?? 0) - (b.replay_seq ?? 0);
  });
  return events;
}

export async function loadStorylineIndex(path: string): Promise<StorylineIndex> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as StorylineIndex;
}

export async function loadProbesJsonl(path: string): Promise<ProbePoint[]> {
  const probes: ProbePoint[] = [];
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    probes.push(JSON.parse(trimmed) as ProbePoint);
  }
  return probes;
}
