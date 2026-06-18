# 评测升级：记忆五能力体检 / LongMemEval-style Memory Benchmark

> 生成时间：2026-06-11 CST
> 来源：LongMemEval（ICLR'25，arXiv:2410.10813）+ LongMemEval-V2（2026-05）+ MemBench 前瞻记忆维度 + 基准之战教训（judge 一换分数 ±10）
> 优先级：P0（现有 12 套 eval 都是功能级，缺端到端记忆能力体检）
> 预估规模：3-4 天（30 个种子 case + runner + 基线快照）

## 结论

在 `evals/` 增加一套**端到端记忆能力体检**：固定 judge 模型与提示词，按 LongMemEval 五能力（信息抽取 / 多会话推理 / 时序推理 / 知识更新 / 拒答）+ 第六能力（前瞻记忆，MemBench/Rehearsal 对应）出题，每次改动召回/写入管线必跑。本系统有双时态 TruthMaintainer 和 Rehearsal——**时序推理、知识更新、前瞻三项是结构性优势项**，体检既防回归也是对外叙事素材。

它不是：
- 不是引入 LoCoMo 刷榜（LoCoMo 已饱和、judge 不可比；自建内部集才可信）
- 不是 CI 阻塞项（沿用 context-recall-experience-eval-plan 的结论：本机定期 monitor）
- 不是替代既有 12 套功能 eval（那些测单功能契约，本套测"作为记忆系统"的端到端能力）

## 假设场景：一步步的体验（无 UI，before/after 数据对比）

**人物与背景**：你（开发者）把 RecallEngine 的 MMR 相关性权重从 0.7 调到 0.6，想提升结果多样性。

**Before（现状）**：改完手测三个查询，"感觉没坏"，合并。两周后你自己在用的时候发现：问「5 月时 MTR-148115 的负责人是谁」答成了现任负责人——时序回归没人发现，也说不清是哪次改动引入的。

**After（体检常态化）**：合并前跑 `node tools/eval-memory-abilities.ts`，3 分钟出报告：

