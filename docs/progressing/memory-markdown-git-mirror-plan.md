# 新能力：Markdown Git Mirror / 记忆 Markdown 镜像到用户 GitHub 仓库

> 状态：仅规划，待决策。本轮未改任何运行时代码。
> 生成日期：2026-10-09 CST
> 代码核查基线：工作区 `develop` 分支，引用均为 `path:line`。
> Demo：[`memory-markdown-git-mirror-demo.html`](./memory-markdown-git-mirror-demo.html)（Options 备份设置新增「GitHub 镜像」通道）
> 来源：E-72 第三轮。用户要求模仿 Instinct 的「git 管理 Markdown」模式：把从各来源提纯沉淀出来的 Markdown 内容（画像、profile 等）每晚定时备份到用户提供的 GitHub 仓库，在 Options 备份设置里填写仓库地址与 Key。

## 1. 一句话结论

**可以做，而且现有自动备份框架已经留好了插槽；但要先把两件事说清楚。** 第一，我们的 Markdown 今天是**视图**不是真源（SQLite 为真源，`memory-architecture-analysis.md`），而且大部分文件只有一行摘要或由旧巩固阶段生成；镜像前需要先把「提纯沉淀」的内容真正投影成 Instinct 式的目录（entities / knowledge / workstreams / timeline / profile）。第二，GitHub 是一个外部目的地，必须经过 egress 门：默认只推 confirmed 与 derived 层，敏感字段按 `egress_policy` 过滤或整库加密。做好这两点后，本方案就是现有 `AutoBackupService` 的第三个 provider（webdav / s3 之外加 `github`），每晚一次 commit，用户在自己的仓库里得到一份可 diff、可回滚、可被其他 agent（OpenClaw、Hermes、memsearch）直接读取的记忆文本。

## 2. 两个使用场景

### 场景 A：每晚一次 commit，早上在手机上看 diff

用户开启「GitHub 镜像」，填入私有仓库 `github.com/esone/memory-mirror` 与 fine-grained token（仅该仓库 Contents 写权限）。每晚 23:30 巩固结束后，系统生成当日 Markdown 投影，提交一次 commit：「memory mirror 2026-10-09: +3 preferences, 1 superseded fact, 2 open loops closed」。早上用户在 GitHub App 看到 `profile/one-pager.md` 的 diff：Q4 Goal Setting 从 open_loops 移到了 completed。

### 场景 B：把记忆接进另一个 agent

用户在家用 OpenClaw。它的 memory 约定是 `USER.md` / `MEMORY.md` / `memory/YYYY-MM-DD.md`。镜像仓库里有一个 `interop/openclaw/` 目录按这个约定渲染（只含 confirmed 的关于我的内容）。用户**不把 OpenClaw 的 workspace 直接指向这个目录**（原因见 §4.8），而是让 OpenClaw 以只读方式读取它；若想把 OpenClaw 学到的东西带回来，走 §4.8 的分仓双向模式。

## 3. 现状（代码事实）

