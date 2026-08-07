# Memory Claim Attribution / 记忆主张归属

_最后更新：2026-07-31_

## 大白话结论

这是一层默认无界面的记忆安全门禁，不是一条新的用户旅程。

用户在 Glip、会议、网页或其他 AI 里照常说话。Personal AI 先保留原始消息，再把一段话切成句内主张，分别判断“谁在表达、是决定/转述/建议/假设/承诺中的哪一种、是否已验证、允许进入哪类派生记忆”。普通单一自述静默通过；AI 建议、他人观点、假设或归属失败不能因为整条消息由用户发送，就自动成为用户画像、当前事实或已接受承诺。

只有当归属确实改变本轮后果时，既有 Ask、Memory Lens Expanded Card、Compose preview、User Profile 证据审计或 Meeting 证据详情才显示一条紧凑回执。纠错控件只放在 Ask 和 Memory Lens 的既有详情里；Compose、Profile、Meeting 只读解释本轮后果。纠正只更新 Personal AI 的派生判断和下游权限，永远不改原始消息，也不写回 Glip、网页、会议平台或其他外部系统。

交互 Demo：[memory-claim-attribution.html](../demo/memory-claim-attribution.html)。

## 用户体验分层

### P0：日常无感

1. 用户照常发送或导入内容。
2. 系统先写 `messages_raw`，状态为 `pending`。
3. 确定性 segmenter 切分 claim；policy compiler 决定画像、当前事实、行动和被动召回资格。
4. 成功后 raw 状态变为 `resolved`；失败变为 `failed`，但 raw、chunk、实体等低责任数据仍可保留。
5. `pending / failed / unknown` 对画像、当前事实、承诺等高责任派生失败关闭。

普通 Glip 消息没有新增按钮、弹窗、确认步骤或待审队列；不存在“发送后点记住这段”的流程。

### P1：只在后果变化时提示

- 单一、明确、当前时态的用户自述：不返回归属回执，不增加 UI。
- mixed evidence：返回 `attributionReceipt`，摘要形如 `采用 1 条；仅作背景 1 条；未使用 1 条`。
- `background_only` 可在主动问答中提供语境，但必须标明不代表用户立场。
- `block` 在进入 Ask prompt、被动召回、Compose 生成前被移除；展示片段也使用净化后的 claim 文本。
- Memory Lens 只在 Expanded Card 显示归属 chip；Rest 和 Hover Peek 保持原样。
- Compose 有归属回执时强制进入既有 preview，不新增永久按钮；任何因此升级为锁定复核的 receipt 都必须在 preview 内给出 compact 解释。即使 receipt 中所有 claim 最终都是 `used`，也要说明采用结果与原文不变边界；普通无 receipt 建议仍静默。
- Meeting / Profile 只在既有证据详情展开后显示，不抢占主内容。

### P2：就地纠错

Ask 回执和 Memory Lens 既有详情可提交：

- `not_my_view`
- `my_decision`
- `reported_speech`
- `hypothesis`

写入契约：

- `expectedRevision` 做乐观并发控制；旧 revision 返回 `409`。
- `idempotencyKey` 防止重复点击产生重复 revision。
- correction API 另支持 `undo_last` 撤销最近一次 revision；当前 Ask / Lens 不显示该动作，避免在紧凑详情里增加低频控制。
- 每次纠错写 `memory_claim_revisions`，保留前后 attribution 与来源。
- 与该 claim 绑定且失去依据的 profile/property/opinion/change/action 派生项被撤回或失效。
- API 始终返回 `rawSourceChanged: false`；界面成功回执明确显示“原始消息未修改”。

Memory Lens 因此仍不捕捉新资料、不修改来源、不生成回复；它只允许用户纠正 Personal AI 自己的派生 metadata。网页侧 `+ 入库` 仍只属于 Memory Capture。

## Claim 数据契约

owner、speech mode、polarity、time basis、verification 与 commitment 必须正交，不能压成一个“可信/不可信”枚举。

