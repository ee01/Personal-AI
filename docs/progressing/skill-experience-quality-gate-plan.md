# 技能升级：经验质量门控 / Skill & Experience Quality Gate

> 生成时间：2026-06-11 CST
> 来源：Experience-Following 效应（arXiv:2505.16067：坏经验与好经验同样复利）+ Voyager 技能验证回路（arXiv:2305.16291）+ 本系统 writing-style 晋升先例
> 优先级：P2（Skill Foundry 的健康度基建）
> 预估规模：3-4 天（执行账本 + 门控 + 退役状态机）

## 结论

给程序性记忆（Skill Foundry 技能、guardrail 规则、未来的工作流记忆）建一套**质量门控与退役机制**：写入侧只有"验证通过或用户正反馈"的经验才能晋升为可注入/可推荐；执行侧记录 success/failure 账本；连续失败自动降级、退役。防止"一次偶然成功的流程被反复复刻"——经验跟随效应的实证结论是：检索到的经验高度相似时 agent 会直接复刻它，**坏经验的复利和好经验一样高**。

它不是：
- 不是重做 Skill Foundry（schema 与 UI 都在，缺的是执行结果回流与生命周期）
- 不是人工审核队列（门控全自动，复用 writing-style 的双阈值晋升语义；用户只在退役通知里有知情权）
- 不是评判用户手写技能（user_manual 来源的技能默认 active，门控只管自动蒸馏的经验）

## 假设场景：一步步的体验（有 UI → [静态 demo](./skill-experience-quality-gate-demo.html)）

**「周报生成流程」这条 skill 的一生：**

1. **5 月**：你连续 4 周用 Compose Assist 写周报都原样发送，outcome loop 建议沉淀成 skill。它以 `candidate` 入库，随后 4 次执行成功 + 你点过一次推荐采纳——证据 5 条、health 0.83 → **晋升 active**，开始出现在 skills/suggestions 里。
2. **6 月第二周**：Jira 字段改版（DEV Estimate 拆成两个字段）。周五 skill 执行失败（字段找不到）——`skill_executions` 记 failure ×1。下周再败两次。
3. **3 连败触发降级**：状态 active → **degraded**。Skill Foundry 列表里它变黄标「执行不稳定 · 3 连败」，从 suggestions 里消失（但你手动调用仍可用）；通知中心一条 notice：「『周报生成流程』已暂停推荐：连续 3 次失败（字段缺失），已发起修订」——可解释，不是默默消失。
4. **修订回路**：降级自动开了一条反思线程，输入 3 次失败的 detail，产出 v2（新字段映射），changelog 注明修订原因。v2 回到 `candidate` 重新攒证据。
5. **6 月底**：v2 两次执行成功 + 你采纳一次 → 重新晋升 active。时间线上能看到完整生命周期：candidate → active → degraded → revised(v2) → active。
6. **对照组**：另一条你手写的 skill「发布前 checklist」（user_manual）同期也失败过 2 次——它只在 UI 上显示失败率，**永不自动降级**（user_pinned 语义：用户意志最高）。

**Before 的对照**：今天这条 skill 失败 3 次后会继续被推荐，你每周五都要手动绕开它——坏经验和好经验一样被复利（experience-following 效应的日常版）。

**注入侧的元信息**（P2，无 UI）：skill 被注入 prompt 时附带「此流程来自 2026-05，成功 4 次/失败 0 次，最近一次 5/30；当时 Jira 字段为旧版」——让消费端 LLM 自己判断是否跟随。

## 依据

- Experience-Following（2505.16067）：错误传播（error propagation）与错位重放（misaligned replay）是经验记忆两大系统性风险；"选择性写入 + 定期删除"实测优于一味累积。
- Voyager：技能必须经环境验证才入库——技能库的核心不是存，是验证回路。
- Memp（2508.06433）：程序性记忆从成功轨迹蒸馏，失败时修订——修订/退役是一等操作。
- 盘点 C 确认缺口：SkillLibraryService **无执行日志/success 计数**（仅 binding.lastError）；skill 不注入 ask/composer prompt（即将来的注入面更要先有门控）。
- 先例在库：UserWritingStyleMemoryService 证据≥3 + confidence≥0.68 的 candidate→active 晋升（:102-103）——直接复用语义。

## 现状（代码事实）

