# Context Recall Experience Eval / 关联记忆真实体验评估

> 记录时间：2026-05-21
> 适用范围：Memory Lens、Meeting Pilot、Today Pilot、Compose Assist 等所有调用 `/context-recall` 的场景
> 建议命令名：`npm run eval:context-recall:experience`
> 当前状态：先沉淀评估协议和真实样本；后续再实现脚本化采集、判分和报告。

## 结论

这件事不应该叫普通 E2E automation。

更准确的名字是 **Context Recall Experience Eval**，中文可以叫 **关联记忆真实体验评估** 或 **召回体验回归**。

它评估的不是“按钮能不能点、卡片能不能显示”，而是：

- 在真实 RingCentral 群组里，当前页面上下文是否足够具体。
- `/context-recall` 返回的记忆是否真的和用户此刻要处理的事有关。
- Memory Lens 展示的标题、摘要、原因、来源是否让用户一眼明白“为什么相关”。
- 如果没有高相关记忆，系统是否应该安静，而不是展示看起来像答案但实际无关的内容。
- 失败时能不能沉淀成可复跑的样本、质量报告和后续修复建议。

所以它是建立在 E2E 之上的 **LLM/RAG eval + 真实体验回归 + 产品质量监控**。

## 为什么要做

这次真实验证暴露的问题不是 UI 单点 bug，而是语义质量问题：

- 页面正在讨论 Codex token、poster、Agent/Skill、PTO，却召回了 HR、泛 RingCentral 消息、旧项目管理记忆。
- 页面讨论 SCP/XMN-UP/pro bug、dev branch、AI 复现，却召回了 WhatsApp to RingEX、Everyone AI、INIT/Epic。
- 页面讨论 Codex 质量、RingClaw、Runstead、假实现，却召回了“时间：2026 年 4 月 27 日”。
- Memory Lens 卡片加粗标题出现“RingCentral 消息”这类 source label，用户看不到真正重点。

传统 E2E 只能验证“浮窗出现了”。这个评估要验证的是“浮窗出现得值不值得”。

## 与 E2E 的关系

| 层级 | 主要问题 | 适合自动化程度 | 本项目落点 |
|---|---|---:|---|
| Unit / helper test | ranking、gating、title formatter 是否按规则工作 | 高 | `memory-service/src/__tests__/api-context-recall.test.ts`、`tools/verify-webpage-memory-detection.ts` |
| E2E automation | 真实扩展能否注入、hover/click 是否打开、反馈按钮是否可用 | 高 | `desktop-app/scripts/webpage-memory-detection-check.mjs` |
| Experience Eval | 真实页面样本下，召回是否真有用，UI 是否解释清楚 | 中 | 本文定义的 `Context Recall Experience Eval` |
| Observability / monitor | 长期趋势：误报率、空结果率、source 噪音、title 信息量是否变差 | 中低 | 后续定期只读运行，输出报告，不自动改代码 |
| Auto-fix loop | 根据失败样本提出或生成修复 patch | 低，需要审批 | 只允许生成建议或 draft patch，不默认自动合入 |

E2E 是机械正确性门禁；Experience Eval 是用户价值门禁。两者应该互补，不互相替代。

## 业内做法参考

- OpenAI Evals 把 eval 定义为用测试输入运行系统、分析结果并迭代改进的流程，接近这里的“样本集 + grader + 报告 + 改进循环”：<https://developers.openai.com/api/docs/guides/evals>
- MT-Bench / Chatbot Arena 论文把 LLM-as-a-judge 作为可扩展的人类偏好近似方法，同时提醒 judge 有位置、冗长、自我增强等偏差，说明这里不能只依赖模型打分，还要保留人工 golden labels：<https://arxiv.org/abs/2306.05685>
- Ragas 把 RAG 评估拆成检索上下文是否相关、生成是否忠实、答案质量等维度，适合迁移到 Memory Lens 的“上下文相关度、记忆相关度、展示摘要质量”：<https://arxiv.org/abs/2309.15217>、<https://docs.ragas.io/>
- TruLens RAG Triad 强调 context relevance、groundedness、answer relevance。Memory Lens 当前没有生成长答案，但仍然需要 context relevance 和 answer/action relevance：<https://www.trulens.org/getting_started/core_concepts/rag_triad/>
- LangSmith、Phoenix、DeepEval 都把 eval 管理成 datasets、experiments、evaluators、CI/monitoring 的组合，而不是单个 E2E 脚本：<https://docs.langchain.com/langsmith/evaluation-concepts>、<https://arize.com/docs/phoenix/evaluation/llm-evals>、<https://deepeval.com/docs/getting-started>

