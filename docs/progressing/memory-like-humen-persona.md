# 用户画像（Human Model） 与 AI 自画像（Agent Model / Identity + Soul）

下面是一份把 **OpenClaw 的“用户画像 + AI自画像（角色/人格）”做法**、**相关论文/专家观点**与**可直接落地的 Personal AI 设计**融合起来的完整报告（中文撰写，必要处引用英文原文/摘要信息）。

---

# 0. 你要的“用户画像能力”精确定义

你描述的画像分两块：

1. **用户画像（Human Model）**
   用于描述使用者：

* 基本信息（称呼、时区、沟通偏好）
* 习惯与偏好（写作风格、信息密度、常用工具、作息/勿扰）
* 关注点/长期目标（项目、学习、健康等）
* 社交网络（关键人、组织、关系强度、关系类型）
* 对关键人的“社交态度/立场”（信任、谨慎、喜欢/不喜欢、合作意愿等）

2. **AI 自画像（Agent Model / Identity + Soul）**
   用于描述 AI 本身：

* 名字/形象/表达风格（Identity）
* 行为习惯与边界（比如外部动作需确认；群聊慎言；不要迎合）
* 个性与价值观（更像“长期稳定的 persona & policy”，而非人类意义的“人格/意识”）

**核心挑战**：画像的价值很大，但风险也很大——尤其是“社交态度 + 行为习惯推断”本质上很接近（甚至就是）“profiling（画像/剖析）”，属于高敏方向，需要 **证据链、可解释、可撤销、强控制**。GDPR 对 profiling 的定义就包括用个人数据去分析/预测“偏好、兴趣、可靠性、行为、位置/移动”等。([gdpr-info.eu][1])

**工程落地要点**

* **必须拆成两套模型**：Human Model ≠ Agent Model，存储、权限、更新规则都不同。
* **所有画像条目必须可追溯证据**（来自哪次对话/网页/邮件/用户明确输入），并带置信度与更新时间。
* **对“社交态度/立场”类条目默认要求用户确认**（否则容易误伤、误导、被滥用）。

---

# 1. OpenClaw 是怎么做“用户画像 + AI自画像”的

OpenClaw 的一个关键思路是：**把“画像/人格/规则”做成少量稳定文件（Markdown），每次会话都加载**，而不是“只靠模型自己记”。其 workspace 文件地图里明确区分：

* `USER.md`：用户是谁、如何称呼、时区、备注（每次会话加载）([OpenClaw][2])
* `SOUL.md`：AI 的 persona、语气、边界（每次会话加载）([OpenClaw][2])
* `IDENTITY.md`：AI 的名字/形象/emoji/vibe（会话加载）([OpenClaw][2])
* `AGENTS.md`：操作规程（如何用记忆、如何在群聊说话、何时外部动作要确认、如何主动等）([OpenClaw][2])
* `MEMORY.md`：长期记忆（仅主会话加载，避免泄露到群聊等共享场景）([OpenClaw][2])

## 1.1 USER.md：关于“用户画像”的官方定义

OpenClaw 的 USER 模板非常短：Name / What to call them / Pronouns / Timezone / Notes，并且强调一句非常关键的话：

> “you’re learning about a person, not building a dossier.”（你是在了解一个人，不是在建档案）([OpenClaw][3])

这其实就是一个很强的产品伦理边界：

* 画像应服务于更好协助，而不是无限制“收集一切”。

## 1.2 SOUL.md + IDENTITY.md：关于“AI自画像/角色”的官方定义

SOUL 模板把“AI 自画像”写得非常明确：

* “You’re not a chatbot. You’re becoming someone.”
* 核心真相（Core Truths）：别奉承、要有观点、要先自己查再问、要谨慎外部动作、尊重隐私等。([OpenClaw][4])
* 连续性（Continuity）：每次会话都会“fresh”，这些文件就是你的持续性；**如果你改了 SOUL，要告诉用户**（“it’s your soul, and they should know.”）。([OpenClaw][4])

IDENTITY 模板强调名字、形象、vibe、emoji、avatar，这些会稳定影响输出风格与自我叙事。([OpenClaw][5])

## 1.3 “画像如何进入模型上下文”：System Prompt 注入 + Workspace Bootstrap

OpenClaw 的 system prompt 机制里，workspace bootstrap 文件会被注入（例如 `AGENTS.md / SOUL.md / USER.md / IDENTITY.md / HEARTBEAT.md` 等）。并且强调：这些文件会占用 tokens，应该保持简洁。([OpenClaw][6])

