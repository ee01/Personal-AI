# 新能力：AI Memory Portability Ledger / AI 记忆迁移账本（搁置）

> 生成时间：2026-07-09 CST
> 建议标题：`新能力：AI 记忆迁移账本（搁置）`
> Demo：[`ai-memory-portability-ledger-demo.html`](./ai-memory-portability-ledger-demo.html)

## 搁置原因

当前暂时不建议推进 **AI Memory Portability Ledger / AI 记忆迁移账本**。

核心原因是使用场景频率偏低。用户确实会接触 ChatGPT、Claude、Gemini、Codex、Cursor、OpenClaw 等多个 AI 工具，但“把某个平台已经沉淀的 memory 正式迁入/迁出另一个平台，并且需要 round-trip 对账”的动作不会高频发生。它更像换平台、试新工具、迁移账户、集中整理外部 AI 历史时才会出现的低频治理场景。

在当前阶段，Personal AI 更应该优先投入高频场景：当前页面 / 聊天 / 会议 / Ask / Compose 中的召回准确性、证据边界、外部 AI 历史基础导入、Coverage Map 可见性，以及已有迁出前的隐私 / 身份边界。`AI 记忆迁移账本` 的价值成立，但不适合作为近期独立能力或 P0 进入实现。

本方案先保留为搁置方向。未来如果用户真实开始频繁使用 Claude / Gemini / ChatGPT 的 memory import / export，或需要把 Personal AI 作为跨 AI memory 真源对外同步，再恢复评估。恢复时仍应优先作为 Coverage Map 的嵌入式迁移 / 对账抽屉，而不是新建日常 review 页面。

## 真实场景 1：把 ChatGPT 记住的偏好迁到 Claude 前，先由 Personal AI 对账

用户想试 Claude 的 memory import，不想重新训练一遍，也不想把公司项目事实、未确认推断或敏感关系上下文原样复制出去。

1. 用户打开 `memory-exploring.html#/coverage`，在 `外部 AI 历史` 旁看到新的 `AI 记忆迁移账本` 卡片。
2. 用户把 ChatGPT data export 里的 memory / conversations 摘要，或者 Claude import flow 生成的 memory block 粘进抽屉。
3. Personal AI 只做 dry-run：把每条 provider memory 拆成 `偏好 / 事实 / 技能 / 项目口径 / 人际上下文 / 敏感`，再和 Personal AI 的 confirmed profile、source memory、skills、project facts 做匹配。
4. 页面显示迁移账本：
   - `已对齐`：Claude 可以安全继承的稳定偏好。
   - `只在 Personal AI 中可用`：来自 RingCentral/Jira/会议的工作事实，不能盲目外发。
   - `冲突`：provider 记忆里的旧说法和 Personal AI 当前事实不一致。
   - `缺来源`：旧 AI 自己总结出来，但没有可复核证据。
   - `默认排除`：secret、私人关系判断、未确认用户画像。
5. 用户点 `生成 Claude 导入包`，得到一个短的、目标平台适配的 memory block：只含稳定偏好和必要工作方式，不含原始证据、不含公司敏感原文。
6. 用户完成 Claude 导入后，再把 Claude 的 memory export 或 View Memory 内容贴回 Personal AI。账本显示：Claude 吸收了 12 条、压缩丢失 3 条、误合并 1 条、保留了 0 条敏感项。

用户感受：不是“我把一坨记忆搬给另一个 AI”，而是“Personal AI 帮我确认迁出去的到底是什么、有没有被对方记歪、是否能撤回或重新生成”。

## 真实场景 2：外部 AI 导入历史后，不把旧 assistant 回答当成当前事实

用户导入一批 Claude / ChatGPT / Gemini 历史，其中包含旧 assistant 对 Codex、Claude、Gemini、Jira 状态的判断。当前 Personal AI 记忆里已经有大量 AI 工具讨论、Codex/Cursor/Claude/Gemini 实体，以及自我反思线程持续跟进工具状态。

