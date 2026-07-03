# Storyline Draft session cache receipt plan

## 目标功能

- 随机目标：`Storyline Draft 页面`
- 功能文档：`docs/features/memory_storyline_builder.md`
- 代码入口：`src/modals/components/StorylineDraftPage.vue`
- 验证入口：`tools/verify-storyline-draft-page-e2e.mjs`

## 当前观察

- `docs/progressing/to-verify.md` 暂无待校验事项。
- AppleScript 未列出 `Personal AI` Reminders；EventKit 能看到该列表，但 4 条均已完成，且都是 Doubao / digest / sync 历史反馈，不属于 Storyline Draft。
- 页面已经有生成范围回执、复制前复核清单、来源打开回执、复制回执和旧复制回执。
- 代码会用 `sessionStorage` 缓存同一 `source/prepId/target/audience` 的草稿，避免刷新反复打 LLM；但命中缓存时首屏仍主要展示服务端生成回执，用户不容易知道这次没有重新调用 Draft API，也没有重新核对当前 Memory Service / prep 状态。

## 外部参考

- Microsoft Teams recap 把 recording、transcript、files、notes、agenda 和 follow-up tasks 聚合在 Recap，并对 AI summary 的分享、敏感标签和访问权做限制；这支持 Storyline 继续把生成/复制/分享边界放在首屏。
- Google Meet "take notes for me" 会生成 Docs notes，但也强调 host controls、consent、组织分享设置、生成失败/不完整原因；这支持在复用旧生成物时说明当前没有重新捕获或重新生成。
- PowerPoint Copilot speaker notes 生成后需要用户 review 并选择 keep/discard；这支持 Storyline 保持人工复核和手动复制。
- 证据型文本生成综述强调 traceability / verifiability；这支持把缓存来源、证据引用数和未刷新边界明确显示。
- DocuNarrator / PaperTrail 等近期 HCI/生成研究继续指向一个方向：叙事生成需要高信号片段、来源和 provenance UI，而不是只给流畅文本。

## 实施计划

1. 在 `StorylineDraftPage.vue` 增加 session cache 命中状态。
   - 写入缓存时记录 `cachedAt`，读取时兼容旧 raw draft 缓存。
   - 命中缓存时显示 `会话缓存回执`，说明未重新调用 Draft API、未重新读取会前准备、未刷新证据、未同步 Memory Service、未确认可外发。
   - 强制重新生成、unsupported source、空入口和新 API 请求时清空该回执。

2. 扩展 E2E。
   - 先生成一个正常 draft 并写入 sessionStorage。
   - 在同一页面 reload 后断言命中缓存、没有再次请求 Draft API、页面显示缓存回执和非刷新边界。

3. 更新文档。
   - 在 `docs/features/memory_storyline_builder.md` 的 Draft 页面描述中补充 session cache 回执语义。

4. 验证。
   - `node --check tools/verify-storyline-draft-page-e2e.mjs`
   - `npm start -- --progress` 等首次成功编译后停止
   - `node tools/verify-storyline-draft-page-e2e.mjs`
   - scoped `git diff --check`
