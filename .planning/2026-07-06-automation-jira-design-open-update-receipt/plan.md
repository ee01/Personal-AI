# Jira Design Links 打开后更新时间复查回执计划

## 目标

随机功能点：`设计链接更新时间展示`，所属 `Jira Design Links`。

本轮只改 presentation/receipt 层：当用户从 Jira 设计链接面板打开一个带更新时间或缺时间状态的设计入口后，原 Jira 页继续保留该行的更新时间复查上下文，避免把“打开过外部设计”误读成“已经复查确认最新设计”。

## 外部参考

- Figma / Jira 与 Atlassian Marketplace 都把设计更新、Ready for Dev 状态和可打开设计卡片作为 handoff 核心信号。
- Zeplin / Jira 也强调 linked design resource 与实时 issue/design context。
- Provenance UX 研究提醒，来源元数据和可信/确认状态容易被用户混淆，所以点击后的回执需要同时说明来源、时间口径和非确认边界。

## 改进计划

1. 扩展 Jira 设计链接打开回执，让设计入口点击携带更新时间日期、时间来源 chip 或缺时间状态。
2. 在回执内显示 `待复查`、更新时间来源和“打开不等于已核对最新更新”的边界。
3. 补充 `verify-jira-design-links-e2e`，覆盖打开 updated 设计后回执保留时间上下文，并确保后续打开 UX ticket 会替换旧上下文。
4. 更新 `docs/features/jira_design_links.md` 和 `docs/features/index.md`，保持文档是当前行为摘要。
5. 按 AGENT.md 跑 focused verifier、`npm start` 首次编译、E2E 和 scoped whitespace 检查。

## 非目标

- 不刷新 Figma 或 Jira remote link 元数据。
- 不新增已复查状态、Jira 写入、Memory Service 写入或自动提醒。
- 不改变设计链接识别、去重、排序和过滤规则。
