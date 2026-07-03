# Memory Lens Scene Context Contract / 场景上下文契约重构计划

> 生成时间：2026-06-09 CST
> 状态：计划，暂不继续修修补补
> 相关问题：MTR-148115 Jira issue 页面复述 `DEV Estimate New = 0.4`；Jira comment 输入框未出现 Compose Assist 入口
> 相关能力：Memory Lens、Compose Assist、Scene Memory Autopilot、Cue Compiler、Outcome Loop
> 查询可视化：[`memory-lens-interaction-scene-query-demo.html`](./memory-lens-interaction-scene-query-demo.html)

## 结论

这次问题的根因不是“完全没有场景判断”，而是当前 Memory Lens 的场景输入仍然不够细。

项目里已经有 **Scene Memory Autopilot / 场景记忆自动驾驶**，并且后端已经有 `SceneFrameService`、`ContextRecallService`、`CueCompilerService`、`MemoryOutcomeLoopService` 这条链路。它能从页面 title、URL、Jira key、visible messages、sourceContext、entityHints 等信号里判断“这像 Jira estimate / RingCentral reply / web reading / meeting live”。

但它现在还没有把用户正在做什么作为一等输入：

- 用户是在 Jira issue 页面阅读一个已经可见的字段。
- 用户是在 Jira comment 输入框准备回复。
- 用户是在 RingCentral 群聊里讨论 MTR-148115 的 estimate。
- 用户只是点开 issue 看字段，还是 focus 了 comment box / reply box / message composer。
- 用户当前看到的事实是页面原生字段，还是历史记忆补充出来的口径、背景、风险。

所以同一条记忆会被判定为“相关”，但没有足够上下文判断它此刻应该：

- 在 Jira issue 阅读页静默，因为页面已经显示同一个字段值。
- 在 RingCentral 群聊里显示 Lens cue，因为聊天现场没有 Jira 字段表格。
- 在 Jira comment 输入框旁转成 Compose Assist draft hint，因为用户正在准备写评论。

这不是单点 selector 或关键词能长期解决的问题。应该重构为一个清晰的 **Interaction Scene Contract**：前端采集用户当前操作场景，后端按 typed scene 决定提示策略。

## 当前实现审计

### 已经有的基础

| 层 | 现状 | 说明 |
| --- | --- | --- |
| 前端 passive snapshot | `src/composer-guard/siteContextAdapters.ts` 的 `buildPassiveContextSnapshot()` | 会抽 URL、title、Jira issue key、visible comments、attachments、people、visible fields 等页面上下文。 |
| 前端 Lens payload | `src/contentScriptWebIntelligence.ts` | 会向 `/context-recall` 发送 `surface`、`contextType`、`sourceContext`、`currentContext`、`entityHints`、`sourceTypes`。 |
| 前端 composer 检测 | `src/composer-guard/siteContextAdapters.ts` 的 `findActiveComposerContext()` | 会识别 RingCentral / Web AI / Jira comment 等输入框，但它主要服务 Compose Assist，不是 Lens 的统一场景契约。 |
| 后端 scene frame | `memory-service/src/core/SceneFrameService.ts` | 会推断 `sceneType`、`surface`、`anchors`、`fieldHints`、`userIntent`、`riskLevel`。 |
| 后端 autopilot | `memory-service/src/core/ContextRecallService.ts` | 会做 scene anchors、rerank、quiet reasons、`silent/chip/card/context_pack` 决策。 |
| Cue Compiler | `memory-service/src/core/CueCompilerService.ts` | 已经能把少数结构化场景压成 `ContextCue`，例如 Jira estimate cue。 |
| Outcome Loop | `memory-service/src/core/MemoryOutcomeLoopService.ts` | 已经能学习 cue 展开、插入、发送、不相关等结果。 |
| eval | `evals/workflows/scene-memory-autopilot/experience.md`、`evals/workflows/estimate-cue-compiler/experience.md` | 已经有体验评估入口，但需要覆盖更具体的 interaction scene。 |

### 当前缺口

1. **场景粒度太粗**

   当前 `SceneFrameService` 更像从文本里推断“这是 Jira estimate 场景”，但没有明确知道“用户正在阅读 Jira 字段表格”还是“用户正在评论框里写 estimate 说明”。

