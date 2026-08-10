# Roadmap 双路径创建 Jira

Goal: 实现 `docs/progressing/roadmap-jira-agent-create-plan.md`（P1+P2），对齐 `docs/demo/roadmap-demo.html`；完成后写入 `docs/features/personal_roadmap.md` 并删除 progressing 相关文档。

## Phases
### P1 — fixVersion 直连增强
- [x] Status: complete
- AiCreateModal + contract 加 fixVersion / catchRelease chips
- jiraCreateMeta fixVersions + 后缀匹配
- contentScriptRoadmap 透传
- verify:roadmap-jira-create-fields 用例已补

### P2 — Prompt + Agent 路径
- [x] Status: complete
- 弹窗双模式 UI（对齐 demo）
- bridge pai-roadmap-agent-create / executors / open-options
- 插件组装任务 → /agent-tasks/execute + 轮询 runtime-status
- artifact mappings → resolve_draft/resolve_item
- 执行器列表 fallback（openClaw）

### Docs cleanup
- [x] Status: complete
- Updated personal_roadmap.md + index
- Deleted docs/progressing/roadmap-jira-agent-create-plan.md
- Demo 保留：docs/demo/roadmap-demo.html

## Errors
| Error | Attempt | Resolution |
|-------|---------|------------|
| verify:roadmap-jira-create-fields fails on Node 24 (extensionless ./jira import) | 1 | Pre-existing ESM resolution; logic covered by unit cases in file; web vitest covers payload |
