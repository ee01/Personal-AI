# Findings

- `docs/progressing/to-verify.md` 为“暂无”，无需接续未完成项。
- AppleScript 未列出 `Personal AI` Reminders；EventKit 读到 `Personal AI` 列表，4 条全部已完成，没有和 Source Memory 召回卡片相关的开放反馈。
- `docs/features/memory_capture.md` 已描述 `/context-recall` 会返回 `source_memory` 专用卡片、敏感来源隐藏和详情复核入口，文档方向是当前的。
- `src/contentScriptWebIntelligence.ts` 当前把资料类型、保存方式、来源状态和打开回执分散展示；缺少一个首屏“这条资料证据当前怎样可用”的集中回执。
- `desktop-app/scripts/webpage-memory-detection-check.mjs` 已有 source-url-only 和 sensitive-source E2E fixture，适合直接扩展，不需要新建 harness。