```
memory-abilities report  ·  judge: gpt-4o-mini@pinned (prompt sha256 9f3a…)
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

- 脚本：`npm run eval:memory-abilities`（= `tsx tools/eval-memory-abilities.ts`），回归 >0.05 时 exit 1。
- 规则：`AGENT.md` 的 “Experience Evals → Memory Abilities Regression Gate” 一节列出触发面（RecallEngine / IngestionPipeline / Consolidation / Salience / Truth / Forgetting / injectionScreen / graphPpr / BehaviorAffinity / `/ask` 组装），要求改这些路径后跑体检并把报告贴进验证证据。
- **关键 caveat**：脚本打的是 `--endpoint` 指定的服务，默认是已部署的 `10.32.56.212`（跑的是已部署代码，不是你本地分支）。验证本地分支的召回/写入改动要么 `npm run deploy:memory` 后再跑（Tier 3），要么把 `--endpoint` 指向本地起的 memory-service。
- 若要更强的机器强制（可选）：可加 husky pre-push 或 Claude Code Stop hook，但与本仓库「不进 CI」的取向和体检需要内网 live server 的事实冲突，不作为默认。

## 依据

- LongMemEval：五能力分类 + 商业助手持续交互掉 30% 准确率；知识更新与时序推理是普遍短板。
- 基准之战（Mem0 vs Zep vs Letta，Continua 复现）：仅换 judge 模型分数移动 ~10 分 → **judge 模型+提示词+判分脚本必须 pin 死并入库版本化**。
- MemBench（ACL Findings'25）：前瞻记忆（"到时候提醒我"）是现有系统最差项——本系统 Rehearsal 已有实现，应纳入体检证明差异化。
- 书（反"每日一包"）：可沉淀的进展需要能被度量——"一个更稳的排序反馈闭环"不可截图，但可以有分数曲线。

## 现状（代码事实）

- `evals/` 已有完整骨架：`cases/`（12 套：memory-search、memory-lifecycle、scene-memory-autopilot、context-recall…）、`judges/*.md`、`registry.yaml`、`report-contract.md`、`agents.yaml`。
- Runner 生态：`tools/eval-run.mjs`、`eval-lib.mjs`、`eval-report.mjs`、`eval-scheduler.mjs`、`eval-validate.mjs` + 专项 runner（eval-memory-lifecycle.ts 等）。
- `context-recall-experience-eval-plan.md`：协议已定义（相关性/用户价值/标题/解释四维 LLM-as-judge + golden labels），E2E 脚本未实现——本 plan 是其超集落地。
- 能力对应的被测面：时序 = entity_properties 双时态 + time 通道；知识更新 = TruthMaintainer supersede 链；拒答 = ask SYSTEM_PROMPT "If the context is insufficient, say so"（ask.ts:190-208）但**无量化测量**；前瞻 = rehearsals + /context-recall 触发。

## 方案

### 用例结构（evals/cases/memory-abilities/）

```
memory-abilities/
  extraction/        单会话事实抽取（10 case）
  multi-session/     跨会话推理（"3 月会议定的方案和上周 Jira 评论矛盾吗"）
  temporal/          时序推理（"X 在 4 月时的负责人是谁"→ 双时态点时查询）
  knowledge-update/  知识更新（先注入旧值再注入新值，问当前值+历史值）
  abstention/        拒答（库中无答案的问题，判"明确说不知道"，幻觉=0 分）
  prospective/       前瞻（建 rehearsal → 模拟场景触发 → 判 cue 是否浮现）
case 格式（沿用 eval-lib 约定）：
  fixture.jsonl   # 通过 POST /ingest 重放构建种子库（确定性 userId: eval-mem-abilities）
  question.md     # 问题 + 期望行为
  golden.md       # 标准答案要点 + 必须引用的证据 id
  judge 引用 judges/memory-abilities.md（pin：provider/model/prompt sha256 写入 registry.yaml）
```

### Runner（tools/eval-memory-abilities.ts）

1. 重建 fixture 用户库（删除→重放 ingest→跑一次 consolidation，保证生命周期状态确定）。
2. 逐 case 调 `/ask`（或 prospective 走 `/context-recall`），收集 answer + evidence + confidence。
3. 固定 judge 评分（0/0.5/1 三档 + 引用核对：答案声称的事实必须有 evidence id 支撑，无证据陈述按幻觉扣分——HaluMem 方向）。
4. 输出符合 `report-contract.md` 的报告 + 与 `evals/.baseline/memory-abilities.json` 快照 diff；回归 >5% 标红。

### 判分纪律（防基准之战重演）

- judge = 当前 LLMClient 默认 provider 的**固定模型快照**，registry.yaml 记 `judge: {provider, model, promptSha256}`；变更 judge 必须重建基线，禁止跨 judge 比分。
- 题目与库解耦：fixture 合成数据（不含真实用户数据），可入 git；后续可选"影子集"用本机真实库跑（结果只本机留存，遵守隐私边界）。

### P1/P2 扩展

- P1：case 扩到 ~100（knowledge-update 用 entity_properties supersede 链自动生成器：随机属性 → 注入 3 版变更 → 自动生成点时问题与 golden）。
- P2：增量注入模式（MemoryAgentBench 风格：边注入边问，测在线巩固），跑 eval-scheduler 周频 monitor 出趋势曲线。

## 实施切片

| 切片 | 内容 | 验收 |
| --- | --- | --- |
| P0 | 6 能力 ×5 case + runner + judge pin + 基线快照 | `node tools/eval-memory-abilities.ts` 出完整报告；重复跑分差 <2%（确定性） |
| P1 | 100 case + knowledge-update 生成器 + scheduler 周频 | 趋势报告进 eval-report |
| P2 | 增量注入模式 + 影子真实库可选档 | 增量模式报告 |

## 验证

- runner 自校验：fixture 重建幂等（两次重建后 /recall 结果一致）；judge 提示词 sha256 与 registry 不符时拒跑。
- 元验证：故意注入一个错误答案的 mock，确认 judge 给 0 分（judge 灵敏度冒烟）。
- 首跑预期（定基线，不定目标）：temporal/knowledge-update 应显著高于 abstention（abstention 大概率暴露"礼貌幻觉"问题——这正是体检价值）。

## 与既有 plan 的关系

- `context-recall-experience-eval-plan.md`：协议四维（相关性/价值/标题/解释）继续归它；本 plan 聚焦能力六维，共用 judge pin 纪律与 report-contract。两者 runner 分开、registry 同册。
- `memory-reality-check-plan.md`（搁置）：abstention 维度是其"claim 须有证据"思想的量化版，不复活整个 plan。
- 全部新 plan（PPR/亲密度/合并演化…）：以本体检为统一回归门，落地顺序上**建议本 plan 先行**。

## 风险与边界

- 合成 fixture 与真实分布有差距：用影子集（P2）补；但合成集的可重复性优先。
- judge 成本：30 case × 1 judge 调用 ≈ 可忽略；100 case 周频也在个位数美元级（本地 Ollama 可作降级 judge，但需单独基线）。
- 不进 CI：与既有 eval 结论一致，避免外部 LLM 依赖让 CI 不稳定。
