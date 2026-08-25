# Roadmap 甘特 & 人员视图体验改进 Plan

> 状态：**已落地 roadmap-service**，7 项全部实现并在真实 dev server（backend + Vite web）里手动 + 脚本化验证通过；新增/更新的 vitest 用例全绿（143 passed）
> 配套 demo：`docs/demo/roadmap-demo.html`（设计原型，真实实现的交互与动效与其一致）
> 代码走读基线：2026-08-25 develop 分支；落地完成：2026-08-25

覆盖 7 项（5 个原始需求 + 复盘追加的 2 项）：

| # | 需求 | 状态 | 真实实现位置 |
|---|------|-----------|------------------|
| 1 | 甘特时间轴缩放（无按钮，手势优先） | ✅ 已实现并验证 | `web/src/composables/useGeometry.ts`（`DAY_W` 改 ref）+ `GanttPanel.vue`（wheel/dblclick + localStorage 持久化） |
| 2 | 创建 Jira 回传 key 后，草稿名留作备注名 | ✅ 已实现并验证 | `src/core/TeamService.ts` resolve_draft / resolve_item（`alias = COALESCE(alias, title)`）+ `useRoadmapContract.ts` shouldWrapAlias |
| 3 | 清空备注名回车 = 恢复原 ticket summary | ✅ 复核确认原本已正确工作，无需改动 | `web/src/components/GanttRow.vue` saveAlias（端到端走读 + 浏览器实测均正常） |
| 4 | 人员视图标识子任务所属主任务 | ✅ 已实现并验证 | `web/src/components/ResourceView.vue` + `useRoadmapContract.ts`（epicColor/epicShort）+ `GanttPanel.vue`（工具栏图例） |
| 5 | 聚焦「正在做」，其余任务一键**延至下周** | ✅ 已实现并验证 | `ResourceView.vue`（选择/预告/影子 UI）+ 新 intent `defer_subs`（`TeamService.ts` + `types.ts` + `useRoadmapApi.ts`/`useRoadmapState.ts`） |
| 6 | 人员视图时间窗平移（双指左右滑） | ✅ 已实现并验证 | `ResourceView.vue`（纯前端，缓冲渲染 + transform + settle） |
| 7 | 车道装箱排序修复（横向接排） | ✅ 已实现并验证 | `ResourceView.vue` `tasksOf()` 排序 |

## 落地后的验证方式

- `npx vitest run`：143 个用例全绿，含新增的 `TeamService.deferSubs.test.ts`（5 例：整体移动/Epic 端钳制/已顶死/幂等/跳过无效 id/缺 targetStart 报错）与 `resolve_item`/`resolve_draft`/`roadmapContract` 的别名保留、`epicColor`/`shouldWrapAlias` 用例。
- 真实 dev server（`npm run dev` + `npm run dev:web`，`better-sqlite3` 需先 `npm rebuild` 匹配本机 Node 版本）+ Browser 工具手动/脚本化操作：缩放锚点保持、备注名清空回退、Epic 归属色条/前缀/图例/hover 高亮、车道横向接排、时间窗平移像素级对齐（0px 误差）+ transform 跟手、聚焦多选/跨人重置/Esc 退出、顺延执行（含 Epic 端钳制与顶死）、幂等性、Jira Target 回写队列触发，均通过。
- 测试用临时团队/数据已从本地 `roadmap-service/data/roadmap.db` 清理干净，未影响原有 `扩展引导验证` 团队数据。

---

## 1. 甘特时间轴缩放

### 交互设计（demo 已实现）

不用按钮，全部走大家已有肌肉记忆的手势（地图 / Figma / Miro 的惯例）：

- **触控板双指捏合**：浏览器把捏合映射为 `ctrlKey + wheel` 事件，甘特任意位置都可缩放；**光标下的日期钉住不动**（缩放锚点），不会缩完找不到刚才看的位置。
- **⌘ + 滚轮**：鼠标用户的等价手势（`metaKey + wheel`）。
- **时间标尺上双指上下滑动**：标尺（月份行 / Sprint 标尺）没有纵向内容，纵向滚动在这里没有歧义，直接映射为缩放——这正是「在时间卡尺上滑动双指」的直觉；横向滑动仍是平移，不拦截。
- **双击标尺**：非 100% → 复位默认缩放；已是 100% → 「适应全部」（整条时间轴收进视口）。
- **缩放反馈**：右上角浮出短暂提示「缩放 143% · 视野约 3.1 个月」，900ms 后淡出，用户始终知道自己在什么高度看图。

