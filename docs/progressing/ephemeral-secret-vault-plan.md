# 新能力：Ephemeral Secret Vault / 临时秘密保险箱（搁置）

> 生成日期：2026-06-11 CST
> 状态：搁置；当前不建议实现，未改运行时代码
> Codex 会话标题建议：新能力：临时秘密保险箱（搁置）
> Demo：[`ephemeral-secret-vault-demo.html`](./ephemeral-secret-vault-demo.html)（仅作为已搁置方向的视觉参考）

## 搁置原因

当前不建议推进 **Ephemeral Secret Vault / 临时秘密保险箱**。

用户反馈很明确：现在不必做密码分类存储。Personal AI 当前更重要的问题是**重要记忆提取的准确度**，也就是系统能不能从消息、会议、Jira、网页、外部 AI 对话和 source-memory 里稳定提取真正值得保留、值得召回、能支撑场景提示的高信号记忆。

这个计划虽然发现了真实数据里存在会议链接、拨入密码、token/API key 字样等短期敏感内容，但它会把近期重点拉向凭证/秘密分类、TTL、vault、copy lease 和外发边界。相比之下，用户当前更需要的是：

- 重要事件、事实、决策、偏好、项目状态和可复用经验的提取更准。
- Source Memory Distiller、Dreaming、Self Reflection、Memory Capture 等已有整理链路先把“什么值得记住”做稳。
- Memory Lens、Ask、Compose Assist、Today Pilot 等消费侧先减少低价值噪音和错误提示。
- 不再新增一个与密码/凭证生命周期相关的底层存储方向，避免分散工程和产品注意力。

因此本方案保留为搁置记录：它证明“临时秘密不应成为普通记忆”这个边界有价值，但不是当前优先级。未来只有在重要记忆提取准确度已经稳定、且真实使用中反复出现 raw secret 污染召回或 context pack 的高频问题时，才重新评估。

## 结论

本方案记录为搁置方向：**Ephemeral Secret Vault / 临时秘密保险箱**。

它不是密码管理器，不是新的隐私总览页，也不是已经搁置的 `Memory Egress Firewall`。它解决的是 Personal AI 越记越多之后一个更靠近底层的缺口：

> 日历、会议、消息、网页、外部 AI 对话和操作记录里会自然出现会议链接、拨入密码、OAuth code、JWT、API key、一次性验证码、临时下载链接和其他短期凭证。Personal AI 需要知道这些内容“可以用，但不应该被长期当作普通记忆检索、嵌入、总结或外发”。

一句话产品承诺：

> 让 Personal AI 记住工作现场，但不把临时秘密变成长久记忆。系统默认生成脱敏记忆投影，只在正确时间、正确场景给本地动作入口，并在过期后自动退出默认召回。

如果未来重新启动，第一版也不应要求用户每天审查秘密列表。写入时由服务自动识别、脱敏、隔离和设置 TTL；用户只在需要“复制原文、打开链接、延长保留、外发给其他 AI”这类高责任边界时看到明确回执和确认。

## 本次输入信号

### Reminders 检查

本机 Reminders 可枚举，当前列表为：

- `We`
- `Next actions`
- `Moives`
- `Shopping List`
- `家庭`
- `人名记忆`
- `宝宝需要办理`
- `吃吃看`
- `出门前检查`
- `装修待办`
- `Reading`
- `菜头`
- `Tasks`

没有名为 `Personal AI` 的列表。因此本轮没有从 Reminder item 选择 idea，也没有需要标记 done 或写备注的 Reminder item。

### `docs/progressing` 去重

已检查 `docs/progressing/to-verify.md`，当前为 `暂无。`

相邻方案边界：

