# Prompt Config Scope Switch Boundary

## Context

- Automation: `轮询检查改进每个功能`
- Selected feature: `用户上下文注入` under Prompt Config
- Source docs: `docs/features/custom_prompts.md`, `docs/index.md`
- Primary implementation surface: `src/modals/prompt-config.tsx`
- Validation surface: `tools/verify-custom-prompts.ts`, `tools/verify-custom-prompts-e2e.mjs`

## Reminder Check

EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. All existing items are completed historical Doubao / notification / test feedback and are unrelated to Prompt Config, user context injection, preview scope switching, or custom instruction boundaries. No Reminder item should be incorporated or marked done for this run.

## External Scan

- OpenAI Memory FAQ distinguishes explicit custom instructions from automatically updated memory, and stresses user control over what memory/context is referenced.
- Claude personalization docs split account-wide instructions, project instructions, and skills/styles by scope, reinforcing that users need to know which personalization layer applies to the current task.
- LaMP shows personalization benefits from selecting relevant user-profile items, not blindly injecting every available profile item into every task.
- OWASP LLM01 recommends separating and clearly denoting untrusted content and constraining model behavior, which supports keeping user-editable context labeled as low-priority data with visible control boundaries.

## Product Gap

Prompt Config already has strong receipts around draft vs saved baseline, low-priority `user_context`, and message/project/all preview semantics. The remaining UX gap is at the actual preview-scope buttons:

- The surrounding receipt explains the current scope after selection.
- The button itself does not explain before click that changing scope only changes the current page preview and receipt grid.
- Screen reader users get only `全部` / `消息` / `项目`, without the runtime/audit distinction or no-save/no-analysis/no-backup boundary.
- The same switch appears in the user-context tab, where the risk of misreading it as a field-level save or profile fusion action is higher.

## Plan

1. Add a small helper in `prompt-config.tsx` that builds scope-switch `title` and `aria-label` copy from the target scope, current active scope, switch location, draft state, and unsaved state.
2. Apply it to both the main `生效预览` scope switch and the `用户上下文本轮范围` switch.
3. Keep behavior presentation/accessibility-only: do not change preview computation, saved config, memory-service backup, profile fusion, or runtime injection.
4. Extend `tools/verify-custom-prompts.ts` so the static verifier locks in the helper and boundary strings.
5. Extend `tools/verify-custom-prompts-e2e.mjs` to assert button-level boundaries before click for all three scopes and for the user-context tab switch.
6. Update `docs/features/custom_prompts.md` and the `用户上下文注入` row in `docs/index.md`.

## Validation Target

- `node --check tools/verify-custom-prompts-e2e.mjs`
- `npm run verify:custom-prompts`
- `npm start -- --progress`, stop after the first successful compile
- `npm run verify:custom-prompts:e2e`
- Scoped `git diff --check` over files touched by this run
