# Rehearsal Boundary Qualification Findings

## Initial Selection

- Randomly selected feature: `场景预演边界`.
- Area: Rehearsal.
- Feature doc: `docs/features/rehearsal.md`.
- Index description: scene type is open; the detail page should first use scene qualification overview to confirm future cue, live prompt eligibility, and no-automatic-execution boundary.

## Reminder Findings

- AppleScript list enumeration returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`.
- EventKit returned `Personal AI` with 4 items, all completed.
- The completed items are about Doubao memory sync / Weekly Dream Digest / notification sync, not Rehearsal scene boundaries.
- No Reminder item is used as source input or marked done in this run.

## Code And UX Findings

- `docs/features/rehearsal.md` is broadly current: it describes the future cue boundary, API rejection for no cue, display gate, Memory Lens / Compose Assist / Today Pilot consumers, list scope receipts, empty receipts, deep-link fallback, action receipts, and detail `场景资格总览`.
- `src/modals/components/RehearsalsPage.vue` already shows list cards, a list-scope receipt, `场景资格总览`, `命中诊断`, no-cue warnings, write-failure receipts, and deep-link recovery receipts.
- Current gap: any non-empty cue is treated as future-scene eligible. Active Rehearsals with only broad `topics` / `keywords` / `surfaces` can look as reliable as Rehearsals anchored by people, projects, conversations, meetings, issues, or URLs.
- Low-risk improvement: add cue-strength presentation only. This should not change Memory Service matching, status mutation, context recall, or feedback contracts.

## External Reference Findings

- OpenAI's Scheduled Tasks page emphasizes a dedicated management surface, improved creation/editing flows, better notifications, and monitoring tasks that notify only when something worth reporting changes.
- Apple Reminders supports natural-language reminders by time/place and links back to another app or website, reinforcing that cue type and return path matter.
- Brewer/Morris/Lindley's digital reminder study found that many future remembering needs are not covered by simple time/place reminders, especially information to retrieve in later conversations.
- Recent context-aware reminder authoring research shows natural-language reminder intent is diverse and often underspecified; systems need transparent structured trigger logic and user control.
- TriggerBench frames prospective memory as proactive recall under future triggers and highlights false-alarm / attentional-fragility risk, which supports warning on weak-only cues instead of treating broad keywords as stable anchors.
