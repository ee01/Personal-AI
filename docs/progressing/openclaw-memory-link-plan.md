# 新能力：OpenClaw Memory Link / OpenClaw 记忆联动（读写双通道与一键配置）

> 状态：仅规划，待决策。本轮未改任何运行时代码。
> 生成日期：2026-10-09 CST
> 代码核查基线：工作区 `develop` 分支，引用均为 `path:line`。
> Demo：[`openclaw-memory-link-demo.html`](./openclaw-memory-link-demo.html)（Options 的 OpenClaw 执行器卡片新增「联动记忆」区块）
> 来源：E-72 第四轮。用户问：互通的 A（只读）与 B（导入）能否同时开；B 是否需要给本项目加 importer 接口；能否在用户配置 OpenClaw 执行器时一键完成记忆联动。
> 从 `memory-markdown-git-mirror-plan.md` §4.8 拆出：联动不依赖 GitHub 镜像，镜像只是 A 通道的离线形态之一。

## 1. 一句话结论

**A 和 B 可以同时开，而且应该同时开：A 是我们 → OpenClaw 的读通道，B 是 OpenClaw → 我们的写通道，互不占用同一文件。** B 需要本项目新增一个 importer 接口（`POST /import/openclaw`），加上一个发布到 ClawHub 的薄插件 `personal-ai-memory` 负责从 OpenClaw 侧推送；A 的在线形态直接复用已经存在的 MCP server（`/mcp`，六个 tool，`routes/mcp.ts:162-176`），离线形态复用镜像仓库的 `interop/openclaw/`。一键配置是合理的：用户在 Options 配 OpenClaw 执行器时已经填了 gateway 地址与 key，我们在同一张卡片上加「联动记忆」区块，签发一把最小权限的用户绑定 key，生成三条 OpenClaw CLI 命令；桌面端 `Personal AI.app` 与 OpenClaw 同机时可代为执行，否则一键复制。两边各留删除权，所有流向在开启前展示给用户确认。

## 2. 两个使用场景

### 场景 A：配好执行器，顺手打开联动

用户在 Options 的「Agent 执行器」里新增 OpenClaw（gateway `http://127.0.0.1:18789`，粘贴 token），点「测试」通过。卡片下方出现「联动记忆」区块：

1. 勾选「让 OpenClaw 读取我的记忆（只读）」与「把 OpenClaw 学到的事带回来（未确认）」。
2. 系统展示一页说明：读通道会给 OpenClaw 哪些内容（confirmed 且关于我的事实、open loops；不含他人事实、不含原文）；写通道会把什么带回来（OpenClaw 的 daily notes 与 MEMORY.md 变更，入库为未确认），以及「OpenClaw 那边的历史需要你在那边删除」。
3. 点「生成配置」：签发一把 scope 为 `memory.read` + `memory.import` 的用户绑定 key（90 天过期，可撤销），生成三条命令。桌面端在线且同机时按钮变成「帮我执行」，否则「复制命令」。
4. 执行后点「验证」：我们从 gateway 侧探测 MCP server 是否已注册、插件是否已启用（复用 `/agent-executors/:id/probe` 的 deep 模式），回执显示「读通道就绪 · 写通道就绪 · 上次导入：无」。

### 场景 B：OpenClaw 在家学到的事第二天出现在 Lens

晚上用户在家用 OpenClaw 订了一张去上海的票，并说「以后出差都订靠窗」。OpenClaw 的 memory flush 把这两条写进它的 `memory/2026-10-10.md`；插件在 `agent_end` 钩子把当晚变更推到 `POST /import/openclaw`。我们入库为 `origin_class=untrusted`、`evidence_class=system_inference`，进睡眠期 B 阶段判决。第二天 Compose 回复差旅相关消息时，Lens 出现一张「来自 OpenClaw，未确认：出差偏好靠窗」的弱提示；用户点「确认」才进 profile。

## 3. 现状（代码事实）

