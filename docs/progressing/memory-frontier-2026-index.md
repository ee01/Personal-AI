# Memory Frontier 2026：改进方案总索引

> 生成时间：2026-06-11 CST
> 来源：《置身钉内》（钉钉 ONE 项目 7.5 万字复盘）精读 + 前沿论文调研（HippoRAG2/Mem0/Zep/A-MEM/Letta sleep-time/LongMemEval/ProAct 等）+ GitHub 2026 年中全景（mem0 58k★/graphiti 27k★/hindsight/OpenViking/EverOS 等 30+ 项目）+ 全代码盘点（4 路并行，结论见 `.planning/2026-06-11-memory-frontier-improvement-plans/findings.md`）
> 性质：导航文档。每个 plan 独立可落地，按下方顺序逐个开工。

## 一句话总判断

本系统的地基（双时态真值、夜间巩固、梦境重放、Rehearsal 前瞻、无感校准）已厚于行业开源水平；本批 plan 的主线是三件事：**把台面下的缝合搬到台面上（可感知）、把已收集的行为信号接进主排序（反馈闭环到底）、把写入与删除做出"决策与级联"（从 RAG 升格为记忆）**——外加一个真实存在的注入攻击面修补。

## 2026-06-23 交付闭环

6/18 完成报告里的本地 A/B 已证明大批需求不回退，但当时线上部署和权威体检仍有缺口。6/23 复跑后，把期望标准收紧为：**grounded case 必须返回 evidence，不能靠复述问题或候选澄清过关；abstention case 不能把弱相关召回项包装成证据；明确 subject 的完整问句不应被短问句歧义澄清截断。**

本轮已按这个标准补齐 `/ask` 和 eval：Cursor 成本/性价比的时间问题会继续召回证据而不是要求用户在多个 Cursor 话题里再选一次；巴黎航班这类库中无事实的问题，即使 LLM 超时 fallback 也返回 `resolutionState=insufficient`、`evidence=[]`。远端 `10.32.56.212` scoped 部署后，`mem-abilities-frontier-remote-after-cjk-fix-20260623` 通过 6/6、overall=1.0，较 `evals/.baseline/memory-abilities.json` 无回归。

## Plan 清单（11 个新 plan）

| # | Plan | 优先级 | 规模 | 对应建议 | 依赖 | 场景与 Demo |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [memory-longmemeval-benchmark-plan](./memory-longmemeval-benchmark-plan.md) | P0 | 3-4d | 端到端记忆五能力体检（时序/知识更新/拒答/前瞻） | 无——**建议最先落地**，作全批回归门 | plan 内数据对比（体检报告样例） |
| 2 | [memory-injection-defense-plan](./memory-injection-defense-plan.md) | P0-安全 | 3-4d | 网页捕捉→记忆→prompt 的注入链防护 | 无 | plan 内数据对比（注入链 before/after prompt）；⚠ 标记样式见 weave demo |
| 3 | [memory-recall-ppr-association-plan](./memory-recall-ppr-association-plan.md) | P0 | 2-3d | graph 通道升级 Personalized PageRank 联想 | 无 | plan 内数据对比（排序前后 + diagnostics JSON） |
| 4 | [memory-salience-behavioral-intimacy-plan](./memory-salience-behavioral-intimacy-plan.md) | P0 | 3-4d | 行为亲密度因子进 Salience/Recall/通知 | 无（数据已在收集） | plan 内数据对比（affinity rollup + 排名变化） |
| 5 | [memory-weave-provenance-visibility-plan](./memory-weave-provenance-visibility-plan.md) | P0 | 4-5d | 缝合徽章「N 来源 × M 天」+ 通知证据列 | 弱依赖 #3（P2 解释链路） | [demo](./memory-weave-provenance-visibility-demo.html)（Lens 徽章/证据视图/通知依据/ask 统计条） |
| 6 | [memory-merge-evolution-ttl-plan](./memory-merge-evolution-ttl-plan.md) | P1 | 6-8d | chunk 合并决策 / 记忆演化 / TTL 试用期 / forgetting+compression 端点 / 向量索引清理 | 体检（#1）先行可量化收益 | plan 内数据对比（同事实三版演变 + TTL 状态机） |
| 7 | [memory-sleep-time-compute-plan](./memory-sleep-time-compute-plan.md) | P1 | 5-7d | 睡眠期预计算 + catch-up 补课 + 晚间收尾两场景 + guardrail 蒸馏 | 弱依赖 #5（徽章）、#8（通知评分） | [demo](./memory-sleep-time-compute-demo.html)（catch-up 卡/夜间 brief/prior 命中/晚间收尾时间线） |
| 8 | [memory-proactivity-cost-asymmetry-plan](./memory-proactivity-cost-asymmetry-plan.md) | P1 | 2-3d | 通知漏报/误报代价不对称 utility v2 + 依据引用 | 与 #5 共用 notification migration | [demo](./memory-proactivity-cost-asymmetry-demo.html)（通知流前后对比/决策算账/校准 audit） |
| 9 | [memory-mcp-server-plan](./memory-mcp-server-plan.md) | P2 | 3-4d | MCP server：跨 AI 平台记忆标准接口 | 建议在 #2 之后（出口带防护标记） | plan 内调用对照（Claude Code tool call transcript） |
| 10 | [memory-cascade-deletion-plan](./memory-cascade-deletion-plan.md) | P2 | 4-5d | 级联删除/孤儿修复/「真正可删除」 | 无（含存量对账） | plan 内数据对比（删除回执/残留清单/再污染红队） |
| 11 | [skill-experience-quality-gate-plan](./skill-experience-quality-gate-plan.md) | P2 | 3-4d | 技能/经验 success 账本 + 晋升退役 | 无 | [demo](./skill-experience-quality-gate-demo.html)（Foundry 健康度列表/生命周期时间线/降级通知） |

