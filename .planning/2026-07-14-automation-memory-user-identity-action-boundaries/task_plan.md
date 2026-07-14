# 多用户隔离身份按钮边界计划

## 目标

- 随机目标：`多用户隔离`（Memory Service，`docs/features/memory_system.md`）。
- 本轮只补齐 Memory Exploring 身份卡控制点的 hover / 读屏边界；不改 `X-User-Id` 解析、per-user SQLite 路由、write guard、导入/恢复/画像写入或召回语义。

## 已确认

- `AGENT.md` 已读；运行时代码改动后需要 `npm start` 首次成功编译、目标 E2E 和 scoped `git diff --check`。
- `docs/progressing/to-verify.md` 为空。
- 自动化记忆显示最近刚覆盖 Message Analysis、Meeting History、Ask、Topic、User Profile、Reflection、Coverage、Meeting ASR、Skill Foundry、Relationship Radar、Memory Capture、Scheduled Messages、Today Pilot 等；本目标不是最近精确目标。
- 当前 worktree 已有大量历史自动化脏文件；本轮只触碰本计划、`src/modals/memory-exploring.vue`、`tools/verify-memory-user-identity-e2e.mjs`、`docs/features/memory_system.md`、`docs/features/index.md`、`.planning/.active_plan` 和自动化 memory。
- AppleScript 未列出 `Personal AI`，但 EventKit 找到该列表；未完成条目为 0，所以无相关 Reminder 需要纳入或完成。

## 外部参考

- OpenAI ChatGPT Memory / controls：用户应能查看、管理和删除记忆，并从设置控制记忆行为。
- Claude chat search and memory：记忆和历史搜索有可切换能力，并把检索作为可见 tool call。
- Notion Enterprise Search security：权限需要在 query time 校验，用户映射和源系统权限变化会持续同步。
- Governed Shared Memory for Multi-Agent LLM Systems：多 agent memory 需要显式 scope、time、provenance、propagation 治理维度，防止 unauthorized leakage、stale propagation 和 provenance collapse。

## 缺口

Memory Exploring 侧栏身份卡已经展示当前 userId、storage key、`/stats.user.writeBoundary` 和只读快照时间，但两个实际按钮没有控制点级别的说明：

- `刷新身份快照` 聚焦时只读屏按钮名，看不到它只是重新读 `/stats`，不会写入、导入、恢复、迁移、切换用户空间或确认 default fallback。
- `打开设置` 聚焦时只读屏按钮名，看不到它只是打开 Options 恢复登录 / `userinfo.username` / userId 配置，不会直接修复、迁移或重试写入。

## 实施步骤

1. 在 `memory-exploring.vue` 增加身份按钮边界文案 helper，区分 explicit user、default fallback、local inferred / error。
2. 将刷新和打开设置按钮的 `title` / `aria-label` 绑定到对应 helper。
3. 扩展 `verify-memory-user-identity-e2e.mjs`，断言 explicit 和 fallback 状态下两个按钮的 `title` / `aria-label`。
4. 更新 `docs/features/memory_system.md` 与 `docs/features/index.md` 中 `多用户隔离` 的描述。
5. 验证：`node --check tools/verify-memory-user-identity-e2e.mjs`、`npm start -- --progress` 首次成功编译、`npm run verify:memory-user-identity:e2e`、scoped `git diff --check`。

## 状态

- [x] 目标选择与上下文读取
- [x] Reminder 与外部参考检查
- [x] 代码和 E2E 修改
- [x] 文档更新
- [x] 验证与收尾

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| planning skill path initially read from `/Users/Esone/.codex/skills` | 1 | Re-read actual `/Users/Esone/.agents/skills/planning-with-files/SKILL.md`. |
| AppleScript list enumeration missed `Personal AI` | 1 | EventKit fallback found `Personal AI` with 0 incomplete items. |
