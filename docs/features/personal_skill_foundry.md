# Personal Skill Foundry — 个人技能炼金台

_最后更新: 2026-06-13_

## 是什么

`Personal Skill Foundry` 是 Personal AI 的个人技能库模块，入口位于：

`memory-exploring.html#/skills`

它的目标是把用户在不同 agent、真实操作和记忆系统中沉淀出的“做事方法”统一保存为可追踪、可版本化、可安装到其他 agent 平台的个人 skill。

这个模块里，**Memory Service 是真源**。所有技能最终都会进入 Memory Service 的 `active` 技能库，再通过平台级同步机制分发到 OpenClaw、Codex CLI、Claude Code、Cursor 等平台。

## 大白话运行逻辑

Personal Skill Foundry 先收集“这可能是一个可复用技能”的建议，等用户决定后才把它提升为正式 skill。正式 skill 会版本化保存，再按平台能力同步到不同 agent 工具里。

结果主要受这些因素影响：

1. 来源证据：Flight Recorder、OpenClaw、本地 agent 导入等来源越具体，建议越容易被用户判断。
2. 用户决策：只有 `active` 技能是真源；`suggestion` 不会默认分发到其他平台。
3. 技能包完整性：`SKILL.md`、资源文件、workflow、证据和 sha256 决定能否可靠安装/同步。
4. 平台绑定能力：OpenClaw、Desktop、本地手动平台支持程度不同，不能假设所有平台都能自动安装。
5. 分享 token：Public Skill URL 是只读拉取入口，撤销和 token 校验决定外部访问边界。

## 核心概念

| 概念             | 说明                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `suggestion`     | 待用户决策的技能建议，可能来自 Flight Recorder、OpenClaw、本地 agent 平台或其他来源           |
| `active`         | 已确认入库的真源技能，会参与分享 URL 和平台同步                                               |
| `dismissed`      | 用户丢弃的建议，保留记录并用于冷却去重                                                        |
| Skill Version    | 每次技能内容版本，包含 `SKILL.md`、package、workflow、evidence、sourceEpisodes、files、sha256 |
| Platform Binding | 某个技能在某个平台的安装/同步状态                                                             |
| Share Link       | 带 token 的只读 skill URL，用于外部 agent 拉取 `SKILL.md` 和资源                              |

当前 `personal_skills.status` 状态机只保留：

```
suggestion -> active
suggestion -> dismissed
```

不引入 draft / candidate / eval run 等额外状态。

### 经验质量门控 (Skill Quality Gate, P2-11)

坏经验和好经验一样会复利（Experience-Following 效应），所以自动蒸馏的技能要**先验证再推荐、连败自动退役**。质量门控是 `status` 之外的**独立一层**（`core/SkillQualityGateService.ts`，migration `047`），不改既有 enum：

- **执行账本** `skill_executions`：每次执行结果（success/failure/partial/unknown）按 signalSource（binding_sync / user_feedback / action_result / outcome_event）记一行。接口 `POST /skills/:id/executions`、`GET /skills/:id/health`、`POST /skills/:id/pin`。
- **健康分**：`health = wilson_lower_bound(success, success+failure)`（小样本保守，unknown 不计入分母，宁可慢晋升不可误退役）。
- **生命周期门控** `skill_health.gate_state`：
  - `candidate` → 蒸馏新技能起点；
  - `active` → 证据 ≥3 且 health ≥0.55（对齐 writing-style 双阈值精神）；
  - `degraded` → 连续 3 次 failure 或（有失败且 ≥3 样本且 health<0.4）→ **从 suggestions/注入面停用，仍可手动调用**；
  - `retired` → degraded 满 30 天无翻盘 → 归档（可一键复活）；
  - `user_pinned` → 用户钉住，豁免自动降级（用户意志最高）。
- **推荐门控**：`listSuggestions` 过滤掉 degraded/retired 的技能（无 health 行的技能不受影响，向后兼容）。
- **验证**：`skillQualityGate.test.ts`（4：≥3 成功晋升 active、3 连败降级且从 suggestions 消失、user_pinned 豁免、unknown 不计分母）。
- **仍在推进**：降级时的通知（lane=notice）+ Foundry UI 黄标、修订回路（degraded → 反思线程产出 v2 → 重新攒证据）。

## 用户主流程

### 1. 查看技能建议

页面顶部的 Inbox Bar 展示待决策建议。

建议会按来源分组：

- `OpenClaw 导入`
- `Flight Recorder 萃取`
- `本地 agent 导入`
- `其他建议`

每张建议卡片支持：

- `使用`：promote 为 `active`
- `丢弃`：标记为 `dismissed`
- `稍后审`：保留在 suggestion，但设置 `snoozed_until`，未到期前不再出现在 Inbox Bar
- 点击卡片：展开右侧详情

