# 真实体验官：Message Analysis

## Goal

以 RingCentral 消息分析用户的视角完成一次端到端体验；若发现可独立、安全修复的体验问题，先记录方案、再实现并按仓库最高可行等级验证。

## Plan

1. [completed] 阅读功能契约、现有验证器和工作区边界，定义真实用户场景。
2. [completed] 先用 webpage-mcp 检查已打开的 RingCentral 页面；使用本地扩展 E2E 复现完整流程。
3. [completed] 将发现写入 findings；本轮未发现能安全归因于该功能的体验缺陷，因此未做产品代码改动。
4. [completed] 已完成针对性检查、开发编译和两个 extension E2E；无功能文档变更需要写入。
5. [completed] 无待续验证项；已写回自动化记忆并完成交付。

## Scope boundaries

- 不触碰当前 `.planning/.active_plan` 指向的并行任务。
- 不改动已有的无关脏文件；任何修复只覆盖选定功能及其验证/文档。
- 不在未经确认的情况下发送 RingCentral 消息或写入外部系统。

## Validation

- `node --check tools/verify-message-analysis-rule-diagnostics-e2e.mjs`
- `node --check tools/verify-message-analysis-empty-export-e2e.mjs`
- `npm start`（首次 webpack 开发编译成功后停止）
- `node tools/verify-message-analysis-rule-diagnostics-e2e.mjs`
- `node tools/verify-message-analysis-empty-export-e2e.mjs`
- `git diff --check -- .planning/2026-07-16-automation-message-analysis-experience`
