# Storyline Draft 重新生成请求回执

## 选择

- 来源：`docs/index.md` 随机抽样后选择 `Storyline Draft 页面`。
- 避开：最近自动化刚做过的 Meeting History、Relationship Radar、Project Dashboard、Message Analysis、Compose Assist、Jira、Task Scheduler、Doubao、Topic 等目标。
- 文档：`docs/features/memory_storyline_builder.md` 描述仍匹配当前 Draft API / Draft 页面主流程。
- Reminder：AppleScript 未列出 `Personal AI`；EventKit 找到 4 条，全部已完成且都是 Doubao / digest / sync 历史反馈，与 Storyline Draft 无关，本轮不标记 Reminder。

## 外部参考

- Microsoft Teams intelligent recap：会后 recap 以 notes、tasks、highlights 形式呈现，支持把生成结果和后续动作放在可复核的 recap 面里。
- Google Meet Take notes for me：AI notes 会组织成 Google Doc 并受分享/保留策略影响，支持 Storyline 保持输出归属和手动复制边界。
- Zoom AI Companion Meeting Summary：summary 由 host 启动，可能在会后分享，支持在生成/分享之间暴露权限和分享边界。
- Evidence-based text generation survey：证据型生成强调 traceability / verifiability，支持 Storyline 在生成、缓存、复制、重新生成时持续展示证据和非写入边界。

## 改进计划

1. 在用户点击 `重新生成` 后立即显示 pending 回执。
2. 回执说明这次只清除本页 session 缓存并重新请求 Draft API。
3. 明确不会写回 Slides / Docs / RingCentral、不会发送消息、不会保存长期 Storyline 历史，也不会沿用上一轮复核确认或复制回执。
4. 初次加载、缓存命中、切换来源/格式、成功和失败状态都清掉 pending 回执，避免旧状态残留。
5. 更新 Storyline Draft E2E 覆盖重新生成请求期间的可见状态。
6. 更新主功能文档，不新增功能索引行。

## 验证

- `node --check tools/verify-storyline-draft-page-e2e.mjs`
- `npm start -- --progress` 首次成功编译后停止
- `node tools/verify-storyline-draft-page-e2e.mjs`
- scoped `git diff --check`
