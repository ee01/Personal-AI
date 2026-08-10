# Memory Service Default URL Consistency Fix

Goal: ensure the Memory Service URL shown in Options is the same URL used by background requests when `chrome.storage.local.envConfig` has not been saved yet.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Confirm the split-default root cause and inspect existing dirty-file overlap |
| 2 | completed | Introduce one shared build-time default and align Options copy |
| 3 | completed | Add regression coverage for missing and stored `envConfig` |
| 4 | completed | Run targeted tests, development compile, focused E2E, and whitespace checks |

## Decisions

- Preserve the existing environment contract: `.env.development` selects the LAN URL, while production/default builds use `memory.xmnup.com`.
- Remove the independent `localhost:3210` frontend-client fallback by sharing one small configuration constant.
- Do not change or revert unrelated existing modifications in `src/options.tsx`, `src/utils.ts`, `src/services/MemoryServiceClient.ts`, or `src/background.ts`.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Node 24/ts-node rejected the existing directory import `../i18n` before the new client test ran | Focused regression test, attempt 1 | Use the equivalent explicit module path `../i18n/index` and rerun |
| ts-node ESM did not append a TypeScript extension to `../i18n/index` | Focused regression test, attempt 2 | Follow the repository's ESM test convention and import `../i18n/index.js` |
| The new shared-config imports also needed ESM `.js` specifiers under ts-node | Focused regression test, attempt 3 | Apply the same repository convention to both new imports |
| Existing Message Reaction E2E timed out waiting for the unrelated Watch-rule `.add-topic-form` before reaching the URL path | Existing broad E2E | Keep the failure disclosed and add a narrow built-extension E2E for the exact Options-to-background URL contract |