OpenClaw 或其他 agent 平台同步回来的新 skill 不会直接进入 active，而是先作为 suggestion 让用户确认，避免外部平台内容无感覆盖个人真源库。

2026-05-08 状态：

- `GET /api/v1/skills/suggestions` 只返回未暂缓或已到期的 suggestion，避免用户点击“稍后审”后同一张卡片仍停留在 Inbox 里。
- 前端刷新列表时只保留仍然可见的选中项；当前 suggestion 被稍后审或丢弃后，详情区会自动回到可见的 active skill 或下一条可见建议。

2026-05-12 状态：

- 创建 suggestion 时会按 `suggestionClusterKey` 和 slug 做去重；同一来源簇的 pending / active / dismissed 记录不会重复生成 Inbox 卡片。
- 被用户丢弃的同簇建议有 30 天冷却期；冷却期内重复萃取会复用已丢弃记录，不重新打扰。
- 高风险、外部 agent 平台导入、带脚本/资源文件、证据不完整或声明工具调用的 suggestion 会标记为 `reviewRequired`；前端先引导用户看证据和风险，后端也要求 `reviewConfirmed` 后才允许 promote。

2026-05-13 状态：

- Inbox Bar 会返回完整审核原因，包括版本里的 evidence / files / workflow 工具信息；需要审核的卡片先进入证据页，再允许确认使用，避免用户先点“使用”才被后端拦住。
- 外部平台或本机 agent skill 目录里的新版本不会再静默覆盖 Personal AI 的 active 真源技能；同步会生成“外部变更建议”，用户确认后才应用到原 active skill。

2026-05-21 状态：

- 需要审核的 suggestion 卡片会直接展示审核摘要：原因数量、前两条关键原因、来源/覆盖目标、版本和风险等级。
- 点击 `查看风险` / `查看变更` 后，详情区的审核 gate 会显示 `证据已查看，可以确认`，并列出来源、版本、风险、证据数、工作流步骤和资源文件数量；用户能在同一屏判断是否继续 `确认使用` / `确认覆盖`。

2026-05-28 状态：

- `稍后审` 不再只是把建议从 Inbox 隐藏；页面会显示一个“稍后建议”队列，列出到期时间、来源和审核状态。
- 用户可以从“稍后建议”里点 `现在审`，立即清除 `snoozed_until` 并把建议恢复到可决策 Inbox；仍然可以直接丢弃。
- `GET /api/v1/skills/suggestions` 默认只返回当前可审建议；`view=snoozed` 返回未到期的稍后建议，供 UI 保留恢复路径。

2026-05-29 状态：

- 打开“稍后建议”详情时，页面只提供 `现在审` 和 `丢弃`；用户恢复到 Inbox 后才会看到 `使用` / `确认覆盖`，避免把暂缓状态误操作成最终决策。
- 后端在 suggestion 被 `use`、`dismiss` 或外部变更应用时会清空 `snoozed_until`，终态记录不再保留过期的稍后审标记。

2026-06-06 状态：

- Inbox Bar 顶部会显示一条“优先处理”摘要，从当前可审 suggestion 中优先挑出外部覆盖、高风险、带脚本/外部依赖、证据不足或本机目录导入的建议。
- 建议卡片会按同一优先级排序，先处理最可能改变 active 真源或外部 agent 行为的条目；点击优先处理按钮会直接进入对应的 `查看风险` / `查看变更` 审核路径。
- 这个优先级只改变审阅顺序和提示，不绕过审核 gate；需要 `reviewConfirmed` 的建议仍然必须先查看证据或风险后才能 promote / 覆盖。

2026-06-09 状态：

- Memory Outcome Loop 可以把重复成功的 cue 作为 suggestion 来源。例如 Jira estimate `draft_hint` 多次被插入并发送后，会生成 `Estimate wording helper` suggestion。
- 这类 suggestion 的 `suggestedFrom` 为 `memory_outcome_loop`，`suggestionClusterKey` 绑定 cue key，避免同一句成功提示反复生成 Inbox 卡片。
- Outcome Loop 只生成待审建议，不会把它自动提升成 active skill，也不会自动同步到外部 agent 平台。

2026-06-12 状态：

- 用户点击 `使用` / `确认使用` / `确认覆盖` 后，页面会保留一条 `入库回执`，说明 suggestion 是否已提升为 active、外部变更是否覆盖了原 active skill、当前版本和 sha256、是否生成带 token 的只读 share URL、以及本次是否触发 OpenClaw 即时同步。
- 确认前的同步说明会区分三类路径：OpenClaw 可以由确认动作立即尝试同步；Codex CLI / Claude Code / Cursor 等本机目录等待 Desktop App 下一次同步，不由这次点击直接写本机文件；manual-only 平台仍只提供复制安装指引。
- 这条回执只描述已经完成的入库/覆盖和同步尝试，不代表 skill 已被执行，也不会触发历史消息分析、通知、外部自动写入或绕过后续版本审计。

