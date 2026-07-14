# Findings

## 当前代码/文档状态

- Today Pilot 文档已覆盖 Mission 质量标准、排序回执、来源分布、context pack、反馈 pending / success / failure 边界。
- `OverviewPage.vue` 已在用户点击反馈后显示 pending receipt，并在成功后显示 `Mission 反馈回执`。
- 缺口在点击前：用户展开 mission 看到一排按钮时，需要从别处推断 `完成`、`稍后 6h`、`有用`、`不准确`、`复制上下文包`、`打开详情`、`不再提醒同类` 的作用范围。尤其 `完成` 容易被误读成完成了来源任务或动作队列事项。

## 设计结论

- 不需要改后端，因为反馈 API 已经是 Today Pilot scoped feedback。
- 不需要新增确认弹窗，因为这会增加日常 brief 的处理摩擦。
- 最合适的是在按钮前放一条常驻、短文本的操作范围回执，匹配已有 receipt-first 设计语言。