2. **Lens 和 Compose 的场景采集没有统一契约**

   Compose Assist 有输入框检测，Lens 有页面级被动 recall。两边共享一些 helper，但后端看到的是 `surface/contextType/currentContext`，不是一个完整的 `interactionScene`。

3. **页面可见事实和记忆事实没有分层**

   `DEV Estimate New = 0.4` 在 Jira issue 页面上是页面原生事实；在 RingCentral 群聊里是用户此刻看不见的工作上下文。当前需要后端明确区分：

   - `visibleFacts`: 页面当前可见，不应被 Lens 复述。
   - `memoryFacts`: 来自历史记忆，可以补足页面没有展示的口径、背景、风险。

4. **Autopilot 策略矩阵不够显式**

   现在策略主要由匹配分数、scene anchors、suppression reason 组成。下一步应该把“同一条 cue 在不同 scene 的行为”写成可测试矩阵。

5. **诊断信息还不能回答用户问题**

   用户看到一个错误 Lens 后，理想诊断应能说明：

   - 当前识别到的 `sceneType` 是什么。
   - active element 是不是 composer。
   - 哪些字段被认为是页面可见事实。
   - 为什么这条 cue 被允许展示，或为什么被静默。

## 目标

把 Memory Lens / Compose Assist 的场景输入重构成一个一等契约：

```text
Page Snapshot
  + Active Element Snapshot
  + Visible Facts
  + Draft / Selection / Nearby Text
  + User Mode
  -> InteractionScene
  -> SceneFrame v2
  -> Autopilot Policy Matrix
  -> Lens card / Compose cue / silent
```

最终用户体验目标：

- 用户在 Jira issue 页面阅读 MTR-148115 时，Lens 不复述页面已经显示的 estimate 字段。
- 用户在 RingCentral 群聊里讨论 MTR-148115 估算时，Lens 能提醒当前估算、口径、是否未锁定。
- 用户在 Jira comment 输入框里准备评论 MTR-148115 时，Compose Assist icon 出现在输入框旁，并能给出 draft hint。
- 同一条记忆不是“全局相关就弹”，而是根据当前操作场景决定是否该出现、以什么形态出现。

## 2026-06-09 补充：两段式触发和职责分层

Memory Lens 不应该因为“用户打开了任意网页”就请求 `/context-recall`。更合理的流程是：

```text
前端本地观察
  -> admission gate：页面/交互是否值得发起 Lens 查询
  -> 发送 InteractionScene 事实快照
  -> Memory Service 做 scene/frame/policy/recall/cue 判断
  -> 前端只按结果展示、静默或交给 Compose Assist
```

### 前端应该判断什么

前端只做低成本、确定性、可审计的门控和事实采集：

- 页面是否被站点控制 mute/block/allowlist 拦住。
- URL 或表单是否包含 password、token、payment、login、OAuth、OTP 等敏感信号。
- 页面是否稳定，避免路由切换或 DOM 刚刷新时发请求。
- 是否只是低信息壳页面，例如空会议、通用搜索页、纯导航页。
- 是否有足够 anchor，例如 Jira issue key、具体群聊消息、选中文本、输入框、项目/人/任务/estimate 等具体信号。
- active element 是不是 comment/reply/prompt composer。
- 页面当前可见哪些事实，例如 Jira 字段 `DEV Estimate New = 0.4`。

前端不调用 LLM，也不生成“用户真实意图”的自然语言总结。它只把事实打包成 `InteractionScene`。如果不确定，就传 `unknown` 或不发查询。

### Memory Service 应该判断什么

Memory Service 做需要全局记忆、反馈历史和证据链的判断：

- 将 `InteractionScene` 归一为 `SceneFrame`。
- 判断当前 scene 是否值得召回，或应该 `silent/chip/card/context_pack`。
- 判断召回到的记忆是否只是当前页面 visible fact echo。
- 决定同一条 cue 在 Jira 阅读页、RingCentral 群聊、Jira comment 输入框里的不同形态。
- 调用 Cue Compiler 生成 `remember` / `draft_hint` / `context_pack`。
- 读取 Outcome Loop，避免把某个 scene 下的负反馈误用到另一个 scene。

### 第一版触发阈值

