# Mobile Context Thread Quick Ask Button Boundary

## Target

- Selected feature: `Mobile Context Thread` in `docs/index.md`.
- Source doc: `docs/features/doubao_bridge.md`.
- Implementation surface: Quick Ask answer card action `发到豆包手机对话` in `desktop-app/app/quick-ask.js`.

## Current Read

- The answer card already renders a visible send-scope receipt next to the button.
- The actual button does not expose the same boundary through `title` / `aria-label`, so hover and screen-reader users can reach the control before knowing that the click only sends a `query_answer_card` to the bound `mobile_context_thread`.
- Reminder check: EventKit found the `Personal AI` list with 4 total items and 0 incomplete items. No related live Reminder feedback to incorporate.

## External Notes

- ChatGPT memory docs, Claude chat search / memory, and Gemini Enterprise personalization all treat source visibility and memory controls as part of the product contract.
- ChatGPT Scheduled Tasks shows scheduled/notification flows need explicit confirmation and monitoring states.
- Mixed-Initiative Context argues that context should become an inspectable, manageable object rather than hidden state.
- Digital reminder research shows reminders often mix future intent, past information, and situational context, so lifecycle and side-effect boundaries need to be visible at the action point.

## Plan

1. Add a helper that derives stable button `title` / `aria-label` copy from the current Quick Ask mobile-context sync status.
2. Wire the helper into `renderMobileContextAction()` without changing payload generation, send timing, or status transitions.
3. Extend `desktop-app/scripts/quick-ask-status-card-check.mjs` to assert the idle, pending, succeeded, and failed button boundaries.
4. Update `docs/features/doubao_bridge.md` and the index row with a concise note about button-level hover / read-screen boundaries.
5. Verify with the Quick Ask desktop script, `npm start` first successful compile, scoped `git diff --check`, and any syntax checks needed for touched JS files.

## Boundaries

- Presentation/accessibility-only.
- Does not change `quickAsk.injectQuery()`, evidence clipping, provider binding, Desktop App bridge APIs, Memory Service state, Doubao sending, Reminder state, or sync audit persistence.