范围：`DAY_W ∈ [2.2, 24]`px/天（默认 7）。约 2.2 时一屏能看 2 个季度，24 时按天级别精排。

关键手感细节（demo 已调）：
- 捏合的 wheel delta 步进小，系数取大（0.014）；标尺双指滚动 delta 大，系数取小（0.004）；`deltaMode===1`（行模式）单独适配。
- 指数缩放 `factor = exp(-deltaY * k)`，放大缩小对称。
- wheel 连发用合帧（rAF / 16ms timer）聚合成一次重渲染。
- 锚点算法：记录 `anchorDay = (scrollLeft + cursorX) / DAY_W`，重渲染后 `scrollLeft = anchorDay * DAY_W' - cursorX`。

### 真实实现

现状：`useGeometry.ts:2` 的 `export const DAY_W = 7` 是模块常量，全站无任何 zoom/wheel 逻辑。

1. `useGeometry.ts`：`DAY_W` 常量 → `export const dayWidth = ref(7)`，并导出 `DAY_W_MIN/MAX/DEF`；`X()`/`dateAtX()` 改读 `dayWidth.value`。
2. 消费点改造（约 12 处，全部机械替换为响应式读取）：
   - `GanttPanel.vue`：127, 131-132, 166, 195, 211, 538, 543, 573, 1026, 1053-1064, 1077-1084, 1100-1109（表头/网格/内宽 `tl.days * DAY_W`）
   - `GanttRow.vue`：117, 243, 269（拖拽换算 `Math.round((dx+scrolled)/DAY_W)` 读实时值即可）, 949, 989
   - `useMarkerFloats.ts`：300, 305, 337, 355
3. `GanttPanel.vue`：在 `.gantt-scroll` 容器挂 `wheel`（`passive:false`）+ 表头/`.g-relruler` 的 `dblclick`；缩放提示元素挂 gantt panel 上。
4. 持久化：`localStorage['roadmap.zoom.' + teamId]`，进团队时恢复；只影响本人视图，不进 team 配置（与 rulerMode 的「临时切换」同一哲学，但缩放值本人跨刷新记忆更顺手）。
5. 人员视图不受影响（ResourceView 是百分比布局，与 DAY_W 无关）。

边界：
- 缩小后 `.rel-pro-label` 碰撞检测（GanttPanel 计算用字宽 × 字符数）会更频繁触发第二行，逻辑已按 px 计算，无需改。
- bar 内 label 在极小缩放下靠现有 `in-label/out-label` 宽度阈值逻辑自然降级。
- 初始定位滚动（`X(mStart) - 60`）在恢复缩放值之后执行。

---

## 2. 创建 Jira 回传后：草稿名 → 备注名

### 问题

现状链路（代码确认）：
1. `resolve_draft`（`TeamService.ts:1375-1401`）只写 `jira_key / is_draft`，**不动 title/alias** —— 创建完成瞬间草稿名还在；
2. 但 `refresh_from_jira`（`TeamService.ts:2164-2359`，打开页面 2s 后静默触发）会用 Jira summary 覆盖 `title`（`nextTitle = summary || sub.title`）。Agent 创建模式下 Prompt 明确允许改写 summary（`useCreateJiraAgentPrompt.ts:18`），所以**用户手打的草稿名会在第一次刷新时丢失**，甘特上的名字突然变脸。

### 方案

在 key 回传时机把草稿名固化为备注名（alias 从不被 refresh 覆盖，是唯一幸存字段）：

- `resolve_draft`（subs）：`UPDATE subs SET jira_key = ?, is_draft = 0, alias = COALESCE(alias, title), ...`
  —— 仅当用户没手动设过 alias 时写入；已有 alias 不覆盖。
- `resolve_item`（草稿 Epic 同理）：`TeamService.ts:1209-1241` 增加同样的 `alias = COALESCE(alias, title)`。
- 效果：直连 API 模式 summary == 草稿名，alias 与 title 相同（展示无差异，但后续别人在 Jira 改 summary 也不影响甘特展示名）；Agent 模式 summary 被规范化后，甘特仍显示用户手打的名字，hover 才看到正式 summary。

