# 接口升级：Memory MCP Server / 跨 AI 平台记忆接口

> 生成时间：2026-06-11 CST
> 来源：2026 行业事实标准（mem0 OpenMemory / redis / basic-memory / 官方 MCP memory server 均已提供）+ 本项目「用户去其他 AI 平台继续对话时提供关联提示」愿景（memory_system.md:11）
> 优先级：P2（战略层；实现成本低于多数 P1）
> 预估规模：3-4 天（MCP server 壳 + 5 个 tool + 鉴权与脱敏门控）

## 结论

给 Memory Service 加一层 **MCP（Model Context Protocol）server**，把已有 HTTP 端点以 MCP tools 形式暴露：`memory_search` / `memory_ask` / `memory_save` / `memory_context_brief` / `memory_profile_hint`。Claude Code、Claude Desktop、Codex、Cursor、OpenClaw 等任何 MCP 客户端即可直接使用本系统记忆——把"跨 AI 平台的记忆层"从桥接脚本（豆包 desktop bridge）升级为标准协议。

它不是：
- 不是重写 API（MCP tools 是现有 routes 的薄适配层，业务逻辑零改动）
- 不是把整个 49 路由面全暴露（只暴露读为主的 5 个 tool；写仅 memory_save 一个且走既有 ingest 决策）
- 不是替代豆包桥接（豆包无 MCP，session_context 注入继续）

## 假设场景：一步步的体验（无 UI，调用对照）

**人物与背景**：你在 Claude Code 里重构 `RawMessageStore`，想确认三周前定过的去重口径。

**Before（现状）**：切到浏览器 → 打开 memory-exploring → 搜「RawMessageStore 去重」→ 翻两页找到那条会议结论 → 复制 → 粘回终端问题里。约 2 分钟，且上下文断裂。

**After（一次性配置 `claude mcp add personal-memory -- node memory-service/dist/mcp/server.js --user-id esone` 后）**：

你在 Claude Code 里直接问：「我们之前对 RawMessageStore 的去重决定是什么？」——它自动调 tool：

```json
// → memory_search
{ "query": "RawMessageStore 去重 决定", "scope": "work", "limit": 5 }

// ← 响应（脱敏摘要口径，单条截断 500 字符）
{ "items": [
    { "summary": "5/22 会后结论：以 (source_type, scope, source, postId) 为唯一键，
       content hash 仅作回退；不引入模糊去重避免误合并",
      "source": "meeting", "date": "2026-05-22",
      "weave": { "sourceCount": 2, "daySpanDays": 9 }, "evidenceCount": 3 },
    { "summary": "6/3 Jira comment：postId 缺失的 Doubao 来源走 content_normalized 回退…",
      "source": "jira", "date": "2026-06-03", "evidenceCount": 1 } ],
  "receipt": { "scopeApplied": "work", "redaction": "summary_only" } }
```

Claude Code 引用两条记忆直接作答并继续改代码。服务端同时落一行审计：

```
mcp_access_log: memory_search | client=claude-code | scope=work | items=2 | 09:41:23
```

**边界演示**：同一会话里它尝试 `memory_search {scope:"personal"}`（你只开了 work）→ 返回 `{ "error": "scope_not_allowed", "allowedScopes": ["work"] }`；问到含凭证的 capsule → 该条在服务端就被过滤，根本不出现在结果里。

## 依据

- GitHub 调研：MCP 化已成记忆系统事实标准接口（mem0/redis/basic-memory/官方 server）；Anthropic Memory Tool（API beta）也走"客户端文件式 CRUD"同构形态。
- 本项目愿景原文（memory_system.md:11）：「在……用户去其他 AI 平台继续对话时提供关联提示」——MCP 是达成该愿景成本最低的路。
- 盘点 C：当前无任何 MCP 实现；desktop-app memoryServiceClient 已证明 HTTP 面足够支撑外部消费。

## 现状（代码事实）

- 服务面：Fastify 5 @ 3210，49 路由文件，X-User-Id + Bearer 鉴权（memoryServiceClient.ts:571-575 客户端先例）。
- 可直接映射的端点：POST /recall、POST /ask、POST /ingest、POST /context-recall、GET /profile/core、POST /providers/:provider/render-context-package（active_focus_digest 等四类 digest）。
- 边界资产：scope 语义（work/personal/both/all）、Agent-Memory Protocol 式"跨边界最小化打包"原则已写入文档（memory_system.md:1004-1012）、ai-context-passport-plan 的 P3 本就规划了 MCP/Codex/OpenClaw 接入。

