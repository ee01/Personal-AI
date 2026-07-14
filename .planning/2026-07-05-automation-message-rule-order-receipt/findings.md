# Findings

## Repo

- `docs/progressing/to-verify.md` 显示暂无待校验事项。
- 随机候选首个为 `Source Memory 召回卡片`，但与刚完成的 Memory Capture API 很近；在同一随机样本中选择 `手动关注项规则` 以避开最新相邻目标。
- AppleScript 未列出 `Personal AI`，EventKit 找到该列表；所有条目均为 completed 的历史 Doubao / Notification 反馈，没有开放且相关的 Message Analysis 手动规则条目。
- `src/modals/topic-modal.tsx` 已有导入/导出规则回执、分发回执、范围诊断和卡片级分发路径；拖拽排序 `handleDragEnd` 直接保存，没有可见保存/边界回执。

## External References

- Slack Workflow Builder 的 keyword workflow 要绑定 message trigger、keyword conditions 和 channels；发布后只在指定 channel 和关键词命中时启动。
  Source: https://slack.com/help/articles/43844341409811-Create-a-Slack-workflow-that-starts-with-a-keyword
- Zapier Filters 把条件作为 workflow 是否继续的 gate；符合条件才继续后续 action。
  Source: https://help.zapier.com/hc/en-us/articles/8496276332557-Add-conditions-to-Zap-workflows-with-filters
- Saeidi et al., "If This Context Then That Concern" 发现上下文提示能帮助用户更深入识别 trigger-action applet 的隐私和副作用风险。
  Source: https://arxiv.org/abs/2012.12518
- Trigger-action debugging 研究强调用户需要理解规则是否会产生预期行为以及问题原因。
  Source: https://openportal.isti.cnr.it/doc?id=people______%3A%3Aa5e3db2c0020a773b72f987f72da45c6

## Design Decision

新增 `规则排序回执`，在拖拽保存后说明：

- 已保存的新位置和排序时间。
- 排序影响后续本机手动规则展示、提示顺序、同一消息多规则命中时的优先分发口径。
- 排序不会回扫历史消息、不会立刻写入记忆、不会发送通知/摘要/自动答复、不会创建 RuntimeAction 或执行 OpenClaw。
- 系统观察规则、Outreach、自我反思临时观察不参与该排序，也不会被覆盖。
- Memory Service snapshot 同步仍沿用现有机制，本次拖拽本身不直接覆盖后端记忆。
