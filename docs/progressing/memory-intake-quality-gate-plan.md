# 新能力：Memory Intake Quality Gate / 记忆录入质检台（搁置）

> 生成日期：2026-05-30 CST  
> 状态：搁置；当前 review-queue 形态与产品愿景不符，未改运行时代码  
> 建议 Codex 会话标题：`新能力：记忆录入质检台`  
> Demo：[`memory-intake-quality-gate-demo.html`](./memory-intake-quality-gate-demo.html)

## 搁置原因

该方案当前形态会把录入质量问题变成一个需要用户批量 review 的工作台，增加人的维护成本，和 Personal AI 的愿景不符。

Personal AI 的记忆系统应该像一个独立的人一样，有自己的内部反思、判断和巩固机制，不应要求主人逐条确认每条记忆是否要保留、合并或降权。只有对外发送、不可逆删除、跨隐私范围、写入稳定画像、代表用户执行动作等高责任边界才应该显式请求用户确认。

如果未来重新考虑本方向，应改成“内部自主反思 / 无感校准 / 可撤销 receipt”的机制，而不是独立 review queue。当前更适合把可复用思路并入 `memory_system.md` 的自主记忆原则、Ambient Calibration、Consolidation / Reflection / Dream Replay 等后台机制。

## 结论

这次没有从 Reminders 选题：本机 Reminders 当前可见列表里没有 `Personal AI` 清单，因此没有可随机选择的新功能 idea，也没有需要标记 done 的 Reminder item。

建议设计一个新能力：**Memory Intake Quality Gate / 记忆录入质检台**。

一句话：

> Personal AI 不只要“多记”，还要在记忆进入长期召回系统之前，自动识别低信息、重复、壳文本、错分来源和弱推断记忆，并给用户一个可解释、可批量处理、可回滚的录入质检入口。

它要解决的不是“搜索结果不相关之后怎么反馈”，而是更靠前的问题：

- Meeting Pilot 抓到 `Meeting Pilot is recording this meeting`、`暂无决议 / 暂无行动项` 这类低信息会议后，如果直接进召回，会污染后续 Ask、Memory Lens、Today Pilot。
- Jira / Google Docs / RingCentral 网页抓取经常带 UI 噪声、重复展开评论、导航文字、`Restore this version` 之类页面壳文本。
- 同一个问题反复被推断成多个近似 confirm request，例如 `那个 BE ready 了吗？` 相关状态更新被拆成多条待确认项。
- 用户真正想要的是：系统先把明显不值得自动召回的东西放到边缘，把可修复的信息压成高信号记忆，而不是等错误提示出现后再调参。

## 为什么值得做

Personal AI 的核心目标是保存用户和 AI、网页、会议、消息、操作、偏好、skill 等全部记忆，然后在聊天、会议、其他 AI 对话、Jira、RingCentral 等场景里给出关联提示。现在项目已经有大量输入源和多个消费面，下一步准确性的瓶颈不只是召回算法，而是**录入层的数据卫生**。

真实用户视角里，错误记忆有两类成本：

- **当下成本**：Memory Lens / Ask / Compose Assist 弹出错误或低价值记忆，用户不信任系统。
- **长期成本**：低信息、重复、页面壳文本被反复索引，后续任何 RAG / graph / reflection / Day Pilot 都要花 token、检索和注意力预算处理这些噪声。

`Memory Relevance Trainer` 处理的是“已经召回错了之后怎么校准”。`Memory Lifecycle Gardener` 处理的是“已有记忆随着时间怎么淡出”。本方案补的是入口：

> 一条新记忆进入长期系统时，先判断它是可直接使用、需要压缩修复、只保留原始证据、合并重复，还是默认不参与自动召回。

这会直接满足用户对 Personal AI 的核心需求：不是把所有东西堆在一起，而是在需要时拿出更准确、更少噪声、更有出处的记忆。

## 本次输入信号

### Reminders 检查

