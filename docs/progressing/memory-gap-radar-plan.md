# 新能力：Ask/Context Recall 上下文补齐与指代消解

> 生成日期：2026-05-19 CST  
> Scope correction：原 `Context Gap Radar` 不标记搁置，而是收敛为 Ask / Context Recall 的召回完整性改进。外发到豆包 / ChatGPT 前的 prompt enrichment 已移动到 [`docs/features/compose_assist.md`](../features/compose_assist.md) 的下一阶段。  
> Demo：[`memory-gap-radar-demo.html`](./memory-gap-radar-demo.html)  
> Codex 会话标题建议：新能力：Ask/Recall 上下文补齐

## 为什么要做

用户在真实工作里不会每次都贴完整 ticket、sheet、slide、thread 和会议摘要。尤其在 RingCentral / 会议 / Personal AI Ask 中，经常只会问：

- “AI VBG 的 BE 部分完成情况如何？”
- “那个 BE ready 了吗？”
- “刚才说的那个 backend 卡在哪？”

现有 Ask 已经比被动 recall 更强，但它主要依赖 query 本身解析和 ActiveRecall；`context-recall` 为了快，只走 vector + FTS。两者都缺一个共享的“当前上下文补齐 + 指代消解 + source anchor 发现”层，所以容易把 `BE` 当泛词，把 `AI`/`VBG` 召回到泛化内容，而不是最近项目讨论里的 backend pending work。

这项能力的价值是：让 Personal AI 在短问句里先恢复“用户脑子里的上下文”，再检索证据；不确定时明确说有多个候选，而不是假装知道。

## 产品定义

### 核心行为

- 对 Ask 和 Context Recall 共享一层 `RecallContextExpansionService`。
- 输入是用户 query、当前 surface、sourceContext/currentContext、visible messages、entity hints、source anchor hints。
- 输出是 expanded query、resolved project/entity、resolved role term、source anchors、ambiguity。
- `BE`、`FE`、backend、frontend、后端、前端等作为 role term 处理，不再只当普通关键词。
- “那个/这个/这块/刚才/ready 了吗”等短指代会触发当前上下文优先解析。
- 如果当前 RingCentral group 最近只有一个包含 `BE/backend + VBG` 的强项目，则把“那个 BE”解析成该项目 backend 状态。
- 如果多个项目都符合，Ask 返回候选歧义；Context Recall 不强弹误导性卡片。

### 存储与提取

需要补一层轻量的会话局部记忆，不保存完整 transcript，只保存可用于解析指代的锚点：

- `conversation_context_frames`
- surface/source type
- conversation/group/meeting/issue id
- dominant projects/entities/topics
- acronym aliases
- role terms，如 `backend`
- source anchors，如 Jira key、MR link、RingCentral source URL
- window start/end、confidence、updated_at

ingestion 在写入消息后更新 frame；recall 时优先读取当前 group/conversation/meeting frame，再回退到近期消息、watched projects 和 entities。

## 已落地实现

- 新增 migration：`027_conversation_context_frames.sql`。
- 新增 `RecallContextExpansionService`：
  - 从 context frame、近期消息、watched projects、entities 收集候选。
  - 识别 `BE/backend/后端` 等 role term。
  - 识别短指代 query，并基于当前 source/context 做解析。
  - 产生 expanded query、entity hints、source anchors 和 ambiguity debug。
- `IngestionPipeline` 在消息 ingest 后更新 conversation context frame。
- `ContextRecallService`：
  - 接受可选 `currentContext`。
  - 把 `sourceContext/currentContext` 当召回锚点，不再默认用 group/conversation id 排除同群记忆。
  - debug 中返回 `contextExpansion`。
- `/context-recall` schema 支持 `currentContext.visibleMessages` 和 `sourceAnchorHints`。
- `/ask` 在 ActiveRecall 前使用同一 expansion 服务扩写短 query，并把扩展信息放进 intent context。

## UX Demo

Demo 模拟 RingCentral 群里有人只说“那个 BE ready 了吗”。Personal AI 右侧面板展示：

- 识别到 `那个 BE` 是指当前群最近最强的 VBG backend 讨论。
- 解析出的项目：`RCV Working Team: Modernize Existing Backgrounds and Add AI-Generated VBGs`。
- 证据锚点：`RCV-148412`、`RCV-148411`、Ivan 的 backend pending work 消息。
- 如果出现多个 BE 候选，面板会进入 ambiguity 状态，让用户选择项目。

## 验证场景

- Unit：`AI VBG 的 BE 部分完成情况如何` 通过 watched project alias 扩写到 AI-generated VBG backend。
- Unit：RingCentral 当前 group 下的 `那个 BE ready 了吗` 解析到 VBG backend frame。
- Unit：两个 recent backend frame 同时符合时返回 ambiguity。
- API：`/context-recall` 带 `currentContext` 时，backend pending work 排在 VBG daily limit 等泛相关内容前。
- API：`/ask` 短问句优先返回 backend pending work 证据。

## 后续改进

- 把 source anchors 标准化为独立索引，避免只依赖 content 中的 Jira key/URL。
- 为 context frame 增加后台衰减和合并策略，防止长期群聊 frame 被旧项目污染。
- 在 Ask UI 中显式展示“我把那个 BE 理解为 xxx 的 backend”，并在歧义时给候选按钮。
- 在 Memory Lens / Context Recall UI 中对低置信解析使用“可能相关”，不使用强肯定标题。
- Web AI 外发 prompt enrichment 不在本能力继续扩展，统一交给 Compose Assist 后续阶段。