| 已有方案 | 负责什么 | 本方案不重复的地方 |
| --- | --- | --- |
| `Memory Egress Firewall`（搁置） | 记忆即将发给外部 AI 前的出站预检 | 本方案更前置，处理写入、嵌入、召回和 TTL，不等到外发时才发现 raw secret 已经进了记忆库。 |
| `Memory Lifecycle Gardener` | 普通记忆的影响力衰减、归档、默认召回资格 | 本方案只处理秘密和短期凭证，有更严格的原文隔离、过期和本地动作策略。 |
| `Memory Capture` | 网页/选区/source-memory 是否值得入库，已能挡 secret/token/password | 本方案覆盖普通 calendar/message/raw ingest、外部 AI 历史、操作日志和未来 meeting memory，不局限于网页捕捉入口。 |
| `Source Memory Distiller` | 把资料 capsule 蒸馏成 takeaways、facts、trigger cards | 本方案先保证 secret 不进普通 capsule/chunk/embedding；Distiller 只能消费脱敏投影。 |
| `AI Context Passport` / `Day Pilot` / `Meeting Pilot` | 把上下文带到 AI、今天、会议现场 | 本方案给它们提供 `secret-aware` 的上下文和动作入口，而不是替代这些场景能力。 |
| `Memory Trust Console` | 大范围可信/隐私治理台，已搁置 | 本方案不是全局治理台，只是入库和召回管线的一类数据原语。 |

### 真实记忆信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 用户记忆。本次 `GET /health` 可达但全局 DB 状态为 `degraded`，因此使用 `X-User-Id: esone.qiu` 的用户级 `/api/v1/stats` 和 SSH 只读 SQLite 采样。

用户级 stats：

- `messages_raw`: 9,778
- 今日消息：190
- 本周消息：390
- 近 90 天消息：2,828
- `chunks`: 8,097
- `entities`: 13,796
- `relationships`: 50,383
- pending confirm requests: 28
- retrieval tiers: `active=6259`、`archive_only=2660`、`forgotten=2255`、`weak=387`

只读 SQLite 抽样看到的敏感/短期模式：

| 模式 | 近似计数 | 说明 |
| --- | ---: | --- |
| `pw=` | 132 | RingCentral meeting join URL 里出现会议密码参数。 |
| `Meeting ID` | 147 | 日历事件里保存了会议 ID。 |
| `password` / `密码` | 70 | 日历和配置讨论里出现密码字段。 |
| `token` | 137 | token 词频较高，包含工具、预算和凭证语境，需要分类。 |
| `jwt` | 7 | 和 RingCentral / scheduled messages 配置有关。 |
| `oauth` | 15 | 授权语境。 |
| `api key` | 36 | 需要避免被普通召回和外发。 |

近期样本里有多条未来日历事件，例如 `Nova Brandy Daily`、`RCV & RCW mobile daily`、`RCV Project Weekly Review`，正文里含 `https://v.ringcentral.com/join/... ?pw=...`、`Meeting ID`、`Password`、拨入密码和电话拨入串。当前 `calendarEvents.ts` 会把 `descriptionPreview` 渲染进 `messages_raw.content` 和 `chunks.content`，这意味着会议密码可能进入普通全文检索、向量嵌入、Ask/Recall/Context Recall 和未来 context pack。

这不是一个抽象安全担忧，而是当前数据里已经发生的现象。

## 为什么值得做

Personal AI 的目标是“留存自己和 AI 的所有记忆”，但真实私人记忆系统不应该把所有字符串都等价保存。人的记忆会保留“我有一个会议、谁邀请我、什么时候开、为什么重要”，但不会把会议密码、一次性 code、短期下载链接当作长期事实反复想起。

临时秘密保险箱的价值是把这件事产品化：

1. **提高信任感**：用户知道 Personal AI 会记住工作现场，但不会把会议密码和 token 塞进普通记忆。
2. **提高召回准确性**：Ask / Memory Lens / Compose Assist 不再被拨入串、密码、URL 参数污染。
3. **降低跨 AI 泄露风险**：Context Passport、Compose Assist、Doubao Bridge、Codex/OpenClaw 只拿到脱敏投影，不会顺手复制 raw secret。
4. **保留可用性**：需要加入会议时，系统仍能给 `本地打开会议`、`复制一次`、`查看来源` 这类动作，而不是把链接完全丢掉。
5. **符合用户习惯**：用户不需要维护一个新队列。默认后台处理，只有复制原文或延长保留时打扰。

