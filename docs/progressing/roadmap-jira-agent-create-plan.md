# Roadmap 草稿任务创建 Jira：双路径（直连 API / Agent 执行器）Plan

日期：2026-08-08
来源：roadmap-service 现状源码核对 + `docs/demo/roadmap-demo.html` 原始设计对照 + 用户需求
关联：[agent-executor-architecture-plan.md](./agent-executor-architecture-plan.md)（Agent 路径复用其 Block A/B/H 的执行器 registry 与任务控制面）
Demo：`docs/demo/roadmap-demo.html`（本次已按最终交互更新，见 §6）

---

## 1. 背景与目标

Roadmap 页面上快速添加的 draft task（`subs.is_draft=1` 与无 `jira_key` 的手工 item）需要批量创建成 Jira issue。demo 原设想是**纯 prompt 交给 AI 创建**（能用技能、自动填当前 Sprint 等动态字段）；实际上线的却是**纯确定性直连**（extension 直调 Jira REST），prompt 从未实现。

目标行为（本 plan 的最终定义）：

1. **Prompt 是可选项**，模式完全由 prompt 是否为空决定：
   - **留空** → 按下方字段直连 Jira API 创建（走现有 extension token 路径）。
   - **填写** → 交给 **Agent 执行器**创建：出现执行器选择（无配置则引导去配置）；下方**已填**的字段作为硬性约束一并带给 Agent，**未填**字段由 Agent 决定。
2. **字段占位联动**：prompt 非空时，下方字段 placeholder 显示「自动 · 由 Agent 决定」。
3. **fixVersion 自动填**：团队配置了发布时间表（Release Train Ruler）时，fixVersion 按任务 **Target End 落点**对应的 release name 自动填入；批量任务跨 release 时逐条匹配（列表内逐行显示 chip），字段输入固定值可覆盖全部。

## 2. 现状对照（源码事实）

| 事实 | 位置 |
|---|---|
| 上线创建弹窗只有 3 个字段（Project Key / 主任务类型 / 子任务类型），无 prompt，名字叫 AiCreateModal 但完全确定性 | `roadmap-service/web/src/components/modals/AiCreateModal.vue:218-239`，运行循环 `:113-200` |
| 创建经 postMessage bridge 交给插件，payload 只带 project/issuetype/summary/(parent 的 target 日期)，**没有 sprint / fixVersion / team / assignee 槽位** | `web/src/composables/useExtensionBridge.ts:137-150`（120s 超时）、`useRoadmapContract.ts:252-340` |
| 插件侧字段组装 + createmeta 门控在 `buildJiraCreateFields`；`buildFieldValue` 已按 schema.type 匹配 allowedValues（不匹配则丢字段不失败）——**fixVersions/Sprint 就该在这里扩展** | `src/jiraCreateMeta.ts:232-281`、`:297-325`；行为钉在 `src/__tests__/jiraCreateFields.test.ts`（`npm run verify:roadmap-jira-create-fields`） |
| 创建成功后回写走 `resolve_draft` / `resolve_item` intent（幂等） | `roadmap-service/src/core/TeamService.ts:1216-1242`、`:1059-1091` |
| 发布时间表按团队存 `teams.release_sheet_json`（Release/Phase/Date 三列）；**`catchRelease(end, parsed)` 已经是「end 之后最近一班 Pro」原语**，返回 `{release, date}`——fixVersion 自动填直接用它 | `roadmap-service/src/storage/schema.sql:13`、`web/src/composables/useReleaseRuler.ts:336-353`（demo 版 `:1265-1271`） |
| roadmap-service 里**没有任何 Sprint 字段**；"当前 Sprint" 只是渲染时由分割节点切段算出，从未持久化 | `web/src/components/GanttPanel.vue:124`、`useReleaseRuler.ts:315-333` |
| prompt 的种子还在：`localStorage['personalroadmap.aiPrompt']` 读写函数（无人引用）、legacy bridge 签名 `createJiraTasks?(prompt, drafts)`（无人调用） | `web/src/composables/useRoadmapApi.ts:7,43-52`、`web/src/vite-env.d.ts:11-21` |
| demo 原设计：单个 prompt textarea + 逐条「AI 创建中」，默认 prompt 明说 Sprint/fixVersion/Team 三个动态字段 | `docs/demo/roadmap-demo.html`（本次改版前 `:977-995`、`:2768-2799`） |
| Jira 凭据：直连路径用插件 Options 的 `JIRA_API_TOKEN`；roadmap-service 服务端 PAT 只用于 target 日期回写与子任务查询，**没有创建 issue 的路由** | `web/src/components/GanttPanel.vue:296-333`、`roadmap-service/src/routes/api.ts:68-295`、`src/core/JiraClient.ts` |

