/** Phase 1 personal memory event (aligns with memory-service/evals/personal-memory-dataset/schema.json). */
export interface PersonalMemoryEvent {
  event_id: string;
  source: string;
  source_type: string;
  occurred_at: string;
  observed_at: string;
  scope: string;
  group_id: string | null;
  thread_root: string | null;
  sender: string | null;
  text: string;
  metadata: Record<string, unknown>;
  acl: { scope: string; trust_class: string | null };
  provenance: Record<string, unknown>;
  replay_seq?: number;
}

export interface StorylineIndex {
  definition?: string;
  totals?: Record<string, number>;
  storylines: Array<{
    storyline_key: string;
    message_count: number;
    min_occurred_at: string;
    max_occurred_at: string;
    sample_event_ids: string[];
    tags?: string[];
  }>;
}

export type ProbeScene =
  | "message_sidecar"
  | "meeting_transcript"
  | "proactive_discovery"
  | "proactive_ask";

export type AllowedAction =
  | "silence"
  | "show_sidecar"
  | "send_notification"
  | "ask_user"
  | "contact_peer";

/** Adapter-visible scene payload (no golden / rubric fields). */
export interface SceneInput {
  scene_id?: string;
  /** Current message, notification trigger, or discovery cue text. */
  text?: string;
  entity_ids?: string[];
  thread_id?: string | null;
  group_id?: string | null;
  /** Optional recall query override; must not encode golden answers. */
  recall_query?: string;
}

/** Frozen probe / judgment point (160-point design; fixtures use a subset). */
export interface ProbePoint {
  probe_id: string;
  storyline_key: string;
  scene: ProbeScene;
  /** Virtual business time — query and visibility use this as `as_of`. */
  as_of: string;
  scope: string;
  /** Scene fixture passed to adapter decide/recall (golden stays on ProbePoint for scorer). */
  scene_input: SceneInput;
  /** Which replay checkpoint runs this probe (default post_consolidation). */
  checkpoint?: "pre_consolidation" | "post_consolidation";
  /** Event IDs that must be visible at as_of (hard gate). */
  visible_evidence_ids: string[];
  /** Substrings or fact keys that must appear in output when should_trigger. */
  required_facts: string[];
  /** Substrings that must not appear (hard gate when violated). */
  forbidden_assertions: string[];
  allowed_actions: AllowedAction[];
  target_object?: string;
  /** ISO interval [start, end] for valid trigger timing. */
  trigger_window: { start: string; end: string };
  should_trigger: boolean;
  silence_reason?: string;
  /** Latency budget ms for L dimension (scene-specific). */
  latency_budget_ms: number;
}

export interface RecallQuery {
  text: string;
  scope: string;
}

export interface RecallHit {
  event_id?: string;
  text: string;
  observed_at?: string;
  scope?: string;
}

export interface RecallResult {
  hits: RecallHit[];
  latency_ms: number;
  cached_replay?: boolean;
}

export interface DecideInput {
  scene: ProbeScene;
  as_of: string;
  scope: string;
  /** Scene payload (allowlisted fields only — no golden). */
  context: SceneInput;
}

export interface DecideResult {
  action: AllowedAction;
  /** User-visible payload (card text, notification body, question). */
  output_text: string;
  cited_event_ids: string[];
  latency_ms: number;
  cached_replay?: boolean;
}

export interface ConsolidateResult {
  virtual_day: string;
  latency_ms: number;
  cached_replay?: boolean;
}

export interface MemoryBenchmarkAdapter {
  readonly schemeId: string;
  ingest(event: PersonalMemoryEvent): Promise<void>;
  consolidate(virtualNow: string): Promise<ConsolidateResult>;
  recall(query: RecallQuery, asOf: string, scope: string): Promise<RecallResult>;
  decide(input: DecideInput): Promise<DecideResult>;
  export(): Promise<Record<string, unknown>>;
  delete(eventId: string): Promise<void>;
  revoke(scope: string): Promise<void>;
}

export interface LlmUsageRecord {
  label: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  cached_replay: boolean;
  at_virtual: string;
}

export interface CostBudget {
  max_usd: number;
}

export interface ProbeRunOutcome {
  probe: ProbePoint;
  decide: DecideResult;
  recall?: RecallResult;
  scores: DimensionScores;
  composite: number;
  hard_gate_failures: string[];
  passed: boolean;
}

export interface DimensionScores {
  F: number;
  E: number;
  D: number;
  N: number;
  L: number;
}

export interface BenchmarkReport {
  scheme_id: string;
  run_id: string;
  mode: "quality" | "capacity";
  fixture_id: string;
  events_ingested: number;
  consolidations: number;
  probes_run: number;
  probes_passed: number;
  hard_gate_failures: number;
  mean_composite: number;
  scene_means: Record<string, number>;
  cost: CostSummary;
  latency: LatencySummary;
  outcomes: ProbeRunOutcome[];
  stopped_reason?: string;
}

export interface CostSummary {
  /** Harness CostTracker only (judge / future harness LLM). */
  harness_usd: number;
  /** Adapter export `cost_ledger` (scheme B file ledger, C/D/E harness_consolidation, etc.). */
  adapter_usd: number;
  /** harness_usd + adapter_usd; E-155 $50 cap uses this. */
  combined_usd: number;
  /** @deprecated Use combined_usd; kept for JSON consumers expecting total_usd. */
  total_usd: number;
  budget_usd: number;
  llm_calls: number;
  input_tokens: number;
  output_tokens: number;
  cached_replay_calls: number;
  live_inference_calls: number;
  /** When service-side usage is not in adapter ledger (e.g. Supermemory Local). */
  reconciliation_note?: string;
}

export interface LatencySummary {
  ingest_p50_ms: number;
  ingest_p95_ms: number;
  ingest_p99_ms: number;
  decide_p50_ms: number;
  decide_p95_ms: number;
  decide_p99_ms: number;
}
