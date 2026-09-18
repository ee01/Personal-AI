# Findings

## Requirements
- 无扩展用户改会推 Jira 的字段时，提示「没有同步修改 Jira」，右侧小文本按钮「安装插件开启同步」
- 回答拉取是否应保持静默

## Research Findings
- 创建 Jira / 导入 / 读 ETA：锁定态 + `ExtensionGateModal`（用户点击才弹）
- **拖动回写 Target**：无扩展 → `mode=queue` 走服务端 PAT；PAT 也没有则 **完全静默**（`GanttPanel.vue` `runTargetDateSync` catch 空）
- **Owner → assignee**：无扩展已有 toast「未回写 assignee（需要 Personal AI 扩展）」，无安装按钮
- 产品里没有独立的 Tag / Star 回写。阶段 ★ 与 labels 只存在 Roadmap。用户说的 Tag/Star/End 对应「会推到 issue 的字段」，落地就是 Target End + assignee
- 静默拉取：`silentRefreshFromJira` 在 `!hasExtension` 直接 return；上次扩展用户镜像的 status 团队共享

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 共用 `syncJira` feature | 与创建 Jira 同一套安装弹窗 |
| notice 单例 | 连续拖动不堆叠 |
| 点按钮打开 gate | 与锁定按钮同一安装流 |

## Resources
- `roadmap-service/web/src/composables/useExtensionGate.ts`
- `roadmap-service/web/src/components/GanttPanel.vue` `runTargetDateSync` / `onUpdateSub`
- `docs/features/personal_roadmap.md` 「导入 Task 与拖动回写 Target」
