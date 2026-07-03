# 新能力：Ask Conversation Continuity / Ask 会话续接

> 这份计划替代原来的 `Memory Continuity Guardian / 记忆连续性守护` 方向。原方向把重点放在 Coverage Map、备份抽屉、健康检查和修复流程上，用户需要主动 review 系统状态；这不符合 Ask 这种高频入口的真实使用习惯。本计划收敛为一个更自然、更低操作成本的能力：用户打开 Ask / Quick Ask 时，如果刚刚中断过一轮对话，顶部自然提示是否继续，不新增独立页面，不要求用户去 Coverage Map 审查。

## 结论

用户的理解是对的：P0 不应该依赖 memory service 存一份“上次 Ask 会话”。这类能力本质是短期、设备内、UI 会话连续性，应该先由 desktop app 本地存储保存一个轻量 `AskResumeSnapshot`。

Memory service 仍然负责回答时的长期记忆检索、answer memory、证据链和可追问语义；但“刚才那个 Ask 窗口关了、我再打开时能不能接着说”不需要写入长期记忆，也不应该污染用户的 Personal AI 记忆库。

P0 推荐只做：

- Quick Ask / Ask 打开时的顶部续聊条。
- 本地保存最近一次 Ask 的极简上下文快照。
- 用户点击“继续”后，把上次问题、答案摘要、topic / evidence refs 作为本轮 Ask 的显式上下文提示传给现有 `/ask` 流程。
- 用户点击“新问题”或快照过期后，不带入上次上下文。

## 真实场景

### 场景 1：被打断后重新打开 Quick Ask

1. 用户在 menubar Quick Ask 里问：“MTR-148115 昨天到底卡在哪里？”
2. Ask 检索了 Jira、聊天记录和之前的操作记忆，回答中提到一个审批状态和两个证据。
3. 用户临时切走去看浏览器，Quick Ask 窗口关闭。
4. 5 分钟后用户再次打开 Quick Ask。输入框上方出现一条很薄的续聊条：
   - “继续上次 Ask：MTR-148115 阻塞排查 · 5 分钟前 · 本地保存”
   - 操作：`继续`、`新问题`、`丢弃`
5. 用户点 `继续`，聊天区出现上一轮的轻量摘要，输入框 placeholder 变成“继续追问 MTR-148115...”
6. 用户直接问：“所以我现在应该先找谁确认？”系统把上次 topic 和证据 refs 带入 `/ask`，不要求用户重新描述上下文。

用户感受：像一个没断掉的私人助理，而不是每次都要从零开始解释。

### 场景 2：Ask 候选 topic 没选完

1. 用户问：“继续上次那个 RingCentral followup。”
2. Ask 返回候选：`MTR-148115`、`Winback followup`、`Milo planning`。
3. 用户还没点候选就关闭了窗口。
4. 重新打开 Quick Ask 时，顶部提示：“上次 Ask 还在等你选择 topic”，并显示 2 个最可能候选。
5. 用户点击 `Winback followup`，Ask 直接恢复到候选选择后的上下文，不需要重新发起一轮含糊查询。

用户感受：系统记住的是“我正在做什么”，不是要求我管理一份记忆后台。

## 为什么要做

Personal AI 的目标是保留并连接用户和 AI 的所有记忆，但用户真正感受到“记忆有用”的瞬间，往往不是去检查记忆库，而是在被打断后系统能自然接住上一句。

这个能力满足三个核心需求：

- 减少重复解释：用户不用重新描述刚刚问过什么、系统刚刚查到了哪些证据。
- 降低高频入口摩擦：Ask / Quick Ask 是随手问的入口，续聊提示必须在入口内完成。
- 保持信任边界：短期 UI 续聊不等于长期记忆写入，用户不会因为一个临时问题污染 Personal AI 记忆。

## 产品定位

### 不是

- 不是新的 Coverage Map 页面。
- 不是备份抽屉。
- 不是记忆健康 review queue。
- 不是自动把每轮 Ask 都沉淀到 memory service。
- 不是静默猜用户下一步意图的“工作记忆回栈”。

