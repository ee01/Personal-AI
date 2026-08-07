# Jira Design Links 保守过滤原因回执

## 目标

随机选中 `docs/index.md` 里的 `Figma/Zeplin 保守分类`。现有实现已经会过滤 Figma Community / help / marketing、Zeplin profile / settings 等非交付页面，并在 mixed 与 filtered-only 场景显示过滤数量和来源；但“为什么过滤”主要藏在 hover tooltip 里。真实用户扫 Jira ticket 时，仍可能把 `6 filtered non-handoff refs` 理解成漏扫或不确定的黑盒过滤。

## 外部参考

- Figma / Jira 集成把 `Ready for dev`、`Design updated` 和可打开的设计卡片作为 Jira handoff 的核心信号，说明功能应该保护“真实交付入口”而不是泛化所有 Figma URL。
- Zeplin / Jira 集成强调 screens、sections、projects、flows 等资源挂到 Jira issue，profile / settings / marketing 页不应混进交付入口。
- Traceability link explanation 研究强调自动恢复或过滤出的链接需要解释证据与原因，否则用户难以判断候选关系是否可信。

## 实施计划

1. 在 `src/jiraDesignLinks.ts` 增加被过滤链接的 reason / label 分布 helper，保持现有 URL 分类规则不变。
2. 在 `src/contentScriptJira.ts` 的 mixed 过滤范围、filtered-only 空状态和 footer 中显示 `原因 ...` tag，并把 reason 分布写入 aria summary / tooltip。
3. 更新 `tools/verify-jira-design-links.ts` 与 `tools/verify-jira-design-links-e2e.mjs`，覆盖 mixed 与 filtered-only 两条路径。
4. 更新 `docs/features/jira_design_links.md`，说明过滤回执同时展示来源分布和原因分布。
5. 验证：轻量脚本、`npm start` 首次编译、Jira Design Links E2E、scoped `git diff --check`。
