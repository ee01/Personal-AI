import type { PersonalMemoryEvent } from "../types.js";

/** UTC calendar day key YYYY-MM-DD from an ISO timestamp. */
export function virtualDayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function parseVirtualMs(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid ISO timestamp: ${iso}`);
  return ms;
}

export function isVisibleAt(event: PersonalMemoryEvent, virtualNow: string): boolean {
  return parseVirtualMs(event.observed_at) <= parseVirtualMs(virtualNow);
}

export function filterVisibleEvents(
  events: PersonalMemoryEvent[],
  virtualNow: string,
): PersonalMemoryEvent[] {
  return events.filter((e) => isVisibleAt(e, virtualNow));
}