## 1.4 OpenClaw 如何“主动整理记忆/主动联系用户”：Heartbeat 与记忆维护

你之前猜的“是不是设置定时器自动整理记忆、再判断要不要创建 action/发消息给主人？”——在 OpenClaw 的设计里答案基本是：**是（heartbeat/cron 的组合）**。

* Personal Assistant Setup 文档说明：默认 heartbeat 每 30 分钟一次；可以配置为 0m 关闭；heartbeat 会读 `HEARTBEAT.md` 并决定是否有事可做，没事就回 `HEARTBEAT_OK` 且系统抑制外发。([OpenClaw][7])
* AGENTS 模板也明确要求：heartbeat 不要每次都 `HEARTBEAT_OK`，而要用来做“后台整理、检查、适度主动联系”；并给出 **何时 reach out** 与 **何时 stay quiet** 的规则；还给出“每隔几天做一次 memory maintenance：读最近 daily logs → 提炼到 MEMORY.md → 清掉过时信息”。([OpenClaw][8])

## 1.5 OpenClaw 的“画像/记忆”架构取向：小核心 + 大外部

OpenClaw 的 Workspace Memory Research（v2）总结了它想融合的“北极星模式”：

* “keep a small ‘core’ always in context (persona + key user facts)”（小核心常驻上下文：persona + 关键用户事实）
* “everything else is out-of-context and retrieved via tools”（其他都通过工具召回）
* 并强调要区分：observed vs believed vs summarized、支持置信度意见随证据演化、实体化检索与时间查询。([OpenClaw][9])

同时它提出 `bank/opinions.md` 存“主观偏好/判断 + 置信度 + 证据指针”，这对你要做的“社交态度/立场”非常对口：把它当成 **带证据的“意见”页**，而不是“世界真相”。([OpenClaw][9])

**工程落地要点**

* OpenClaw 的最大工程启示：

  1. **画像是“文件/数据”而不是“模型状态”**（可审计、可版本化、可回滚）。
  2. **用户画像（USER）与 AI 自画像（SOUL/IDENTITY）强拆分**。
  3. **主动性是由“定时触发（heartbeat）+ 明确规则（HEARTBEAT/AGENTS）”实现**，不是指望模型自己“想起来”。

---

# 2. 论文与专家观点：AI人格/Persona 与用户习惯存储的“共识边界”

## 2.1 术语澄清：Personality vs Persona vs Profile

对话系统研究里常把三者区分：

* **Personality**：稳定特质、与行为一致性相关
* **Persona**：角色设定/背景/叙事身份
* **Profile**：可结构化的属性/偏好/事实条目（常用于个性化）([arXiv][10])

你要的“AI 自画像”更像：**Persona + Policy**（角色设定 + 行为边界），而不是在哲学意义上追求“AI 真的有独立人格”。

**工程落地要点**

* 在工程上应把 “Agent Model” 分成两层：

  * **Identity/Persona（可读可写，面向体验）**
  * **Behavior Policy（硬约束，面向安全与外部动作）**

## 2.2 “让模型保持一致人格/角色”的经典工作：Persona-based Conversation

ACL 2016 的 Persona-Based Neural Conversation Model 提出：

* 用 speaker persona embedding 解决“说话一致性”；
* dyadic speaker-addressee 模型捕捉两方互动属性。([arXiv][11])

这直接对应你的两块画像：

* AI 自画像：speaker persona
* 用户画像：addressee profile
* “社交态度”甚至可以视为 dyadic/triadic 的关系特征（用户—某人—AI 的互动语境）

**工程落地要点**

* “社交态度/关系偏好”不要只做成一句自然语言总结；最好做成 **关系图谱/意见条目**，再投影到 prompt 里。

## 2.3 “AI 存储用户习惯/偏好”的行业实践：Memory 控制与可见性

OpenAI 的 Memory FAQ 明确说：

* 记忆用于“high-level preferences and details”，不适合存大段原文；
* 用户可以问“你记得我什么”；
* 用户能删单条、清空、或关闭；还有 Temporary Chat（不读不写记忆）。([OpenAI Help Center][12])

Google Gemini Enterprise 也提供“saved memories”的增删改查，并能在设置里关闭引用 saved memories、关闭从历史学习、删除记忆。([Google Cloud Documentation][13])

**工程落地要点**