```ts
interface MemoryClaimEnvelope {
  id: string;
  sourceMessageId: string;
  sourceSpan: { start: number; end: number; textHash: string };
  sourceText: string;
  normalizedClaim: string;
  owner: {
    kind:
      | 'self'
      | 'named_person'
      | 'organization_or_source'
      | 'ai_agent'
      | 'system_observation'
      | 'unknown';
    entityId?: string;
    displayName?: string;
  };
  speechMode:
    | 'direct_assertion'
    | 'quote'
    | 'reported_speech'
    | 'suggestion'
    | 'question'
    | 'hypothesis'
    | 'simulation'
    | 'intent_or_plan'
    | 'commitment'
    | 'correction';
  polarity: 'affirmed' | 'negated' | 'uncertain';
  timeBasis:
    | 'current'
    | 'as_of_source_time'
    | 'future_intent'
    | 'hypothetical'
    | 'counterfactual'
    | 'unknown';
  verification:
    | 'unverified'
    | 'source_only'
    | 'corroborated'
    | 'verified_completion'
    | 'contradicted';
  commitment: 'none' | 'proposed' | 'assigned' | 'accepted';
  confidence: number;
  policy: {
    profileCandidate: boolean;
    currentTruthCandidate: boolean;
    actionCandidate: boolean;
    passiveRecall: 'allow' | 'background_only' | 'block';
  };
  revision: number;
  corrected: boolean;
}
```

## 不可破坏的门禁

| 输入主张 | Profile | 当前事实 | Action / 承诺 | 被动召回 |
| --- | --- | --- | --- | --- |
| 用户明确自述偏好/约束 | 可成为候选；仍遵守敏感与确认规则 | 仅相关字段 | 仅明确接受的 commitment | allow |
| 用户直接陈述当前事实 | 不自动成为画像 | owner-authored candidate | 否 | allow |
| 他人原话或用户转述 | 禁止 | source-only/background | 被指派不等于接受 | background only |
| AI 建议或 AI 摘要 | 禁止 | 禁止成为用户当前事实 | proposed，不得 accepted | background only |
| 假设、模拟、反事实、问句 | 禁止 | 禁止 | 禁止 | block |
| 用户明确接受指派 | 不适用 | commitment event | accepted | allow |
| 独立 connector completion receipt | 不适用 | 可验证当前结果 | verified completion | allow |
| owner 不明、冲突或低置信 | 禁止 | 禁止 | 禁止 | block |

硬规则：

1. `ownerAuthored=true` 只描述整条消息，不能替代 claim owner。
2. 文本措辞不能单独产出 `verified_completion`；必须有 connector receipt。
3. `assigned`、`proposed` 和 `accepted` 是不同状态。
4. 归属失败不能为了召回率升级为 self。
5. profile/property/opinion/timeline candidate 必须显式引用唯一合格 claim；模糊 value 匹配不能替代引用。

## 存储与生命周期

Migration：`058_memory_claim_attribution.sql`。

- `messages_raw.claim_attribution_status/version/attributed_at/error`：raw 级处理状态。
- `memory_claims`：当前和历史 span attribution、policy 与 revision。
- `memory_claim_revisions`：用户纠正、幂等键和失效派生摘要。
- `memory_claim_links`：claim 到 profile/property/opinion/change/action 等派生对象的证据连接。

旧消息默认 `legacy_unclassified`。消费端在真正需要 message/chunk evidence 时按需运行 attribution；已经 `failed` 的记录不会在每次召回中反复尝试。来源正文确实更新时使用 `force: true`；只更新 summary 或 metadata 不重算，避免覆盖用户纠正。

备份合并包含 claim、revision、link。源消息删除时，lineage cascade 同时删除或失效 claim 派生；纠错不会篡改 raw span。

## 写入与消费链路

### 写入端

