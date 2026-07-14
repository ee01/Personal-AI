# Relationship Radar 侧栏快速稍后回执 Findings

## 仓库与 Reminder

- `AGENT.md` 要求本类改动走 `plan -> implementation -> docs -> focused verifier/E2E`，代码改动后优先 `npm start` 等首次成功编译再停止。
- `docs/progressing/to-verify.md` 当前为空。
- 自动化记忆显示最近刚覆盖 Task Scheduler、Memory Capture、Rehearsal、Google Slides、Compose Assist、Ask 等；本轮选择 Relationship Radar Review Queue，避免重复最新精确目标。
- EventKit 读到本机 `Personal AI` 列表：4 total / 0 incomplete；条目均为已完成的 Doubao / Notification / 测试反馈，无 Relationship Radar 相关开放项。
- 工作区已有大量 unrelated dirty state；本轮只拥有 Relationship Radar 侧栏回执、对应 E2E 断言、简短 docs/index 更新、计划文件和自动化记忆。

## 代码发现

- `docs/features/relationship_radar.md` 已描述 Review Queue 的 confirm / reject / snooze、完整复核卡、成功失败回执、空筛选回执和侧栏不能一键确认写入。
- `src/modals/components/RelationshipRadarPage.vue` 右侧 `确认队列` 侧栏仍允许 `稍后 7 天` 快捷操作。它不会写入人物画像，但会把候选移出待确认并设置 `snoozeUntil`。
- 侧栏目前只说明确认写入前应进入完整复核卡，没有在每个快捷按钮旁说明 quick snooze 的状态改变、证据保留和编辑路径。
- `tools/verify-relationship-radar-e2e.mjs` 已覆盖侧栏进入复核不写入、完整卡失败确认、稍后成功回执和回队列凭证，适合补一条侧栏回执断言。

## 外部参考

- Google Contacts `Merge & fix`: 建议式联系人修复仍保留逐条查看和合并/忽略动作，支持 Review Queue 保持完整复核入口。
- Salesforce Einstein Relationship Insights: 关系建议应带证据和业务记录更新路径，支持把写入权限和证据范围放在动作附近。
- Human-AI guidelines / mixed-initiative review research: AI 建议要暴露系统能力、用户控制权和可能影响，降低 rubber-stamp 风险。
- Notification snooze / deferral research: 延后操作会改变未来提醒和用户注意力路径，不能被表现成纯查看或无状态点击。

## 选定切片

为右侧 `确认队列` 的每个候选摘要增加 `快速稍后回执`。这是一项 presentation-only UX 改进，不改 API、不改 Review Queue 状态机、不改变侧栏 quick snooze 能力，也不新增用户决策。