P0/P1 的前端 admission gate 先不追求复杂，而是用可测试的规则：

- `blocked`: 敏感页、站点屏蔽、低价值 host、没有 URL、页面未稳定。
- `passive_ready`: Jira issue、有具体 RingCentral visible messages、有具体 web page title/body、有足够 selected text。
- `composer_ready`: active element 是 comment/reply/prompt composer。
- `unknown`: 不确定时不强弹，最多等下一个交互事件或保持静默。

这些阈值的目标不是替代后端，而是减少无意义请求和错误打扰。最终准确性仍由 Memory Service 的 scene policy 和 eval 保证。

## 非目标

- 不新增用户日常操作。
- 不新增一个 review queue。
- 不自动发送 Jira comment 或 RingCentral message。
- 不把所有页面内容写入长期记忆。
- 不把 Lens 改成 Compose Assist；Lens 仍只读提示，Compose Assist 才负责写作/插入。
- 不在 P0 改写底层 vector / FTS 检索算法。

## 新契约草案

### InteractionScene

```ts
type UserMode =
  | 'read'
  | 'inspect_field'
  | 'focus_composer'
  | 'compose'
  | 'reply'
  | 'comment'
  | 'select_text'
  | 'submit_candidate'
  | 'unknown';

type InteractionSceneType =
  | 'jira_issue_reading'
  | 'jira_field_inspection'
  | 'jira_comment_composing'
  | 'ringcentral_thread_reading'
  | 'ringcentral_estimate_discussion'
  | 'ringcentral_reply_composing'
  | 'web_reading'
  | 'web_ai_prompt_composing'
  | 'selection_memory_search'
  | 'meeting_live'
  | 'unknown';

interface ActiveElementSnapshot {
  kind: 'none' | 'button' | 'input' | 'textarea' | 'contenteditable' | 'editor' | 'link' | 'other';
  role?: string;
  mode?: UserMode;
  label?: string;
  placeholder?: string;
  nearbyText?: string;
  containerRole?: string;
  containerLabel?: string;
  selectorFingerprint?: string;
  hasFocus: boolean;
}

interface VisibleFact {
  kind: 'jira_field' | 'message' | 'page_heading' | 'status_badge' | 'table_cell' | 'other';
  name?: string;
  value: string;
  rawText?: string;
  source: 'current_page';
  issueKey?: string;
  confidence: number;
}

interface InteractionScene {
  sceneType: InteractionSceneType;
  surface: 'memory_lens' | 'compose_assist' | 'meeting_pilot' | 'today_pilot' | 'ask';
  userMode: UserMode;
  url?: string;
  title?: string;
  issueKey?: string;
  conversationId?: string;
  groupId?: string;
  participants?: string[];
  activeElement?: ActiveElementSnapshot;
  visibleFacts?: VisibleFact[];
  draftText?: string;
  selectedText?: string;
  nearbyMessages?: Array<{ sender?: string; text: string; timestamp?: number }>;
  sourceAnchorHints?: string[];
}
```

### SceneFrame v2

后端保留现有 `SceneFrame`，但来源变成：

```text
ContextRecallRequest
  -> normalize legacy fields
  -> InteractionScene
  -> SceneFrame v2
```

`SceneFrame v2` 应额外包含：

- `sceneType`: 真实操作场景，而不是只从文本推断的业务场景。
- `userMode`: read / inspect_field / compose / reply / comment。
- `visibleFacts`: 页面当前已显示的事实。
- `intentHints`: 从 draft、按钮、placeholder、nearby text 推断用户意图。
- `provenance`: 每个关键判断来自 URL、DOM、active element、draft 还是历史记忆。

## 场景策略矩阵

