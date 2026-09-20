# Roadmap Planning MCP

Roadmap Service 自带 **远程 Streamable HTTP MCP**。普通用户不必克隆仓库、不必运行本地 `node`。

## 远程 MCP（推荐）

默认：

- MCP：`http://roadmap.xmnup.com/mcp`
- Skill：`http://roadmap.xmnup.com/skills/roadmap-planning/SKILL.md`
- GitHub Skill：https://github.com/ee01/Personal-AI/blob/develop/roadmap-service/plugin/skills/roadmap-planning/SKILL.md

自建时把主机换成你的 `ROADMAP_PUBLIC_BASE_URL`（不配则默认 `http://roadmap.xmnup.com`）。

Headers（宿主 MCP 配置，不要提交）：

```
X-Team-Id: <地址栏 ?team=>
X-Share-Token: <可编辑分享链接 token>
```

也可用 `Authorization: Bearer <token>`。

Cursor 示例：

```json
{
  "mcpServers": {
    "roadmap-planning": {
      "url": "http://roadmap.xmnup.com/mcp",
      "headers": {
        "X-Team-Id": "<team id>",
        "X-Share-Token": "<edit token>"
      }
    }
  }
}
```

`GET /mcp` 返回发现信息；`POST /mcp` 走 JSON-RPC（initialize / tools/list / tools/call）。不创建 Jira。`ROADMAP_AI_AGENT_ACCESS=false` 时工具调用 403，网页「使用 AI 批量创建」不受影响。

## 本地 stdio（可选）

只在要连自建环境、又不能配远程 MCP 时使用：

```bash
npm --prefix roadmap-service/mcp run build
ROADMAP_BASE_URL=... ROADMAP_TEAM_ID=... ROADMAP_EDIT_TOKEN=... node roadmap-service/mcp/dist/index.js
```

生产必须 HTTPS。`localhost` / `127.0.0.1` 可用 HTTP。线上 HTTP 才需要 `ROADMAP_ALLOW_INSECURE_HTTP=1`。

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

没有 Jira create、没有 `applyIntent`、没有分享 token 签发。契约版本 `1.0.0` / schema `1`。