| 已有 | 位置 | 对本方案的意义 |
|---|---|---|
| `AutoBackupService`：按用户周期（daily / every_x_hours / weekly、preferredHour）生成全量 zip，默认 PABK1 scrypt + AES-256-GCM 加密，上传后 HEAD 校验体积，只留最近 N 份 | `AutoBackupService.ts:1-45`；`backup/backupCrypto.ts:1-25`；`docs/features/memory_auto_backup.md` | 调度、加密、互斥锁、失败通知可直接复用 |
| provider 接口 `put / head / list / delete / test`，已有 `WebdavProvider`、`S3Provider`、`LocalDirProvider` | `integrations/backupStorage/types.ts:14-21`；`index.ts` | 新增 `GitHubProvider` 即可，但它是「提交一组文件」不是「上传一个对象」，接口要扩一个 `putTree` |
| 导出内容：`USER_CORE.md`、`CORE_MEMORY.md`、`WATCHED_PROJECTS.md` + `daily / dreams / entities / reflections / reflection-threads / reports / projects / rehearsals / source-memory / skills / agent` 目录 + `derived/*` 四个总览 | `MemoryBackupService.ts:21-52` | 这些就是今天的「Markdown 沉淀」，但多数是旧巩固阶段的产物，粒度粗 |
| `MarkdownManager` 管实体子目录（people / topics / organizations / technologies / projects / documents / tasks） | `MarkdownManager.ts:36-50` | 目录骨架已有，可对齐 Instinct 的 entities/ |
| daily log 只写一行摘要（时间 + 发送者 + 摘要） | `IngestionPipeline.ts` 第 8 步；`memory-architecture-analysis.md` | 镜像出去的 daily 不含原文，这是**有意的**：原文留在本地库 |
| Options 备份设置页：webdav / s3 / local 三个 tab，密码只回「已配置」，关闭加密需二次确认 | `src/components/AutoBackupSettings.tsx:15-214` | 加一个 `github` tab |
| 配置持久化在服务端 per-user `config.json`，GET 只回 `*Configured` 布尔 | `routes/config.ts:86-97` | token 同样只存服务端，前端永不回显 |
| `EgressPolicyEngine`：`tenant × owner × agent × scope × destination_host × model_provider × purpose × sensitivity`，缺字段 fail-closed，private / restricted 阻止外部目的地 | `v3/EgressPolicyEngine.ts:6-127` | GitHub 镜像是一次 egress，`destination_host=github.com`，`purpose=backup_mirror` |
| Instinct 侧对照 | Supermemory 黑盒（2026-09-20） | 目录：entities/people、entities/orgs、knowledge/facts|preferences|decisions、comms、timeline/daily|weekly、workstreams/active|completed；文件带 id / type / aliases / `[[links]]` |
| 开源对照 | memsearch、remnic、open-instinct（已克隆到 `.planning/2026-10-08-e72-instinct/repos/`） | memsearch 用 SHA-256 内容哈希做增量同步；remnic capsules 用 AES-256-GCM 加密可移植包；open-instinct `MEMORY.md` 只向非 owner 暴露 `## Preferences` 段 |

## 4. 方案

### 4.1 两层产物：投影（Projection）与镜像（Mirror）

```
SQLite 真源 ──每晚巩固后──▶ Markdown 投影（本地 data/users/<id>/mirror/，可重建）
                                  │  egress 过滤（confirmed + derived；敏感字段按 policy）
                                  ▼
                            GitHub 仓库（用户自有，一晚一 commit；可选整库加密）
```