| Scene | 当前信号 | 同一条 estimate 记忆的行为 |
| --- | --- | --- |
| `jira_issue_reading` | URL/title/issueKey 命中，active element 不是 composer，页面 visibleFacts 有 `DEV Estimate New = 0.4` | 如果 cue 只是复述该字段值，`silent`，quiet reason = `visible_fact_echo`。 |
| `jira_issue_reading` | 页面有 estimate 字段，但记忆包含页面未显示的口径、历史变更、风险或未锁定说明 | 可以 `chip/card`，但文案必须强调补充信息，不复述字段值。 |
| `jira_field_inspection` | 用户点击/选中 estimate 字段附近 | 只显示“背景/口径/风险”，不提示当前字段值本身。 |
| `jira_comment_composing` | active element 是 Jira comment composer，issueKey = MTR-148115 | 转给 Compose Assist，cue action = `draft_hint`；Lens 右下角入口隐藏。 |
| `ringcentral_estimate_discussion` | visible messages/draft 提到 MTR-148115 + estimate/人天/0.4 | Lens 可以 `card` 或 Compose 可以 `draft_hint`，因为用户不在 Jira 字段表格里。 |
| `ringcentral_thread_reading` | 只是在 thread 里看到票号，没有估算讨论 | 低打扰 `chip` 或静默，避免无关弹出。 |
| `selection_memory_search` | 用户主动选中文本 | 使用 selection 作为主 query，页面背景只做辅助，不套用 passive Lens 的低打扰阈值。 |
| `web_ai_prompt_composing` | Web AI 输入框有短 prompt | 更适合 `context_pack`，不是右下角 Lens 卡片。 |

## 实施计划

### P0：契约和诊断，不继续堆启发式

1. 在 `memory-service/src/types/index.ts` 新增 `InteractionScene` 类型，并在 `ContextRecallRequest` 增加可选 `interactionScene`。
2. 在 `src/services/MemoryServiceClient.ts`、`src/composer-guard/types.ts` 同步镜像类型。
3. 在 `SceneFrameService` 中新增 `fromInteractionScene()`，legacy request 仍走兼容路径。
4. 在 `/context-recall` debug response 中返回：
   - `debug.sceneFrame`
   - `debug.interactionScene`
   - `autopilot.gates`
   - `quietReasons`
   - `visibleFactEcho` 命中证据
5. 保留当前 `current_page_field_echo` 作为临时防线，但把它迁移为策略矩阵里的 `visible_fact_echo` gate。

验收：

- 不改变 UI。
- 不新增用户操作。
- Debug 可以清楚解释 MTR-148115 为什么在 Jira issue 页面静默、在群聊里展示。

### P1：前端统一采集 InteractionScene

1. 在 `src/composer-guard/siteContextAdapters.ts` 增加统一 builder：
   - `buildInteractionSceneSnapshot()`
   - `getActiveElementSnapshot()`
   - `getVisibleFacts()`
   - `inferUserMode()`
2. Jira adapter 输出：
   - `jira_issue_reading`
   - `jira_field_inspection`
   - `jira_comment_composing`
   - `visibleFacts: jira_field[]`
3. RingCentral adapter 输出：
   - `ringcentral_thread_reading`
   - `ringcentral_estimate_discussion`
   - `ringcentral_reply_composing`
4. Web AI adapter 输出：
   - `web_ai_prompt_composing`
5. `src/contentScriptWebIntelligence.ts` 的 Lens payload 不再只发送 page-level `currentContext`，而是发送 `interactionScene`。
6. `ComposerGuardController` 也发送相同契约，让 Compose Assist 和 Lens 的场景判断一致。

验收：

- Jira issue 页没有 active composer 时，`userMode=read`。
- 点击 Add comment / focus comment box 后，`userMode=comment`，`sceneType=jira_comment_composing`。
- RingCentral 群聊讨论 MTR-148115 estimate 时，`sceneType=ringcentral_estimate_discussion`。

### P2：后端策略矩阵和 Cue Compiler 对齐

1. 在 `ContextRecallService` 中把 scene policy 从散落的 suppression heuristic 收敛成函数：
   - `applyInteractionScenePolicy(matches, sceneFrame, request)`
2. Cue Compiler 根据 `SceneFrame v2` 选择 action：
   - Lens read scene: `remember`
   - Compose scene: `draft_hint`
   - Web AI prompt scene: `context_pack`
   - Field echo scene: `suppressed`
3. `visibleFacts` gate 不只比较 value，还要比较 field name + issueKey + semantic field type：
   - `DEV Estimate New`
   - `Original Estimate`
   - `Story Points`
   - 中文 `估算 / 人天 / 工时`
4. 对“页面已显示字段值，但记忆有未显示背景”做差异化：
   - 只复述 value -> silent
   - 补充 unit / policy / changed_by / pending decision -> card
