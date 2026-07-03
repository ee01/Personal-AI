# 外部 AI 历史基础录入巡检计划

## 目标功能

- 功能点：外部 AI 历史基础录入
- 能力：Memory Coverage Map
- 文档：`docs/features/memory_coverage_map.md`

## 现状结论

- `docs/progressing/to-verify.md` 当前无待校验项。
- 本机 Reminders 可访问，但没有 `Personal AI` 列表；本轮没有可纳入或标记完成的 Reminder item。
- 现有实现已能识别 ChatGPT / Claude `conversations.json` zip，显示 dry-run 范围、截断、跳过非文本部件和忽略文件，并在 commit 后写入 batch summary。

## 外部参考信号

- ChatGPT / Claude / Gemini 等产品正在把数据导出、记忆导入和迁移变成用户可预期能力。
- 相关研究强调长期记忆系统里的来源归因、隐私边界、用户控制和导入后检索/生成分层。

## 改进计划

1. 在外部 AI 历史 dry-run 后新增提交前决策回执。
2. 回执明确写入对象、低权重 shadow memory、不会自动抓取/外发/升级画像、去重和恢复路径。
3. 将该回执加入 Coverage E2E，覆盖外部 AI 导入抽屉。
4. 更新 `docs/features/memory_coverage_map.md`，让文档描述和最新 UI 行为一致。
5. 运行智能导入后端测试、Coverage E2E、`npm start` 首次编译和 diff 检查。
