# Findings: Roadmap ↔ Jira 同步

## Requirements
- 整理 roadmap-service 的 Jira 信息同步设计
- 特别说明打开页面时：有 Chrome 扩展 vs 没有
- 会从 Jira 拉什么字段更新 Roadmap 吗？会推修改到 Jira 吗？
- 其他场景下两个方向分别在什么时机发生

## Bug: RCV-150989 拖到 8/18 后 bar 回弹 + 刷新不跟 Jira（2026-08-17）

用户在 `roadmap.xmnup.com` 把 RCV-150989 截止拖到 8/18：toast 说已回写、Jira 真的是 8/18，但 bar 立刻缩回 8/12；整页刷新后仍是 8/12。

### 两个症状，同一条竞态链

1. **拖拽后 bar 回弹**：resize intent 已把 `start_date`/`days` 写成新值；1.5s 后扩展把 Target 写到 Jira（成功）。几乎同时，打开页约 2s 的静默 `refresh_from_jira` 可能仍读到**旧** Target End，并把已排期 bar **按旧 Target 重算**挪回去。
2. **刷新仍不对**：线上 `confirmTargetSync`（已部署）只写 `target_start`/`target_end`，**不**把 `start_date`/`days` 扳回来；而那次过期静默刷新已盖上团队 `jira_refreshed_at`（10 分钟 TTL），再开页静默刷新被跳过，继续展示错误 bar。

本地未部署 diff 已让 `confirmTargetSync` 在 scheduled item 上重申 `start_date`/`days`（注释写明就是防这条竞态），能修「confirm 之后 DB 仍错」；完整修复还应堵住「静默刷新用过期 Target 覆盖刚拖的 bar」以及 TTL 把错误状态锁 10 分钟。

## Architecture
Roadmap 页面本身不直连 Jira（CORS）。Jira REST 一律：
- 扩展：content script → `PERSONAL_AI_JIRA_PROXY_FETCH` → background，凭据是 Options `JIRA_API_TOKEN`
- 服务端：仅 `JIRA_PAT`，目前只做 **Target 日期回写 fallback** 和（legacy）服务端搜 Task

团队数据权威在 roadmap-service SQLite。打开页面先拉 snapshot / SSE，再视扩展决定要不要打 Jira。

## 打开页面

### 共同路径（有无扩展都做）
1. `loadTeams` + `fetchTeam` 从 roadmap-service 读 SQLite snapshot
2. 订阅 SSE，协作者改动实时进页面
3. 无 actorName 时 1.2s 后弹出名字门
4. **打开页面不会向 Jira 推送任何修改**

### 有扩展
1. content script 注入，发 `pai-roadmap-hello`
2. 页面 `hasExtension=true`，要 identity，推送 Gantt state（给 memory focus，不是 Jira）
3. 扩展用 Glip 身份填名字，跳过名字门
4. 若有未完成 Agent 创建，恢复轮询并 `resolve_*` 回写 key
5. **握手成功 + snapshot 后约 2s**：静默 `pai-roadmap-refresh-jira`（仅可编辑链接）
   - 对象：甘特上非 draft 主任务 `jiraKey` + 有 key 的子任务，最多 50，JQL `key in (...)` 每批 ≤25
   - 跳过：正在拖拽/编辑、pending Target sync、只读链接、TTL 内（团队 `jira_refreshed_at` 10 分钟）
   - 拉：`summary`, `description`, Target Start `customfield_18350`, Target End `customfield_18351`, `assignee`
   - 写 Roadmap：`refresh_from_jira` intent
     - 主任务：title / description / target_start+end；已排期则用 Target 重算 `start_date`/`days`（会挪 bar）
     - 子任务：title / description / 日期 / owner（assignee 与映射不一致才改；空 assignee **不清空** Owner）
     - **不改 alias**；不拉 estimate / quarter / status / issuetype
   - **不写回 Jira**
6. Backlog 里未上甘特的 issue **不会**被这次刷新碰到