2026-06-13 状态：

- 如果当前 Inbox 只有 Codex CLI / Claude Code / Cursor 本机目录导入建议，顶部摘要会显示 `本地 agent 导入建议`，并说明建议由 Desktop App 扫描本机 agent skill 目录得来。
- 这条来源回执会在用户进入卡片前先讲清楚：使用后才会进入 Personal AI active 真源，确认前需要先看目录来源、资源文件和脚本风险；它不会改变原有 review gate、丢弃、稍后审或平台同步逻辑。

2026-06-16 状态：

- 本机 agent skill 导入建议会识别包内 `test` / `spec` / `eval` / `fixture` / `verify` 等验证线索，并在 Inbox 卡片、审核 gate 和确认前回执中展示。
- 如果本机导入包包含可执行脚本或安装 / 下载 / MCP 连接指令，但没有发现验证线索，审核原因会明确提示 `未发现测试、eval、fixture 或 verify 验证线索`。
- 这只是确认前的风险事实，不代表 Personal AI 已经运行或验证该 skill；用户确认后仍只是进入 active 真源和已声明同步路径，不会自动执行 skill。

2026-06-17 状态：

- `使用` / `确认使用` / `确认覆盖` 之外，`稍后审`、`现在审` 和 `丢弃` 也会留下持久决策回执，而不是只显示一行临时提示。
- `稍后审回执` 说明建议仍是 `suggestion`、何时回到 Inbox、审核原因是否保留，以及本次没有提升 active 真源、覆盖技能、触发 OpenClaw / Desktop App 同步、执行 skill 或写入 manual-only 平台。
- `恢复审阅回执` 说明只是清除 `snoozed_until` 并把建议恢复到 Inbox；真正入库或覆盖仍要走原来的审核 gate。
- `丢弃回执` 说明状态已变为 `dismissed`、同来源重复建议会按冷却去重处理、可从“已丢弃”过滤器复查；它不会删除 active 技能、改写外部平台或本机目录，也不会触发同步或执行 skill。

### 2. 管理在用技能

左侧技能列表默认只显示 `active` 技能。

过滤器：

- `在用`
- `全部`
- `已丢弃`

`suggestion` 不混入默认技能列表，只显示在 Inbox Bar。

### 3. 查看技能详情

右侧详情区包含四个 tab：

| Tab    | 内容                                            |
| ------ | ----------------------------------------------- |
| 工作流 | trigger、not_use、来源、风险策略、步骤          |
| 证据   | 来源证据、episode / 外部平台证据                |
| 版本   | 当前版本、sha256、changelog、createdFrom        |
| 绑定   | share URL、平台安装状态、安装指引、平台同步状态 |

技能列表和详情区不使用内层纵向滚动，页面跟随 `memory-exploring` 外层主滚动条展开。

## 数据模型

Memory Service 通过迁移 `019_personal_skill_library.sql` 建表。

| 表                             | 用途                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `personal_skills`              | 统一存 `suggestion / active / dismissed` 技能，包含 slug、title、summary、scope、risk、trigger、not_use、来源和决策 metadata |
| `skill_versions`               | 存技能版本、`SKILL.md`、package JSON、workflow、evidence、sourceEpisodes、files、sha256、changelog                           |
| `skill_platform_bindings`      | 存某技能在各平台的安装状态、版本、sha256、remoteMtime、lastSync/error                                                        |
| `skill_platform_sync_settings` | 平台级自动同步设置，包含 capability 和 enabled                                                                               |
| `skill_share_links`            | 存 token hash、skill/version 绑定和 revokedAt，用于安全暴露只读 URL                                                          |

不建：

- `skill_eval_cases`
- `skill_eval_runs`
- `skill_runs`

eval / run receipt 以后作为次级能力再加，不进入 MVP 主链路。

## Public Skill URL

每个 active skill version 都可以生成 tokenized read-only URL。

支持端点：

| 端点                                                | 说明                   |
| --------------------------------------------------- | ---------------------- |
| `GET /skills/:slug@:version?token=...`              | HTML 预览              |
| `GET /skills/:slug@:version/SKILL.md?token=...`     | 返回 `SKILL.md`        |
| `GET /skills/:slug@:version/package.json?token=...` | 返回完整 package       |
| `GET /skills/:slug@:version/files/*?token=...`      | 返回 scripts/resources |

注意：