### 是

一个嵌在 Ask / Quick Ask 顶部的本地续聊层：

- 只在有明确 recent Ask snapshot 时出现。
- 默认不打扰，尺寸小，用户可以忽略后直接输入新问题。
- 点击 `继续` 才把上一轮上下文带入当前提问。
- 点击 `新问题` 后本轮不再使用上一轮上下文。
- 点击 `丢弃` 清理本地快照。

## 和现有搁置能力的去重

已核对 `docs/progressing` 中容易重复的方向：

- `working-memory-return-stack-plan.md`：更像跨场景任务栈和意图恢复，风险是自动猜测用户要回到哪个任务。本计划只恢复 Ask 自己产生的最近一次会话，且需要用户点击继续。
- `memory-freshness-radar-plan.md`、`memory-trust-console-plan.md`、`memory-weave-provenance-visibility-plan.md`：偏记忆质量、来源、信任可视化。本计划不做质量评分，只做本地 UI 续聊。
- `ai-session-context-drift-radar-plan.md`：关注长会话内上下文漂移。本计划关注窗口关闭/重新打开后的短期恢复。
- `ai-conversation-memory-loom-plan.md`：关注跨 AI 对话编织和沉淀。本计划 P0 不沉淀，不跨 AI。

## 竞品与行业参考

### ChatGPT Memory / Reference Chat History

OpenAI 的 Memory 方向强调让 ChatGPT 参考过往聊天和保存的记忆，提升个性化；最新的 “Dreaming” 也进一步自动整理历史对话形成长期个人上下文。

参考：

