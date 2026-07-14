# Storyline Target Switch Boundary

## 目标

随机扫到 `Storyline Draft 页面`。本轮只修补输出格式切换的实际控制点：顶部 segmented control 和 Inspector artifact 按钮。

## 外部参考

- Microsoft Teams Intelligent Recap / Copilot meeting recap：会议 AI 输出需要让用户在 recap 流里看到摘要、任务、转录和控制边界。
- Google Meet `Take notes for me`：AI notes 受 host controls、consent 和分享范围控制。
- PowerPoint Copilot speaker notes：生成 notes 后仍需用户 review 并选择 keep / discard。
- evidence-based text generation / attribution 研究：证据型生成应把 traceability、citation / attribution 和可验证性暴露给用户。
- DocuNarrator：AI 叙事结构生成仍要让人挑选和核对高信号片段。

## 改进计划

1. 在 `StorylineDraftPage.vue` 增加复用的 target switch boundary helper。
2. 给顶部输出格式按钮和 Inspector artifact 按钮加 `title` / `aria-label` / `aria-pressed`。
3. 文案说明切换只影响本页草稿与复制文本，会从 session cache 读取或请求 Draft API，并重置复核确认 / 复制状态 / 来源打开回执。
4. 已有剪贴板回执时，切换前提示会变成旧复制回执，交付前需要重新复制。
5. 更新 Storyline Draft E2E 和功能文档 / index。

## 非目标

- 不改 Draft API、LLM/fallback 生成、sessionStorage cache key、复制文本、Evidence key、source link safety、Memory Service 写入或外部平台写回。

## 验证

- `node --check tools/verify-storyline-draft-page-e2e.mjs`
- `npm --prefix memory-service test -- --run src/__tests__/api-storylines.test.ts`
- `npm start -- --progress`，首个 webpack dev compile 成功后停止
- `node tools/verify-storyline-draft-page-e2e.mjs`
- scoped `git diff --check`