**结论**：双路径 = 把 demo 的 prompt 设想和已上线的直连路径合并进同一个弹窗；服务端（roadmap-service）**零改动**，改动集中在 web 弹窗、bridge 契约、插件字段组装，Agent 路径复用 memory-service 的 agent task 控制面。

## 3. 交互设计（与更新后的 demo 一致）

弹窗「创建 Jira」，标题旁模式徽标随 prompt 实时切换：`直连 API`（蓝）↔ `AGENT 执行器`（紫）。

```
创建 Prompt（可选）        [textarea，记住上次内容]
Agent 执行器              [仅 prompt 非空显示；单选 chip：我的 OpenClaw / 本机 Codex…]
                          [无配置 → 引导链接「去插件 Options 配置」]
Project Key | 主任务类型 | 子任务类型     ← prompt 非空时 placeholder =「自动 · 由 Agent 决定」
fixVersion  | Sprint
待创建任务（N）           [逐行：Epic key · 标题 · fixVersion chip · 状态]
                    [取消] [开始创建]
```

规则：
- **模式判定**：`prompt.trim() !== ''` ⇒ Agent 模式。无独立开关。
- **约束语义**（Agent 模式）：已填字段 = 硬约束，随任务下发；未填 = Agent 决定。字段值不清空、两模式共享。
- **fixVersion 自动填**（两种模式都生效）：
  - 未配置发布时间表：placeholder 提示去配置；
  - 全部任务落同一 release：字段直接填入该 release name；
  - 跨 release：字段留空、placeholder「自动 · 按各任务 Target End 匹配」，列表逐行显示各自 release chip（无匹配显示灰 chip）；
  - 用户输入固定值 ⇒ 覆盖全部。
- **Sprint 字段**：直连 v1 不支持（需要 Agile API + board 配置），注释文案引导用 Prompt；Agent 模式未填时由 Agent 查当前 sprint 自动填。
- **执行器**：记住上次选择（`personalroadmap.aiExecutor`）；无可用执行器时「开始创建」被引导态拦截。

## 4. 技术方案

### 4.1 P1｜直连路径增强：fixVersion（独立可发，无外部依赖）

1. **web**：`AiCreateModal.vue` 增加 fixVersion 字段与逐条计算——`catchRelease(addD(sub.start, sub.days-1), teamRelParsed())`（`useReleaseRuler.ts:336`）。`useRoadmapContract.ts` 的 `CreateJiraParent/Child` 增加可选 `fixVersion?: string`（每条各自带，覆盖值时统一）。
2. **插件**：`src/jiraCreateMeta.ts`
   - 新增系统字段常量 `fixVersions`（非 customfield）；
   - `buildJiraCreateFields` 在 `supportsField` 门控下输出 `fixVersions: [{...}]`；
   - 匹配策略（在 `buildFieldValue` 基础上扩展）：exact match → **唯一后缀匹配**（`allowedValue.name` 以 release name 结尾，解决「表里叫 26.3.220、Jira 里叫 Nova 26.3.220」的前缀差）→ 匹配不到或有歧义则丢字段并把 warning 带回结果（不阻断创建）；
   - 补 `jiraCreateFields.test.ts` 用例（array schema、后缀匹配、歧义丢弃）。
3. **服务端**：无改动。fixVersion 不落库，打开弹窗时实时计算。

### 4.2 P2｜Agent 路径

**数据流**：
```
弹窗（prompt+executor+约束+草稿组）
  → bridge 新消息 pai-roadmap-agent-create（useExtensionBridge.ts 加类型）
  → 插件 background → memory-service POST /agent-tasks/execute
      { taskId: roadmap:{teamId}:{groupHash}, executor: <executorId>,
        task: <组装后的任务文本>, notify: false,
        idempotencyKey: roadmap_create:{teamId}:{sorted draftIds hash},
        triggerSource: 'roadmap_create_jira' }
  → 页面经 bridge 轮询 GET /agent-tasks/runtime-status?ids=roadmap:{...}（5s 间隔）
  → 成功 artifact 中解析 {mappings:[{draftId, jiraKey}]} → 逐组 resolve_draft / resolve_item
```

**任务文本组装**（插件侧模板，不信任页面自由拼接）：用户 prompt + 上下文（团队名、parent epic key/title、每条草稿的 title/targetStart/targetEnd/建议 fixVersion）+ 硬约束字段 + **结果契约**：必须返回可验证 artifact，content 为 JSON `{mappings:[{draftId, jiraKey}]}`，metadata 带 entityKey（Jira key）——直接复用 memory-service 现有 artifact 校验（`hasVerifiableArtifact`）。

**幂等与部分成功**：idempotencyKey 确定性（重复点击复用同一 run）；artifact 带 partial mappings 时先 resolve 已建成功的，剩余行标失败可单独重试。`resolve_draft` 本身幂等，重复回写安全。