- [OpenAI Help: Memory FAQ](https://help.openai.com/articles/8590148-memory-faq)
- [OpenAI: Dreaming, better memory for a more helpful ChatGPT](https://openai.com/index/chatgpt-memory-dreaming/)

对 Personal AI 的启发：

- 长期记忆很有价值，但越自动越需要控制和透明。
- 本计划先做短期、显式、可丢弃的续聊，不把它伪装成长期记忆。

### Claude Projects

Claude Projects 把聊天历史和知识库放进自包含工作区，适合持续项目上下文。

参考：

- [Anthropic: Collaborate with Claude on Projects](https://www.anthropic.com/news/projects)
- [Claude Help: What are projects?](https://support.claude.com/en/articles/9517075-what-are-projects)

对 Personal AI 的启发：

- 用户需要“回到一个工作上下文”，但不一定需要进入一个项目页。
- Ask 续聊可以是项目化上下文之前的轻量入口。

### Apple Intelligence / Siri personal context

Apple Intelligence 强调 personal context、on-screen awareness 和跨 app actions。

参考：

- [Apple: Apple Intelligence and Siri](https://www.apple.com/apple-intelligence/)
- [Apple Developer: Apple Intelligence](https://developer.apple.com/apple-intelligence/)

对 Personal AI 的启发：

- 好的私人 AI 不要求用户管理上下文，而是在当前入口里自然感知用户刚刚在做什么。
- 续聊条应该和当前屏幕/当前 Ask 状态贴合，而不是进入后台管理页。

### 研究参考

- [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560)：强调分层记忆和虚拟上下文管理。启发：短期 UI 快照和长期 memory service 是不同层级。
- [Generative Agents](https://arxiv.org/abs/2304.03442)：通过观察、记忆、反思和检索形成连续行为。启发：连续性需要可检索的经历，但不等于所有经历都要长期保存。
- [Memory OS of AI Agent](https://arxiv.org/html/2506.06326v1)：强调 long-term conversational coherence 和 user persona persistence。启发：长期一致性是后续方向，P0 先把会话恢复边界做准。

## UX 设计

### Quick Ask 顶部续聊条

位置：Quick Ask 打开后的输入框上方、消息流顶部下方。

默认状态：

```text
继续上次 Ask：MTR-148115 阻塞排查 · 5 分钟前 · 本地保存
[继续] [新问题] [丢弃]
```

如果上一轮是候选 topic：

```text
上次 Ask 还在等你选择 topic · 本地保存
[MTR-148115] [Winback followup] [新问题]
```

如果上次回答已过期或上下文可能变化：

```text
上次 Ask 已超过 24 小时，建议作为线索重新检索
[带上上次线索] [新问题] [丢弃]
```

### 用户操作

- `继续`：把本地快照转成当前 Ask 的上下文提示，并在消息区显示一条本地恢复 receipt。
- `新问题`：隐藏续聊条，本轮 Ask 不带入快照；快照可保留到 TTL 到期。
- `丢弃`：删除本地快照，并显示短 receipt：“已丢弃本机 Ask 续聊记录，未删除长期记忆。”
- 直接输入新问题：默认视为新问题；如果用户输入内容很像追问（如“那我该找谁？”），可以轻提示“是否带上上次 Ask？”，但 P0 不做自动意图判断。

### 文案边界

必须明确：

- “本地保存”：这是当前设备的 UI 恢复状态。
- “未写入长期记忆”：避免用户误以为系统已经沉淀。
- “继续后会重新检索”：避免 stale answer 被当作最新事实。
- “丢弃不删除长期记忆”：避免用户误解本地清理影响 Personal AI 记忆库。

## 本地存储设计

### 为什么 P0 不用 memory service

原因：

- 续聊快照是 UI 状态，不是用户长期偏好、事实、证据或知识。
- 快照生命周期短，适合设备本地 TTL。
- memory service 写入会产生误导：用户可能以为临时 Ask 已经成为 Personal AI 记忆。
- 本地存储更快，打开 Quick Ask 时可以同步渲染顶部提示，不等待网络或 memory service。
- 离线/服务失败时仍可显示“上次本地 Ask 线索”。

### 什么时候才需要 memory service

后续只有这些情况才考虑服务端：

- 用户明确点击“保存到记忆”。
- 需要跨设备续聊。
- 需要把 Ask 结果生成 answer memory 供后续检索。
- 需要把确认过的事实沉淀为用户偏好、项目记忆或操作记忆。

### `AskResumeSnapshot`

建议结构：

```ts
type AskResumeSnapshot = {
  version: 1;
  surface: 'quick_ask' | 'ask_page' | 'search_result_ask';
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  localOnly: true;
  topic?: {
    id?: string;
    title: string;
    confidence?: number;
  };
  lastUserMessage: {
    textPreview: string;
    redacted: boolean;
  };
  lastAnswer?: {
    summary: string;
    status?: 'answered' | 'needs_topic' | 'needs_confirmation' | 'failed';
  };
  evidenceRefs?: Array<{
    id: string;
    title: string;
    sourceType: 'memory' | 'jira' | 'browser' | 'message' | 'document' | 'unknown';
    timestamp?: string;
  }>;
  pendingCandidates?: Array<{
    id: string;
    label: string;
    reason: string;
  }>;
  draftText?: string;
  riskFlags?: Array<'sensitive' | 'stale' | 'failed_retrieval' | 'long_transcript_redacted'>;
};
```

### 存储约束

- 默认 TTL：24 小时。
- 最大保留：最近 1 条 Quick Ask 快照；未来可以扩展为每 surface 1 条。
- 不保存完整长 transcript。
- 不保存密钥、token、cookie、联系人直连信息。
- 如果回答含敏感片段，只保存 redacted preview 和 evidence title。
- 退出登录或切换用户时清理。
- 如果用户点击 `丢弃`，立即删除本地快照。

## 后端请求边界

点击 `继续` 后，前端可以把快照转成一个显式上下文：

```json
{
  "query": "所以我现在应该先找谁确认？",
  "contextHints": {
    "source": "local_ask_resume_snapshot",
    "localOnly": true,
    "topicTitle": "MTR-148115 阻塞排查",
    "previousQuestion": "MTR-148115 昨天到底卡在哪里？",
    "previousAnswerSummary": "上一轮 Ask 判断主要阻塞在审批状态未确认，并引用了 Jira 与聊天证据。",
    "evidenceRefs": ["jira:MTR-148115", "message:2026-06-22-ringcentral-approval"]
  }
}
```

后端处理原则：

- 可把 `contextHints` 当作检索 boost 和 disambiguation hint。
- 不因为它存在就写入 memory service。
- 回答里仍要重新检索关键事实，不能只复述本地摘要。
- 返回 answer receipt 时标明“使用了本机续聊线索 + 本轮重新检索证据”。

## 其他需要类似能力的场景

这个能力可以抽象成 `Local Continuation Strip`，但 P0 只落在 Quick Ask。后续可复用到：

1. **Search Result Ask**
   - 用户在 Memory Exploring 里问了一个结果页内问题，切走后回来，可以继续上次 topic 和候选证据。
   - 存储位置可以先用浏览器本地 storage，不需要 memory service。

2. **Compose Assist**
   - 用户生成了一条回复草稿但没发送，关闭弹窗后再打开，提示“继续上一条草稿 · 未发送 · 本地保存”。
   - 这里尤其要写清楚：继续草稿不等于已经发送。

3. **Meeting Pilot**
   - 用户会议中打开侧边栏问“刚刚谁负责 followup？”，中途关闭后重新打开，提示继续本场会议 Ask。
   - 如果涉及 ASR，必须区分“本地捕获片段”和“已写入会议记忆”。

4. **Message Reaction / Outreach**
   - 用户点了一次消息上的 AI 回复建议，未执行发送；再次打开同一消息时提示继续本地建议。
   - 边界：未发送、未写回、未通知对方。

5. **Jira / Slides / Doc Analyzer**
   - 用户生成了写回 preview 但未提交，重新打开时提示“继续上次预览”。
   - 边界：preview 不是写回结果。

6. **External AI Conversation Import**
   - 用户从 Doubao / ChatGPT 页面抓取对话时中断，再回到工具时提示继续上次导入草稿。
   - 边界：本地抓取候选不等于已沉淀为 Personal AI memory。

## 实现计划

### P0：Quick Ask 本地续聊

目标：只改 Quick Ask 入口，验证用户是否认可这个自然交互。

1. 代码调研
   - 读取 `desktop-app/app/quick-ask.js` 的窗口生命周期、消息渲染、状态卡和本地存储模式。
   - 检查是否已有 Electron store、localStorage、IndexedDB 或 app config helper。
   - 确认 Quick Ask 打开时是否可同步读取本地快照并首屏渲染。

2. 数据层
   - 新增 `AskResumeSnapshot` helper。
   - 支持 `saveSnapshot`、`loadSnapshot`、`clearSnapshot`、`isExpired`、`redactSnapshot`。
   - 默认只保留最近 1 条。

3. 保存时机
   - Ask 流式回答完成后保存摘要、topic、evidence refs 和状态。
   - Ask 返回候选 topic 时保存 pending candidates。
   - 用户输入草稿但未发送时可保存 draft preview，P0 可选。
   - 请求失败时只保存 failure receipt，不保存不完整答案。

4. 打开时机
   - Quick Ask window show/focus 时读取快照。
   - 如果未过期且有可展示 preview，则渲染顶部续聊条。
   - 如果已过期，则只显示“带上上次线索”或直接清理，具体由敏感度决定。

5. 继续行为
   - 点击 `继续` 后把 snapshot 转成当前消息流的一条 local receipt。
   - 后续用户发问时附带 `contextHints.source = local_ask_resume_snapshot`。
   - 回答完成后刷新本地快照。

6. 新问题 / 丢弃
   - `新问题`：隐藏本轮续聊条，不带 snapshot。
   - `丢弃`：删除本地 snapshot，并显示本地删除 receipt。

### P1：Ask Page / Search Result Ask 复用

目标：把同一个 `Local Continuation Strip` 嵌入 Memory Exploring 的 Ask 面板。

- 保存当前结果页 topic、候选证据、上一轮 Ask 摘要。
- 页面回访时提示继续。
- 不新增独立页面。

### P2：草稿类能力复用

目标：Compose Assist、Message Reaction、Jira/Slides writeback preview 复用同一套本地恢复语义。

- 明确每种 surface 的“未发送 / 未写回 / 未同步 / 未保存”边界。
- 只保存短期草稿和 preview metadata。

### P3：跨设备或长期沉淀

只有在 P0/P1 证明用户需要跨设备后，才评估 memory service：

- 用户显式点击“保存这段 Ask 到记忆”。
- 或明确开启“跨设备续聊”。
- 需要新增可见管理入口和删除能力。

## 验证与 evals

### P0 不需要 LLM eval 的部分

本地续聊条本身是 UI 状态能力，优先用 UI/E2E 验证：

- 打开 Quick Ask，无 snapshot 时不显示续聊条。
- Ask 完成后保存 snapshot。
- 关闭并重开 Quick Ask，续聊条首屏出现。
- 点击 `继续` 后 contextHints 被带到下一轮请求。
- 点击 `新问题` 后本轮请求不带 contextHints。
- 点击 `丢弃` 后本地 snapshot 删除。
- snapshot 超过 TTL 不自动继续。
- 敏感文本被 redacted，不在续聊条泄漏。

建议在实现后扩展或新增：

- `desktop-app/scripts/quick-ask-status-card-check.mjs`
- Quick Ask 相关 Playwright / electron harness
- 最小请求 payload 断言脚本

### 需要 evals 的部分

如果 P0 实现中让 `/ask` 使用 `contextHints` 改变检索或回答排序，就需要在 `/Users/Esone/git/personal-ai/evals/` 创建真实场景 eval：

- 场景来自线上 memory service 中 `esone.qiu` 的真实 Ask / 项目 / 消息记忆。
- Case 1：无续聊 hint 时问题含糊，回答需要澄清。
- Case 2：带续聊 hint 后能正确延续上一轮 topic。
- Case 3：带过期 hint 时必须重新检索并提示不确定性。
- Case 4：用户点击新问题后不得错误继承上一轮 topic。

通过标准：

- 延续场景 topic 命中率高于无 hint。
- 新问题场景不得污染 topic。
- 回答 receipt 明确区分“本机续聊线索”和“本轮检索证据”。
- 如果效果不达标，继续改进直到通过所有测试。

## 文档维护要求

功能实现完成后，需要把关键点精简维护进正式 features 文档：

- `desktop-app/docs/features/` 下如果已有 Quick Ask / desktop Ask 文档，应并入该文档。
- `docs/features/doubao_bridge.md` 目前包含 Quick Ask / menubar 的行为边界，可补充“本地续聊条”章节。
- `docs/features/ask.md` 需要补充 Ask API 如何接收 `contextHints`，以及它不等于长期 memory write。
- 如果后续抽象为跨 surface 能力，再新增 `docs/features/local_continuation_strip.md`。

必须记录：

- 本地 snapshot 字段和 TTL。
- 继续 / 新问题 / 丢弃三种用户动作。
- memory service 不写入边界。
- request payload 中 `local_ask_resume_snapshot` 的含义。
- 相关 E2E / eval 命令。

## Demo

Demo 文件：

- `docs/progressing/ask-conversation-continuity-demo.html`

Demo 模拟的是 Quick Ask 窗口内的效果，不是独立产品页面。重点展示：

- 打开 Ask 时顶部出现本地续聊条。
- 点击继续后显示上一轮摘要并准备追问。
- 点击新问题后不继承上下文。
- 点击丢弃后清理本地续聊记录。
- 右侧列出可复用到其他场景的本地连续性条。

## 决策建议

推荐实现 P0。

原因：

- 它比 Coverage Map 健康卡更贴近用户真实动作。
- 用户不需要主动 review 系统状态。
- 不引入 memory service 写入和长期隐私负担。
- Quick Ask 是高频入口，任何减少重复解释的能力都会被立刻感知。
- P0 范围很小，容易用 E2E 验证，并能为 Compose / Meeting / writeback preview 等场景沉淀通用交互模式。
