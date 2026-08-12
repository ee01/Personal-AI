# Progress

## 2026-08-12
- 创建 planning 文件，梳理 R1–R9 + 用户三项额外 UX。
- 后端：`assignee_map_json` migration 009、intent、`importedTaskSpan`、成员改名迁移 map key。
- 前端：AssigneeMapModal、AiCreateModal 汇总/Prompt、dispName、选人浮层、creator-tag、bar-link、别名定位、导入子任务可删、新建默认今天+14d。
- 扩展：直连 assignee、Agent Prompt 契约、连接徽标底部短暂提示 + 新纳入重点文案。
- 文档：更新 `docs/features/personal_roadmap.md`，删除 progressing plan。
- 验证：roadmap-service 定向单测 18 passed；`npm run build`（roadmap）通过；`npm start` 首次 webpack compile success。
