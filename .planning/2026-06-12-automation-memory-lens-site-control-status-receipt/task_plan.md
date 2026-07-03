# Memory Lens Site Control Status Receipt Plan

Started: 2026-06-12T08:04:38+08:00

## Goal

Improve the Memory Lens site-control experience so the Options management page makes the current passive-processing mode, affected surfaces, active blockers, and non-effects visible before and after users edit allow/mute/block rules.

## Context

- Selected feature: `站点静默/屏蔽/白名单` under `Memory Lens` from `docs/features/index.md`.
- Carry-over: `docs/progressing/to-verify.md` says `暂无。`.
- Reminder probe: Reminders is readable, but there is no `Personal AI` list.
- Existing implementation already covers card-menu receipts, storage keys, conflict cleanup, and E2E for allow/mute/block behavior.

## Plan

1. [done] Inspect automation memory, AGENT.md, feature index, carry-over doc, Reminder state, Memory Lens docs, and current site-control code.
2. [done] Use product/paper research to constrain the UX shape around explicit page-context permission, low-interruption controls, and clear privacy-control mental models.
3. [done] Add an Options-page status receipt for site controls without changing passive recall behavior.
4. [done] Update targeted helper/E2E assertions and the canonical Memory Lens feature doc.
5. [done] Run focused validation, first successful `npm start` compile, Memory Lens E2E, and diff checks.
6. [done] Update automation memory with outcome and close the run.

## Implementation Target

- `src/options.tsx`: add a persistent `站点控制状态` receipt near the existing summary.
- `tools/verify-webpage-memory-detection.ts`: static source assertions for receipt copy.
- `desktop-app/scripts/webpage-memory-detection-check.mjs`: E2E assertions for Options receipt copy.
- `docs/features/memory_lens.md`: update site-control doc with Options status receipt behavior.

## Validation Target

- `TS_NODE_TRANSPILE_ONLY=1 node --loader ts-node/esm --experimental-specifier-resolution=node tools/verify-webpage-memory-detection.ts`
- `npm start` until first successful compile, then stop watcher
- `npm run verify:webpage-memory-detection:e2e`
- `git diff --check`

## Errors

- macOS shell has no GNU `timeout`; Reminder probe switched to `perl -e 'alarm shift; exec @ARGV' ... osascript`.
- The `npm start` exec session did not keep stdin open for Ctrl-C; stopped only the current `npm start` process by PID and confirmed no watcher remained.
