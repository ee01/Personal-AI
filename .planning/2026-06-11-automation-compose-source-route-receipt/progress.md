# Progress

## 2026-06-11

- Read `AGENT.md`, automation memory, `docs/features/index.md`, `docs/progressing/to-verify.md`, and relevant memory guidance.
- Probed Reminders via AppleScript; no `Personal AI` list exists.
- Selected Compose Assist `回复助手来源适配` after freshness-filtering away from recently touched Storyline/Today/Memory Lens/Notification/Message Reaction docs.
- Added `buildComposerAssistSourceRouteReceipt(...)` to `src/composer-guard/assistPreviewPolicy.ts`.
- Rendered `来源路由` in `src/composer-guard/ComposerGuardController.ts`.
- Added source-route unit tests in `src/composer-guard/__tests__/ComposerGuardController.test.ts`.
- Updated `tools/verify-compose-assist-direct-insert-e2e.mjs` to assert the route receipt in the real ChatGPT fixture path.
- Updated `docs/features/compose_assist.md` with the source-route receipt, current allowlists, and 2026-06-11 research note.
- Validation passed:
  - `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node --test src/composer-guard/__tests__/ComposerGuardController.test.ts src/composer-guard/__tests__/siteContextAdapters.test.ts`
  - `npm start` first webpack dev compile, then watcher stopped
  - `node tools/verify-compose-assist-direct-insert-e2e.mjs`
  - `git diff --check`
  - `pgrep -fl 'webpack --watch|npm start' || true` returned no processes