### 前端配套（demo 已暴露并修复的一个坑）

长英文草稿名成为 alias 后，会命中「备注名换行增高」渲染（`GanttRow.vue:116` `wrapMode = Boolean(alias)`；sub 同理 `:999-1003`），窄条上一词一行非常难看。修正：**换行模式只对短备注名生效**（`alias.length <= 40`），长备注名走单行省略 + hover 看全名。demo 中已按此实现。

「创建 Jira」弹窗逐行状态里，summary 被规范化的行显示小紫 chip「草稿名已存为备注」（hover 显示正式 summary），完成 toast 追加「草稿名已保留为备注名」。

### 测试

- `TeamService` resolve_draft/resolve_item：alias 为空 → 写入草稿名；已有 alias → 不覆盖。
- resolve 后跑 `applyRefreshFromJira` 改 summary → snapshot 展示名不变（alias 仍是草稿名）。

---

## 3. 清空备注名回车 = 恢复原 ticket summary

### 现状核实

代码走读结论：`GanttRow.vue saveAlias:417-469` 非草稿分支**已经**发 `alias: text || null`，后端 `set_alias`（items，`TeamService.ts:1064-1090`）与 `update_sub`（subs，`:1281-1359`）也能写 NULL。落地时第一步是**复现并定位真实拦截点**，重点排查：

1. `:420-424` 的空值 guard `if (!text){ toast('任务名不能为空'); return; }` 是否误伤了 alias 模式（应只拦草稿 title 模式）；
2. `update_sub` 的 alias 字段是否存在 `undefined`（未提供，不改）与 `null`（显式清空）语义混淆——空串被 `|| sub.alias` 之类的写法吞掉；
3. blur 竞态：`onAliasFocusOut:772-779` 150ms 后 `cancelAlias()`，如果 Enter 处理与 blur 抢跑会表现为「清空保存没生效」。

### 体验补齐（demo 已实现）

- 编辑器 hint 文案：备注名模式显示「Enter 保存 · 清空回车＝恢复原 ticket 名 · Esc 取消」（placeholder 原本就写了「留空恢复原名」，hint 再强化一次）。
- 清除成功后 toast「备注名已清除，恢复展示原 ticket 名」，给一个明确的完成反馈。

### 测试

- 单测：`update_sub` / `set_alias` 传空串/null → 落库 NULL → snapshot `alias: null` → 前端 `disp = alias || title` 回落 summary。
- 交互：有 alias 的 sub/item，双击 → 全选删除 → Enter → bar 立即显示 Jira summary。

---

## 4. 人员视图：子任务的主任务归属可视化

### 设计（demo 已实现）

人员视图里全是子任务，归属信息按三层递进呈现，避免糊满屏幕：

1. **左侧色条（恒在）**：每个 Epic 按甘特行序从 8 色色板取一个稳定颜色，任务条左缘 4px 色条。再窄的条也有归属信号，且不与现有「过去/当前/未来」时间配色打架。
2. **前缀 chip（条够宽才出现）**：条渲染宽度 > 110px 时，在条内 label 前加主任务名 chip（**Epic 备注名优先**，超 14 字截断），如 `[AI 会话摘要] Supervisor dashboard cards…`。
3. **hover 联动高亮**：hover 任一任务条或工具栏「主任务」图例项 → 同 Epic 的所有条高亮、其余压暗，一眼看清「这个 Epic 的活分给了哪些人」。
4. **工具栏图例**：人员视图激活时工具栏出现「主任务」图例（色点 + 备注名，hover 联动同上），tooltip 显示 Epic key + 完整 title。
5. 原有 tooltip 第三行「主任务：…」保留兜底。

### 真实实现

纯前端，无后端改动：`ResourceView.vue` 的 `TaskPair = { s, it }` 已持有父对象。

- 色板与 `epicColor(order 索引)` helper 放 `useRoadmapContract.ts` 或 ResourceView 内部；
- 图例渲染在 `GanttPanel.vue` 工具栏（`state.view === 'resource'` 时显示）；
- 前缀显隐按实际像素估算（时间带宽 × 条占比 > 110px），不要按天数比例（「全部」窗口下永远不够宽是正常的，此时只留色条）。
- 可选（非必需）：`TeamService.mapItem:198-211` 给 sub 冗余 `parentKey`，方便未来其他视图使用。

