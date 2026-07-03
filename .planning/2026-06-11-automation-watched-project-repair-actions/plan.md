# Watched Project Repair Actions

## 目标

让 Project Dashboard 的 Memory Service watched projects 补齐结果不只报告“待规划 / 缺 ETA / 缺来源”，还直接把用户带到对应本地修复入口。

## 调研结论

- Linear / Asana / Jira 的项目更新路径都把健康判断绑定到项目、任务、里程碑和来源状态。
- dashboard data-quality 研究提醒：用户容易把可读连接状态误认为数据足够可信，因此缺口和下一步必须靠近决策入口。
- 当前代码已经有本地证据回执、待规划项目和任务详情聚焦能力，缺的是从同步回执到这些能力的直接动作。

## 实施步骤

1. 在 `ProjectSyncLocalEvidenceReceipt` 中增加结构化 `repairActions`。
2. 让 watched-project 检查结果为待规划项目、缺 ETA、缺来源生成可点击动作。
3. 在 Project Dashboard UI 渲染动作按钮，并复用新增任务弹窗 / 任务详情聚焦路径。
4. 更新功能文档和 Project Dashboard 验证脚本。

## 验证

- `npm run verify:project-dashboard`
- `npm start` 首次成功编译
- `npm run verify:project-dashboard:e2e`
- `git diff --check`