每个 plan 在「假设场景：一步步的体验」一节里给出完整的用户体验流程；4 个有界面的 plan 配静态 demo（沿用本目录既有 demo 的设计 token，浏览器直接打开），其余 7 个用真实示例数据做 before/after 对比。

**建议落地顺序**：1（体检定基线）→ 2（安全）→ 3+4（召回与打分，可并行）→ 5 → 8 → 6 → 7 → 10 → 9 → 11。每个 plan 内部再分 P0/P1/P2 切片，最小切片均可独立交付。

## 快赢清单（不值得独立 plan 的三件小事）

### QW-1 近期重点标准注入块（建议 #16，~1d）
ChatGPT 逆向研究中"Recent Conversation Content"被评为性价比之王。本系统 `renderActiveFocusDigest`（ProviderContextService.ts:620-726，salience≥0.35、14 天窗）已是同物，但只服务豆包桥接。
**做法**：抽出为 `getRecentFocusBlock(tokenBudget)`，在 /ask 的 buildAugmentedSystemPrompt（用户核心区之后）与 quick-ask 注入；composer 不注入（其上下文已场景化）。开关 `injection.recentFocusEnabled`。验收：ask eval 不回退 + 近期话题 case 提升。

### QW-2 画像洞察查询端点（建议 #17，~1d）
honcho 的 dialectic API 思路：问"这个用户会怎么想/偏好什么"，返回**洞察**而非原文列表。
**做法**：`POST /profile/insight {question}` → ProfileManager 取 confirmed items + writing style + 近期 affinity 摘要 → LLM 一次合成（带 confidence 与依据计数，不吐 evidence 原文）。先内部消费（Compose Assist 的 audience hint、Relationship Radar 草稿），后接 MCP 的 memory_profile_hint（plan #9）。

### QW-3 L0/L1/L2 渐进证据加载（建议 #15，~2d）
OpenViking 的三级上下文（一句话/概览/全文）。本系统 chunks 已有 summary（L1 雏形）与 content（L2）。
**做法**：召回融合后按 token 预算装配——前 3 名给 content（截断 500 字，现状口径），其余给 summary，超预算只给标题行；`/ask` 与 context-pack 先用。与 source-memory-distiller-plan 的蒸馏包（文档级 L0/L1/L2）天然衔接，不重复建设。

## 设计原则增补（建议 #11——直接拷入 memory_system.md「产品愿景」之后）