**批量粒度**：沿用现有 `buildDraftGroups`（每个 parent 组一个 agent task），与直连两阶段语义一致，失败影响面小。

**依赖与风险**：
- 依赖 [agent-executor-architecture-plan](./agent-executor-architecture-plan.md) 一期（Block A 异步接单 + Block B `delegate_agent` + Block H registry）。**强烈建议 Block A 先落地**：当前 `/agent-tasks/execute` 是同步长链路，MV3 background service worker 的生命周期扛不住 10 分钟的挂起 fetch。
- Block A 未落地时的 v0 兜底（不推荐长期）：background 发起 execute 不等待完成、独立轮询 runtime-status，用 `chrome.alarms` 保活；接受 >5min 任务的 SW 被杀风险。
- **安全边界**：Jira token 永不交给 Agent（Agent 用自身的 Jira 能力/技能）；直连路径 token 留在插件 Options；Agent 不接收整库记忆，仅任务文本内的上下文。

### 4.3 执行器选择与引导

- **列表来源**：插件 background 调 memory-service `GET /config` 读执行器 registry（Block H 的 `agentExecutors` 过滤 enabled）+ `executorDefaults.agent_task` 作为默认选中。**Block H 未落地前的 fallback**：`openClawEnabled ? [{id:'openclaw', label:'OpenClaw'}] : []`。
- **空态引导**：弹窗内链接经 bridge 让 background 执行 `chrome.runtime.openOptionsPage()` 定位到「Agent 执行器」分组；配置完成回来点「重新检测」。
- **记忆**：页面 `localStorage['personalroadmap.aiExecutor']` 记住上次选择；仅作 UI 记忆，最终以 registry 校验为准（已停用的执行器自动回落默认）。

### 4.4 P3｜后续增强（不阻塞前两期）

- Sprint 直连：Jira Agile REST 查 active sprint（需 board id 配置，放团队级或插件 Options）。
- 行级覆盖：每行独立改 fixVersion / 类型。
- 自动路由联动：执行器选择支持「自动」档位（对接 executor plan 的 v2 能力路由）。

## 5. 阶段划分与验收

| 阶段 | 内容 | 依赖 | 验收锚点 |
|---|---|---|---|
| **P1** | fixVersion 自动填 + 直连路径扩展 | 无 | 配置发布时间表的团队打开弹窗即见自动填/逐行 chip；创建出的 issue 带 fixVersions；名字不匹配时创建不受阻且有 warning；`verify:roadmap-jira-create-fields` 新用例过 |
| **P2** | prompt + 执行器选择 + Agent 路径 | executor plan 一期（A/B/H） | 填 prompt 创建 → issue 建出且 Sprint = 当前 sprint；draftId 全部 resolve；重复点击不产生重复 issue；无执行器时出现引导并可跳 Options |
| **P3** | Sprint 直连 / 行级覆盖 / 自动路由 | P1、P2 | 按需 |

## 6. Demo 更新记录（2026-08-08 已完成）

`docs/demo/roadmap-demo.html` 已按 §3 交互改版，作为设计基准：

- 弹窗改名「创建 Jira」+ 模式徽标（`#aiModeBadge`），副标题说明双路径语义；
- `创建 Prompt（可选）`，默认空（旧版默认 prompt 文案移除，改为 placeholder 示例）；
- 新增执行器选择行（`#aiExecRow`，chip 单选，prompt 非空时滑出；`AGENT_EXECUTORS` 置空数组即可体验引导态文案）；
- 新增 Project Key / 主任务类型 / 子任务类型 / fixVersion / Sprint 字段，`syncAiMode()` 实时切换「自动 · 由 Agent 决定」占位；
- fixVersion 按 `catchRelease` 自动填：同 release 直接填值，跨 release 留空 + 逐行绿色 `fv-chip`，Sprint 字段带两模式注释文案；
- 运行模拟区分两路径（「API 创建中」450ms / 「〈执行器〉创建中」900ms），完成 toast 注明执行器；
- 帮助面板新增「创建 Jira 双路径」条目；持久化说明更新（prompt + 执行器选择）。

## 7. 开放决策点

1. **fixVersion 前缀匹配**：后缀唯一匹配（默认方案，零配置）vs 每团队「版本名模板」配置（如 `Nova {release}`）——建议先上后缀匹配，出现歧义率高再加模板。
2. **执行器列表读取**：直读 `GET /config` vs 新增轻量 `GET /agent-executors`（只暴露 id/label/enabled，不带密钥）——倾向后者，避免把 apiKey 相关字段暴露给 bridge 链路。
3. **Agent 批量粒度**：每 parent 组一个 task（当前方案）vs 整批一个——组粒度失败面小、幂等键清晰，维持现方案。
4. **通知**：roadmap 触发的 agent task 默认 `notify:false`（结果在页面呈现）；是否给长任务（>2min）补一条 Glip 通知，待用起来再定。
