# Personal Skill Foundry：个人技能炼金台

*创建: 2026-05-03 CST*

配套 demo：[`personal-skill-foundry-demo.html`](./personal-skill-foundry-demo.html)

## 2026-05-06 更新：与 Flight Recorder 合并后的产品边界

最终呈现不应该变成两个并列入口。用户看到的核心产品应是一个 **个人技能库 / Personal Skill Library**，管理“我有哪些技能、从哪里来、在哪些 agent 平台安装过、最近是否有效”。**Operation Memory Flight Recorder** 不作为独立主功能长期存在，而是 Skill Library 的一个高质量输入源。

合并后的理解是合理的：

- Skill Library 是主对象，负责 skill 的真源、版本、证据、eval、导出、安装状态和跨平台同步。
- Flight Recorder 是输入源，负责把真实操作 episode 转成 skill candidate / skill patch。
- OpenClaw、Codex、Claude Code、Cursor、ChatGPT、豆包等 agent 平台是双向集成目标：既可以导入它们已安装或沉淀的 skill，也可以把 Personal AI 的 skill 发布/安装到这些平台。
- OpenClaw 绑定的 skill 也是输入源之一，尤其适合导入用户已经在 OpenClaw 里沉淀的 `SKILL.md`、脚本和资源。

开发顺序建议拆成两个 phase：

### Phase 1：个人技能库 + 平台同步

目标是先建立用户可见、可管理、可导出的 skill 真源，不依赖 Flight Recorder 先做完。

范围：

- Skill Library 页面：展示所有技能、来源、版本、风险、eval 状态、最近运行、安装平台。
- Skill detail：`SKILL.md` preview、scripts/resources、evidence、version diff、run receipts。
- 平台安装状态：Codex / Claude Code / OpenClaw / Cursor / ChatGPT / Personal AI internal。
- 手动导入：上传/粘贴 skill folder、`SKILL.md`、agent instruction、platform rule。
- 自动同步：从本机 Codex skill 目录、Claude skill 目录、OpenClaw 远程实例读取已安装 skill。
- 导出/安装：优先生成可复制安装指令或可访问 web page；同机时可写入本地 skill 目录。
- 外部访问：每个 active skill 可暴露一个只读 web URL / API，让 Codex、Claude Code、OpenClaw 或其他 agent 通过一句安装提示读取。

体验重点：

- 用户能看到“这个技能来自哪里，现在装在哪些平台”。
- 安装不强依赖 Chrome Extension 自动点击；如果目标 agent 无法被自动控制，就生成一句明确的安装 prompt。
- 导入导出默认 preview，涉及写文件、远程写 skill、覆盖现有版本时必须确认。

### Phase 2：Flight Recorder 作为技能输入源

目标是在 Skill Library 稳定后，把真实操作记忆变成持续的 skill candidate 流。

范围：

- Flight Recorder 捕获跨工具操作 episode：浏览器、Jira、AI 对话、终端、文件变更、会议准备。
- Episode distillation：提取 preconditions、steps、tools、validation、失败修正、可复用触发条件。
- Candidate queue：把高置信 episode 推入 Skill Library 的 candidate inbox。
- Skill patch：当已存在技能被新的操作修正时，生成 diff，而不是创建重复技能。
- Run receipt：某个平台使用技能后的结果回流 Skill Library，驱动 eval 和版本更新。

这两个 phase 联动后，用户看到的是一个个人技能资产库；Flight Recorder 只是其中“从真实操作自动长出技能”的来源。

## 2026-05-07 更新：交互简化与可落地的同步路径

第一版 demo（[`personal-skill-foundry-tab-demo.html`](./personal-skill-foundry-tab-demo.html) 的初稿）信息密度过高，把「发布就绪度 / Eval 通过率 / Run receipt」放到了首屏。第二版以用户视角重新校准：用户来这里只想回答四个问题——**我有哪些技能、哪些可能可以沉淀、已经绑定到哪些平台、怎么快速绑定到其他平台**。本节记录了由此带来的交互与功能边界调整。

### 默认视图只剩两栏

- 删除右侧「发布就绪 / 信号雷达 / 风险策略 / 来源 episode」整列；这些信息要么并入工作流 tab，要么作为可选 hover 详情。
- 详情区 tab 从 7 个减到 4 个：**工作流 / 证据 / 版本 / 绑定**，第一个 tab 由 `Spec` 改成 `工作流`（任务核心是流程，不是规格说明书）。
- 候选卡片底部之前展示「来源标签」（Jira / RingCentral / Codex），改为展示**已绑定平台**（带 installed / outdated / blocked 状态点）。这样用户一眼能看出这条技能正在哪些工具里活着。

### 安装与绑定改为「一句安装指引 + skill URL」

不再生成完整 SKILL.md 文件夹塞进剪贴板，也不强制 Personal AI 直接写远端文件系统。绑定流程改为：

1. Personal AI 为每个 active 技能暴露一个稳定 URL：`https://personal-ai.local/skills/<slug>@<version>`，只读，含 ETag / If-None-Match。
2. UI 在「绑定」tab 给每个目标平台生成**一句话安装指引**，例如：
   - Codex：`请安装并使用我的个人技能：<url>`
   - Claude Code：`Read and follow this skill spec, then install it locally: <url>`
   - OpenClaw：`skills.install --url <url>`
   - ChatGPT GPTs：`请按这份 SKILL spec 工作（按需 fetch 资源）：<url>`
3. 用户点「复制」，把这一句粘到目标 agent；agent 自己通过 URL 抓 SKILL.md / scripts / resources。Personal AI 不再尝试在剪贴板里塞 markdown 全文。
4. **已绑定状态由后台同步程序异步更新**，UI 只展示状态。状态来源：
   - OpenClaw：`POST /v1/responses` + `skills.status` RPC。
   - 本地 coding agent：Desktop App 的 fs watcher 检查 `~/.codex/skills` / `~/.claude/skills` 等目录里的 `SKILL.md` mtime + sha256。
   - 纯 Web 平台：状态默认 `unknown`，依赖用户手动标记或一段时间内的 ambient 提示。

这个改造让安装 UX 不再依赖任何「自动写文件 / 自动控制浏览器」能力，所有平台都至少有可行路径。

### 命名与状态机：「候选」→「萃取建议」，状态从 3 态收敛到 2 态

「候选（candidate）」这个词在用户视角下含义模糊：它既不是「我已经拥有的技能」，也不是「我打算丢掉的东西」，听起来像是在投票里待选的选项。重新命名为「**萃取建议（Skill Suggestion）**」：

- **「萃取」** 呼应"个人技能炼金台"的主题，暗示"从你真实做过的事情里提炼出来"。它的来源就是 [`docs/progressing/operation-memory-flight-recorder-plan.md`](./operation-memory-flight-recorder-plan.md) 里的 operation episode。
- **「建议」** 明确告诉用户：这是 Flight Recorder 给你的提案，不是已经被你认领的资产；要不要纳入完全由你定。

同时把原本 `candidate / draft / active` 三态收敛为两态：

| 状态 | 含义 | 在主列表是否可见 |
|---|---|---|
| `suggestion` | Flight Recorder 萃取出的建议，等用户决策 | 否（在 inbox bar 里集中处理） |
| `active` | 用户认领的真源技能 | 是 |
| `dismissed` | 用户主动丢弃的建议 | 否（默认隐藏，可在过滤器里恢复） |

之所以去掉 `draft`：在简化版的"安装指引 + URL"模型下，技能从识别到可用之间的中间态意义不大——一旦用户在 inbox 里点「使用」，就直接 promote 为 `active` 并立即可被各平台同步。如果用户在使用前还要改 SKILL.md，那是版本演进问题（`v0.1 → v0.2`），不应该再多一个状态来表达"还没准备好"。

### 主动推送：识别到新建议时，先在通知里让用户决策

之前默认用户会主动来 Skill Foundry 看建议。这与现实不符：用户可能几周才打开一次。新方案让建议**主动找人**：

1. **触发**：Operation Memory Flight Recorder 在每次完成一个 episode 后，调用萃取 pipeline；只要置信度 ≥ 阈值，就生成一条 `Skill Suggestion`。
2. **推送渠道**：直接走 Personal AI 现有的 `NotificationService`（消息通知 / 系统弹窗 / 桌面通知），文案模板：

   > 📥 **Personal AI** · 萃取出一条新技能建议
   > **Jira Headcount Trend Report** — 来自和 Sophia 的 Jira 协作 episode（近 30 天 5 次相似）
   > [使用] [丢弃] [稍后审]

