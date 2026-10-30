# 业务时钟审计（方案 A / E-148）

## 机制

- 模块：`memory-service/src/clock/businessClock.ts`（`AsyncLocalStorage` 注入秒级业务时间）
- 统一入口：`memory-service/src/utils/time.ts` 的 `now()` → `getBusinessTimeSec()`（无注入时等同墙钟秒）
- Harness / adapter 在 `ingest`、`consolidate`、`recall`、`decide` 边界用 `runWithBusinessClockAt(Async)` 包裹

**保留墙钟（刻意不改）**：`Date.now()` 用于耗时测量、HTTP/LLM 超时、OAuth token TTL、进程内缓存 expiry、RingCentral 客户端等。

## 已改为可注入业务时钟（本任务）

| 区域 | 文件 | 说明 |
|------|------|------|
| 整理完成时间 | `core/v3/SleepReconciliation.ts` | `finished_at` 使用传入 `at`，不再 `Date.now()` |
| 当前事实过滤 | `core/v3/UnitRecallReader.ts` | `temporalMode==='current'` 用 `getBusinessTimeSec()` |
| 指标写入/保留 | `core/v3/UnitRecallReader.ts` | `recall_lane_metrics.created_at` 与 30 天清理 |
| 注意力/提醒 | `core/AttentionService.ts` | 默认 `at` 参数 → `now()` |
| 夜间整理 API | `routes/reconciliation.ts` | 手动 trigger / revert / since 窗口 |
| 写入溯源 | `core/WriteProvenanceGate.ts` | exposure / session 时间戳 |
| v3 抽取 worker | `core/v3/ExtractionWorker.ts` | job 租约与结果写入时间 |
| 通用 `now()` | `utils/time.ts` | 凡已调用 `now()` 的路径自动跟随注入 |

## 仍在使用墙钟的业务相关点（后续按需接入 `now()`）

以下路径已在 E-162 接入 `utils/time.now()`（业务秒级时间，评测 harness 可注入）：

- `core/v3/UnitTruthMaintainer.ts`
- `core/v3/UnitEmbeddingWorker.ts`
- `core/v3/ExposureOutcomeService.ts`
- `core/NotificationCenterService.ts`（通知窗口 `sinceAt`）
- `core/EvidenceResolutionPlanner.ts`（`parseEtaFromText` 事实窗口）
- `routes/ask.ts`（`currentTime`）
- `routes/contextRecall.ts`（指标写入时间戳）

仍为墙钟或尚未逐项评估的路径：
- `core/ConsolidationEngine.ts` / `core/GenerativeReplay.ts` — 旧版整理（若与 v3 并行启用需对齐）
- `core/AutoBackupService.ts` / `core/mirror/MirrorManifestStore.ts` — 备份/manifest（非 harness 路径）
- `routes/composerAssist.ts` — assist 路径（耗时仍用墙钟）
- `core/ContextRecallService.ts` / `core/ActiveRecallService.ts` — 检索缓存 expiry（混合：业务 TTL vs 性能）
- `core/ProactiveScheduler.ts` / `core/Rehearsal*.ts` — 后台调度（harness 应关闭或 mock）
- `core/auth/*.ts` — 密钥/设备审批（与记忆评测无关，保持墙钟）
- `routes/ingestBatch.ts` — batch 缺省 timestamp（应用 payload 显式时间）

## 验证

- `memory-service`: `npm test -- src/__tests__/baselineHarnessAdapter.test.ts`
- `experiments/memory-benchmark`: `npm test` 与 `npm run run -- --fixture synthetic-mini --scheme A --out ./out`
