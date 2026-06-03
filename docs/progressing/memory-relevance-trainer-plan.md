# 新能力：Memory Relevance Trainer / 记忆相关性调教师

> 记录时间：2026-05-28  
> 状态：待决策，只做方案与 demo，未改运行时代码  
> 建议 Codex 会话标题：`新能力：记忆相关性调教师`  
> Demo：`docs/progressing/memory-relevance-trainer-demo.html`

## 结论

我建议下一条新能力做 **Memory Relevance Trainer / 记忆相关性调教师**。

它不是新的记忆浏览器，也不是另一个“可信中枢”。它解决一个更直接的问题：当 Memory Lens、Compose Assist、Today Pilot 或搜索结果把一条明显不相关的记忆推到用户面前时，用户只需要点一次 **“不是这个意思”**，Personal AI 就把这次失败变成：

1. 一条可解释的召回失败原因；
2. 一个带当前场景锚点的 relevance patch；
3. 一个可复跑的体验评估 case；
4. 一次 before/after 回放，告诉用户未来类似场景会怎么变安静或变准确。

一句话承诺：

> 让用户每次遇到错误关联记忆时，都能用 10 秒把 Personal AI 调准一点，而不是只能忍受、关掉或反复报 bug。

## 为什么现在值得做

Personal AI 现在已经有大量输入和多个召回消费方：网页记忆、RingCentral 消息、会议、Jira、日程、AI 对话、Today Pilot、Memory Lens、Compose Assist、Ask。下一阶段的瓶颈不是“再多存一点”，而是“当前场景到底该不该出现这条记忆”。

这和当前项目优先级一致：近期多个被搁置方案都指向同一个教训，安全、外发、防火墙、事实核验、会话漂移都重要，但用户目前更在意 **召回准确性和噪声控制**。一个真正实用的记忆系统，必须把用户现场反馈变成长期可复用的排序/过滤知识。

## 本次输入信号

### Reminders 检查