- UI 可以展示短链，例如 `/skills/capdev-monthly-data@v0.1`。
- 真正可访问、可复制给 agent 的 URL 必须带 `?token=...`。
- token 原文只返回给调用方，数据库只保存 hash。
- 每次获取详情会生成新的 live token；旧 token 继续有效，直到被 revoke。
- public URL 返回 `ETag`，支持 `If-None-Match`。
- 生成 share link 前会做 secret pattern scan；命中疑似 secret 时不生成 share，并在详情里返回 `shareError`。
- 绑定页会显示“分享回执”：说明复制给 agent 的安装 URL 会包含 bearer token、只能只读拉取 HTML 预览 / `SKILL.md` / `package.json` / `files/*`，不会写入、覆盖、执行或触发平台同步；同时露出当前 active version、sha256、资源文件数量、secret-scan 阻断和旧 token 需后台 revoke 的边界。

## 平台同步

平台同步是 **per-platform**，不是 per-skill。

开启某个平台后，会同步所有 `active` 技能。

| 平台             | capability           | 默认           | 说明                                 |
| ---------------- | -------------------- | -------------- | ------------------------------------ |
| Personal AI      | `internal`           | 开启且不可关闭 | 真源                                 |
| OpenClaw remote  | `api`                | 开启           | 通过 OpenClaw remote API 双向同步    |
| Codex CLI        | `fs_via_desktop_app` | 关闭           | 需要 Desktop App 读写本机 skill 目录 |
| Claude Code      | `fs_via_desktop_app` | 关闭           | 目录可配置                           |
| Cursor           | `fs_via_desktop_app` | 关闭           | 通过 Desktop App 读写本机目录        |
| ChatGPT / GPTs   | `manual_only`        | 不可自动同步   | 只提供复制安装指引                   |
| Claude.ai Skills | `manual_only`        | 不可自动同步   | 只提供复制安装指引                   |

### OpenClaw 同步

OpenClaw remote 不要求和 Personal AI app 在同一台机器上。

同步通过远端 API 完成，优先使用 `/v1/responses` strict JSON 方式执行 skill CRUD；如果 OpenClaw 提供 `skills.status/install/update` RPC，则可作为优化路径。

当前同步策略：

1. `sha256` 相同：noop，并更新 binding。
2. OpenClaw 有新 skill，而 Personal AI 不存在：导入为 `suggestion`。
3. Personal AI 已有 active skill，OpenClaw 版本更新：从 OpenClaw export 完整 package，生成需要审核的外部变更 suggestion；用户确认后才覆盖 Personal AI 当前 active version。
4. Personal AI 版本更新或 OpenClaw 缺失：推送 Personal AI active package 到 OpenClaw。
5. 冲突判断会综合 `sha256`、version 和 remote mtime。

用户点击 suggestion 的 `使用` 后，如果 OpenClaw 同步已开启，会只同步这一条刚入库的 active skill，不会顺带拉取全部 OpenClaw 技能。

### Desktop App 本机同步

Codex CLI / Claude Code / Cursor 的 skill 目录在本机文件系统里，Chrome Extension 和 Memory Service 不能直接读写。

因此这些平台通过 Desktop App 完成：

1. Desktop App 定期扫描本机 skill 目录。
2. 调用 Memory Service `POST /api/v1/skills/sync/local-platform`。
3. Memory Service 判断本机平台和 Personal AI 哪边更新。
4. 如果本机 skill 是新内容，创建 suggestion；如果它会改变已有 active skill，生成需要审核的外部变更 suggestion。
5. 如果 Personal AI active 更新，Memory Service 返回 `packagesToInstall`。
6. Desktop App 把 package 写回对应平台目录。

如果 Desktop App 未安装或未运行，UI 对 Codex CLI / Claude Code / Cursor 显示 `状态未知`，而不是 `未安装`。绑定 tab 顶部会引导用户下载安装最新版 Desktop App。

同步到本机目录时，Memory Service 会使用和 Desktop App 扫描器一致的文件系统包哈希（`SKILL.md` + files）记录平台绑定。这样刚推送到本机目录的 skill 下一轮扫描不会因为 Personal AI 内部 package 哈希不同而被误判为外部变更。

2026-05-23 状态：

- Desktop App 本机同步结果会把 `externalChanges` 透传回 Foundry 页面；用户手动同步 Codex CLI / Claude Code / Cursor 后，弹窗会直接显示“待审核变更 N 条”并提示去顶部 Inbox 审核。
- 本机 agent skill 的新内容或新版本仍然不会直接覆盖 Personal AI 真源；只有用户在 suggestion 里确认使用或确认覆盖后，才会进入 active skill。

2026-05-25 状态：

- Desktop App 上报本机 skill 时会把 `root`、skill 目录、`SKILL.md` 路径、资源文件数量和资源字节数写入平台 binding metadata。
- Foundry Inbox 和审核 gate 会展示本机来源目录与资源包规模；用户在确认使用/覆盖前能看到这条建议来自哪个 Codex CLI / Claude Code / Cursor 本机目录，而不是只看到平台名。

2026-05-29 状态：

