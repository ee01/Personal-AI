# Jira Backend Progress（外部依赖进展 / BE date）

*最后更新: 2026-08-11*

## 功能概述

Backend Progress 在 Jira ticket summary 下方展示绿色卡片，汇总当前开发票相关的外部依赖票的 **Early Build** 与 **Rollout to Prod** 日期，方便开发者判断后端依赖是否已可联调 / 上线。

它与 [Jira Design Links](./jira_design_links.md) 共用同一 content script（`src/contentScriptJira.ts`），但数据源、配置项和展示面板完全独立。

## 展示约束

1. **同项目过滤只作用于 INIT/Parent 查询**：通过 Parent/INIT 的 Impacted Layers、issue links、subtasks 或 `portfolioChildrenOf` 找到的票，如果与当前 issue 同项目则不展示。当前页 Linked Issues、上级 User Story 的 Issue Links、Epic 自身及上级 Epic 的 Issue Links **不做同项目过滤**；它们只排除当前 issue 自身。
2. **最多 5 条**：按渠道排序后截断。优先级为：

   **linked issues（含 user story）> epic 关联 > parent Impacted Layers > parent sub issues**

   （Design Links 另有 description 通道；BE 无 description 扫描。）

   parent Impacted Layers / parent sub issues 通道有多条时 **closed/done 优先**。

## 展示格式

```
[icon] Depends: PLA-97920 ↗  Early Build: 5/10/2026 | Rollout to Prod: 5/20/2026  [parent_impact_layer:Platform]
```

- Early Build 无日期时显示 `N/A`
- 有 fixVersion 但 DORA 尚无 rollout 时间时显示可点击的 `pending`
- 日期均来自实时 API，**不写在本 md 或任何本地文件里**

## 配置

扩展 Options → `Dependencies JIRA Project 前缀`（`DEPENDENCIES_JIRA_PROJECT`）：

- 默认 `RCV`：linked / epic / parent sub-issue 通道只匹配 `RCV-xxx`
- `RCV*`：前缀匹配
- 为空：不渲染 Backend Progress 面板
- **Impacted Layers 通道不受此前缀限制**（按 INIT 层映射到 PLA / CNV / NOVA 等项目）

## 查找逻辑

与 Design Links 的 UX 查找类似，按当前票类型向上扩展：

| 当前票类型 | 查找范围 |
|---|---|
| Epic | 1) 自身 Issue Links 中匹配前缀的依赖票；2) Parent Link（通常 INIT）下的 **Impacted Layers** 对应层 Epic；3) 同一 Parent 下匹配 `DEPENDENCIES_JIRA_PROJECT` 的依赖 Epic（issue links / subtasks / `portfolioChildrenOf`） |
| User Story / Task 等 | 1) 当前页 Linked Issues；2) 上级 Epic 的 Issue Links；3) 该 Epic 的 Parent Link（INIT）→ Impacted Layers → parent deps；无 Epic Link 时仍尝试当前票自身 Parent Link |
| Sub-task | 1) 上级 User Story 的 Issue Links；2) Story 所属 Epic 的 Issue Links；3) 该 Epic 的 Parent Link（INIT）→ Impacted Layers → parent deps |

Linked Issues / Epic Issue Links 的同项目票仍按原渠道参与排序。Epic 自身或上级 Epic 的 Issue Links 会在 source 标签中保留当前 Epic 视角的 Jira link 类型，格式为 `epic:<link relationship>`，例如 `epic:clones`、`epic:is cloned by`、`epic:depends on`；API payload 未提供关系文本时回退为 `epic`。例如在 `RCV-153451` 上，直接 `depends on RCV-152720` 会显示为 `epic:depends on`，并排在 `parent_impact_layer:*` 之前。只有沿 Parent/INIT 展开的同项目候选会被过滤。

### Parent Impacted Layers

当 Parent（通常 `INIT-*`）存在时：

1. 读取 `customfield_32651`（Impacted Layer/s）；**字段为空则不走本通道**（不把 Artifacts 单独 Required 当作兜底）
2. 读取 `customfield_19972`（Artifacts JSON）中 status=`Required` 的层，与上一步求交（若 Artifacts 可解析）
3. `portfolioChildrenOf` 拉取 Parent 子票
4. 按层 → 项目前缀映射匹配 Epic（例：Platform→`PLA`、Telco→`CNV`、Nova→`NOVA`、UX→`UX`/`UXAI`/`UXPHONE`），并过滤与当前 issue 同项目的候选
5. **已匹配 `DEPENDENCIES_JIRA_PROJECT` 的票（默认 `RCV`）留给经典 parent/linked 通道**，source 仍为 `parent_child_issue` 等，不标成 `parent_impact_layer:*`
6. 对其余命中票走与其它依赖相同的 Early Build / Rollout 读取

验证示例：`NOVA-15209` Parent=`INIT-30072` → Required layers Platform/Telco/Nova/UX → 跨项目 Epic 如 `PLA-97920`、`CNV-88546`（由 INIT 查询得到的同项目 Nova 子票会被过滤掉；若 Nova 票来自当前页或 Epic 的直接 Issue Links，则仍会展示）。

`MTR-144266` 的 Parent INIT 虽含 Impacted Layer `RCV`，但 RCV 子票仍走经典 parent 通道（与 Options 依赖前缀一致），不会整表标成 `parent_impact_layer:RCV`。

INIT / Parent 的 **sub-issue** 路径下，已知 issue type 时只收 Epic；issue type 缺失时仍按项目前缀保留候选（linked issue payload 有时不带 type）。

同一依赖票来自多个通道时会合并 source 标签（例如 `linked_issues, parent_impact_layer:Platform`）。

## 日期来源

| 字段 | 来源 |
|---|---|
| Early Build | 依赖票 Jira 字段 `customfield_18351`（Target End），否则 `customfield_14354`（End date） |
| fixVersion | 依赖票 `fixVersions` 的最后一个版本名 |
| Rollout to Prod | DORA Metrics：`https://rcv-dora-metrics.int.rclabenv.com/api/releases/{fixVersion}/lead-time` → `metrics.lastMrMergedTimestamp`（经 background `FETCH_ROLLOUT_DATE` 绕过 CORS） |

## 核心代码

```text
src/contentScriptJira.ts   // collectAndDisplayBackendProgress / findImpactLayerEpicsFromParent / displayBackendProgress
src/jiraBackendProgress.ts // Linked/Epic 与 INIT/Parent 的同项目过滤边界
src/background.ts          // FETCH_ROLLOUT_DATE
src/options.tsx            // DEPENDENCIES_JIRA_PROJECT 配置
src/utils.ts               // 默认 DEPENDENCIES_JIRA_PROJECT=RCV
```

## 与 Design Links 的对照

| | Design Links | Backend Progress |
|---|---|---|
| 目标项目配置 | `DESIGN_JIRA_PROJECT`（默认 `UX*`） | `DEPENDENCIES_JIRA_PROJECT`（默认 `RCV`）；Impacted Layers 另按层映射 |
| 关联查找 | description → linked → Epic → Parent/INIT | linked → Epic → Parent Impacted Layers → Parent sub issues |
| 面板 | 蓝色设计入口行 | 绿色 Early Build / Rollout 行 |
| 文档 | [jira_design_links.md](./jira_design_links.md) | 本文 |