最惊艳的体验不是“有一个秘密列表”，而是用户以后看到 Personal AI 的 context pack 时，会出现类似这样的回执：

> 已带入会议主题、参会人、议程和历史决策；会议链接和拨入密码保留在本机动作里，未进入 AI 上下文。

## 行业产品和研究信号

### 1. Microsoft Recall 已经把敏感信息过滤做成默认行为

[Microsoft Recall 隐私控制](https://support.microsoft.com/en-us/windows/privacy-and-control-over-your-recall-experience-d404f672-7647-41e5-886c-a3c59680af15) 和 [Recall sensitive information filtering](https://support.microsoft.com/en-us/windows/filtering-apps-websites-and-sensitive-information-in-recall-a4c28bee-e200-4a4a-b60d-c0522b404a5b) 都说明，屏幕级记忆产品需要默认过滤密码、信用卡等敏感信息。对 Personal AI 的启发是：记忆不是越完整越好，敏感原文应在写入侧就被识别，而不是等用户事后删除。

### 2. GitHub Secret Scanning 证明“进入长期库之前阻断”比事后报警更好

[GitHub push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection) 的核心是阻止 token、API key 等秘密进入代码库；[secret scanning](https://docs.github.com/code-security/secret-scanning/about-secret-scanning) 则用于发现已经扩散的 secret。对 Personal AI 的启发是：第一优先级应该是让 raw secret 不进入普通 `messages_raw/chunks/embeddings`，而不是以后再从长期记忆里清。

### 3. AI 记忆平台都在强调控制，但大多是平台内部控制

[OpenAI Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) 强调用户可以查看、删除或关闭 ChatGPT memory，也可以用 Temporary Chat 避免使用和更新记忆。[Gemini Temporary Chats 和 personalization controls](https://blog.google/products-and-platforms/products/gemini/temporary-chats-privacy-controls/) 也把临时对话和记忆控制作为隐私体验。Personal AI 的机会是更细：不是整段会话临时，而是同一条记忆内部区分“长期可回忆事实”和“短期可使用秘密”。

### 4. Agent 工具和外部上下文需要 guardrails 与人类确认

[OpenAI Agents SDK guardrails and human review](https://developers.openai.com/api/docs/guides/agents/guardrails-approvals) 把自动校验和人工批准作为安全工作流的一部分。[MCP Tools 规范](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) 也建议工具调用有清晰 UI 和 human-in-the-loop。对 Personal AI 的启发是：打开会议链接、复制 token、把上下文交给外部 AI 都应该是清晰动作，而不是 LLM 自己在回答里吐出 secret。

### 5. 研究侧已经把 agent memory 视为新的隐私泄露面

- [MemoAnalyzer](https://arxiv.org/html/2410.14931v1) 指出 RAG 和长期记忆会在用户不知情时浮现隐私信息，需要识别、可视化和管理记忆里的 private information。
- [Unveiling Privacy Risks in LLM Agent Memory](https://arxiv.org/html/2502.13172v1) 把 memory module 视为新的私有信息来源，并研究 memory extraction 风险。
- [Exploring Privacy Issues in Retrieval-Augmented Generation](https://aclanthology.org/2024.findings-acl.267.pdf) 讨论了 RAG 检索数据和生成响应中的隐私泄露风险。
- [A Survey on the Security of Long-Term Memory in LLM Agents](https://arxiv.org/html/2604.16548v1) 把 write-time over-collection、retained PII without TTL、missing provenance tagging 等列为长期记忆安全问题。
- [OWASP LLM02 Sensitive Information Disclosure](https://genai.owasp.org/llmrisk/llm02-insecure-output-handling/) 把 PII、财务、商业机密、凭证等纳入 LLM 应用敏感信息披露风险。

这些资料共同支持一个判断：Personal AI 要做长期私人记忆，必须有“秘密不等于普通记忆”的底层原语。

## 产品定义

### 新原语：Ephemeral Secret

`Ephemeral Secret` 是从普通记忆内容中拆出来的短期敏感片段。它有用，但默认不该进入普通语义记忆、长期 facts、LLM prompt 或外部 AI context。

第一批类型：

| 类型 | 例子 | 默认策略 |
| --- | --- | --- |
| `meeting_join_url` | `v.ringcentral.com/join/... ?pw=...`、Zoom/Teams join link | 原文进 vault，普通记忆只保留“会议链接可用”。TTL 到会议结束后 2 小时。 |
| `dial_in_password` | 会议 ID、拨入密码、SIP 串 | 原文进 vault，召回回答不直接显示，提供本地复制动作。TTL 到会议结束后 2 小时。 |
| `oauth_code` | OAuth code、auth callback query | 默认不保存原文，只写 blocked/redacted receipt。TTL 10 分钟。 |
| `api_token` / `jwt` / `api_key` | JWT、Bearer token、API key、client secret | 默认不写普通记忆。只有用户明确保存到凭证类来源时才进入 encrypted vault，并需要用途/scope。 |
| `otp` / `verification_code` | MFA / SMS code | 默认不保存原文，只写“出现过验证码类内容”的脱敏审计。TTL 10 分钟。 |
| `private_download_url` | 带签名参数的临时下载链接 | 普通记忆保留文件/来源语义，raw URL 进 vault，按 URL expiry 或 24 小时过期。 |
| `sensitive_account_url` | 带 userinfo、session、token query 的 URL | 普通链接隐藏敏感参数，保留 host 和路径语义。 |

### 新投影：Redacted Memory Projection

每次 ingest 先生成两份内容：

1. `raw_input`：客户端送来的原文，只在分类和 vault 写入路径中短暂使用。
2. `redacted_projection`：写入 `messages_raw.content`、`chunks.content`、FTS、embedding、LLM extraction、Ask/Recall 的版本。

示例：

```text
原文：
Calendar event: Nova Brandy Daily
Join: https://v.ringcentral.com/join/448515797?pw=...
Meeting ID: 448515797
Password: ********

普通记忆投影：
Calendar event: Nova Brandy Daily
Join link: [stored in local secret vault, available near event time]
Meeting ID: [redacted meeting credential]
Password: [redacted meeting credential]
```

普通召回可以知道“这是一个有 join action 的会议”，但不会把原始密码嵌入向量或交给 LLM。

### 新使用凭证：Secret Lease

当用户确实要用 raw secret 时，系统生成一个短期 `Secret Lease`：

- 来源：哪个 message/calendar/source-memory 提供。
- 用途：`open_local_meeting`、`copy_once`、`send_to_external_ai`、`extend_retention`。
- 有效时间：默认 60 秒到 5 分钟。
- UI 回执：显示会暴露什么、到哪里、是否记录。
- 事件记录：只记 hash、类型、目标和时间，不记复制后的原文。

### 不是什么

- 不是 1Password / Apple Passwords 替代品。长期登录凭证仍应该放在专门的密码管理器。
- 不是企业 DLP 管理台。它只服务单个用户的 Personal AI 记忆边界。
- 不是把所有敏感内容删掉。它保留可用动作和来源审计。
- 不是 Memory Egress Firewall 的重启。Egress 是“发出去之前看一眼”，本方案是“写入时就别让 raw secret 变成普通记忆”。
- 不是 review queue。大部分处理应自动完成。

## 核心体验

### 体验 1：今天/会议场景的安全 join card

用户早上打开 Today Pilot 或会议前打开 Video Home：

- 卡片展示会议标题、时间、组织者、参会人、议程、相关历史。
- meeting link 区域显示：`会议链接已保存在本机，默认不进入 AI 上下文`。
- 主按钮是 `打开会议`，次按钮是 `复制一次`。
- 点击 `复制一次` 时出现小确认：`将复制会议链接和拨入凭证，60 秒后本次授权失效`。
- Context Pack 的 receipt 显示：`已排除 2 个会议凭证，保留本地动作`。

### 体验 2：Ask 不直接吐出会议密码

用户问：

> Nova Brandy Daily 怎么加入？

Ask 回答：

> 我找到了 2026-06-24 09:30 CST 的 Nova Brandy Daily。会议链接在本机秘密保险箱里，可直接打开或复制一次；我不会把密码写进回答正文。

卡片按钮：

- `打开会议`
- `复制一次`
- `查看脱敏来源`

如果用户把答案复制给 ChatGPT / Codex，默认只复制脱敏文字，不含 raw link/password。

### 体验 3：普通 Memory Lens / Search 卡片显示红线

在时间轴或搜索结果里看到旧日历事件：

- 正文里显示 `[meeting credential redacted]`。
- 右侧 receipt：`2 个短期秘密已隔离；会议结束 2 小时后默认不再可复制`。
- 如果已经过期：按钮变成 `查看历史来源`，不再提供复制原文。

### 体验 4：Coverage Map / 导入批次给低打扰回执

批量导入或同步完成后显示：

> 本批已入库 43 条日历记忆；隔离 17 个会议链接、17 个拨入密码、0 个 API token。普通召回只会使用脱敏投影。

这不是让用户逐条审查，而是建立信任。

### 体验 5：外部 AI context pack 自动净化

当 AI Context Passport / Compose Assist / Doubao Bridge / OpenClaw 要带入会议或项目上下文：

- context pack 包含会议主题、参会人、议程、相关历史。
- 不包含 raw join URL、meeting password、dial-in code、OAuth/JWT/API key。
- receipt 明确写：`raw secrets withheld: 3`。
- 如果用户明确选择 `发送原文给外部 AI`，必须走 Secret Lease + confirmation，并记录外发目标。

## 信息架构

### 表结构草案

```sql
CREATE TABLE ephemeral_secret_items (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  source_ref_type TEXT NOT NULL,   -- message, chunk, calendar_event, source_memory, import_batch
  source_ref_id TEXT NOT NULL,
  secret_type TEXT NOT NULL,       -- meeting_join_url, api_token, oauth_code, ...
  secret_label TEXT,
  redaction_token TEXT NOT NULL,   -- [secret:abc123]
  value_hash TEXT NOT NULL,
  encrypted_value BLOB,            -- P0 可选；没有安全 keychain 前宁可不保存高风险 token 原文
  encryption_key_ref TEXT,
  scope TEXT DEFAULT 'work',
  source_host TEXT,
  detected_by TEXT NOT NULL,       -- rule, provider_parser, llm_verifier
  confidence REAL NOT NULL DEFAULT 0.5,
  available_from INTEGER,
  expires_at INTEGER,
  state TEXT NOT NULL DEFAULT 'active', -- active, expired, purged, blocked
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE memory_secret_redactions (
  id TEXT PRIMARY KEY,
  source_ref_type TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  redaction_token TEXT NOT NULL,
  secret_item_id TEXT,
  replacement_text TEXT NOT NULL,
  char_start INTEGER,
  char_end INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE secret_access_events (
  id TEXT PRIMARY KEY,
  secret_item_id TEXT NOT NULL,
  action TEXT NOT NULL,            -- open_local, copy_once, extend, external_send_denied, external_send_allowed
  target_surface TEXT,
  lease_id TEXT,
  value_hash TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE secret_policy_receipts (
  id TEXT PRIMARY KEY,
  source_ref_type TEXT NOT NULL,
  source_ref_id TEXT NOT NULL,
  status TEXT NOT NULL,            -- clean, redacted, vaulted, blocked
  summary TEXT NOT NULL,
  counts_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

### API 草案

| API | 用途 |
| --- | --- |
| `POST /api/v1/secrets/classify` | 只返回脱敏投影和 policy receipt，供 ingest/import dry-run 调用。 |
| `POST /api/v1/secrets/lease` | 为 `open_local` / `copy_once` / `extend` 生成短期授权。 |
| `POST /api/v1/secrets/:id/access` | 执行一次本地动作或返回一次性复制值。 |
| `GET /api/v1/secrets/receipts?sourceRef=` | 读取某条记忆的脱敏回执。 |
| `POST /api/v1/secrets/sweep-expired` | 定时任务清理过期可复制值，保留脱敏审计。 |

第一版可以不做独立导航页，只把 receipt 嵌在 Today Pilot、Ask、Memory Lens、Memory Exploring、Coverage Map 和 Context Pack 预览里。

## 系统设计

### 1. 写入前分类

新增 `EphemeralSecretClassifier`，在这些入口前置运行：

- `memory-service/src/routes/calendarEvents.ts`
  - 当前 `renderCalendarMemoryContent()` 会把 `descriptionPreview` 写入 calendar memory。P0 应先拆出 join URL / meeting id / password，再写脱敏内容。
- `memory-service/src/core/IngestionPipeline.ts`
  - 普通 `/ingest` 和 `/ingest/batch` 在 dedupe 后、LLM extraction / salience / embedding 前先生成 redacted projection。
- `memory-service/src/core/SmartMemoryImportService.ts`
  - 外部 AI 历史、zip / backup / docs 导入要在 dry-run 和 commit 两次都跑同一策略。
- `memory-service/src/core/SourceMemoryCaptureService.ts`
  - 已有 source URL / token 阻断逻辑可以复用，但输出也应写统一 secret policy receipt。
- `desktop-app/src/explorer/*`
  - ChatGPT / Doubao / local agent 会话导入前可以做客户端初筛，但服务端仍是最终 gate。

分类策略采用三层：

1. 规则和 provider parser：RingCentral / Zoom / Teams / Google Meet / OAuth callback / JWT / API key / Authorization header。
2. 上下文判断：`token` 可能是 token budget，不一定是凭证；`password` 在会议邀请里通常是凭证。
3. LLM verifier 只在规则不确定时低频使用，并且输入先脱敏，避免 verifier 看到完整 secret。

### 2. 普通记忆只写投影

所有下游默认只看 redacted projection：

- `messages_raw.content`
- `chunks.content`
- `messages_vec` / `chunks_vec`
- FTS
- entity extraction
- reflection / dream / distiller
- Ask / Recall / Context Recall
- Context Pack / provider packages

这点是本方案的关键边界：如果 raw secret 已经进入 embedding 或 summary，后面再加 UI 遮盖就太晚了。

### 3. Vault 保留策略

P0 的保守建议：

- 会议 join link 和拨入密码：可以保存 encrypted raw value，TTL 到会议结束后 2 小时；重复会议按 occurrence 分开。
- OAuth code / OTP：不保存 raw value，只记录 redacted receipt。
- API key / JWT / client secret：默认不保存 raw value；除非用户明确把它保存为“凭证来源”，并且有本机 keychain / per-user encryption key。
- 带 token 的 source URL：保存 canonical safe URL 和 redacted host/path，不保存敏感 query raw value，除非用户主动保存到 vault。

过期后：

- `encrypted_value` 清空或不可访问。
- `state='expired'`。
- 普通记忆仍保留“曾经有会议链接/凭证”的历史事实，但不再提供复制原文。
- 如果用户还需要 recurring meeting link，下次 calendar sync 会按新的 occurrence 重新建立 active secret。

### 4. 召回和生成策略

新增 `SecretAwareRecallPolicy`：

- 召回候选如果包含 redaction token，给 UI metadata：`secretCount`、`secretTypes`、`actionableSecrets`、`expiredSecrets`。
- LLM prompt 只看到 replacement text，不看到 raw secret。
- Ask 如果用户明确问 secret，先返回安全说明和动作按钮，不在自然语言答案里吐出原文。
- Compose Assist 和 Context Passport 默认加入 `withheldSecrets` receipt。
- Egress / external AI 相关功能把 secret lease 作为高责任边界。

### 5. 备份、导出和恢复

备份需要分层：

- 普通 export 默认只导出 redacted projection 和 receipt。
- Secret vault export 需要单独开关、二次确认和加密文件。
- restore 时如果没有 key，恢复 redacted history，不恢复 raw secret。
- `Memory Coverage Map` 的备份 dry-run 要能显示：`包含 secret vault: yes/no`、`raw secret count`、`可恢复/不可恢复`。

## UX 设计原则

1. **默认安静**：写入时自动处理，不弹出大面板。
2. **使用时明确**：复制、打开、延长、外发时给短回执。
3. **不制造恐惧**：文案说“已隔离、可本地使用”，不说“危险”。
4. **不破坏工作流**：会议前应该一键加入，而不是让用户去找密码。
5. **不把用户变审核员**：列表只用于高级诊断和排障，不做每天要清的队列。
6. **源头可追溯**：每个 redaction 都能回到来源记忆、来源时间和策略。
7. **跨功能统一**：Ask、Lens、Today、Meeting、Context Pack 看到同一套 receipt。

## Demo 说明

Demo 文件：[`ephemeral-secret-vault-demo.html`](./ephemeral-secret-vault-demo.html)

该 demo 仅作为已搁置方向的视觉参考，不代表近期实现目标。

它模拟四个集成场景：

1. Today Pilot 会议卡：会议上下文可见，join secret 被本地动作持有。
2. Ask 回答：问“怎么加入会议”时不直接输出密码，而给本地动作。
3. Context Pack 预览：外部 AI 上下文只包含脱敏内容，并显示 withheld receipt。
4. Timeline 详情：用户能看到哪类字段被隔离、何时过期、为什么不进入 embedding。

Demo 数据使用脱敏样例，不包含真实远端会议密码或 token。

## 实现阶段

### P0：Calendar / meeting secret redaction

目标：先修最明确的真实缺口。

范围：

- `calendarEvents.ts` 写入 `messages_raw` / `chunks` 前提取 meeting join URL、meeting id、password、dial-in password。
- 普通 calendar memory 内容改为脱敏投影。
- 新增 secret receipt metadata，先可存在 `metadata_json.secretReceipt`，后续迁移到专表。
- Today Pilot / Meeting Pilot / Ask / Memory Lens 卡片显示 `会议链接保留在本机`。
- Context Pack 默认排除 raw meeting credentials。

不做：

- 不支持所有 provider。
- 不处理长期 API credential vault。
- 不做独立 Secret Center 页面。
- 不把过期 secret 物理删除策略做成用户可调后台。

验证：

- 新增 synthetic calendar fixture：含 RingCentral `pw=`、meeting ID、password、dial-in。
- 断言 `messages_raw.content`、`chunks.content`、FTS/embedding 输入不含 raw secret。
- 断言 `secretReceipt` 记录 secret type/count/TTL。
- 断言 Ask / context pack 返回 withheld receipt。

### P1：统一 `/ingest` 和 source/import

范围：

- 在 `IngestionPipeline` 通用化 `EphemeralSecretClassifier`。
- 覆盖 `source_memory`、ChatGPT/Doubao import、local agent session、manual note。
- 把 `source_memory` 现有 sensitive URL / secret blocked 逻辑并入统一 receipt。
- Coverage Map import dry-run 显示 secret redaction counts。

### P2：真正的 encrypted vault + secret lease

范围：

- 引入 per-user encryption key 或本机 keychain 集成。
- `POST /secrets/lease` 支持复制一次、打开一次、延长一次。
- Desktop App 可执行本地打开会议 / 复制一次，不让浏览器 content script 长期持有 raw secret。
- `secret_access_events` 只记录 hash 和动作，不记录原文。

### P3：跨 AI / agent 出站边界复用

范围：

- AI Context Passport、Compose Assist、OpenClaw、Doubao Bridge、Codex/Claude/Cursor handoff 统一读取 `withheldSecrets`。
- 如果用户强制外发 raw secret，需要 Secret Lease + 目标平台 receipt。
- 和未来的 Egress Firewall 只在外发边界复用，不把 Egress 做成前置依赖。

## Eval 设计

建议新增 deterministic eval suite：`ephemeral-secret-vault`

Case 1：RingCentral calendar invite

- 输入：含 `v.ringcentral.com/join/... ?pw=...`、Meeting ID、Password、dial-in password。
- 期望：普通投影不含 raw `pw`、password、dial-in code；receipt 记录 `meeting_join_url` 和 `dial_in_password`。

Case 2：token 语义歧义

- 输入 A：`token budget`、`tokens used`。
- 输入 B：`Authorization: Bearer ...`。
- 期望：A 不误判为 credential；B 被隔离。

Case 3：Ask secret query

- 输入：用户问“这个会议怎么加入？”
- 期望：答案提供本地动作和脱敏说明，不在回答正文暴露 raw secret。

Case 4：context pack

- 输入：会议上下文生成给外部 AI。
- 期望：pack 含 agenda/participants/history，`withheldSecrets.count > 0`，正文不含 raw secret。

Case 5：expiry

- 输入：会议结束超过 2 小时。
- 期望：普通历史可查，raw secret 不可复制，UI 显示 expired receipt。

## 成功指标

- `P0 raw secret projection leakage = 0`：calendar fixture 的 raw secret 不出现在 `messages_raw.content` / `chunks.content` / context pack。
- `Ask raw secret answer leakage = 0`：Ask 不直接输出 meeting password/API token。
- `meeting usability preserved`：会议前仍能一键打开或复制一次，不因脱敏丢失可用动作。
- `extra daily user actions = 0`：默认不新增日常 review 操作。
- `receipt coverage >= 95%`：命中 secret 的 ingest 都有 policy receipt。
- `false positive acceptable`：`token budget` 这类非凭证词不应被高风险阻断。

## 风险和边界

| 风险 | 应对 |
| --- | --- |
| 误判导致有用内容被隐藏 | P0 先只处理高置信会议凭证和标准 token 模式；receipt 给恢复路径。 |
| 加密 key 管理复杂 | P0 可以先不保存高风险 raw token；会议链接可先按短 TTL + dedicated table 管理，P2 再接 keychain。 |
| 过期后用户仍要 recurring link | recurring calendar 每次 sync 建立新 occurrence secret；旧 occurrence 过期不影响未来事件。 |
| LLM verifier 看到 secret | verifier 只拿脱敏候选和模式上下文，不拿完整 raw value。 |
| 变成安全审查产品 | 不做独立首屏，不做日常列表；嵌入真实使用场景的 receipt 和动作。 |
| 与 Egress Firewall 重叠 | 本方案只保证入库和召回不泄露；如果未来恢复 Egress，它消费本方案的 `withheldSecrets`。 |

## 用户真实场景

### 场景 1：早上准备会议

用户打开 Today Pilot，看到 `Nova Brandy Daily`。卡片已经把昨天相关 Jira、参会人和历史讨论放在一起。底部有一条灰色回执：

> 会议链接和拨入密码已保存在本机秘密保险箱，未进入 AI 上下文。

用户点击 `打开会议` 直接加入。随后复制 `给 Codex 的上下文`，里面只有会议目的、项目背景和要问的问题，没有 raw meeting password。

### 场景 2：问 Personal AI 怎么加入会议

用户在 Quick Ask 输入“RCV Project Weekly Review 怎么加入？”系统回答找到了当天会议，但不直接把密码写出来。用户点 `复制一次`，看到 60 秒授权提示。复制动作记录为 hash receipt，过期后再打开这条历史，只能看到“曾经有会议凭证，已过期”，不会再吐出 raw password。

## 最小推荐版本

当前没有推荐实现版本。原先的 P0：**Calendar / meeting secret redaction** 暂不推进。

搁置判断：

- 现在不必做密码分类存储。
- 当前更重要的是重要记忆提取准确度，而不是 secret vault / TTL / lease / encrypted storage。
- 近期优先把 Source Memory Distiller、Memory Capture、Dreaming、Self Reflection、Ask、Memory Lens、Compose Assist 的高信号提取、蒸馏、去噪和消费准确度做稳。
- 若未来重新评估，前提应是重要记忆提取已经稳定，且 raw secret 进入普通召回或外部 context pack 成为高频真实问题。
