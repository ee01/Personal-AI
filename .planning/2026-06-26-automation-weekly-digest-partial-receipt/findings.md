# 周报与 Dream Digest 巡检 Findings

## 仓库与功能状态

- `docs/progressing/to-verify.md` 当前为“暂无”，没有待接续校验项。
- Reminders 列表可读，但没有 `Personal AI` 列表；本轮不做 Reminder item 完成。
- 目标功能：`docs/index.md` 中的 `周报与梦境摘要推送`，所在文档 `docs/features/notification_center.md`。
- 当前实现已经支持 Options “立即推送”读取可见 target/group 输入值，并在配置区显示结构化回执。
- 现有后端结果能返回 `notificationCreated`、`botSent`、`botError`、`reportPath`、`messageCount`、`reflectionCount`、`dreamCount` 和 `latestDreamPath`。
- 发现的 UX 缺口：`renderDigestManualPushReceipt()` 只按 `generated` 决定 success/warning class。若周报已生成但 Bot 未送达，回执内容会写 `Bot 未送达`，但外观仍是 success，用户第一眼容易误读为完整成功。

## 外部参考

- Apple notification summaries / Reduce Interruptions 强调摘要和优先级是为了让用户快速扫描重要信息，而不是把所有通知都直接打断。
- Microsoft Viva Insights 提供用户侧 opt-out / privacy 设置，说明周期性 digest 必须有明确控制权。
- Email batching 研究显示 batching 和通知依赖会影响生产力与压力，低打扰摘要不能只追求“少打扰”，也要符合用户对响应和可恢复性的期待。
- Iqbal & Bailey 的 intelligent notification management 研究用 defer-to-breakpoint 策略管理通知，支持在状态不完整时把恢复/失败信号留在用户可见位置。

## 本轮改进点

- 把手动摘要推送回执拆成完整成功、部分完成和未生成三种状态。
- 对 `target !== none` 且 notice 未写入或 Bot 明确失败的结果显示 warning 样式与 `已生成，投递部分失败` 状态。
- 保留已有边界：不自动点击、忽略、完成通知，不改变自动调度，不绕过当前投递目标。