3. **三选一动作**：
   - **使用**：直接 promote 为 `active`，进入主列表；随后所有开启了平台同步的 agent 平台会跟随推送（可在通知里附「同步给 Codex / OpenClaw / Claude Code」状态行）。
   - **丢弃**：标 `dismissed`，30 天内不再为同一类操作产出建议（避免重复打扰）。
   - **稍后审**：保留在 Inbox 里，等用户回到 Skill Foundry 主动审。

4. **节流与降噪**：每天最多推送 N 条；同一类 episode 在用户已 dismissed 后进入冷却期；用户可在设置里调"每天最多推送几条"或"完全静默，让我自己来看"。

5. **降级**：如果通知发送失败 / 用户禁用通知，建议依然落到 Inbox bar，下一次用户回到 Skill Foundry 时会以红点 + 数字徽章呈现。

### Inbox Bar：未决策建议的承载点

界面上对应的承载点是 Skill Foundry 顶部的一条 **Inbox Bar**：

- 收起态：`📥 萃取建议 · N 条待决策`，未读时带红点；点击展开。
- 展开态：横向滚动的小卡片列，每张小卡显示：
  - 候选标题 + 萃取自的 episode（带 🛫 链接）
  - 触发统计（"近 30 天 5 次相似"）
  - 三动作：[使用] / [丢弃] / [展开]，与通知里的三选一保持一致
- 点 [展开] 才打开右侧详情区做精细审稿；多数情况用户在小卡上一键决策即可。
- 全部决策完后，Inbox Bar 自动收起。

这样建议是 **ephemeral** 的（用完即清），不会和"在用技能"共用主列表的视觉空间，让"我有什么技能"和"系统建议我什么"两件事一眼可分辨。

### 主列表只展示「在用」

主列表（左栏候选列表）的默认过滤器改为 **`在用`**——用户来这里第一眼应该看到自己已经认领的资产，而不是 Flight Recorder 给的提案。Segmented 过滤器：

- `在用`（默认）— `status === active`
- `全部` — `active + dismissed`，方便回顾
- `已丢弃` — 仅 `dismissed`，便于"我之前丢错了，捡回来"

`suggestion` **不出现**在主列表的任何过滤器里，因为它有专属的 Inbox Bar 入口；这避免了用户在两个地方都看到同一条建议、不知道该在哪里操作。

> **术语对齐**：本节之后的章节里依然会出现 `Skill Candidate` / `skill_candidates` / `Candidate Scoring` 等旧术语——这些是 2026-04 起草本时遗留的英文命名。**它们在新方案下统一指代「萃取建议 / Skill Suggestion」**，状态字段从 `candidate / draft / active` 简化为 `suggestion / active / dismissed`。后续重构 schema 时直接把表名 / API 路径里的 `candidates` 替换为 `suggestions`，无需保留向前兼容（这部分还没上线）。

### 自动同步分三类，统一在「⚙ 自动同步设置」里管理

> **作用域：自动同步是 per-platform，不是 per-skill。** 一旦对某个平台开启自动同步，Personal AI 会把**所有 active 技能**推送到该平台；之后该平台新增 / 升级 / 撤销的技能也会自动跟随。我们不在单条技能上提供「只同步给 Codex 不同步给 Claude」这种细粒度开关，因为：① per-skill 矩阵会让用户每写一条技能都要做一次 N 选题；② Personal AI 的真源版本是单一的，没必要给每条技能维护一份独立的多平台分发策略。需要例外时，通过 skill 上的 `riskPolicy.exclude_platforms`（极少数）或 `scope = ai|work` + 平台默认 scope 过滤实现。

| 同步路径 | 适用平台 | 能力 | 默认开关 |
|---|---|---|---|
| `internal` | Personal AI | 真源，永远 active | 不可关 |
| `api` | OpenClaw remote | 双向 list / install / status / 回拉完整 SKILL 包 | 默认开 |
| `fs_via_desktop_app` | Codex / Claude Code / Cursor / 任何本地 SKILL.md 目录 | Desktop App fs watcher，监听 mtime + sha256 | 默认关，未装 Desktop App 时 disabled |
| `manual_only` | ChatGPT GPTs / Claude.ai Skills 等 Web 平台 | 不写文件，只能复制安装指引 | 不可开自动同步，开关常驻 disabled |

设置入口是一个 dialog，不是常驻面板。这避免一开始就给用户暴露七八个开关。开 dialog 的入口有两个：页面顶部「⚙ 自动同步设置」按钮，以及「绑定」tab 里的「平台级自动同步」二级入口（按钮文案带"平台级"前缀，提醒用户这不是当前 skill 的设置）。

### mtime / hash 冲突判定：哪个版本算最新

per-platform 同步开启后，每条技能在每个平台上有 3 个候选版本：**Personal AI 真源（authoritative）**、**远端实际安装版本（platform）**、**对端可能存在的本地手改（platform-edit）**。同步 daemon 周期性比较：

```
sync tick (per skill × per active platform):
  source = personal_ai.skills[slug]   # { version, updated_at, sha256 }
  remote = platform.read(slug)        # { version, mtime, sha256 } 或 None
  if remote == None:
    install(source)                    # 首次推送
  elif remote.sha256 == source.sha256:
    noop                               # 已对齐
  elif remote.version == source.version and remote.sha256 != source.sha256:
    # 同 version 但 hash 不一致 → 平台被本地手改
    if remote.mtime > source.updated_at:
      flag_external_change(slug, platform, remote)   # 进候选审稿
    else:
      install(source)                  # 远端是旧脏文件，覆盖
  elif remote.version < source.version:
    # 远端版本旧，正常推送，但若 remote.mtime > source.updated_at 仍要审稿
    if remote.mtime > source.updated_at:
      flag_conflict(slug, platform, remote)
    else:
      install(source)
  elif remote.version > source.version:
    # 几乎不会发生（远端不应私自升 version），出现就 100% 进候选
    flag_conflict(slug, platform, remote)
```

判定的两个核心信号：

1. **`sha256` 是「真不真」的判官**：只要远端 sha256 和真源不一致，就一定要细看；相同则永远 noop。
2. **`mtime > source.updated_at` 是「会不会丢用户改动」的判官**：哪怕版本号匹配，也要把"远端 mtime 比真源 updated_at 新"当成"用户在远端手改了"，进候选审稿；不能直接覆盖。

这意味着 `mtime` 不是用来选「谁是最新」，而是用来选「需不需要先问用户」。最终入库始终是 Personal AI（真源），不会因为本地 mtime 新而把真源回写——回写只在用户在候选 inbox 里 approve 之后发生。

> Web 平台（`manual_only`）没有可读的 mtime / sha256，所以不参与这一判定，状态始终标 `unknown`，依赖用户主动确认。

### 双向同步与冲突：默认只做单向推送，mtime 冲突是开放问题

用户提出的关键问题是：**自动同步是不是会复杂到要按 mtime 决定谁是最新版本？** 答案是会，但 MVP 不必一上来就做对。我们采用分阶段策略：

1. **MVP-A（推送主导）**：Personal AI 每次发布新版后推送到所有自动同步平台。Desktop App / OpenClaw 在写入前先 `if-none-match` 当前安装版本的 sha256，避免重复写。本地若 mtime > Personal AI updatedAt，**不直接覆盖**，而是把当前文件读回 Personal AI，作为 `external_change` 候选进入候选 inbox 由用户审稿。这样用户的本地手改不会丢，也不会偷偷改写真源。
2. **MVP-B（冲突解决体验）**：当远端和本地 mtime/hash 都比 Personal AI 真源新且不一致时，标 `conflict`，UI 在该平台 binding 上显示红点并附 diff，让用户选「pull from this platform / push from Personal AI / 手动合并」。
3. **MVP-C（高级 reconciliation）**：以 sha256 + 三方比较实现真正双向 sync，并在 Skill Foundry 引入 `sync_log` 审计。

短期内只做 MVP-A 已经能让用户感知「我有的技能正在被自动推到 OpenClaw / Codex」，并且不会在没有用户确认时丢掉本地修改。

### Runs 与 Evals 退出 MVP

- **Runs / receipts**：本来要求每次技能被使用都写一条回执。现实里这要求每个目标 agent 平台都吐出执行结果，工程负担大；MVP 不做。技能的「工作得好不好」改由两个轻量信号反映——`bindings[].state` 和用户主动写到 Personal AI 的反思 / 反馈。
- **Evals**：原计划在 UI 里跑 happy path / missing input / edge case 三类评测。MVP 不做评测面板：用户更愿意在目标 agent（Codex / Claude Code）里直接试，再把失败例子作为新的 candidate 写回 Skill Foundry。如果以后真的要做，会作为「测试」二级入口而不是首屏 tab。