## 方案

### 形态：独立进程 `memory-service/src/mcp/server.ts`

- stdio transport（本机 AI 工具的标准接法）+ 可选 SSE（远程客户端，默认关）。
- 用 `@modelcontextprotocol/sdk`；进程内直接 import 服务层（与 Fastify 同库不同入口），或走 localhost HTTP（首选——天然复用鉴权/限流/日志，避免双初始化）。
- 用户身份：MCP server 启动参数 `--user-id`（单用户本机场景），多用户部署走 env。

### Tools 设计（5 个，宁少勿多）

```
memory_search   { query, scope?, limit? }            → /recall（带 weave 与来源）
memory_ask      { question, scope? }                 → /ask（answer + evidence 摘要）
memory_save     { content, sourceHint?, scope? }     → /ingest source_type='mcp_client'
                                                        ← 走全套 salience/合并决策/probation
memory_context_brief { topicOrPerson?, tokenBudget } → active_focus_digest / day-pilot
                                                        context-pack 的 MCP 化
memory_profile_hint  { aspect? }                     → /profile/core 的脱敏摘要
                                                        （writing style / 偏好 / 工作背景）
```

设计纪律：
- **最小化打包**：tool 返回均走"脱敏摘要 + evidence 计数"，不吐原始消息全文（memory_search 例外，但单条截断 500 字符——与 formatRecalledContext 同口径）；遵守 Agent-Memory Protocol"跨边界只传最小必要"。
- **写入信任分级**：memory_save 的 trust_class='internal'（MCP 客户端是用户自己的工具，高于 webpage 低于 user_manual），进 probation 视 salience 而定（merge-evolution-ttl plan 的规则复用）。
- **审计**：每次 tool 调用写 `mcp_access_log(tool, clientInfo, scope, itemCount, ts)`——对应 Claude Managed Agents 的 audit logs 实践。

### 安全门控

- scope 白名单：MCP 默认只开 work+personal 中用户配置的子集（config 新键 `mcp.allowedScopes`，默认 `['work']` 保守起步）。
- 敏感类目硬排除：Knowledge-Vault 类（凭证、隐私 capsule）永不经 MCP 出去——按 source_type/privacy class 过滤。
- 注入回路防护：memory_search 返回内容若 trust_class='untrusted'，带上 injection-defense plan 的包裹标记字段，让消费端 LLM 也获得中性框架提示。

## 实施切片

| 切片 | 内容 | 验收 |
| --- | --- | --- |
| P0 | stdio server + memory_search/memory_ask 两 tool + 审计表 | Claude Code 实配冒烟：`claude mcp add` 后能搜到本库记忆 |
| P1 | memory_save + context_brief + profile_hint + scope 配置 | 三 tool 契约测试；scope 越界拒绝 case |
| P2 | SSE 远程档 + OpenClaw 双向（其结果回流仍走既有 action_results） | 远程鉴权测试 |

## 验证

- 契约测试：MCP SDK 的 client 测试夹具逐 tool 断言 schema 与脱敏口径。
- 红队：①请求 scope 外数据被拒；②凭证类 capsule 不可达；③untrusted 内容带包裹标记。
- 真实冒烟：Claude Code / Cursor 各接一次，确认 tool 描述让模型正确选用（描述文案也是产品面）。

## 与既有 plan 的关系

- `ai-context-passport-plan.md`（候选，P3 含 MCP）：本 plan 把其 P3 提前独立交付；passport 的结构化上下文包将来可作为 memory_context_brief 的高级输出格式。
- `memory-share-with-openclaw.md`（方向文档）：OpenClaw 接入走本 server 的 P2；中台架构讨论不阻塞 P0。
- `agent-memory-control-tower-plan.md`（搁置）：多 agent 调度不在本 plan 范围；MCP 只做记忆存取。

## 风险与边界

- 外泄面扩大：这是把记忆"开口"的 plan——靠 scope 白名单 + 脱敏 + 审计三层兜底；默认保守（只开 work）。
- 客户端注入：MCP 客户端的 prompt 注入不受我们控制——memory_save 入库走全套防护（injection screen + probation），等同 webpage 待遇。
- 协议演进：MCP spec 仍在快速迭代，SDK pin 版本 + 契约测试隔离 breaking change。
