# 主动询问详情加载失败恢复计划

## Goal

随机抽中 `docs/features/index.md` 里的 `主动询问`。本轮目标是让 Outreach 详情页在读取失败时保持真实状态边界：服务错误、网络错误或目录状态失败不能显示成“未找到该会话”，用户要能重试详情读取或返回列表继续处理。

## Context

- `docs/progressing/to-verify.md` 当前暂无待校验事项。
- EventKit 读到本机 Reminders `Personal AI` 列表共 4 条、未完成 0 条；都是历史 Doubao / 通知反馈，和主动询问无关。
- 现有文档已覆盖列表、审批、重试、发送前复核和只读控件边界；本轮不重复这些按钮级收据。

## Plan

1. [complete] 梳理 `AGENT.md`、功能索引、自动化记忆、Reminder 和 Outreach 现有文档/代码。
2. [complete] 做小范围业内产品和论文扫描，确认设计原则。
3. [complete] 修复 `OutreachSessionDetail.vue` 详情加载失败呈现：保留错误原因、重试按钮、返回列表路径和边界文案。
4. [complete] 更新 `tools/verify-outreach-sessions-e2e.mjs`，覆盖详情页 503/服务错误不能误报“未找到”。
5. [complete] 更新 `docs/features/memory_system.md` 与 `docs/features/index.md` 的主动询问说明，保持文档最新但不堆细节。
6. [complete] 验证：静态检查、`npm start` 首次成功编译、Outreach E2E、scoped `git diff --check`。

## Decisions

- 不改 OutreachEngine、发送/审批/重试后端语义，也不碰 RingCentral 外发逻辑。
- 详情页读取失败时不保留旧详情快照，因为当前 detail route 没有已加载详情缓存；改为明确错误状态和恢复路径。
- 计划目录采用 `.planning/2026-07-12-automation-outreach-detail-load-failure/`，避免污染已有 dirty worktree 和旧 active plan。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| `planning-with-files` skill 首次按错误 root 读取失败 | 读取 `/Users/Esone/.codex/skills/...` | 改读 `/Users/Esone/.agents/skills/planning-with-files/SKILL.md` |