- “平台级自动同步”弹窗会在每个平台行内显示当前可执行性：真源、自动同步已开启、同步未开启、需要 Desktop App、仅手动安装，和最近一次探测失败。
- OpenClaw 同步失败后会立即刷新平台设置，把后端记录的 `lastError` 显示在对应平台行里，用户关掉临时提示后仍能看到为什么不能同步。
- 同步弹窗的 active 技能数量独立读取真源列表，不受左侧“在用 / 全部 / 已丢弃”过滤器影响。

2026-05-31 状态：

- Memory Service 只接收本机 skill 包内的安全相对资源路径；绝对路径、越界路径和重复路径会被忽略，并在 binding metadata、审核原因和 Foundry 审核摘要中显示已忽略数量。只要发生过滤，导入后的 sha256 以清洗后的包重新计算，不再沿用 Desktop App 上报的原始包哈希。

2026-06-05 状态：

- 本机 agent skill 导入建议会把可执行脚本文件、`SKILL.md` 里的安装/下载/MCP 连接指令、被忽略的越界或重复资源路径都前置成审核原因；Inbox 卡片和详情审核 gate 会直接显示这些风险，用户确认后才会 promote 或覆盖 active 真源技能。

2026-06-07 状态：

- 本机 agent skill 导入建议还会扫描包内资源文件正文；如果 README、references 或其他资源里藏着安装、下载或 MCP 连接指令，同样会进入审核原因。
- Inbox 卡片的待审核摘要现在保留前三条原因，让来源、可执行脚本和资源文件依赖边界能在进入详情前同时露出。

2026-06-09 状态：

- suggestion 详情会显示 `确认后会发生什么` 回执，说明确认使用/覆盖会如何影响 active 真源、是否已经完成证据审核、是否来自本机目录、会按哪些已开启平台同步，以及丢弃/稍后审的恢复路径。
- 这条回执不改变状态机，也不绕过审核 gate；它只是把最终确认按钮背后的入库、覆盖、同步和恢复边界提前展示出来，避免用户把 `确认使用` 误解成普通预览动作。

2026-06-11 状态：

- 平台级同步弹窗在 OpenClaw 或 Desktop App 本机同步后会保留 `同步回执`，不再只显示一行临时结果。
- 回执会说明本次同步的平台、扫描/处理范围、Personal AI 里新增 suggestion / 更新绑定 / 待审核变更数量、目标平台回拉/推送数量、失败或跳过原因，以及 manual-only 平台没有被自动写入。
- 外部变更仍只进入顶部 Inbox 待审核；同步回执不会让 skill 自动执行，也不会绕过 suggestion 的审核 gate 或 active 真源版本记录。

### Manual-only 平台

ChatGPT / GPTs 和 Claude.ai Skills 暂不支持自动写入，只提供一句安装指引。

安装指引中使用的是带 token 的可访问 skill URL。

2026-05-22 状态：

- 绑定 tab 里 manual-only 平台显示 `手动安装`，不再显示成可探测的 `未安装` 状态。
- 平台级同步弹窗里 manual-only 平台显示 `仅手动` / `不参与自动同步`，避免用户把 Web 平台不可写误解成同步故障。

## API

技能管理 API 挂在 `/api/v1/skills` 下。

- `GET /api/v1/skills?filter=active|all|dismissed&q=`：主列表；默认不返回 suggestion。
- `GET /api/v1/skills/suggestions?view=ready|snoozed|all`：Inbox Bar 建议列表；默认 ready，snoozed 用于稍后建议队列。
- `POST /api/v1/skills/suggestions`：创建 suggestion，供同步器或 miner 写入。
- `POST /api/v1/skills/suggestions/:id/use`：promote 为 active；需要审核的建议必须传 `reviewConfirmed`，成功后生成 share link 并触发已开启平台同步。
- `POST /api/v1/skills/suggestions/:id/dismiss`：标记 dismissed，并记录冷却 key。
- `POST /api/v1/skills/suggestions/:id/snooze`：暂缓建议。
- `POST /api/v1/skills/suggestions/:id/unsnooze`：立即恢复稍后建议。
- `GET /api/v1/skills/:id`：技能详情，返回 workflow / evidence / versions / bindings / share。
- `GET /api/v1/skills/sync-settings`：平台同步设置。
- `PUT /api/v1/skills/sync-settings/:platform`：更新平台同步开关。
- `POST /api/v1/skills/bindings/:platform/probe`：只读探测平台能力。
- `POST /api/v1/skills/sync/run`：Memory Service 主动触发 API 平台同步，目前主要用于 OpenClaw。
- `POST /api/v1/skills/sync/local-platform`：Desktop App 上报本机平台 skill 列表并拉取待写入 package。

## 关键安全边界

