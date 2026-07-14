# Glip AI Marker Tooltip Boundary Findings

## Initial Context

- `docs/progressing/to-verify.md` is empty.
- Recent automation memory covered Ask, Meeting History, Message Analysis manual rules, Topic links, User Profile influence, Meeting ASR, Memory Capture page snapshot, Memory Timeline, Memory user identity, Reflection controls, Relationship Context Card, Skill Foundry card selection, Coverage quality controls, and Snooze option boundaries. This run avoids those freshest exact/family scopes.
- Selected feature from random sample: `Glip AI 标注` in `docs/features/message_reaction.md`.
- Reminder check: AppleScript list scan omitted `Personal AI`; EventKit found `Personal AI` with `PERSONAL_AI_INCOMPLETE_COUNT 0`, so no user feedback item is open for this feature.

## External Scan Notes

- Slack's `Save it for Later` keeps saved items/reminders in a dedicated Later section, but the developer docs warn older stars/reminders APIs no longer reflect the user-facing Later state. This supports UI copy that distinguishes local marker/cache state from platform-visible state.
- Microsoft Teams scheduled chat messages expose edit, reschedule, and delete flows at the message itself, supporting in-context status/action affordances rather than hidden background state.
- NN/g's system-status guidance frames indicators as dynamic visual cues that need enough context for users to understand current state and urgency.
- Cross-cultural group-chat tagging research describes tags as visual markers that help users return to disrupted conversation points and raise awareness of missed ideas.
- Trigger-action debugging research shows users struggle to localize why automations did or did not happen; history/trace visualization and clear feedback reduce misunderstanding.

## Code And UX Findings

- `src/contentScriptGlip.tsx` already gives ordinary `.glip-ai-marker-badge` controls detailed marker receipts: folded marker scope, state meaning, next step, marker source, cache refresh time, stale/unrefreshed flags, and local-snapshot boundary.
- `follow_thread_original` and `follow_thread_related` are rendered through separate eye/related controls. Before this run, those special controls had focusable buttons and summary tooltips, but the button title/ARIA and tooltip did not include the full marker receipt. That made Watch markers less honest than ordinary markers when the same message also had Snooze, Outreach, or scheduled-log state.
- Existing verifier: `tools/verify-glip-ai-markers-e2e.mjs` checks source contracts and keyboard focus tooltip behavior with headless Chromium from `desktop-app/node_modules/playwright`.
- Low-decision implementation: presentation/accessibility-only. Reuse existing marker receipt helpers for special Watch marker controls; no backend, cache, marker ordering, or action behavior changes.
