# 巩固升级：睡眠期预计算 + 两个时间场景 / Sleep-time Compute & Time Scenes

> 生成时间：2026-06-11 CST
> 来源：Letta sleep-time compute（arXiv:2504.13171，token 需求 ~5×↓）+ ProAct（arXiv:2605.25971）+《置身钉内》三段式时间场景（晨间排兵/高压后补课/下班前查漏）
> 优先级：P1（meeting prep 已是先例，推广即可）
> 预估规模：5-7 天（预计算引擎 2-3 天 + 两个场景各 1-2 天）

## 结论

把 TodayPilot meeting prep 已验证的"nightly 预计算"模式提升为**通用睡眠期计算引擎**：夜间巩固追加"预答明天的问题"与"失败复盘→guardrail"两条通道；并补齐书中验证痛感最强、本系统缺失的两个时间场景——**高压后补课（catch-up）**与**晚间收尾（day close）**，作为预计算产物的两个消费端。

它不是：
- 不是新的调度器（全部挂在现有 HeartbeatLoop / daily cron / todayPilotPrepCron 上）
- 不是自动意图检测的复活（working-memory-return-stack 因此搁置；catch-up 的触发是**确定性信号**：扩展可观测的"离开时长"，不是猜测用户意图）
- 不是把 ONE 的卡片流搬过来（产物是一份可展开的摘要 brief，不接管用户的工作入口——书：责任迁移红线）

## 假设场景：一步步的体验（有 UI → [静态 demo](./memory-sleep-time-compute-demo.html)）

**周三一天的完整线：**

1. **14:00–16:10** 连开两场会，没碰电脑。
2. **16:12** 回到工位打开 quick-ask（注意：是你打开它，它不弹窗）——顶部出现一张 **catch-up 卡片**：「你离开的 2 小时 14 分里：**3 件高优**（客户改了导出需求 ⊕2来源、MTR-148115 估时冲突待确认、晨会 action 被指给你）· **2 条在等你回**（Harpreet 14:32 @你、设计群提问）· 已按重要性排好」。每条带 weave 徽章和跳转原文。你点开第 2 条处理掉——**原消息的未读状态全程没被动过**（红队验收项）。
3. **23:00** 夜间巩固跑 Anticipation：明早有 standup + 你本周问过 3 次 Q3 planning → 生成 2 条 brief（预答 + 证据）存 anticipation_briefs，`valid_until=明日 23:00`。
4. **次日 09:02** 你问 /ask「Q3 planning 的 BE estimate 谁负责？」——命中昨晚的 brief prior，**~1s 出完整答案**（无 prior 时这类多源问题要 6-9s 全链路检索+综合）。decision 回执标 `prior: anticipation_brief#a1`。
5. **18:30** 打开 Today Pilot，底部 **晚间收尾区块**：「今日已闭环 4 件 ✓ · **2 件有人在等你**（列出）· 明天第一件事：standup 前看一眼 XLSX 变更的回归结论（已备好）」。你扫一眼，安心下班——书里说的「今天的事都交代好了」的确定性。

**Before 的对照**：16:12 回来面对的是 7 个红点群逐个翻；23:00 什么也不会发生；次晨同样的问题要等全链路检索；下班前的安全感靠自己在脑子里过一遍清单。

## 依据

- Letta sleep-time：空闲期把 raw context 重写为 learned context，预判可能问题，测试时 token 需求降 ~5 倍、多查询摊销 2.5×。本系统 meeting prep（36h horizon nightly LLM）已是同构先例，且 dreaming/consolidation 基建齐全——边际成本低。
- ProAct：利用交互间隙预测用户未来需求、预收集证据、预备动作；ProAgentBench 实证记忆驱动的主动协助显著优于无记忆基线。
- 书的三段式场景：ONE 验证用户信息焦虑最强的三个时点——晨间排兵布阵（Today Pilot 已覆盖）、**高压后的补课跟进**（开 2h 会回来面对炸开的未读）、**下班前的查漏补缺**（"今天的事都交代好了"的确定性）。后两者本系统无对应（盘点 C 确认）。
- Reflexion/LangMem：失败→语言化教训→持久化为规则，是反思闭环的标准件；本系统反思线程已有动作产出，缺"被纠正的回答→guardrail"通道。

## 现状（代码事实）

- 先例：`TodayPilotMeetingPrepService`（nightly_llm cron，36h horizon，5 meetings，产出 summaryMd/cueCards/suggestedQuestions/risksOrOpenLoops）——本 plan 把这个形态泛化。
- 调度资产：HeartbeatLoop（15min，:190-299 十类任务）/ daily 23:00 六阶段 / weekly 梦境；`ProactiveScheduler.ts:36-88` cron 注册集中。
- 反思资产：reflection_threads + proposed_actions + action_results 回流；OnlineReflection 在 /ask 后异步跑。
- 反馈资产：memory_outcome_events 已记录 `wrong` / `deleted_before_send` / `ai_tone_called_out` 等失败信号——guardrail 通道的数据源现成。
- 缺位：无 catch-up、无晚间收尾（盘点 C）；dreaming 只发现关联，不预答问题。

## 方案

### 1. 预计算引擎（Consolidation Phase 6.5：Anticipation）

