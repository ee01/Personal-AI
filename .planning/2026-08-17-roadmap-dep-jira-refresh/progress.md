# Progress Log

## Session: 2026-08-17

### Phase 1–2
- **Status:** complete

### Phase 3
- **Status:** complete
- 迁移 `012_marker_jira_cache`
- refresh_from_jira 写 dep 缓存不改 ETA
- hover / popover / 扩展 status 字段
- docs + demo

### Phase 4
- **Status:** complete
- vitest 38 passed（refresh / markers / schema / contract）

### Phase 5
- **Status:** complete

### Follow-up: 空白浮窗
- **Status:** complete
- 根因：混合依赖时 `fmtMD(undefined)` 打断 `openDepPopover`
- 修复：`depAdoptLabel` / `canAdoptJiraTargetEnd`；先算 rows 再 `floatAt`
