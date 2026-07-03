# Memory Lens Site Control Receipt

## Context

- Random feature: `站点静默/屏蔽/白名单` under Memory Lens.
- `docs/progressing/to-verify.md`: `暂无。`
- Reminders: local lists were readable, but no `Personal AI` list existed.
- External signal: Chrome `activeTab`, Edge Copilot page-context controls, and browser-extension permission research all support explicit scope and information-flow receipts for page-context features.

## Plan

1. Keep the scope to passive Memory Lens site controls.
2. Add a visible `站点控制回执` in the passive Lens card more menu.
3. Make allow/mute/block/page-block toasts explain passive scope, active selection-search boundary, and no-delete/no-egress semantics.
4. Update `docs/features/memory_lens.md`.
5. Verify with helper checks, first `npm start` compile, webpage-memory E2E, and `git diff --check`.