| 已有 | 位置 | 对本方案的意义 |
|---|---|---|
| MCP server：`GET /mcp` 元信息 + `POST /mcp` JSON-RPC，tools `memory_search / memory_ask / memory_evidence_get / memory_save / memory_context_brief / memory_profile_hint`，bearer 鉴权，streamable-http | `routes/mcp.ts:4,162-182` | A 通道在线形态**已存在**，缺的是 OpenClaw 侧注册与 scope 收紧 |
| 用户绑定 key：scope 闭集 `memory.read / memory.write / evidence.raw.read`，每小时最多签 10 把 | `routes/userKeys.ts:48-55` | 新增 scope `memory.import`（只允许写 `origin_class=untrusted` 的导入批次），不给 `memory.write` |
| OpenClaw 执行器：`openClawEnabled / BaseUrl / ApiKey / TimeoutMs / ExecutorType(gateway|responses)`；探测端点 `/agent-executors/:id/probe`（light / deep） | `config.ts:197-209`；`routes/agentExecutors.ts:23-60` | 「联动记忆」区块挂在这张卡片下；探测复用 |
| 导入：`SmartMemoryImportService`（paste / file / external_ai_history / backup_zip）、`memory_import_batches`、claim attribution 必过 | `SmartMemoryImportService.ts:1-20` | importer 复用 batch 与 attribution，新增 `openclaw_memory` 输入类型 |
| 来源闭集与回声标记 | `memory-write-provenance-gate-plan.md` §4.1 / §4.3 | 导入项固定 `untrusted`；带 `pai:unit` 标记的行只写 `derived_from` |
| 既有讨论稿 | `docs/progressing/memory-share-with-openclaw.md` | 其架构 A（Memory Service 做中台、OpenClaw 做客户端）与 C（MCP）就是本方案；其架构 B（共享 MD 文件夹）即镜像 plan §4.8 判定不做的模式 C |
| MCP server plan | `docs/progressing/memory-mcp-server-plan.md`（历史草案，须对齐 foundation §10） | 本方案不改 MCP schema，只做 OpenClaw 侧注册与 scope |
| OpenClaw 侧能力（文档与开源插件核验） | `openclaw mcp add <name> --url <url> --transport streamable-http --include '<tools>'`；`openclaw plugins install clawhub:<pkg>`；`openclaw config set plugins.entries.<id>.hooks.allowConversationAccess true`；`openclaw gateway restart`；插件清单 `openclaw.plugin.json`（`kind: "memory"`，hooks `agent_end` 等）；remnic 与 memsearch 的 OpenClaw 插件即此形态 | 一键配置生成的三条命令全部是已存在的 CLI |

## 4. 方案

### 4.1 两条通道同时开

```
A 读通道（我们 → OpenClaw）
  在线：OpenClaw MCP client ──bearer(memory.read)──▶ /mcp  memory_search / memory_context_brief / memory_profile_hint
  离线：镜像仓库 interop/openclaw/PERSONAL_AI.md（AGENTS.md 引用，instruction tier，OpenClaw 不改写）

B 写通道（OpenClaw → 我们）
  推送：personal-ai-memory 插件 在 agent_end / memory flush 后 ──bearer(memory.import)──▶ POST /import/openclaw
  拉取（备选）：桌面端同机时读 ~/.openclaw/workspace/memory/*.md 与 MEMORY.md 的 diff 推同一接口
```

两条通道的数据面不相交：A 只读我们的 confirmed 自我事实，B 只写我们的 `untrusted` 导入批次；OpenClaw 自己的 workspace 不被我们写，我们的真源不被它写。

### 4.2 A 通道：在线形态的收紧

- 为 OpenClaw 签发的 key 只有 `memory.read`；`--include 'memory_search,memory_context_brief,memory_profile_hint'` 过滤掉 `memory_save` 与 `memory_evidence_get`（原文不出）。
- `/mcp` 对该 key 的所有返回经 `EgressPolicyEngine`（`destination_host` 为 gateway 主机、`purpose=agent_recall`），`observed` 与他人敏感字段不返回；返回段带 `<!-- pai:unit:<id> -->` 标记，供 B 通道回声识别。
- `memory_context_brief` 对 OpenClaw 返回一页纸的 `identity + preferences(confirmed) + open_loops` 投影（`memory-resident-one-pager-plan.md`），预算 ≤ 1,200 token。

### 4.3 B 通道：importer 接口

- `POST /import/openclaw`，body：`{ source: 'openclaw', workspace_id, files: [{ path, kind: 'daily'|'memory'|'user'|'dreams', content_diff | content, content_hash, observed_at }], plugin_version }`。幂等键 `(user_id, workspace_id, path, content_hash)`。
- 处理：拆行 → 带 `pai:unit` 标记的行只写 `derived_from` 并记 `memory_exposures`，不建 unit → 其余行经 claim attribution（speaker 是 OpenClaw agent，`ai_agent` owner）→ 建 `provisional` unit，`origin_class=untrusted`、`evidence_class=system_inference`、`source_type=mcp_client`、`scope=self` → 进睡眠期 B 阶段判决；**永不直接进 profile / truth / 一页纸 identity**。
- `DREAMS.md` 与 dreaming 报告不导入（OpenClaw 自己也把它们排除在 promotion 之外）。
- 导入项在 Lens / Ask 回执标「来自 OpenClaw，未确认」；用户确认后才升为 `active`。
- 删除：用户在我们这边删除导入 unit 不影响 OpenClaw；UI 提示「OpenClaw 侧请执行 `openclaw memory forget`」。

