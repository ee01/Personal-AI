# Native Join canonical scheme guard

## Target

- Feature: `NC 加会浏览器回退`
- Source doc: `docs/features/meeting_native_join.md`
- Reminder check: local Reminders is reachable, but there is no `Personal AI` list on this machine.

## Research notes

- RingCentral positions browser join as a no-download recovery path for desktop and mobile browsers.
- Zoom exposes `Join from your browser` after the app/download path, which supports keeping browser fallback visible after a native handoff attempt.
- Teams offers browser/app choice and Meeting ID entry, which supports keeping ID-only manual entry separate from full passcode-bearing links.
- Deep-link security research and Android guidance both point to strict validation of deep-link scheme, host, path, and carried data before launching an app.

## Plan

1. Keep the existing fallback panel and browser recovery flow unchanged.
2. Tighten `rcvdt://join/...` parsing so native input must contain exactly one safe meetingId path segment.
3. Rebuild native launch URLs from the normalized meetingId plus query/hash instead of replaying raw native paths.
4. Add regression coverage for canonical native links and rejected native links with extra path material.
5. Update the feature doc and index with the new canonical app retry boundary.
6. Verify with Native Join unit coverage, first successful webpack dev compile, the existing Native Join E2E, and scoped diff checks.

## Boundary

This run does not change default join preference storage, external app launching mechanics, browser fallback windows, copy behavior, Meeting ID copy behavior, Video Home calendar lookup, or Glip rich invite bridging.
