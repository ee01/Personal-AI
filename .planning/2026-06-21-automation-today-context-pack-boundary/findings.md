# Today Pilot Context Pack Findings

## Initial Context

- Randomly selected feature from `docs/index.md`: `Context Pack`.
- Feature owner/capability: Today Pilot.
- Source document: `docs/features/today_pilot.md`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; there are no local Reminder items to incorporate or complete for this feature in this run.
- Worktree is broadly dirty from prior user/automation work. Keep this run scoped to Today Pilot Context Pack plus this planning directory and automation memory.

## Code And UX Findings

- `docs/features/today_pilot.md` is mostly current for Context Pack: it documents deterministic evidence-based generation, no external auto-send, OpenClaw execution-card suppression, failure receipts, copy receipts, `sourceSummary`, ambient calibration trace, and handoff boundary text.
- Today Pilot home implementation lives in `src/modals/components/OverviewPage.vue`. It can generate, preview, and copy packs; copy waits for `loadContextPack()` and does not fall back to card summary when generation fails.
- Backend rendering lives in `memory-service/src/core/DayPilotService.ts` behind `POST /today-pilot/missions/:id/context-pack`; tests already assert `Source Scope`, `Handoff Boundary`, redaction metadata, truncation metadata, user isolation, and source summaries.
- Existing gap: before generating/copying a pack, the home UI shows provider buttons and a sensitive-content toggle, but it does not show a first-row pre-action receipt explaining that choosing a provider/toggle only changes local render settings and that `生成/复制` does not send to Codex, ChatGPT, Claude, Doubao, or approve external action. The boundary appears after generation/copy, which is late for a privacy-sensitive toggle.
- Popup copy has a compact receipt after copy but no pre-copy scope line. Because popup is constrained and has no sensitive toggle, the first implementation slice should focus on the richer Today Pilot home card.

## External Reference Findings

- ChatGPT Projects lets users add files/app links as project sources and says connected apps may ask for confirmation before searching outside the project. This supports making source/context handoff boundaries visible before invoking a pack render.
- Microsoft 365 Copilot Pages turns AI responses into editable, shareable, persistent work products and frames sharing/reuse as user-controlled, not automatic execution. This supports treating Context Pack as a user-reviewed artifact before external use.
- Anthropic context-engineering guidance frames context as the curated token state available to the model; quality depends on what information is selected and maintained, not only prompt wording.
- The 2026 context-engineering paper emphasizes relevance, sufficiency, isolation, economy, and provenance as context quality criteria. Today Pilot already has source summaries; the UX gap is surfacing isolation/provenance before action.
- IBM CHI 2025 RAG transparency research reports that source attribution and user control improved trust and understanding more than confidence scores alone. Context Pack should emphasize source coverage/control before copy.
