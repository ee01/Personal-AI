# Native Join Copy-Link Receipt Plan

Goal: improve `NC 加会浏览器回退` by checking code and docs, using current product/research references, then implementing a bounded UX fix that makes browser fallback copy results unambiguous.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Read `AGENT.md`, feature index, automation memory, prior planning context, worktree status, and Reminder list state |
| 2 | completed | Select `NC 加会浏览器回退` after excluding recent exact automation targets |
| 3 | completed | Inspect Native Join docs, implementation, unit tests, and E2E |
| 4 | completed | Scan current product/security references for browser join, meeting ID fallback, and deep-link risk |
| 5 | completed | Implement the copy-link success receipt and update docs/tests |
| 6 | completed | Run targeted unit verify, dev compile, Native Join E2E, and scoped diff checks |
| 7 | in_progress | Update automation memory and attempt thread archive |

## Plan

1. Keep the current native-first handoff model and browser fallback flow; do not redesign the overlay.
2. Change only the `Copy link` success state so it says the full browser meeting link was copied, including hidden passcode/details if present.
3. State in that same success receipt that copying does not join the meeting, retry the app, or change the default join path.
4. Update the Native Join doc to record this receipt boundary.
5. Extend existing unit and Playwright E2E assertions instead of adding a parallel verifier.

## Decisions

- Reminder check: local Reminders is reachable but has no `Personal AI` list, so no Reminder items can be incorporated or marked done.
- External scan direction: RingCentral and Zoom both keep browser join as a real recovery path; Teams exposes meeting ID/passcode fallback; deep-link security references support allowlisted targets and explicit recovery state rather than opaque scheme launches.
- Selected implementation slice: a copy-success receipt, because the panel hides passcode/query details by default while `Copy link` intentionally preserves the full link.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| `node` missing from default shell PATH | Package script inspection | Use `$HOME/.nvm/versions/node/v24.13.0/bin` for validation commands |
| First random sampler missed automation memory | Used literal `${CODEX_HOME:-...}` inside Ruby | Reran sampler using `ENV["CODEX_HOME"] || "$HOME/.codex"` |
| `git diff --no-index --check` exited 1 for new planning files | Checked untracked files against `/dev/null` | Treated empty output as no whitespace errors because exit 1 only indicates files differ |
