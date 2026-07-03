# Prompt Config quick-insert draft receipt plan

## Target

- Feature: `自定义消息分析提示词` / Prompt Config from `docs/features/index.md`.
- Source doc: `docs/features/custom_prompts.md`.
- Main code: `src/modals/prompt-config.tsx`, with coverage in `tools/verify-custom-prompts.ts` and `tools/verify-custom-prompts-e2e.mjs`.

## Context

- `docs/progressing/to-verify.md` is empty.
- Local Reminders is readable, but there is no `Personal AI` list, so no Reminder item can be linked or marked done.
- Recent automation memory covered Outreach, Notification Center, Scheduled Messages, Task Scheduler, Today Pilot, User Profile, and related receipt surfaces; this run avoids those exact surfaces.
- External scan: OpenAI Custom Instructions and ChatGPT Memory emphasize explicit edit/disable controls and future-conversation effects; Claude personalization separates account-wide and project-scoped instructions; prompt-injection research and OWASP guidance support clear privilege boundaries for user-editable prompt data.

## Plan

1. Add an inline receipt when a user clicks a Prompt Config quick-insert example.
2. Make the receipt explicit that the inserted content is only a page draft until Save, does not trigger analysis, and does not write local storage or memory-service backup yet.
3. If the current preview scope excludes the inserted prompt, show a small action to switch to the matching message/project preview.
4. Update the Prompt Config feature doc with the current quick-insert draft behavior.
5. Extend targeted source and E2E checks, then run the Prompt Config verifier, `npm start` first compile, E2E, i18n if applicable, and scoped whitespace checks.
