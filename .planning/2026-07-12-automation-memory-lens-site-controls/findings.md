# Findings: Memory Lens Site Controls

## Selected Feature
- Feature index row: `站点静默/屏蔽/白名单` under `Memory Lens`, source doc `docs/features/memory_lens.md`.
- Current docs already describe passive-only scope, real-time storage sync, conflict cleanup, and active selection search remaining available.

## Reminder Check
- AppleScript listed Reminder lists but did not expose `Personal AI`.
- EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- No Reminder feedback was incorporated or marked done.

## Code Findings
- `src/contentScriptWebIntelligence.ts` already handles passive suppression, live storage sync receipts, conflict cleanup, and the in-card `站点控制回执`.
- `src/options.tsx` already has a persistent `站点控制状态` receipt and detailed post-action receipts.
- Gap: the actual Options controls mostly have generic labels such as `刷新`, `允许`, `移除`, `添加`, `恢复`, and `清空...`. Hover and screen-reader users must infer click effects from surrounding text instead of the focused control.

## External Scan
- Chrome `activeTab` docs emphasize temporary page access from explicit user gestures, which supports making page/context effects visible before action.
- Microsoft Edge Copilot Context Clues exposes browsing-context use as a setting and says disabling it removes page-context access, which supports explicit allow/block state and live effect copy.
- Edge enterprise policy docs show page-context access is dynamic and per profile, reinforcing that controls should say whether already-open pages will re-evaluate.
- SOUPS 2021 browser-extension-permissions research found users have limited extension-permission mental models and prefer clearer permission language.
- RAG trustworthiness research frames transparency, accountability, and privacy as core dimensions, supporting source/scope/non-effect receipts near retrieval controls.

## Planned Improvement
- Add helper text in `src/options.tsx` for each site-control action.
- Apply those strings to `title` and `aria-label` on refresh, clear, allowlist toggle, allow/remove/clear, site block/unblock/clear, and page block/unblock/clear controls.
- Extend `tools/verify-webpage-memory-detection.ts` and `desktop-app/scripts/webpage-memory-detection-check.mjs` to prove the boundaries exist before click.
