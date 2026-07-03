# Doubao Mobile Context Manual Receipt Plan

## 目标功能

- 随机抽中：`Mobile Context Thread`
- 所属能力：`Doubao Bridge`
- 主文档：`docs/features/doubao_bridge.md`
- 本轮聚焦：用户在 Desktop App 里手动推送近期重点或待办 / 通知后，点击后的即时结果也要像点击前卡片一样说明目标线程、package 类型和副作用边界。

## 现状核对

- `docs/features/index.md` 已把 `Mobile Context Thread` 指到 `docs/features/doubao_bridge.md`。
- 代码已在绑定手机对话卡片下方显示“推送前会发生什么”，说明近期重点、待办 / 通知、Quick Ask 有证据回答都会进入 `mobile_context_thread`，长期 persona / voice 不会混入。
- 缺口：点击手动推送后的成功 / 跳过即时文案仍较短，用户需要去最近同步流水才能确认本次到底是 `active_focus_digest`、待办完整摘要，还是没有发送占位。
- `docs/progressing/to-verify.md` 为“暂无。”。
- 本机 Reminders 可读，但不存在 `Personal AI` 列表；本轮没有 Reminder item 可纳入或完成。

## 外部参考

- OpenAI ChatGPT Memory controls: https://help.openai.com/en/articles/11146739-how-does-reference-saved-memories-work
- Anthropic Claude memory: https://www.anthropic.com/news/memory
- Google Gemini saved info: https://gemini.google.com/saved-info
- Digital reminder systems study: https://cs.stanford.edu/~merrie/papers/memory_imwut2017.pdf
- Place-Its location-based reminders: https://cseweb.ucsd.edu/~wgg/Abstracts/tsohn-placeits-ubicomp05-final.pdf

这些参考共同指向同一个产品原则：移动端上下文或提醒不应该只说“已同步 / 已跳过”，而要把可管理的记忆空间、触发条件、目标位置和未发生的副作用讲清楚。

## 改进计划

1. 在 `desktop-app/app/renderer.js` 新增手动推送结果回执 helper。
2. 为 `stable_memory`、`mobile_briefing`、`reminder_sync` 分别补充点击后边界文案。
3. 更新 `desktop-app/scripts/doubao-source-toggle-gating-check.mjs`，覆盖手机版对话已绑定时的近期重点成功和待办 / 通知跳过路径。
4. 更新 `docs/features/doubao_bridge.md`，只记录当前用户可见行为。
5. 验证：运行 `npm --prefix desktop-app run test:source-toggle-gating`、`npm start` 首次成功编译后停止、以及本轮文件的 `git diff --check`。