---

## 5. 聚焦「正在做」+ 其余任务一键延至下周

### 顺延语义（2026-08-25 复盘后定稿：「延至下周一」，不是「+7 天」）

> 复盘输入：+7d 语义下「只选中 NOVA-18191 时，进行中的 NOVA-18190 没被移动」不符合直觉；
> 且很远的任务不该被动。改为**延至下周一**语义，理由：
> 心智模型是「这周专注选中的，其余下周再排」——所有延后任务落在同一个周一，形成干净的周节奏；
> 且天然**幂等**（延完的任务开始日 ≥ 下周一，再按一次不会越推越远）。按钮相应命名为「**其余延至下周**」。

精确规则（demo 已实现并验证）：

- **顺延对象** = 该成员**未选中** && **未清理** && **开始日 < 下周一** && **尚未结束（结束日 ≥ 今天）** 的任务：
  - **已开始未做完的同样延后**（现实是这周不做它了，包括正在跨今天的条）；
  - **已结束（结束日 < 今天）的是历史记录，不动**；
  - **开始日已在下周一及以后的「远任务」不动**（本来就不占本周）。
- **动作** = 开始日移到**下周一**（今天是周一则取下周一），**任务长度不变**，Target End 随 start 平移；
- **Epic end 钳制**：`shift = min(距下周一天数, Epic 甘特结束日 − 任务结束日)`，钳制后落点早于下周一的标注「未到下周一」；`shift ≤ 0` 的顶死不动；
- Epic end 采用甘特条结束日（`start_date + days - 1`）。Jira `target_end` 只是镜像，不作约束（与全站现状一致，显式记录该决策）；
- 已知取舍：多条任务同落下周一会在该成员行**并行分层**——这是诚实的「下周积压」呈现，用户可再手动错开。

### UX 设计（demo 已实现，含决策理由）

1. **单击任务条 = 标记「正在做」**（无需修饰键）。选中条橙色描边 + ✓ 角标。再次单击取消。
   - *为什么不用 ⌘/Shift 多选*：选中集的语义是「这个人正在做的事」，天然按人隔离，普通单击连点即多选，成本最低；
2. **点到另一个成员的任务 → 对那个人重新开始多选**（原选择自动清空）；首次选中弹一次性引导 toast。
3. 选中后该成员行进入聚焦态（底色变暖、无关条压暗），**成员名下方出现操作点**（就近原则）：
   - 状态行「✓ 正在做 N · 待延至下周 M」；
   - 主操作「**其余延至下周 →**」；无可移任务时禁用；
   - ✕ 退出（Esc / 点空白处等效）。
4. **落点预告**：待延条角标显示 `→下周一` / `→09-13`（琥珀 = 被 Epic 钳制未到下周一）/ `✕`（顶死不动）；**hover 主操作按钮 → 虚线影子预览每条落点**（钳制影子标注「未到下周一（Epic 限制）」），先看后动。
5. **执行**：任务条平滑动画滑到新位置 → toast 汇总「已将 N 个任务延至下周一（MM-DD）开始，X 个受 Epic 限制未到下周一；Y 个顶死未动」→ **非草稿任务批量回写 Jira Target Start/End**。选中集保留；幂等，再按一次无变化。
6. 协作安全：他人经 SSE 改动导致重渲染时选中集不丢（demo 已验证：协作模拟移动 Epic 后，钳制角标实时重算且选择保留）。
7. 配合「时间窗平移」（见 §6）：成员先领取了很后面的任务时，滑到时间后方把它标记「正在做」，再回来一键把眼前的任务延至下周。

### 真实实现（已落地）

前端（`ResourceView.vue`）：
- 选择态 `resSel = ref<{ person: string | null; ids: Set<string> }>`（`'__un'` 代表未分配行）；bar 加 `@click`/`sel`/`will-move`/`at-cap` 类名 + `.rb-shift` 落点角标；操作点（`.rp-focus`）渲染进 `.rp-info`；hover「其余延至下周」渲染 `.res-bar.ghost` 预览层，复用现有百分比几何；Esc 与点击空白（`.res-view` 上排除 `.res-bar/.rp-focus/...` 的背景点击）都会退出聚焦；切团队 / 切「近 2 周·全部」会连同 §6 的 `resOffset` 一起复位。
- 下周一由**客户端算好后作为 `targetStart` 显式传给后端**，避免服务端时区歧义；前端的 `deferPlan()`（预告角标/影子用）与后端算法必须保持一致，已在两侧代码注释互相引用。