## 第一批真实样本

这些样本来自真实 RingCentral 群组，用于评估 Memory Lens 和所有 `/context-recall` 消费方。

| Case ID | RingCentral URL | 群组 | 这次页面上下文重点 | 当前观察到的问题 |
|---|---|---|---|---|
| `rc-coach-codex-token` | `https://app.ringcentral.com/l/messages/35165069318` | 敏捷教练-RC China | Codex 免费窗口到期、token efficiency、poster、把流程交给 Agent/Personal AI、PTO | 召回 HR 咨询、泛 RingCentral 消息、旧 INIT/Epic，相关性弱；标题“RingCentral 消息”无信息量 |
| `rc-bug-ai-repair` | `https://app.ringcentral.com/l/messages/155923783686` | Bug - AI 先修一遍我再看 | SCP/XMN-UP/pro bug、dev branch、AI 复现与修复 | 召回 WhatsApp to RingEX、Everyone AI、INIT/Epic，缺少 bug/project anchor |
| `rc-colin-michael-codex-quality` | `https://app.ringcentral.com/l/messages/1140194402306` | Colin, Michael | OpenAI/Codex 质量、RingClaw、Runstead、假实现、代码审查 | 召回“时间：2026 年 4 月 27 日”、泛行动指南、ASCON issue，明显不满足当前任务 |
| `rc-webinar-cn-xmn-up` | `https://app.ringcentral.com/l/messages/71219331078` | Webinar CN Team | XMN-UP env、passing rate、audience add、dial-in/copy link、AutoPlay | 召回泛行动指南、Everyone AI、weekly agenda，和具体 webinar 工作不匹配 |

后续每次出现明显误报，都应该优先沉淀成一个 case，而不是只靠现场修规则。

## 复跑工作流

### 1. 连接真实网页

按仓库约定，先用 `webpage-mcp` 检查是否已有相关页面打开；如果没有，再导航到目标群组。

```bash
mcporter --config /Users/Esone/.openclaw/config/mcporter.json list webpage-mcp --schema
mcporter --config /Users/Esone/.openclaw/config/mcporter.json call webpage-mcp.get_windows_and_tabs
```

如果目标页未打开：

```bash
mcporter --config /Users/Esone/.openclaw/config/mcporter.json call webpage-mcp.chrome_navigate \
  url=https://app.ringcentral.com/l/messages/35165069318 target=newTab
```

如果 `/l/messages/{id}` 落到 RingCentral landing page，手动或脚本转换为 app route：

```text
https://app.ringcentral.com/messages/{id}
```

### 2. 抽取近期聊天上下文

使用 `chrome_javascript` 抽取当前 viewport 的会话卡片、作者、时间、正文、quoted text、附件标题等。下一版脚本应固化 selector，但当前可用协议如下：

```bash
mcporter --config /Users/Esone/.openclaw/config/mcporter.json call webpage-mcp.chrome_javascript \
  code='(() => {
    const title = document.querySelector("[data-test-automation-id=\"conversationTitle\"], h1")?.innerText || document.title;
    const cards = [...document.querySelectorAll(".conversation-card__right, [class*=\"conversation-card\"]")]
      .slice(-12)
      .map((el) => el.innerText)
      .filter(Boolean);
    return { title, cards };
  })()'
```

抽取内容要保存为 run artifact，不能只保存最终判断。后续分析需要知道当时页面到底给了什么输入。

### 3. 调用统一召回接口

所有样本都直接打真实 memory service 的统一接口：

```bash
curl -sS http://10.32.56.212:3210/api/v1/context-recall \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: esone.qiu' \
  -d @payload.json
```

payload 模板：