1. Coverage Map 显示 `外部 AI 历史` 已导入，但 `AI 记忆迁移账本` 标出 `需要对账`。
2. 用户点开后看到一条 provider memory：`ChatGPT was unavailable and Codex was recommended as alternative`。
3. Personal AI 不把这条直接写成 confirmed profile，也不自动覆盖当前技术状态；它显示：
   - 来源：旧 AI 对话。
   - Personal AI 现有证据：ChatGPT availability / Codex recommendation_status 仍有反思线程，且需要当前外部验证。
   - 迁移建议：保留为 `provider_memory_evidence`，不进入 confirmed profile；如果要给外部 AI 使用，必须带 `as of` 时间和来源边界。
4. 用户复制给 Gemini 的 memory package 时，这条不会作为“现在事实”出现，只会变成一条带时间口径的背景：`Earlier memory suggested Codex was a recommended fallback; verify current availability before acting.`

用户感受：外部 AI 的历史价值被保留，但不会污染 Personal AI 的当前事实，也不会让另一个 AI 继承旧误解。

## 结论

建议设计 **AI Memory Portability Ledger / AI 记忆迁移账本**。

它不是再做一次外部 AI 历史导入，也不是 AI Context Passport 的另一个名字。它解决的是更具体的迁移问题：

> 当用户把 ChatGPT / Claude / Gemini / Codex / Cursor / OpenClaw 等平台里的记忆、偏好、聊天历史或 skill 迁入/迁出 Personal AI 时，Personal AI 需要记录“迁了什么、没迁什么、哪里失真、哪些不能外发、对方是否真的吸收”，并保持 Personal AI 作为用户记忆真源。

一句话价值：

> 让用户可以换 AI、试 AI、迁移 AI 记忆，但不会失去控制权，也不会让旧平台的压缩记忆污染 Personal AI 的真源。

## 本次输入信号

### Reminder 检查

通过 EventKit 读取本机 Reminders 成功，`Personal AI` 列表存在，但未完成项为 `0`。因此本次没有从 Reminder 选择 idea，也没有标记任何 Reminder item done 或写备注。

### Repo 去重

已检查 `docs/progressing/to-verify.md`，当前为 `暂无。`。本计划刻意避开最近和相邻方向：

- `Research Trail Synthesizer`：研究问题和资料足迹合成。
- `Evidence Cohesion Gate（证据对齐）`：使用证据前判断候选是否围绕同一个问题。
- `Action Readiness Contracts`：外部动作执行前检查能力、凭据、输入和审批。
- `Change Memory Ledger`：字段旧值/新值事件链。
- `AI Context Passport`：把当前任务上下文打包给另一个 AI。
- `AI Conversation Memory Loom`：多 AI 对话聚类合成，已搁置。
- `Memory Egress Firewall` / `Persona Projection Contract`：外发安全和身份代表边界。
- `Memory MCP Server`：把 Personal AI 记忆暴露给 MCP 客户端。
- `Memory Coverage Map`：当前只覆盖外部 AI 历史基础录入、备份、质量分和覆盖可见性。

本计划新增的是“迁移账本 + round-trip 对账 + provider memory drift 检测”，不是导入、外发、防火墙、会话合成或 MCP tool 本身。

### 真实 memory-service 信号

只读查询 `10.32.56.212:3210`，使用 `X-User-Id: esone.qiu`：

- `/health` 可达但 degraded：`database.connected=false`，因此只把 health 当运行状态，不当数据完整性证明。
- `/api/v1/stats` 返回：`11289` messages、`10120` chunks、`14186` entities、`54683` relationships、`30` pending confirm requests；retrieval tiers 同时存在 active / archive_only / forgotten / weak。
- Coverage pressure 切片显示：`113` queued actions、`30` pending confirm requests、`885` active reflection threads、`1028` total pressure items。
- Messages by source 显示：`glip 10022`、`calendar 518`、`meeting 318`、`jira 134`、`web 124`，外部 AI 目前更多是导入/会话/实体信号，不是稳定 provider memory 对账。
- 实体搜索显示外部 AI 工具密集存在：`Claude` 相关 `236`、`Cursor` `170`、`OpenAI` `155`、`Codex` `112`、`Gemini` `103`、`ChatGPT` `39`。
- Skills sync 切片显示平台层已有状态：`openclaw` enabled 且 installed 10，`personal_ai` installed 3；`codex`、`cursor`、`claude_code`、`chatgpt_gpts`、`claude_skills_web` 当前多为规划/未启用。这说明“平台同步状态”已有雏形，但“平台记忆内容是否对齐”还没有账本。

