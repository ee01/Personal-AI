import type { PersonalMemoryEvent } from "../../src/types.js";
import { parseVirtualMs } from "../../src/clock/virtual-time.js";
import { contentHash } from "./hash.js";

export function resolveSourceVersion(event: PersonalMemoryEvent): string {
  const fromProv = event.provenance?.source_version;
  if (typeof fromProv === "string" && fromProv.length > 0) return fromProv;
  return contentHash(event.text, event.source, event.event_id);
}

export function validateIngestEnvelope(event: PersonalMemoryEvent): void {
  if (event.scope !== event.acl.scope) {
    throw new Error("SCOPE_ACL_MISMATCH");
  }
}

export function observedMs(event: PersonalMemoryEvent): number {
  return parseVirtualMs(event.observed_at);
}

export function occurredMs(event: PersonalMemoryEvent): number | null {
  if (!event.occurred_at) return null;
  return parseVirtualMs(event.occurred_at);
}

export class VersionConflictError extends Error {
  constructor(eventId: string) {
    super(`VERSION_CONFLICT:${eventId}`);
    this.name = "VersionConflictError";
  }
}