```json
{
  "surface": "follow_thread",
  "contextType": "message_thread",
  "title": "2026 Hackathon Project",
  "url": "https://app.ringcentral.com/messages/35165069318",
  "primaryText": "近期聊天正文，控制在 1400 字左右",
  "secondaryTexts": ["群组标题", "关键短摘要"],
  "sourceContext": {
    "contextType": "message_thread",
    "sourceType": "ringcentral_message",
    "host": "app.ringcentral.com",
    "url": "https://app.ringcentral.com/messages/35165069318",
    "title": "群组标题",
    "groupId": "35165069318",
    "conversationId": "35165069318"
  },
  "exclude": {
    "urls": ["https://app.ringcentral.com/messages/35165069318"],
    "groupIds": ["35165069318"],
    "conversationIds": ["35165069318"]
  },
  "sourceTypes": ["glip", "manual", "markdown", "web", "jira", "system"],
  "limit": 3,
  "debug": true
}
```

关键要求：

- `exclude` 必须排除当前群组/当前页面自身，避免自回声。
- passive recall 不应强化 access。
- 保留 `debug`，用于后续看 gating、matchedBy、suppressionReason、candidate 来源。
- 如果没有通过阈值的高相关记忆，期望行为是 `hidden` 或空结果，而不是展示低质 p2。

### 4. 判分维度

每条返回结果按 0-3 分评估。

| 维度 | 0 分 | 1 分 | 2 分 | 3 分 |
|---|---|---|---|---|
| `context_relevance` | 和当前聊天无关 | 只共享泛主题 | 有一个明确 anchor 相关 | 多个具体 anchor 命中当前问题 |
| `user_value` | 用户不知道能干嘛 | 只能作为背景 | 能帮助判断/回复/追踪 | 直接能推进当前任务 |
| `specificity` | 只有“AI/RingCentral/时间”等泛词 | 有 source/person 但不够具体 | 有项目/人/时间/对象 | 有问题、约束、决策、下一步 |
| `title_quality` | 标题是 source label，如“RingCentral 消息” | 标题太泛 | 标题包含主题 | 标题提炼出最重要字眼 |
| `explanation_quality` | 不解释为什么相关 | 只有标签 | 有匹配原因 | 能让用户一眼看懂关联链 |
| `suppression_correctness` | 无关也展示 | 低相关强推 | 弱相关降级 | 无高相关时安静 |

建议的整体判定：

- `pass`：Top 1 的 `context_relevance >= 2` 且 `user_value >= 2`，没有明显错误标题。
- `warn`：Top 3 有有用记忆，但 Top 1 排错或 UI 解释不清。
- `fail`：Top 3 都不能帮助当前任务，或无关结果被标成“强相关”。
- `hide_expected`：当前上下文不足或库里没有合适记忆时，正确结果是静默。

### 5. LLM-as-a-judge 提示词草案

LLM judge 只做初筛，不能替代人工 golden labels。

```text
你是 Personal AI 的召回质量评估员。
给定当前网页/聊天上下文，以及 /context-recall 返回的候选记忆。
请站在真实用户角度判断这条记忆是否应该出现在 Memory Lens 或 Meeting Pilot 中。

输出 JSON：
{
  "caseId": "...",
  "candidateId": "...",
  "context_relevance": 0-3,
  "user_value": 0-3,
  "specificity": 0-3,
  "title_quality": 0-3,
  "explanation_quality": 0-3,
  "verdict": "pass|warn|fail|hide_expected",
  "why": "一句话说明",
  "better_title": "如果标题不好，给一个更具体的标题",
  "expected_behavior": "show_strong|show_possible|hide|ask_for_more_context",
  "suggested_fix": "ranking|gating|title_generation|query_extraction|source_exclusion|feedback|other"
}
```

## 存储方式

建议把评估资产拆成三层。

### 1. Case set：版本化样本

未来路径建议：

```text
evals/cases/context-recall/real-ringcentral-groups.jsonl
```

每行一个 case：

```json
{
  "id": "rc-colin-michael-codex-quality",
  "kind": "ringcentral_group",
  "url": "https://app.ringcentral.com/l/messages/1140194402306",
  "canonicalUrl": "https://app.ringcentral.com/messages/1140194402306",
  "conversationId": "1140194402306",
  "title": "Colin, Michael",
  "expectedTopics": ["Codex quality", "RingClaw", "Runstead", "fake implementation", "code review"],
  "mustNotReturnTopics": ["generic calendar time", "unrelated Jira issue"],
  "expectedBehavior": "show_only_if_specific_memory_exists",
  "privacy": "private-live-data",
  "owner": "esone.qiu"
}
```

### 2. Run artifacts：每次运行的证据

未来路径建议：

