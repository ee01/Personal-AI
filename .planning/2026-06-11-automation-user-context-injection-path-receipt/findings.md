# Findings

## Local State

- `docs/progressing/to-verify.md` has no carry-over work.
- Local Reminders lists are readable: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- No `Personal AI` Reminders list exists, so no feedback item is available to incorporate or mark done.
- `docs/features/custom_prompts.md`, `src/modals/prompt-config.tsx`, `src/services/userConfigPreview.ts`, and `tools/verify-custom-prompts*` already contain prior uncommitted Prompt Config work. Do not revert it.

## Product And Research Signals

- OpenAI Custom Instructions: users can edit/delete custom instructions for future conversations, disable customization, and the feature has explicit data-sharing cautions for third-party plugins.
- Claude memory: users can see and edit memory, pause or reset memory, and Claude separates project memory from standalone chat memory.
- LaMP / personalization retrieval: personalized user-profile items should be selected for the current user/task instead of dumping every profile item into context.
- User-profile personalization analysis: semantic similarity alone is weaker than personalization information; the useful product affordance is showing what profile/context category is being applied, not only token volume.
- OWASP LLM01: prompt-injection defenses include clear segregation of untrusted/user-provided content and least-privilege/human approval for high-risk actions.

## Improvement Decision

The current feature already has global/source toggles, scope preview, save-impact receipt, and low-priority prompt wrapping. The remaining UX gap is local to editing: while users are filling personal/team/work/communication/analysis fields, the page does not immediately say which scope those fields affect or whether the current user-context source is paused. Add a lightweight per-tab injection-path receipt rather than a new review workflow.

