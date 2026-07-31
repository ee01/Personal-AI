# Evidence Cohesion Gate / 证据对齐

_最后更新: 2026-07-16_

Evidence Cohesion Gate（证据对齐）是 Memory Service 的消费前证据隔离层。它在召回候选准备进入回答、反思、外部委派、草稿或 Context Pack 前，判断这些证据是否围绕同一个问题，并只让对齐后的证据继续被消费。

它不修改召回索引，不给原始记忆永久分类，也不复制存储正文。正常结果默认静默；`cohesionReceipt` 主要供调用方、trace、eval 和排障使用。

## 用户体验

### Ask

用户问“UMW 的用途和 repo 是什么”，召回同时命中 UMW、rc-ai-learning 和 AI Notes。Gate 只让 UMW 证据进入 Evidence Resolution、答案 prompt 和 response；普通 `cohesive` 结果不增加 UI。若没有足够依据选出一个问题，Ask 复用现有候选澄清交互，不生成貌似完整的答案。

### Web AI / Compose Assist

用户在 ChatGPT 中让 Personal AI 补充 `MTR-141852` 上下文。即使 Context Recall 旁路候选、change projection 或 locked-context fallback 混入 `NAV-8891`，第二道消费门也会在 Prompt Compiler 前移除它。用户仍只看到可插入的正文；被排除证据留在 response receipt、debug 和 eval，不塞进输入框旁预览。

## 运行顺序

```text
Recall / local research / fallback evidence
                    |
                    v
      Evidence Cohesion Gate
      subject + scene + identifier + claim slot + scope
                    |
       +------------+-------------+
       |                          |
       v                          v
cohesive / conflict       split / insufficient / blocked
       |                          |
       v                          v
Authority / Resolution /   Ask 澄清或静默；
Prompt Compiler / Action   不生成草稿，不创建外部动作
```

Cohesion 回答“证据是否围绕同一个问题”；Authority 回答“同一问题内谁有权改变事实”；Evidence Watch 回答“这个事实之后是否还要向权威来源复核”。顺序必须是 Cohesion 在前。

## 判断逻辑

`EvidenceCohesionGateService` 使用确定性特征，不依赖 LLM 才能安全运行：

- subject：调用方给出的 subject key、topic label/alias、claim subject。
- scene：conversation、group、thread、meeting、project、Jira 等来源锚点。
- identifier：明确 Jira key、完整 repository URL/slug；常见模型版本如 `GPT-5.5` 不当成 issue key，`Dev/QA` 这类短斜杠词不当成 repo。
- claim slot：`status`、`repository_url`、`attachment_id`、`purpose`、`owner`、`deadline`、`eta`、`estimate`。
- scope：只有候选明确标成不允许的范围才阻断；缺失 scope 不伪造为 `unknown` 后误杀。
- generic-token penalty：`AI`、`repo`、`project`、`status` 等泛词不能单独证明证据已经对齐。

候选先按共享 subject、scene、identifier 或足够强的 distinctive-term overlap 聚类，再按当前问题锚点、claim slot、召回分和 cluster 大小排序。完整锚点可保留多个都独立匹配的 cluster；宽泛历史/比较请求使用 `unanchoredMultipleClusters='preserve'`，避免把合法跨项目总结误判为串题。

Context Recall 的删除权限只来自原始请求里的明确 issue/project/entity hint。Recall Context Expansion、`contextMatch.locked`、扩展 query 和自由文本 topic 只帮助召回与排序，不能反过来授权 Gate 删除证据。

## 状态与行为

| 状态 | 行为 |
|---|---|
| `cohesive` | 使用已对齐证据；receipt 默认 `silent=true` |
| `cohesive_with_background` | 主证据已对齐，允许少量兼容背景；默认静默 |
| `split_required` | 无法安全选择单一问题；Ask 返回候选，Reflection/Compose 停止消费 |
| `insufficient_anchor` | 有候选但缺少可靠锚点；不编答案或草稿 |
| `conflict_needs_authority` | 保留同一问题内的冲突证据，交给 Authority / Evidence Watch，不随机删掉一方 |
| `blocked_cross_scene` | 明确跨 scope/外发边界；Context Pack、草稿和外部委派失败关闭 |

统一回执：

```ts
interface EvidenceCohesionReceipt {
  policyVersion: 'evidence-cohesion-v1';
  state: EvidenceCohesionState;
  usedCount: number;
  excludedCount: number;
  clusterCount: number;
  primarySubject?: string;
  silent: boolean;
  summary: string;
}
```

## 接入点