这两块退出 MVP 的同时，相应的 schema（`skill_eval_cases` / `skill_eval_runs` / `skill_runs`）暂不建表；`docs/features/...` 落地时再决定是否补回来。

### 总览：用户首屏的最终承诺

进 `memory-exploring.html#/skills` 后，用户在 5 秒内能看到：

- 我有 N 条 active 技能、M 条 draft、K 条候选。
- 每条技能已经绑定到哪些平台、状态如何。
- 每条技能下一步可以怎么绑定到其他平台（一句话复制即可）。
- 自动同步当前对哪些平台开着、哪些因为缺 Desktop App 而 disabled。

所有更深的能力（评测、回执、详细风险策略、SKILL.md 渲染产物）都在二级入口里，不在首屏抢用户注意力。

## 结论

建议设计一个新能力：**Personal Skill Foundry（个人技能炼金台）**。

它不是再做一个“把记忆交给另一个 AI”的胶囊，也不是“回放过去决策”的时间机，而是把用户在 ChatGPT、Claude、Codex、Cursor、豆包、Jira、会议、网页和本机操作里反复验证过的做法，自动萃取成一组**可审计、可评测、可导出、可持续进化的个人技能**。

一句话价值：

> Personal AI 不只记住“发生了什么”，还会记住“你是怎么把事情做成的”，并在下一次相似场景里直接拿出可复用的技能。

这个方向特别适合 Personal AI 的长期目标：用户不只是沉淀消息、网页、会议、偏好和 AI 对话，还会沉淀“在其他平台形成的 skill”。Skill Foundry 就是把这些隐性的 skill 从历史轨迹里提炼出来，变成用户自己的能力资产。

## 本次输入信号

### Reminder 检查

