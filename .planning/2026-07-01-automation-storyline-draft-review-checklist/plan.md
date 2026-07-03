# Storyline Draft 复制前复核清单

## 目标功能

- 随机目标：`Storyline Draft 页面`，Memory Storyline Builder。
- 文档：`docs/features/memory_storyline_builder.md`。
- 页面：`memory-exploring.html#/storylines/draft`。

## 当前观察

- 文档描述与代码总体一致：Storyline Draft 只基于 Today Pilot 会前准备生成可复制草稿，不自动写回 Slides / Docs / RingCentral，不发送消息，也不保存长期 Storyline 历史。
- 页面已有生成范围回执、证据引用/详情计数、来源打开回执、复制前确认门禁和旧复制回执。
- UX 缺口：复制门禁只把待确认、风险和段落证据边界汇总成数量。用户要知道具体复核什么，需要在 Inspector 多个区块之间来回找。
- Reminder：本机 Reminders 可读，但没有 `Personal AI` 列表，所以没有相关条目可纳入或标记完成。

## 外部参考约束

- Microsoft Teams / Google Meet / PowerPoint Copilot 都把 AI 会议输出、notes 或 speaker notes 放在用户 review / keep / share 的人工边界内。
- 证据型生成与叙事结构研究都强调 traceability、verifiability 和高信号片段选择；Storyline 不应把生成稿包装成外发就绪稿。

## 实施计划

1. 在复制前确认区域新增 `复制前复核清单`，列出 gaps、risk notes 和段落 grounding findings。
2. 段落类复核项做成按钮，点击后切换 Inspector 选中段落。
3. 保持复制逻辑不变：仍需用户勾选确认后才能复制，复制后只写本机剪贴板。
4. 更新 E2E，验证清单可见、可跳到段落、复制门禁和旧复制回执仍正常。
5. 更新功能文档，记录复制前复核清单的行为与边界。
6. 运行 Storyline API 测试、dev webpack 首次编译、Storyline Draft E2E 和 scoped diff check。
