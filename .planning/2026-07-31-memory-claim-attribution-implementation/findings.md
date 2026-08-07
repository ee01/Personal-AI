# Findings: Memory Claim Attribution / 记忆主张归属实现

## Confirmed Product Direction

- 能力核心是后台 claim-level attribution 和写入门禁，不是新的用户旅程。
- Memory Lens 只读召回，不负责保存；Memory Capture 的 `+ 记住` 只属于网页/选区/资料入口。
- 普通 Glip owner message 自动进入既有 capture/ingestion，用户不需要点击“记住”。
- UI 只在归属改变高责任写入或回答时出现，优先复用 Ask evidence、Lens Expanded Card、Compose/Meeting/Profile 详情。
- 纠错必须可选、就地、可撤销，只改派生归属，不改 raw 或外部消息。

## Initial Risks

- 当前 worktree 已长期承载多项并行工作，任何修改前必须确认 ownership 与重叠。
- 现有 message-level `ownerAuthored` 不能代表句内 claim owner；直接改 extraction prompt 仍可能让不同写路径各自漂移。
- 归属判断含中英混合、嵌套引用、否定、条件、假设、ASR、问句与 AI 摘要，必须用真实 eval 约束。
- 高责任派生必须在 attribution pending / unknown / resolver failure 时阻断，raw storage 仍需成功。

## Repository And Delivery Constraints

- `AGENT.md` 要求：先做 targeted test/build，再做 UI E2E；涉及记忆写入/召回路径必须运行 `npm run eval:memory-abilities`。
- 该能力包含 LLM 判断，完成前必须建立 `evals` suite、`readerProof`，运行 `npm run eval:validate` 与 `npm run eval:run -- --suite <id> --no-repair`。
- UI/TypeScript 修改后需运行 `npm start`，看到首次成功 compile 后停止；稳定能力需写入 `docs/features` 并更新索引。
- 当前 tracked 脏改动位于 `docs/progressing/memory-echo-dampener-*` 与 `src/contentScriptWebIntelligence.ts`，另有一个异常命名的 untracked 文件；它们均不属于本功能，必须保留且不得纳入本轮提交。
- `.planning/.active_plan` 指向另一项正在进行的任务，本轮仅使用隔离目录，不改该指针。

## Audit Workstreams

- 写入链路：查清 raw message、entity/profile/opinion/action/change-ledger 的调用顺序和唯一可复用门禁点。
- 消费链路：查清 Ask/context-recall、Memory Lens、Compose/Meeting/Profile 的真实 contract，避免发明宿主 UI。
- 评测链路：查清 registry、suite schema、readerProof、真实 memory abilities 和报告约束。

## Phase 1 Architecture Decision

- 新 migration 使用 `messages_raw.claim_attribution_*` 状态列，以及 `memory_claims`、`memory_claim_revisions`、`memory_claim_links` 三表；policy 使用可查询列，revision/links 保留审计与派生失效能力。
- 新写入顺序固定为：raw pending → deterministic claims → raw resolved/failed → 普通索引 → 仅 eligible claim 支持的 profile/property/opinion/timeline 派生。
- Deterministic segmenter 与 policy compiler 无条件运行；现有 LLM extraction 只可补 ambiguous span，失败不得回退成整段 self。
- Profile / property / opinion candidate 必须带 `claim_index` 或能唯一映射到一个 claim；mixed message 下没有 claim ref 的 candidate fail-closed。
- `OnlineReflection` 是当前最危险旁路之一：用户 query 先做 transient attribution；无 eligible self claim 时禁止 preference/fact 写入，自动写入保持 `pending_confirm`。
- `MemoryChangeLedgerService` 对 message-backed source 必须读取 claim policy；结构化权威 connector receipt 可继续作为独立验证来源。
- `ProjectTimelineExtractor` 只把 `currentTruthCandidate=true` 的 claim 交给 LLM，避免引用/假设直接覆盖 active date property。
- `messages_raw` 另有 Calendar、Source Memory capture/backfill、Smart Import、Outreach 五个直写入口；统一 service 提供 post-insert ensure，并在消费时支持 legacy lazy ensure，避免只覆盖主 ingest。
- 纠错使用独立 revision endpoint；generic recall feedback / entity correction 不能替代 claim 归属更正。
- Eval 必须新增真正可运行的 suite 与 runner dispatch；registry-only 会报 `suite_runner_not_implemented`。Reader Proof 用 0/3 映射硬门槛，同时报告原始比例和 confusion matrix。

## P0 Test Gates

- 混合 owner message 必须切出 AI 建议、他人转述、用户决定、假设四类 span。
- `skipExtraction=true` 与 LLM failure 仍产生 deterministic claims；raw 保存，高责任写入为零或只含明确 eligible claim。
- AI/quote/hypothesis 不得写 profile、active entity property、opinion 或 accepted action。
- correction 只改派生 attribution 并失效链接目标；`messages_raw.content` 与外部来源不变。
- migration、restart、backup merge、source deletion 均保留/清理 claim contract 一致性。

## References To Inspect

- `docs/progressing/memory-claim-attribution-plan.md`
- `docs/progressing/memory-claim-attribution-demo.html`（已知 UX 不准确）
- `docs/features/memory_system.md`
- `docs/features/memory_capture.md`
- `docs/features/memory_lens.md`
- `docs/features/ask.md`
- `docs/features/assist.md`
- `docs/features/user_profile_system.md`
- `docs/features/change_memory_ledger.md`
- `docs/features/meeting_pilot.md`