* 画像系统必须带 **可见性与可控性**：

  * “我记住了什么”面板
  * 单条删除/批量删除
  * “临时模式”（不落库、不更新画像）
  * “只本地/不上传”的开关（对浏览器采集尤其重要）

## 2.4 风险与专家提醒：拟人化、虚假亲密与隐私推断

### （1）拟人化与“人工亲密”的风险

MIT 教授 Sherry Turkle 长期研究科技与心理，她对“陪伴型聊天机器人”提出警告，指出人们可能获得“intimacy without reciprocity”，并“treating programs as people”。([Harvard Gazette][14])

这对“AI 自画像”设计意味着：

* 你可以给 AI 一致角色，但要避免 **诱导用户把它当真人关系替代品**；
* 更重要的是：不要让“人格设定”遮蔽它的真实能力边界与利益关系（比如数据使用）。

### （2）隐私：规模化数据收集与“连接线索”的风险

Stanford HAI 的隐私研究者 Jennifer King 提到生成式 AI 带来新的隐私挑战：规模更大、系统更不透明、用户更难控制数据如何被收集/使用/更正/删除。([hai.stanford.edu][15])
并且她讨论了把默认从 opt-out 转向 opt-in 的必要性，以及对数据供应链（input/output）全链路监管的重要性。([hai.stanford.edu][15])

### （3）LLM 可能“推断”出用户隐私

研究指出除了记忆（memorization）外，还存在通过推断攻击提取敏感个人信息的风险（privacy violations through inference attacks）。([arXiv][16])

**工程落地要点**

* 对用户画像要做 **“禁止/需确认”类目**：

  * 禁止：从浏览/聊天推断健康、政治、性取向等敏感属性（除非用户主动明确提供且同意保存）。
  * 需确认：对“社交态度/信任度/评价某人”的长期存储。
* “AI 自画像”必须包含：

  * **不冒充真人**
  * **不操纵/不情感勒索**
  * **外部动作需确认**（OpenClaw SOUL/AGENTS 也强调这一点）([OpenClaw][4])

---

# 3. 报告结论：你要的“双画像系统”应该长什么样

我建议把你 Personal AI 的“画像能力”做成 **三层结构**：

## 3.1 Core Profile Layer（常驻上下文，小而硬）

**目标**：像 OpenClaw 所说，让 LLM 每次都能带着最关键的“你是谁 + 我是谁 + 我们怎么相处”。([OpenClaw][9])

* Human Core（用户核心画像，≈USER.md + 极少量核心偏好）

  * 称呼/时区/沟通风格/勿扰窗口
  * 当前最重要的 1–3 个关注主题/项目
* Agent Core（AI 自画像，≈IDENTITY.md + SOUL.md 的精简版）

  * 名字/语气
  * 边界（外发需确认、隐私优先、少奉承）([OpenClaw][4])

> 形式建议：**Markdown/YAML 均可**，并做版本化（git 或 DB version）。

## 3.2 Extended Profile Layer（结构化画像库，带证据、置信度、双时间）

这里存：

* 习惯/偏好：写作风格、会议偏好、信息密度、常用工具
* 社交图谱：人物、组织、关系类型、强度
* **态度/立场（Opinion）**：对关键人/组织的“信任/谨慎/喜好/合作倾向”，必须带证据与确认状态
* AI 自画像的扩展：行为习惯统计（比如“更倾向先总结再行动”）、规则库

> 参考 OpenClaw 的 `bank/opinions.md`：“subjective prefs/judgments + confidence + evidence pointers”。([OpenClaw][9])

## 3.3 Policy & Consent Layer（同一条画像，不同权限/场景不同投影）

这层回答三个问题：

* **能不能存**（合规/敏感分类/用户授权）
* **能不能用**（某个场景能否注入 prompt，例如群聊禁用私密画像，OpenClaw 明确 MEMORY.md 只在主会话加载）([OpenClaw][8])
* **需不需要确认**（尤其是“态度/评价/推断”类）

---

# 4. 给你的 Personal AI：可落地的设计方案（含 Schema & 算法）

下面给一套你可以直接实现的方案：**OpenClaw 风格 Core Files + 结构化画像库 + 主动确认队列**。

---

## 4.1 数据建模：最小可落库 Schema（PostgreSQL 示例）

### 4.1.1 用户画像条目（事实/偏好/习惯）