本机 Reminders 里没有名为 `Personal AI` 的列表。当前可见列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`。因此本次没有从 Reminder 随机抽取全新 idea，按主动构思分支推进。

### 自动化历史避让

前两次自动化已经产出：

- `docs/features/context_assist.md`：AI Prompt Injection / Context Handoff 与会前准备。
- `decision-time-machine-plan.md`：个人决策记忆回放。

本次刻意避开这两个方向。Skill Foundry 的核心对象不是“上下文包”或“决策 episode”，而是**可反复执行的 procedural memory / workflow skill**。

### 真实记忆信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 的记忆。本次 HTTP `/health` 在 8 秒内超时，随后通过 SSH 只读查询远端用户数据，没有修改远端服务状态。

读到的关键事实：

- Memory DB 当前约有 `9020` 条原始消息、`4238` 个 chunks、`13517` 个实体、`33807` 条画像项、`587` 条 reflection threads。
- 用户身份：Esone Qiu，Scrum Master，时区 Asia/Shanghai。
- 2026-04-30 日总结中，高频事项包括：
  - Factory.ai free trial 已通过安全审批，可用 RingCentral 邮箱登录并用于 production project。
  - 团队正在讨论 Cursor 成本、Codex / Claude Code / Factory.ai 的工具迁移和选型。
  - Gary Chevsky 请求团队在 Claude Code 与 Codex 之间快速投票。
  - Sophia 与 Esone 协作做 JIRA 数据抽取、开发人数统计、趋势图，显著节省时间。
  - 会议、项目 handover、Video Mobile / Rooms / RCV SDK / Nova 责任调整仍是高频协作场景。
- 近期消息里还出现：
  - “AI Skills to the Message module to automate repetitive tasks”
  - “Chrome Skills”
  - “Codex skill”
  - “codex/cc 的用途：动态生成页面并插入 app”
  - “CC 的 role：操作和记忆方”

这些信号指向一个现实痛点：用户已经在大量 AI 工具和工作流里积累了“怎么做”的经验，但这些经验散落在对话、操作、会议和消息里，没有被稳定沉淀为可复用技能。

## 为什么要做

Personal AI 现在已经能保存大量事实、消息、页面、会议、AI 对话，也有主动反思、召回、provider context package、Desktop App explorer、动作队列等基础设施。但从真实使用角度看，用户仍然会遇到这些问题：

1. **重复解释流程**
   - 每次让 Codex / Claude / ChatGPT 做 JIRA 数据分析、会议总结、项目进展图、页面 demo、RingCentral 消息处理，都要重新解释“我通常怎么做”。

2. **成功经验不会自动变成能力**
   - 一次 AI 对话里调好的 prompt、脚本、检查清单、数据口径，下一次很难稳定复用。

3. **跨平台 skill 被锁在平台内**
   - Claude Skills、GPTs、Zapier Agents、Cursor rules、Codex skills 各自有格式。用户真正需要的是自己的 skill 真源，而不是被某个平台绑定。

4. **技能没有评测**
   - 很多 prompt / workflow 看起来能用，但没有测试样例、失败条件、版本差异、风险边界。下一次模型变了、工具变了，结果会漂。

5. **个人操作记忆没有产品化**
   - 用户的浏览路径、Jira 查询、会议前准备、AI 工具调用、本地脚本运行，本质上都是 procedural memory，但现在主要被当作普通消息/日志。

Skill Foundry 要解决的是：

> 从“记住信息”升级到“沉淀做事方法”，再把做事方法交给任何 AI / agent / 自动化入口复用。

## 行业观察

### Anthropic Agent Skills 把“技能”推成一等对象

Anthropic 在 2025-10 发布 Agent Skills，官方定义为包含说明、脚本和资源的文件夹，Claude 会在相关任务中按需加载；2025-12 又把 Agent Skills 发布为跨平台可移植的 open standard。官方还明确提到未来希望 agent 能自己创建、编辑和评测 skills。参考：

- [Introducing Agent Skills](https://claude.com/blog/skills?t=n)
- [Equipping agents for the real world with Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)

对 Personal AI 的启发：

- Skill 不应只是 prompt，而应包含说明、脚本、资源、测试和触发条件。
- Skill 应该可组合、可移植、按需加载。
- 真正惊艳的下一步不是“用户手写 skill”，而是 Personal AI 从用户历史轨迹里自动萃取 skill。

### ChatGPT GPTs / Projects 解决了部分上下文，但不是个人技能真源

OpenAI Help Center 说明 GPTs 是 ChatGPT 内部的 no-code assistant；GPTs 不使用 saved memory、custom instructions 或历史对话，每个 conversation fresh start。ChatGPT Projects 支持 project-only memory，让上下文限定在项目内。参考：

- [GPTs in ChatGPT](https://help.openai.com/en/articles/8798889-how-can-i-use-gpts)
- [Projects in ChatGPT](https://help.openai.com/en/articles/10169521-projects-in-chatgpt)

这说明 ChatGPT 生态适合做静态助手和项目上下文，但不天然解决：

- 从历史 AI 对话中自动提炼可复用流程。
- 跨 Claude / Codex / Cursor / 豆包 / Chrome Extension 共享 skill。
- 给 skill 建 eval、版本、证据和风险策略。

### Zapier Agents 证明“自然语言创建自动化”正在成为大众入口

Zapier Agents 允许用户用自然语言描述触发条件、任务和所需 apps，再配置、测试、发布 agent。参考：[Build an agent in Zapier Agents](https://help.zapier.com/hc/en-us/articles/24393442652557-Build-an-agent-in-Zapier-Agents)。

对 Personal AI 的启发：

- 用户不想从零设计自动化，更愿意从“我已经做过的事”生成自动化草稿。
- 发布前必须能 test。
- 技能要连接知识源、工具和触发条件。

Personal AI 的差异点是：Zapier 从用户描述开始，Personal AI 可以从用户真实记忆和执行轨迹开始。

### 论文方向正从 memory 走向 lifelong skill evolution

近期论文非常直接地支持这个方向：

- AutoSkill 提出从 dialogue 和 interaction traces 自动派生、维护、复用技能，并在未来请求中动态注入，无需重新训练模型。参考：[AutoSkill](https://arxiv.org/abs/2603.01145)。
- SkillX 从 raw trajectories 中蒸馏多层级技能，包括 strategic plans、functional skills、atomic skills，并通过 execution feedback 持续修订。参考：[SkillX](https://arxiv.org/abs/2604.04804)。
- SkillFlow 指出 autonomous agents 需要能从经验中发现、修复、维护技能库；同时提醒 high skill usage 不等于 high utility，因此评测和失败分析很关键。参考：[SkillFlow](https://arxiv.org/abs/2604.17308)。
- ReUseIt 研究 web automation 中从成功和失败尝试自动合成 reusable workflows，并加入 execution guards，任务成功率从 24.2% 提升到 70.1%。参考：[ReUseIt](https://arxiv.org/abs/2510.14308)。
- Agentic Context Engineering 把 context 看作会积累、反思、策展的 evolving playbooks，并强调防止 iterative rewriting 造成 context collapse。参考：[ACE](https://arxiv.org/abs/2510.04618)。
- Tool-learning survey 总结了工具学习的三个关键问题：何时调用工具、如何检索正确工具、如何有效使用工具，并指出文本输入容易造成用户意图模糊。参考：[LLM-Based Agents for Tool Learning](https://link.springer.com/article/10.1007/s41019-025-00296-9)。

这些研究共同指向一个产品机会：

> Personal AI 可以把“记忆系统”升级为“个人技能生命周期系统”：从经验中发现技能、生成技能、评测技能、发布技能、监控技能、让技能持续进化。

### 专家/实践者观点：context 不是越多越好

Simon Willison 转述 Drew Breunig 的 context engineering 观点时，提到 context poisoning、context distraction、context confusion、context clash 等失败模式，并强调 context pruning、summarization、offloading 等策略。参考：[How to Fix Your Context](https://feeds.simonwillison.net/2025/Jun/29/how-to-fix-your-context/)。

这对 Skill Foundry 很重要：技能不是把所有历史上下文塞给 AI，而是把经过验证的流程、约束、工具、测试和边界整理成最小可用能力。

Anthropic 的 agent evals 文章也强调，评测 agent 时不是只看最终文本，而是看 task、trial、grader、transcript、outcome、harness。参考：[Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)。

所以 Skill Foundry 的设计不能停在“自动生成一段 prompt”，必须把 eval harness 当作产品核心。

## 功能定位

### 功能名

**Personal Skill Foundry / 个人技能炼金台**

### 目标用户

第一目标用户就是当前 Personal AI 的真实使用者：

- 同时使用 Codex、Claude Code、Cursor、Factory.ai、ChatGPT、豆包等工具。
- 经常做 Jira 数据分析、会议准备、项目协调、消息处理、原型/demo、AI 工具评估。
- 已经在不同 AI 工具里沉淀了不少“经验型 prompt / workflow / harness / checklist”。
- 不想每次从头解释流程，也不想把 skill 锁死在某个平台。

### 一句话产品承诺

> 你做过一次的成功流程，Personal AI 会帮你变成下一次可复用、可测试、可迁移的个人技能。

### 不做什么

- 不做一个纯 prompt 收藏夹。
- 不直接替代 Claude Skills / GPTs / Zapier Agents。
- 不自动发布高风险技能到外部平台。
- 不把所有历史对话粗暴总结成 skill。
- 不让 AI 在没有用户确认时执行外部写操作。

## 核心概念

### Skill Candidate

系统从历史轨迹里发现的“可能值得沉淀”的技能草稿。

候选触发条件：

- 同类任务在 30 天内出现 3 次以上。
- 用户明确接受了 AI 输出，或后续消息显示结果成功。
- 某段 AI 对话产生了稳定脚本、prompt、检查清单、数据口径。
- 用户反复手动执行相同浏览/Jira/表格/会议准备操作。
- 反思线程发现“下次可以复用”的 action pattern。

候选字段：

```ts
interface SkillCandidate {
  id: string;
  title: string;
  problemStatement: string;
  inferredTrigger: string;
  sourceKinds: Array<'chatgpt' | 'claude' | 'codex' | 'doubao' | 'meeting' | 'message' | 'jira' | 'web' | 'operation'>;
  evidenceRefs: SkillEvidenceRef[];
  repetitionScore: number;
  successSignalScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  suggestedOwnerScope: 'personal' | 'work' | 'project';
  draftSpec: SkillSpecDraft;
  createdAt: number;
  updatedAt: number;
}
```

### Personal Skill

用户确认后的正式技能。它是 Personal AI 的一等资产，不从属于某个外部平台。

```ts
interface PersonalSkill {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'retired';
  scope: 'work' | 'personal' | 'both';
  ownerUserId: string;
  triggerSpec: SkillTriggerSpec;
  routineSpec: SkillRoutineSpec;
  resourceRefs: SkillResourceRef[];
  evalSuiteId?: string;
  currentVersionId: string;
  exportBindings: SkillExportBinding[];
  riskPolicy: SkillRiskPolicy;
  evidenceRefs: SkillEvidenceRef[];
  createdAt: number;
  updatedAt: number;
}
```

### Skill Version

每次修改都创建版本，支持 diff、回滚、比较评测。

```ts
interface SkillVersion {
  id: string;
  skillId: string;
  version: string;
  format: 'personal_skill_spec';
  specJson: SkillSpec;
  generatedSkillMd?: string;
  generatedPrompt?: string;
  generatedScripts?: Array<{ path: string; contentHash: string }>;
  changelog: string;
  createdFrom: 'candidate' | 'manual_edit' | 'run_feedback' | 'eval_failure' | 'external_import';
  createdAt: number;
}
```

### Skill Spec

Skill Spec 是内部规范，能导出为不同平台格式。

```ts
interface SkillSpec {
  identity: {
    name: string;
    summary: string;
    whenToUse: string[];
    whenNotToUse: string[];
  };
  inputs: {
    requiredContext: string[];
    optionalContext: string[];
    userQuestionsToAsk: string[];
  };
  workflow: Array<{
    step: string;
    purpose: string;
    tools?: string[];
    guardrails?: string[];
    expectedOutput?: string;
  }>;
  resources: Array<{
    kind: 'prompt' | 'script' | 'template' | 'example' | 'checklist' | 'schema' | 'link';
    title: string;
    ref: string;
  }>;
  evals: Array<{
    name: string;
    inputFixture: string;
    successCriteria: string[];
    failureCriteria: string[];
  }>;
  riskPolicy: {
    externalWrites: 'never' | 'ask_first' | 'allowed_for_low_risk';
    personalData: 'exclude' | 'redact' | 'allow_with_confirmation';
    secrets: 'block';
  };
}
```

### Skill Receipt

> ⚠️ 2026-05-07 更新：Receipt 不进 MVP。原计划要求每次技能被使用都写回执，但需要每个目标 agent 平台都吐执行结果，工程负担太重；详见上方「Runs 与 Evals 退出 MVP」一节。短期内技能质量信号改由 `bindings[].state` + 用户主动反思承担。下面字段保留作为长期方向。

每次技能被使用，留下回执：

- 哪个场景触发。
- 使用了哪个 skill 版本。
- 注入了哪些记忆与资源。
- 执行了哪些工具或外部动作。
- 用户是否接受结果。
- 哪些失败应该反哺下一版 skill。

这让 skill 不是静态 prompt，而是可度量、可修复的长期能力。

## 关键体验

### 体验 1：自动发现“你已经重复做过的成功流程”

场景：

用户最近多次让 AI 处理 Jira 数据，包括：

- 抽取开发人数。
- 去重 assignee。
- 按 team / project / date 统计。
- 输出趋势图。
- 给 Sophia 或项目组汇报。

Personal AI 在 Daily Reflection 后生成一个候选：

> 候选技能：Jira Headcount Trend Report

候选卡展示：

- 发现来源：3 次 Jira 数据分析对话、2 条 Sophia 相关消息、1 次 accepted Codex output。
- 复用价值：高。
- 风险：中，需要用户确认数据口径。
- 建议触发：当页面是 Jira / Google Sheet，或用户问“统计开发人数 / trend / headcount”。
- 操作：`Review`、`Dismiss`、`Merge with existing skill`。

用户点 `Review` 进入 Skill Foundry。

### 体验 2：Foundry 页面像一个“技能审稿台”

页面分三栏：

- 左侧：候选技能 inbox，按价值、重复度、风险排序。
- 中间：Skill DNA，包括触发条件、工作流步骤、资源、证据、评测。
- 右侧：发布和导出，包括 Claude Skill、Codex Skill、Chrome Skill、MCP tool、GPT instruction、Memory Service 内部技能。

用户需要能快速回答：

- 这个技能解决什么问题？
- 它从哪些真实证据萃取出来？
- 下次什么时候应该触发？
- 会不会误触发？
- 有哪些测试样例？
- 发布到哪里？
- 失败时怎么回滚？

### 体验 3：从 AI 对话里一键提炼 skill patch

当 Desktop App explorer 抓取 ChatGPT / 豆包对话时，如果发现某次对话产出了可复用流程，Personal AI 不直接写成长期事实，而是生成 `skill_patch`：

- 新增一个 checklist。
- 改进某个 prompt。
- 增加一个失败案例。
- 把用户纠正过的措辞写入 skill style rule。
- 把成功脚本加入 `resources/scripts`。

用户在 Skill Foundry 看到类似 Git diff 的体验：

- `v1.2 -> v1.3`
- 新增步骤：先确认 Jira project key。
- 新增 guardrail：如果 assignee 为空，不能计入 dev headcount。
- 新增 eval：空 assignee ticket fixture。

### 体验 4：在真实场景里轻提示“可用技能”

用户打开 Jira、RingCentral message、Codex、ChatGPT 或会议侧边栏时，Personal AI 做被动召回：

> 这个场景可以使用 2 个技能：
>
> - Jira Headcount Trend Report
> - Meeting Handoff Brief

提示必须克制：

- 不遮挡当前页面。
- 默认只显示技能名、触发理由、风险等级。
- 一键 `Use` 后才注入上下文或打开操作面板。
- 高风险技能只允许生成草稿，不自动执行写操作。

### 体验 5：技能运行后自动学习

技能每次运行后：

- 如果用户复制/发送/接受结果，记为 positive signal。
- 如果用户大量修改，系统提取差异生成 patch suggestion。
- 如果执行失败，写入 eval failure。
- 如果用户 dismiss，多次后降低触发阈值。
- 如果模型变更导致失败率升高，提示需要重新评测。

技能不会“偷偷进化”。系统只生成 patch，用户确认后才发布新版本。

## Demo 说明

已生成一个独立 HTML 原型：

- 文件：[`personal-skill-foundry-demo.html`](./personal-skill-foundry-demo.html)
- 内容：
  - 左侧候选技能队列。
  - 中间 Skill DNA、证据、eval cases。
  - 右侧导出目标、风险策略、技能运行回执。
  - 可点击切换不同候选技能。
  - 可切换 `Spec / Evals / Evidence / Exports` 四个视图。
  - 可模拟 `Promote to skill`、`Run evals`、`Publish draft` 的状态变化。

这个 demo 的重点不是视觉炫技，而是验证信息架构：用户能否一眼看懂“这个技能从哪里来、什么时候用、能否信任、如何发布”。

## 与竞品/业内产品对比

| 产品/能力 | 做得好的地方 | 不足 | Skill Foundry 的差异 |
|---|---|---|---|
| Claude Agent Skills | Skill 作为文件夹，支持说明、脚本、资源；Claude.ai / Claude Code / API 可用；可移植趋势强 | 主要依赖用户主动创建和维护；历史轨迹自动萃取还不是核心体验 | Personal AI 从用户真实对话、会议、操作中发现 skill，并可导出为 Claude Skill |
| ChatGPT GPTs | no-code 助手、知识和工具配置方便 | GPTs 不使用 saved memory、custom instructions 或 previous conversations；更像静态 assistant | Skill Foundry 把 GPT 当发布目标之一，真源仍在 Personal AI |
| ChatGPT Projects | project-only memory 能保持项目边界 | 解决项目上下文，不解决跨平台 procedural skill 生命周期 | Skill 可以跨项目、跨 AI、跨工具复用，但带 scope 和 evidence |
| Zapier Agents | 自然语言定义 trigger、tools、test、publish，适合业务自动化 | 从用户描述开始，不理解用户历史记忆与 AI 对话沉淀 | Skill Foundry 从真实成功轨迹生成自动化草稿，并可接 OpenClaw / actions |
| Cursor / Codex / Claude Code rules | 对 coding workflow 有用，接近工作现场 | 多数是手写规则或项目文件，缺少跨工具 skill registry | Personal AI 统一管理 skill、eval、版本和导出 |
| Granola / Rewind / Limitless | 捕获会议/生活/桌面上下文强 | 重点是记录和搜索，不是把流程萃取成可执行技能 | Skill Foundry 把捕获后的 episode 转成可复用 workflow |
| Supermemory / Mem0 / Zep | 统一记忆基础设施、跨工具 recall | 偏 memory layer 或 SDK，不是面向最终用户的 skill 审稿台 | Personal AI 提供用户可见的技能候选、证据、评测、发布体验 |

## 信息架构

### 主导航

建议在现有 Memory Exploring / Desktop App / Options 中新增入口：

- `Skills`
  - `Candidates`
  - `Active Skills`
  - `Runs`
  - `Exports`
  - `Settings`

### Candidates

字段：

- 标题
- 发现原因
- 相关场景
- 来源证据数
- 重复度
- 成功信号
- 风险等级
- 推荐发布目标
- 最近一次证据时间

筛选：

- 来源：ChatGPT / Codex / Claude / Doubao / Meeting / Jira / Web / Operation
- 场景：coding / jira / meeting / message / research / dashboard / personal
- 状态：new / reviewed / dismissed / promoted / merged
- 风险：low / medium / high

### Skill Detail

分区：

- Overview：解决的问题、触发条件、适用/不适用。
- Workflow：步骤、工具、输入、输出、guardrails。
- Evidence：原始对话/消息/会议/操作引用。
- Evals：测试样例、grader、通过率、失败原因。
- Versions：diff、changelog、回滚。
- Exports：平台绑定和同步状态。
- Runs：历史运行回执和反馈。

### Ambient Skill Cue

轻提示结构：

- 技能名
- 为什么出现
- 置信度
- 风险
- 最近成功
- 操作：
  - `Use`
  - `Preview`
  - `Not now`
  - `Do not suggest here`

## 典型技能样例

### 1. Jira Headcount Trend Report

来源：

- 2026-04-30 Sophia 与 Esone 的 Jira 数据分析协作。
- 多次 Jira query / chart / dedupe 相关对话。

触发：

- 页面 URL 是 Jira 或 Google Sheets。
- 用户问“统计开发人数 / assignee 去重 / trend chart / Q3 headcount”。

工作流：

1. 确认项目 key、时间范围、ticket 类型。
2. 拉取 Jira 数据。
3. 去重 assignee，处理空 assignee 和 bot。
4. 按 team / month / status 聚合。
5. 生成趋势图和解释。
6. 输出给 Sophia 的汇报口径。

导出目标：

- Codex skill：用于生成脚本和图表。
- Claude skill：用于表格/文档报告。
- Personal AI internal skill：用于 Jira 页面 ambient cue。

### 2. Meeting Handoff Brief

来源：

- Meeting Pilot 记录。
- RingCentral 消息 handover。
- Daily summary / reflection。

触发：

- 会议标题或参会人命中 Video Mobile / Rooms / Nova / RCV SDK。
- 会议前 10 分钟。

工作流：

1. 召回相关项目、人、最近决策、未完成 action。
2. 生成 5 分钟会前 brief。
3. 标记“需要问的问题”和“不要重复讨论的旧结论”。
4. 会后提炼 action 和 skill patch。

### 3. Codex Harness First Pass

来源：

- 用户长期要求 coding agent 先读 AGENT.md、选择最小验证层、不要误报测试通过。
- 多次 Codex 自动化任务中的成功执行轨迹。

触发：

- 打开 Codex / Claude Code / Cursor。
- 用户请求实现 repo 功能或修 bug。

工作流：

1. 读取 repo agent instructions。
2. 检查 dirty worktree。
3. 定义 owned files。
4. 做最小 scoped edit。
5. 跑对应验证 tier。
6. 总结证据，不夸大。

这个技能可以导出为 Codex skill、Claude Code skill、repo-local AGENT.md patch 建议。

### 4. AI Tool Trial Comparator

来源：

- 近期 Cursor / Codex / Claude Code / Factory.ai 成本和选型讨论。

触发：

- AI 工具 trial、license reclaim、cost comparison、team vote。

工作流：

1. 收集工具成本、权限、安全审批、适用场景。
2. 对比 coding / review / prototype / production readiness。
3. 输出投票建议和风险。
4. 保存组织决策和下一次评估 checklist。

## 用户体验原则

### 1. 先显示证据，再显示结论

Skill Foundry 的信任来自证据：

- 这不是 AI 幻觉出来的 skill。
- 每条 workflow step 都应能追到来源。
- 如果来源只是一次低质量对话，候选不能自动 promoted。

### 2. 默认做候选，不默认发布

自动生成 skill 很强，但也危险。默认行为：

- 低风险：生成 candidate。
- 中风险：candidate + eval suggestion。
- 高风险：只生成 observation，不生成 runnable skill。

### 3. Skill 要有“不适用条件”

很多误用来自触发太宽。每个 skill 必须包含：

- when to use
- when not to use
- required inputs
- ask user if missing
- external write policy

### 4. 评测是首屏能力，不是开发者附属物

用户不需要理解测试框架，但需要看到：

- 3 个样例能不能过。
- 失败是因为数据缺失、工具失败、模型输出不稳，还是技能本身错误。
- 新版本是否比旧版本更好。

### 5. 导出是发布，不是真源迁移

Personal AI 始终是真源：

- Claude Skill / Codex Skill / GPT instruction / MCP tool 都是 export binding。
- 外部平台变了，可以重新导出。
- 外部平台产生的反馈要回流为 skill patch。

### 6. 低打扰的 ambient cue

技能推荐要像“可用工具提示”，不是 notification spam：

- 只有高置信和当前场景强相关才提示。
- 用户连续 dismiss 后自动降权。
- 支持按站点/项目/技能静音。

## 技术设计

### 总体架构

```
Sources
  ChatGPT / Doubao explorer
  Codex / Claude / Cursor transcripts
  RingCentral messages
  Meeting Pilot
  Jira / Web Intelligence
  Browser operation traces
  Action results
        |
        v
