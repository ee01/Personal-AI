# Project Dashboard 本地查找控制点边界

## 目标

随机巡检 `docs/index.md` 选中 `项目本地查找`。本轮只做 Project Dashboard 本地查找路径的可理解性修复：用户在输入、清除、切到全部命中前，应能通过 hover / 读屏先知道这是当前浏览器本地快照过滤，会与项目视图筛选组合，不会读取、同步或写回外部系统。

## 已检查

- `AGENT.md`
- `docs/progressing/to-verify.md`：暂无待校验事项
- 自动化记忆：避开最近精确重复目标
- Reminders：AppleScript 未列出 `Personal AI`，EventKit 读到 `Personal AI`，4 条均已完成且与 Project Dashboard 无关
- 代码/文档：
  - `docs/index.md`
  - `docs/features/project_dashboard_usage_guide.md`
  - `src/components/dashboard/ProjectDashboard.tsx`
  - `src/utils/dashboardIntegration.ts`
  - `tools/verify-project-dashboard.ts`
  - `tools/verify-project-dashboard-e2e.mjs`

## 外部参考结论

- Jira quick filters 明确“show/hide”而不是删除 work items，支持把视图筛选后果放在控制点。
- ServiceNow Platform Analytics 把 text/value/date filters 作为 dashboard/list/data visualization 的显式对象，支持区分 filter 本身和数据源读取。
- Looker 文档说明隐藏的 dashboard filters 仍会影响结果，支持在隐藏/叠加筛选场景里明确“筛选仍在生效”。
- Faceted search 研究强调 facets 帮助用户理解信息空间并来回收窄结果，但过多/不清楚的 facets 会增加负担；本轮应补控制点边界，不新增筛选复杂度。
- Information scent 研究强调用户点击前依赖 label 和上下文判断目标价值；本地查找控制点需要在点击前提供足够线索。

## Plan

1. [done] 给本地查找输入框增加更完整的 `title` / `aria-label`，说明多关键词、本地快照、当前视图组合和无外部读写边界。
2. [done] 给清除查找按钮增加 `title` / `aria-label`，说明只清除本页查找词、保留当前项目视图和本地数据，不触发外部读取或写回。
3. [done] 给回执内和空状态里的 `查看全部命中 / 查看全部项目 / 清除查找` 按钮补控制点边界，说明只改本页 view/search state。
4. [done] 修复无命中空状态的 `查看全部项目`：现在会清除 query 并切到全部视图，避免按钮文案和结果不一致。
5. [done] 更新 E2E 断言覆盖这些控制点。
6. [done] 更新功能文档和索引的简要描述。
7. [done] 验证：
   - `node --check tools/verify-project-dashboard-e2e.mjs`
   - `npm run verify:project-dashboard`
   - `npm start -- --progress` 首次 webpack dev 编译成功后已停止
   - `npm run verify:project-dashboard:e2e`
   - scoped `git diff --check`
   - 进程检查未发现残留 watcher / E2E 进程
