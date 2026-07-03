# Native Join Fallback Viewport Plan

## Scope

Target feature: `NC 加会 / Native Join`.

## Findings

- The current handoff panel already explains native app uncertainty, browser fallback, hidden passcode details, Meeting ID copy, and default-path changes.
- Because all recovery controls live in one fixed bottom-right panel, short browser windows or high zoom can push important controls below the visible viewport.
- External references from RingCentral, Zoom, Teams, and deep-link security research all support keeping app handoff recovery visible and conservative instead of assuming the app opened.
- Local Reminders did not expose a `Personal AI` list, so this run has no Reminder item to complete.

## Plan

1. Bound the fallback panel to the current viewport and let it scroll internally.
2. Add unit/E2E assertions so the fallback remains a visible recovery region and its viewport guard does not regress.
3. Update the Native Join feature doc with the viewport reachability boundary.

## Validation

- Targeted `ringcentralNativeJoin` unit test.
- `npm start` first successful webpack compile.
- `npm run verify:ringcentral-native-join:e2e`.
- Scoped `git diff --check`.
