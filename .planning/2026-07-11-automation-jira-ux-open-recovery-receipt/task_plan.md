# Jira issue key 恢复打开回执巡检计划

## 本轮选择

- 随机候选来自 `docs/index.md`：`Jira issue key 解析` / Jira Design Links。
- `docs/progressing/to-verify.md` 为空。
- automation memory 最近刚覆盖了 Memory Lens Hover Peek、Meeting Pilot 会中提醒、Agent Workflow 运行诊断、Scheduled Messages CRUD、Quick Ask 语音、Topic Messages 等；Jira Design Links 最近覆盖的是 Figma/Zeplin 过滤和扫描口径，不重复本轮精确控制点。
- EventKit 读取到本机 `Personal AI` Reminders 列表：4 条总项目，0 条未完成；没有 Jira Design Links / issue key 恢复相关待办可纳入或标记完成。

## 外部参考

- Figma Help: Jira/Figma 集成把 linked Figma 文件、prototype、实时设计状态和 Dev Mode 状态带进 Jira，也强调查看权限和 Jira issue 访问权限。
  https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma
- Atlassian Support: Figma for Jira 让团队在 Jira work item 中链接 Figma 文件并查看 live design updates。
  https://support.atlassian.com/jira-cloud-administration/docs/integrate-figma-with-jira/
- Auxiliary Artifacts in Requirements Traceability: trace link 质量会受辅助 artifact 的来源、类型和工具支持影响；自动恢复出的关联需要保留来源语义。
  https://arxiv.org/html/2504.19658v1
- SoK: Systematizing Software Artifacts Traceability: 自动 traceability recovery 技术仍存在应用场景和链接语义碎片化问题，工程 UI 应把恢复关系和正式关系分开。
  https://arxiv.org/abs/2603.16208

## 发现

当前 Jira Design Links 已经在恢复出的 UX ticket 行上显示 `Key from ...` 和 `只读恢复`，并在面板顶部显示 `恢复范围`。但用户点击恢复出的 UX ticket 后，`来源打开回执` 只保留“已打开 UX ticket / 只读打开”，没有继续显示这个 key 是从 `selectedIssue query`、JQL、ARIA、`data-issue-key` 等非标准页面证据恢复出来的候选关系。

这个缺口容易让用户在点击后把“能打开 UX ticket”误读为“Jira 已经存在正式 issue link”。外部产品和 traceability 研究都指向同一结论：设计/需求关联可以自动恢复，但来源和关系强度要在使用路径中持续可见。

## 改进计划

1. 在恢复出的 UX ticket 链接上复用已有 key source / recovery boundary 文案，写入打开动作的 `data-*` 属性。
2. 点击恢复出的 UX ticket 后，`来源打开回执` 显示 `Key from ...`、`恢复候选打开` 和候选关系边界；`aria-label` 同步包含恢复来源和不写 Jira 边界。
3. 不改 issue key 解析、候选选择、Jira API、设计链接分类、Jira 写入、Memory Service 或外部系统。
4. 更新 `docs/features/jira_design_links.md` 和 `docs/index.md`，只说明用户可见的打开回执行为。
5. 扩展 `tools/verify-jira-design-links-e2e.mjs`，验证点击 `UXQUERY-700` 后 open receipt 保留 `selectedIssue query` 和不写 Jira 边界。

## 验证计划

- `node --check tools/verify-jira-design-links-e2e.mjs`
- `npm run verify:jira-design-links`
- `npm start -- --progress`，等第一次 successful compile 后停止
- `npm run verify:jira-design-links:e2e`
- scoped `git diff --check`