5. Outcome Loop 的 scene key 使用 `InteractionScene`：
   - `jira:MTR-148115:read`
   - `jira:MTR-148115:comment`
   - `ringcentral:<groupId>:estimate_discussion`

验收：

- 同一 cue 在 Jira read scene 和 RingCentral discussion scene 的 outcome policy 不会互相污染。
- Jira issue 页面负反馈不会把群聊里的有用提醒一并压掉。

### P3：eval 覆盖用户真实场景

新增或扩展 `scene-memory-autopilot` cases：

1. `jira-issue-visible-estimate-silent`
   - 当前页面：MTR-148115 Jira issue，visibleFacts 有 `DEV Estimate New = 0.4`。
   - 记忆：同一字段值。
   - 期望：`autopilot.mode=silent` 或无 visible match；quiet reason 包含 `visible_fact_echo`。

2. `jira-issue-hidden-estimate-policy-card`
   - 当前页面：MTR-148115 Jira issue，visibleFacts 有 `DEV Estimate New = 0.4`。
   - 记忆：estimate 口径是人天，当前值未锁定，来自某次团队讨论。
   - 期望：可以展示，但 cue 不复述字段值，重点是口径/未锁定/来源。

3. `jira-comment-composer-draft-hint`
   - 当前页面：MTR-148115 Jira issue，active element 是 comment composer。
   - 期望：Compose Assist 有 `draft_hint` cue；Memory Lens 右下角不抢入口。

4. `ringcentral-estimate-discussion-card`
   - 当前页面：RingCentral group/thread，visible messages 提到 MTR-148115 和 estimate。
   - 期望：Lens 展示当前 estimate/口径 cue，并有 whyNow。

5. `ringcentral-ticket-mention-no-estimate-silent`
   - 当前页面只提到 MTR-148115，没有估算讨论。
   - 期望：静默或低打扰 chip，不弹强提示。

继续保留 `estimate-cue-compiler` 作为窄切片 eval：

- 验证 cue 是否稳定生成。
- 验证 Outcome Loop 是否学习 expanded / inserted / sent / not_relevant。
- 验证同一 cue 在不同 scene key 下不会误共享 suppress policy。

验证命令：

```bash
npm --prefix memory-service run build
npm --prefix memory-service test -- --run src/__tests__/api-context-recall.test.ts src/__tests__/api-composer-assist.test.ts
npm run eval:run -- --suite scene-memory-autopilot --no-repair
npm run eval:run -- --suite estimate-cue-compiler --no-repair
npm run eval:validate
```

涉及 extension 前端后，再跑：

```bash
npm start
```

等第一次 webpack successful compile 后停止。

### P4：清理临时补丁

当 P0-P3 都通过后：

- 把 `current_page_field_echo` 改名或迁移为正式 `visible_fact_echo` policy。
- 删除只服务单个字段的 ad hoc 文本比较。
- 更新 `docs/features/memory_lens.md`、`docs/features/memory_system.md`、`docs/features/compose_assist.md`。
- 在 eval report 中保留 MTR-148115 类似案例的解释路径。

## 风险和边界

### 风险：active element 不稳定

Jira 和 RingCentral DOM 变化频繁，不能只依赖单个 selector。需要组合：

- DOM role / aria-label / placeholder。
- 最近 focus 事件。
- bounding rect 和输入框附近文本。
- 用户点击的按钮文案，例如 Add comment / Reply / Send。
- fallback 到 `unknown` 时保持静默或低打扰，而不是强弹。

### 风险：页面可见事实误判

如果 visibleFacts 抽错，可能把应该提示的记忆静默。需要：

- 只对高置信 field/value 做 echo suppression。
- value 和 field type 都匹配时才静默。
- 如果记忆包含页面没有的补充事实，不能整体静默。

### 风险：Lens / Compose 互斥不清

Jira comment 和 RingCentral reply 场景应优先 Compose Assist。Memory Lens 不能在输入框旁抢右下角入口。需要统一规则：

```text
scene.userMode in ['focus_composer', 'compose', 'reply', 'comment']
  -> Compose Assist owns draft/cue
  -> Memory Lens passive icon hides
```

### 风险：Outcome Loop 跨场景误学习

