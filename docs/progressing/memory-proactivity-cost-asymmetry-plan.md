# 通知升级：漏报/误报代价不对称 / Proactivity Cost-Asymmetry (Utility v2)

> 生成时间：2026-06-11 CST
> 来源：《置身钉内》「成本约束要求对每次主动推送精打细算，可重要信息恰恰可能因一次节省资源的静默而被错过」+ ProMemAssist（arXiv:2507.21378）打扰时机价值/成本模型 + ProAgentBench（arXiv:2602.04482）
> 优先级：P1（公式级改造，改动面小、影响面大）
> 预估规模：2-3 天（policy 公式 + 通知证据列 + 回流校准）

## 结论

把 ProactivityPolicy 的单一 utility 公式升级为**代价不对称的两因子模型**：`utility = P(用户需要) × miss_cost − P(打扰) × interrupt_cost`，显式区分"漏掉重要事"与"误打扰"两种错误的不同代价；高 miss_cost 候选允许更高误报率（deadline/冲突），低 miss_cost 候选从严（资讯类）。同时给通知补上证据引用（依据的记忆），让每次打扰可解释、可关闭。

它不是：
- 不是提高通知量（默认参数下总量预算不变，变的是**配额分给谁**）
- 不是新的通知渠道或 UI（lane/priority/feed 全部不动）
- 不是用户级复杂配置面板（沿用现有 quiet hours + 每日上限两个旋钮；代价矩阵是系统内置常量起步）

## 假设场景：一步步的体验（有 UI → [静态 demo](./memory-proactivity-cost-asymmetry-demo.html)）

**周二 23:40**，反思线程发现一个高危组合：明早 10:00 的评审会依赖 MTR-148115 的回归结论，而交付群 22:51 的消息说回归还没跑完——truth conflict + deadline 双信号。

**Before（v1 单公式）**

```
benefit = 0.35*0.9 + 0.25*0.85 + 0.20*0.8 + 0.20*0.7 = 0.83
cost    = quiet(0.5) + spam(0) + pref(0.15)            = 0.65
utility = 0.18  → silent（仅日志）
```

你周三 09:50 才被同事口头提醒，会上被动。**同一晚**，每周梦境报表 utility 0.42 照常 notify——资讯挤掉了救命信息。

**After（v2 代价不对称）**

```
deadline 类: missCost 0.95, interrupt 0.2, quietSens 0.3
utility_v2 = 0.83*0.95 − (1−0.83)*0.2*(1+0.5*0.3+0.15) = 0.75 → notify
但当前在安静时段 → 走保底通道：scheduled 次晨 08:00 置顶投递
dream_digest 类: missCost 0.15 → utility_v2 = −0.31 → silent（资讯类从严，次日随 digest 合并）
```

**周三 08:00** 手机/桌面通知置顶一条：「⚠ 10:00 评审的前置回归未完成（依据：2 条记忆）」——点「依据」看到 22:51 交付群消息 + 评审会日历项。你 08:05 在群里催了一句，09:40 拿到结论进会。

**月底**，校准回流发现 project_update 类 30 天 dismissRate 0.68 → 自动把它的 interrupt 从 0.6 上调到 0.7，写入 audit 表一行（可回滚）。你没配置过任何东西，系统在学你。

**净效果**：通知总量不变（demo 里有 before/after 双栏对照），变的是深夜救命信息从"被静默"改为"次晨置顶"，资讯类从"挤占额度"改为"合并入摘要"。

## 依据

- 书：成本-静默矛盾——为省资源静默一次，错过的可能恰是最重要的信息；以及「主动服务的分岔」：高能动用户需要的是可控的提醒，不是更多提醒。
- ProMemAssist：用工作记忆模型权衡打扰时机的价值/成本，实证优于固定阈值。
- ProAct/ProAgentBench：通知候选评分 = 记忆驱动的意图预测 × 时机成本，两因子显式分离。
- 盘点 C 确认现状：单公式 `utility = benefit − cost`（benefit=0.35*importance+0.25*urgency+0.20*confidence+0.20*actionability；cost=quiet 0.5+spam 0~1+pref 0~1），阈值 0.40/0.25/0.10，**同一套阈值对待所有错误类型**；notification_records 无 evidence 列。

## 现状（代码事实）

- `ProactivityPolicy.ts:158-178` 公式与阈值；`:334-374` throttle（10 条/天 + 同 topic 24h）。
- 通知类型路由 `classifyNotificationRouting`（NotificationCenterService.ts:320-343）：truth_conflict/deadline/notify_user→todo+high；dream_digest/weekly_report→notice。
- 反馈数据已有：notification_records(clicked_at, dismissed_at) + utility_score 落库——校准回流的原料齐全但未使用。
- 安静时段是统一 0.5 cost，不分类型（深夜的 deadline 冲突也被同等压制）。

## 方案

