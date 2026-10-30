import type {
  DecideResult,
  DimensionScores,
  PersonalMemoryEvent,
  ProbePoint,
  RecallResult,
} from "../types.js";
import { parseVirtualMs } from "../clock/virtual-time.js";

function f1(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

export interface HardGateContext {
  eventsById: Map<string, PersonalMemoryEvent>;
  revokedScopes: Set<string>;
  deletedEventIds: Set<string>;
}

export function checkHardGates(
  probe: ProbePoint,
  decide: DecideResult,
  recall: RecallResult | undefined,
  ctx: HardGateContext,
): string[] {
  const failures: string[] = [];
  const asOfMs = parseVirtualMs(probe.as_of);

  for (const id of probe.visible_evidence_ids) {
    const ev = ctx.eventsById.get(id);
    if (!ev) {
      failures.push(`missing_evidence:${id}`);
      continue;
    }
    if (parseVirtualMs(ev.observed_at) > asOfMs) {
      failures.push(`future_evidence_leak:${id}`);
    }
    if (ctx.deletedEventIds.has(id)) {
      failures.push(`deleted_evidence_cited:${id}`);
    }
    if (ctx.revokedScopes.has(ev.scope)) {
      failures.push(`revoked_scope_evidence:${id}`);
    }
  }

  for (const cited of decide.cited_event_ids) {
    const ev = ctx.eventsById.get(cited);
    if (ev && parseVirtualMs(ev.observed_at) > asOfMs) {
      failures.push(`future_citation:${cited}`);
    }
    if (ctx.deletedEventIds.has(cited)) {
      failures.push(`deleted_still_returned:${cited}`);
    }
  }

  if (recall) {
    for (const hit of recall.hits) {
      if (!hit.event_id) continue;
      const ev = ctx.eventsById.get(hit.event_id);
      if (ev && parseVirtualMs(ev.observed_at) > asOfMs) {
        failures.push(`future_recall_leak:${hit.event_id}`);
      }
      if (ctx.deletedEventIds.has(hit.event_id)) {
        failures.push(`deleted_still_in_recall:${hit.event_id}`);
      }
    }
  }

  for (const forbidden of probe.forbidden_assertions) {
    if (forbidden && decide.output_text.toLowerCase().includes(forbidden.toLowerCase())) {
      failures.push(`forbidden_assertion:${forbidden}`);
    }
  }

  if (!probe.allowed_actions.includes(decide.action)) {
    failures.push(`action_not_allowed:${decide.action}`);
  }

  return failures;
}

export function scoreProbe(
  probe: ProbePoint,
  decide: DecideResult,
  recall: RecallResult | undefined,
): { scores: DimensionScores; composite: number } {
  const output = decide.output_text;
  const triggered = decide.action !== "silence" && output.trim().length > 0;
  const inWindow =
    parseVirtualMs(probe.as_of) >= parseVirtualMs(probe.trigger_window.start) &&
    parseVirtualMs(probe.as_of) <= parseVirtualMs(probe.trigger_window.end);

  let F: number;
  if (!probe.should_trigger) {
    F = triggered ? 0 : 1;
  } else if (!triggered) {
    F = 0;
  } else {
    const hitCount = probe.required_facts.filter((f) =>
      output.toLowerCase().includes(f.toLowerCase()),
    ).length;
    const factRecall = probe.required_facts.length
      ? hitCount / probe.required_facts.length
      : 1;
    const factPrecision = probe.forbidden_assertions.some((f) =>
      output.toLowerCase().includes(f.toLowerCase()),
    )
      ? 0
      : 1;
    F = f1(factPrecision, factRecall);
  }

  let E: number;
  if (!probe.should_trigger) {
    E = triggered && decide.cited_event_ids.length === 0 ? 0 : 1;
  } else {
    const citedRequired = probe.visible_evidence_ids.filter((id) =>
      decide.cited_event_ids.includes(id),
    ).length;
    const evidenceRecall = probe.visible_evidence_ids.length
      ? citedRequired / probe.visible_evidence_ids.length
      : 1;
    const validCitations = decide.cited_event_ids.filter((id) =>
      probe.visible_evidence_ids.includes(id),
    ).length;
    const evidencePrecision = decide.cited_event_ids.length
      ? validCitations / decide.cited_event_ids.length
      : evidenceRecall > 0
        ? 1
        : 0;
    E = f1(evidencePrecision, evidenceRecall);
    if (triggered && decide.cited_event_ids.length === 0) E = 0;
  }

  const shouldFire = probe.should_trigger && inWindow;
  let D: number;
  if (shouldFire) {
    const actionOk = probe.allowed_actions.includes(decide.action);
    const targetOk = probe.target_object
      ? output.toLowerCase().includes(probe.target_object.toLowerCase())
      : true;
    D = triggered && actionOk && targetOk ? 1 : 0;
  } else {
    D = triggered ? 0 : 1;
  }

  let N: number;
  if (!probe.should_trigger) {
    N = triggered ? 0 : 1;
  } else {
    N = triggered ? 1 : 0;
  }

  const L =
    decide.latency_ms <= probe.latency_budget_ms &&
    (recall ? recall.latency_ms <= probe.latency_budget_ms : true)
      ? 1
      : 0;

  const scores: DimensionScores = { F, E, D, N, L };
  const composite = 100 * (0.3 * F + 0.25 * E + 0.25 * D + 0.1 * N + 0.1 * L);
  return { scores, composite };
}
