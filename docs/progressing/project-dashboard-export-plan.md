# 项目仪表盘导出功能修正版计划

## 1. 目标定义

这次要做的导出功能，建议先明确为：

**项目仪表盘导出项目报告**，而不是 Memory Service 的通用数据导出。

当前代码里同时存在三类“导出”概念：

1. `ProjectDashboard` 里的“导出报告”
2. `memory-service` 的 `POST /export`
3. 用户画像页和配置页的前端 JSON 下载

如果不先收口范围，后面的 plan 很容易把“项目报告导出”和“记忆系统数据导出”混在一起。

---

## 2. 当前代码现状

### 2.1 前端按钮已存在，但没有真正下载

`src/components/dashboard/ProjectDashboard.tsx`

- 已经有 `handleExportReport()`
- 当前发送 `QUICK_ACTION / export_report`
- 传参写死为 `projectId: 'all'`
- 成功后只打印日志，注释里明确写了“这里可以添加下载逻辑”

这说明前端入口存在，但导出闭环没有完成。

### 2.2 后台 action 已接通，但“all” 实际不支持

`src/utils/dashboardIntegration.ts`

- `handleQuickAction()` 已支持 `export_report`
- `DashboardDataManager.exportProjectReport(projectId)` 只会 `find(p => p.id === projectId)`
- 当前 `ProjectDashboard` 传的是 `'all'`

所以按现状看，点击导出大概率会得到“项目不存在”。

### 2.3 报告内容目前只是最小占位结构

当前 `exportProjectReport()` 返回的数据只有：

- `projectName`
- `generatedAt`
- `milestones`
- `tasks`

缺少一个“可作为正式导出协议”的结构层，至少缺这些：

- 导出版本
- 导出范围（单项目 / 全部项目）
- 汇总统计
- 平台维度统计
- 状态聚合
- 数据来源说明
- 文件名策略

### 2.4 当前项目数据并不是真实持久化数据

`src/utils/dashboardIntegration.ts`

- `fishboneProjects` 是内存里的 mock 数据
- `createProject()` 注释里明确写了“目前仅内存保存”
- `updateProjectItem()`、`createProjectItem()` 也都只是改内存数组
- `syncProjectData()` 也是模拟结果

这意味着：

1. 现在导出的并不是稳定的“真实项目源数据”
2. 浏览器扩展后台重启后，这些数据未必还在
3. 如果 plan 默认把它当成正式项目报表源，这是不合理的

### 2.5 Memory Service 的 `/export` 不是这个导出功能

`memory-service/src/routes/export.ts`

- 当前接口返回的是 markdown 文件清单
- 返回字段是 `files / totalFiles / dataDir`
- 注释里明确写了 zip 打包“deferred to Phase 5”
- 这更像“记忆数据导出 manifest”

`memory-service/src/core/ExportEngine.ts`

- 内部确实支持更丰富的导出能力
- 甚至有 `json`、`time_range`、`exportToJSON()`
- 但这个 engine 目前没有接到 `routes/export.ts`

结论：**现有 `/export` 不能直接当作项目仪表盘报告导出接口来复用。**

### 2.6 项目里已有可复用的下载实现模式

已有两处前端导出下载实现可直接参考：

- `src/modals/components/UserProfilePage.vue`
- `src/options.tsx`

它们都采用：

1. 拿到结构化数据
2. `JSON.stringify(..., null, 2)`
3. `new Blob(...)`
4. `URL.createObjectURL(...)`
5. 动态创建 `<a>` 并触发下载

所以如果导出目标是 JSON，V1 没必要先上 `chrome.downloads` 或后端二进制流。

---

## 3. 这类 plan 常见遗漏点

如果你原来的 plan 没覆盖下面这些点，我建议补上。

### 3.1 没先定义“导出的到底是什么”

必须先定清楚：

- 导出单个项目，还是全部项目
- 导出 JSON、CSV、PDF，还是 zip
- 导出的是“仪表盘展示数据”，还是“memory-service 原始记忆数据”

这一步不定，后面接口和数据结构一定会返工。

### 3.2 默认认为现有 `/export` 能直接复用

这在当前代码里不成立。

现有 `/export` 的职责是 memory 数据导出，不是项目报告生成。

### 3.3 默认认为 `projectId: 'all'` 已经支持

这在当前代码里不成立。

前端传了 `'all'`，但后台只支持精确匹配项目 id。

### 3.4 默认认为当前 dashboard 数据是稳定持久化的

这在当前代码里也不成立。

现阶段它更像“前端演示数据 + 扩展后台内存态”，并不是正式项目数据仓。

### 3.5 忽略状态归一化

当前鱼骨任务的 `status` 实际上是自由字符串：

