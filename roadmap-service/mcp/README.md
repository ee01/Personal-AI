# Roadmap Planning MCP

本地 stdio MCP：把 Agent 接到 Roadmap Draft 规划 HTTP API。不打开数据库，不调用 Memory Service，不创建 Jira。

## 环境变量

在宿主安全配置里提供，不要写进 Git：

```bash
ROADMAP_BASE_URL=https://roadmap.example.com
ROADMAP_TEAM_ID=<team-id>
ROADMAP_EDIT_TOKEN=<share-token>
# 仅本地 HTTP 例外：
# ROADMAP_ALLOW_INSECURE_HTTP=1
```

生产必须 HTTPS。`localhost` / `127.0.0.1` 可用 HTTP。

## 运行

```bash
npm --prefix roadmap-service/mcp run build
ROADMAP_BASE_URL=... ROADMAP_TEAM_ID=... ROADMAP_EDIT_TOKEN=... node roadmap-service/mcp/dist/index.js
```

stdout 只输出 MCP 帧；诊断在 stderr。

## 工具

| 工具 | 副作用 |
|---|---|
| `roadmap_get_context` | 读上下文与 capabilities |
| `roadmap_validate_plan` | 保存待提交计划，不写 Draft，不花服务端 LLM |
| `roadmap_revise_plan` | 改计划再校验 |
| `roadmap_generate_plan` | 显式委托服务端 LLM，默认 `autoCommit=false` |
| `roadmap_get_request` | 用 requestId / jobId 恢复 |
| `roadmap_cancel_job` | 取消未提交任务 |
| `roadmap_commit_plan` | 原子写入 Draft |
| `roadmap_get_batch` | 回执与不含 token 的链接 |
| `roadmap_undo_batch` | 撤销仍为 Draft 的本批；已有 Jira key 的行留下 |

没有 Jira create、没有 `applyIntent`、没有分享 token 签发。契约版本 `1.0.0` / schema `1`。不兼容时在花费或写入前拒绝。

Skill 独立包见 `plugin/skills/roadmap-planning/`。