Apple Reminders 当前可见列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`。未发现 `Personal AI` 列表。

因此本方案来自项目目标、真实记忆查询、`docs/progressing` 去重和行业研究。

### 真实记忆信号

本轮 HTTP `10.32.56.212:3210` 短超时未返回，因此改用 SSH + SQLite 只读抽样 `esone.qiu` 用户数据。没有修改远端数据。

当前数据规模：

- `messages_raw`: 10085 条
- `chunks`: 7391 条
- `entities`: 13770 个
- `relationships`: 50210 条
- `reflection_threads`: 674 条
- `confirm_requests`: 158 条
- `source_memory_capsules`: 447 条
- `today_meeting_preps`: 75 条

观察到的质量信号：

- 近期 `messages_raw` 里有会议记录只包含 `Meeting Pilot is recording this meeting`、参与者列表、`暂无决议`、`暂无行动项`。
- 近期 Jira source memory 出现同一 `MTR-141911: [iOS]Use AI for Virtual Background Creation` 评论被多次保存，内容是 `Collapse comment / Expand comment / Esone's AI` 重复壳文本。
- Google Docs / Gemini / RingCentral 网页抓取有大量 UI 导航、历史版本、侧栏、base64 图片片段、页面 chrome 文本。
- `confirm_requests` 里多条 pending 项都围绕 `BE ready` / `BE status` 生成近似 property change，说明弱推断被拆成了多个用户待确认负担。
- 也存在有价值但过长、需要结构化压缩的记忆，例如 WhatsApp message types、Channel Adapter、Jira Story Points estimation、Q3 planning 等。

这说明真正的问题不是“没抓到”，而是抓到之后缺一个**录入质量分流层**：好材料要变成稳定 source memory，噪声要降低权重，重复要合并，弱推断要聚合成一条 review。

## 和现有 progressing / features 的边界

| 已有方向 | 解决什么 | 本方案边界 |
| --- | --- | --- |
| Memory Relevance Trainer | 用户遇到错误召回后，反馈“不是这个意思”并生成 relevance patch | 录入质检在记忆进入长期召回前处理噪声，减少未来错误召回的发生 |
| Ask/Recall Memory Context Match | 短问题和当前场景匹配，例如“那个 BE”指什么 | 录入质检减少短问题匹配时可选证据里的重复和弱来源 |
| Memory Lifecycle Gardener | 旧记忆随时间淡出、归档、遗忘 | 录入质检处理新进来的低质量或重复记忆，不是时间衰减系统 |
| Memory Coverage Map | 告诉用户哪些平台/来源覆盖不足，处理导入与备份 | 录入质检不解决“缺哪个来源”，只处理“这个来源进来的内容质量如何” |
| Memory Freshness Radar | 来源变化、资料变旧、需要重查 | 录入质检可以记录 source reliability，但不做外部更新监控 |
| Memory Reality Check（搁置） | 校验 AI 输出中的 claims 是否被证据支持 | 录入质检校验的是记忆条目的可用性，不校验一段 AI 输出 |
| Memory Trust Console（搁置） | 全局治理、可信中枢、安全和审计 | 录入质检是一个轻量工作台，重点是减少召回噪声 |
| Answer Memory Tracker | 管理用户反复追问问题的当前答案 | 录入质检为活答案提供更干净的证据池，但不维护答案状态 |
| Operation Memory Flight Recorder | 记录用户操作过程和可回放轨迹 | 录入质检可能处理操作记录的压缩质量，但不做操作回放 |

## 行业和研究参考

### 产品趋势