后端：新 intent **`{ op: 'defer_subs', subIds: string[], targetStart: 'YYYY-MM-DD' }`**（`TeamService.ts` `applyIntent` 内一个新分支）：
- 逐条读取 sub + 其 parent item，`shift = min(diffDays(sub.start, targetStart), diffDays(subEnd, epicEnd))`；`shift > 0` 才移动 `start_date`（`days` 不变），bump version；返回 `{ moved, capped, stuck }`（**subId 数组**，不是计数——前端要用它们精确定位需要回写 Jira 的那几条）；`moved.length` 时写一条聚合 activity。
- **范围裁剪（相对最初方案的简化，记录取舍）**：去掉了 `baseVersions` 乐观并发参数——这是一个批量整理未来待办的低风险操作，真发生并发冲突时让下一次刷新自然纠正即可，不值得为它做「部分 409」的复杂语义。服务端也**不**检查「是否已过期」——那是纯前端概念（`isDeferCandidate`），服务端只按 Epic 跨度钳制；调用方必须在拼 `subIds` 前自己过滤远任务/已完成任务（`TeamService.deferSubs.test.ts` 里专门有一条用例记录了这个边界，别指望服务端兜底）。
- `src/types.ts` `IntentOp` 增加 `'defer_subs'`；`useRoadmapState.ts` `INTENT_ERROR_TEXT` 增加 `target_start_required`。
- 新增 `deferSubs()`（`useRoadmapApi.ts`）+ `deferSubsToNextMonday()`（`useRoadmapState.ts`）——**没有走通用的 `applySnapshotFromIntent`**，因为这是唯一需要拿到 `deferSummary`（而不只是 snapshot）的调用方；409 冲突时的处理与通用路径一致（toast + 重新拉取快照）。
- Jira Target 回写：`ResourceView.vue` 执行完成后 `emit('defer-committed', movedSubIds)`；`GanttPanel.vue` 监听后从最新 snapshot 里查出这些 sub 的当前 start/days，复用已有的 `scheduleTargetDateSync`（同一套 debounce/凭据优先级/防抖 in-flight 保护），无需新建同步逻辑。

### 测试（已通过）

- 后端 `TeamService.deferSubs.test.ts`（5 例，全绿）：整体移动到 targetStart / 被 Epic 端钳制 / 已在 targetStart（顶死不动）/ 幂等（二次调用 `moved: []`，version 不变）/ 跳过不存在或缺日期的 subId 不影响批次其余项 / 缺 `targetStart` 报 `target_start_required`。
- 浏览器手动 + 脚本化交互验证：单击多选、跨人切换重置、Esc/点空白退出、hover 影子预览（含钳制态文案）、执行后 toast 文案与 DB 落库一致、按钮在无可移项时禁用（幂等场景下自动禁用）、「近 2 周」窗口外的候选按数据计入（不受可见窗口限制）。

---

## 6. 人员视图：时间窗平移（双指左右滑动）

### 动机

顺延功能的典型前置动作是「成员先领取了一个很后面的任务」——需要滚动到时间后方去选中它。现状「近 2 周」窗口固定从今天开始，看不到前后。

### 设计（demo 已实现；2026-08-25 复盘后升级为「丝滑版」）

> 第一版按「deltaX 攒满一天 → 整页重渲染平移一天」实现，动作被量化成 ~50px 的跳格，不跟手。
> 定稿方案：**缓冲渲染 + transform 跟手 + 落格弹性归位**，滑动期间零 DOM 重建。