- 代码注释里列了一套状态
- mock 数据里又出现了 `review`、`done`

如果 report 里要做状态统计，必须先定义归一化规则，否则汇总会失真。

### 3.6 忽略文件名、元数据和版本字段

导出功能一旦上线，后续一定会遇到：

- 用户手里有多个导出文件怎么区分
- 怎么判断报告结构版本
- 怎么知道导出范围和导出时间

这些都应该在第一版就进入协议。

### 3.7 忽略测试与文档同步

当前文档 `docs/features/project_dashboard_usage_guide.md` 已经写了“导出报告”，但实际功能没闭环。

如果这次实现导出，文档需要同步成“实际行为”，不能继续停留在概念描述。

---

## 4. 不建议现在做的事

### 4.1 不建议第一版就做 PDF

仓库里虽然有 `jspdf` 和 `html2canvas`，但当前项目仪表盘的数据层和导出协议都还没稳定。

直接做 PDF 的问题是：

- 先把展示层截图固化了
- 但数据协议还不稳定
- 后续一旦字段调整，PDF 模板和数据层要一起改

更合理的顺序是：

1. 先把 JSON 导出做完整
2. 让 report schema 稳定
3. 再决定是否基于 schema 生成 PDF

### 4.2 不建议第一版就强行接 `memory-service /export`

当前这条链路语义不一致，会把“项目报告”和“记忆数据包”耦合在一起。

如果未来确实要把项目数据迁到 memory-service，也应该新增明确的项目报告接口，而不是复用现有 `/export`。

### 4.3 不建议第一版就做真实 Jira/GitHub/Confluence 聚合导出

当前同步本身还是 mock。

如果导出功能第一版就绑定“真实多源聚合”，任务边界会从“导出功能”膨胀成“数据源建设 + 报表建设 + 下载能力”。

---

## 5. 建议采用的实现方向

### 5.1 V1 目标

第一版建议明确做成：

**从当前仪表盘项目数据生成结构化 JSON 报告，并在前端触发下载。**

### 5.2 V1 范围

支持：

- 单项目导出
- 全部项目导出
- 带元数据的 JSON 文件
- 基础汇总统计
- 明确文件名

暂不支持：

- PDF
- Excel / CSV
- 后端 zip 打包
- 真实多源聚合报表

---

## 6. 细化实施计划

## Phase 0: 先补需求收口

目标：把导出功能边界写死，避免实现中途换目标。

要确认的决策：

1. V1 是否只做 JSON
2. 是否同时支持“当前项目导出”和“全部项目导出”
3. “全部项目导出”返回单个 JSON 文件还是多个文件
4. 导出内容是否只基于 dashboard 当前数据
5. 是否需要包含 Jira 列表、平台状态和 milestone 明细

建议直接定成：

- 格式：JSON
- 范围：单项目 + 全部项目
- 文件数：一个文件
- 数据源：当前 dashboard 数据
- 下载方式：前端 Blob 下载

交付物：

- 一份固定 report schema
- 一份固定文件命名规则

---

## Phase 1: 定义 report schema

目标：把“报告长什么样”先定下来。

建议新增一个纯类型定义层，比如：

- `src/components/dashboard/types/report.ts`
- 或 `src/utils/projectReport.ts`

建议 schema 至少包含：

```ts
interface ExportMetadata {
  version: string;
  exportType: 'project_dashboard_report';
  scope: 'single_project' | 'all_projects';
  exportedAt: string;
  exportedTimestamp: number;
  source: 'dashboard_memory';
}

interface ProjectSummary {
  projectId: string;
  projectName: string;
  description?: string;
  totalMilestones: number;
  totalTasks: number;
  taskStatusCounts: Record<string, number>;
  taskTypeCounts: Record<string, number>;
  platformStatusCounts: Record<string, number>;
  jiraIssueCount: number;
}

interface ProjectReportFile {
  metadata: ExportMetadata;
  summary: {
    totalProjects: number;
    totalMilestones: number;
    totalTasks: number;
  };
  projects: Array<{
    summary: ProjectSummary;
    milestones: MilestonePoint[];
    tasks: FishboneTask[];
  }>;
}
```

这一步必须定清楚两个规则：

1. 状态统计是否先做 normalize
2. 全量导出时 `projects[]` 的字段是否与单项目导出保持同构

建议保持同构，这样前端和未来导入工具都更容易复用。

---

## Phase 2: 抽离纯报表生成逻辑

目标：让“生成报表”成为纯函数，不要直接塞在消息处理器里。

建议新增纯函数：

- `buildProjectReport(projects, options)`
- `buildProjectSummary(project)`
- `normalizeTaskStatus(status, type)`

建议把当前 `DashboardDataManager.exportProjectReport()` 改为：

