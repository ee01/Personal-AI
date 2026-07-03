# Doubao Bridge Explorer Manual Run Receipt

## Target

- Feature: `豆包互联` / Doubao Bridge
- Source doc: `docs/features/doubao_bridge.md`
- User path: Desktop App Explorer source cards, especially changing a source's range / scope / transport and immediately clicking `立即抓取`.

## Findings

- The current code already auto-saves dirty Explorer source settings before `openLogin` and `runNow`.
- The visible manual-run completion message only reports counts, so the user cannot tell whether the latest pending settings were used or whether the old source settings were still in effect.
- This matters more for Doubao / ChatGPT Explorer because source, scope, lookback window, and browser transport define the privacy and writeback boundary.
- Current Reminders check found no local `Personal AI` list, so no reminder item is attached to this run.

## External Product / Research Notes

- ChatGPT, Claude, and Gemini all expose memory controls, import/export, activity deletion, or temporary/private boundaries as separate user-facing concepts.
- Mem0 and LongMemEval both support extracting and auditing durable memory instead of blindly treating full chat history as long-term memory.
- Constructive product direction: make the manual read boundary explicit at the click result, not only in the surrounding card state.

## Implementation Plan

1. Add a desktop renderer helper that formats a `抓取回执` for manual Explorer runs.
2. Include whether pending source settings were auto-saved before the run.
3. Include the effective lookback window, default scope, transport, and ChatGPT max conversation cap where relevant.
4. State the no-provider-writeback / no-provider-delete boundary in the same message.
5. Update the local E2E harness assertions.
6. Update `docs/features/doubao_bridge.md` with the user-visible behavior.

## Validation Plan

- `npm --prefix desktop-app run test:source-toggle-gating`
- `npm start` until first successful dev compile, then stop.
- `git diff --check`