这些信号共同指向一个空位：用户已经处在多 AI 工具生态里，Personal AI 有大量真实工作记忆，但外部 AI 平台的 memory import/export 正在形成行业心智。如果 Personal AI 只会导入 conversations，而不会对账 provider memory，用户最终会在多个 AI 里得到几份相互偏差的“我是谁 / 我在做什么 / 我偏好什么”。

## 行业和研究参考

| 来源 | 观察 | 对 Personal AI 的启发 |
|---|---|---|
| [OpenAI Memory FAQ](https://help.openai.com/articles/8590148-memory-faq) | ChatGPT 已有 Memory Sources，可查看影响个性化回答的来源、编辑 saved memories、标记相关/不相关。 | 用户开始期待 AI 能说明“用到了哪些记忆”；迁移时也需要说明哪些记忆被带走。 |
| [OpenAI ChatGPT data export](https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data) | ChatGPT 支持从 Data Controls 导出数据。 | Personal AI 应把外部 data export 当成用户主动提供的迁移输入，而不是默认同步。 |
| [Claude memory import/export](https://support.claude.com/en/articles/12123587-import-and-export-your-memory-from-claude) | Claude 支持从其他 AI providers 导入 memory，也支持导出 Claude memory 做备份或迁移。 | AI memory portability 已经成为用户迁移心智；Personal AI 要做迁移前后质量对账。 |
| [Gemini import from other AI platforms](https://support.google.com/gemini/answer/16868299?hl=en) | Gemini 可以导入其他 AI 平台的偏好、remembered facts、context 和 chat history。 | 外部 AI 会越来越愿意吸收“别的 AI 对用户的总结”，失真和过度分享风险随之上升。 |
| [Gemini Apps Privacy Hub](https://support.google.com/gemini/answer/13594961?hl=en) | Gemini 把 saved info、past chats、connected apps、temporary chats、imported data 等数据源放进隐私控制叙述。 | 迁移账本必须区分来源类别、目标平台和数据控制边界。 |
| [MCP specification](https://modelcontextprotocol.io/specification/2025-06-18) | MCP 标准化 LLM 应用与外部数据源/工具的连接。 | 长期看 provider memory 对账可通过 MCP / connector 实现，但 P0 仍应从用户主动上传/粘贴开始。 |
| [NSA MCP security considerations](https://www.nsa.gov/Portals/75/documents/Cybersecurity/CSI_MCP_SECURITY.pdf) | MCP 已成为 AI 自动化连接生态的关键协议，安全设计需要显式考虑。 | 未来直连 provider memory 时，不能只做“同步开关”，必须有 scope、审计、撤回、最小化。 |
| [Response-Aware User Memory Selection](https://arxiv.org/abs/2604.14473) | 记忆选择不能只靠 query similarity，还要看记忆对响应分布的实际效用。 | 迁出给外部 AI 的 memory package 应按目标任务/平台选择高效用项目，而不是全量导出。 |
| [Opal: Private Memory for Personal AI](https://arxiv.org/abs/2604.02522) | 私人 AI 长期记忆会包含文档、邮件、消息、会议、ambient recordings，隐私和访问模式本身就是问题。 | Personal AI 作为真源时，迁移默认应最小化、脱敏、带来源计数，不输出完整私密证据。 |
| [LongMemEval](https://arxiv.org/abs/2410.10813) | 长期记忆需要覆盖信息抽取、多会话推理、时间推理、知识更新和拒答。 | 迁移 eval 不能只看“导入了多少条”，还要测旧事实更新、时间口径和不该答时拒答。 |
| [Portable Agent Memory](https://arxiv.org/html/2605.11032v1) | 讨论 agent memory 通信、provenance、capability-based access control 和 transfer integrity。 | 迁移账本的数据结构应保留 provenance、scope、hash 和目标能力，避免无校验复制。 |

## 功能定义

### 核心对象

**Provider Memory Source**

某个外部 AI 平台的记忆来源，例如：

- ChatGPT saved memories / data export / past-chat summary。
- Claude memory import/export block。
- Gemini imported memory / saved info / chat history package。
- Codex / Cursor / Claude Code 的本地 instruction、project memory、session summary。
- OpenClaw / skill runtime 中的 memory 或 skill state。

**Memory Portability Batch**

一次迁入、迁出或回灌检查的批次。它保留：

- source provider、target provider、用户选择的 scope。
- 输入类型：zip、json、plain memory block、MCP snapshot、manual paste。
- source hash、parser version、生成时间、有效期。
- dry-run 结果：aligned / conflict / provider_only / personal_only / sensitive_blocked / unsupported / low_confidence。

**Canonical Memory Projection**

Personal AI 对外部平台可用的“目标平台记忆投影”，不是原始记忆全量导出。每条投影必须带：

- `canonicalId`：Personal AI 内部真源对象，例如 profile item、skill、source capsule、project fact。
- `projectionText`：给目标 AI 的简短版本。
- `scope`：work / personal / both。
- `authority`：confirmed / source_grounded / local_evidence / provider_claim / unconfirmed。
- `targetPolicy`：可导出、只本地引用、需确认、排除。
- `sourceReceipt`：来源计数、最新时间、hash，不默认吐原文。

**Round Trip Audit**

用户把目标 AI 吸收后的 memory export / View Memory 内容贴回 Personal AI 后，系统比较：

- 目标 AI 是否吸收。
- 是否过度压缩。
- 是否把 scope 混掉。
- 是否把旧时间口径改成当前事实。
- 是否新增了 provider hallucinated memory。
- 是否把敏感或未确认内容记进去了。

## 不是做什么

- 不是自动抓取用户所有 ChatGPT / Claude / Gemini 数据。
- 不是替代 Coverage Map 的外部 AI 历史基础录入。
- 不是替代 AI Context Passport 的当前任务上下文包。
- 不是让用户每天 review provider memory。
- 不是默认把 Personal AI 全部记忆同步给外部 AI。
- 不是把旧 assistant 回答直接升级为 confirmed fact。
- 不是外发防火墙；它会调用外发/身份/隐私策略，但主对象是“迁移后是否对齐”。

## 用户体验设计

### 入口：Coverage Map 集成卡

位置建议：`memory-exploring.html#/coverage` 的 `外部 AI 历史` 与 `技能同步` 附近新增 `AI 记忆迁移账本` 卡片。

首屏卡片显示：

- 已知 provider memory sources：ChatGPT / Claude / Gemini / Codex / Cursor / OpenClaw。
- 最近一次迁移批次和目标平台。
- 对齐率，例如 `16/22 可安全迁移`。
- 风险计数：`3 条冲突`、`2 条仅本地可用`、`1 条目标平台失真`。
- 只读边界：卡片打开只会 dry-run / 生成本地 package，不会直接写外部平台。

### 抽屉结构

抽屉不做独立新页面，避免和 Coverage Map 分裂。

1. **对账**
   - 粘贴 / 上传外部 AI memory block 或 export。
   - 展示分类矩阵：已对齐、冲突、provider-only、Personal-only、敏感阻断。
   - 每行显示“为什么这样分”：source、authority、target policy、时间口径。

2. **生成导入包**
   - 选择目标：Claude / Gemini / ChatGPT / Codex / Cursor / OpenClaw。
   - 选择 scope：只个人偏好、工作方式、当前项目、技能说明、全部可迁移。
   - 选择格式：plain memory block、Markdown、JSON manifest、MCP resource。
   - 生成 package 前先显示 `导出范围回执`：包含条数、被排除条数、目标平台限制、有效期和无副作用边界。

3. **回灌检查**
   - 用户把目标平台吸收后的 memory export / View Memory 贴回。
   - 系统显示 round-trip audit：
     - `已吸收`。
     - `被压缩但含义保留`。
     - `失真`。
     - `误合并`。
     - `目标平台新增但 Personal AI 无来源`。
     - `不应被目标平台记住`。
   - 给出修复动作：复制 correction prompt、重新生成更窄导入包、在 Personal AI 标记 provider-only evidence、丢弃 provider hallucination。

### 关键回执

- `迁移输入回执`：读取了哪个文件/粘贴块，parser 是什么，本次只 dry-run。
- `匹配口径回执`：本轮按哪些 Personal AI 真源匹配，不读取哪些隐私/secret。
- `目标平台回执`：目标平台只会得到最小 projection，不得到完整证据。
- `时间口径回执`：过期或历史 provider memory 不会被表述为当前事实。
- `回灌失真回执`：目标 AI 吸收后的内容不等于 Personal AI 已确认。
- `未写入回执`：关闭抽屉或复制 package 不会写入外部平台、不会修改 Personal AI 真源。

## 数据契约草案

```ts
type ProviderId =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'codex'
  | 'cursor'
  | 'openclaw'
  | 'doubao'
  | 'manual';

type MemoryPortabilityBatch = {
  id: string;
  userId: string;
  direction: 'import_dry_run' | 'export_package' | 'round_trip_audit';
  sourceProvider: ProviderId;
  targetProvider?: ProviderId;
  inputKind: 'zip' | 'json' | 'memory_block' | 'mcp_snapshot' | 'manual_text';
  sourceHash: string;
  parserVersion: string;
  createdAt: number;
  status: 'draft' | 'ready' | 'blocked' | 'completed';
  summary: {
    inputItems: number;
    aligned: number;
    conflicts: number;
    providerOnly: number;
    personalOnly: number;
    sensitiveBlocked: number;
    unsupported: number;
    lowConfidence: number;
  };
  receipt: {
    scopeApplied: 'work' | 'personal' | 'both';
    sideEffect: 'dry_run_only' | 'local_package_only' | 'external_write_confirmed';
    generatedAt: number;
    expiresAt?: number;
  };
};

type ProviderMemoryItem = {
  id: string;
  batchId: string;
  provider: ProviderId;
  rawTextHash: string;
  normalizedText: string;
  memoryKind:
    | 'user_preference'
    | 'work_style'
    | 'project_fact'
    | 'relationship_context'
    | 'skill_hint'
    | 'conversation_summary'
    | 'sensitive'
    | 'unknown';
  asOf?: string;
  sourceRefs: string[];
  authority: 'provider_claim' | 'source_grounded' | 'confirmed' | 'unconfirmed';
  targetPolicy: 'export_ok' | 'local_only' | 'needs_confirm' | 'blocked';
};

type MemoryPortabilityMatch = {
  providerItemId: string;
  canonicalId?: string;
  matchState:
    | 'aligned'
    | 'conflict'
    | 'provider_only'
    | 'personal_only'
    | 'sensitive_blocked'
    | 'unsupported'
    | 'low_confidence';
  reasonCode:
    | 'same_meaning'
    | 'stale_provider_memory'
    | 'missing_source'
    | 'scope_crossing'
    | 'secret_or_private'
    | 'target_platform_limit'
    | 'personal_truth_newer'
    | 'provider_hallucination';
  explanation: string;
  proposedProjection?: {
    text: string;
    targetProvider: ProviderId;
    tokenEstimate: number;
    sourceReceipt: string;
  };
};
```

## API 草案

P0 可以全部本地/Memory Service 内部完成，不需要真实外部 provider 写入。

| API | 作用 | 副作用 |
|---|---|---|
| `POST /api/v1/memory-portability/inspect` | 解析 provider memory block / export，生成 dry-run batch | 只写本地 batch receipt 或完全无写入；不改真源 |
| `POST /api/v1/memory-portability/packages` | 基于 Personal AI 真源生成目标平台导入包 | 只生成本地 package；不外发 |
| `POST /api/v1/memory-portability/audit` | 用户贴回目标平台 memory 后做 round-trip audit | 只生成 audit report |
| `GET /api/v1/memory-portability/batches?limit=...` | Coverage Map 读取最近迁移账本 | 只读 |
| `POST /api/v1/memory-portability/:id/dismiss` | 用户隐藏某条 provider hallucination / low-value diff | 本地账本状态，不改 provider |

未来 P2 如果有官方 API / MCP connector，再考虑真实 provider read/write；届时必须走 explicit confirm、scope、audit 和 revoke receipt。

## 实施切片

### P0：Coverage Map 集成 + 手动 provider memory block 对账

目标：不接真实外部 API，只支持粘贴/上传 memory block、ChatGPT/Claude/Gemini 常见 export 片段和 Personal AI 内部 projection。

实现：

- 新增 portability parser：识别 plain memory lines、Claude memory import/export block、ChatGPT export 中的 memory-like item、Gemini import package 文本。
- 新增 matcher：和 confirmed profile、source memory distillation、personal skills、entity properties 做保守匹配。
- 新增 Coverage Map 卡片和抽屉。
- 新增 package generator：目标 provider prompt block + JSON manifest。
- 所有写入默认只保存 batch receipt，不修改 profile / skills / facts。

验收：

- 用户能粘贴一段 provider memory，看到分类矩阵。
- 用户能生成 `Claude` / `Gemini` 导入包。
- 用户能贴回目标平台 memory，看到 round-trip audit。
- 敏感 / 未确认 / 旧事实不会进入导入包。

### P1：外部 AI 历史导入批次联动

目标：复用 Coverage Map 已有 `memory_import_batches`，当用户导入 ChatGPT / Claude `conversations.json` 或 Gemini history 时，自动生成一条 `需要对账` 的 portability batch。

实现：

- 从外部 AI conversations 中抽取 `memory candidates`，但不直接晋升。
- 把高价值候选转到 `User Profile` 待确认、`Skill Foundry` suggestion 或 `source memory`，仍走各自门控。
- 在 Coverage Map 的外部 AI 平台卡显示 `已导入历史` 与 `provider memory 已对账 / 未对账` 分离。

### P2：MCP / connector 直连 provider memory 状态

目标：当 Claude / Codex / Cursor / OpenClaw 等支持 MCP 或可读 memory state 时，允许只读探测 provider memory 状态。

实现：

- provider connector 必须声明 capabilities：read memory、write memory、delete memory、export memory、scope support、provenance support。
- 默认只读；写入需要 explicit confirmation 和 package preview。
- 接入 `Memory MCP Server` 后，目标 AI 可以请求 `memory_package`，但响应带 target-scoped projection，不暴露原始库。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 用户误以为复制 package 已写入目标平台 | 所有 package 按本机剪贴板 / 下载回执展示，明确外部平台未确认吸收。 |
| 外部 AI export 格式变化 | Parser version 写入 batch；未知格式进入 blocked / unsupported，不假装成功。 |
| 旧 assistant 回答污染当前事实 | provider memory 默认 `provider_claim`；只有 Personal AI 真源证据和 authority gate 通过后才进入 confirmed。 |
| 过度外发私人/工作敏感内容 | 调用 Persona Projection / Secret / Egress 策略；默认只输出 summary projection 和 source count。 |
| 用户被对账结果淹没 | 默认只在迁移动作后显示；Coverage Map 只给摘要，不做日常 review queue。 |
| provider hallucination 被保留 | Round-trip audit 标 `provider_hallucination`，只作为 provider-specific evidence，不进入真源。 |
| 多平台 memory 互相覆盖 | Personal AI 永远是 canonical source；provider memory 是 projection 或外部证据，不是权威写源。 |

## Eval 计划

需要新增 evals。原因：功能价值依赖 memory normalization、跨平台语义匹配、冲突识别、敏感排除、目标平台 package 质量，以及 round-trip 失真检测，不能只靠 UI E2E。

建议 suite：`ai-memory-portability-ledger`

目录：

```text
evals/cases/ai-memory-portability-ledger/
evals/workflows/ai-memory-portability-ledger/experience.md
```

第一批真实场景：

1. **稳定偏好迁移**：用户偏好“直接、分步骤、关注证据边界”应进入 Claude/Gemini package，且带来源/确认状态。
2. **工作事实排除**：Jira、RingCentral、会议里的公司内部事实不得进入通用 personal provider package。
3. **旧事实不冒充当前事实**：ChatGPT availability / Codex recommendation 这类时间敏感 provider memory 必须保留 as-of，或要求当前验证。
4. **敏感内容阻断**：token、meeting link password、secret-like source memory 不得出现在任何 provider package。
5. **skill hint 路由**：可迁移工作流应转 Skill Foundry suggestion 或 skill package，不写成普通用户偏好。
6. **round-trip 失真**：目标平台把“用户喜欢结构化证据”压成“用户讨厌长答案”时，audit 必须标 distortion。
7. **provider hallucination**：目标平台新增 Personal AI 无来源的“用户正在做 X 项目”，不得写入 canonical memory。

执行要求：

```bash
npm run eval:validate
npm run eval:run -- --suite ai-memory-portability-ledger --no-repair
```

如果实现改动涉及 recall / write path，还需要按 `AGENT.md` 跑：

```bash
npm run eval:memory-abilities
```

目标：每次实现后生成 report；没有通过时继续修 parser / matcher / policy / package 文案，直到 suite 通过。

## 文档维护要求

实现完成后，需要把关键点精简维护进 canonical docs：

- `docs/features/memory_coverage_map.md`：新增 AI 记忆迁移账本卡片、对账抽屉、round-trip audit、与外部 AI 历史导入的关系。
- `docs/features/user_profile_system.md`：说明 provider memory 不能直接成为 confirmed profile，必须走确认/证据门控。
- `docs/features/memory_system.md`：补充 provider memory 的 trust class、canonical source、迁移 projection 原则。
- `docs/features/personal_skill_foundry.md`：如果迁移中发现 skill hint，应进入 skill suggestion，而不是普通记忆。
- `docs/features/index.md`：新增小功能点，例如 `AI 记忆迁移账本`，归属 Memory Coverage Map / Memory Service。

如果该能力最终成为独立入口，再考虑新建 feature doc；P0 推荐先并入 Coverage Map。

## 未来若恢复的 P0 范围

做：

- Coverage Map 集成卡 + drawer demo 对应的三 tab。
- 手动粘贴/上传 provider memory block 的 inspect。
- Personal AI canonical projection generator。
- Round-trip audit。
- 本地 batch receipt / source hash / parser version。
- Target provider package for Claude / Gemini / ChatGPT / Codex generic Markdown。
- eval suite 和 report。

不做：

- 不直连 ChatGPT / Claude / Gemini 账号。
- 不自动写目标 AI memory。
- 不做 provider deletion / revoke。
- 不全量导出 Personal AI 原始消息。
- 不把所有 external AI conversations 都自动晋升为 profile / skill / fact。

## 最终建议

当前不建议推进 P0，先保持搁置。它贴合 Personal AI 的长期愿景：用户的记忆可以来自任意 AI，也可以去任意 AI，但近期真实使用频率不足，不应抢占更高频的召回准确性、场景提示和基础导入体验优先级。

如果未来恢复，这个功能的亮点不是“迁移更快”，而是“迁移后知道有没有记错”。行业产品正在把 memory import/export 做成切换入口，Personal AI 的机会是把它升级成私人记忆的对账、失真检测和可撤回投影。