- **近 2 周模式下，触控板双指左右滑动 = 整窗平移**（窗口长度 14 天不变）；纵向滚动仍是成员列表滚动，互不干扰；
- **丝滑机制**：
  1. 渲染时按 **3 倍窗宽**出内容（可视窗两侧各预渲染一个窗口宽的缓冲）：表头日期格、日网格线、今天线、任务条都装进每行的平移层（`.res-pan` / 表头 `.res-days-pan`，`will-change: transform`）；
  2. 滑动期间只写 `translateX`，**1:1 跟手**、继承触控板原生惯性（momentum wheel 事件天然延续），不重建任何 DOM；缓冲内容直接滑入视野；
  3. 手势停止 140ms 后 **commit**：偏移量四舍五入落格到整天、重渲染重居中，**亚天残差用 0.18s 弹性动画归零**（避免落格瞬跳）；滑满一个缓冲宽提前 commit 再继续；
  4. 「更早/更晚」角标与「回到今天」也走同一 transform 动画路径（跨度超出缓冲时直接重渲染）。
- 两端「◂ N 更早 / N 更晚 ▸」角标**可点**：动画平移两周；
- 平移后表头显示当前区间「（10-09 → 10-22）」并出现「**回到今天**」按钮；点工具栏「近 2 周」也会回到今天；
- 「全部」模式不需要平移（已覆盖整条时间轴）；
- 选中集（§5）跨平移保留——这是配合聚焦功能的关键（demo 验证：滑到后方选中远任务，回到今天后选中仍在，操作点立即可用）。

### 真实实现

- `ResourceView.vue`：
  - `resOffset = ref(0)`（天，commit 时才变）；`winS = addD(today, resOffset)`；渲染区间 `[winS − 14, winE + 14]`，`pct()` 坐标系仍以可视窗为基准（缓冲内容为负 / 超 100%）；
  - 每行时间带加 `.res-pan` 绝对定位层（`overflow: hidden` 在 strip 上），表头日期行加 3 倍宽平移层；「更早/更晚」角标留在层外锚定；
  - 容器 `wheel` 监听（`passive:false`，只拦 `|deltaX| > |deltaY|`）：累积 px → 直接 transform；停 140ms 或滑满缓冲后 commit；像素→天换算用实际带宽（`(clientWidth − 236) / 14`），保证手感 1:1；
  - commit 后残差用 `.settle{ transition: transform .18s }` 归零（设初值 → 强制 reflow → 置 0）。
- **表头与时间带的像素对齐（demo 踩过的三个坑，落地时必检）**：
  1. 3 倍宽的表头平移层若作为 flex item，默认 `flex-shrink:1` 会被容器压缩（`width:300%` 失效、格子变窄错半格）——必须 `flex:none; min-width:300%`；
  2. 表头日期格不要用 `flex:1` 均分（42 个格子的亚像素分配会累积 ~2px 漂移）——改为绝对定位，`left: i/42*100%; width: 100%/42`，与 strip 网格线（`left: i/14*100%`）走同一 % 坐标数学；
  3. 表头列与时间带列的**盒模型必须一致**：`.res-strip` 有 `border-left:1px`（内容坐标系内缩 1px），`.res-days` 也要加同样的 border，否则整体错 1~2px。
  修完的验收断言：任一网格线与最近表头格左缘的偏差 < 0.5px（demo 实测 0.008px，平移落格后不变）。
- 状态属会话级 UI 状态，不持久化、不同步他人。
- 测试关注：滑动期间不触发 intent / 不打断 SSE 重渲染（SSE 到达时若正在滑动，可延后到 commit 一起重渲染）。

---

## 7. 人员视图车道装箱修复（顺带发现的 bug）

现状 `ResourceView.vue placeLanes()`（demo 同构逻辑）是贪心装箱，但**输入没有按开始时间排序**（按 Epic 行序 × sub 顺序收集）。贪心装箱的正确性前提是 start 升序：乱序输入虽不会重叠（占位条件保证 lane 结束日单调递增），但会**多开不必要的车道**，本可横向接排（后一个任务开始日在前一个结束日之后）的任务被拆到多行。顺延功能大量改写 start 后必现。

修复：装箱前 `sort((a,b) => a.start − b.start || b.days − a.days)`（同日开始的长任务优先，短任务更容易接到其它车道尾部）。demo 已修并验证：Vivi 行 4 条任务 = 长任务独占一道 + 两条不重叠的任务横向共享一道 + 重叠任务另起一道。

---

## Demo 速览（docs/demo/roadmap-demo.html）

