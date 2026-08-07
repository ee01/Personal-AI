# Agent Workflow 保存样例删除回执

## 目标

随机功能: `Agent Workflow 多 Agent 编排`

改进点: Options 里的保存样例删除按钮只显示一句“已删除保存样例”，用户无法判断它删除的是本地回归样例、结果基线、真实消息，还是 Memory Service 记忆。补一个可见回执，明确删除范围和无副作用边界。

## Plan

1. 梳理 Agent Workflow 文档、Options UI、保存样例 helper 和现有 verify/E2E，确认当前真实行为。
2. 对照行业参考，保持“测试/草稿/本地回归”和“真实发布/真实副作用”分离。
3. 增加保存样例删除回执，显示删除对象、剩余样例数、基线是否移出，以及不影响 Memory Service、通知、自动化、导出报告和当前输入。
4. 更新 `docs/features/message_analysis.md` 和 `docs/index.md` 的当前行为说明。
5. 补 `verify:agent-workflow-replay` 和 Options E2E 断言，并按 AGENT.md 跑 targeted verify、首次 `npm start` 编译、E2E 和 scoped `git diff --check`。

## 非目标

- 不改变真实消息入口的 Agent 编排顺序。
- 不改变 Memory Service 写入、通知、规则自动化或低置信复核逻辑。
- 不引入新的持久后端 route 或外部 adapter。
