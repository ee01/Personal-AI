# Native Join Manual Passcode Recovery Plan

## Target

- Randomly selected feature: `NC 加会浏览器回退` in `docs/features/meeting_native_join.md`.
- Scope: RingCentral Native Join fallback panel in `src/ringcentralNativeJoin.ts`.
- Reminder check: local Reminders list names do not include `Personal AI`, so no Reminder item is included or marked done in this run.

## External scan

- RingCentral, Zoom, and Teams all keep a browser/no-download join path for app-install or app-open failure recovery.
- Teams also exposes Meeting ID plus passcode as a manual join path, which makes the recovery material concrete when app/browser handoff is unreliable.
- Deep-link security research and Android guidance reinforce keeping custom-scheme targets tightly validated and explaining fallback paths instead of silently widening what can be opened.

## Current gap

The fallback panel already shows a copyable Meeting ID and preserves the full browser URL behind explicit actions. When the original RingCentral link contains a passcode-like query parameter, the manual-app path still makes the user choose between copying only the ID or revealing the full URL. That is conservative, but it makes the manual app-entry path harder than necessary when the app asks for a passcode.

## Implementation plan

1. Add a small helper that extracts common passcode query parameters from the already validated RingCentral browser fallback URL.
2. When a passcode exists, show a hidden-by-default `Meeting passcode` row with a `Copy passcode` action; do not reveal the passcode text in the panel.
3. Keep status receipts explicit: copying the passcode does not join, retry the app, copy the full URL, or change default join preference.
4. Update Native Join unit and E2E coverage for the new row and copy receipt.
5. Update `docs/features/meeting_native_join.md` with the new behavior and boundaries.

## Verification plan

- Run the existing Native Join unit test file.
- Run `npm start -- --progress` until the first successful compile, then stop it.
- Run `npm run verify:ringcentral-native-join:e2e`.
- Run scoped `git diff --check` on touched files.
