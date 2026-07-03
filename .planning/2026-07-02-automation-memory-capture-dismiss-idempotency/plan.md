# Memory Capture API 重复撤销幂等计划

## 目标功能

- 随机抽取功能：`Memory Capture API`
- 所在文档：`docs/features/memory_capture.md`
- 主要代码：`memory-service/src/core/SourceMemoryCaptureService.ts`、`memory-service/src/routes/sourceMemory.ts`

## 当前发现

- 文档整体已经覆盖当前 API：候选评分、保存、详情、补备注、撤销、`writeReceipt`、`actionReceipt` 和 distillation 边界。
- Reminder 中 `Personal AI` 列表有 4 条历史反馈，全部已完成，内容集中在 Doubao / Notification Center，不直接涉及 Memory Capture API。
- 业内产品和研究共同强调网页资料保存需要保留来源、备注、后续复核和可恢复路径。Notion Web Clipper 保存原网页地址并可打开已保存页面；Readwise Reader 支持 document note 记录为什么保存；Obsidian Web Clipper 强调本地可读的 durable file 和可见 highlight；KFTF / PIM 研究说明用户保存网页资料时常依赖 URL、备注和上下文来重新找到资料。
- API 缺口：`dismissCapsule()` 每次调用都会写 `dismissed` 事件并刷新 `updated_at`。如果前端双击、网络重试或旧 toast 重放撤销请求，用户会看到一次新的“最近操作”，但实际上召回信号早已关闭。

## 实施计划

1. 在 `SourceMemoryCaptureService.dismissCapsule()` 中先检查 `existing.status === 'dismissed'`，直接返回当前 capsule，不再次更新数据库。
2. 在 `api-source-memory.test.ts` 新增回归测试：第一次撤销关闭 recall signal，第二次撤销仍成功返回 dismissed，但 `updatedAt`、`actionReceipt.occurredAt` 和 `dismissed` 事件数保持不变。
3. 更新 `docs/features/memory_capture.md`，把重复撤销 no-op 纳入 Memory Capture API 的写入/召回边界。
4. 验证：memory-service source-memory targeted test、`npm start` 首次编译、source-memory capsule E2E、scoped `git diff --check`。
