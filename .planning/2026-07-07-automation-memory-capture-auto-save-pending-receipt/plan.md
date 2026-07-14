# 2026-07-07 Automation: Memory Capture Auto-save Pending Receipt

## 目标功能

- 随机抽中：`记忆捕捉` / Memory Capture。
- 主文档：`docs/features/memory_capture.md`。
- 主要代码：`src/contentScriptWebIntelligence.ts`、`memory-service/src/core/SourceMemoryCaptureService.ts`、`desktop-app/scripts/webpage-memory-detection-check.mjs`。

## 当前观察

- 本机 Reminders 的 `Personal AI` 列表可读取，共 4 条，全部已完成；没有未完成且与 Memory Capture / source-memory / 网页入库相关的反馈需要并入或标记完成。
- 文档描述基本跟当前实现一致：建议入库、复核面板、自动入库成功/失败、写入回执、no-write 回执、撤销和详情补备注都已经覆盖。
- 代码缺口在自动整页入库的请求阶段：`autoSavePageMemoryCapture()` 直接发送 `MEMORY_CAPTURE_SAVE_PAGE`，只有成功或失败后才显示结果。慢请求期间没有“提交中但尚未确认”的回执，容易让用户分不清请求是否已经发出、是否已经创建 capsule / `web` 检索信号。

## 行业与研究信号

- Obsidian Web Clipper、Readwise Reader、Notion Web Clipper、Zotero Connector 等网页保存产品都把保存动作、来源、备注或后续复核做成用户可追踪路径。
- KFTF / PIM 研究强调网页资料保存的核心不是“存过”本身，而是以后能重新理解来源、保存原因和复用语境。
- 2025 USENIX Security / UC Davis / UCL 对 GenAI browser assistant 的隐私审计强调浏览器助手应给用户透明度和控制，尤其是数据收集与个性化记忆。

## 改进计划

1. 在自动整页入库发起保存请求时显示 compact pending toast。
   - 标题建议：`页面资料入库提交中`。
   - 详情明确：只是本机保存请求已提交，尚未确认创建 source-memory capsule 或写入 `web` 检索信号。
   - 同时说明：不会外发、插入输入框、同步其他平台、写 confirmed profile 或创建任务。
2. 成功/失败仍沿用现有最终回执。
   - 成功：`资料记忆已写入` + `查看` / `撤销`。
   - 失败：`页面资料未写入` no-write receipt。
3. 增加 focused verification。
   - 静态 verifier 断言 pending receipt 函数和文案存在。
   - E2E 在自动入库保存接口延迟时断言 pending toast 可见，且在响应前未把它当作 confirmed write。
4. 更新 `docs/features/memory_capture.md` 和 `docs/features/index.md`。
   - 保持文档简洁，只补自动入库提交中边界。
5. 验证。
   - `node --check desktop-app/scripts/webpage-memory-detection-check.mjs`
   - `npm run verify:webpage-memory-detection`
   - `npm start -- --progress` 首次 successful compile 后停止
   - `npm run verify:webpage-memory-detection:e2e`
   - scoped `git diff --check`

## 不改动范围

- 不改候选评分、自动保存阈值、敏感 URL 门禁、保存 API、撤销 API、source-memory 数据模型或外部同步行为。
- 不标记 Reminder 完成，因为没有相关未完成 Reminder。