1. 先拿项目列表
2. 根据 `projectId` 或 `'all'` 选中数据
3. 调用纯函数生成报告
4. 返回结构化结果给前端

这里要顺手修掉两个问题：

1. 支持 `projectId === 'all'`
2. 对空项目、无任务项目做稳定输出

建议返回结构：

```ts
{
  success: true,
  fileName: string,
  mimeType: 'application/json',
  data: ProjectReportFile
}
```

不要只返回 `report`，否则前端还要自行猜文件名和类型。

---

## Phase 3: 前端补齐下载闭环

目标：点击按钮后，真的下载文件。

`src/components/dashboard/ProjectDashboard.tsx`

建议改动：

1. 增加 `isExporting` 状态，避免重复点击
2. 调用 `QUICK_ACTION/export_report`
3. 成功后用 Blob 触发下载
4. 失败时给出清晰错误提示

下载方式建议直接复用已有模式：

1. `JSON.stringify(data, null, 2)`
2. `Blob`
3. `URL.createObjectURL`
4. `a.download = fileName`
5. `a.click()`

文件名建议：

- 单项目：`project-report-${projectId}-${timestamp}.json`
- 全量：`project-report-all-${timestamp}.json`

这里还需要补一个交互决策：

- 当前页面顶部按钮是导出“全部项目”
- 如果后面要导出“当前项目”，建议在项目卡片级别再加一个按钮，或弹出选择器

---

## Phase 4: 补测试

目标：避免导出一改字段就悄悄坏掉。

建议至少覆盖这些测试。

### 4.1 单元测试

测试纯函数：

- `buildProjectSummary()`
- `normalizeTaskStatus()`
- `buildProjectReport()`

覆盖场景：

- 单项目
- 全部项目
- 空任务
- 空里程碑
- 未知状态值
- 平台字段缺失
- jira 列表缺失

### 4.2 消息层测试

覆盖：

- `QUICK_ACTION + export_report + single project`
- `QUICK_ACTION + export_report + all`
- 错误 projectId

### 4.3 手工验收

至少走一遍：

1. 点击导出，浏览器下载成功
2. 文件名正确
3. JSON 可解析
4. 统计字段与页面数据一致
5. 扩展后台重载后行为仍可预期

---

## Phase 5: 同步文档

目标：让文档与实际功能一致。

建议更新：

- `docs/features/project_dashboard_usage_guide.md`

需要写清：

- 当前支持 JSON 导出
- 支持单项目 / 全部项目的实际范围
- 当前数据源的限制
- 不承诺是 Jira/GitHub/Confluence 的真实权威报表

如果后面导出协议稳定，再补一份：

- `docs/features/project_dashboard_export.md`

专门说明导出格式和字段。

---

## 7. 验收标准

满足下面这些，才算第一版完成：

1. 从项目仪表盘点击导出后，浏览器会实际下载 JSON 文件
2. `projectId: 'all'` 可以正确导出所有项目
3. 单项目导出和全部项目导出都有稳定 schema
4. 文件中包含导出时间、版本、范围、摘要统计
5. 汇总字段和页面展示数据可对得上
6. 没有把 memory-service `/export` 误当成项目报告接口
7. 文档已经更新到当前真实行为

---

## 8. 第二阶段可选扩展

等 V1 稳定后，再考虑下面这些。

### 8.1 PDF 导出

前提：

- JSON schema 稳定
- 页面视觉模板稳定

### 8.2 服务端项目报告接口

如果后续项目数据真正迁到 memory-service，可以新增明确接口，例如：

- `POST /projects/export-report`

而不是继续复用现在的 `/export`。

### 8.3 真实数据源聚合

前提：

- Jira / GitHub / Confluence 的同步链路不再是 mock
- 项目实体与 dashboard 模型的映射关系已确定

---

## 9. 推荐执行顺序

如果按最稳妥方式推进，我建议顺序是：

1. 定义 V1 范围，只做 JSON 项目报告
2. 先抽纯函数和 report schema
3. 修 `projectId: 'all'`
4. 接前端下载逻辑
5. 补测试
6. 更新文档

这个顺序的好处是：

- 变更面最小
- 不会误入 memory-service 的导出语义
- 可以先把“按钮点击后能产出稳定文件”这件事真正做完

---

## 10. 结论

基于当前代码，**最合理的导出功能第一版不是“打通 memory-service 通用导出”，也不是“直接做 PDF”**，而是：

**把项目仪表盘现有按钮真正补成可下载的 JSON 项目报告功能。**

先把下面三件事做实：

1. 明确导出协议
2. 支持 single / all 两种范围
3. 完成浏览器下载闭环

这之后再考虑 PDF、服务端导出或真实多源聚合，整体返工会小很多。
