# Progress Log

## Session: 2026-09-07

### Phase 1: 恢复、边界与候选盘点
- **Status:** completed
- 已完整读取仓库新能力流程、自动化历史、长期 memory 索引、`planning-with-files`、`computer-use` 与 `huashu-design` 主说明。
- 已确认上次 8 月 26 日运行未完成，本轮新建隔离 planning 记录。
- 已检查 `to-verify.md`，保留其中既有功能验证事项，不将其混入新能力选题。
- 已按 Computer Use 技能只读检查 Reminders：`Personal AI` 列表存在且显示 0 个未完成提醒；本轮无需随机选择，也不会写回 Reminder。
- 已读取 Memory Frontier 索引、progressing 全部标题与近期相邻方案 opener，建立初步语义去重地图。
- 已只读连接线上 `esone.qiu` SQLite，确认当前库规模、来源分布与主要派生表使用量；HTTP 服务本身 degraded/401，未据此误判数据不存在。

### Phase 2: 真实记忆与外部研究
- **Status:** completed
- 已修正秒级 timestamp 口径并完成最近 180 天来源、用户消息与关键词聚合。
- 已证明现有 context frame 以群聊/会话为长寿命容器，线上大量 frame 横跨多周并混入多个 topic/anchor。
- 已调研 2025–2026 事件分段、episodic memory、experience-following、context engineering 与 Microsoft Recall / ChatGPT 搜索等产品基线。
- 候选收敛为 `Memory Scene Boundary / 记忆分镜`，正在验证跨来源事件密度与去重边界。
- 最近 180 天跨来源密度复核完成：334 个小时桶有至少 2 类来源、76 个小时桶有至少 3 类来源；该结果只用于证明场景密度，不把共时直接当作同一事件。
- 已核对 AI Context Passport、Operation Flight Recorder、Memory Lens Interaction Scene Contract 与 Evidence Cohesion Gate；记忆分镜分别与“跨 AI 交接”“主动操作记录”“当前操作场景”“query-time 候选隔离”保持独立职责。

### Phase 3: 选题与完整方案
- **Status:** completed
- 已创建 `docs/progressing/memory-scene-boundary-plan.md`，先写两个脱敏真实旅程，再覆盖线上证据、去重、竞品/论文、事件模型、边界检测、UX、隐私、authority、恢复、数据/API、rollout、风险与完成定义。
- Eval 明确为实现门槛：新增 `memory-scene-boundary` suite、真实脱敏场景、reader proof、report、失败迭代，以及 recall path 的 memory abilities regression gate。
- 已注明实现后迁移进 `docs/features/memory_scene_boundary.md`、`docs/memory_system.md`、Memory Lens / Ask 文档及 `docs/index.md`；P0 不虚构 Desktop App 新页面文档。

### Phase 4: Demo 与体验验证
- **Status:** completed
- 已创建中文集成式 demo，复用真实 Personal AI 图标和现有聊天/Memory Lens 视觉语法，不新增 dashboard。
- 三种状态可切换：正确切开、暂不切、切错可恢复；支持 evidence ledger、边界解释、来源/范围、merge/split/move、undo 和 no-send/no-write receipts。
- Inline JavaScript 可编译，25 个 id 唯一，本地资产存在。
- Chrome Canary Playwright 实际通过桌面 1440×960 与移动 390×844：无 page/console error、无横向溢出；状态切换、ledger、merge、raw-message non-mutation、undo 通过；关键移动端控件至少 44px。
- 已肉眼检查桌面和移动截图；移动版 ledger 为可滚动贴底面板，桌面版为 inline ledger。

### Phase 5: 外部写回与收尾
- **Status:** completed
- Reminder 无合格来源，因此没有 done/note 写回；这是预期 no-op，不是访问阻塞。
- 已更新 automation-2 memory，记录本轮事实、产物、验证证据、错误修正和下一轮去重 guardrail。
- 最终交付仅包含 plan/demo；未提交或推送，也未触碰工作树中其他用户改动。

## Test Results

| Test | Expected | Actual | Status |
|---|---|---|---|
| required sections | 真实旅程、去重、研究、UX、边界、实现、eval、docs handoff | 10 个关键 section 全部命中 | pass |
| inline JS / IDs | 可编译且 id 唯一 | `inline_js_ok ids=25` | pass |
| local asset / links | icon 与相邻方案路径存在 | 全部存在 | pass |
| Chrome Canary desktop | 1440×960、交互、无错误/溢出 | Playwright 通过 | pass |
| Chrome Canary mobile | 390×844、44px targets、无错误/溢出 | Playwright 通过 | pass |
| sensitive literal scan | 无凭据、原始私聊、完整工单号 | 只命中风险说明与批准的服务地址/用户名 | pass |

## Error Log

| Timestamp | Error | Attempt | Resolution |
|---|---|---|---|
| 2026-09-07 | 合并读取输出被截断 | 1 | 改为逐文件分段读取 |
| 2026-09-07 | 发现 2026-08-26 planning 未完成 | 1 | 新建本轮隔离 planning，重新获取时效性证据 |
| 2026-09-07 | SQLite 时间戳首次按毫秒解释导致日期落在 1970 | 1 | 识别为秒级时间戳并修正后续查询 |
| 2026-09-07 | ESM 脚本无法通过 `NODE_PATH` 解析 bundled Playwright | 1 | 改用 `createRequire` 加载已确认存在的绝对 package 路径 |
| 2026-09-07 | 初次 Playwright 截图误用 `viewportSize`，移动截图仍为默认桌面宽度 | 1 | 改用 Playwright `viewport` 并新增 innerWidth 精确断言后重跑 |

## 5-Question Reboot Check

| Question | Answer |
|---|---|
| Where am I? | Phase 1：Reminder 与现有方案盘点 |
| Where am I going? | 真实记忆、外部研究、选题、plan/demo、验证、写回与收尾 |
| What's the goal? | 交付一个不重复、真实场景驱动、只做规划的新能力方案 |
| What have I learned? | 见 `findings.md` |
| What have I done? | 见上方日志 |