- [ChatGPT Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq) 已经把 memory 管理、top-of-mind、历史版本、Memory Sources 和相关/不相关反馈放进用户体验。Personal AI 的机会是把控制点前移到录入阶段，让用户看到“哪些东西不会进入自动召回”。
- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) 把 context 视为有限资源，强调选择高信号、最小必要信息。录入质检本质上是在长期记忆层做 context engineering。
- [NotebookLM sources](https://support.google.com/notebooklm/answer/16215270?hl=en) 明确 source 类型、限制、失效和同步规则，并鼓励用户选择具体 sources。Personal AI 的不同点是来源很多时候是自动捕获的，所以需要自动质量分流，而不是只靠用户导入时选择。
- [Granola AI-enhanced notes](https://docs.granola.ai/help-center/taking-notes/ai-enhanced-notes) 会用会议 transcript、用户 raw notes 和 calendar event 生成增强笔记，并让用户用放大镜查看某条笔记来自 transcript / raw notes 的位置。Personal AI 可以借鉴“增强摘要必须能回到原始证据”，但还要处理跨网页、Jira、AI chat 的噪声。
- [Mem0 controlling memory ingestion](https://docs.mem0.ai/cookbooks/essentials/controlling-memory-ingestion) 提到用 confidence threshold 过滤低质量抽取。Personal AI 需要在 confidence 之外增加用户可见的原因、批量动作和下游召回影响预览。

### 论文和专家方向

- [Chroma Context Rot](https://www.trychroma.com/research/context-rot) 的研究显示 distractors 会降低模型表现，甚至一个 distractor 也会让回答更差。这支持一个设计判断：低质量记忆不是“无害地多一点”，而是会吃掉未来上下文质量。
- [Retrieval-Augmented Generation with Estimation of Source Reliability](https://arxiv.org/abs/2410.22954) 指出标准 RAG 只看 query/document relevance 容易忽略来源可靠性，提出估计 source reliability 并优先使用可靠来源。录入质检应把 source reliability 作为一等字段。
- [Structure-Aware RAG: Structured Retrieval Augmented Generation from Noisy Data for Conversational Agents](https://arxiv.org/abs/2605.24366) 针对 noisy / irrelevant contexts，提出用结构化中间表示降低噪声、保留关键信息。录入质检里的“修复成可召回摘要 / table / takeaway”正是类似思想的产品化。
- [OCR Hinders RAG](https://arxiv.org/abs/2412.02592) 分析 OCR 语义噪声和格式噪声对 RAG 的级联影响。网页抓取、会议转写和 Google Docs 页面壳文本虽然不是 OCR，但同样会带来格式噪声和语义噪声。
- [DRAGIN](https://aclanthology.org/2024.acl-long.702/) 讨论检索增强在生成过程中引入无关或噪声数据会影响质量。Personal AI 不应等到生成阶段才处理噪声。

## 产品定义

### 功能名

**Memory Intake Quality Gate / 记忆录入质检台**

备选中文名：

- 记忆录入质检台
- 记忆入口诊所
- 记忆净化队列
- Recall Ready Gate

推荐使用 **记忆录入质检台**，因为它足够直白，用户能理解这是“进入长期记忆前的质量分流”，不是另一个搜索页。

### 目标用户

第一目标用户就是当前 Personal AI 用户：

- 每天在 RingCentral、Jira、Google Docs、会议、AI 对话和本地开发工具之间切换。
- 喜欢“凡事先让 AI 跑一遍”，但最后希望看到清晰证据和可控结果。
- 不想每天维护数据后台，但愿意偶尔批量确认系统建议。
- 对错误关联和低价值弹窗非常敏感。

### 核心承诺

1. **少污染**：低信息、重复、壳文本默认不进入自动召回高优先级。
2. **可修复**：不是直接丢弃噪声，而是能把有价值原文压成高信号摘要、takeaway、source memory。
3. **少打扰**：默认只在 Day Pilot 或 Memory Exploring 里批量处理，不每条弹窗打断。
4. **有解释**：每条质检建议必须说明原因、证据、预计影响和可撤销路径。
5. **不黑箱**：评分不是一个神秘分数，而是低信息、重复、来源、锚点、抽取置信度等原因的组合。

## 用户可见形态

### 1. Memory Exploring 新入口：录入质检

位置建议：

- `memory-exploring.html#/intake-quality`
- 侧边栏归在 `记忆系统` 或 `覆盖地图` 附近，但不要塞进 Coverage Map。

页面结构：

- 顶部摘要：`待处理`、`可自动合并`、`建议隔离`、`可修复为摘要`、`本周减少的召回噪声`
- 左侧列表：按风险/影响排序的待处理记忆批次
- 右侧详情：原始片段、为什么被判为噪声、推荐动作、召回影响预览、可回滚状态
- 批量操作：`应用推荐处理`、`仅保留原始证据`、`合并重复`、`修复成摘要`、`设为不自动召回`

### 2. Capture toast 轻提示

当网页、Jira、AI chat 或会议被保存时，如果质量分低于阈值：

- 不显示吓人的错误。
- toast 文案：`已暂存，质检后再进入自动召回`
- 操作：`查看`、`仍设为可召回`

这比“保存成功但之后乱召回”更诚实。

### 3. Day Pilot 的轻量 mission

只有当待处理项达到阈值才出现，例如：

> 录入质检：今天有 12 条低信息会议 / Jira 重复记忆，建议 1 分钟批量处理。

Day Pilot 不展示完整队列，只跳转到质检台。

### 4. Ask / Memory Lens 的隐藏解释

当某条记忆因为质检状态被降权或隐藏时，在调试/证据展开里可以看到：

> 此来源未进入自动召回：重复 Jira 评论，已合并到 `MTR-141911 变更摘要`。

这能避免用户以为系统“漏记”。

## 质量分类

### A. 可直接召回

特征：

- 来源明确，source URL / title / group / meeting id 完整。
- 有清晰实体、项目、决策、行动项、偏好、skill 或事实。
- 与现有记忆不是重复。
- 文本密度高，页面壳文本少。

默认动作：进入现有 messages / chunks / source memory / relationships 流程。

### B. 需要修复成高信号记忆

特征：

- 原文很长或噪声多，但里面有价值。
- 例如 WhatsApp product discussion 长线程、会议 transcript、Google Docs 需求说明。

默认动作：

- 保留原始证据。
- 生成结构化 `source_memory_takeaways`：
  - `facts`
  - `decisions`
  - `open_questions`
  - `people`
  - `projects`
  - `follow_up_conditions`
- 自动召回默认使用修复后的摘要，展开时可回到原文。

### C. 重复 / 近重复

特征：

- 同一 source fingerprint、同一 Jira comment、同一会议空摘要重复保存。
- embedding 高相似且 source/title/time 接近。

默认动作：

- 合并到一个 canonical memory。
- 保存 duplicate receipts，避免用户以为内容丢失。
- 只让 canonical 参与自动召回。

### D. 低信息 / 空壳

特征：

- `暂无决议`、`暂无行动项`、`Meeting Pilot is recording this meeting`。
- 只有参会者列表，没有可用讨论内容。
- Google Docs / Gemini / RingCentral 页面 chrome 文本占比高。

默认动作：

- 只保留原始证据或元数据。
- 不进入自动召回，除非用户打开对应日期/来源历史。
- 如果同一会议后续有 transcript 或 summary，再重新合并。

### E. 弱推断待确认

特征：

- 同一事实被生成多个近似 confirm request。
- 表达不同但本质相同，例如 `BE status` / `BE readiness` / `BE ready_status`。

默认动作：

- 聚合成一条确认卡。
- 展示候选值差异和来源。
- 用户一次确认后，关闭同一 dedupe group。

### F. 来源异常 / 风险来源

特征：

- source_type 空白或不在已知 source types。
- URL / title / group_id 缺失。
- 来自自动测试、fixture、内部调试或 malformed import。

默认动作：

- 标记为 `needs_source_repair`。
- 不提升到高优先级召回。
- 给导入/捕获链路打 telemetry，方便后续修 bug。

## 评分模型

不要对用户暴露一个孤立“质量分”。页面显示状态和原因，后台可以计算 `recall_readiness_score`。

建议字段：

```ts
interface MemoryIntakeQualityItem {
  id: string;
  userId: string;
  sourceObjectType:
    | 'message'
    | 'chunk'
    | 'source_memory_capsule'
    | 'meeting_prep'
    | 'confirm_request'
    | 'import_batch';
  sourceObjectId: string;
  sourceType: string;
  sourceTitle?: string;
  sourceUrl?: string;
  groupId?: string;
  groupName?: string;
  capturedAt: number;
  status:
    | 'ready'
    | 'needs_repair'
    | 'duplicate'
    | 'low_information'
    | 'weak_inference'
    | 'source_repair_needed'
    | 'quarantined'
    | 'resolved';
  recommendedAction:
    | 'keep'
    | 'merge'
    | 'repair_summary'
    | 'quarantine_auto_recall'
    | 'dedupe_confirm_request'
    | 'source_repair'
    | 'ask_user';
  recallReadinessScore: number;
  reasons: IntakeQualityReason[];
  duplicateGroupId?: string;
  canonicalMemoryId?: string;
  repairPreview?: IntakeRepairPreview;
  downstreamImpact: {
    autoRecallPriorityBefore: 'high' | 'normal' | 'low' | 'hidden';
    autoRecallPriorityAfter: 'high' | 'normal' | 'low' | 'hidden';
    affectedSurfaces: Array<'ask' | 'memory_lens' | 'today_pilot' | 'compose_assist' | 'search'>;
    estimatedNoiseReduction?: string;
  };
  createdAt: number;
  updatedAt: number;
}

interface IntakeQualityReason {
  code:
    | 'empty_meeting'
    | 'no_action_or_decision'
    | 'duplicate_source_fingerprint'
    | 'raw_ui_chrome'
    | 'low_text_density'
    | 'missing_source_anchor'
    | 'weak_property_inference'
    | 'valuable_but_unstructured'
    | 'high_source_reliability';
  severity: 'info' | 'warning' | 'blocker';
  evidence: string;
}
```

后台评分建议：

| 因子 | 权重 | 说明 |
| --- | ---: | --- |
| 信息密度 | 25% | 决策、行动项、事实、实体、问题、偏好等有效信号占比 |
| 重复风险 | 20% | source fingerprint、near duplicate、same title/time/group |
| 来源锚点完整度 | 15% | source_type、URL、title、group、meeting id、sender |
| 页面壳文本比例 | 15% | 导航、按钮、重复展开、base64、空会议模板 |
| 抽取置信度 | 15% | LLM / parser 对 takeaway、entity、property 的 confidence |
| 用户历史反馈 | 10% | 用户是否曾把同来源设为可信、仅原始证据、永不自动召回 |

## 核心体验

### Flow A：空会议不污染 Memory Lens

1. Meeting Pilot 保存一条会议记忆，内容只有 `Meeting Pilot is recording this meeting`、参会者和 `暂无决议 / 暂无行动项`。
2. 录入质检把它标为 `low_information`。
3. 系统保留会议元数据和参会者，不让这条进入自动 Memory Lens。
4. 如果用户后续打开当天会议历史，仍能看到原始记录。
5. 如果稍后 transcript / real summary 到达，质检台把空记录合并到真实会议记忆。

用户感受：

> “它没有假装那场会有内容，也不会因为我打开 RingCentral Video 就弹出一条空记忆。”

### Flow B：Jira 重复评论自动合并

1. 网页保存多条同一 Jira ticket 的评论片段。
2. 文本里充满 `Collapse comment`、`Expand comment`、重复用户签名和相同 `Esone's AI` 内容。
3. 录入质检把它们合成一个 duplicate group。
4. 推荐生成一条 canonical source memory：`MTR-141911 上 AI 自动补充 Story Point / Team / Component / Vertical Track 的评论记录`。
5. 后续搜索 Jira ticket 时只返回 canonical memory，证据里可展开看到重复来源。

用户感受：

> “我仍然知道这几条 Jira 操作发生过，但 Ask 不会拿 5 条重复评论当作 5 个证据。”

### Flow C：有价值长线程被修复为可召回摘要

1. RingCentral 长线程里包含 WhatsApp message type scope、David / Barry 的产品意见。
2. 原文很长，混有 UI 文本和群组 metadata。
3. 录入质检不隔离它，而是标为 `valuable_but_unstructured`。
4. 用户点 `修复成摘要`，预览生成：
   - P0 message types
   - P1 message types
   - David 的明确观点
   - Barry 的待确认点
   - 后续触发条件
5. 自动召回优先使用这条结构化摘要，展开证据时回到原 RingCentral source。

用户感受：

> “它不是粗暴删噪声，而是把能用的信息变成以后真的找得到的记忆。”

### Flow D：重复确认请求聚合

1. 用户多次问 `那个 BE ready 了吗？`。
2. 系统生成多条 pending confirm request，都是 `BE status` 的近似变化。
3. 录入质检识别同一 dedupe group：同一 topic、property、query anchor、时间窗口。
4. 页面把它们合并成一张确认卡：
   - 当前旧值
   - 候选新值列表
   - 每个候选的来源
   - 推荐保留值
5. 用户确认一次，其他重复 request 自动 resolved with receipt。

用户感受：

> “我不用回答十次同一个问题，系统知道这些其实是一件事。”

## 信息架构

### 页面分区

1. **质检摘要**
   - 今日新增
   - 待处理
   - 推荐自动处理
   - 已减少噪声
2. **队列**
   - 筛选：全部、低信息、重复、可修复、弱推断、来源异常
   - 排序：影响最大、最新、来源、推荐动作
3. **详情**
   - 原始内容片段
   - 质量原因
   - 推荐动作
   - 修复预览 / 合并预览
   - 影响预览
4. **规则**
   - source-specific rules，例如 Meeting、Jira、Google Docs、RingCentral、AI chat
   - 用户偏好：哪些来源可以自动合并、哪些必须人工确认
5. **审计与撤销**
   - 最近处理
   - 变更 receipt
   - 一键撤销

### 页面不是告警墙

设计重点是“少而可批量处理”：

- 默认只展示高影响 top 20。
- 同类项聚合成 batch，不让用户逐条看 100 条。
- 默认推荐动作可一键应用，但所有自动降权/合并都必须有 receipt。
- 页面顶部不使用红色危机感，避免把数据卫生做成焦虑工具。

## 后端设计

### 新表建议

```sql
CREATE TABLE memory_intake_quality_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_object_type TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_title TEXT,
  source_url TEXT,
  group_id TEXT,
  group_name TEXT,
  captured_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  recall_readiness_score REAL NOT NULL,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  duplicate_group_id TEXT,
  canonical_memory_id TEXT,
  repair_preview_json TEXT,
  downstream_impact_json TEXT NOT NULL DEFAULT '{}',
  decision_state TEXT NOT NULL DEFAULT 'pending',
  decided_action TEXT,
  decided_by TEXT,
  decided_at INTEGER,
  receipt_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_intake_quality_user_state
  ON memory_intake_quality_items(user_id, decision_state, updated_at DESC);

CREATE INDEX idx_intake_quality_source
  ON memory_intake_quality_items(user_id, source_object_type, source_object_id);
```

```sql
CREATE TABLE memory_intake_quality_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  rule_code TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  action TEXT NOT NULL,
  threshold REAL,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, source_type, rule_code)
);
```

```sql
CREATE TABLE memory_intake_quality_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  quality_item_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  actor TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

### 接入点

- Ingest pipeline 写入 `messages_raw` / `source_memory_capsules` 后，同步或异步调用 `MemoryIntakeQualityService.analyze`.
- Meeting Pilot 保存会议后，先跑 meeting-specific heuristics。
- Smart import / external AI import 走 batch 质检。
- Confirm request 创建前调用 dedupe group 检查。
- RecallEngine / ContextRecallService 查询时读取 quality state：
  - `ready` 正常参与；
  - `needs_repair` 降权；
  - `duplicate` 默认指向 canonical；
  - `quarantined` 不参与自动召回，但保留搜索 / 历史查看。

### API 草案

```http
GET /api/v1/intake-quality/summary
GET /api/v1/intake-quality/items?state=pending&type=duplicate&limit=20
GET /api/v1/intake-quality/items/:id
POST /api/v1/intake-quality/items/:id/preview-action
POST /api/v1/intake-quality/items/:id/apply-action
POST /api/v1/intake-quality/batch/apply-recommended
POST /api/v1/intake-quality/events/:id/undo
GET /api/v1/intake-quality/rules
PATCH /api/v1/intake-quality/rules/:id
```

### 与现有服务的关系

- `SmartMemoryImportService`：导入时可输出 `source_repair_needed`、`low_information`、`duplicate`。
- `SourceMemoryService`：修复摘要和 canonical source memory 应在这里落地。
- `ConfirmRequestService`：新建前查 dedupe group，避免重复 BE ready 确认项。
- `RecallEngine`：读取 quality state 作为召回 gating / boost / penalty。
- `DayPilotService`：只在待处理量和影响足够高时生成 mission。
- `MemoryFeedbackEvent`：用户处理动作也写入反馈事件，后续 relevance eval 可复用。

## 前端设计

### 视觉方向

这是运营工具，不是营销页。设计应当：

- 密集但不拥挤。
- 用状态、原因、影响预览建立信任。
- 颜色克制：灰白基底 + teal / amber / red 做语义色，不做大面积渐变。
- 保留真实原文片段，让用户能判断系统是否误判。
- 桌面优先，但移动端可完成批量处理和单条确认。

### 核心组件

- `IntakeQualityPage.vue`
- `IntakeQualitySummaryStrip.vue`
- `IntakeQualityQueue.vue`
- `IntakeQualityDetailPanel.vue`
- `QualityReasonList.vue`
- `RepairPreviewCard.vue`
- `DownstreamImpactPreview.vue`
- `IntakeRulePanel.vue`
- `UndoReceiptToast.vue`

### 推荐交互细节

- 左侧 queue item 不只写标题，要写 `原因 + 推荐动作 + 影响面`。
- 详情页默认展示原始片段和“系统建议”，不先展示算法分。
- `应用推荐处理` 需要显示本次会影响多少条：
  - `自动召回隐藏 8 条`
  - `合并重复 5 条`
  - `生成可召回摘要 2 条`
- 对弱推断 confirm request，动作文案不要写 `删除`，写 `合并为一条确认`。
- 对低信息会议，动作文案不要写 `忘记`，写 `仅保留原始记录`。

## 实施计划

### P0：只读分析 + 页面原型

目标：先让用户看到“哪些记忆会污染召回”。

- 新增 backend service：扫描最近 N 天 messages / source capsules / confirm requests。
- 只写 `memory_intake_quality_items`，不改变 recall 行为。
- 前端新增 `/intake-quality` 页面，展示 pending items。
- 支持单条 `标记为已知 / 忽略本次建议`。
- 不做自动合并，不做召回 gating。

验证：

- 针对真实样本写 fixture：
  - 空会议
  - 重复 Jira comment
  - Google Docs UI chrome
  - WhatsApp product discussion 长线程
  - 重复 BE ready confirm request
- 单元测试 `MemoryIntakeQualityService` 分类结果。
- Playwright 验证页面可筛选、展开、查看原因。

### P1：安全动作闭环

目标：让用户能处理最确定的低风险问题。

- `duplicate` 支持 canonical 合并。
- `low_information` 支持仅保留原始证据、不参与自动召回。
- `weak_inference` 支持 confirm request dedupe。
- 所有动作写 receipt，可撤销。
- RecallEngine 开始读取 quality state，但只对 `duplicate` / `quarantined` 生效。

验证：

- API tests 覆盖 apply / undo。
- 召回 fixture 验证 duplicate 不再多次返回。
- `npm start` 首次编译。
- Extension E2E 打开 `/intake-quality`，执行合并并撤销。

### P2：修复成高信号记忆

目标：不是只降噪，也把有价值长文本变成更好的记忆。

- `repair_summary` 生成 structured takeaways。
- 支持用户预览、编辑标题和关键 bullet。
- 原始证据与修复摘要建立 lineage。
- Search / Ask / Memory Lens 优先使用 repaired summary。

验证：

- 针对长 RingCentral / Google Docs fixture 跑 deterministic repair。
- 新增 experience eval：repair 后是否保留关键事实、去掉壳文本、证据可回链。

### P3：后台自动质检与体验 eval

目标：把质检变成系统默认卫生层。

- ingest 后异步自动分析。
- 周期性聚合 top issues。
- Day Pilot 只推高影响质检 mission。
- 与 `Context Recall Experience Eval` 联动，比较质检前后错误召回率。

验证：

- `evals/cases/memory-intake-quality/`
- `evals/workflows/memory-intake-quality/experience.md`
- `npm run eval:validate`
- `npm run eval:run -- --suite memory-intake-quality --no-repair`

## 数据与隐私

- 质检台不把原始私有记忆发给第三方服务；若后续用 LLM 修复摘要，必须走现有 Memory Service provider boundary。
- 所有自动动作默认可撤销。
- `quarantine_auto_recall` 不等于删除；用户仍可在原始历史或精确搜索中找到。
- 低质量原因和动作 receipt 应属于用户自己的 memory space，遵守 `X-User-Id` 隔离。
- 对 restricted Jira comment / private RingCentral thread 只显示必要片段，保留 privacy label。

## 风险与取舍

### 风险 1：误把有价值信息隔离

缓解：

- P0 只读，不改变召回。
- P1 只自动处理高置信 duplicate / empty meeting。
- 所有动作可撤销。
- `valuable_but_unstructured` 默认修复，不默认隔离。

### 风险 2：又增加一个用户要维护的后台

缓解：

- 默认聚合 batch，而不是逐条待办。
- Day Pilot 只在高影响时提醒。
- 页面主操作是 `应用推荐处理`，不是手工审每条。

### 风险 3：和 Lifecycle / Trainer 重叠

缓解：

- 明确入口质检只处理录入质量。
- Trainer 仍处理现场错误召回反馈。
- Lifecycle 仍处理随时间淡出和长期保留。

### 风险 4：评分黑箱

缓解：

- 页面展示原因、原文证据、推荐动作和影响，不把质量分作为主 UI。
- 规则可查看、可关闭。

## 成功指标

体验指标：

- Memory Lens / Ask 中低信息会议和重复 Jira 证据出现率下降。
- 用户打开 `/intake-quality` 后 1 分钟内能处理多数推荐项。
- 用户撤销率低于 10%，说明推荐动作基本可信。

系统指标：

- duplicate group canonical 命中率。
- low_information items 自动召回参与率下降。
- confirm_requests dedupe 后 pending 数下降。
- repaired summary 的 recall click-through / positive feedback 高于原始长文本。

评估指标：

- 固定体验 eval 中，质检后 top-k evidence 的有效性上升。
- noisy fixture 中，空会议 / 页面壳文本不再进入自动 Memory Lens。
- valuable fixture 中，结构化摘要保留关键事实和可回链证据。

## 真实用户场景

### 场景一：会后第二天问“昨天那个会说了什么？”

用户打开 Ask 问：

> 昨天 Review JVD + Webinar 近期计划里面有什么 action？

如果那场会只有空记录，Personal AI 不会编造 action，也不会拿 `Meeting Pilot is recording this meeting` 当证据。它会说：

> 我只有会议元数据，没有可靠讨论内容；这条记录已被标为低信息。你可以查看原始会议记录，或等 transcript / summary 同步后再问。

这比返回一个虚假的会议摘要更可信。

### 场景二：在 Jira 里查 AI 自动补字段历史

用户打开 `MTR-141911`，想知道之前 AI 对这个 ticket 做过什么。

没有质检台时，系统可能返回多条重复 `Collapse comment / Expand comment` 片段。启用后，Memory Lens 只展示一条合并后的记忆：

> 这个 ticket 曾由 Esone's AI 自动补 Story Point、Team、Component、Vertical Track；原始 Jira 评论共 4 条，已合并。

用户点开仍能看到原评论，但默认上下文更干净。

### 场景三：把 WhatsApp 产品讨论交给另一个 AI 继续分析

用户在 ChatGPT / Codex 输入框准备问：

> 按 David 和 Barry 的意见，WhatsApp message types P0/P1 怎么切？

Context Assist 不直接塞入一整屏 RingCentral 原文，而是插入质检修复后的结构化摘要：P0 types、P1 types、David 明确要求、Barry 待确认点、来源链接。这样用户不用重新解释，也不会把页面壳文本带给外部 AI。

## Demo 说明

Demo 文件：[`memory-intake-quality-gate-demo.html`](./memory-intake-quality-gate-demo.html)

Demo 模拟 `memory-exploring.html#/intake-quality` 页面：

- 左侧是 Personal AI Memory Exploring 导航。
- 主区展示录入质检摘要、筛选队列和详情面板。
- 样本包含真实抽样信号：空会议、重复 Jira comment、WhatsApp 长线程、BE ready 重复确认、Google Docs 页面壳文本。
- 可以切换筛选、选择队列项、应用推荐动作，查看“召回影响预览”变化。

## 决策建议

建议优先级：**高，但应从 P0/P1 小步开始**。

原因：

- 它直接服务当前最高优先级：准确性、相关性和噪声控制。
- 它复用现有数据源，不要求新连接器。
- 它能给 Memory Lens、Ask、Compose Assist、Day Pilot 同时减噪。
- 它不会变成泛安全平台或多 AI 调度器，仍然是 Personal AI 记忆系统的核心能力。

不建议一开始做全自动“净化”。正确路线是：

1. 先只读展示；
2. 再处理高置信重复和空记录；
3. 最后才让修复摘要进入自动召回优先级。
