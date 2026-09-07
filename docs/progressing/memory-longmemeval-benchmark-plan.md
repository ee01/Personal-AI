# 评测升级：记忆五能力体检 / LongMemEval-style Memory Benchmark

> 生成时间：2026-06-11 CST
> Canonical 对齐：2026-09-07；本文件只展开 benchmark runner，阶段门与统计裁决以 [memory-foundation-rearchitecture-plan.md §12](./memory-foundation-rearchitecture-plan.md) 为准。
> 来源：LongMemEval（ICLR'25，arXiv:2410.10813）+ LongMemEval-V2（2026-05）+ MemBench 前瞻记忆维度 + 基准之战教训（LLM judge 漂移促使本 runner 使用 grounded deterministic heuristic）
> 优先级：foundation R0 建基线；此后每次 memory recall/write path 交付必跑
> 当前规模：6 个 grounded/read-only smoke case + runner + baseline；扩容由 E1 与 canonical P0.5 承担

## 结论

在 `evals/` 维护一套**端到端记忆能力体检**：按 LongMemEval 五能力（信息抽取 / 多会话推理 / 时序推理 / 知识更新 / 拒答）+ 第六能力（本项目的前瞻记忆）出题，使用版本化 golden facts、关键词组、禁止模式和 evidence presence 做确定性判分，不调用 judge LLM。每次改动召回/写入管线必跑；foundation rollout 的最终统计门仍由 canonical §12 的分层样本与 paired CI 决定。

它不是：
- 不是引入 LoCoMo 刷榜（LoCoMo 已饱和、judge 不可比；自建内部集才可信）
- 不是依赖外部 provider 的云 CI 阻塞项；但它是 `AGENT.md` 与 canonical §12 规定的 memory-path 交付门，必须指向当前分支 endpoint 留下报告
- 不是替代既有 12 套功能 eval（那些测单功能契约，本套测"作为记忆系统"的端到端能力）

## 假设场景：一步步的体验（无 UI，before/after 数据对比）

**人物与背景**：你（开发者）把 RecallEngine 的 MMR 相关性权重从 0.7 调到 0.6，想提升结果多样性。

**Before（现状）**：改完手测三个查询，"感觉没坏"，合并。两周后你自己在用的时候发现：问「5 月时 MTR-148115 的负责人是谁」答成了现任负责人——时序回归没人发现，也说不清是哪次改动引入的。

**After（体检常态化）**：合并前跑 `npm run eval:memory-abilities -- --endpoint <branch-authoritative-endpoint>`，出具版本化报告：

```
memory-abilities report  ·  judge: grounded-heuristic@cases-sha256:9f3a…
能力               本次    基线    Δ
extraction         0.90    0.90    —
multi-session      0.80    0.75    +0.05
temporal           0.65    0.80    -0.15  ⚠ REGRESSION
knowledge-update   0.85    0.85    —
abstention         0.60    0.60    —
prospective        0.80    0.80    —

FAIL temporal/case-07: 问「5 月时的负责人」
  期望: 引用 entity_properties valid_from=5/1..5/31 的旧值 (张三)
  实际: 返回现任 (李四)，未做点时过滤
  证据核对: 答案未引用任何 5 月区间证据 → 判 0 分
```

你立刻知道：多样性权重把 time 通道的结果挤出了融合窗口。改法可控、回归可证。同一份报告月度跑出趋势曲线——「可沉淀的进展」第一次有了分数。

**附带收益**：首次建基线时 abstention 大概率只有 0.5-0.6（"礼貌幻觉"被量化暴露），这本身就是一次体检价值的演示。

### 「合并前跑」具体怎么落地（2026-06-12 已实现）

本仓库**没有 CI、没有 git hook**——校验靠的是 `AGENT.md` 这套 agent 驱动的 harness 策略（Tier 0-4 + Experience Evals + Commit/Push Gate），编码 agent 在交付前按策略跑对应校验。所以「合并前跑」不是机器强制门，而是**写进 AGENT.md 的规则 + 一个 npm 脚本**：

- 脚本：`npm run eval:memory-abilities -- --endpoint ...`（= `tsx tools/eval-memory-abilities.ts`）。现有 >0.05 退出值只保留为 legacy diagnostic；重构 rollout 使用 canonical `eval-policy-v1.json` 的 paired CI 与默认 2pp 非劣 margin。
- 规则：`AGENT.md` 的 “Experience Evals → Memory Abilities Regression Gate” 一节列出触发面（RecallEngine / IngestionPipeline / Consolidation / Salience / Truth / Forgetting / injectionScreen / graphPpr / BehaviorAffinity / `/ask` 组装），要求改这些路径后跑体检并把报告贴进验证证据。
- **关键 caveat**：脚本打的是 `--endpoint` 指定的服务，默认是已部署的 `10.32.56.212`（跑的是已部署代码，不是你本地分支）。验证本地分支的召回/写入改动要么 `npm run deploy:memory` 后再跑（Tier 3），要么把 `--endpoint` 指向本地起的 memory-service。
- 若要更强的机器强制（可选）：可加 husky pre-push 或 Claude Code Stop hook，但与本仓库「不进 CI」的取向和体检需要内网 live server 的事实冲突，不作为默认。

## 依据

- LongMemEval：五能力分类；知识更新与时序推理是普遍短板。
- 基准之战（Mem0 vs Zep vs Letta，Continua 复现）：LLM judge 选择会显著改变结论 → E0 使用 grounded deterministic heuristic，并 pin case file、判分脚本与 baseline hash；需要语义 judge 的扩展另建基线，不能混分。
- MemBench（ACL Findings'25）：前瞻记忆（"到时候提醒我"）是现有系统最差项——本系统 Rehearsal 已有实现，应纳入体检证明差异化。
- 书（反"每日一包"）：可沉淀的进展需要能被度量——"一个更稳的排序反馈闭环"不可截图，但可以有分数曲线。