本机 Reminders 可见列表为 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`，没有看到名为 `Personal AI` 的列表。因此本轮没有 Reminder idea 可选，也没有需要标记 done 的条目。

### 真实记忆信号

通过 `10.32.56.212:3210` 的 `X-User-Id: esone.qiu` 只读检查：

- `/api/v1/health` 正常，数据库 connected。
- 当前用户空间约有 `10070` 条 messages、`13763` 个 entities、`50109` 条 relationships。
- 来源分布：`glip 8773`、`web 440`、`meeting 370`、`system 246`、`calendar 210`、`jira 20`。
- 近期高频群组包括 `敏捷教练-RC China`、`AI Tools for Engineering - Workgroup`、`[CN] Nova Core Team`、`Nova / WhatsApp product discussion`、`Bug - AI 先修一遍我再看`。
- 最近消息集中在 Q3/Q2 planning、Nova WhatsApp scope、Channel Adapter requirements、AI 工具使用、Codex/Claude/Cursor 成本与政策、会议和 Jira 协作。
- 数据中至少有 `80` 条 meeting 记忆包含 `no decisions` / `no action items` 这类低信息记录，容易在被动召回里形成噪声。

这说明 Personal AI 的真实场景不是“没有记忆”，而是记忆量已经足够大、来源足够杂，召回必须能被用户持续校准。

### 已有 progressing / features 避让

这次方案刻意避开以下已有方向：

- **Memory Lens**：负责当前页面的轻量关联记忆展示；Trainer 不替代 Lens，而是在 Lens 误报时接管修复闭环。
- **Context Recall Experience Eval**：负责离线/定期评估；Trainer 把用户现场反馈自动沉淀成 eval case。
- **Memory Lifecycle Gardener**：后台无感调整记忆层级；Trainer 处理“这个场景为什么错配”这种带上下文的显式反馈。
- **Memory Trust Console / Reality Check / Egress Firewall**：这些偏可信、事实核验或外发安全，已有搁置原因；Trainer 聚焦相关性，不扩成安全平台。
- **AI Context Passport / Conversation Loom / Drift Radar**：这些偏跨 AI 会话/上下文接力；Trainer 不做跨平台观察。
- **Memory Freshness Radar**：处理来源是否变旧；Trainer 处理当前场景与候选记忆是否匹配。

## 行业与研究参考

- [ChatGPT Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) 已经把 Memory Sources、相关/不相关反馈、可管理记忆放到用户体验里。Personal AI 的机会是把这种反馈做得更深：不仅记录“这条不相关”，还要解释和修复“为什么这个场景不该召回它”。
- [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 强调 context 是有限资源，关键是选择高信号、最小必要上下文。Trainer 的目标正是减少低信号记忆进入上下文。
- [LangSmith user feedback](https://docs.langchain.com/langsmith/attach-user-feedback) 支持把用户反馈挂到 trace 的子步骤，例如 retrieval step。Trainer 应该把 thumbs-down 绑定到本次 `/context-recall` trace，而不是只给 memory item 降权。
- [TruLens RAG Triad](https://www.snowflake.com/en/blog/engineering/benchmarking-LLM-as-a-judge-RAG-triad-metrics/) 把 RAG 质量拆成 context relevance、groundedness、answer relevance。Trainer P0 只抓第一项：当前场景和候选记忆是否相关。
- [RAGChecker](https://arxiv.org/abs/2408.08067) 提供 retrieval/generation 分模块诊断指标，说明“坏回答”需要定位是检索坏、证据坏还是生成坏。
- [RAGTrace](https://arxiv.org/abs/2508.06056) 是交互式 RAG 评估系统，支持从整体表现一路 drill down 到检索相关性、生成忠实度和跨组件交互。Trainer 可以借鉴它的 before/after 诊断体验，但面向普通用户做轻量版本。
- [Mem0](https://arxiv.org/abs/2504.19413) 和 [Zep Graphiti](https://help.getzep.com/graphiti/getting-started/welcome) 都证明长期记忆需要结构化、图谱化、可演化的检索，而不是把历史直接塞进上下文。Trainer 要生成的是可演化的召回规则和样本，而不是训练一个黑盒模型。

## 产品定位

### 目标用户

- 每天在 RingCentral、Jira、Google Docs、会议和 AI 工具之间切换的人。
- 已经开始依赖 Personal AI 的关联提示，但对偶发错误召回非常敏感的人。
- 不想理解向量、FTS、MMR、graph、salience，只想告诉系统“这个不是这个意思”的真实用户。

### 不做什么

- 不训练个人模型。
- 不自动删除记忆。
- 不把所有负反馈都变成全局降权。
- 不要求用户打开一个“调参后台”。
- 不默认把敏感记忆外发给第三方评估服务。
- 不解决 AI 生成答案的事实核验；那属于 Reality Check / Ask evidence chain。

### 做什么

- 在 Memory Lens / Search / Timeline / Compose Assist 的候选卡片上提供 `不是这个意思`。
- 自动捕捉本次失败的 scene anchor：当前 URL、group/conversation/meeting/issue id、可见人名、主题词、选中文本、source type、source title。
- 默认仍沿用现有卡片的 thumb-down icon 反馈模式，不在 Memory Lens 卡片上放一个占宽的大按钮。只有用户 hover / 展开卡片时，icon tooltip 或极短标签说明为 `不是这个意思`。
- 让用户用极少选择说明失败类型：
  - `不是同一个群 / 项目`
  - `只是泛 AI/会议/通知词重合`
  - `这是空会议/壳信息`
  - `这条记忆本身没问题，但不该自动弹`
  - `应该优先找另一个项目/人/消息`
- 用户选择原因后立即生成并暂存 relevance patch；不要求再点一次“提交”。补充文字是可选项，只用于解释复杂情况。
- 展示轻量 before/after replay；用户可以撤销、改原因或点旁边关闭。
- 把这次失败沉淀成 `Context Recall Experience Eval` case，未来改召回逻辑时可复跑。

## 核心体验

### Flow A：用户在 RingCentral 里遇到错误 Lens 提示

1. 用户正在 `Nova - whatsapp product discussion` 里讨论 Q2 scope 和 David requirement。
2. 右下角 Memory Lens 弹出一条泛 AI 工具政策或 HR 通告。
3. 用户点卡片角落的 thumb-down icon，tooltip 写 `不是这个意思`；卡片上不放大号反馈按钮。
4. Trainer 以轻量 drawer / bottom sheet 打开。背景保留当前页面，点击旁边空白处即可关闭；顶部写清楚：
   - 当前场景是什么；
   - 这条记忆为什么被召回；
   - 系统初步判断哪里错了。
5. 用户选择 `泛 AI 词重合，但没有同群/同人/同项目锚点`。选择后立即显示 `已记录，可撤销`，不强制点提交。
6. Personal AI 暂存 patch：
   - 当前 scene signature 下，泛 AI/公告类记忆不能自动 p1；
   - 没有 group/person/topic overlap 时降为 `possible` 或 `hidden`；
   - 该错误样本加入 eval suite。
7. Drawer 自动展示简短回放：未来类似页面会把 HR/公告类记忆隐藏，把同群 David requirement 相关记忆置顶。用户可以关闭、撤销、或展开 textarea 补充原因。

### Flow B：用户在 Ask/Quick Ask 里觉得证据不对

1. 用户问 `那个 BE ready 了吗？`。
2. Ask 返回了一个看似相关但实际来自 Google Docs 或泛会议记录的证据。
3. 用户点证据旁的小 thumb-down / `证据不对` icon。
4. Trainer 不问复杂问题，只给两个判断：
   - `这个 BE 不是当前项目`
   - `这个来源不能作为 BE 状态证据`
5. 选择后立即生效，后续短指代问题必须优先依赖当前 RingCentral/group/source anchors，不能用弱网页壳文本补上下文。

## 信息架构

### 入口

- Memory Lens expanded card：保留小 `thumb up/down` icon；thumb-down tooltip 为 `不是这个意思`，必要时展开轻量 drawer。
- Search / Timeline result card：小 `相关/不相关` icon，只有复杂原因才打开 drawer。
- Compose Assist preview：证据旁小 icon `不应用于回复`，选择后不打断插入流程。
- Context Recall Eval report：从失败 case 回到对应 patch

### Drawer / Sheet 形态

默认形态不是常驻右栏，而是 on-demand sheet：

- 桌面端：右侧 380-420px drawer，背景有轻量 scrim；点击 scrim、`Esc` 或关闭按钮都退出。
- 移动端：底部 sheet，高度不超过 80vh，保留当前页面语境。
- 打开后不要求用户提交。选择原因就是主要动作；系统显示短 toast：`已记录，可撤销`。
- `textarea` 是折叠或低优先级的可选补充：文案是 `补充原因（可选，不填也会生效）`。只有用户输入内容时才出现 `保存补充`。
- 复杂或高影响范围的 patch 才需要明确确认；普通 scene-only 降级不需要二次确认。

### Drawer 内容结构

1. **一眼判断**
   - 当前页面/群组/issue/meeting
   - 错误候选来自哪里
   - 系统初判原因，例如 `泛 AI 词重合，但无同群/同人锚点`
2. **选择原因**
   - 3-5 个原因 chip / radio row，默认选中系统推荐项
   - 选择后立即暂存，不强制提交
3. **可选补充**
   - textarea 折叠在 `补充一句原因` 下面
   - 用户不填也会生成 patch
4. **轻量回放**
   - before/after 最多各 2 条
   - 显示“自动弹出 -> 仅主动打开时可能相关 / hidden”
5. **后悔药**
   - `撤销这次反馈`
   - `改成仅此页面`
   - `查看完整样本`

后台仍需要保存完整信息：

1. **这次场景**
   - 当前页面/群组/issue/meeting
   - 可见人名、项目、主题
   - 触发方式：page passive / selected text / ask / compose
2. **这条为什么出现**
   - vector / fts / graph / time 命中情况
   - 同群/同人/同主题 overlap
   - displayPriority / reasonType / evidenceRole
3. **哪里不对**
   - 单选原因 + 可选文本说明
4. **修复预览**
   - patch rule
   - before/after 候选列表
   - 会新增的 eval case
5. **保存范围**
   - 仅此场景签名
   - 同群/同项目类似场景
   - 全局广播/空会议噪声模式

## 数据模型建议

### `recall_relevance_patches`

用于存储用户确认过的相关性修复规则。

```ts
type RecallRelevancePatch = {
  id: string;
  status: 'active' | 'paused' | 'superseded';
  createdAt: number;
  updatedAt: number;
  source: 'memory_lens' | 'search' | 'ask' | 'compose_assist' | 'eval_report';
  userId: string;
  sceneSignature: {
    surface: 'ringcentral' | 'jira' | 'google_docs' | 'meeting' | 'web_ai' | 'generic_web';
    urlHost?: string;
    conversationId?: string;
    groupName?: string;
    issueKey?: string;
    meetingId?: string;
    visiblePeople: string[];
    visibleProjects: string[];
    visibleTopics: string[];
    selectedTextHash?: string;
  };
  rejectedCandidate: {
    targetType: 'message' | 'chunk' | 'entity' | 'rehearsal';
    targetId: string;
    sourceType: string;
    groupName?: string;
    sender?: string;
    title?: string;
    reasonType?: string;
  };
  reason:
    | 'wrong_group_or_project'
    | 'generic_topic_overlap'
    | 'empty_meeting_shell'
    | 'broadcast_without_anchor'
    | 'stale_or_superseded'
    | 'should_be_manual_only'
    | 'other';
  action:
    | 'hide_for_scene'
    | 'demote_to_possible'
    | 'penalize_source_pattern'
    | 'require_anchor_overlap'
    | 'boost_positive_anchor';
  scope: 'scene_only' | 'same_group' | 'same_project' | 'source_pattern' | 'global_pattern';
  autoApplied: boolean;
  userNote?: string;
  expiresAt?: number;
  evidence: {
    recallRequestId?: string;
    traceId?: string;
    originalRank: number;
    originalScore?: number;
    overlapAudit?: 'strong' | 'possible' | 'hidden';
  };
};
```

### `recall_training_cases`

用于把一次真实失败变成可复跑样本。

```ts
type RecallTrainingCase = {
  id: string;
  patchId: string;
  suite: 'context-recall-experience';
  sceneInput: object;
  rejectedTargetRefs: string[];
  preferredTargetRefs?: string[];
  expectedBehavior:
    | 'no_auto_popup'
    | 'show_possible_only'
    | 'rank_preferred_above_rejected'
    | 'ask_for_more_context';
  humanLabel: {
    contextRelevance: 0 | 1 | 2 | 3;
    userValue: 0 | 1 | 2 | 3;
    reason: string;
  };
};
```

### `recall_patch_runs`

记录 before/after replay，供用户看到修复是否有效，也供后续回滚。

```ts
type RecallPatchRun = {
  id: string;
  patchId: string;
  before: Array<{ targetRef: string; rank: number; displayPriority: string }>;
  after: Array<{ targetRef: string; rank: number; displayPriority: string }>;
  changed: boolean;
  warnings: string[];
  createdAt: number;
};
```

## 排序与门控逻辑

P0 只做可解释规则，不做模型训练：

1. **同场景强锚点优先**
   - 同 conversation/group/issue/meeting > 同人名 + 同主题 > 同主题泛匹配。
2. **泛词弱化**
   - `AI`、`meeting`、`tool`、`planning`、`status` 这类泛词不能单独触发 p1。
3. **广播/公告类降级**
   - HR、newsletter、everyone campaign、全员通知如果没有同群/同项目/同人锚点，默认 `possible` 或 `hidden`。
4. **空会议壳信息降级**
   - `no decisions`、`no action items`、`RingCentral Video invite`、`participants only` 等低信息 meeting 记录不能自动弹。
5. **负反馈不能粗暴全局降权**
   - 用户在 Nova 场景拒绝一条 HR 通告，不代表这条 HR 通告在 HR 场景永远无用。
6. **保存前必须 replay**
   - 如果 patch 没改变候选排序或只隐藏了无关项，明确告诉用户。

## API 轮廓

### `POST /api/v1/recall/relevance-feedback`

提交一次带 scene 的不相关反馈。P0 默认 `autoApply=true` 且 scope 为 `scene_only` 或 `same_group`；只有 source/global pattern 这种高影响 patch 才要求二次确认。

```json
{
  "surface": "memory_lens",
  "traceId": "ctxrec_...",
  "scene": {
    "url": "https://app.ringcentral.com/l/messages/...",
    "groupName": "Nova - whatsapp product discussion",
    "visiblePeople": ["Esone Qiu", "David Theis", "Antonio Nucci"],
    "visibleTopics": ["Q2 scope", "WhatsApp", "LLM rendering PoC"]
  },
  "target": {
    "type": "message",
    "id": "msg_...",
    "sourceType": "glip",
    "groupName": "AI Tools for Engineering - Workgroup"
  },
  "reason": "generic_topic_overlap",
  "autoApply": true,
  "userNote": ""
}
```

返回 patch 草案和 replay。

### `POST /api/v1/recall/relevance-patches/:id/confirm`

用户确认保存 patch，并创建 eval case。

### `GET /api/v1/recall/relevance-patches`

在设置或 Memory Exploring 里查看已生效的规则，支持暂停/恢复/删除。

## 实施路线

### P0：Memory Lens 场景反馈闭环

- 保留 Memory Lens expanded card 里的小 thumb-down icon；不要新增占宽的大号 `不是这个意思` 按钮。
- 将当前 `recall_quality` feedback 扩展为带 scene signature 的 relevance feedback。
- 点击 icon 打开轻量 drawer；点击旁边/关闭/`Esc` 可以退出。
- 选择原因后自动暂存并展示 `已记录，可撤销`，不要求提交按钮；textarea 仅作为可选补充。
- 后端生成 patch 草案：只支持 `hide_for_scene`、`demote_to_possible`、`require_anchor_overlap` 三类。
- 保存 patch 后影响 `/context-recall` 的后处理和 Memory Lens 前端选择。
- 自动写入 `evals/cases/context-recall-experience/` 或 DB case 表。
- 提供 before/after replay。

### P1：覆盖 Ask / Search / Compose Assist

- Ask evidence card 支持 `证据不对`。
- Search / Timeline result 支持 `不相关` 的上下文化反馈。
- Compose Assist 证据支持 `不应用于回复`。
- replay 支持多 consumer：同一个 patch 对 Lens 与 Compose 的影响可能不同。

### P2：主动学习与质量报告

- 聚合一周的 patch，形成“本周 Personal AI 学会少打扰的模式”。
- 对高频噪声 pattern 生成候选 patch，但不自动启用。
- 在 `Context Recall Experience Eval` 报告里展示“由用户反馈发现的 top failure modes”。

## 验证计划

P0 应至少覆盖：

- 单元测试：patch 只影响匹配 scene，不误伤其他场景。
- API 测试：icon feedback -> 自动生成 scene-only patch -> replay -> context-recall 生效；高影响 patch 仍需 confirm。
- E2E：Memory Lens 卡片点 thumb-down icon，drawer 展示 scene、reason、before/after；选择原因后无需提交即可显示已记录；点击 scrim 能关闭。
- Experience Eval：从真实失败样本生成 case，复跑后 rejected target 不再 p1。
- 回归样本：
  - Hackathon/Codex/MCP/setup 不召回 Gary travel itinerary。
  - 空 RingCentral Video shell 不召回 Colin/AVA。
  - Nova 当前讨论 David requirement 时，不自动弹 HR/Open Day/泛 AI newsletter。
  - `那个 BE ready 了吗？` 在无强上下文时要求更多上下文或只用当前 RingCentral anchor。

## 成功指标

- Memory Lens 自动弹出候选的人工 `不是这个意思` 比例下降。
- `possible` / `hidden` 的候选里，被用户主动打开后标记有用的比例不下降太多。
- 每条 patch 至少能生成一个可复跑 case。
- Before/after replay 中 rejected target 的 rank 或 displayPriority 明确下降。
- 用户不需要理解通道、向量分数或 MMR，也能完成修复。

## 亮点

- **把一次负反馈变成长期训练资产**：不是简单 thumbs-down，而是 scene-aware patch + eval case。
- **用户不用调参**：只选择“哪里不对”，系统负责翻译成召回规则。
- **修复影响可见**：选择后立刻看到 before/after；普通 scene-only 反馈不再要求二次提交，高影响规则才确认。
- **符合真实记忆系统方向**：Personal AI 的价值不是比通用 AI 多一个聊天框，而是能持续从用户自己的工作场景里学会“什么时候该安静”。

## 风险与边界

- 过度学习会误伤：必须限制 patch scope，并保留暂停/删除。
- 用户反馈可能是一次性情绪：高影响范围的 patch 需要 replay 和确认。
- 规则堆积会复杂：P0 只允许少数 action 类型，后续再做合并/过期。
- 不要把它做成设置页调参器：核心入口必须留在错误发生现场。

## 两个真实用户场景

### 场景 1：Q3 planning 群里不再弹泛 AI 记忆

Esone 在 RingCentral 里和 Ada/Fred 讨论 Q3 planning，Lens 弹出一条 AI Tools 群里的 Codex 预算消息。它不是完全无关，但此刻没有同群、同人、同项目锚点。Esone 点卡片角落的 thumb-down icon，drawer 轻量打开，默认推荐 `泛 AI 词重合`。他点一下原因即可关闭。之后在 planning 场景里，泛 AI 消息只会在主动打开时以 `可能相关` 出现，不再自动红点打扰。

### 场景 2：空会议记录不污染会前提示

Meeting Pilot 记录了多条 `no decisions or action items` 的会议壳信息。过去它们可能因为时间新近或会议关键词进入召回。Esone 在一次空会议提示里点 `这是空会议/壳信息`，Trainer 生成 pattern patch：没有项目、票号、动作、风险、决定、依赖的会议记录不能自动弹。之后 Today Pilot 和 Memory Lens 都更安静。

## 最小实现建议

如果决定做，建议第一刀不要动排序模型，而是：

1. 复用 Memory Lens 卡片已有的 thumb-down icon，tooltip/aria label 标为 `不是这个意思`，不新增占宽按钮。
2. 后端新增 scene-aware feedback 表和 patch 表。
3. 先把 patch 应用在 `selectPrimaryContextRecallMatch()` 后处理和 `/context-recall` displayPriority 降级上。
4. 自动生成 `Context Recall Experience Eval` case。
5. 用 3 个真实失败样本证明 before/after。
