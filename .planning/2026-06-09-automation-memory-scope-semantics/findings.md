# Memory Scope Semantics Findings

## Initial Context

- Randomly selected feature from `docs/features/index.md`: `工作/个人/全部范围语义`.
- Feature owner/capability: Memory Service.
- Source document: `docs/features/memory_system.md`.
- Carry-over check: `docs/progressing/to-verify.md` says `暂无。`.
- Local Reminders list scan returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No visible Reminders list named `Personal AI`; no local Reminder feedback can be incorporated or completed for this feature in this run.
- The worktree has many unrelated dirty files from prior work. Treat all pre-existing changes as user/automation-owned and avoid reverting them.

## Open Findings

- `docs/features/memory_system.md` matches the current core contract: `/recall` and `/ask` accept `work` / `personal` / `both` / `all`, active recall defaults to `work`, passive `/context-recall` defaults to `all`, and client `both` links normalize to `all`.
- The search page already shows the current scope, per-result scope badges, scope breakdown, channel diagnostics, cross-personal exposure notice for `all`, and an empty-state `搜索全部记忆` action.
- UX gap: when a default `work` search returns some results, the page does not explicitly say that personal evidence was excluded or provide a direct broaden action. Users only see the broaden path after empty results, which can make partial work-only evidence look complete.
- The narrow implementation slice is a compact scope-boundary receipt in the results summary for `work` / `personal` searches, with a direct `搜索全部记忆` action when a query is present.

## External Reference Findings

- OpenAI's ChatGPT Memory help emphasizes that users can review, delete, disable, and provide feedback on memory, supporting visible user control over what is being used.
- Anthropic's Claude memory launch/help materials emphasize optional memory and granular controls; Claude Managed Agents memory also calls out scoped permissions, audit logs, and programmatic control.
- Microsoft 365 Copilot semantic indexing states that indexing does not change existing access permissions, reinforcing that retrieval UX should preserve and explain boundary conditions rather than silently widening them.
- Personal Information Management research frames retrieval around multiple life roles and work/non-work goals, which supports making `work` vs `personal` scope explicit at search time.
- Memory Sandbox and recent long-term memory/privacy work argue for transparent, interactive memory management and user agency, supporting a receipt/action rather than an invisible default.