- tokenized public URL 是只读能力，不提供写入接口。
- `skill_share_links` 只保存 token hash，不保存明文 token。
- 短展示 URL 不能直接打开，避免误把无 token URL 当公开 URL。
- share 生成前扫描疑似 secret，例如 api key、bearer token、private key、password 等。
- 带 token 的 URL 等同于只读拉取凭证；复制安装指引前必须让用户看见访问范围、版本指纹、资源文件覆盖和撤销边界。
- 外部平台导入的 skill 默认先进入 suggestion，不直接进入 active。
- 外部平台或本机 agent 目录对 active skill 的改动也默认先进入 suggestion，不直接覆盖真源。
- 自动同步按平台开启，避免用户误以为单条 skill 有独立同步开关。
- `入库回执` 中的同步状态只覆盖本次确认动作实际触发的即时路径；本机 Desktop App 和 manual-only 平台必须继续按各自边界显示。

## 已知边界

- Flight Recorder miner 只负责产生 suggestion；是否入库由用户确认。
- OpenClaw remote 的完整 CRUD 依赖远端 `/v1/responses` 能稳定返回 strict JSON。
- Codex CLI / Claude Code / Cursor 的双向同步依赖 Desktop App 安装、运行和目录权限。
- 本机平台目录默认值可能不稳定，Claude Code 等目录应允许用户配置。
- ChatGPT / GPTs、Claude.ai Skills 当前只支持手动安装指引。
- 暂不做 eval 面板、run receipt、per-skill 自动同步矩阵。

## 建设性改进方向

结合 Claude Skills、LangChain long-term memory、OpenAI Agents SDK guardrails / tracing，以及 SkillX、SkillFoundry、SkillGen、GoSkills 等近期 agent skill / procedural memory 论文，后续优先级建议：

- Skill package 继续保持 `SKILL.md` 主文件轻量，把大参考、模板、脚本放到 files 中按需加载，减少 agent 上下文常驻成本。
- 审核 gate 后续可以加入更细的来源可信度、脚本权限分类和安装前 diff 预览，让用户更快判断外部导入技能是否可信。
- 继续扩展 suggestion 去重策略：在已有 `suggestionClusterKey` 冷却基础上，后续可加入语义相似合并和来源可信度排序。
- 将 trigger、执行结构、工具/文件副作用和证据状态提取成结构化摘要，用于搜索、风险评估和审核，而不是只依赖 `SKILL.md` 原文。
- 为长期演进增加 run receipt / 失败反馈的轻量入口，不做重 eval 面板，但让用户能把“这个 skill 不好用”的证据回流到版本记录。
- 同步链路继续保留 per-platform 开关；如需例外，优先通过 skill risk / scope 做过滤，而不是在首屏引入 per-skill 多平台矩阵。
- 如果技能库继续扩大，后续检索不应只返回扁平 skill 列表；可以按任务入口、支持技能、检查点和避免事项组织成小型执行包，减少 agent 误选或漏读。

本轮调研后新增的短期产品判断：