```
输入（确定性，不猜意图）：
  - 明日日历事件（calendar_events 已同步）
  - 近 7 天 /ask 高频主题（ask 历史聚类）+ 未闭环 reflection threads 的 open questions
  - 活跃 watched_projects 的风险信号 + 即将到期 deadlines
产出 anticipation_briefs 表：
  (id, kind('meeting'|'topic'|'project'|'deadline'), subject_key, brief_md,
   evidence_refs_json, weave_json, valid_until, consumed_at, created_at)
预算：每晚 ≤8 条 brief（meeting prep 既有的 5 条额度并入统一预算）；
      生成走与 meeting prep 相同的 LLM 通道与超时纪律。
消费：/ask 命中 subject 时把 brief 作为 prior 注入（与 AnswerMemory prior 同位）；
      Today Pilot / catch-up / day close 直接读。
过期：valid_until = 次日 23:00，过期未消费即作废（预计算永远是缓存，不是事实层）。
```

### 2. 失败复盘通道（Consolidation Phase 6.6：Guardrail Distill）

```
输入：当日 outcome 负信号（wrong / marked_irrelevant / deleted_before_send /
      ai_tone_called_out）+ 被用户改写后发送的 diff 标签（styleFeatureTags 之外的内容性纠正）
LLM 蒸馏 → guardrail 候选：「场景 X 下不要 Y / 要先 Z」
落点：复用 UserWritingStyleMemoryService 的晋升机制（candidate → 证据≥3 & confidence≥0.68 → active），
     新 key 空间 `guardrail.<surface>.<scene>`，active 后注入对应 surface 的系统提示约束区
     （与 writing_style.* 同一注入通道，ComposerAssistService 已有读取点）。
```

### 3. 场景一：高压后补课（Catch-up Brief）

- 触发（确定性信号，桌面端已可观测）：desktop-app 检测「无活动 ≥90 分钟后回到前台」或「日历会议刚结束」→ 调 `GET /day-pilot/catch-up?sinceTs=...`。
- 服务端：对 [sinceTs, now] 窗口内新摄入记忆按 salience + 行为亲密度排序，LLM 缝合成一份 brief：「你离开的 2 小时里：3 件高优先（各带 weave 徽章与跳转）、2 个待回应、1 个新冲突待确认」。复用 active_focus_digest 的查询骨架（ProviderContextService:620-726，salience≥0.35 窗口查询）。
- 呈现：quick-ask 窗口一张可展开卡片；**不自动弹出**（用户回来 ≠ 想被打扰），仅在用户打开 quick-ask / Today Pilot 时呈现，红点交给 notification feed 现有逻辑。
- 书的边界：brief 是只读摘要 + 跳转原文，**不替用户标已读、不接管处理顺序**（高能动用户保留掌控）。

### 4. 场景二：晚间收尾（Day Close Brief）

- 触发：daily cron 23:00 巩固的 Compress 阶段（已生成 daily/{date}.md）追加生成 close brief；用户在 17:00-23:00 打开 Today Pilot 时也可手动「现在收尾」（即时档，走同一服务）。
- 内容（书：「今天的事都交代好了」的确定性）：①今日已闭环（done 的 actions/任务）②未闭环但有人在等（已读未回模式：被 @ / 被提问且无回复记录）③明日第一件事（来自 anticipation briefs）。
- 呈现：notification lane='notice' 一条 + Today Pilot 收尾区块；同样只读不代办。

## 实施切片

| 切片 | 内容 | 验收 |
| --- | --- | --- |
| P0 | anticipation_briefs 表 + Phase 6.5（topic/deadline 两类）+ /ask prior 消费 | 预答命中率统计入 decision 回执；ask 时延不升 |
| P1 | catch-up 端点 + quick-ask 卡片 + day close（cron 档） | 两场景 E2E check 脚本（仿 meeting-pilot-*-check.mjs 模式） |
| P2 | guardrail 蒸馏通道 + 手动收尾档 + brief 消费率回流（consumed_at → 调整预算分配） | guardrail 晋升 case；月度消费率报告 |

## 验证

- 单测：anticipation 主题选取（高频 ask 聚类）、brief 过期语义、catch-up 窗口排序。
- E2E：`desktop-app/scripts/day-close-brief-check.mjs` / `catch-up-brief-check.mjs`（注入固定 fixture → 断言 brief 结构与 weave 字段）。
- 成本核算：每晚 ≤8 brief × ~1k token ≈ 可忽略；对照指标 = /ask 命中 prior 时的端到端时延与 token 降幅（Letta 论文口径，目标摊销 ≥2×）。
- 书的反向验收：catch-up 卡片绝不产生已读副作用（红队 case：展示 brief 后，原消息未读状态不变）。

## 与既有 plan 的关系

- `memory-day-pilot-plan.md`（部分落地）：两场景是 Day Pilot 的姊妹时段，复用 mission/brief 基建与 OverviewPage 入口；Day Pilot 管"今天打什么仗"，catch-up 管"刚才错过了什么"，close 管"今天交代完了吗"。
- `working-memory-return-stack-plan.md`（搁置）：其"自动意图断点"不可靠的教训已吸收——本 plan 只用确定性触发（时长/会议结束），不猜任务意图；显式 mark 的断点功能继续留给该 plan 将来复活。
- `memory-proactivity-cost-asymmetry-plan.md`（同批）：close brief 的通知投递走其 utility v2 评分。
- `memory-weave-provenance-visibility-plan.md`：brief 内每条目带 weave 徽章（缝合可感知的主要消费场景）。

## 风险与边界

- 预计算浪费：消费率（consumed_at 非空占比）做月度回流，低消费 kind 自动降预算——书「成本-静默」矛盾的工程答案：预算花在被消费的地方。
- 打扰红线：catch-up 永不自动弹窗；close 通知走 ProactivityPolicy 正常竞争，不开后门。
- guardrail 误学：晋升阈值复用 writing-style 双门槛（证据≥3 + confidence≥0.68），且 guardrail 只约束表达与流程，不约束事实判断。
