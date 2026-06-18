# Estimate Cue Compiler Experience Eval

## 目标

验证 `SceneFrameService + MemoryCueFactService + CueCompilerService + MemoryOutcomeLoopService` 的窄切片是否能在 Jira estimate 场景稳定生成一句可行动 cue，并让 Outcome Loop 学习它下次该静默还是增强，而不是只返回普通相关记忆。

本 suite 重点检查：

- Memory Lens 能把 `MTR-148115 Original Estimate 口径是人天` 编译成 `remember` cue。
- Eval case 会显式模拟 `interactionScene`：Jira issue 阅读字段、RingCentral 群聊估算讨论、Jira comment composer。
- Compose Assist 能把同一事实编译成 `draft_hint`，并直接作为插入文本候选。
- cue id / actionType / compileStatus 会进入已有 outcome 事件：展开、插入、发送、标记不相关。
- Memory Lens 重复 `not_relevant` 后，下次同一句 cue 被 `suppress` policy 静默。
- Compose Assist 重复 `sent_after_insert` 后，下次同一句 cue 被 `boost` policy 增强，并生成 Skill Foundry suggestion。
- Jira issue 页面已经显示 `DEV Estimate New=0.4` 这类字段值时，Memory Lens 不复述这个页面字段；同一记忆应留给群聊/thread/comment 等讨论场景。
- `debug.sceneFrame.interactionSceneType` 和 `debug.sceneFrame.userMode` 必须符合输入的交互数据，证明 Memory Service 收到了前端场景事实，而不是只靠 query 文本猜测。
- 弱场景只命中 Jira/status 但没有 estimate 字段锚点时，不生成 cue。

## 体验判断

一个通过的 case 应该满足：

- 当前页面/输入框明确出现 Jira issue + estimate/original estimate 字段。
- 请求里带有结构化 `interactionScene`，并能在 debug 里还原为正确的 scene/userMode。
- 相关记忆里有结构化强事实：estimate 单位是人天，必要时带 sourceRefs。
- cue 文案短、可行动、能说明为什么现在出现。
- 同一个 fixture 重复运行时 cue id 和 cue text 稳定。
- outcome trace 不保存原始发送内容，但保留 cueIds，方便 Outcome Loop 学习是否采纳、发送或被判不相关。
- policy patch 必须可追溯到 cueKey，不能只按普通记忆 id 粗暴全局降权。

## 不用 LLM Judge 的原因

这是窄域确定性能力，判断条件可以用字段、cueKey、policy 和文案包含关系覆盖。LLM judge 反而会引入不稳定性；等 Cue Compiler 覆盖更多场景、需要判断文案质量时再加入 LLM rubric。

## 样本来源

当前样本来自真实产品场景形状的 synthetic fixture：Jira issue `MTR-148115`、Original Estimate、人天/3h、close/due date 附加口径。fixture 不包含私密原文，但保留真实用户会遇到的中英文混合字段名。

## 回归风险

- 如果 SceneFrame 只看 query 文本，不看 structured context，会出现 cue 漏发。
- 如果 InteractionScene 没进 request/debug，Jira 阅读页、RingCentral 讨论、Jira comment 会被混成同一个场景，Outcome Loop 的 suppress/boost 容易跨场景污染。
- 如果 MemoryCueFact 只做关键词相关，不要求字段事实，会出现弱场景误发。
- 如果 Compose Assist 继续走 LLM fallback，可能把“人天口径”稀释成泛化回复。
- 如果 outcome trace 丢 cueId，Outcome Loop 只能学到“这条建议被采纳”，无法学到“哪条编译 cue 有效”。
- 如果 policy 只按 sceneKey 匹配，前端和后端 sceneKey 轻微差异会导致 suppress / boost 不生效，因此 eval 要检查 cueKey 级策略。
- 如果 Lens 不知道当前 Jira 页面已显示哪些字段，就会把“DEV Estimate New=0.4”这类页面上已有信息误当成外部记忆提醒。

## Report requirements

每次报告必须展示：

- 首屏必须用普通产品语言说明“这份 report 证明了什么”和“没有证明什么”，不能只显示分数和 debug 字段。
- 结论必须区分正例和负例：负例通过时应写“没有误生成 cue”，不能复用“cue 稳定生成”的通用结论。
- case 卡片只展示读者判断需要的字段：输入场景、实际 cue/无 cue、通过依据、Outcome 学习信号、下一步；完整 debug 放在 `case-results.json`。
- 本次跑了哪些 Jira estimate / Compose Assist 样本。
- 期望 cue 的 actionType、必须包含的关键词、是否预期无 cue。
- 实际 topMatch / evidence 中的 cue id、compileStatus、cueText、sourceRefCount。
- 实际 `interactionSceneType` / `userMode`，以及 outcome sceneKey 是否带场景后缀。
- outcomeSamples 是否带 cueId，覆盖展开、插入、发送、标记不相关。
- policy 结果是否覆盖 suppress、boost 和 Skill Foundry suggestion。
- 失败时给出最小修复方向：SceneFrame、MemoryCueFact、CueCompiler、MemoryOutcomeLoop、Compose outcome trace 或 eval fixture。
