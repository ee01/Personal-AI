# 手动关注项规则保存前运行路径预览

## 目标

随机目标：`docs/features/index.md` 中的 `Message Analysis / 手动关注项规则`。

用户在新建或编辑记忆入口规则时，页面已经展示范围、安全、分发和副作用边界，但缺少一条完整的人话运行路径：保存后是自动观察后续新消息，还是只保存本机配置；历史消息是否会回扫；命中后哪些能力只是入队或等待后续确认。

## 外部参考

- Slack keyword workflow 把 message trigger、channels、keyword conditions 和 publish 后触发拆开，说明规则保存和真正消息触发是两件事。
- Zapier Filters/Paths 明确条件只决定后续步骤是否继续运行，用户需要在规则编辑时看见条件和动作边界。
- Gmail filters 的心智是先定义匹配条件，再选择自动处理动作；适合借鉴保存前的“匹配 -> 处理”路径。
- Trigger-action programming 研究指出用户容易混淆 event/state trigger 与 action timing；这里应显式区分保存、后台捕获、手动立即分析、未来命中和外部执行。

## 改进计划

1. 在 `topic-rule-safety` 增加保存前运行路径派生函数，复用现有分发/副作用判断，不新增后端状态。
2. 在新建和编辑手动规则表单中展示 `保存前运行路径`，覆盖后台采集开关、匹配过程、命中后分发和非效果边界。
3. 更新 Message Analysis E2E，断言新建规则和编辑规则都能看到这条路径。
4. 更新 `docs/features/message_analysis.md`，把文档同步为当前 UI 行为。
5. 验证：运行 topic-rule-safety focused test、`npm start` 首次编译、Message Analysis E2E、路径限定 `git diff --check`。

## Reminder

本机 Reminders 中未找到 `Personal AI` 列表；本轮没有 Reminder 条目可关联或标记完成。