```text
test-results/context-recall-experience/2026-05-21T120000Z/
  cases.jsonl
  page-contexts.jsonl
  context-recall-requests.jsonl
  context-recall-responses.jsonl
  judge-results.jsonl
  report.md
```

这些产物默认不进入长期文档，只作为本地诊断证据。

### 3. Golden labels：人工校准样本

未来路径建议：

```text
evals/context-recall/golden-labels.jsonl
```

人工确认过的样本要包含：

- 当前页面摘要。
- 被判定好/坏的候选 memory id。
- 人类理由。
- 期望行为。
- 是否允许模型 judge 用作 few-shot 参考。

## 管理方式

### 什么时候新增 case

遇到以下情况就应该新增 case：

- 用户明确说“这个完全不相关”。
- Memory Lens 在空会议/低信息页面展示强相关。
- 标题只有 source label，看不出重点。
- Meeting Pilot / Today Pilot / Compose Assist 因同一类 recall 噪音误导用户。
- 修过一次的误报后来复发。

### 什么时候自动运行

建议分三阶段：

1. **现在：手动运行**
   - 在改 `ContextRecallService`、Memory Lens、Meeting Pilot 记忆关联前后手动跑。
   - 不进入普通 CI，因为依赖真实 RingCentral session、真实 memory service 和私有数据。

2. **下一阶段：本机定期只读 monitor**
   - 每周或每天本机自动跑一次。
   - 只读真实网页和 `/context-recall`。
   - 输出 trend report：fail cases、top source 噪音、title 质量、隐藏是否正确。
   - 不自动改代码。

3. **再下一阶段：受控 auto-fix**
   - eval 失败可以生成修复建议或 draft patch。
   - 必须由用户确认后才允许修改代码、部署 memory service 或更新阈值。

### 为什么不直接放 CI

- 真实 RingCentral 页面会随时间、登录态、滚动位置变化。
- 真实记忆库会增长，结果不是完全 deterministic。
- LLM judge 有偏差，适合作质量趋势，不适合作唯一阻塞门禁。
- CI 适合跑 synthetic fixtures；真实体验 eval 适合本机或内部环境定期 monitor。

## 后续自动化脚本设计

当前已落地统一脚本：

```text
tools/eval-run.mjs
tools/eval-list.mjs
```

当前 package script：

```json
{
  "scripts": {
    "eval:list": "node tools/eval-list.mjs",
    "eval:run": "node tools/eval-run.mjs"
  }
}
```

脚本职责：

1. 读取 case set。
2. 用 `webpage-mcp` 选中或打开目标 RingCentral 页面。
3. 抽取真实聊天上下文。
4. 构造 `/context-recall` payload。
5. 请求 `10.32.56.212` 的真实 memory service。
6. 运行 heuristic scorer。
7. 可选运行 LLM-as-a-judge。
8. 生成 `test-results/context-recall-experience/<timestamp>/report.md`。
9. 输出退出码：
   - `0`：没有 fail。
   - `1`：有 fail，但只作为本机 monitor 时可不阻塞。
   - `2`：采集失败或接口不可用。

## 对产品和代码的改进方向

这个 eval 应该驱动统一接口改进，而不是只修 Memory Lens UI：

- `ContextRecallService`：加强 query anchor 提取、sourceContext/exclude、自回声过滤、泛主题降权、低信息页面静默。
- `ContextRecallService`：把 title/displayTitle 从 source label 改为 query-aware headline，例如“Codex 免费窗口与 token efficiency”。
- `ContextRecallService`：输出 `whyRelevant`，解释命中的人、项目、工具、时间、问题线索。
- `Memory Lens`：无高相关时不展示；弱相关只在用户主动划词或展开时出现。
- `Meeting Pilot`：同样消费 unified recall 的 `whyRelevant`、`displayPriority`、`suppressionReason`，避免会议里展示泛记忆。
- `Compose Assist`：只把 recall 作为证据，不把插入回复逻辑放进 Memory Lens。

## 下一步建议

1. 先把本文作为真实体验评估协议。
2. 下一次修 recall 前，先跑 `npm run eval:run -- --suite context-recall`。
3. 继续扩展 `tools/eval-run.mjs`，让 live webpage 采集和 LLM judge 更稳定。
4. 再接入 LLM-as-a-judge 和人工 golden labels。
5. 最后考虑每周本机只读 monitor，并把失败报告写进 `docs/progressing/to-verify.md` 或专门的 eval inbox。
