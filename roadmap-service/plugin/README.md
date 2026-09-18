# Roadmap Planning Codex Plugin

把 `roadmap-planning` MCP 与 Skill 打成可从 Git/local marketplace 安装的单元。不读取 Chrome Jira token，不调用 Memory Service，不创建 Jira。

## 安装

1. 构建 MCP：`npm --prefix roadmap-service/mcp run build`
2. 在 Codex 中把 `roadmap-service` 当作 marketplace 根（见 `.agents/plugins/marketplace.json`）
3. 配置环境变量（宿主安全存储，不要写进仓库）：

```bash
ROADMAP_BASE_URL=https://your-roadmap
ROADMAP_TEAM_ID=...
ROADMAP_EDIT_TOKEN=...
```

4. 新会话应发现 Skill `roadmap-planning` 与 MCP tools。独立安装（不装 Plugin）也可：只配 MCP + 复制本目录 `skills/roadmap-planning`。

## 验收边界

- 干净环境无 `../../memory-service` import
- 工具列表不含 Jira create
- validate → commit → receipt 可在脱离 monorepo 后走 HTTP API 完成
- 不承诺官方公开目录上架