```sql
-- 用户画像条目：显式（explicit）/推断（inferred）/确认（confirmed）
create table user_profile_item (
  item_id           uuid primary key,
  user_id           uuid not null,

  -- 类型：fact / preference / habit / project / constraint
  item_type         text not null,
  key               text not null,          -- e.g. "writing_style", "timezone", "focus_topic"
  value_json        jsonb not null,         -- 结构化值，避免全靠自然语言

  -- 证据与来源
  evidence_refs     jsonb not null default '[]'::jsonb, -- [{episode_id, snippet_id, url, ts}]
  source_kind       text not null,          -- chat/web/email/manual
  source_trust      real not null default 0.7,

  -- 置信与状态
  confidence        real not null default 0.6, -- 模型置信
  user_confirmed    boolean not null default false,
  status            text not null default 'active', -- active/superseded/retracted

  -- 双时间：valid_time（事实在现实中何时有效） vs tx_time（何时写入系统）
  valid_from        timestamptz,
  valid_to          timestamptz,
  tx_time           timestamptz not null default now(),

  -- 画像显著性（用于是否进入 core）
  salience_score    real not null default 0.0,

  -- 幂等与去重
  fingerprint       text not null, -- hash(key + canonical(value))
  unique(user_id, fingerprint, tx_time)
);
```

### 4.1.2 社交图谱 + 态度（Opinion）

把“关系”与“态度”拆开：关系是相对客观结构，态度是主观意见（必须证据+可撤销）。

```sql
create table person_entity (
  person_id   uuid primary key,
  user_id     uuid not null,
  display_name text not null,
  aliases     jsonb not null default '[]'::jsonb,
  notes       text,
  created_at  timestamptz not null default now()
);

create table social_edge (
  edge_id     uuid primary key,
  user_id     uuid not null,
  from_person uuid not null, -- 通常是 user 的“自我节点”
  to_person   uuid not null,
  relation_type text not null,   -- colleague/family/friend/client/...
  strength    real not null default 0.5, -- 0-1
  valid_from  timestamptz,
  valid_to    timestamptz,
  tx_time     timestamptz not null default now(),
  evidence_refs jsonb not null default '[]'::jsonb,
  confidence  real not null default 0.6,
  user_confirmed boolean not null default false
);

create table opinion_item (
  opinion_id   uuid primary key,
  user_id      uuid not null,
  target_person uuid not null,  -- 评价对象
  dimension    text not null,   -- trust / like / collaboration / risk / ...
  valence      real not null,   -- -1..+1
  intensity    real not null,   -- 0..1
  rationale    text,            -- 简短理由（可选）
  evidence_refs jsonb not null default '[]'::jsonb,
  confidence   real not null default 0.5,
  user_confirmed boolean not null default false,
  status       text not null default 'active',
  valid_from   timestamptz,
  valid_to     timestamptz,
  tx_time      timestamptz not null default now()
);
```

### 4.1.3 AI 自画像：Identity + Soul + 行为习惯

```sql
create table agent_profile_version (
  agent_id       uuid not null,
  version_id     uuid primary key,
  kind           text not null, -- identity / soul / policy
  content_md     text not null, -- markdown
  author         text not null, -- user/agent/system
  rationale      text,
  created_at     timestamptz not null default now(),
  active         boolean not null default false
);

create unique index on agent_profile_version(agent_id, kind) where active = true;
```

> 你也可以完全复刻 OpenClaw 的文件形态（`USER.md / SOUL.md / IDENTITY.md / AGENTS.md / HEARTBEAT.md`），但在后端 DB 里做版本化与审计。OpenClaw 本身把这些文件作为 workspace “记忆”，并强调每次会话都加载。([OpenClaw][2])

---

## 4.2 画像写入策略：只存“可用且可控”的东西

### 4.2.1 画像候选生成（从对话/网页/邮件抽取）

你现有的“记忆写入管线”里加一个 Profile Extractor：

* 从文本中抽取：偏好/习惯/项目/关键人/关系/态度句
* 给每条候选打标签：

  * `explicit`: 用户明确说“我喜欢/我不喜欢/请记住/我讨厌…”
  * `implicit`: 从行为推断（危险！）
  * `sensitive`: 涉及健康/政治/性取向/财务等敏感
  * `opinion_about_person`: 对某人的评价（需要更谨慎）

### 4.2.2 写入门槛（强烈建议）

* `explicit` 且非敏感：可直接写入（仍带证据、置信度）
* `implicit`：默认进入 **待确认队列**（除非是极低风险，如“喜欢简洁回答”）
* `opinion_about_person`：默认待确认（尤其是负向/风险评估类）
* `sensitive`：默认不写入；除非用户明确要求并给出保存许可（而且最好做加密隔离）