### Utility v2 公式

```
needScore   = 0.35*importance + 0.25*urgency + 0.20*confidence + 0.20*actionability   // 沿用
missCost    = COST_MATRIX[type].miss        // 漏报代价 [0,1]
intrCost    = COST_MATRIX[type].interrupt   // 误打扰代价基数 [0,1]
timingCost  = quietCost*quietSensitivity[type] + spamPenalty + prefCost              // 时机项
utility_v2  = needScore * missCost − (1 − needScore) * intrCost * (1 + timingCost)

COST_MATRIX 起步常量（系统内置，可 config 覆写）：
  truth_conflict   miss 0.9  interrupt 0.3  quietSens 0.4   // 漏了会写错事实，深夜也值得早晨置顶
  deadline         miss 0.95 interrupt 0.2  quietSens 0.3
  notify_user      miss 0.7  interrupt 0.4  quietSens 1.0
  project_update   miss 0.4  interrupt 0.6  quietSens 1.0
  property_change  miss 0.35 interrupt 0.6  quietSens 1.0
  dream_digest     miss 0.15 interrupt 0.8  quietSens 1.0   // 纯资讯，从严
  weekly_report    miss 0.15 interrupt 0.7  quietSens 1.0
```

决策阈值沿用三档语义（notify/confirm_only/silent），但加**保底通道**：`missCost ≥ 0.9 && needScore ≥ 0.5` 的候选即使在安静时段也不丢弃——降级为「次晨置顶补投」（scheduled 状态，notification feed 已支持 scheduled），而不是 silent。这是书中矛盾的直接工程答案：**省下的是深夜打扰，不是信息本身**。

### 通知证据引用（与 weave plan 共用 migration）

- `notification_records` 增加 `evidence_refs_json`、`weave_json`（memory-weave-provenance-visibility-plan 的 P1 同一 migration，勿重复建）。
- feed 渲染「依据：2 条记忆 · 1 个冲突」，点开看证据——ProAct 结论：附依据显著提升信任与可关闭性；也响应书「通知凭什么现在推给我」的责任质询。

### 校准回流（月度，纯统计无 LLM）

```
按 type 聚合 30 天：clickRate = clicked/(delivered)，dismissRate = dismissed/delivered
  dismissRate > 0.6 → interrupt += 0.1（上限 0.9）
  clickRate  > 0.5 且曾被 silent 压制的同类候选存在 → miss += 0.05（上限 0.95）
调整量写 notification_policy_audit 表（type, old, new, reason, window），可回滚。
```

### 行为亲密度协同（依赖关系，非阻塞）

- `memory-salience-behavioral-intimacy-plan.md` P1 落地后：needScore 的 importance 输入乘 `(1 + 0.2*affinity)`——书的排序配方第三信号同样作用于通知侧。

## 实施切片

| 切片 | 内容 | 验收 |
| --- | --- | --- |
| P0 | utility_v2 + COST_MATRIX + 保底补投通道（config 开关 `proactivity.utilityV2`） | 决策单测矩阵（7 类型 × 3 时段）；总通知量持平 ±10% |
| P1 | evidence_refs 列 + feed 依据行（与 weave plan P1 合并交付） | feed E2E |
| P2 | 月度校准回流 + audit 表 | 校准脚本 dry-run 报告 |

## 验证

- 单测：`proactivityPolicy.v2.test.ts`——关键断言：①深夜 deadline 不被丢弃而是 scheduled 次晨；②dream_digest 在同 needScore 下比 deadline 更难 notify；③开关关闭时输出与 v1 逐字节一致。
- 影子模式先行：v2 与 v1 并行打分一周（只记日志不改投递），对比决策差异报告后再切换——通知是用户最敏感的面，不直接上线。
- 北极星：30 天 dismissRate 下降且 clickRate 不降；silent 池中被次晨补投的通知 clickRate ≥ 平均值（证明保底通道捞回的确实是重要信息）。

## 与既有 plan 的关系

- `proactive_notification_system.md`（已部分实现）：本 plan 是其 policy 层的 v2 演进，管道（candidates→policy→records）不动。
- `memory-reflection-governor-plan.md`（搁置）：其"止损无新证据的追踪"思想由校准回流的 interrupt 上调间接实现，不复活独立治理页。
- `memory-sleep-time-compute-plan.md`：day close 通知按 v2 评分；anticipation brief 不直接发通知（只供消费），不抢预算。

## 风险与边界

- 参数主观性：COST_MATRIX 起步值是判断不是数据——影子模式 + 月度校准让它收敛；audit 表保证每次调整可解释可回滚。
- 补投通道滥用风险：仅 missCost≥0.9 类型可用，且计入次日配额（不是免费午餐）。
- 不做用户级代价配置：书的教训——用户需要的是"系统逐渐学会我"，不是又一个配置面板；个性化交给校准回流与亲密度因子。