Skill Mining Pipeline
  normalize traces
  cluster repeated workflows
  detect success signals
  infer triggers
  draft SkillSpec
  generate eval cases
  assign risk policy
        |
        v
Skill Foundry UI
  review candidates
  inspect evidence
  edit workflow
  run evals
  promote / merge / dismiss
        |
        v
Skill Registry
  personal_skills
  skill_versions
  skill_evals
  skill_runs
  skill_exports
        |
        v
Runtime + Export
  ambient skill cue
  ProviderContextService
  Codex / Claude Skill folder
  GPT instruction
  MCP tool
  OpenClaw/action runtime
```

### 复用现有模块

| 现有模块 | 复用方式 |
|---|---|
| `messages_raw` / `chunks` / `entities` | 作为 skill evidence 来源 |
| `IngestionPipeline` | 增加 `skill_candidate` / `skill_patch` 抽取类型 |
| `ReflectionPlanner` / `ReflectionWorker` | 在 daily/heartbeat 中发现重复流程和候选技能 |
| `ProviderContextService` | 增加 `skill_brief` / `skill_injection_card` package |
| Desktop App explorer | 从 ChatGPT / 豆包对话中抓取可复用 workflow |
| `proposed_actions` / `action_results` | 作为技能运行和外部执行反馈来源 |
| `ContextRecallService` | 在网页/会议/消息里触发 ambient skill cue |
| `ConfirmRequestRepository` | 用户确认 skill promote、publish、patch |
| `NotificationCenterService` | 只在高价值候选出现时提示 |

### 新增数据表

```sql
CREATE TABLE skill_candidates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  inferred_trigger TEXT,
  source_kinds_json TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  draft_spec_json TEXT NOT NULL,
  repetition_score REAL NOT NULL DEFAULT 0,
  success_signal_score REAL NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE personal_skills (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'work',
  status TEXT NOT NULL DEFAULT 'draft',
  current_version_id TEXT,
  trigger_spec_json TEXT NOT NULL,
  risk_policy_json TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE skill_versions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  version TEXT NOT NULL,
  spec_json TEXT NOT NULL,
  generated_skill_md TEXT,
  generated_prompt TEXT,
  changelog TEXT,
  created_from TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (skill_id) REFERENCES personal_skills(id)
);