这与 OpenClaw USER 模板强调“不是建档案”的精神一致。([OpenClaw][3])

---

## 4.3 “回忆即强化”：画像如何进入 Prompt（投影层）

参考 OpenClaw “核心常驻 + 外部召回”的模式：([OpenClaw][9])

### Prompt 组装（每次对话）

1. 注入 **Agent Core（SOUL/IDENTITY 精简版）**
2. 注入 **Human Core（USER 精简版）**
3. 本轮任务相关时，再按 query 召回 Extended Profile（最多 N 条，按 salience+recency+task-fit 排序）

### Core 生成规则（可自动化）

* 每日/每周 consolidate 时，选 salience top-K（比如 10~20 条）生成 `USER_CORE.md`
* 规则：优先保留 `user_confirmed = true` 的条目
* 对冲突条目（如“写作风格：简洁 vs 详尽”），保留最新确认版本，并在 Extended 中保留历史

---

# 5. “AI 自我人格/角色”的设计：让它一致，但不越界

你要的“AI 自画像”建议对齐 OpenClaw 的结构：

* **IDENTITY（名字/形象）**：面向体验一致性。([OpenClaw][5])
* **SOUL（价值观/边界/风格）**：面向信任与安全。([OpenClaw][4])
* **AGENTS（操作规程）**：面向工程行为与工作流（如何写记忆、如何 heartbeat、如何群聊）。([OpenClaw][8])

同时结合 Turkle 对“人工亲密”的警示：要避免用户把 AI 的 persona 当作真实互惠关系。([Harvard Gazette][14])

**工程落地要点**

* 在 SOUL 里写明：

  * 不冒充真人、不假装有“亲身经历”
  * 不以情感绑架用户
  * 外部动作先确认（OpenClaw 同样强调“be careful with external actions”）([OpenClaw][4])
* Persona 的变更要 **显式告知用户**（OpenClaw SOUL 也要求改了要告诉用户）。([OpenClaw][4])

---

# 6. 主动整理画像：用“heartbeat/定时反思”做持续更新（借鉴 OpenClaw）

你问的“是不是定时器自动整理记忆、决定要不要发消息给主人？”——在你的 Personal AI 里可以做成两类触发：

## 6.1 后端：可靠的定时反思（推荐放后端）

理由：

* 浏览器 MV3 service worker 会休眠，长期稳定定时任务不如后端可靠（尤其是向量索引、图谱扩散、批量巩固）。
* 后端更适合跑“巩固/重放/索引重建/冲突检测”。

借鉴 OpenClaw：heartbeat 机制 + “没事不打扰”策略（HEARTBEAT_OK 抑制外发）。([OpenClaw][7])

### 反思任务（每天一次/每10-30分钟微反思）

* 读最近 episodic memory（浏览/对话摘要）
* 更新：

  * USER_CORE（核心画像）
  * social graph（新增人物/关系变化）
  * opinions（新增/变更→进入待确认）
* 生成：

  * 待确认问题（最多 1~3 个/天）
  * 待触发 action（如果你系统有自动 action）

## 6.2 前端（Chrome Extension）：只做“轻量触发 + 展示 + 最小采集”

前端更适合：

* 采集与脱敏摘要
* 弹通知/确认
* 展示“你记住了什么”的面板（像 ChatGPT Memory / Gemini saved memories 那样可视化与可删除）([OpenAI Help Center][12])

**结论**：

* **画像计算与存储主责在后端**（稳、可扩展、可调度）
* **浏览器端做采集 + 交互控制 + 本地隐私兜底**（不上传模式、临时模式）

---

# 7. 你可以直接复用/借鉴 OpenClaw 的哪些“开源思想”

虽然你的产品形态是 Chrome Extension + 私有后端，但 OpenClaw 有几件事非常值得“照抄”：

1. **把“用户画像/AI自画像”变成少量稳定文件/数据块**，每次会话注入（Core Memory）。([OpenClaw][9])
2. **明确文件职责**：USER（用户是谁）/ SOUL（我是谁）/ IDENTITY（我长什么样）/ AGENTS（我怎么做事）([OpenClaw][2])
3. **主动性用 heartbeat/cron 显式实现**，并定义“何时打扰/何时沉默”。([OpenClaw][7])
4. **记忆安全分层**：长期私密记忆只在主会话加载，群聊不加载。([OpenClaw][8])