### 4.4 `personal-ai-memory` OpenClaw 插件（薄）

- `openclaw.plugin.json`：`kind: "memory"` 之外的「companion」形态，不占 `plugins.slots.memory`（不替换 OpenClaw 自己的 memory-core，否则会关掉它的 Dreaming），只注册 `agent_end` 与 memory flush 后的钩子，把本次会话写入的 memory 文件 diff 推送到 `/import/openclaw`。
- 配置项：`serviceUrl`、`apiKey`（memory.import）、`pushDailyNotes`、`pushMemoryMd`、`pushUserMd`（默认开 / 开 / 关）。
- 需要 `hooks.allowConversationAccess`（读 workspace 变更）；不需要 `allowPromptInjection`（注入走 MCP）。
- 发布到 ClawHub；源码放本仓库 `integrations/openclaw-plugin/`。

### 4.5 一键配置（Options · OpenClaw 执行器卡片 ·「联动记忆」）

| 步骤 | 我们做什么 | 用户看到什么 |
|---|---|---|
| 1 开关 | 两个勾选：读通道、写通道（可只开一个） | 说明文字：各自给出 / 带回什么 |
| 2 同意页 | 列出 A 的内容范围与 egress 规则、B 的「未确认」语义、两边删除权 | 「我知道了」 |
| 3 签发 | `POST /users/me/keys`，scope 按勾选：`memory.read` / `memory.import`，90 天过期，label `openclaw-link` | key 只显示一次，之后只显示「已配置」 |
| 4 生成命令 | 三条：`openclaw mcp add personal-memory --url <service>/mcp --transport streamable-http --header "Authorization: Bearer <key>" --include 'memory_search,memory_context_brief,memory_profile_hint'`；`openclaw plugins install clawhub:personal-ai-memory` + `openclaw config set plugins.entries.personal-ai-memory.config.serviceUrl <service>` 等；`openclaw gateway restart` | 代码块 + 「复制」 |
| 5 执行 | 桌面端在线且检测到本机 `openclaw` 可执行文件时显示「帮我执行」，由桌面端在本机跑命令并回传输出；否则只复制 | 执行日志 / 复制成功 |
| 6 验证 | `/agent-executors/:id/probe?deep=true` 扩展：经 gateway 查询已注册 MCP server 与插件状态；写通道以「收到第一批导入」为就绪 | 「读通道就绪 · 写通道待首次导入」 |
| 7 撤销 | 「断开联动」：吊销 key、提示在 OpenClaw 侧 `openclaw mcp remove personal-memory` 与 `openclaw plugins uninstall` | 回执 |

合理性边界：我们**不**远程改写用户的 `openclaw.json`（没有可信的远程配置 API 可依赖，且这是用户的机器）；代为执行只发生在同机桌面端，命令全文可见。

### 4.6 与既有 plan 的关系

| plan / 能力 | 关系 |
|---|---|
| `memory-markdown-git-mirror-plan.md` §4.8 | 本方案是其互通模式 A / B 的独立落地；§4.8 保留判定（不做共享读写），实现引用本方案 |
| `memory-share-with-openclaw.md` | 其架构 A + C 的执行版；其架构 B 不做 |
| `memory-mcp-server-plan.md` | 不改 MCP schema；只加 OpenClaw 注册、scope 收紧、egress 评估与回声标记 |
| `memory-write-provenance-gate-plan.md` | 导入固定 `untrusted`；回声标记识别；前置 |
| `memory-sleep-time-reconciliation-plan.md` | 导入 unit 的判决在 B 阶段 |
| `memory-resident-one-pager-plan.md` | `memory_context_brief` 对 OpenClaw 的投影来源 |
| `agent-task-ledger-plan.md` / OpenClaw 执行器 | 共用执行器卡片与探测端点；联动记忆不改变委派语义 |
| `ai-context-passport-plan.md` | 对外上下文包继续走 ContextPack；MCP 返回同样经 `PersonaProjectionService` |

### 4.7 明确不做

- 不让 OpenClaw workspace 指向我们的目录；不替换 OpenClaw 的 memory-core slot。
- 不给 OpenClaw `memory.write` 或 `evidence.raw.read`；不返回原文。
- 不远程改写 `openclaw.json`；不保存用户的 OpenClaw token 以外的任何机器凭据。
- 导入内容不直接进 profile / truth / 一页纸 identity；不导入 `DREAMS.md`。
- 不做 Hermes 以外的其他 agent 一键配置（Hermes 走同一 importer，CLI 不同，列为后续）。