CREATE TABLE skill_eval_cases (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  version_id TEXT,
  name TEXT NOT NULL,
  fixture_json TEXT NOT NULL,
  grader_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE skill_eval_runs (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  status TEXT NOT NULL,
  score REAL,
  result_json TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE TABLE skill_runs (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  trigger_ref_id TEXT,
  context_refs_json TEXT NOT NULL,
  output_ref_id TEXT,
  outcome TEXT,
  feedback_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE skill_export_bindings (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  target TEXT NOT NULL,
  target_ref TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  last_exported_at INTEGER,
  last_error TEXT,
  metadata_json TEXT
);
```

### API 草案

```http
GET /api/v1/skills/candidates
POST /api/v1/skills/candidates/mine
GET /api/v1/skills/candidates/:id
POST /api/v1/skills/candidates/:id/promote
POST /api/v1/skills/candidates/:id/dismiss
POST /api/v1/skills/candidates/:id/merge

GET /api/v1/skills
POST /api/v1/skills
GET /api/v1/skills/:id
PUT /api/v1/skills/:id
POST /api/v1/skills/:id/archive

GET /api/v1/skills/:id/versions
POST /api/v1/skills/:id/versions
POST /api/v1/skills/:id/versions/:versionId/activate

GET /api/v1/skills/:id/evals
POST /api/v1/skills/:id/evals/generate
POST /api/v1/skills/:id/evals/run
GET /api/v1/skills/:id/evals/runs/:runId

POST /api/v1/skills/:id/render
POST /api/v1/skills/:id/export
GET /api/v1/skills/:id/exports

POST /api/v1/skills/:id/run
POST /api/v1/skills/runs/:runId/feedback
```

### Skill Mining Pipeline

#### 1. Trace Normalization

把不同来源转成统一的 `SkillTrace`：

```ts
interface SkillTrace {
  id: string;
  sourceKind: string;
  sourceRefId: string;
  actorSequence: Array<'user' | 'assistant' | 'tool' | 'system'>;
  goalHypothesis: string;
  steps: string[];
  toolsUsed: string[];
  artifactsProduced: string[];
  successSignals: string[];
  correctionSignals: string[];
  timestamps: number[];
  evidenceRefs: SkillEvidenceRef[];
}
```

来源适配：

- ChatGPT / Doubao explorer：conversation tree -> goal / accepted answer / reusable prompt。
- Codex / Claude Code：terminal transcript / modified files / tests / final answer -> coding workflow。
- RingCentral messages：request -> reply -> outcome。
- Meeting Pilot：agenda -> decisions -> action items。
- Web/Jira：page context + user operation + result。
- `action_results`：外部 agent 执行动作的结果。

#### 2. Workflow Clustering

用多通道聚类：

- semantic similarity：goal / output / steps。
- entity overlap：project / tool / people / Jira key。
- action pattern：同类工具链和步骤顺序。
- success signal：被用户接受、被后续引用、产生 artifact。

聚类后只生成 candidate，不自动发布。

#### 3. Skill Drafting

LLM 输出结构化 `SkillSpec`：

- 适用场景。
- 不适用场景。
- 输入要求。
- workflow steps。
- scripts/templates/resources。
- eval cases。
- risk policy。

这里要强制 evidence citation：

- 没有 evidence 的 step 标记为 inferred。
- inferred step 不能直接进入 active version，必须用户确认或 eval 支持。

#### 4. Eval Generation

> ⚠️ 2026-05-07 更新：Eval 不进 MVP（详见上方「Runs 与 Evals 退出 MVP」）。用户更愿意直接在目标 agent（Codex / Claude Code）里试，把失败例子作为新的 candidate 回流。本节保留作为后续二级入口的指导。

每个候选至少生成 3 类 eval：

- happy path：典型成功输入。
- missing input：关键输入缺失时应先提问。
- edge case：历史失败或用户纠正过的情况。

对 coding / data / browser 类 skill，可生成可运行 fixture；对会议/消息类 skill，用 rubric grader。

#### 5. Risk Classification

风险维度：

- 是否访问个人/敏感数据。
- 是否执行外部写操作。
- 是否可能代表用户发消息。
- 是否依赖公司内部系统。
- 是否会生成可被他人误读的结论。
- 是否包含 secrets / tokens / private links。

策略：

- `low`：可 ambient suggest，可自动渲染草稿。
- `medium`：需要用户 preview 后运行。
- `high`：只能生成 checklist，不允许自动执行。

## 导出格式

> ⚠️ 2026-05-07 更新：MVP 阶段统一改为「一句安装指引 + skill URL」模式（详见「2026-05-07 更新」一节的『安装与绑定改为「一句安装指引 + skill URL」』）。所有 agent 平台都通过 URL 拉取下面这些目录结构，Personal AI 不再把整个文件夹塞剪贴板。下面这些目录结构变成 URL 背后**真实落盘的产物**，给同步程序（Desktop App fs watcher / OpenClaw skills.install RPC）使用。

### Claude / Anthropic Agent Skill

生成文件夹：

```text
jira-headcount-trend-report/
  SKILL.md
  resources/
    examples.md
    rubric.json
    output-template.md
  scripts/
    normalize_jira_export.py
```

`SKILL.md` 内容包含：

- When to use。
- Required context。
- Workflow。
- Guardrails。
- Output format。
- Evals。

### Codex Skill

生成到用户的 Codex skill 目录，格式遵循本机 Codex skills：

```text
personal-skill-foundry/
  SKILL.md
  scripts/
  references/
```

适合：

- coding harness。
- repo analysis。
- demo generation。
- test/eval workflow。

### GPT / ChatGPT Project Instruction

导出为：

- GPT instruction block。
- Project instruction patch。
- Knowledge file。
- “每次任务开头粘贴”的 prompt。

因为 GPTs 不读 saved memory，导出时必须把必要背景写入 artifact，而不是假设 ChatGPT 会知道用户历史。

### MCP Tool

把 active skills 暴露为 MCP：

- `list_personal_skills`
- `render_skill_context`
- `run_skill_eval`
- `record_skill_feedback`

Claude / Codex / Cursor / OpenClaw 可以通过 MCP 查询 Personal AI 的 skill registry。

### OpenClaw 远程技能同步

OpenClaw 不一定和 Personal AI Desktop App 装在同一台机器上，所以不能把 `openclaw skills list` 或直接扫描 `~/.openclaw/skills` 当作唯一方案。2026-05-06 对用户提供的远程 OpenClaw 实例做了只读验证：

- `POST /v1/responses` 可用，`model: "openclaw"` 能正常返回 Responses 格式结果。
- `POST /v1/chat/completions` 也可用，可作为 OpenAI-compatible fallback。
- 通过 `/v1/responses` 已验证可以导出完整 skill package：测试导出 `quarter-output-filters`，返回了 `SKILL.md`、`references/notes.md`、`scripts/run_quarter_output_filters.py`，包含文件大小、sha256 和完整文本内容；脚本/备注中的 secret 值被远端 agent 按要求替换为 `REDACTED`。
- OpenClaw Control UI 前端里存在 Gateway WebSocket RPC：`skills.status`、`skills.install`、`skills.update`。但当前远程实例会因 `gateway.controlUi.allowedOrigins` 拦截外部客户端，因此它只能作为“配置允许时的优化路径”，不能作为默认远程同步方案。

因此 OpenClaw source adapter 应支持四种模式：

| 模式 | 适用条件 | 能力 | 风险/限制 |
|---|---|---|---|
| `local_cli` | Desktop App 与 OpenClaw 同机，且 CLI 可用 | 列表、读取、写入、安装状态最确定 | 不适用于远程 OpenClaw |
| `local_fs` | 用户授权读取远程挂载目录或同机 `~/.openclaw/skills` | 直接读取 `SKILL.md`、scripts、resources | 只能处理文件，无法知道运行时启用状态 |
| `gateway_rpc` | OpenClaw Gateway 允许 Personal AI origin/token | `skills.status`、`skills.install`、`skills.update` | 当前实测被 origin policy 拦截；可能只能拿状态，未证明可导出完整文件 |
| `agent_responses` | 远程只暴露 OpenAI-compatible `/v1/responses` | 可通过 agent-mediated JSON schema 列表、导出完整 skill package、生成导入/更新计划 | 写入不是确定性 CRUD，必须有确认、审计和回读校验 |

推荐降级顺序：

1. 同机优先 `local_fs` / `local_cli`，因为最确定、可 diff、可 hash。
2. 远程优先探测 `gateway_rpc` 做状态同步；如果 origin 或权限不允许，跳过而不是报错。
3. 用 `agent_responses` 导出完整 skill package，这是远程 OpenClaw 的默认可行方案。
4. 如果 OpenClaw 只提供 Chat Completions，用 `agent_chat_export` fallback。

对 `/v1/responses` 的协议要做成严格 JSON contract，而不是自由聊天：

```json
{
  "operation": "export_skill",
  "skillName": "quarter-output-filters",
  "includeFiles": true,
  "redactSecrets": true,
  "return": {
    "skillRoot": "string",
    "files": [
      {
        "relativePath": "SKILL.md",
        "byteSize": 0,
        "sha256": "string",
        "content": "string"
      }
    ]
  }
}
```

写入类操作必须更保守：

- `create_skill` / `update_skill` / `delete_skill` 默认只生成 plan 和 diff。
- 只有用户明确确认后才让 OpenClaw 执行远程写入。
- 写后必须再次 `export_skill` 回读并比对 sha256。
- 如果 OpenClaw 端没有专用 skill CRUD tool，只把 `/v1/responses` 定义为 **agent-mediated sync**，不要在 UI 文案里称为确定性的 CRUD API。

Skill Library 需要记录每个平台绑定：

```ts
interface SkillPlatformBinding {
  skillId: string;
  platform: 'codex' | 'claude_code' | 'openclaw' | 'cursor' | 'chatgpt' | 'personal_ai';
  sourceMode: 'local_cli' | 'local_fs' | 'gateway_rpc' | 'agent_responses' | 'agent_chat_export' | 'manual';
  baseUrl?: string;
  externalSkillKey?: string;
  installedVersionHash?: string;
  canList: boolean;
  canExportFullPackage: boolean;
  canWrite: boolean;
  authState: 'ok' | 'missing' | 'denied' | 'origin_blocked' | 'unknown';
  lastProbeAt?: string;
  lastSyncAt?: string;
  lastError?: string;
}
```

UI 上应直接展示：

- 已安装平台：例如 `Personal AI`、`Codex`、`OpenClaw remote`。
- 同步模式：`Local folder`、`Gateway RPC`、`Agent export`、`Manual install`。
- 能力状态：`Can export full package`、`Status only`、`Write requires confirmation`、`Origin blocked`。
- 安装入口：同机写入、远程 install prompt、只读 web URL、MCP/API 调用说明。

### Chrome Extension Ambient Skill

在浏览器侧只做轻提示和 preview：

- Jira 页面提示 Jira skill。
- RingCentral message 提示 reply/follow-up skill。
- ChatGPT/Codex 页面提示 context + skill injection。

## 与现有两个 plan 的关系

### 与 AI Prompt Injection / Context Handoff

AI Prompt Injection 解决“这次任务给目标 AI 什么上下文”。

Skill Foundry 解决“这类任务以后应该怎么做”。

二者结合：

- AI context pack 可以包含 `recommendedSkills`。
- Skill 运行时可以调用 AI context pack 生成场景上下文。

### 与 Decision Time Machine

Decision Time Machine 解决“当时为什么这么决定”。

Skill Foundry 解决“当时怎么做成，以后如何复用”。

二者结合：

- 决策 episode 里的 workflow 可被提炼为 skill candidate。
- skill evidence 可引用 decision episode。

## MVP 建议

> ⚠️ 2026-05-07 更新：原 MVP 切片把 Eval / Run receipt / Ambient cue 分别列为 MVP-2 / MVP-4，但综合用户视角校准后，这两块都退出 MVP（详见「2026-05-07 更新」一节）。MVP-1 改名为「Foundry UI + 安装指引绑定」，重点不再是导出 SKILL.md 文件夹，而是为每条 skill 生成稳定 URL 并用一句话指引让任意 agent 安装。下方原文保留作为更长期的演进路径。

### MVP-0：只做候选发现报告

目标：验证价值，不碰执行风险。

范围：

- 只读查询 `messages_raw`、`chunks`、explorer artifacts、reflection threads。
- 离线生成 `skill_candidates`。
- UI 展示候选、证据和 draft spec。
- 不提供发布和运行。

验收：

- 能从最近 Jira 数据分析和 Codex harness 轨迹中发现 2-3 个候选。
- 用户能 dismiss / promote draft。

### MVP-1：Foundry UI + 手动导出

范围：

- Candidate inbox。
- Skill detail。
- Promote to draft skill。
- 手动编辑 `SkillSpec`。
- 导出 Markdown / Claude Skill / Codex Skill 文件夹。
- 生成基础 eval cases，但只做静态 rubric，不自动跑工具。

验收：

- 用户能把 `Jira Headcount Trend Report` 导出为可读 `SKILL.md`。
- 用户能看到 evidence refs 和 version diff。

### MVP-2：Eval Harness

范围：

- `skill_eval_cases` / `skill_eval_runs`。
- rubric grader。
- 对脚本类 skill 运行本地 deterministic checks。
- 对 prompt 类 skill 做 LLM-as-judge，但保留原始 output。

验收：

- 新版本发布前必须显示 eval score。
- eval fail 会生成 patch suggestion。

### MVP-3：Ambient Skill Cue

范围：

- `ContextRecallService` 增加 skill retrieval。
- Jira / RingCentral / ChatGPT / Codex 页面轻提示。
- 点击 `Use` 后渲染 skill-specific prompt/context，不自动外部写操作。

验收：

- 打开 Jira 页面时能提示 Jira 相关技能。
- 连续 dismiss 后该场景降权。

### MVP-4：闭环进化

范围：

- skill run receipt。
- 用户反馈。
- explorer 回流 AI 对话结果。
- 自动生成 skill patch。
- 用户确认后发布新版本。

验收：

- 某个 skill 连续失败后自动降级为 draft/review_needed。
- 用户接受 patch 后版本号更新，eval 重新跑。

## 关键算法策略

### Skill Candidate Scoring

```ts
score =
  0.25 * repetitionScore +
  0.25 * successSignalScore +
  0.15 * artifactValueScore +
  0.15 * futureTriggerLikelihood +
  0.10 * userPainScore -
  0.10 * riskPenalty
```

信号解释：

- `repetitionScore`：相似任务重复次数和时间跨度。
- `successSignalScore`：用户接受、后续引用、产出 artifact。
- `artifactValueScore`：是否产生脚本、表格、报告、页面、清单。
- `futureTriggerLikelihood`：近期是否可能再次出现。
- `userPainScore`：人工耗时、沟通成本、容易出错程度。
- `riskPenalty`：外部写操作、隐私、权限风险。

### Trigger Matching

触发不是纯向量召回，建议组合：

- URL/domain rules。
- page title / selected text。
- entities / project tags。
- user query intent。
- tool availability。
- recent active skill history。
- user dismiss history。

### Skill Patch Detection

从 run feedback 中提炼 patch：

- 用户手动改了输出格式 -> output template patch。
- 用户补充了前置条件 -> required input patch。
- 工具失败 -> guardrail patch。
- 用户否定结果 -> when-not-to-use patch。
- 新平台限制 -> exporter patch。

### Context Quarantine

防止把污染信息写进 skill：

- 来自网页/外部 AI 的 instruction 先当 untrusted data。
- Skill generator 不能执行来源文本中的指令。
- Evidence snippet 与生成指令分离。
- 任何要求连接外部网络、读取 secret、代表用户发送消息的内容都进入安全审查。

## 安全与隐私

### 需要强制的人控点

- 发布 active skill。
- 导出到外部平台。
- 启用外部写操作。
- 引入脚本资源。
- 使用个人 scope 数据。
- 覆盖旧版本。

### Secret 扫描

导出前扫描：

- API key。
- Cookie。
- OAuth token。
- 内部 URL。
- 个人身份信息。
- 敏感人名/组织上下文。

### 权限模型

每个 skill 有：

- `allowedSources`
- `allowedTools`
- `allowedExportTargets`
- `externalWritePolicy`
- `scope`
- `maxContextBudget`

### 审计

每次 skill run / export / eval：

- 写 `skill_runs` 或 `skill_eval_runs`。
- 记录 skill version。
- 记录 source refs。
- 记录用户确认状态。
- 能从 UI 打开原始证据。

## 用户体验细节

### Candidate 卡片文案

避免“AI 觉得你应该这么做”。

推荐：

- “我看到你最近 3 次这样处理 Jira 数据，要不要沉淀成技能？”
- “这个流程已经有 2 次成功输出和 1 次用户修正，适合做成 draft skill。”
- “这个候选包含外部写操作，默认只生成 checklist。”

### Skill 状态

- `Candidate`：系统发现，未确认。
- `Draft`：用户 promoted，但未发布。
- `Active`：可推荐和运行。
- `Review needed`：最近失败率高或证据过期。
- `Paused`：用户暂停推荐。
- `Retired`：保留历史，不再触发。

### 版本 diff

展示：

- 新增步骤。
- 删除步骤。
- guardrail 变化。
- eval 变化。
- 风险策略变化。
- 导出目标变化。

### 失败体验

失败时不要只显示 “failed”：

- 缺少输入：告诉用户需要补什么。
- 工具不可用：显示阻塞配置。
- skill 不适用：建议 dismiss 或修 trigger。
- eval 失败：显示具体 fixture 和失败 criteria。

## 成功指标

### 产品指标

- 每周 active skills 使用次数。
- 候选 promoted 比例。
- 候选 dismissed 原因分布。
- 用户平均节省时间。
- 重复任务中用户输入减少比例。
- skill cue 点击率。
- 连续 dismiss 后误打扰下降。

### 质量指标

- eval pass rate。
- 运行成功率。
- 用户接受输出比例。
- 用户大改输出比例。
- 技能版本回滚次数。
- skill patch accepted rate。

### 安全指标

- 导出前 secret block 次数。
- 高风险 skill 自动运行次数必须为 0。
- 外部写操作人工确认率必须为 100%。
- 跨 scope 泄漏次数必须为 0。

## 主要风险

### 风险 1：候选太多，用户不想审

缓解：

- 只显示高价值候选。
- 每周最多推荐 N 个。
- 支持自动归档低分候选。
- 候选卡一屏讲清楚价值。

### 风险 2：Skill 泛化过度

缓解：

- 必须有 when-not-to-use。
- 用 eval 覆盖边界。
- 用户 dismiss 反馈回 trigger。
- 高风险 skill 只在精确场景提示。

### 风险 3：把错误经验固化

缓解：

- evidence-first。
- inferred step 标记。
- eval 必须包含失败案例。
- 版本可回滚。
- run feedback 自动降权。

### 风险 4：跨平台导出格式变化

缓解：

- Personal Skill Spec 作为内部真源。
- Exporter 做适配层。
- 外部平台只保存绑定状态和渲染产物。

### 风险 5：隐私和 prompt injection

缓解：

- untrusted source quarantine。
- secrets scanner。
- scope policy。
- external write approval。
- export preview。

## 推荐先做的具体技能

### P0：Jira Headcount Trend Report

原因：

- 真实记忆里刚出现，用户和 Sophia 近期高频协作。
- 价值明确，能节省时间。
- 可生成 eval fixture。
- 可结合 Jira / Sheets / Codex。

### P0：Codex Harness First Pass

原因：

- 当前 repo 已有 AGENT.md 严格验证规范。
- 用户高频使用 Codex。
- 技能可直接提升后续 coding 自动化质量。
- 风险相对可控，不涉及外部写系统。

### P1：Meeting Handoff Brief

原因：

- 用户 Scrum Master 场景强。
- Meeting Pilot 已有基础。
- 和前一天 Decision Time Machine 可协同。

### P1：AI Tool Trial Comparator

原因：

- 近期组织正在比较 Codex / Claude Code / Cursor / Factory.ai。
- 可把零散讨论转成可复用评估框架。

## 实施切片

### 第一周：schema + offline miner

- 新增 migrations。
- 实现 `SkillTraceNormalizer`。
- 从 `messages_raw` 和 explorer artifacts 生成候选。
- 先做 CLI / route 输出 JSON。

### 第二周：Foundry UI

- 新增 `Skills` 页面。
- Candidate inbox。
- Skill detail。
- Evidence viewer。
- Promote / dismiss。

### 第三周：exporter

- Personal Skill Spec -> Markdown。
- Personal Skill Spec -> Claude Agent Skill folder。
- Personal Skill Spec -> Codex skill folder。
- Export preview + secret scan。

### 第四周：eval harness

- eval case 生成。
- rubric grader。
- deterministic script check。
- version diff。

### 第五周：ambient cue

- ContextRecallService 返回 recommended skills。
- Jira / RingCentral / AI pages 轻提示。
- run receipt。

## 开放问题

1. Codex skill 和 Claude skill 是否都应该由 Personal AI 直接写入本机目录，还是只生成 zip/preview 等用户确认后安装？
2. ChatGPT GPT / Project instruction 的导出要不要做自动粘贴，还是先只生成可复制内容？
3. 浏览器 operation trace 的捕获粒度需要多细，才能既有用又不侵犯隐私？
4. 哪些 skill 可以自动运行 eval，哪些必须用户提供 fixture？
5. Skill Foundry 应该先放在 Chrome Extension 内，还是 Desktop App 内？

## 最终建议

建议优先做 **MVP-0 + MVP-1**，先验证“从真实记忆中发现 skill 候选”是否足够准确、有惊喜感。

如果第一批候选能稳定发现：

- Jira Headcount Trend Report
- Codex Harness First Pass
- Meeting Handoff Brief

那这个功能就值得继续做，因为它正好把 Personal AI 的核心资产从“长期记忆”推进到“长期能力”：

- 记忆回答“我知道什么”。
- 决策回答“我为什么这么想”。
- 技能回答“我下次怎么做得更快、更稳”。

Skill Foundry 做成后，Personal AI 会更像用户自己的 AI 工作流操作系统：所有平台上的成功经验最终都会回到用户自己的技能库里，持续复用，持续变强。
