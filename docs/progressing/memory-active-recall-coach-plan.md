# 新能力：Memory Active Recall Coach / 记忆主动回忆教练（搁置）

> Codex 会话标题：新能力：记忆主动回忆教练（搁置）
> Demo：[memory-active-recall-coach-demo.html](./memory-active-recall-coach-demo.html)（搁置视觉参考）
> Idea 来源：未使用 Reminder。本机 Reminders 可见列表为 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`，没有 `Personal AI` 清单，因此没有可随机选择的新功能 idea，也没有需要标记 done 的 Reminder item。本方案来自 `docs/progressing` 去重、`10.32.56.212` 上 `esone.qiu` 的当前只读记忆信号，以及 2025-2026 AI 学习产品和主动回忆研究。

## 搁置原因

本方案标记为搁置，当前不建议按这个形态实现。

关键判断是：**用户自己决定要不要记住**。Personal AI 可以在会前准备、Today Pilot、Meeting Prep、Memory Lens 等场景里把“最重要需要记住的东西”显示清楚，但不应该默认把这些内容进一步变成主动回忆卡、掌握度状态或学习调度。否则会把“我需要知道这件事”变成“系统认为我应该练习这件事”，增加新的心理负担，也容易让用户感觉被评估。

更合适的方向是：先强化会前准备本身，让它在一个页面里直接呈现最重要的 1-3 条记忆、来源、新鲜度、风险边界和下一步，而不是引导用户额外完成“记住了 / 不确定 / 稍后再问”的学习动作。只有当用户显式点击“帮我记住 / 下次考我 / 加入复习”时，才可以考虑把某条内容转成主动回忆卡。

因此，本文后续内容只保留为视觉和交互参考，不作为近期实现目标。未来如果重启，应先从**用户显式选择要记住**和**会前准备已能稳定显示最重要内容**这两个前提出发。

## 真实场景 1：Q3 planning 前 90 秒知识热身

用户上午 10:00 要进 Q3 planning / estimate 讨论。Personal AI 现在已经能在 Today Pilot 或 Meeting Prep 里告诉用户“最近 mThor、AI Notes、Jupiter、Mobile epics、DEV Estimate、release process 有哪些相关记忆”。但真实会议里，用户常常不是缺资料，而是需要在开口前把关键口径记在脑子里：

1. 用户打开 Today Pilot，顶部 mission 显示今天要准备 `Q3 planning / DEV estimate`。
2. 右侧出现一个小 chip：`90 秒回忆：3 个 estimate 口径`，不弹通知，不挡住今天任务。
3. 用户点开后先看到问题，不直接看到答案：
   - `Q: Mobile / Jupiter epics 缺 estimate 时，谁在群里提醒过？这类提醒通常要求你补什么？`
4. 用户可以在心里回答，也可以打一两句；点 `显示答案` 后看到 Personal AI 的来源化答案：
   - `Polina Bespalova 在 ada.han+esone.qiu+fred.gu+polina.bespalova 群里提醒 Mobile / Jupiter epics 的 DEV estimate 缺失，要求补齐 dashboard / policy 相关数据。`
5. 卡片底部只有三个轻量动作：`记住了`、`不确定`、`稍后再问`。
6. 回执明确说：`只更新学习状态；未写入事实、未发送消息、未创建任务。`

Before：用户在会议前看一堆摘要，进入会议后还是要临场翻找“这个口径谁说过、之前怎么答”。
After：用户用 90 秒把最可能被问到的 2-3 个工作口径主动回忆一遍，会议里不需要完全依赖提示卡，也更容易发现 AI 提示里的错误。

## 真实场景 2：AI 工具和内部平台经验不再只留在聊天记录里

用户最近反复接触 Codex CLI、MCP、OneAPI、Dify、Skills、AI Notes、mcp-jira 字段限制、OpenRouter quota、内部模型可用性等信息。Personal AI 可以搜索这些信息，也可以把它们塞进 Prompt Context Compiler。但用户日常真正需要的是“下次同事问起时，我自己能快速讲清楚”。

1. 用户在 RingCentral `Internal AI Infra Support - OneAPI / Dify / Skills / MCP` 群里浏览新消息。
2. Memory Lens 右下角不直接弹长记忆卡，而是出现一个小型练习入口：`这条和你最近的 MCP 经验有关，复习 1 题`。
3. 问题是：
   - `mcp-jira 当前拿不到更多字段时，AI Service 给过哪三种可行路径？`
4. 用户点 `显示线索`，只看到一个 hint：`服务端、JQL、REST API`。
5. 用户答完后再看证据。系统只记录 mastery event：这张卡是 `remembered` 还是 `uncertain`，下次是否需要在相似场景再出现。

Before：Personal AI 记住了所有聊天，但用户本人仍可能每次重新读一遍原消息。
After：高价值工作知识被转成低摩擦主动回忆，用户能把“AI 帮我查过的结论”变成自己的可用知识。

## 结论

`Memory Active Recall Coach` 原设想是一个把 Personal AI 记忆转成用户本人可内化知识的轻量教练层。这个方向有启发性，但当前应先搁置：

> Personal AI 应先把会前最重要该记住的内容显示清楚；要不要真的“记住它”，由用户自己决定。

不推荐把 P0 做成默认嵌入式练习卡。可保留的最小前提是：会前准备先稳定展示最重要的 1-3 条记忆；只有用户显式点击“帮我记住”后，才进入类似主动回忆的可选路径。

## 为什么值得做

### 1. Personal AI 当前更强在“替用户召回”，还没有很好覆盖“让用户记住”

当前功能已经覆盖：

- `Memory Lens`：在网页、Jira、RingCentral、会议等场景提示相关记忆。
- `Today Pilot`：把今天重要任务、会议准备和 context pack 带到首页。
- `Source Memory Distiller`：把资料蒸馏成 takeaways / triggers / skill seeds。
- `Prompt Context Compiler`：在用户把任务交给外部 AI 前补齐 prompt context。
- `Rehearsal` / `Memory Rehearsal Studio`：在未来场景或重要沟通前给用户脚本、策略或 roleplay。
- `Skill Foundry`：把反复有效的做事方法沉淀成 agent 可用的 skill。

缺口是：这些能力大多帮助 AI “拿到上下文”或帮助用户“看到提示”。但用户在会议、planning、问答、跨团队沟通时，仍需要把少量知识掌握在自己脑子里。主动回忆卡不替代提示，而是提高用户对核心记忆的掌握度。

### 2. 当前真实记忆里有大量适合内化的工作知识

本次只读查询 `10.32.56.212` 的 `esone.qiu` 数据：

- `/health` 可访问但状态为 `degraded`。
- `/api/v1/stats` 返回：10430 messages、8849 chunks、50383 relationships、13796 entities、28 pending confirm requests。
- topic / project 样本显示高频工作知识包括 `DEV Estimate`、`release process`、`AI Notes`、`MCP`、`OneAPI`、`Skills`、`mcp-jira 字段限制`、`Q3 planning`、`OKR bugs escape rate`、`SDD 实践规范` 等。
- active reflection threads 仍有 705 条，许多在等待外部核实或用户确认。这说明系统里有大量“会变化的事实”，但 Active Recall Coach 不直接继续 watch；它只选择当前已经有证据、适合用户内化的稳定工作知识。

这些内容不是通用课程，但很像用户自己的“工作课本”。NotebookLM 可以把文档变成测验，Readwise 可以把 highlights 变成复习；Personal AI 的机会是把用户自己的工作沟通、AI 对话、Jira、会议和资料记忆变成可用知识。

### 3. 它减少对 AI 提示的过度依赖

如果 Personal AI 永远只在旁边提示，用户会越来越依赖“即时提示是否出现”。主动回忆卡提供另一条路径：

- 重要知识先让用户自己想一遍。
- 想不起来也没惩罚，直接显示证据。
- 对经常想不起来的主题，下次只在相关场景前轻提示。
- 对已经稳定掌握的主题，系统自动降噪。

这符合项目愿景里的“私人记忆系统”：不是把用户变成被通知驱动的人，而是让用户和自己的记忆形成稳定关系。

## 行业产品和研究参考

### OpenAI ChatGPT Study Mode

[OpenAI Study Mode](https://openai.com/index/chatgpt-study-mode/) 的关键产品信号是：AI 不应该总是直接给答案，也可以引导用户一步步思考。[ChatGPT Study Mode 页面](https://chatgpt.com/features/study-mode/)也强调 step-by-step guidance 和 retention。对 Personal AI 的启发是：工作记忆场景里也不应总是直接展示答案；可以先让用户主动回忆，再显示证据。

### Google NotebookLM Flashcards / Quizzes

[Google Workspace Updates](https://workspaceupdates.googleblog.com/2025/09/flashcards-quizzes-reports-notebook-lm-google-education.html) 和 [NotebookLM app update](https://blog.google/innovation-and-ai/models-and-research/google-labs/notebooklm-app-quizzes-flashcards/) 都把源资料生成 flashcards / quizzes 作为新学习体验，且强调基于用户提供的 sources。Google Help 也有 [NotebookLM flashcards and quizzes guide](https://support.google.com/notebooklm/answer/16958963)。Personal AI 的差异是 sources 不是一个 notebook，而是用户全量私人记忆和当前工作场景。

### Readwise Mastery / Spaced Repetition

[Readwise](https://readwise.io/) 的核心承诺是用 spaced repetition 让用户记住阅读 highlights；[Readwise Mastery](https://docs.readwise.io/readwise/guides/mastery) 将 highlights 转成 Q&A 和 cloze deletion。对 Personal AI 的启发是：被动保存资料不够，关键片段需要转为主动回忆格式。

### Quizlet Q-Chat / Khanmigo / Duolingo Max

[Quizlet Q-Chat](https://quizlet.com/blog/meet-q-chat) 把 AI tutor 接到学习内容上；[Khanmigo](https://www.khanmigo.ai/) 强调 AI tutor 不只是给答案，而是引导学习者自己找到答案；[Duolingo Max](https://blog.duolingo.com/duolingo-max/) 的 Roleplay / Explain My Answer 说明 AI 学习体验可以嵌入日常路径而不是另起一套复杂系统。Personal AI 不做通用教育，但可以把同样的“先回忆、再解释、再反馈”迁移到私人工作记忆。

### Retrieval practice / spacing effect

NIH / PMC 上的 [retrieval practice review](https://pmc.ncbi.nlm.nih.gov/articles/PMC12292765/) 总结主动回忆是强化记忆的有效学习策略。AERO 的 [spacing and retrieval practice guide](https://www.edresearch.edu.au/guides-resources/practice-guides/spacing-and-retrieval-practice-guide-full-publication) 也强调隔一段时间再主动回忆，而不是重复阅读。对本系统的产品含义是：高价值记忆不应该只靠搜索和摘要；应该在合适时间被轻量提问。

### TutorLLM

[TutorLLM](https://arxiv.org/abs/2502.15709) 将 Knowledge Tracing 和 RAG 结合，用学习状态选择个性化推荐。Personal AI 可以借鉴它的两个点：一是卡片选择要看用户掌握状态；二是答案必须 RAG grounded，不能脱离真实来源胡编。

## 与现有能力和 progressing 方案的边界

| 已有能力 / 方案 | 已经解决什么 | 记忆主动回忆教练新增什么 |
|---|---|---|
| `Rehearsal` | 未来遇到某个场景时提醒用户该想起、说或做什么 | Active Recall Coach 不保存未来脚本，而是考察用户是否记得一个已知工作知识点 |
| `Memory Rehearsal Studio`（搁置） | 重要沟通前 roleplay / 沙盘推演 | 本方案不模拟对话角色，不给沟通评分，只做 60-90 秒知识回忆 |
| `Memory Lens` | 当前页面/消息/Jira 的被动相关记忆提示 | 本方案可消费 Lens 的 scene anchors，但先问问题再显答案，目标是内化而非直接提示 |
| `Today Pilot` | 今日重点、会议准备、context pack | 本方案作为 Today / Meeting Prep 的小模块，限制 1-3 张卡，不新增一整个任务队列 |
| `Source Memory Distiller` | 把资料变成 takeaways / triggers / skill/storyline seeds | 本方案可消费 takeaways 生成卡片，但不负责资料蒸馏 |
| `Prompt Context Compiler` | 发送外部 AI prompt 前补齐上下文和边界 | 本方案不改写 prompt，不插入草稿，只帮助用户本人记住关键口径 |
| `Skill Foundry` | 把做事方法沉淀成 agent skill | 本方案面向用户本人掌握，不生成 SKILL.md，不同步到外部 agent |
| `Memory Outcome Loop` | 学习 cue / draft / action 是否被用户采纳 | 本方案写入 mastery outcome，可作为 Outcome Loop 的一种信号，但不替代 cue-level policy |
| `Memory Sleep-Time Compute` | 夜间整理、压缩、反思、梦境重放 | 本方案可以使用夜间生成的候选卡，但用户体验发生在真实场景入口 |
| `Memory Proactivity Cost-Asymmetry` | 解决主动通知漏报/误报代价不同 | 本方案默认不通知，只在用户已打开相关 surface 时出现，减少打扰成本 |

## 产品定义

### 核心对象：ActiveRecallCard

`ActiveRecallCard` 是一条可来源化、可调度、可反馈的微练习。它不是普通记忆摘要。

```ts
interface ActiveRecallCard {
  id: string;
  userId: string;
  title: string;
  question: string;
  answer: string;
  hint?: string;
  cardType:
    | 'short_answer'
    | 'cloze'
    | 'compare'
    | 'scenario_choice'
    | 'explain_back'
    | 'source_trace';
  sourceRefs: string[];
  sceneAnchors: {
    projects: string[];
    people: string[];
    topics: string[];
    surfaces: string[];
  };
  stability: 'stable' | 'rolling' | 'stale_risk' | 'sensitive';
  masteryLevel: 0 | 1 | 2 | 3 | 4 | 5;
  nextDueAt: number;
  lastShownAt?: number;
  generationReason: string;
  privacyClass: 'work' | 'personal' | 'sensitive_summary_only';
  writeBoundary: 'mastery_only';
}
```

关键边界：

- `answer` 必须有 `sourceRefs`，不能只来自 LLM 常识。
- `writeBoundary='mastery_only'`：用户操作只更新学习状态，不改事实、不写画像、不外发、不创建任务。
- `stability='rolling'` 的卡必须显示 freshness；过期或 Evidence Watch 标记变化后，卡片暂停或重新生成。
- 敏感来源只生成摘要化问题，不暴露原文、密码、meeting link、token 或私聊内容。

### 卡片类型

| 类型 | 用途 | 示例 |
|---|---|---|
| `short_answer` | 记一个工作口径 | `mcp-jira 拿不到更多字段时，有哪三种路径？` |
| `cloze` | 补全易混字段 | `DEV Estimate Original 是 ____；如果 scope 变化，才进入 ____。` |
| `compare` | 区分相似概念 | `Context Passport 和 Prompt Context Compiler 差异是什么？` |
| `scenario_choice` | 低风险场景选择 | `Jira field 读错时，先查 JQL 还是直接改服务端？` |
| `explain_back` | 用户用自己的话解释 | `用 20 秒说清楚 OneAPI key 费用归属规则。` |
| `source_trace` | 记住来源链 | `谁解释过 fixVersion 日期和 rollout 日期差异？` |

### 入口

P0 不新增大页面，优先做嵌入式入口：

1. **Today Pilot / Meeting Prep**
   在已有会前准备或今日 mission 旁显示 `90 秒回忆`。只出现与今天会议、Jira、项目、topic 高相关的 1-3 张卡。

2. **Memory Lens Hover Peek**
   当当前页面命中某条已到期卡时，Memory Lens 展示 `复习 1 题` chip。展开后先显示问题，答案折叠。

3. **Source Memory Detail**
   在 source memory capsule / distilled takeaway 页面提供 `生成 3 张回忆卡`。这是显式动作，但不要求用户每天来这里。

4. **Quick Ask / Ask answer**
   当 Ask 回答用户一个高复用口径时，底部可以有 `下次提醒我先回忆`。这不是默认写入，需要用户点击。

### 用户操作成本约束

P0 explicit daily actions added = 0。

- 用户不需要每天打开一个新学习页。
- 不发独立学习通知。
- 一次最多 3 张，默认 60-90 秒。
- `不确定` 不是负反馈，只表示下次可以更早/更简单地问。
- `不再问这类` 才是显式抑制。
- 卡片已掌握后自动退场，不保留红点债务。

## 关键体验细节

### 先问题，后答案

主动回忆的核心是 retrieval practice。如果一开始就显示答案，它会退化成普通摘要。P0 UI 必须默认折叠答案，只显示：

- 问题。
- 可选 hint。
- 来源类别和新鲜度。
- `显示答案` 动作。

### 答案必须可复核

显示答案后至少给出：

- 简短答案。
- 2-4 条证据来源。
- freshness / stability。
- 边界回执：`这只是学习卡；没有改写记忆事实。`

### 不把“答错”当成用户画像

用户答错或点 `不确定`，只能更新 mastery 状态。不能写入：

- 用户不懂某主题。
- 用户偏好某种解释方式。
- 用户工作能力判断。

如果多次 `不确定`，系统可以降低难度、换成 cloze 或显示更多 hint，但不能生成评价性 profile。

### 场景触发比每日复习更重要

普通 spaced repetition 产品按日期提醒。Personal AI 更适合 scene-aware repetition：

- 会前出现项目 / 人 / topic 卡。
- Jira 页面出现字段 / 口径卡。
- AI 工具群出现工具使用经验卡。
- Source Memory detail 出现资料理解卡。

没有场景时，不打扰。真正需要长期保留的卡再进入 Today 的低频 `本周回忆`。

## 技术设计

### 服务和表

新增服务：

- `ActiveRecallCardService`：生成、去重、调度、暂停、归档卡片。
- `ActiveRecallMasteryService`：记录用户 mastery event，计算下一次出现时机。
- `ActiveRecallSceneSelector`：从 Today / ContextRecall / Source Memory / Ask 的 scene anchors 选择到期卡。
- `ActiveRecallRenderer`：按 surface 渲染问题、hint、答案、证据和边界回执。

新增表：

```sql
CREATE TABLE active_recall_cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  hint TEXT,
  card_type TEXT NOT NULL,
  source_refs_json TEXT NOT NULL,
  scene_anchors_json TEXT NOT NULL,
  stability TEXT NOT NULL,
  privacy_class TEXT NOT NULL,
  mastery_level INTEGER NOT NULL DEFAULT 0,
  next_due_at INTEGER NOT NULL,
  last_shown_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  generation_reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE active_recall_events (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  scene_key TEXT NOT NULL,
  action TEXT NOT NULL,
  response_quality TEXT,
  answer_revealed INTEGER NOT NULL DEFAULT 0,
  event_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE active_recall_mastery (
  subject_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mastery_score REAL NOT NULL DEFAULT 0,
  last_practiced_at INTEGER,
  next_due_at INTEGER,
  uncertainty_count INTEGER NOT NULL DEFAULT 0,
  suppression_until INTEGER,
  updated_at INTEGER NOT NULL
);
```

### API 草案

```http
GET /api/v1/active-recall/cards?surface=today&sceneKey=meeting:mthor-q3-planning&limit=3
POST /api/v1/active-recall/cards/:id/event
POST /api/v1/active-recall/generate
POST /api/v1/active-recall/cards/:id/suppress
```

事件 body：

```json
{
  "surface": "today_pilot",
  "sceneKey": "meeting:mthor-q3-planning",
  "action": "remembered | uncertain | reveal_answer | snooze | suppress_similar",
  "answerRevealed": true,
  "responseQuality": "self_reported"
}
```

### 生成逻辑

P0 不需要泛化所有记忆。建议先从高确定性来源生成：

1. Source Memory Distiller 的 `takeaways` / `trigger cards`。
2. User confirmed facts / profile 不敏感条目。
3. 高 salience project / topic summaries。
4. Ask 活答案中被重复命中的 stable answer。
5. Skill Foundry suggestion 的非脚本性“什么时候用 / 注意什么”，但不生成 agent skill 内容。
6. Rehearsal 的未来脚本不自动转卡，除非用户显式选择。

生成时必须通过：

- source count >= 1；
- answer length <= 600 chars；
- no secret / token / meeting password；
- not pure speculation；
- not pending Evidence Watch change；
- not already covered by near-duplicate card；
- current user scope allowed。

### 调度逻辑

P0 可用简化 Leitner / SM-2：

- `remembered`：mastery +1，下次 3 天 / 7 天 / 21 天。
- `uncertain`：mastery 不增，降低难度，下次只在相关场景出现。
- `snooze`：本 scene 24 小时不再出现。
- `suppress_similar`：同 subject 30 天内不出现。
- 连续 3 次 `remembered`：卡片归档，保留 mastery 记录。

但它必须被场景门控：

```ts
showCard =
  card.status === 'active'
  && card.nextDueAt <= now
  && sceneOverlap(card.sceneAnchors, currentScene) >= threshold
  && surfaceBudget.remainingRecallCards > 0
  && !privacyBlocked
  && !staleRiskBlocked;
```

### 集成点

#### Today Pilot

- `DayPilotService` 可请求到期卡并放入 `mission.practice`.
- UI 在 mission 或 meeting prep 区显示 `90 秒回忆`。
- 不影响 Today 原有排序和通知。

#### Memory Lens / Context Recall

- `/context-recall` 可返回 `active_recall_card` 类型 match，或前端在拿到 scene anchors 后另查 `/active-recall/cards`。
- 建议 P0 独立查，避免污染主 recall 排名。
- 展示为 chip / small drawer，不抢占普通记忆卡。

#### Source Memory Detail

- 在 source capsule 已经有 distilled takeaway 时显示 `生成回忆卡`。
- 生成前 preview，创建后回执：`已创建学习卡；只会在相关场景或到期时出现。`

#### Ask

- Ask answer 如果 `answerMemory` 被 promoted，可以提示 `创建回忆卡`。
- 自动创建只允许低风险 stable answer，不包含隐私或 speculation。

## P0 实现切片建议

第一版只覆盖两个场景，避免做成泛学习平台：

### P0.1 Today Pilot estimate / release 卡

从真实 `esone.qiu` project/topic summaries 和 high salience message chunks 生成 6-10 张卡，覆盖：

- DEV Estimate / story points / original vs new estimate。
- Release process / fixVersion / rollout date 差异。
- AI Notes / mThor / Jupiter / Mobile epics 的近期 planning 口径。

验收：

- Today Pilot 只显示与当天 meeting / mission overlap 的最多 3 张卡。
- 答案默认折叠。
- 用户点击 `显示答案` 后看到来源和 `mastery_only` 回执。
- `记住了` 更新 mastery，不写 profile，不创建 confirm request。

### P0.2 RingCentral AI tools group 卡

从 AI 工具群、MCP、OneAPI、Skills、Codex CLI 的 source memory / topic summary 生成 6-10 张卡。

验收：

- 用户浏览相关 RingCentral 群组时，Memory Lens 出现 `复习 1 题` chip。
- 同一页面最多出现一次。
- 答案里保留原始技术词，例如 `JQL`、`Jira REST API`、`OneAPI`、`OpenRouter`。
- 敏感 key / internal URL 只显示摘要或字段名。

## Evals 计划

这个功能需要 eval。原因是价值依赖：

- 卡片是否真的和当前场景相关。
- 问题是否适合主动回忆，而不是普通摘要。
- 答案是否 grounded。
- 是否把会变化或不确定的事实误做成学习卡。
- 是否打扰过多。

实现后应新增 suite：

```text
evals/cases/memory-active-recall-coach/cases.jsonl
evals/workflows/memory-active-recall-coach/experience.md
```

建议 case：

1. `today-estimate-planning`
   输入真实 mThor / DEV Estimate / Q3 planning 场景，预期生成 1-3 张 estimate 口径卡，答案引用真实来源。

2. `ringcentral-mcp-tooling`
   输入 AI Infra / MCP 群场景，预期生成 mcp-jira 能力限制和解决路径卡，不暴露内部 token / key。

3. `stale-release-fact-blocked`
   输入一个 Evidence Watch / confirm request 正在等待确认的 release version 事实，预期不生成 stable card，或卡片标记 `stale_risk` 并暂停展示。

4. `low-information-page-silent`
   输入低信息网页或普通聊天，预期不展示练习 chip。

5. `mastery-suppression`
   连续三次 `remembered` 后，卡片应退场；`uncertain` 后在相关 scene 以更低难度再出现。

报告要求：

- 使用 Reader Contract 报告格式。
- 必须说明 “proved / not proved”。
- 如果真实线上数据不足，先从 `10.32.56.212` 的 `esone.qiu` memory-service 只读采样生成 fixtures。
- 达不到阈值时继续调整生成规则、场景门控和 stale blocking，直到 eval 全部通过。

## 文档维护要求

完成代码实现后，需要把关键点维护进正式功能文档：

- `docs/features/memory_system.md`：新增 Active Recall Coach 在记忆系统里的位置、表、调度边界和 `mastery_only` 写入边界。
- `docs/features/today_pilot.md`：说明 Today / Meeting Prep 如何展示 `90 秒回忆`，以及不创建每日学习任务的原则。
- `docs/features/memory_lens.md`：说明 `复习 1 题` chip 的触发、显示上限、答案折叠和反馈。
- `docs/features/memory_capture.md` 或 Source Memory 相关文档：如果 Source Detail 支持显式生成卡片，需要记录来源和 privacy 策略。
- `docs/features/index.md`：新增小功能点索引。
- 如果桌面端 Quick Ask / menubar 也承载这类入口，再在 `desktop-app/docs/features/` 下新增或合并一个简短文档，说明桌面端只展示卡片和 mastery receipt，不本地复制完整敏感来源。

## 风险和对策

| 风险 | 可能问题 | 对策 |
|---|---|---|
| 变成新学习负担 | 用户不想每天背卡 | 不建每日队列，不发独立通知，只在相关场景轻提示 |
| 答案过时 | release / status / license 会变化 | `stale_risk` / Evidence Watch pending / confirm pending 的事实不生成 stable card |
| 隐私泄漏 | 卡片暴露私聊、token、会议链接 | 默认 summary-only，secret detector 阻断，sourceRefs 可审计 |
| 用户被评价 | `不确定` 被误写成能力画像 | mastery 只用于卡片调度，不写 profile，不生成能力判断 |
| 召回噪音 | 当前页面随便命中 topic 就弹 | scene overlap + surface budget + low-information 静默 |
| 和 Rehearsal 重叠 | 都是“未来前准备” | Rehearsal 是脚本/行动 cue；Active Recall 是知识掌握状态 |
| 和 Skill Foundry 重叠 | 都叫 skill / 学习 | Skill Foundry 给 agent 执行；Active Recall 给用户本人记住 |

## 亮点

1. **把 Personal AI 从“替我记得”推进到“帮我记住”。** 这是记忆产品体验上的关键差异。
2. **工作场景原生。** 卡片来自 Jira、RingCentral、AI 对话、会议、source memory，不是用户手动整理课程。
3. **先回忆后答案。** 避免 AI 直接喂答案导致用户依赖提示。
4. **低打扰。** 不新增每日任务，不新增 review queue，不发独立学习通知。
5. **可评估。** card relevance、answer groundedness、stale blocking、mastery scheduling 都能写 eval。
6. **能和现有能力自然组合。** Source Distiller 产出素材，Today / Lens 提供场景，Outcome Loop 消费 mastery 信号，Evidence Watch 提供 stale gate。

## 推荐结论

当前不建议进入实现。

优先级应转向强化会前准备：在 Meeting Prep / Today Pilot 中直接显示最重要需要记住的内容、证据来源、新鲜度和风险边界。只有用户主动选择某条内容“帮我记住”时，才可以把本文的主动回忆卡作为可选扩展，而不是默认能力。
