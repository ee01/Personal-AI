---
description: Google Slides 项目分析器
globs:
alwaysApply: false
---

# Google Slides 项目分析器

最后更新: 2026-04-30

## 功能概述

Google Slides 项目分析器用于在 Google Slides 页面中识别项目表格或项目列表，抽取项目/Jira 工单、状态、负责人、赛道和备注信息，并结合 Jira 与历史上下文生成可人工确认的更新建议。

当前入口：

- Google Slides 页面内容脚本会在工具栏添加 `分析项目` 按钮。
- 扩展 popup 在 Google Slides 页面打开时显示 `分析 Slide 项目信息并更新`。
- 分析结果在 `slides-analysis.html` 中展示，用户勾选后才会写回幻灯片。

## 当前能力

- 读取当前 Google Slides 演示文稿，并优先分析当前 slide。
- 支持表格型、文本/列表型内容；低置信或复杂结构可使用 LLM fallback。
- 自动提取 Jira key，并查询 Jira 状态、负责人、优先级和截止日期等上下文。
- 生成状态、负责人、赛道、备注的更新建议，并展示置信度、关键发现和风险统计。
- 只对用户勾选的字段调用 Google Slides `batchUpdate` 写回，避免自动覆盖 slide 内容。

## 用户体验原则

- AI 只生成草稿建议，最终是否写回由用户确认。
- 高置信建议可以默认选中，低置信建议需要用户主动审阅。
- 结果页优先展示“哪些项目要更新、为什么更新、来源是什么”，避免要求用户在 Jira、聊天记录和 Slides 间反复切换。
- OAuth token 由 Google Slides 页面侧保管，不传入结果页；窗口通信需要校验来源。

## 主要代码位置

- `src/contentScriptGoogleSlide.tsx`：页面按钮、分析流程、结果页通信、应用更新。
- `src/slide.ts`：Google Slides API 读取和写回。
- `src/analyzers/`：表格、文本和 LLM 内容分析器。
- `src/modals/slides-analysis.tsx`：分析结果页和人工确认界面。
- `src/utils/slidesAnalyzerSuggestions.ts`：Jira key 提取和建议文本归一化。

## 注意事项

- 写回 Slides 会修改原始文档，需要用户具备对应演示文稿权限。
- Google Slides `batchUpdate` 是批量原子请求；任一请求无效会导致整批失败。
- 对 visually rich 或非标准布局的 slide，必须保留字段定位、置信度和人工确认，不能把 LLM 结果直接视为事实。
- 若扩展窗口通信失败，重新从 Google Slides 页面触发分析即可。
