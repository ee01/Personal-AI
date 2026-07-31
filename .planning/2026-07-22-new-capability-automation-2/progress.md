# Progress: Personal AI 新能力规划（automation-2）

## Session: 2026-07-22

### Phase 1: 规则、历史与 Reminder 入口

- **Status:** complete
- **Started:** 2026-07-22
- Actions taken:
  - 阅读 `AGENT.md`、automation-2 memory 状态、规划与原型 skill 的完整指引及必要 references。
  - 检查根目录历史规划文件与 `.planning/.active_plan`，决定隔离本次工作文件。
  - 从 memory registry 提取此前新能力规划、已实现与已搁置概念的去重提示。
  - 检查当前 worktree，确认存在大量与本轮无关的既有修改，建立严格的文件范围边界。
  - 读取 automation-2 近期待办历史：最近 EventKit 快照均为 0 个未完成项，但将等待本轮 EventKit 实时结果。
  - 用 EventKit 只读实时核对 Reminders：fullAccess，`Personal AI` 唯一列表共 4 条、未完成 0；独立 incomplete predicate 结果一致；未修改任何条目。
- Files created/modified:
  - `.planning/2026-07-22-new-capability-automation-2/task_plan.md`
  - `.planning/2026-07-22-new-capability-automation-2/findings.md`
  - `.planning/2026-07-22-new-capability-automation-2/progress.md`

### Phase 2: 仓库去重与真实记忆取样

- **Status:** complete
- Actions taken:
  - 读取 `docs/progressing/to-verify.md`，当前无 carry-over。
  - 扫描 progressing plan 标题/状态，并阅读更新到 2026-07-21 的 canonical feature index。
  - 检查摄入 schema / prompt / profile / opinion candidate 路径，发现 claim-level attribution 缺口。
  - 扫描全部 progressing/features 与 Memory Frontier 规划，未发现 claim-level ownership 近邻；确认 Timeline speaker 与 source provenance 不等同于主张归属。
  - 完成 Injection Defense、Evidence Cohesion、Change Ledger、Persona Projection、Meeting Binder、Source Memory Distiller 与搁置计划的逐项边界审计。
  - 用 SSH + SQLite immutable read-only 聚合查询线上 `esone.qiu` 数据；避开会写 analytics 的 API，记录快照/WAL 滞后边界。
  - 量化 role 覆盖、混合归属风险、跨 AI 导入与派生 property 的 source-author 缺口。

### Phase 3: 行业研究与概念选择

- **Status:** complete
- Actions taken:
  - 检索 ChatGPT Memory Sources、Mem0 role-aware extraction、Zep episode provenance、Granola speaker identification。
  - 检索 speaker-attributed reasoning、reported speech attribution、对话摘要 contextual inference 与 2026 memory poisoning 论文。
  - 打开并核对 Mem0 V3 extraction prompt、Group Chat speaker attribution、M3-SLU 与 ACL 对话摘要论文原文页面。
  - 核对 ChatGPT 当前 Memory Sources/summary correction 行为，以及两篇 2026 memory poisoning 论文的攻击边界。
  - 暂定候选为“claim-level 记忆归属判定”，等待真实 memory 与完整 repo 去重结果再锁定。
  - 比较 Claim Attribution、Silent Miss、Correction Memory 与 Negative Evidence；选择数据证据最强、下游收益最广的 Claim Attribution。
  - 锁定产品名“记忆主张归属”，定义为底层 contract + gate + embedded receipt，不做新工作台。

### Phase 4: Plan 与中文交互 Demo

- **Status:** complete
- Actions taken:
  - 新建 `docs/progressing/memory-claim-attribution-plan.md`，覆盖场景、竞品、去重、数据契约、UX、架构、风险、分期、eval 与文档交接。
  - 新建 `docs/progressing/memory-claim-attribution-demo.html`，模拟混合 AI 对话、会议承诺和 Ask 召回三个真实宿主场景。
  - Demo 提供 claim 选择、写入权限详情、低打扰保存/回答回执和两种就地归属纠正；桌面右栏、移动底部详情层。

### Phase 5: 验证、回写与交付

- **Status:** complete
- Actions taken:
  - 检查 plan 必需章节、外部产品/论文/专家链接、真实数据 caveat、eval 与 canonical docs handoff。
  - 解析 inline JavaScript，确认项目 icon 存在，运行 path-scoped whitespace check。
  - 用 Playwright 在 1440×900 与 390×844 验证三个场景、主张选择、纠正、回执、无 page error、无横向 overflow；人工查看两张截图。
  - Reminder 无未完成条目，因此没有完成或写备注；未修改运行时代码、canonical feature docs 或远端数据。
  - 更新 automation-2 memory，并保留标题 `新能力：记忆主张归属`。

## Test Results

| Test | Input | Expected | Actual | Status |
| --- | --- | --- | --- | --- |
| Plan 必需章节 | 场景、竞品/论文/专家、去重、UX、contract、risk、eval、docs handoff | 全部存在 | `rg` 命中 | passed |
| Demo inline JS | HTML `<script>` | 可解析 | Node `vm.Script` 通过 | passed |
| Demo 依赖 | `../../static/icons/icon48.png` | 存在 | `icon-ok` | passed |
| Demo 桌面 E2E | 1440×900，三场景 + claim + correction + receipt | 无错误/无横向溢出 | 通过并人工看图 | passed |
| Demo 移动 E2E | 390×844，三场景 + bottom sheet + correction + receipt | 无错误/无横向溢出 | 通过并人工看图 | passed |
| Whitespace | 新 plan/demo 与本轮 planning 文件 | 无 whitespace error | path-scoped check 通过 | passed |

## Error Log

| Timestamp | Error | Attempt | Resolution |
| --- | --- | --- | --- |
| 2026-07-22 | zsh `read-only variable: status` | 1 | 计划标题扫描改用 `plan_state` 变量 |

## 5-Question Reboot Check

| Question | Answer |
| --- | --- |
| Where am I? | Phase 5：已完成交付 |
| Where am I going? | 等用户决定是否实现 |
| What's the goal? | 只交付一个不重复的新能力完整 plan 与中文 demo |
| What have I learned? | 见 `findings.md` |
| What have I done? | 完成 plan、Demo、桌面/移动验证与 automation memory 回写 |
