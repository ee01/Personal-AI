# Findings

## Requirements
1. Draft description 可选录入（Gantt 快速添加 / 双击草稿条 / Backlog 新建），不挡 Enter 秒建
2. Hover 灰色小字有 description 时展示描述；「可赶 Sprint」挪到标题行
3. Agent Prompt 综合父 Epic 描述 + 子标题 + 用户描述；直连 API 原文透传
4. 打开 Roadmap 静默 refresh_from_jira（扩展独占能力，结果 SSE 共享）
5. 非 draft 主/子任务 Target 回写 + 子任务 Owner→assignee（仅扩展）
6. 人员视图几乎看不到任务

## People view bug
`ResourceView.vue` `inWindow`:
- `end >= winS` 是 Date vs Date，正常
- `s.start! <= winE` 是 ISO 字符串 vs Date
- JS 把 Date 转成 number、字符串转成 NaN，比较恒为 false
- 结果：窗口内任务条全部不渲染；「更晚」chip 同样挂掉；「更早」chip 偶尔还能出现
- 同文件 `s.start! < winS` / `s.start! > winE` 有同样问题
- Vue 模板 `{{ esc(...) }}` 会二次转义，不是看不见的主因
- 人员视图还缺 demo 里的网格线，修完日期后一并补上

## Key files
- `roadmap-service/src/storage/{schema.sql,Database.ts}`
- `roadmap-service/src/core/{TeamService.ts,TargetSync.ts,assigneeMap.ts}`
- `roadmap-service/web/src/components/{GanttRow,GanttPanel,BacklogPanel,ResourceView,AiCreateModal,HelpFab}.vue`
- `roadmap-service/web/src/composables/{useCreateJiraAgentPrompt,useRoadmapContract,useExtensionBridge,useRoadmapApi,useGeometry}.ts`
- `src/contentScriptRoadmap.ts`, `src/jiraCreateMeta.ts`
- `src/roadmapFocusContract.ts`, `memory-service/src/core/FocusProject{SyncService,ContextBuilder}.ts`

## Refresh / writeback notes
- Target 回写现状只走主任务 `itemKey`；子任务 commitBar 不 schedule sync
- `confirmTargetSync` / `queueTargetSync` 只查 `items`
- 扩展已有 `pai-roadmap-update-target-dates` 与 `jiraDescriptionToPlain`
- Assignee 回写需要新的 `pai-roadmap-update-assignee` 桥
- `jira_refreshed_at` 团队级 10 分钟 TTL；refresh 不进 ticker
