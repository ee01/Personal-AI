# Message Analysis 空导出回执发现

## 仓库与提醒

- `docs/progressing/to-verify.md` 当前暂无待校验事项。
- 本机 Reminders 列表可读，列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`；没有 `Personal AI` 列表。
- 工作区已有大量既有脏改；本轮只触碰 Message Analysis、对应 E2E、功能文档和本 planning 目录。

## 代码与体验

- `docs/features/message_analysis.md` 已覆盖手动规则、系统观察规则、范围校验、分发回执、导入/导出回执、运行路径和多个历史修复。
- `src/modals/topic-modal.tsx` 的导出路径总是构造 XML、触发 `<a download>`，然后显示导出回执；空列表时也会下载空 XML。
- 对用户来说，空导出是一次成功读取后的“无结果”，不是有效备份文件；应该和失败区分，也不应静默下载无用文件。

## 外部参考

- Slack Workflow Builder、Zapier Filter/Paths、Power Automate 条件/运行记录都把触发条件与动作后果分开呈现。
- Trigger-Action Programming 研究反复指出用户会误解自动化规则的触发、范围和调试结果；空结果与成功副作用需要分开表达。