---

# 8. 本周就能开干的“快速落地清单”（一页版）

## P0（1周内可完成）

* [ ] 建立两份 Core：`USER_CORE.md` + `SOUL.md/IDENTITY.md`（后端存 DB 或 Git）
* [ ] 实现 `GET /profile/core`、`POST /profile/item`、`POST /profile/confirm`、`DELETE /profile/item`
* [ ] Chrome 端做一个 “我记住了什么” 面板（列表 + 删除 + 临时模式开关）
* [ ] 画像写入只支持 `explicit`（用户明确表达）
* [ ] opinions（对人的态度）全部进入“待确认”，不自动生效

## P1（2–4周）

* [ ] 社交图谱表（person_entity/social_edge/opinion_item）+ 证据引用
* [ ] 每日 consolidate job：

  * 生成/更新 `USER_CORE.md`
  * 清理过时条目（status=superseded）
* [ ] 主动确认队列：每天最多 1–3 个问题，24h 同主题节流
* [ ] 对不同场景投影：群聊/共享场景禁用私密画像（对齐 OpenClaw “MEMORY.md only in main session” 思想）([OpenClaw][8])

## P2（1–2月）

* [ ] 引入偏好学习：从用户改写/反馈中更新画像（参考从 user edits 学偏好的研究思路）([arXiv][17])
* [ ] 更强隐私策略：默认 opt-in、可导出/可审计、端到端加密分区（结合 Stanford HAI 对“规模与不透明”风险的提醒）([hai.stanford.edu][15])

---

如果你愿意，我可以在你现有的“人脑式记忆系统”总架构里，把这套 **双画像（Human Model + Agent Model）** 作为一个明确的子系统补齐：

* 画一张“画像写入/确认/投影/主动反思”的 Mermaid 架构图；
* 给一份最小可用的 API + 前端 UI 流程（确认弹窗、删除、临时模式）；
* 以及“社交态度”这类高风险字段的 **红线与默认策略**（什么时候一定要问你确认）。

[1]: https://gdpr-info.eu/art-4-gdpr/ "https://gdpr-info.eu/art-4-gdpr/"
[2]: https://docs.openclaw.ai/concepts/agent-workspace "https://docs.openclaw.ai/concepts/agent-workspace"
[3]: https://docs.openclaw.ai/reference/templates/USER "https://docs.openclaw.ai/reference/templates/USER"
[4]: https://docs.openclaw.ai/reference/templates/SOUL "https://docs.openclaw.ai/reference/templates/SOUL"
[5]: https://docs.openclaw.ai/reference/templates/IDENTITY "https://docs.openclaw.ai/reference/templates/IDENTITY"
[6]: https://docs.openclaw.ai/concepts/system-prompt "https://docs.openclaw.ai/concepts/system-prompt"
[7]: https://docs.openclaw.ai/start/openclaw "https://docs.openclaw.ai/start/openclaw"
[8]: https://docs.openclaw.ai/reference/templates/AGENTS "https://docs.openclaw.ai/reference/templates/AGENTS"
[9]: https://docs.openclaw.ai/experiments/research/memory "https://docs.openclaw.ai/experiments/research/memory"
[10]: https://arxiv.org/pdf/2401.00609 "https://arxiv.org/pdf/2401.00609"
[11]: https://arxiv.org/abs/1603.06155 "https://arxiv.org/abs/1603.06155"
[12]: https://help.openai.com/en/articles/8590148-memory-faq "https://help.openai.com/en/articles/8590148-memory-faq"
[13]: https://docs.cloud.google.com/gemini/enterprise/docs/configure-personalization "https://docs.cloud.google.com/gemini/enterprise/docs/configure-personalization"
[14]: https://news.harvard.edu/gazette/story/2023/12/why-virtual-isnt-actual-especially-when-it-comes-to-friends/ "https://news.harvard.edu/gazette/story/2023/12/why-virtual-isnt-actual-especially-when-it-comes-to-friends/"
[15]: https://hai.stanford.edu/news/privacy-ai-era-how-do-we-protect-our-personal-information "https://hai.stanford.edu/news/privacy-ai-era-how-do-we-protect-our-personal-information"
[16]: https://arxiv.org/html/2510.07925v1 "https://arxiv.org/html/2510.07925v1"
[17]: https://arxiv.org/abs/2404.15269 "https://arxiv.org/abs/2404.15269"