## 现状（代码事实）

- `evals/` 已有完整骨架：`cases/`（12 套：memory-search、memory-lifecycle、scene-memory-autopilot、context-recall…）、`judges/*.md`、`registry.yaml`、`report-contract.md`、`agents.yaml`。
- Runner 生态：`tools/eval-run.mjs`、`eval-lib.mjs`、`eval-report.mjs`、`eval-scheduler.mjs`、`eval-validate.mjs` + 专项 runner（eval-memory-lifecycle.ts 等）。
- `context-recall-experience-eval-plan.md`：协议已定义（相关性/用户价值/标题/解释四维 LLM-as-judge + golden labels），E2E 脚本未实现——本 plan 是其超集落地。
- 能力对应的被测面：时序 = entity_properties 双时态 + time 通道；知识更新 = TruthMaintainer supersede 链；拒答 = ask SYSTEM_PROMPT "If the context is insufficient, say so"（ask.ts:190-208）但**无量化测量**；前瞻 = rehearsals + /context-recall 触发。

## 方案

### 当前 E0 用例结构（`evals/cases/memory-abilities/cases.jsonl`）

```
每行 AbilityCase：
  id / ability / question / scope
  judge.type = grounded | abstain
  mustMention[][] / mustNotMention[] / forbidPatterns[] / passThreshold
  note = golden 的来源与适用时间
```

E0 当前 6 条 case 依赖只读的真实 `esone.qiu` endpoint，必须记录数据快照日期并定期复核 golden 是否自然漂移；真实正文和答案报告保持本地 gitignored。E1 再增加 synthetic fixture 用户覆盖写入、纠错和 replay，以避免只测一份会变化的线上库存。

### Runner（tools/eval-memory-abilities.ts）

1. 读取 `cases.jsonl`，校验 ability、judge schema 与 case-file hash；默认 `evaluationMode='read_only'`，禁止创建 action、confirmation、answer memory 或 reflection。
2. 逐 case 调 branch-authoritative `/ask` endpoint，收集 answer、evidence 和 context-match；网络失败记 error，不按 0 分掩盖基础设施故障。
3. Grounded case 用 answer+evidence 命中必须词组并检查 forbidden；abstention case 只检查 answer 未伪造禁止具体值。重复 attempt 对 grounded 取最好、对 abstention 取最坏，防止偶发幻觉被平均掉。
4. 输出本地报告并与 `evals/.baseline/memory-abilities.json` diff。现有 >5% regression gate 是确定性 smoke；foundation rollout 另由 canonical `eval-policy-v1.json` 对更大的分层 paired 样本计算 CI，不能用 6 条 case 冒充统计证明。

### 判分纪律（防基准之战重演）

- E0 judge 是仓库内确定性代码与 case schema，不是 LLM；case-file hash、runner commit 与 baseline 一起写入报告，规则变化必须重建 baseline。
- 真实 case 只能提交问题、不可逆 golden 词组和说明；答案、evidence 与用户正文只能写 gitignored 本地报告。E1 synthetic fixture 可入 Git，并承担 write/replay/纠错能力测试。

### E1/E2 扩展

- E1：case 扩到 ~100（knowledge-update 用 v3 unit revisions/validity interval 自动生成器：随机属性 → 注入 3 版变更 → 自动生成点时问题与 golden；旧栈对照可读 legacy entity_properties，但不把它当新 schema）。
- E2：增量注入模式（MemoryAgentBench 风格：边注入边问，测在线巩固），跑 eval-scheduler 周频 monitor 出趋势曲线。

## 实施切片

| 切片 | 内容 | 验收 |
| --- | --- | --- |
| E0 | 当前 6 能力各 1 个 grounded smoke case + deterministic runner + baseline | `npm run eval:memory-abilities -- --endpoint ...` 出完整报告；报告包含 endpoint、runner commit、case hash，不能把 6 条 smoke 当显著性证明 |
| E1 | 100 case + knowledge-update 生成器 + scheduler 周频 | 趋势报告进 eval-report |
| E2 | 增量注入模式 + 影子真实库可选档 | 增量模式报告 |

## 验证

- runner 自校验：case schema/hash 固定、默认 read-only；同 endpoint 连续两次结果差异需进入 flakiness 报告，不能静默更新 baseline。
- 元验证：故意注入一个错误答案的 mock，确认 judge 给 0 分（judge 灵敏度冒烟）。
- 首跑预期（定基线，不定目标）：temporal/knowledge-update 应显著高于 abstention（abstention 大概率暴露"礼貌幻觉"问题——这正是体检价值）。

## 与既有 plan 的关系

- `context-recall-experience-eval-plan.md`：协议四维（相关性/价值/标题/解释）继续归它；本 plan 聚焦能力六维，共用 judge pin 纪律与 report-contract。两者 runner 分开、registry 同册。
- `memory-reality-check-plan.md`（搁置）：abstention 维度是其"claim 须有证据"思想的量化版，不复活整个 plan。
- 全部新 plan（PPR/亲密度/合并演化…）：以本体检为统一回归门，落地顺序上**建议本 plan 先行**。

## 风险与边界

- 合成 fixture 与真实分布有差距：用影子集（E2）补；但合成集的可重复性优先。
- 成本：runner 本身无 judge LLM 成本，但 `/ask` endpoint 可能产生 synthesis 成本；必须由 evaluation read-only/budget receipt 计量。若以后增加 LLM judge，另建 suite 与 baseline，不得把分数拼入 E0。
- 不进 CI：与既有 eval 结论一致，避免外部 LLM 依赖让 CI 不稳定。