### 无扩展
- 只看 SQLite / SSE，零次 Jira 请求
- 导入 Backlog / 导入 Task / 创建 Jira / 读 ETA：锁定态，点了才出安装引导
- 拖动排期：若服务端配了 `JIRA_PAT`，1.5s 后仍可 queue 回写 Target；都没有则静默
- 改 Owner：**不**回写 assignee，toast「需要扩展」

## Jira → Roadmap（读）时机

| 时机 | 凭据 | 拉什么 | 落到哪 |
|------|------|--------|--------|
| 打开页静默刷新 | 仅扩展 token | summary/description/Target Start+End/assignee | 甘特已有 key 的主/子任务；已排期 bar 会按 Target 挪 |
| 导入 Backlog（用户点） | 仅扩展 token | summary, issuetype, Target Start/End, End Date fallback `cf_14354`, Quarter `cf_21998`, DEV Estimate `cf_25757` 或 timeoriginalestimate | items；增量跳过已存在；覆盖更新 type/title/quarter/estimate/targets，**不挪**已排期 bar |
| 导入 Task（用户点） | 仅扩展 token | summary, issuetype, assignee, parent/Epic Link, Target Start/End | 新 subs；已有 jira_key 跳过不去重更新 |
| Marker「读取 ETA」（用户点） | 仅扩展 token | Target End，没有则 End Date | 只填 marker 日期，不改 issue |
| 创建 Jira · Agent | 扩展读父 Epic description | 父 description 摘录进 prompt | 不入库，只给 Agent |
| 创建 Jira · createmeta | 扩展 | 项目可用字段 | 决定创建 payload 带哪些可选字段 |

## Roadmap → Jira（写）时机

| 时机 | 凭据 | 写什么 | 不写什么 |
|------|------|--------|----------|
| 排期 / 拖动 / 伸缩成功后 1.5s | 扩展 token → 服务端 PAT → 静默 | Target Start + Target End | title/description/assignee |
| 非 draft 改子任务 Owner | 仅扩展 token + 映射 | `assignee.name`；置空先 confirm | 无映射则 toast 不写 |
| 创建 Jira（用户点） | 仅扩展 token | 新 issue：summary, issuetype, project, Epic Name, 链接字段, Target 日期, Quarter, fixVersions, assignee, description | alias；Sprint（直连 v1 不写） |

打开页面、刷新 snapshot、改 alias、改 draft description、只读链接：**都不推 Jira**。

## 冲突规则
- 静默刷新跳过正在拖的 key；`item.updated_at > fetchedAt` 也跳过
- 增量导入不更新已有行（Jira 改了标题，Backlog 里旧行会一直旧，直到覆盖导入或上甘特后被静默刷新）
- 覆盖导入改 target_* 但不改 `start_date`/`days`；甘特条位置只被静默刷新或用户拖动改变
- description ≠ alias：alias 永不回写 Jira；非 draft description 只能从 Jira 镜像，本地不能改

## Resources
- `docs/features/personal_roadmap.md`
- `roadmap-service/web/src/components/GanttPanel.vue`
- `roadmap-service/src/core/TeamService.ts` (`applyRefreshFromJira`, import, confirmTargetSync)
- `roadmap-service/src/core/TargetSync.ts`
- `src/contentScriptRoadmap.ts` (`handleRefreshJiraIssues`, import, update target/assignee)
- `src/jiraCreateMeta.ts`

## Bug: resize 后 bar 弹回（RCV-150989）
用户拖到 Target End 8/18，Jira 与 toast 都成功，但甘特立刻回到 8/12，刷新也不按 Target 重算。

竞态：打开页静默刷新用尚未更新的旧 Jira Target 覆盖了 `start_date`/`days`；旧 `confirmTargetSync` 只写 `target_*`；TTL 10 分钟内刷新不会再拉 Jira。

已修：confirm 恢复排期；Target 回写全程 in-flight 跳过静默刷新。
