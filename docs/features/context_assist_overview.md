# Context Assist / 情境助理功能说明

_最后更新: 2026-05-08_

## 功能定位

`Context Assist / 情境助理` 是 Personal AI 的场景化记忆提示能力。

它把原来的 **会前准备** 和 **Memory Composer Guard / 写作护航** 合并成一个功能：当用户准备开会、回复消息、写 Jira comment、给 ChatGPT/Claude/豆包等 AI 写 prompt 时，Personal AI 会根据当前场景自动召回相关记忆，给出低打扰、可追溯、可确认使用的提示。

一句话：

> 在用户真正要沟通或行动之前，把 Personal AI 里有用的记忆放到手边。

## 为什么需要

Personal AI 保存了用户的消息、会议、网页、Jira、AI 对话、用户偏好和项目上下文。但真实工作里，用户往往不是主动搜索记忆，而是在这些时刻突然需要记忆：

- 会议开始前几分钟，需要快速恢复项目状态。
- daily / weekly sync 里需要同步某个依赖进展，但会议 agenda 里没有写。
- 回复 RingCentral 消息时，容易漏掉历史承诺、owner、风险或 follow-up。
- 写 Jira comment 时，需要补上证据、范围、时间点和责任人。
- 给其他 AI 写 prompt 时，需要带入 Personal AI 的上下文，但不能把全部私密记忆直接粘过去。

所以这个功能不是“再做一个搜索页”，而是让记忆在用户当前工作流里自然出现。

## 包含两个主要场景

### 1. 会前准备

入口：

- RingCentral Video Home：`https://app.ringcentral.com/video/home/`

展示位置：

- 选中会议后，在右侧会议详情区域下方注入 `Personal AI 会前准备` 卡片。

它会做什么：

- 读取当前 upcoming meeting。
- 同步轻量日历元数据到 Memory Service。
- 根据会议标题、参会人、描述、用户补充的会议目标召回相关记忆。
- 展示会前 cue cards，例如：
  - 最近相关讨论。
  - 可能要同步的依赖进展。
  - 未关闭的 action / owner。
  - 需要确认的问题。
  - 证据来源。
- 用户可以把 brief 发送给 Meeting Pilot，供会中提示继续使用。

日历来源：

- 优先支持 Outlook Calendar 授权。
- 没授权 Outlook 时，使用 RingCentral 本地 IndexedDB `Calendar/event2` 作为 fallback。

如果没有 upcoming meeting 或本地没有会议数据，页面不会显示有内容的会前建议；最多显示空状态。只有会议数据和 Personal AI 记忆能匹配时，才会生成有价值的 cue cards。

### 2. 写作护航

入口：

- RingCentral message composer。
- RingCentral thread reply composer。
- Jira issue comment。
- ChatGPT / Claude / Gemini / 豆包等 Web Agent prompt 输入框。
- 后续可扩展到 Gmail、Google Docs、更多网页输入框。

展示方式：

- 输入框旁边出现一个 Personal AI chip。
- 用户点击 chip 后，可以插入建议上下文。
- Personal AI 不会自动发送消息，也不会替用户点击发送。

它会提醒什么：

- 这段回复是否漏掉历史事实。
- 是否有之前承诺过的 follow-up。
- 是否需要补 owner、deadline、scope、证据。
- 是否有敏感或未确认记忆，不适合直接交给外部 AI。
- 给其他 AI 的 prompt 是否需要一个更安全、精简的 context pack。

## 设计原则

- **低打扰**：只在会议详情页或真实输入框附近出现。
- **用户确认**：建议可以插入，但不自动发送。
- **证据可追溯**：每条建议都应能看到来源记忆。
- **隐私优先**：静默同步日历时只保存轻量 metadata 和 preview，不上传完整 HTML body。
- **复用已有召回**：不另做一套 recall 引擎，统一复用 `/context-recall` 和 `/recall`。
- **同一个底座**：会前准备和写作护航都走 `/context-assist` 这一层做场景编排。

## 当前实现边界

- 第一阶段重点实现 RingCentral Video Home 的会前准备。
- Composer Guard 保持现有真实输入框 chip 能力，并纳入 Context Assist 的统一后端编排。
- Outlook Calendar 需要用户在 Options 中授权。
- 未授权 Outlook 时依赖 RingCentral 页面本地 IndexedDB 是否已有会议数据。
- 深度语音演练、完整 role play、自动生成会议策略暂不做，只作为后续扩展方向。

## 和其他功能的关系

- `Meeting Pilot`：会前准备可以把 brief handoff 给 Meeting Pilot，会中继续展示相关提示。
- `webpage_memory_detection`：负责网页 ambient 记忆提示；Context Assist 负责“行动前”的场景化提示。
- `Memory Composer Guard`：已合并为 Context Assist 的“写作护航”场景。
- `Memory Rehearsal Studio`：不作为独立 MVP 推进，其核心价值收敛到会前准备和后续演练扩展。

## 详细实现文档

实现细节、API、数据同步和测试说明见：

- [`context_assist.md`](./context_assist.md)