## 5. 数据契约

- 新 scope：`UserApiKeyScope` 增 `memory.import`；`/import/openclaw` 只接受该 scope。
- `memory_import_batches.input_kind` 增 `openclaw_memory`；批次记录 `workspace_id`、`plugin_version`、`files_count`、`echo_lines`、`new_units`。
- `agent_executor` 配置增 `memoryLink: { readEnabled, importEnabled, keyId, lastProbeAt, lastImportAt, status }`。
- 插件推送契约与回声标记格式写入 `docs/features/memory_foundation.md` 的接口节，版本号随 `plugin_version`。

## 6. 实施阶段

| 阶段 | 内容 | 天数 | 门槛 |
|---|---|---|---|
| Phase 0 | A 在线：`memory.read` key + `--include` 过滤 + egress 评估 + 回声标记；手工 `openclaw mcp add` 验证 | 2 | OpenClaw 会话能 `memory_search` 到 confirmed 偏好；拿不到原文与他人事实 |
| Phase 1 | B：`memory.import` scope + `/import/openclaw` + 回声识别 + 「未确认」标记 | 3 | 导入 100 行中带标记的行 0 条成新 unit；新 unit 全部 untrusted |
| Phase 2 | `personal-ai-memory` 插件（agent_end 推送）发布 ClawHub | 3 | 连续 7 天推送成功；不占 memory slot |
| Phase 3 | Options「联动记忆」区块：同意页、签发、命令生成、复制、验证、断开 | 3 | demo 流程可走通；key 只显示一次 |
| Phase 4 | 桌面端同机代执行 + 探测扩展 | 2 | 代执行日志可见；探测能报两通道状态 |
| Phase 5（可选） | Hermes importer（读 `~/.hermes/memories/`） | 2 | — |

## 7. Evals（上线门槛）

新增 `memory-service/evals/openclaw-memory-link/`：

| case 组 | 最少条数 | 门槛 |
|---|---|---|
| A 返回不含原文 / 他人事实 / `observed` / restricted | 全量扫描 | 违规 0 |
| A `--include` 之外的 tool 调用被拒 | 3 | 拒绝 100% |
| B 回声行不成新 unit | 10 | 新 unit 0 |
| B 新 unit 全部 untrusted 且不进 profile / truth | 10 | 违规 0 |
| B 用户确认后升 active，拒绝后不再提示 | 6 | 违规 0 |
| 一键配置：key 一次显示、撤销后 `/mcp` 401 | 4 | 违规 0 |

## 8. 风险与缓解

- **OpenClaw 把我们的内容再提炼进它的 MEMORY.md，再被 B 带回来**：回声标记 + `derived_from`，不建 unit；echo dampener 只认独立来源。
- **key 泄漏**：最小 scope、90 天过期、label 可见、一键吊销；`/mcp` 对 `memory.read` 永不返回原文。
- **插件与 OpenClaw 版本漂移**：remnic 的做法是 60 天兼容窗口；我们在插件清单声明 `compat.pluginApi`，探测报版本。
- **用户误以为双向同步**：同意页与 Lens 标记都写「未确认」「不同步删除」。
- **代执行安全**：仅同机桌面端、命令全文可见、不含 sudo、用户点击触发。

## 9. 可观测性与回滚

- 指标：A 调用数 / 被 egress 过滤数；B 批次数 / 回声行数 / 新 unit 数 / 确认率；探测状态。
- Flag：`OPENCLAW_MEMORY_LINK_READ`、`OPENCLAW_MEMORY_LINK_IMPORT`、`OPENCLAW_LINK_ONE_CLICK`。
- 回滚：吊销 key 即断读；关 import flag 即拒收；已导入 unit 保留为 untrusted 可批量归档。

## 10. Demo 说明

`openclaw-memory-link-demo.html` 模拟 Options 的 OpenClaw 执行器卡片下方的「联动记忆」区块：两个开关、同意页、签发 key、三条命令、「帮我执行 / 复制」、验证回执、断开。文案中文，命令为示例。

## 11. 文档交接

实现后并入 `docs/features/agent_executor_runtime.md`（新增「联动记忆」节）与 `docs/features/memory_foundation.md`（接口节：MCP scope、import 契约、回声标记），更新 `docs/index.md`，删除本 plan，demo 移至 `docs/demo/`。

## 12. 推荐决策

Phase 0 两天即可验证 A 的价值（OpenClaw 立刻能读到 confirmed 偏好）；B 与插件在 provenance gate 落地后做；一键配置最后做，因为它只是把前面三步变成按钮。
