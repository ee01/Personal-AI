# Findings

## Local State

- Selected feature: `回复助手来源适配` under Compose Assist.
- `docs/progressing/to-verify.md` said `暂无。`.
- Local Reminders were readable, but lists did not include `Personal AI`.
- The Compose Assist doc was stale for RingCentral/Jira source allowlists: current adapters already include `user_core`, `reflection`, and `reflection_thread`.

## Code Findings

- `src/composer-guard/siteContextAdapters.ts` already sends `surface`, `contextType`, `scenario`, `provider`, and `sourceTypes`.
- `src/composer-guard/assistPreviewPolicy.ts` already owned the compact `草稿回执` helper, making it the right place for a parallel source-route receipt helper.
- `tools/verify-compose-assist-direct-insert-e2e.mjs` already proves the actual Web AI browser request path, so it was the right E2E to extend.

## External Research

- RingCentral AI Writer and Atlassian Intelligence draft replies keep writing assistance inside the native composer and leave final send/insert under user control.
- Gmail Smart Compose research emphasizes real-time, low-friction suggestions inside the writing flow.
- GhostWriter and interaction-required suggestions research emphasize agency, personalization, control, and user awareness in AI-assisted writing.

## Decision

Expose a compact `来源路由` receipt in the existing popover rather than adding a new source browser or review queue. The route receipt should explain source adaptation without expanding into full evidence inspection.