```markdown
## 设计红线（来自《置身钉内》的反面教材）

1. **观察不产生副作用**。记忆系统"看过/想起/提示"任何内容，都不得生成用户需要向第三方
   负责的状态（已读、回执、代答、代发）。主动性只到"呈现"为止，行动永远是用户的决定。
   （ONE 的"已读恐怖主义"：系统替用户已读消息 → 剥夺选择权、转嫁责任 → 信任崩塌。）
2. **缝合必须可感知**。凡跨来源/跨时间合成的结论，必须在呈现层标明缝合范围（N 来源 × M 天）。
   AI 在台面下做得再难，台面上若与"肉眼扫一眼"无异，用户就会按后者定价。
3. **新 surface 必须自带反馈闭环与 eval case 才算入账**。只有展示没有回流的功能是负债——
   "要做个性化，就要有记忆、偏好和反馈闭环"，三者缺一不立项。
   （反"每日一包"记账法：可截图的算进展、可沉淀的不入账，最终隐债到期。）
4. **漏报与误报代价不对称**。重要信息不因省资源而静默：高 miss-cost 候选宁可延迟补投，
   不可丢弃。省下的应是深夜打扰，不是信息本身。
5. **默认值就是制度**。默认记什么、默认推什么、默认对模型可见什么，每次变更默认值
   都按产品决策评审，不作为实现细节合并。
```

## 已在正确道路上、本批不动的（书与前沿双重验证）

- **TruthMaintainer 双时态 + 冲突确认**：与 Zep/Graphiti 同构且更早；LongMemEval 知识更新短板的对症药——体检（plan #1）将给出量化证明。
- **Consolidation/Dream/Reflection 三层离线**：即 CLS 理论与 sleep-time compute 的工程化；plan #7 只是加产出通道，骨架不动。
- **Rehearsal**：MemBench 刚把前瞻记忆立为基准维度，本系统已有完整实现——体检纳入即可。
- **Ambient Calibration 脱敏纪律**（hash/长度/标签，拒收原文）：行业少见的隐私先例，plan #4 严格继承。
- **Per-user SQLite + 本地嵌入**：个人 AI 无 ONE 的"发信人 vs 收信人 / 管理者 vs 员工"结构性矛盾——这是相对企业记忆系统的定位优势，已写入设计红线语境。
- **Markdown 派生层**（USER_CORE/dreams/reflections + 全量 export）：与 2026"文件是事实源"范式潮流同向；本系统 DB 为真相源的选择因双时态/级联需要而正确，不掉头。

## 与既有 docs/progressing plan 的衔接（避免重复建设）

| 既有 plan | 状态 | 本批的处理 |
| --- | --- | --- |
| memory-outcome-loop-plan | P0 已落地 | plan #4 是其长期权重消费端；skill 账本（#11）共用事件总线 |
| context-recall-experience-eval-plan | 协议已定 | plan #1 是其超集落地，judge pin 纪律共用 |
| memory-intake-quality-gate-plan | 搁置（反 review queue） | plan #6 的 TTL+自主决策是其按"无感校准"原则的继任者 |
| memory-lifecycle-gardener-plan | 搁置（Ambient Forgetting 方向） | plan #6 切片 C 落其端点与索引清理基建 |
| memory-egress-firewall-plan | 搁置 | plan #2 管入口侧，与其出口侧互补、不阻塞 |
| working-memory-return-stack-plan | 搁置（自动意图不可靠） | plan #7 的 catch-up 只用确定性触发，吸收其教训 |
| memory-day-pilot-plan | 部分落地 | plan #7 两场景复用其基建 |
| ai-context-passport-plan | 候选 | plan #9 把其 P3（MCP）提前独立交付 |
| source-memory-distiller-plan | 候选 | QW-3 与其文档级蒸馏分层衔接 |
| memory-trust-console / freshness-radar / relevance-trainer 等 | 候选/搁置 | 各 plan「与既有 plan 的关系」节已逐一标注 |

## 2026-10-09 E-72 批次：Instinct 对标后的建议归属

来源：Multica issue E-72（Instinct 视频资料整理与对标，2026-10-08 至 10-09）。第二轮给出的 25 条建议按下表归入 plan、快赢或搁置，避免散失。子任务 E-75 ～ E-80 对应六份 plan，均未 assign。