- `SkillLibraryService.ts`：SkillListItem(status, reviewRequired, sources, currentVersion…) + SkillVersionRecord(evidence, sourceEpisodes…) + SkillBindingRecord(state, lastError, lastSyncedAt)——版本与绑定健全，**无 skill_executions 类表**。
- outcome 信号源：memory_outcome_events 已含 `建议创建 skill` 的正向旅程（反复 sent_after_insert≥2 + compose_assist → skill 建议，MemoryOutcomeLoopService:402-490）——**入口有门控雏形，出口（执行后）无回路**。
- guardrail（sleep-time plan 新增）与 writing_style 走 profile_items 晋升，已有门控；本 plan 把第三类程序性记忆（技能/工作流）拉齐。

## 方案

### 1. 执行账本（migration：skill_executions）

```sql
CREATE TABLE skill_executions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  version TEXT NOT NULL,
  platform TEXT,                  -- codex/claude-code/cursor/internal
  outcome TEXT NOT NULL,          -- success | failure | partial | unknown
  signal_source TEXT NOT NULL,    -- binding_sync | user_feedback | action_result | outcome_event
  detail_json TEXT,
  created_at INTEGER NOT NULL
);
```
信号接入（全部复用现有管道，不新增采集）：binding sync 的 lastError → failure；OpenClaw/action_results 中引用 skill 的结果回流；用户在 skills UI 的 activate/snooze/dismiss；outcome events 中 skill 推荐被采纳/忽略。

### 2. 健康分与状态机

```
health = wilson_lower_bound(success, success+failure)   // 小样本保守
状态机（skills.status 扩展）：
  candidate   → 蒸馏产生的新技能（自动经验起点）
  active      → 晋升：执行/采纳证据 ≥3 且 health ≥ 0.6（对齐 writing-style 双阈值精神）
  degraded    → health < 0.4 或连续 3 次 failure → 注入/推荐面停用，保留可手动调用
  retired     → degraded 后 30 天无翻盘 → 归档；通知一条（lane=notice）告知用户与原因
  user_pinned → 用户显式钉住：豁免自动降级（用户意志最高）
```

### 3. 注入/推荐侧门控

- skills/suggestions 与未来的 prompt 注入面只取 `active|user_pinned`；degraded 在 UI 标黄可见但不推荐。
- 检索注入经验时附带元信息（experience-following 的缓解措施）：`此流程来自 N 月前的 M 次成功（最近一次 …），当时上下文：…`——让消费端 LLM 有"是否跟随"的判断材料，而不是裸 few-shot。

### 4. 修订回路（P2）

- degraded 技能触发一次反思线程（复用 reflection_threads）：输入失败 detail，产出修订版 SkillVersionRecord（version+1, changelog 注明修订原因）→ 回到 candidate 重新攒证据。

## 实施切片

| 切片 | 内容 | 验收 |
| --- | --- | --- |
| P0 | skill_executions 表 + 信号接入 + health 计算 | 账本单测；现有 skills 路由契约不变 |
| P1 | 状态机 + 晋升/降级/退役 + 通知 + suggestions 门控 | 状态机矩阵单测；E2E：3 连败技能从 suggestions 消失 |
| P2 | 注入元信息格式 + 修订回路 | 修订 case：degraded → 新版本 → 重新晋升 |

## 验证

- 单测：wilson 下界小样本行为（1/1 成功不晋升）；user_pinned 豁免；信号去重（同一次执行多源上报）。
- 红队（经验跟随场景）：构造一个"曾成功但条件已变"的技能 → 注入失败信号 ×3 → 断言不再被推荐且通知可解释。
- 回归：skills 全量 API 测试；Skill Foundry UI 烟测（personal-skill-foundry tab）。

## 与既有 plan 的关系

- `personal-skill-foundry-plan.md`：本 plan 是其"沉淀成功流程"方向的卫生层——Foundry 管生产，本 plan 管质保与退役。
- `memory-outcome-loop-plan.md`：入口（何时建议建技能）已由它管；本 plan 补出口（建好之后活得怎样），同一事件总线。
- `memory-sleep-time-compute-plan.md`：guardrail 蒸馏走 profile 晋升通道，不进本状态机（规则与技能生命周期分治）。

## 风险与边界

- 信号稀疏：多数技能执行在外部平台，回流不全——unknown 不计入 health 分母，宁可慢晋升不可误退役；binding sync 的被动信号兜底。
- 不评判手写技能的"质量"：user_manual 技能只记账不降级（最多 UI 提示失败率），尊重用户意志。
- 退役不删除：retired 技能与版本历史永久可查可一键复活（与记忆系统"降级不灭失"哲学一致）。