- **投影**是 [已落地睡眠期整理](../features/memory_foundation.md#睡眠期整理与两车道读取) D 阶段的一个确定性输出，不调 LLM；它与现有 backup zip 的区别是「人类可读、按实体组织、带 frontmatter」，而不是数据库快照。
- **镜像**只是把投影目录 commit 到远端。SQLite 真源永不进镜像（全量恢复仍走现有加密 zip 备份）。

### 4.2 投影目录（对齐 Instinct，保留我们的 provenance）

| 目录 / 文件 | 内容 | 来源表 | 过滤 |
|---|---|---|---|
| `profile/one-pager.md` | 常驻一页纸（见 `memory-resident-one-pager-plan.md`） | `user_one_pager` | identity 全出；preferences 只出 confirmed |
| `profile/USER_CORE.md` | 现有画像视图 | `user_profile_items`、`profile_slots` | `user_confirmed=1` |
| `entities/people/<slug>.md` | 人物：别名、关系、confirmed 事实、偏好、最近互动摘要 | `entities`、`entity_properties`、`social_edges`、`memory_units` | 他人敏感信息按 `sensitivity` 过滤；默认只出与用户有 confirmed 关系的人 |
| `entities/{orgs,projects,topics}/<slug>.md` | 同上 | 同上 | — |
| `knowledge/{facts,preferences,decisions}/<id>.md` | 原子 unit，frontmatter 含 `id / kind / status / evidence_class / observed_at / supersedes / sources` | `memory_units` | `status ∈ {active, superseded}`，`promotion_eligible=true` |
| `workstreams/{active,completed}/<slug>.md` | watched projects + attention ledger 的 open / completed 项 | `watched_projects`、`attention_items` | — |
| `timeline/daily/YYYY-MM-DD.md` | 现有 daily 一行摘要 + 当日新增 unit 链接 | `messages_raw` 摘要 | 不含原文 |
| `timeline/weekly/YYYY-Www.md` | 周报 | `reports` | — |
| `consolidation/DIARY.md` | 巩固日志（新增 / 合并 / 替换计数与 diff 高亮） | `unit_reconcile_decisions` | — |
| `interop/openclaw/{PERSONAL_AI.md,USER.md,MEMORY.md,memory/}` | 按 OpenClaw 约定渲染的只读子集，每行带 `<!-- pai:unit:<id> -->` 回声标记 | 上述 | 只含 confirmed 且 scope=self；见 §4.8 |
| `MIRROR.md` | 生成时间、版本、过滤策略、`未包含什么` 的声明 | — | — |

文件间用 `[[slug]]` 互链，aliases 写 frontmatter，与 Instinct 的做法一致，也让 Obsidian 直接可读。

### 4.3 GitHub provider

- 认证：fine-grained PAT，只需目标仓库 `Contents: Read and write`；token 存服务端 `config.json`，与 webdav 密码同等处理（GET 只回 `githubTokenConfigured`）。
- 写入：Git Data API 一次 commit（create blobs → tree → commit → update ref），避免逐文件 N 次请求；增量用内容哈希比对上次 manifest（memsearch 做法），未变文件不重传。
- 校验：commit 后读回 ref 与 tree sha；对不上判失败，不改本地 manifest，连败 ≥ 3 写 `auto_backup_failed` 通知（复用现有）。
- 分支：默认 `main`，可配；永不 force push；冲突（用户手改）时在 `mirror/` 子目录下新建 `conflict-YYYY-MM-DD/` 保留两版，不覆盖用户编辑。
- 加密模式（可选）：整个投影目录打成 `.tar.enc`（复用 PABK1）再提交，仓库里只有密文；此时放弃可读与互通，换取公开仓库也安全。

### 4.4 Egress 与隐私

- 每次镜像前调用 `EgressPolicyEngine` 评估 `destination_host=github.com`、`purpose=backup_mirror`、`sensitivity` 逐文件；`local_only` 用户不可开启此通道（UI 置灰并说明）。
- 他人信息：`entities/people` 默认只出 confirmed 关系与非敏感事实；用户可在 Options 选「只镜像关于我的内容」。
- 原文永不出镜像；`daily` 只有摘要行。
- `MIRROR.md` 明示「这不是全量备份；恢复请用加密 zip」。

### 4.5 Options 页交互

在现有「自动备份」卡片新增第四个 tab「GitHub 镜像」：仓库地址、分支、token（只写不读）、「测试连接」（读 ref）、模式（可读 Markdown / 加密包）、范围（全部 / 只关于我）、时间（默认巩固后 23:30）、上次 commit 链接与状态。开启时弹一次说明：会把哪些目录推到远端、不会推什么。

### 4.6 与既有 plan 的关系

| plan / 能力 | 关系 |
|---|---|
| `docs/features/memory_auto_backup.md` | 本方案是其第三 provider；全量恢复仍走 zip；共用调度、互斥、失败通知 |
| [已落地睡眠期整理](../features/memory_foundation.md#睡眠期整理与两车道读取) | 投影是其 D 阶段的确定性输出；`consolidation/DIARY.md` 来自 `unit_reconcile_decisions` |
| `memory-resident-one-pager-plan.md` | `profile/one-pager.md` 直接复用 |
| [Task Center 注意力账本](../features/task_center.md#从消息到待办提案attention-triage) | `workstreams/` 的 open / completed 来自 `attention_items` |
| `memory-write-provenance-gate-plan.md` | 只镜像 `promotion_eligible=true` 的 unit |
| `memory-architecture-analysis.md`（第一轮） | 其「适配器 / MCP 互操作」建议落为 `interop/openclaw/` 目录 |
| `ai-memory-portability-ledger-plan.md`（搁置） | 不复活对账台；镜像的 `MIRROR.md` 只做单向声明 |
| `memory-egress-firewall-plan.md`（搁置） | 不建外发预检 UI；复用 `EgressPolicyEngine` 的程序化门 |

### 4.7 明确不做

- 不把 Markdown 变成真源；不从镜像仓库反向导入（用户手改只保留为 conflict 副本，后续是否接「编辑 → proposal」见 one-pager plan）。从 OpenClaw / Hermes 导入走 §4.8 模式 B 的独立 importer，不经镜像仓库。
- 不让 OpenClaw / Hermes 的 workspace 直接指向镜像目录（§4.8 模式 C）。
- 不推原文、不推 SQLite、不推 `config.json`。
- 不支持 force push、不自动合并冲突。
- 不做多端同步或多人共享仓库。

### 4.8 与 OpenClaw / Hermes 的互通：只读、分仓双向、共享读写（2026-10-09 补）

先回答「指向这个目录后 OpenClaw 是读还是写、有没有副作用」。按 OpenClaw memory-core 的文档（`docs/concepts/memory-architecture.md` 分层表、`memory.md`「Automatic memory flush」）：

- OpenClaw **会写** workspace 里的 `MEMORY.md`（Dreaming deep 阶段重写）、`USER.md`（Dreaming 与用户直接请求）、`memory/YYYY-MM-DD.md`（agent 工作中、compaction 前的 memory flush）、`DREAMS.md`；只有 `AGENTS.md` 与 workspace instruction files 是「Human only」。
- OpenClaw 把 workspace 文件视为**操作者信任边界内**的内容：手写笔记无需额外认证即可参与 promotion。这意味着我们镜像过去的任何文本，在 OpenClaw 那边都会被当成 owner 级可信内容。
- 它会把这些文件计入 bootstrap 预算（超出即截断注入）、建入自己的 SQLite 搜索索引、并在 Dreaming 中把其中片段再提炼进它自己的 `MEMORY.md`。

所以直接共享同一目录会有四个副作用：**(1) 写冲突**，我们每晚 commit 会覆盖或与它的改写打架；**(2) 信任提权**，我们标为 `third_party_report` 或 `observed` 的他人信息到了 OpenClaw 变成 owner 可信；**(3) 双重巩固**，同一事实被两套 dreaming 各提炼一遍，回流时形成派生物回声；**(4) 删除不传播**，我们这边 `privacy_delete` 了，OpenClaw 的 git history、索引与 `MEMORY.md` 仍保留。

因此定义三种模式，默认 A，推荐 B，不做 C：

| 模式 | 方向 | OpenClaw 侧做法 | 我们侧做法 | 副作用 | 结论 |
|---|---|---|---|---|---|
| **A 只读消费** | 我们 → OpenClaw | 不把 workspace 指向镜像。两种接法：(a) 在 `AGENTS.md` 里引用镜像 clone 中的 `interop/openclaw/PERSONAL_AI.md`（instruction tier，Human only，OpenClaw 不会改写）；(b) 用 memory-wiki 插件的 `bridge` 模式或一个薄 memory provider 插件把镜像目录当外部语料只读索引 | `interop/openclaw/` 只渲染 **confirmed 且 scope=self** 的内容，不含他人事实；每行带 `<!-- pai:unit:<id> -->` 标记 | 预算截断可见；OpenClaw 仍可能在 Dreaming 中把片段提炼进自己的 `MEMORY.md`（可接受，因为内容本来就是用户确认的自我事实） | **默认** |
| **B 分仓双向** | 双向 | 保持自己的 workspace；允许我们读取它的 `memory/YYYY-MM-DD.md`、`MEMORY.md`、`USER.md`（本机目录或它自己的 git 仓库） | 新增 `OpenClawMemoryImporter`（复用 `SmartMemoryImportService` 的 batch 与 claim attribution）：每晚拉取 OpenClaw 文件 diff → 逐条入库为 `origin_class=untrusted`（外部 agent 产物）、`evidence_class=system_inference`、`source_type=mcp_client`；**带 `pai:unit` 标记的行视为回声，只写 `derived_from` 不建新 unit**（`memory-write-provenance-gate-plan.md` §4.3、echo dampener）；新 unit 进睡眠期 B 阶段判决，不直接进 profile / truth | 需要用户显式开启「从 OpenClaw 导入」；导入内容在 Lens 上标「来自 OpenClaw，未确认」 | **推荐**，这就是「把 OpenClaw 的记忆 benefit 到本项目」的安全做法 |
| **C 共享读写同一目录** | 双向 | workspace 指向镜像 clone | 把用户 / OpenClaw 的改动当 conflict 副本 | 上述四个副作用全部发生 | **不做** |

Hermes 同理：它的 `MEMORY.md` / `USER.md` 有 2,200 / 1,375 字符硬上限且由 `memory` 工具改写，更不适合共享目录；走 A（Hermes 的 context files / skills 只读）或 B（读取 `~/.hermes/memories/` 导入）。

模式 A 的在线形态（MCP）、模式 B 的 importer 接口与插件、以及 Options 一键配置，已拆到独立 plan [`openclaw-memory-link-plan.md`](./openclaw-memory-link-plan.md)；本节保留判定与离线形态（`interop/openclaw/` 目录），实现时以该 plan 为准。A 与 B 可以同时开启。

对 B 模式还要说清楚「能 benefit 什么」：OpenClaw 在家里学到的偏好、环境事实、它替用户做过的事，会以 provisional unit 进入我们的库，经夜间判决后可能被 corroborate 成 active，或被标 disputed 等用户确认；它**不能**直接写我们的 profile、truth 或一页纸 identity。反过来我们给它的只有用户确认过的自我事实。两边各自保留删除权：我们 `privacy_delete` 的 unit 下次导出时从 `interop/` 消失，但 OpenClaw 侧的历史需要用户在那边执行 `memory forget`；`MIRROR.md` 写明这一点。

## 5. 数据契约

- `AutoBackupProviderKind` 扩为 `'webdav' | 's3' | 'github'`；`BackupStorageProvider` 新增可选 `putTree(files: {path, content, hash}[], message) → {commitSha}`。
- 配置新增：`autoBackupGithubRepo`、`autoBackupGithubBranch`、`autoBackupGithubToken`（只写）、`autoBackupGithubMode: 'markdown' | 'encrypted'`、`autoBackupGithubScope: 'all' | 'self_only'`。
- `mirror_manifest(user_id, path, content_hash, last_commit_sha, updated_at)` 用于增量。
- `MirrorProjectionService.render(userId) → { files[], receipt: { included, excluded_by_policy, generated_at } }`，纯函数化，可在 eval 中离线跑。

## 6. 实施阶段

| 阶段 | 内容 | 天数 | 门槛 |
|---|---|---|---|
| Phase 0 | 投影渲染器（本地目录，不推远端）：profile / entities / knowledge / timeline；`MIRROR.md` | 4 | 用 `esone.qiu` 快照渲染一次，人工检查无原文、无敏感字段泄漏 |
| Phase 1 | `GitHubProvider`（Git Data API 单 commit、哈希增量、校验、conflict 目录）+ Options tab | 4 | 测试仓库连续 7 晚 commit 成功 |
| Phase 2 | Egress 逐文件评估 + `self_only` 范围 + 加密模式 | 3 | `local_only` 用户不可开启；加密包可用现有解密工具还原 |
| Phase 3 | `interop/openclaw/` 渲染（模式 A，含 `pai:unit` 标记）+ `workstreams/`（依赖 attention triage） | 2 | OpenClaw 通过 `AGENTS.md` 引用或 bridge 只读可读到 confirmed 偏好；它的 workspace 未指向镜像 |
| Phase 5（可选） | 模式 B：`OpenClawMemoryImporter`，回声标记识别，导入项标「未确认」 | 3 | 导入 100 行中带标记的行 0 条成新 unit；新 unit 全部 `origin_class=untrusted` |
| Phase 4 | `consolidation/DIARY.md`（依赖 reconciliation B 阶段） | 1 | — |

## 7. Evals（上线门槛）

新增 `memory-service/evals/markdown-git-mirror/`：

| case 组 | 最少条数 | 门槛 |
|---|---|---|
| 投影不含原文 / token / 密钥 / `restricted` 字段 | 全量扫描 | 违规 0 |
| `self_only` 范围不含他人敏感事实 | 10 | 违规 0 |
| 增量：未变文件不重传 | 5 晚 | 重传 0 |
| 冲突：远端手改后不被覆盖 | 3 | 覆盖 0；conflict 目录生成 |
| 可重建：删掉本地投影后重渲染与上次 manifest 一致 | 1 | diff 0 |
| 互通：OpenClaw 读到 confirmed 偏好 | 5 | 命中 ≥ 0.8 |
| 互通回声：带 `pai:unit` 标记的行回流不成新 unit | 10 | 新 unit 0 |
| 互通提权：`interop/` 不含他人事实与 `observed` 内容 | 全量扫描 | 违规 0 |

## 8. 风险与缓解

- **把别人的信息推到用户的 GitHub**：默认 confirmed + 非敏感；`self_only` 开关；`MIRROR.md` 声明；首次开启时展示将推送的目录清单。
- **token 泄漏**：只存服务端、只写不读、最小权限 PAT；文档提示用 fine-grained token 并设过期。
- **仓库体积膨胀**：只推投影不推原文；`timeline/daily` 一行摘要；超过阈值提示归档。
- **用户以为这是全量备份**：UI 与 `MIRROR.md` 双重声明；恢复入口仍指向 zip。
- **GitHub API 限流**：单 commit 批量写；夜间执行；失败走现有退避与通知。

## 9. 可观测性与回滚

- 指标：每晚文件数 / 变更数 / 体积 / commit 耗时 / 失败次数 / 被 egress 过滤的文件数。
- Flag：`AUTO_BACKUP_GITHUB_ENABLED`、`MIRROR_PROJECTION_ENABLED`。
- 回滚：关 flag 停止推送；仓库历史保留；本地投影目录可删（可重建）。

## 10. Demo 说明

`memory-markdown-git-mirror-demo.html` 模拟 Options 自动备份卡片新增的「GitHub 镜像」tab：仓库 / 分支 / token（只写）/ 模式 / 范围 / 测试连接 / 将推送的目录清单 / 上次 commit 回执。文案中文。

## 11. 文档交接

实现后并入 `docs/features/memory_auto_backup.md`（新增「GitHub 镜像通道」与「投影目录」两节），更新 `docs/index.md`，删除本 plan，demo 移至 `docs/demo/`。

## 12. 推荐决策

Phase 0 的投影渲染器可以独立先做（四天，零 LLM），它同时服务 one-pager 的 Markdown 视图与未来的 OpenClaw 互通；Phase 1 的 provider 在现有框架里是增量工作。
