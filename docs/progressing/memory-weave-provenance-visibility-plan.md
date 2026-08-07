# 体验升级：缝合可感知 / Weave Provenance Visibility

> 生成时间：2026-06-11 CST
> 来源：《置身钉内》"最致命的错位"教训（AI 台面下做了网状缝合，台面上只给一个肉眼也能扫出的摘要）
> 优先级：P0（差异化价值的呈现层，纯增量）
> 预估规模：后端 2 天 + 前端 2 天 + notification 表 migration 1 个

## 结论

凡是**跨来源/跨时间缝合**出来的记忆产物（ask 答案、Lens 提示、storyline 段落、dream 洞察、通知），统一附带一个轻量 `weave` 统计（N 个来源 × M 天跨度 × K 个实体），前端渲染成"缝合徽章"。让"用断手也做不到"的工作在 UI 上一眼可见——这是本系统对"更好的搜索"的差异化价值，必须被感知。

它不是：
- 不是新的 UI 页面或证据浏览器（Memory Exploring 已有 evidence list / timeline）
- 不是给所有结果加徽章（单来源结果不加，避免徽章泛滥变成噪声）
- 不是改变 Scene Memory Autopilot 的展示门控（只增强已决定展示的内容）

## 假设场景：一步步的体验（有 UI → [静态 demo](./memory-weave-provenance-visibility-demo.html)）

1. **09:15 打开 Jira MTR-148115**。Memory Lens 浮出一张提示卡，右上角多了一枚徽章：**「⊕ 缝合 3 来源 × 17 天」**——你立刻知道这不是"字面相似的旧消息"，而是系统跨场域拼出来的结论。单来源的普通提示卡没有徽章（不通胀）。
2. **点击徽章**，展开既有证据视图：5/21 客户群消息、5/28 会议纪要、6/2 交付群消息，外加一条 6/5 的网页摘录——后者带 **⚠「该来源含疑似指令文本，已按数据处理」**（injection-defense plan 的标记在同一视图里可见）。
3. **14:02 通知中心**进来一条「MTR-148115 估时与会议结论冲突」，正文下方一行小字：**「依据：2 条记忆 · 1 个冲突」**，点开即证据。你第一次能回答书里那个质问——"系统凭什么现在推给我"。
4. **16:30 在 /ask 问项目状态**，答案 evidence 区头部出现统计条：「本回答缝合 4 来源 × 21 天 × 6 实体」，hover 看各来源分布。
5. （P2）徽章点开后多一行自然语言解释：「想到这条是因为：MTR-148115 → 依赖 → 导出格式变更」（来自 PPR diagnostics）。

**Before 的对照**：同样的提示，今天长这样——一张普通卡片写着「相关：客户希望导出改 XLSX」。用户的内心对照物是"我自己翻一下也能找到"，徽章把"翻不到的 17 天跨度"显性化了。

## 实现状态（2026-06-17 已落地 P0 后端契约）

- `core/weaveStats.ts` `buildWeaveStats`（sourceCount/sourceKinds/daySpanDays/entityCount/crossSource，阈值 ≥2 来源或 ≥7 天，纯函数零额外查询）。
- `/ask` 顶层 `weave`（已加进 200 响应 schema 防 strip）；`/context-recall` 顶层 `weave`（基于 matches）。`crossSource=false` 时整字段省略。
- 测试：`weaveStats.test.ts`（6）+ `api-context-recall-weave.test.ts`（2）。已部署到 10.32.56.212；线上 mThor 查询实测 `weave={sourceCount:5,…,daySpanDays:99,crossSource:true}`；记忆六能力体检 6/6 无回归。
- 文档：`docs/memory_system.md`「缝合可感知」。
- **前端徽章已落地（2026-06-17）**：搜索 Ask 结果页 `SearchResultPage.vue`（读 `askResult.weave`，答案下方「⊕ 缝合 N 来源 × M 天」）+ Memory Lens 浮窗 `contentScriptWebIntelligence.ts`（meta-row weave chip，由展示 matches 客户端计算）。client 类型加 `weave`。webpack 编译通过。
- **仍未做（P1）**：通知中心「依据」行（依赖 notification evidence 列 migration，归 proactivity-cost-asymmetry-plan）；桌面 quick-ask 徽章（需穿过 SSE 流事件）；per-item ⚠ 标记；P2 解释链路（依赖 PPR diagnostics）。

## 依据

- 书：「AI 在台面下做了最难的网状逻辑缝合，但在台面上，却只给用户呈现了一个『老钉钉里用肉眼扫一下也能看到』的简短摘要。用户感知不到那个降维打击……新范式的高昂信任成本，最终败走原场域的肌肉记忆。」——智能必须被界面承接。
- 书：排序/智能"被交互遮住"后，用户对照物变成"我自己扫一眼"，迁移动力归零。
- Anthropic/Claude 路线：记忆透明（显式工具调用可见）是信任设计标杆；本系统已有 channelDiagnostics / evidence refs 基础，缺的是聚合呈现。

