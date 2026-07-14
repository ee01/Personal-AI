# Findings

## Repo

- `用户画像导出` 当前已有全状态分页、manifest 指纹、诊断 warning、成功/失败回执和当前筛选不限制导出的文档与 E2E。
- `exportUserProfile()` 已用 `if (isExporting.value) return;` 做单飞保护，但进行中的按钮/回执只说“下载尚未开始、等待 manifest ID”，还没有直接告诉用户重复点击不会开第二轮导出或第二次下载。
- 因为按钮 disabled，真正的行为已经安全；本轮适合做 presentation/accessibility 修复，不改 `EXPORT_USER_PROFILE` 消息、导出 JSON schema、manifest、分页或 Memory Service 数据。

## Reminders

- AppleScript 返回的列表不包含 `Personal AI`。
- EventKit 成功读取本机 Reminders，并找到 `Personal AI`。
- `Personal AI` 共 4 条、未完成 0 条；均为历史 Doubao / Notification / test 反馈，和用户画像导出无关。本轮不标记 Reminder。

## External Scan

- OpenAI ChatGPT data export: 用户可通过设置或 Privacy Portal 请求 ChatGPT 数据副本，说明导出是单独的数据副本路径，不等同于删除或恢复。
  Source: https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data
- Claude memory import/export: Claude 将 memory import/export 定义为备份或迁移流程，支持把“导出、导入、迁移”边界分清楚。
  Source: https://support.claude.com/en/articles/12123587-import-and-export-your-memory-from-claude
- Google Takeout: 下载 Google 数据不会删除 Google 服务器数据，可创建 archive 用于保存或传输；支持 Personal AI 导出文案继续强调本地副本、不删除/不同步。
  Source: https://support.google.com/accounts/answer/3024190
- ICO data portability guidance: 数据可携权强调 accessible / machine-readable，支持 JSON + manifest + audit 的结构化导出方向。
  Source: https://ico.org.uk/for-the-public/your-right-to-data-portability/
- Response-Aware User Memory Selection (2026): 个性化记忆应按实际响应效用筛选，而不是只靠相似度；支持导出审计继续显示 active + confirmed 才进入个性化，而不是把所有导出项都说成会被使用。
  Source: https://arxiv.org/abs/2604.14473
- Portable Agent Memory (2026): agent memory transfer 需要 provenance、integrity verification 和 capability/access boundaries；支持 manifest 指纹和恢复需单独流程的导出边界。
  Source: https://arxiv.org/html/2605.11032v1

## Decision

做单飞等待态边界：把 `isExporting` 状态下的按钮 title/ARIA 和 pending receipt detail/chips 改成“同一轮导出进行中，重复点击不会启动第二次 status=all 分页、manifest 生成、下载请求、恢复/删除/同步/发送或画像改写”。E2E 通过 fixture 的 delayed export 阶段捕捉该等待态。