- Claude Skills 把 skill 明确定义为包含 instructions、metadata、scripts、templates 的能力包，并强调 progressive disclosure；因此 Foundry 应继续把短触发描述和完整资源分层，而不是把所有资料塞进主 `SKILL.md`。
- Claude 官方文档也提醒第三方 skill 可能带来工具滥用和数据外泄风险；这支持了本轮把外部 active 更新改成审核建议，而不是自动覆盖。
- OpenAI Agents SDK 的 guardrails / tracing 说明生产 agent 需要围绕工具调用和运行轨迹做可审计边界；Foundry 后续应把“确认覆盖”记录成版本证据，而不只做一次 UI 弹窗。
- SkillX、SkillFoundry、SkillGen 等 2026 年论文都把执行反馈、来源证据、验证测试和技能库自演进作为核心方向；Foundry 目前不需要重 eval 面板，但需要保留轻量 run receipt / 失败反馈入口。
- LangChain / Deep Agents 把 skills 放在 procedural memory 位置，适合和语义记忆分层管理；Foundry 应继续把“何时用、别何时用、需要哪些资源”作为建议审核摘要的一等信息。
- SkillSmith、SkillGen 等近期工作都强调 skill 的边界、验证和回归风险；因此 Inbox 里不能只展示标题和摘要，至少要在使用前暴露风险原因、版本和证据覆盖情况。
- 近期 skill registry / skill file attack 研究说明第三方 skill 供应链会成为攻击面；Foundry 对外部导入应保持审核默认开启，并把资源文件、工具调用、来源平台放在用户确认前。
- 2026-05-22 再核对 Claude Code Skills、LangChain Deep Agents memory/skills 和 SKILL-INJECT 后，平台同步 UI 需要持续区分三类能力：可 API 同步、需 Desktop App 文件同步、仅复制安装指引；manual-only 平台不应显示伪安装状态。
- 2026-05-25 再核对 Deep Agents skills、SKILL.md registry supply-chain 和 SkillOps 后，本机导入建议需要把“文件来自哪里、包有多大、是否带资源文件”作为审核事实，而不是只保存到后台 binding；这比一次性弹窗更接近可审计的 skill lifecycle。
- 2026-05-28 再核对 Claude Skills / Claude Code Skills、SkillFoundry、SkillGen 和 Agentic Skills 生命周期综述后，`稍后审` 应被视为一个仍待治理的中间状态，而不是一次性隐藏动作。官方和论文都强调 skill 的来源、资源文件、工具权限、验证与更新需要持续可审计；因此 UI 保留“稍后建议”队列和 `现在审` 恢复路径，避免用户丢失外部导入或高风险 skill 的审核上下文。
- 2026-05-29 再核对 OpenAI GPTs、Claude Skills、Microsoft Copilot Studio agent 发布/目录流程、SkillOps、Agentic Skills SoK 和 mixed-initiative feedback 研究后，建议状态机应把“恢复审核”和“最终使用/覆盖”拆开。用户控制有价值，但频繁反馈也可能降低信任；所以暂缓项详情可以被查看，但必须先恢复到 Inbox 才能做最终确认。
- 2026-05-29 针对平台同步再核对 OpenAI GPTs Actions、Claude/Claude Code Skills、Cursor Rules、Custom GPT 漏洞分析和 agent skill 生命周期研究后，同步 UI 需要把“能否自动写入、最近为什么失败、是否只是复制安装”放到持久行内诊断里；跨平台 skill 分发不应只留下短暂同步结果。
- 2026-06-06 再核对 OpenAI GPTs、Claude Skills、AutoSkill、Voyager 和 ToolLLM 后，短期最有价值的不是新增一个 skill marketplace，而是让已有 Inbox 更像一个安全审阅队列：先暴露“为什么先审这一条”，再进入证据页确认。AutoSkill / Voyager 都强调 skill 应从交互经验沉淀为可复用能力，ToolLLM 则说明工具选择需要检索和评估；Foundry 当前应把这些思想落在 suggestion 优先级、证据状态和外部动作边界上。
- 2026-06-09 再核对 OpenAI Skills / GPT Actions、Claude Skills、AutoSkill 与 MUSE-Autoskill 后，短期产品重点仍不是扩大同步矩阵，而是让用户在确认前看到“这次点击会把什么变成 active 真源、会不会覆盖现有技能、会触发哪些同步、怎么撤回或稍后处理”。这些资料共同强调 skill 是可复用工作流/资源包，且长期演进需要生命周期、评估、反馈和边界可审计。
- 2026-06-11 再核对 Claude Agent Skills、OpenAI GPTs、MCP 规范、MCP 安全综述和 Microsoft MCP governance 后，平台同步后也需要可读回执：skill/package 同步既可能移动本地文件或远端资源，也可能生成待审外部变更；用户应在一个稳定位置看到写入、回拉、跳过、失败、manual-only 排除和“不会自动执行 skill”的边界。
- 2026-06-12 再核对 Claude / Agent Skills 文档、AutoSkill / Voyager 类 skill-library 研究和 skill registry 攻击面讨论后，确认动作本身也需要回执：用户不应只看到页面跳转，而应看到 active 真源、tokenized share、即时同步、Desktop App 等待同步和 manual-only 排除这些边界。
- 2026-06-16 再核对 Anthropic Agent Skills、Agent Skills open standard、OpenAI Agents SDK guardrails / tracing、Agent Skills survey 和 MUSE-Autoskill 后，本机导入建议需要把验证线索作为审核事实：skill 是带脚本/资源的程序性记忆，生命周期研究也强调 evaluation / runtime feedback；因此短期不做重 eval 面板，但带脚本或外部依赖且缺少 test/eval/fixture/verify 文件时必须在确认前暴露。
- 2026-06-17 再核对 Claude Skills / OpenAI GPTs、Agent Skills lifecycle 综述、Dynamic Agent Skills 和 human-in-the-loop 反馈研究后，短期重点不是增加新的 review 状态，而是让每个用户决策动作都留下轻量、可恢复的效果回执。技能库建议需要 admission gate 和 lineage，但频繁打扰会降低信任；因此 `稍后审 / 现在审 / 丢弃` 应清楚说明“不入库、不覆盖、不同步、不执行”的边界，让用户能少做决策但看得见后果。

## Reminders 反馈

2026-06-06 自动化核对：本机 Reminders 可访问，但未发现名为 `Personal AI` 的列表。本轮没有可纳入的 Reminder 条目，也没有可标记 done 的条目。

2026-06-09 自动化核对：本机 Reminders 仍可访问，但列表中仍没有 `Personal AI`。本轮没有 Reminder 来源的 Skill Foundry 条目，也没有可标记 done 的条目。

2026-06-10 自动化核对：本机 Reminders 的自动化读取在等待中卡住，本轮没有安全读到 `Personal AI` 列表或相关条目，因此没有纳入或标记完成的 Reminder 项。