| 入口 | Gate 位置 | 失败行为 |
|---|---|---|
| `/ask`、`/ask/stream` | recall/Active Recall 合并后，Evidence Resolution、LLM 和 response evidence 前 | split/insufficient/blocked 复用候选澄清；同一规则覆盖流式和非流式 |
| `ReflectionWorker` | 本地研究证据合并后，reflection prompt、fallback、动作规划和委派前 | 阻断外部 action；markdown/result 记录 receipt；action 只携带实际使用的 evidence refs |
| `/context-recall` | passive fast path 与普通 path 的最终展示前、`limit` 切片前 | 普通排除静默；阻断状态返回空 matches 和 quiet reason |
| `/composer/assist` | Context Recall 之后再次执行，覆盖 change projection 与 locked-context fallback | Prompt Compiler、context pack、deterministic patch 和 draft 只接收 gated evidence |
| Web AI Context Pack | `intent='build_context_pack'`，只允许工作范围 evidence | 明确个人证据触发 `blocked_cross_scene`；仍可生成不使用记忆的通用 prompt rewrite |
| Keystone Brief in Context Recall | 只接收 `/context-recall` 已经过 Gate 的 `matches` | 不会重新拿回被排除候选；独立 Brief build 属于后续阶段 |

## 存储与 UI 边界

- 不新增数据表或 migration，不改 `messages_raw`、chunks、entities、scope 或 lifecycle 分类。
- Ask、Context Recall 和 Composer response 可返回 `cohesionReceipt`；调用方可以忽略正常静默回执。
- Reflection 只把精简 receipt 和实际使用的 evidence refs 写入现有 run/markdown/action 链路，不重复保存原文。
- Compose Assist hover 继续只展示待插入正文，不展示被排除来源，也不新增 review 页面。
- 当前没有独立 Gate 页面或人工队列。需要用户决策时复用 Ask 候选、Authority、Evidence Watch 或现有 action/confirm 流程。

## 文档归属

证据对齐是独立的横切策略能力，因此本文件是状态、回执、边界、接入顺序和 eval 契约的唯一完整说明。`memory_system.md` 以及 Ask、Reflection、Context Recall、Compose、Evidence Watch 等入口文档只记录各自如何接入，并链接回本文件；不要在多个入口文档复制整套判断规则。它不是独立用户页面，也不单独拥有存储模型。

## 历史问答的原始证据补回

部分旧聊天在导入时只保留于 `messages_raw`，早于 chunk/FTS 索引，不能因为没有 chunk 而在“当时的结论是什么”这类 Ask 中消失。主动 Ask 和 Reflection 的历史检索可在 FTS 候选之外，以受限的字面匹配补回少量原始消息；它不重建索引、不写回记忆，也不会改变原文。

- 带明确时间问题的 Ask（例如“Cursor 的结论在什么时候形成”）按历史查询处理，使 archive-only 的原始事实可以参与排序。
- 如果原始消息直接陈述了当前实体和结论，MMR 以及 Active Recall 的结果截断都保留该条证据，避免被更近但只提到相邻产品的消息挤掉。
- 该补回明确不用于 `passive_surface` 或 `composer_surface`。`/context-recall` 和 Compose Assist 继续只消费既有的静默展示候选，避免主动问答的宽匹配改变 UI 提示。
- 所有后续消费者仍经过证据对齐；补回只扩大候选来源，不授权跨题消费。

## 验证

共享单元与入口回归：

```bash
npm --prefix memory-service test -- --run src/__tests__/evidenceCohesionGateService.test.ts src/__tests__/api-ask.test.ts src/__tests__/reflectionWorker.test.ts src/__tests__/reflectionThreadService.test.ts src/__tests__/api-context-recall.test.ts src/__tests__/api-composer-assist.test.ts
npm --prefix memory-service run build
```

体验 eval 使用真实工作场景的脱敏 fixture，对比旧的 consume-all baseline 与生产 Gate，必须同时检查跨题泄漏、必要证据保留、状态、阻断决策和报告契约：

```bash
npm run eval:validate
npm run eval:run -- --suite evidence-cohesion-gate --no-repair
```

`eval:memory-abilities` 默认以 `evaluationMode=read_only` 调用 `/ask`，不创建 action、确认请求、answer-memory observation 或 Online Reflection。用于真实历史 Ask 的回归用例必须同时断言实体、原始结论数字和形成时间，不能以泛化的“成本”词命中代替。

Demo：[`evidence-cohesion-gate.html`](../demo/evidence-cohesion-gate.html)
