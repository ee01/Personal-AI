# Progress: Memory Claim Attribution / 记忆主张归属实现

## Session: 2026-07-31

### Phase 1: 规则、工作树与现状审计

- **Status:** completed
- Actions:
  - 用户确认按低打扰方向逐步实现：后台静默门禁优先，现有 surface 按需回执，无 Glip Remember 按钮。
  - 读取 `planning-with-files` 完整规则。
  - 检查根目录历史 planning 文件和 `.planning/.active_plan`；决定建立本轮隔离 planning 目录，不切换其他任务的 active pointer。
  - 创建本轮 task plan、findings、progress。
  - 完整读取 `AGENT.md`，确认 LLM eval、memory abilities、UI E2E、首次 compile、canonical docs 和 scoped delivery 门槛。
  - 读取 automation memory 与相关长期 memory，恢复此前已经确认的真实入口边界和评测经验。
  - 检查 dirty worktree 并标记所有无关 tracked/untracked 改动为只保留、不触碰。
  - 启动三个只读审计：写入/派生链路、现有消费 UI/API、eval/readerProof 框架；主线程同步检查核心实现。
  - 完成写入链路审计：确认 production extraction 默认关闭、profile/opinion/property/timeline/OnlineReflection 旁路，以及 5 个 `messages_raw` 直写入口。
  - 完成 eval 审计：新 suite 必须包含实际 runner、Reader Proof 与原始安全指标，不能用 registry 结构校验冒充功能证明。
  - 锁定 migration、repository/service、统一 policy、derived links、correction revision 和 lazy legacy attribution 方案。

### Phase 2: Claim contract 与静默摄入门禁

- **Status:** completed
- Actions:
  - 新增 migration、claim/revision/link repository、deterministic segmenter、policy compiler、归属服务与纠错服务。
  - Ingestion 先存 raw，再无条件运行确定性归属；失败时保留 raw/chunk，但 profile、opinion、property、timeline 等高责任派生失败关闭。
  - Change Ledger 和 OnlineReflection 纳入 claim 门禁，避免 message-level owner 信号或 Ask 问句绕过。
  - 补齐 Source Memory、Smart Import、Calendar、Outreach、backfill 等 messages_raw 直写入口；旧数据按消费时 lazy attribution，不覆盖用户纠正。
  - 备份/级联删除纳入 claim、revision、link。

### Phase 3: 消费契约与低打扰 UI

- **Status:** completed
- Actions:
  - Context Recall 在 cohesion 前过滤 block claim 并净化 mixed evidence；最终返回 compact attribution receipt。
  - Ask 的 prompt、evidence、fallback 与 stream 都只消费最终过滤结果；普通 single-self evidence 不显示回执。
  - Ask 既有答案页加入条件式归属回执，纠错只更新派生 attribution 并明确 raw/external unchanged。
  - Memory Lens 仅在 Expanded Card 的既有 metadata/feedback 详情中显示条件式 chip 与纠错，不在 Rest/Peek 或普通 Glip toolbar 新增入口。
  - Compose 只在既有锁定 preview 显示紧凑解释；used-only receipt 若已升级为复核，也必须解释原因，普通无 receipt 建议保持静默。
  - Meeting 只在既有“证据来源” details、Profile 只在既有“证据审计”展开区显示只读回执；两处不新增纠错控件。
  - 普通 Glip toolbar 零新增归属或“记住这段”动作；Memory Lens 只在 Expanded Card metadata 显示 chip，Rest / Hover Peek 不泄露归属细节。

### Phase 4: Tests、E2E 与真实 eval

- **Status:** completed
- Actions:
  - 完成 16 个 memory-service 定向文件、158 个测试，覆盖 segmenter、policy、repository/API、raw ingest、派生失败关闭、Change Ledger、Ask、Context Assist、Compose、Profile、Outreach 与 backfill。
  - 完成前端 presenter / Compose / Profile 19 个测试；webpack 首次成功编译后停止 watch。
  - 真实扩展 E2E 覆盖 Ask、普通 Glip content script，以及 Memory Lens Rest → Hover Peek → Expanded Card → correction drawer；纠错 API 与 raw unchanged 回执均通过。
  - `memory-claim-attribution` 专项 eval 6/6 通过，5/5 个声明均有 Reader Proof；`eval:validate` 23 suites 通过，Reader Proof verifier 6/6。
  - 首轮 memory abilities 使用过旧本机数据，temporal 因缺少 4 月 30 日 golden 为 0.67；随后只读复制当前远端 DB 到临时副本，用本地分支复跑 6/6、overall=1、无 baseline regression，之后关闭服务并删除临时数据。

### Phase 5: Canonical docs、计划清理与交付

- **Status:** completed
- Actions:
  - 新增 canonical `docs/features/memory_claim_attribution.md`，并更新 Ask、Memory Lens、Compose、Meeting、Profile、memory system 与 features index。
  - 按真实宿主入口重建 `docs/demo/memory-claim-attribution.html` 和预览图；桌面、768px、390px 均无横向溢出。
  - 删除已经落地的 `docs/progressing/memory-claim-attribution-plan.md` 与旧 demo，避免继续显示为待实现能力。

## Test Results

| Test | Result | Notes |
| --- | --- | --- |
| memory-service build | pass | TypeScript 编译通过 |
| claim/ingest/Ask/Compose/ledger targeted | 158/158 pass | 16 test files；含 Ask 32/32、派生失败关闭与全部 direct writer |
| direct raw writers targeted | 49/49 pass | Source backfill、Outreach 与相关回归 |
| frontend attribution targeted | 19/19 pass | ordinary self 静默、mixed/corrected、Compose used-only、Profile 证据审计 |
| root webpack watch compile | pass | `webpack 5.94.0 compiled successfully`，随后停止 watch |
| real extension UI E2E | pass | Ask、普通 Glip、真实注入 Memory Lens 与 correction drawer |
| memory-claim-attribution eval | 6/6 pass | `.eval-runs/20260731T120308Z-memory-claim-attribution-scyni0/report.html`；5/5 reader claims proved |
| memory abilities local branch | 6/6 pass | current remote DB 的只读临时副本；overall=1，无 baseline regression |
| eval contract | pass | 23 suites validate；Reader Proof verifier 6/6 |

## Error Log

| Timestamp | Error | Attempt | Resolution |
| --- | --- | --- | --- |
