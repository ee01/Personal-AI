# 记忆时间轴反馈回执改进计划

## 背景

- 随机目标：`记忆时间轴`，所属 `Memory Exploring`，主文档 `docs/memory_system.md`。
- `docs/progressing/to-verify.md` 当前为空。
- Reminders：EventKit 找到 `Personal AI` 列表，共 4 条，未完成 0 条；没有与时间轴反馈、召回质量训练或时间线快照相关的待办。
- 现状：时间轴已有范围、来源、刷新中/刷新失败、打开来源和安全诊断回执；反馈操作只有卡片内 `提交中...` / `已记录` 状态，失败时落到全页 error，用户不容易判断它到底写了什么、没写什么。

## 外部参考

- Microsoft Recall / Google My Activity 都把个人历史视图放在可过滤、可管理的时间线里，强调来源、时间和控制边界。
- Human-AI Interaction Guidelines 强调系统应支持细粒度反馈，同时谨慎更新和适配，避免反馈后界面突然大幅变化。
- 信息检索里的 relevance feedback / Rocchio 传统说明“相关/不相关”是训练检索结果的信号，不等于删除文档或立刻改写当前结果列表。

## 改进计划

1. 在时间轴页面新增 `时间轴反馈回执`，覆盖提交中、成功、撤销和失败。
2. 回执明确目标记忆、动作、当前时间窗口/范围/来源筛选，以及 `/feedback` 写入边界。
3. 失败时保留上一状态，不把反馈失败伪装成时间轴加载失败，也不清空列表。
4. 更新 `timelinePresentation` 纯函数和 verifier，保证文案稳定。
5. 更新 Playwright E2E，覆盖 pending、成功、撤销和失败回执，以及失败后旧状态保留。
6. 更新 `docs/memory_system.md` 和索引日期/说明，保持文档描述为当前行为。
7. 运行 targeted verifier、`npm start` 首次编译、时间轴 E2E 和 scoped `git diff --check`。