| 建议 | 归属 | 状态 |
|---|---|---|
| A1 写入侧 provenance 闭集 / session-kind 门控 / 召回回路防护 | [memory-write-provenance-gate-plan](./memory-write-provenance-gate-plan.md)（E-75） | 仅规划 |
| A2 可编辑 Markdown 工作区（视图，round-trip） | [memory-markdown-git-mirror-plan](./memory-markdown-git-mirror-plan.md) 投影层（E-79）；回写 proposal 留给 one-pager plan §4.3 | 仅规划 |
| A3 常驻用户 one-pager | [memory-resident-one-pager-plan](./memory-resident-one-pager-plan.md)（E-78） | 仅规划 |
| A4 投入从检索转向写入侧 curation（alias / supersession / 矛盾扫描） | [memory_foundation](../features/memory_foundation.md#睡眠期整理与两车道读取) 阶段 A / C（E-76） | 已实现，B/C 生产 live 仍须人工 shadow 资格 |
| A5 前瞻记忆生命周期（standing intents） | [Task Center 注意力账本](../features/task_center.md#从消息到待办提案attention-triage)（E-77） | 已实现，默认 shadow |
| A6 事件唤醒补充轮询 | attention-triage plan Phase 3 的 Heartbeat 读 ledger；扩展侧事件触发留作其 Phase 2 之后的增量 | 部分覆盖 |
| A7 后台成本分级 | reconciliation plan §5.5 预算制度 | 仅规划 |
| A8 记忆场景评测进 CI | 各 plan 的 Evals 节 + [memory-longmemeval-benchmark-plan](./memory-longmemeval-benchmark-plan.md) 回归门 | 已有框架 |
| A9 删除预览与覆盖范围声明 | 未独立成 plan；建议并入 [memory-cascade-deletion-plan](./memory-cascade-deletion-plan.md) 增「dry-run 报告」 | 待并入 |
| F1 Open loops 作为记忆 kind | attention-triage plan §5.1 / §4.2 L1 | 仅规划 |
| F2 偏好外推 | reconciliation plan 场景 B（实体锚定 preference unit）；Compose 展示依据留 one-pager plan | 部分覆盖 |
| F3 从重复蒸馏 procedural memory | 归 [personal-skill-foundry-plan](./personal-skill-foundry-plan.md)：增「重复才是信号、候选存 git、人工安装」 | 待并入 |
| F4 关系层级 → 分享能力矩阵 | attention-triage plan §5.2 四层解析器只做了「读」；「写出去给谁」留给 [common-ground-memory-plan](./common-ground-memory-plan.md) | 部分覆盖 |
| F5 fill-only 敏感值收集 | 已有 [ephemeral-secret-vault-plan](./ephemeral-secret-vault-plan.md)，对齐即可 | 已有 |
| F6 日简报写作与安静规则 | 归 [memory-day-pilot-plan](./memory-day-pilot-plan.md)：增「并入已开线程、前 30% 承载要点」两条 | 待并入 |
| F7 巩固日志（Dream Diary 式） | git-mirror plan `consolidation/DIARY.md` + reconciliation plan `unit_reconcile_decisions` | 仅规划 |
| F8 语音 / 快速捕获 | 不立项；desktop quick-ask 已有 | 不做 |
| F9 可分享记忆简报页 | 不立项；现有 HTML 报告能力足够，egress gate 先行 | 不做 |
| F10 信任代理指标 | attention-triage plan §10 可观测性 + usage dashboard | 部分覆盖 |
| P1 定位为「给你已在用的代理供上下文的记忆层」 | [openclaw-memory-link-plan](./openclaw-memory-link-plan.md)（E-80）是第一个落地样例 | 仅规划 |
| P2 低风险动作「办完」而非只「备菜」 | attention-triage plan §4.2 L2 → 外部副作用走 allowlist；allowlist 本身归 [agent-task-ledger-plan](./agent-task-ledger-plan.md) | 部分覆盖 |
| P3 不做 A2A，但把人建模成 destination | 推迟；F4 落地后再议 | 推迟 |
| P4 以滞后换成本 | reconciliation plan Phase 4（OnlineReflection 采样） | 仅规划 |
| P5 把「我们不做什么」写成信任承诺 | 文档类，建议在 `docs/memory_system.md` 产品愿景后增一节 | 待写 |
| P6 与 Markdown 生态互通 | git-mirror plan `interop/` + openclaw-memory-link plan | 仅规划 |