- `IngestionPipeline`：raw-first；profile、opinion、entity property、timeline 只消费有 claim 引用且 policy 合格的候选。
- `MemoryChangeLedgerService`：message-backed 变化必须有唯一 current-truth claim 与 evidence quote；结构化权威 connector 继续走自身 authority。
- `OnlineReflection`：Ask query 只作为本轮输入，不写 entity fact；明确偏好最高只进入 `pending_confirm`，问句/引用/AI 建议不进入 active profile。
- 直接写 `messages_raw` 的 Source Memory Capture、Smart Import、Calendar、Source Memory backfill 与 Outreach 都先置 pending 再运行 attribution。

### 消费端

- `ContextRecallService`：attribution → cohesion → final attribution；receipt 只聚合最终保留证据。
- Ask：prompt、fallback、evidence card、SSE `recall_done/result` 都使用同一最终集合；blocked claim 不能从 derived block 旁路回到 UI。
- Compose Assist：生成只用净化 evidence；有归属回执时复用锁定 preview，并保证触发 review 的 receipt 一定有可见 compact 解释，不能只升级旅程而隐藏原因。
- Memory Lens：Expanded Card metadata 显示一个低噪声 chip；纠错复用既有反馈详情。
- User Profile / Meeting：只在证据审计或证据来源详情里解释 claim consequence，不提供纠错控件。

## 代码入口

- `memory-service/src/core/ClaimSegmenter.ts`
- `memory-service/src/core/ClaimPolicyCompiler.ts`
- `memory-service/src/core/MemoryClaimAttributionService.ts`
- `memory-service/src/core/MemoryClaimCorrectionService.ts`
- `memory-service/src/repositories/MemoryClaimRepository.ts`
- `memory-service/src/routes/memoryClaims.ts`
- `memory-service/src/storage/migrations/058_memory_claim_attribution.sql`
- `src/claimAttributionPresentation.ts`
- `src/modals/components/SearchResultPage.vue`
- `src/contentScriptWebIntelligence.ts`
- `src/composer-guard/ComposerGuardController.ts`
- `src/meeting-shell/meetingSidePanel.tsx`
- `src/modals/components/UserProfilePage.vue`

## 验证要求

功能改动至少需要：

1. deterministic segmenter / policy unit tests；
2. repository、migration、restart/idempotency/correction API tests；
3. ingestion、Change Ledger、OnlineReflection 与所有 raw 直写入口测试；
4. Ask / Context Recall / Compose / Profile / Meeting 的消费测试；
5. 真实扩展 UI E2E，确认 ordinary receipt 消失、mixed receipt 可展开、纠错回执声明 raw unchanged、Rest/Peek 无 chip、普通 Glip 无新增“记住”入口；
6. `memory-claim-attribution` eval suite 与 Reader Proof；
7. `eval:memory-abilities` 回归。

专项 eval 必须包含 mixed self + AI + hypothesis、assigned 不等于 accepted、unknown/failure fail-closed、correction/raw unchanged 和低噪声 UI。只校验 registry 结构不能作为功能通过证明。

## 设计去重

- 不建立 Memory Intake review queue；正常情况自主运行。
- 不替代 Injection Defense：一个判断恶意/信任，一个判断谁在主张。
- 不替代 Evidence Cohesion：先做 attribution，再判断证据是否同题。
- 不替代 Change Ledger：claim 只净化 authority 输入，不另建时间账本。
- 不替代 speaker diarization：音频 speaker 是信号，不等于直接承诺或事实 owner。
- 不复活已搁置的跨 AI claim 工作台或独立治理页面。

## 产品参考

- [OpenAI Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq)：消费时解释记忆来源与允许纠正。
- [Mem0 memory API](https://docs.mem0.ai/api-reference/memory/add-memories)：保留 user/assistant role，但 message role 仍不足以解决句内转述。
- [Graphiti](https://github.com/getzep/graphiti)：raw episode provenance；本能力进一步记录句内 owner/stance。
- [Attribution and the discourse structure of reports](https://aclanthology.org/2023.dnd-14.6/)：直接、间接和混合转述的 segment-attribution 关系。
- [Evaluating and Categorizing Factual Errors in Dialogue Summarization](https://aclanthology.org/2024.acl-long.677/)：合理但无对话证据的 contextual inference 风险。
