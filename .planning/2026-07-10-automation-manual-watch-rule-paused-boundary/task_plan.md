# 手动关注项规则暂停边界改进计划

## Goal

从 `docs/index.md` 随机样本中选定 `手动关注项规则`，核对文档和代码，结合 Reminder 与外部参考，做一个不需要额外用户决策的 UX/边界改进，并按 repo 验证规则闭环。

## Scope

- Feature: `手动关注项规则`
- Capability: Message Analysis
- Source doc: `docs/features/message_analysis.md`
- Expected behavior family: 用户可编辑关注规则；采集暂停时要说明仅本机保存，不自动捕获后续消息。

## Plan

1. [complete] 建立本轮计划，确认 Reminder / to-verify / automation memory 状态。
2. [complete] 阅读 feature doc、相关 Message Analysis 源码与现有 verifier/E2E。
3. [complete] 检索类似产品与研究，提炼到一个具体 UX 改进。
4. [complete] 实现代码、验证脚本和 `docs/features` / index 的同步更新。
5. [complete] 运行目标 verifier、`npm start` 首次成功编译、E2E 和 scoped `git diff --check`。
6. [complete] 更新 automation memory，记录 Reminder 处理结果和验证证据。

## Reminder State

- AppleScript lists did not expose `Personal AI`.
- EventKit found `Personal AI` with 4 total items and 0 incomplete items.
- No Reminder item will be marked done unless a related incomplete item appears later in this run.

## Validation Target

- Prefer existing Message Analysis verifier/E2E scripts from `package.json` or `tools/`.
- Runtime source changes require `npm start` until first successful compile, then stop.
- Use scoped `git diff --check` for files owned by this run because the repo already has broad unrelated dirty state.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| AppleScript did not list `Personal AI` | Reminder list lookup | EventKit fallback found the list and confirmed 0 incomplete items |
