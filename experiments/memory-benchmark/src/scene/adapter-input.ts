import type { DecideInput, ProbePoint, RecallQuery, SceneInput } from "../types.js";

/** Golden / rubric fields that must never reach adapter decide/recall. */
export const PROBE_GOLDEN_FIELD_NAMES = [
  "required_facts",
  "visible_evidence_ids",
  "forbidden_assertions",
  "should_trigger",
  "expected_silence",
  "silence_reason",
  "allowed_actions",
  "target_object",
  "trigger_window",
  "latency_budget_ms",
] as const;

const SCENE_INPUT_KEYS = new Set<keyof SceneInput>([
  "scene_id",
  "text",
  "entity_ids",
  "thread_id",
  "group_id",
  "recall_query",
]);

export function assertSceneInputOnly(context: Record<string, unknown>): SceneInput {
  for (const key of Object.keys(context)) {
    if ((PROBE_GOLDEN_FIELD_NAMES as readonly string[]).includes(key)) {
      throw new Error(`golden_field_leaked_to_adapter:${key}`);
    }
    if (!SCENE_INPUT_KEYS.has(key as keyof SceneInput)) {
      throw new Error(`scene_context_not_allowlisted:${key}`);
    }
  }
  return context as SceneInput;
}

export function buildAdapterDecideInput(probe: ProbePoint): DecideInput {
  const context = assertSceneInputOnly({ ...probe.scene_input });
  return {
    scene: probe.scene,
    as_of: probe.as_of,
    scope: probe.scope,
    context,
  };
}

export function buildAdapterRecallQuery(probe: ProbePoint): RecallQuery {
  const ctx = probe.scene_input;
  const text = (ctx.recall_query ?? ctx.text ?? ctx.scene_id ?? probe.storyline_key).trim();
  return { text, scope: probe.scope };
}

export function probeCheckpointKind(
  probe: ProbePoint,
): "pre_consolidation" | "post_consolidation" {
  return probe.checkpoint ?? "post_consolidation";
}
