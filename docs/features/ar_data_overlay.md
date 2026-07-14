# Personal AI AR Data

*最后更新: 2026-07-13*

## 概述

AR 数据是在网页上把 Personal AI 生成或沉淀的数据展示回具体位置的能力。它可以直接替换稳定 DOM 文本，也可以在图片、canvas 或不稳定元素上退回视觉 overlay。

它和 [Memory Lens](./memory_lens.md) 的边界不同：Memory Lens 只读地提示“这里和哪些记忆相关”；AR 数据会改写当前页面的展示结果。因此 AR 数据单独成文，不放进 Memory Lens 主文档。

## 关键逻辑

- 入口是 Chrome 右键菜单 `AR 数据`。用户在网页元素上右键后，content script 记录目标 DOM、selector、附近文本、旧值、URL pattern 和展示方式。
- 当前页存在 AR 元素时，页面顶部显示横向可拖动的 `AR | ON/OFF` 开关。它默认吸附在顶部、靠右但不贴边；拖动只改变横向位置。`OFF` 只还原当前页面会话里的 DOM 替换，不删除 binding、不暂停重复任务、不清空历史结果。
- 页面打开时先展示上一次 `lastResult`。如果该结果不是当天生成且 binding 有 `agentTaskPrompt`，页面会在保留历史值的同时发起一次后台刷新；当天已确认的结果不会因为重复打开而再次刷新。
- 如果展示的是历史结果，AR 标记会显示 `旧`；如果正在通过 Memory Service / OpenClaw 刷新，标记会显示 `刷新中`，并明确刷新完成前页面上的值还不是当前事实；失败时显示 `失败`，继续保留历史结果而不伪装成当前结果。
- 对 `.metric__num` 这类真实文本 DOM，优先直接替换文本节点，继承原页面字体、布局和 hover 行为。
- 对 `img`、`canvas`、`video`、`svg` 等目标，使用带 Personal AI 标识的 visual overlay 面板显示 `lastResult`，不改写原媒体、canvas 或 SVG 内容；overlay 内持续显示结果口径，如 `历史结果 · 今日未确认`、`刷新失败` 或 `今日结果`。
- 替换后的元素旁显示 `icon32.png` 小标记，用于编辑、本页会话隐藏或手动刷新。`×` 只隐藏当前页会话并恢复 DOM，不删除 binding、不暂停重复 AgentTask、不清历史结果；要取消重复执行必须进编辑器保存取消重复。
- 编辑已有重复 AR binding 时，弹窗会先说明保存后是更新重复任务、创建重复任务，还是只保存本地展示。取消已有重复执行时，必须先暂停对应 Scheduled Messages AgentTask 行并清空 `Agent_AR_Binding_ID`，成功后才会把本地 binding 改成本地-only。

## 数据边界

AR binding 需要保存这些关键字段：

- 页面锚点：`urlPattern`、`selector`、`tagName`
- 语义锚点：`sectionLabel`、`nearbyText`、`oldValue`
- 展示信息：`displayMode`、`lastResult.text`、`lastResult.updatedAt`
- Agent 关联：`agentTaskPrompt`、`notifyTemplate`、`linkedAgentTaskId`

v1 只按当前 URL/selector 精确应用。未来要支持任意网页相似文本匹配时，应复用 `sectionLabel / nearbyText / oldValue` 做语义锚点，但不能静默创建新 binding，也不能把旧结果当成当前页面事实。

## 与“帮我做”的关系

AR 数据可以独立存在，也可以绑定 [Scheduled Messages 的“帮我做 / AgentTask”](./scheduled_messages_manager.md)。

- 只有从 AR 入口创建并勾选“重复执行”的任务，才会创建 `Push_Method = AgentTask` 行并写入 `Agent_AR_Binding_ID`。
- 普通“帮我做”管理页创建的 AgentTask 不允许绑定 AR。
- 未勾选重复执行的 AR binding 只保存在 AR binding/result 中，不进入 Sheet 定时任务列表。
- 已经绑定重复任务的 AR binding 如果在编辑器里取消“重复执行”，会暂停原 AgentTask 行并保留历史记录；失败时不清本地 `linkedAgentTaskId`，避免页面显示已取消但后台仍继续执行。
- AgentTask 的执行账本、OpenClaw payload、artifact、失败和 Bot 通知以 memory-service 为准；AR 只负责页面展示缓存和锚点。