## 现状（代码事实）

- `/ask`：`formatRecalledContext`（ask.ts:494-523）每条证据带 `(source) [date] [title]`；响应已有 `evidence[]`、`channelDiagnostics[]`、`blocks`（timeline/evidence_list）——原材料齐全，但**没有"这个答案缝合了几个来源、跨了多少天"的聚合统计**。
- Lens（/context-recall）：matches 带来源与命中通道；卡片无跨源标识。
- Storyline draft：已有 `evidenceRefs` 与 `evidenceClusters[{label, sourceKinds, evidenceCount}]`（memory_storyline_builder.md:49-53）——最接近本 plan 形态的先例。
- Dream（GenerativeReplay.ts:262-290）：dreams/*.md 已写 Grounding Receipt（memory count & types）——文件里有，UI 徽章无。
- **notification_records 无 evidence 列**（盘点 C 确认）：通知正文无法引用"依据的记忆"——ProAct 论文族明确"通知附依据"提升信任与可关闭性。

## 方案

### WeaveStats 统一结构（shared util）

```ts
interface WeaveStats {
  sourceCount: number;          // distinct source_type:source
  sourceKinds: string[];        // ['ringcentral','jira','webpage','meeting']
  daySpanDays: number;          // max(timestamp) - min(timestamp)
  entityCount: number;          // distinct related entities
  crossSource: boolean;         // sourceCount>=2 || daySpanDays>=7
}
buildWeaveStats(evidenceRefs: EvidenceRef[]): WeaveStats  // 纯函数，core/weaveStats.ts
```

判定与渲染规则：`crossSource === false` 时不输出 weave 字段（前端无徽章）；true 时渲染「⊕ 缝合 3 来源 × 17 天」徽章，hover/点击展开既有 evidence list。

### 接入点（按数据流）

1. `/ask` 响应：顶层 `weave` + 每个 `analysis.insights[i].weave`（insight 的 evidence 子集单独算）。
2. `/context-recall`：每个 match 的 `weave`（多数单来源 match 自然无徽章；cue 合并多 match 时按合并集算）。
3. Storyline draft：segment 级 `weave`（直接从 evidenceClusters 推导，零额外查询）。
4. Dream digest / weekly report：digest item 带 `weave`（从 Grounding Receipt 数据结构化）。
5. **通知（需 migration）**：`notification_records` 增加 `evidence_refs_json TEXT`、`weave_json TEXT`；NotificationCenterService 生成通知时写入；feed 渲染一行小字「依据：3 条记忆 · 2 个来源」可点开。

### 前端（extension + desktop-app 共用样式）

- Lens 卡片右上角徽章；ask 结果 evidence 区头部统计条；storyline 段落 chip；notification feed 次级文本。
- 徽章点击 = 展开既有证据视图（不新建路由）；无证据查看权限的场景（脱敏摘要）只显示计数不可展开。

## 实施切片

| 切片 | 内容 | 验收 |
| --- | --- | --- |
| P0 | weaveStats util + /ask + Lens 徽章 | util 单测；ask/contextRecall 响应快照含 weave；单来源不出字段 |
| P1 | notification_records migration + 通知"依据"行 + storyline/dream 接入 | 通知 feed E2E（quick-ask-status-card-check 模式）|
| P2 | "为什么想到这个"展开：合并 PPR 种子/激活路径（见 memory-recall-ppr-association-plan 的 diagnostics）成自然语言一句话 | 解释链路 case |

## 验证

- 单测：`weaveStats.test.ts`——去重口径（source_type:source）、天跨度边界、crossSource 阈值、空 evidence。
- 契约：api-ask / api-context-recall 测试增加 weave 字段断言；无证据时字段缺省。
- 体验回归：scene-memory-autopilot eval 确认徽章不影响静默决策（gates 不读 weave）。
- 反噪声验收：抽样 50 条 Lens 展示，徽章出现率应 <40%（高于此说明阈值过松，徽章贬值）。

## 与既有 plan 的关系

- `memory-freshness-radar-plan.md`（候选）：那是"来源变化"徽章（时间维度的新鲜度），本 plan 是"来源广度"徽章；UI 语言应统一设计，避免两套徽章体系。
- `ai-context-passport-plan.md`：外发上下文包的 evidence pack 可直接复用 WeaveStats 作摘要头。
- `memory-recall-ppr-association-plan.md`：P2 的解释链路消费其 diagnostics。

## 风险与边界

- 徽章通胀：阈值（≥2 来源或 ≥7 天）需用真实数据校准，宁缺勿滥——书的教训反面是"假装降维打击"更伤信任。
- 性能：WeaveStats 是对已取回 evidence 的纯内存统计，零额外查询；通知路径多一次 JSON 序列化。
- 隐私：weave 计数不泄露内容；脱敏场景只给计数不展开（遵守既有 scope/privacy 门控）。