同一条 estimate cue 在 Jira issue 阅读页无用，在群聊里可能很有用。Outcome policy key 必须包含 scene type/user mode，不允许只按 cueKey 或 memory id 全局 suppress。

## 文件改动范围

预计会动这些文件：

- `memory-service/src/types/index.ts`
- `memory-service/src/routes/contextRecall.ts`
- `memory-service/src/core/SceneFrameService.ts`
- `memory-service/src/core/ContextRecallService.ts`
- `memory-service/src/core/CueCompilerService.ts`
- `memory-service/src/core/MemoryOutcomeLoopService.ts`
- `src/services/MemoryServiceClient.ts`
- `src/composer-guard/types.ts`
- `src/composer-guard/siteContextAdapters.ts`
- `src/composer-guard/ComposerGuardController.ts`
- `src/contentScriptWebIntelligence.ts`
- `src/web-intelligence/contextRecallGuards.ts`
- `memory-service/src/__tests__/api-context-recall.test.ts`
- `memory-service/src/__tests__/api-composer-assist.test.ts`
- `src/composer-guard/__tests__/siteContextAdapters.test.ts`
- `evals/cases/scene-memory-autopilot/cases.jsonl`
- `evals/workflows/scene-memory-autopilot/experience.md`
- `evals/cases/estimate-cue-compiler/cases.jsonl`
- `evals/workflows/estimate-cue-compiler/experience.md`
- `docs/features/memory_lens.md`
- `docs/features/memory_system.md`
- `docs/features/compose_assist.md`

## 用户真实体验案例

### 场景 1：阅读 Jira issue

用户打开 MTR-148115 的 Jira issue 页面，只是在看字段。

页面已经显示：

```text
DEV Estimate New: 0.4
```

Personal AI 的行为：

- 识别 `sceneType=jira_issue_reading`。
- 识别 `visibleFacts=[DEV Estimate New: 0.4]`。
- 如果召回到的记忆只是“DEV Estimate New 是 0.4”，Lens 静默。
- 如果召回到的是“这个 estimate 还没最终锁定，团队上次说按人天口径沟通”，Lens 可以低打扰显示补充背景，并带来源。

用户感受：

> Personal AI 没有把页面上我已经能看到的字段念一遍；它只在有额外背景时提醒我。

### 场景 2：在 RingCentral 群聊讨论 estimate

用户在 RingCentral 群聊里看到同事问：

```text
MTR-148115 这个 DEV estimate 现在按多少沟通？
```

Personal AI 的行为：

- 识别 `sceneType=ringcentral_estimate_discussion`。
- 召回 MTR-148115 的 Jira estimate 记忆、团队讨论口径、是否未锁定。
- Lens 显示一句只读 cue，例如：

```text
MTR-148115 当前 DEV Estimate New 是 0.4；上次讨论的口径是人天，且尚未最终锁定。
```

用户感受：

> 我不用切回 Jira 或翻历史消息，就能在聊天现场想起该怎么说。

### 场景 3：准备写 Jira comment

用户在 MTR-148115 页面点击 Add comment，focus 到 comment 输入框。

Personal AI 的行为：

- 识别 `sceneType=jira_comment_composing`。
- Memory Lens 右下角入口隐藏，避免抢输入框。
- Compose Assist icon 出现在 comment 输入框旁。
- 点击 icon 后给 draft hint，而不是只读 Lens card。

用户感受：

> 我在写评论时得到的是可插入/可改写的草稿帮助，不是右下角一张跟输入无关的记忆卡。

## Demo HTML

这个 plan 是场景契约和后端策略重构，不新增独立页面。交互变化发生在现有 Jira / RingCentral / Compose Assist / Memory Lens 嵌入式入口里。

为了看清完整 Lens 查询如何带上 `InteractionScene`，已补一个静态可视化：

- [`memory-lens-interaction-scene-query-demo.html`](./memory-lens-interaction-scene-query-demo.html)

它模拟同一条 MTR-148115 estimate 记忆在三个 scene 下的差异：

- Jira issue 阅读字段：页面已经显示 `DEV Estimate New = 0.4`，Lens 静默字段 echo。
- RingCentral 群聊讨论估算：Lens 显示只读 cue。
- Jira comment 输入框：Lens 隐藏，Compose Assist 接管并生成 `draft_hint`。
