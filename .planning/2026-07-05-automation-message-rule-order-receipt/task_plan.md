# 手动关注项规则排序回执计划

## 目标

随机样本内选定 `手动关注项规则`。补齐规则页拖拽排序保存后的用户可见边界，说明排序只改本机手动规则列表、影响后续分析优先级，不会回扫历史消息、覆盖系统观察、写 Memory Service 或执行联动操作。

## 步骤

1. [complete] 读取现状、Reminder 和外部参考。
2. [complete] 在 `topic-modal.tsx` 增加排序回执状态、保存后展示和清除逻辑。
3. [complete] 更新 `verify-message-analysis-rule-diagnostics-e2e.mjs` 覆盖拖拽排序回执。
4. [complete] 更新 `docs/features/message_analysis.md` 的手动规则 UX 边界说明。
5. [complete] 运行目标验证、`npm start` 首次编译、E2E、`git diff --check`。

## 风险与边界

- 不改变匹配、入库、通知、摘要、自动答复、关注后续、RuntimeAction 或系统观察规则语义。
- 保留已存在的导入/导出/分发回执，不重复实现。
- 工作区已有大量未提交变更，只记录本轮触碰文件。

## 错误记录

- 默认 shell 可用 node，但仍按本机稳定路径显式加入 `$HOME/.nvm/versions/node/v24.13.0/bin`。
