# Task Plan: Memory Service 502 / pending 根因排查

## Goal
查清远程 Memory Service（`10.32.56.212` / `memory.xmnup.com`）近期 502 与请求 pending 的根因，并给出可落地的避免措施。本轮只读诊断，不改生产、不部署。

## Current Phase
Phase 4

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints：只读 SSH / HTTP
- [x] 采集远端现状
- [x] Document in findings.md
- **Status:** complete

### Phase 2: Correlate logs to root cause
- [x] 区分网关 502 vs 应用 5xx vs 请求挂起
- [x] 对照历史（2026-08 SQLite / NPM 上游 IP）
- [x] 定位时间窗、watchdog 重启循环、主机 reboot、SQLITE_EMPTY
- **Status:** complete

### Phase 3: Recommend prevention
- [x] 归纳根因链
- [x] 给出短期止血与长期避免措施
- **Status:** complete

### Phase 4: Delivery
- [x] 用中文向用户交付结论
- **Status:** complete

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 只读诊断，不 deploy | 用户要查日志与根因，未要求修代码或重启 |
| 不清 stale watchdog lock | 清掉会让 3s 重启循环立刻回来 |
| 同时查 NPM 与 memory-service | 历史 502 既来自网关也来自进程重启 |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| 远端 zsh 无 rg | 改 grep/python |
| awk 解析 NPM 自定义 access 格式失败 | 改用 python 按 `] - CODE` 解析 |