2026-06-11 自动化核对：使用 macOS-safe AppleScript 探测后返回 `__NO_PERSONAL_AI_LIST__`。本轮没有 Reminder 来源的 Skill Foundry 平台同步条目，也没有可标记 done 的条目。

2026-06-12 自动化核对：本机 Reminders 可访问，但列表中没有 `Personal AI`。本轮没有 Reminder 来源的 Skill Foundry 条目，也没有可标记 done 的条目。

2026-06-16 自动化核对：本机 Reminders 可访问，但仍没有 `Personal AI` 列表。本轮没有 Reminder 来源的 Skill Foundry 条目，也没有可标记 done 的条目。

2026-06-17 自动化核对：本机 Reminders 可访问，但列表中没有 `Personal AI`。本轮没有 Reminder 来源的 Skill Foundry 条目，也没有可标记 done 的条目。

外部参考：

- [Claude Skills Help](https://support.claude.com/en/articles/12512180-use-skills-in-claude)
- [OpenAI GPTs](https://help.openai.com/en/articles/8554407-gpts)
- [Claude Skills Overview](https://claude.com/docs/skills/overview)
- [Microsoft Copilot Studio agents](https://learn.microsoft.com/en-gb/microsoft-copilot-studio/microsoft-copilot-extend-copilot-extensions)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [LangChain Deep Agents long-term memory](https://docs.langchain.com/oss/python/deepagents/long-term-memory)
- [Agent Skills open standard](https://agentskills.io/)
- [OpenAI Agents SDK Guardrails](https://openai.github.io/openai-agents-js/guides/guardrails/)
- [OpenAI Agents SDK Tracing](https://openai.github.io/openai-agents-python/tracing/)
- [Anthropic Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [OpenAI Creating and editing GPTs](https://help.openai.com/en/articles/8554397-creating-and-editing-gpts)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-06-18)
- [Model Context Protocol: Landscape, Security Threats, and Future Research Directions](https://arxiv.org/html/2503.23278v2)
- [Microsoft MCP security and governance](https://www.microsoft.com/insidetrack/blog/protecting-ai-conversations-at-microsoft-with-model-context-protocol-security-and-governance/)
- [SkillSmith](https://arxiv.org/abs/2605.15215)
- [Skill-Inject](https://arxiv.org/abs/2602.20156)
- [Skill-Pro: Learning Reusable Skills from Experience](https://arxiv.org/abs/2602.01869)
- [SkillX: Automatically Constructing Skill Knowledge Bases for Agents](https://arxiv.org/abs/2604.04804)
- [SKILLFOUNDRY: Building Self-Evolving Agent Skill Libraries from Heterogeneous Scientific Resources](https://arxiv.org/abs/2604.03964)
- [Under the Hood of SKILL.md: Semantic Supply-chain Attacks on AI Agent Skill Registry](https://arxiv.org/abs/2605.11418)
- [SkillOps: Managing LLM Agent Skill Libraries as Self-Maintaining Software Ecosystems](https://arxiv.org/abs/2605.13716)
- [SkillGen: Verified Inference-Time Agent Skill Synthesis](https://arxiv.org/abs/2605.10999)
- [SoK: Agentic Skills -- Beyond Tool Use in LLM Agents](https://huggingface.co/papers/2602.20867)
- [Soliciting Human-in-the-Loop User Feedback for Interactive Machine Learning Reduces User Trust and Impressions of Model Accuracy](https://arxiv.org/abs/2008.12735)
- [Group of Skills: Group-Structured Skill Retrieval for Agent Skill Libraries](https://arxiv.org/abs/2605.06978)
- [From Skill Text to Skill Structure: SSL Representation for Agent Skills](https://arxiv.org/abs/2604.24026)
- [AutoSkill: Experience-Driven Lifelong Learning via Skill Self-Evolution](https://arxiv.org/abs/2603.01145)
- [Voyager: An Open-Ended Embodied Agent with Large Language Models](https://arxiv.org/abs/2305.16291)
- [ToolLLM: Facilitating Large Language Models to Master 16000+ Real-world APIs](https://arxiv.org/abs/2307.16789)

## 验证建议

Memory Service：

```bash
npm --prefix memory-service test -- --run src/__tests__/api-skills.test.ts
npm --prefix memory-service run build
```

Extension：

```bash
npm start
node tools/verify-personal-skill-foundry-e2e.mjs
```

`npm start` 运行到首次 webpack compile success 后停止 watch，再运行扩展页面 E2E。

真实服务验证：

```bash
npm run deploy:memory

curl -H 'X-User-Id: esone.qiu' \
  'http://10.32.56.212:3210/api/v1/skills?filter=active&q=capdev'
```

验证 public skill URL 时必须使用详情接口返回的 `share.urlPath`，不要只测 `displayUrl`。