- **缩放**：任务视图里捏合 / ⌘+滚轮；把光标放在顶部时间标尺上双指上下滑；双击标尺复位/适应全部。右上角出现缩放提示。
- **草稿名→备注名**：把顶栏切到「已安装」，点「创建 Jira」，填写 Prompt（Agent 模式），执行后弹窗逐行出现「草稿名已存为备注」，甘特展示名不变，hover 看被规范化的正式 summary。
- **清空备注名**：双击非草稿 bar，清空输入回车 → toast「已清除，恢复展示原 ticket 名」。
- **主任务归属**：切「人员」视图 → 条左色条 + 前缀 chip + 工具栏「主任务」图例，hover 联动高亮。
- **聚焦 + 延至下周**：人员视图点 Vivi Wang 的任务多选「正在做」（Epic「AI 会话摘要」下预置了 进行中 / 下周一前将开始 / 长任务贴 Epic 末（钳制）/ 远任务（下周后，不动）的组合数据）→ 左侧操作点显示「✓ 正在做 N · 待延至下周 M」→ hover「其余延至下周 →」看虚线落点影子 → 点击执行：候选统一延至下周一、长度不变，远任务与已结束的不动，非草稿回写 Jira Target Start/End；再按一次无变化（幂等）。约 16 秒后协作模拟把该 Epic 提前 4 天，可观察钳制角标实时变化且选择保留。
- **时间窗平移**：人员视图「近 2 周」模式下双指左右滑动——1:1 跟手（带触控板惯性），松手后落格到整天并弹性归位；或点「◂ 更早 / 更晚 ▸」角标动画平移两周；平移后表头出现「回到今天」。滑到后方选中远任务再回来执行顺延，选中不丢。

## 落地记录

全部 7 项已按下面顺序实现并验证，一次性完成（同一天内）：

1. **#3 清空备注名** —— 复核结论：现状代码端到端已经正确工作（`saveAlias` 的空值 guard 只拦草稿 title 模式，`update_sub`/`set_alias` 都能正确写 NULL），浏览器实测确认清空后正确回落到 Jira summary。**无需改动**。
2. **#2 resolve 时固化 alias** —— `TeamService.ts` 的 `resolve_item`/`resolve_draft` 两处补 `alias = COALESCE(alias, title)`；`useRoadmapContract.ts` 加 `shouldWrapAlias`（≤40 字符才换行），`GanttRow.vue` 两处 wrap 判断改用它。
3. **#4 主任务归属 + #7 车道排序修复** —— `useRoadmapContract.ts` 加 `epicColor`/`epicShort`；`ResourceView.vue` 加色条/前缀 chip/hover 高亮 + `tasksOf()` 排序修复；`GanttPanel.vue` 工具栏加「主任务」图例；`useRoadmapState.ts` 加共享的 `hoveredEpicKey`。
4. **#1 时间轴缩放** —— `useGeometry.ts` 的 `DAY_W` 改为 `ref`（约 12 处消费点按脚本/模板上下文分别补 `.value` 或利用模板自动解包）；`GanttPanel.vue` 加 wheel/dblclick 处理 + 缩放提示 UI + 按团队 localStorage 持久化。
5. **#6 时间窗平移** —— `ResourceView.vue` 加 3 倍窗宽缓冲渲染 + transform 跟手 + 140ms 落格 + settle 弹性动画；表头与时间带按同一套 `inset:0` + 百分比坐标（而非「3 倍宽 + 负 margin」）以保证像素对齐。
6. **#5 聚焦 + 延至下周** —— `ResourceView.vue` 加选择/预告/影子 UI；新 intent `defer_subs`（`TeamService.ts`/`types.ts`）；`useRoadmapApi.ts`/`useRoadmapState.ts` 加专用的 `deferSubs`/`deferSubsToNextMonday`（跳过通用 `applySnapshotFromIntent`，因为要拿 `deferSummary`）；`GanttPanel.vue` 监听 `defer-committed` 事件触发已有的 Jira Target 回写。

验证：`npx vitest run` 143 例全绿（含新增 `TeamService.deferSubs.test.ts` 与 `roadmapContract`/`TeamService.items` 的别名保留用例）；真实 dev server 上用 Browser 工具做了完整的手动 + 脚本化交互验证（见上文各节「测试」小节）。
