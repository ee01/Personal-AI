# 新能力：Memory Egress Firewall / 记忆外发防火墙（搁置）

> 生成日期：2026-05-16 CST  
> Codex 会话标题建议：新能力：记忆外发防火墙（搁置）  
> 交付物：功能计划 + 可预览 Demo  
> Demo：[`memory-egress-firewall-demo.html`](./memory-egress-firewall-demo.html)

## 搁置原因

当前暂不建议推进 **Memory Egress Firewall / 记忆外发防火墙**。

核心原因是阶段优先级不匹配：Personal AI 现在最需要优先解决的是**准确问题**，而不是安全问题。真实体验里，用户首先感受到的是相关记忆召回不准、场景理解不稳、提示时机不对、Context Assist / Memory Lens / Day Pilot 给出的内容不够贴当前页面或当前任务。如果这些基础准确率还没稳定，先做外发防火墙会把产品重心提前拉向“安全审查”和“出站治理”，但用户日常最痛的仍然是“你给我的记忆不够准”。

这并不是说外发安全不重要，而是它依赖更前置的能力先变可靠：

- 召回要先能稳定找到真正相关的记忆。
- 当前页面、会议、Jira、聊天、AI 输入框的场景识别要先准。
- 记忆来源、证据、敏感度和可信度 metadata 要更完整。
- Context Passport / Memory Lens / Compose Assist 生成的上下文要先足够有用。

在这些前置能力不稳定时，Egress Firewall 可能变成“给不准确的上下文再加一道安全 UI”，既不能解决根因，还会增加用户复制/使用 AI 的摩擦。

因此本方案记录为搁置方向。近期更应该把工程和产品精力放在：

- `Memory Lens` / 现有右下角相关记忆提示的相关性和触发准确率。
- `Context Assist` 的可发送建议质量、场景过滤和证据相关性。
- `/context-recall`、`/recall`、Day Pilot mission card 的排序、去噪和证据可解释性。
- 真实数据里的 ASR 噪音、缓存消息误召回、泛化 AI 主题误匹配、会议空态误触发等问题。

等“该出现什么记忆”变准之后，再恢复评估“这些记忆能不能安全外发”会更合理。

## 结论

本方案记录为搁置方向：**Memory Egress Firewall / 记忆外发防火墙**。

它不是新的记忆搜索页，也不是又一个 AI 聊天入口。它解决一个更具体、真实、危险的瞬间：

> 用户要把 Personal AI 里的记忆、会议、Jira、聊天、网页、操作记录或关系上下文交给 ChatGPT、Claude、Codex、豆包、Gemini、NotebookLM、OpenClaw、Cursor 等外部 AI 之前，Personal AI 先告诉用户：这次到底会发出去什么，哪些要脱敏，哪些不该发，以及安全替代版本是什么。

一句话价值：

> Personal AI 不只帮用户想起记忆，还要在记忆离开用户边界前做最后一道可审阅的防火墙。

这个能力适合近期单独成 plan，因为现有方案里虽然都提到隐私和脱敏，但缺少一个专门处理“外发瞬间”的用户体验：

- `AI Context Passport` 负责打包上下文，但不覆盖用户直接在外部 AI 输入框粘贴/输入的场景。
- `Memory Lens` 负责当前页面旁的相关记忆提示，明确不自动生成外发 patch。
- `Memory Trust Console` 是全局治理台，已搁置，范围太大。
- `Memory Reality Check` 是输出后的核验，已搁置；Egress Firewall 是发送前的预检。
- `Compose Assist` 负责写作和发送前辅助，但主要对象是 RingCentral/Jira/消息草稿，不是跨 AI 记忆外发安全边界。

因此，本能力的主对象很清楚：**memory egress event**，即“记忆或由记忆生成的上下文即将离开 Personal AI / 本地 / 内网边界”。

## 本次输入信号

### Reminders 检查

本机 Reminders 可枚举到的列表为：

- `We`
- `Next actions`
- `Moives`
- `Shopping List`
- `家庭`
- `人名记忆`
- `宝宝需要办理`
- `吃吃看`
- `出门前检查`
- `装修待办`
- `Reading`
- `菜头`
- `Tasks`

没有发现名为 `Personal AI` 的列表。因此本轮没有从 Reminder item 抽取新 idea，也没有需要标记 done 或写备注的 Reminder item。

### 真实记忆信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 用户记忆。本次 HTTP `/health` 可达但数据库状态为 `degraded`，因此改用 SSH 只读查询远端 SQLite，没有写入远端数据。

读到的关键轮廓：

- `messages_raw` 主要来源为 `glip` 8693 条、`meeting` 316 条、`system` 161 条、`calendar` 146 条、`jira` 9 条，另有 `doubao_chat` 125 条、`chatgpt` 36 条。
- 用户身份为 Esone Qiu，Scrum Master，时区 `Asia/Shanghai`。
- 近期高频主题包括 RingCentral/Glip、会议、Jira、AI Notes、Codex、Claude Code、Cursor、OpenAI API、Gemini、NotebookLM、OpenClaw/RingClaw、AI tool cost 和 AI 自动化。
- 最近日历里有 `AI Refresh: Mastering Google AI Studio, Gems, and NotebookLM`、`Bug - AI 先修一遍我再看`、`[高效AI]-打造高可控、定制化的私人Skill平台` 等强信号，说明用户会持续把真实工作上下文交给不同 AI。
- 近期 Jira 和 Glip 里已经出现 `Esone's AI: I help...`、`OpenClaw is working...`、`凡事先让 AI 跑一遍` 这类工作流，说明“把 AI 放进真实工作链路”已经不是概念。
- 用户画像里有“直接、实际、分步骤、分析式”的待确认偏好，适合做一个不吓人、不讲大道理、只在关键外发瞬间提示的产品。

这些信号共同指向一个缺口：

> 用户正在用多个外部 AI 加速工作，但 Personal AI 还缺一个“发送前边界层”，把公司内部信息、个人关系上下文、会议链接、Jira 链接、token、未确认推断、恶意网页指令和可安全摘要分开。

## 为什么值得做

Personal AI 的目标是留存用户和 AI 的所有记忆，并在聊天、会议、浏览、操作和其他 AI 对话中提供关联提示。这个目标越成功，越会面临一个核心风险：

> 记忆越好用，用户越想复制给其他 AI；复制越方便，越容易把不该外发的原文、关系判断、公司内部链接、会议 join URL 或不可信网页指令一起带出去。

真实工作中，这个风险不只来自“用户手滑复制了敏感内容”。更常见的是：

1. 用户让 Personal AI 生成一份上下文包，里面混有安全事实和敏感证据。
2. 用户在 ChatGPT / Claude / Codex / Gemini / 豆包输入框里临时补了一段会议或 Jira 原文。
3. 用户从网页、邮件、Jira、RingCentral 消息里复制内容给 AI，但内容里有 prompt injection 或隐藏指令。
4. 外部 AI 平台的隐私边界、训练策略、企业控制不同，用户临时无法判断“这次能不能发”。
5. 多个能力都生成 context pack，但没有统一的外发账本，事后很难知道哪条记忆被交给了哪个 AI。

Egress Firewall 的价值不是“吓用户别用 AI”，而是让用户更放心地用 AI：

- 把风险解释为具体字段，而不是泛泛说“可能敏感”。
- 给出可复制的安全版本，而不是只阻止。
- 记录外发 receipt，方便之后追溯“我给那个 AI 说过什么”。
- 让敏感内容默认本地保留，外部 AI 只拿最小必要摘要。
- 把 Personal AI 的私有记忆优势变成可控的跨 AI 能力，而不是泄露风险。

## 行业观察与可借鉴点

### 1. Prompt injection 已经从理论风险变成日常 AI 产品风险

[OpenAI 的 prompt injection 说明](https://openai.com/safety/prompt-injections/)强调，现代 AI 对话上下文会混入互联网等多来源内容，第三方内容可能把恶意指令注入模型上下文。对 Personal AI 的启发是：网页、邮件、Jira、聊天、会议转录都应该带 provenance；外发前不能把“用户指令”和“被读取内容里的指令”混成一团。

[Microsoft 的间接 prompt injection 防御文档](https://learn.microsoft.com/en-us/security/zero-trust/sfi/defend-indirect-prompt-injection)建议把间接注入视为会发生的事情，采用多层防御、隔离不可信内容、运行时监控和上下文相关缓解。对 Personal AI 的启发是：Egress Firewall 不应只靠一个 LLM classifier，而应结合规则、来源标记、目标平台策略、用户确认和审计。

[Simon Willison 的 lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)把 AI agent 的高危组合概括为私有数据、不可信内容、外部通信。Personal AI 天然拥有“私有数据”；浏览网页和消息时会遇到“不可信内容”；复制给外部 AI 就是“外部通信”。Egress Firewall 的核心就是在第三个条件发生前把三者拆开。

### 2. 企业产品已经把 AI DLP 做成基础设施，但个人用户缺少可用形态

[Microsoft Purview 的 AI 数据安全能力](https://learn.microsoft.com/en-us/purview/ai-microsoft-purview?azure-portal=true)已经支持对 AI 交互做数据分类、DLP、审计和风险检测，甚至可以对浏览器访问第三方生成式 AI 站点时的敏感信息分享进行警告或阻止。

这证明“AI prompt DLP”是明确需求。但 Purview 是企业安全/合规产品，面向管理员和策略，不解决个人用户的日常体验：

- 用户此刻到底要发什么？
- 是否能自动改成安全摘要？
- 哪些 Personal AI 记忆可以外发，哪些只能本地引用？
- 这次给 ChatGPT、Codex、Claude、豆包的内容以后怎么追溯？

Personal AI 的机会是做“个人可理解、个人可决策”的外发防火墙。

### 3. 平台记忆都在强调控制权，但控制只在平台内部

[OpenAI Memory FAQ](https://help.openai.com/en/articles/8590148-persistent-memory-in-chatgpt)强调用户可以关闭、查看、删除和管理 ChatGPT memory，也说明隐私和安全是 memory 的重要考虑。

[Claude Memory](https://claude.com/blog/memory?from_blog=true)强调 work context、项目偏好、可选 memory、细粒度控制和 incognito chat。

这些能力解决的是“这个平台内部怎么记住我”。Personal AI 的方向不同：用户同时使用多个 AI，真正需要的是跨平台的外发边界：

- ChatGPT 可以管 ChatGPT 记忆，但不知道用户从 RingCentral/Jira/会议里复制了什么。
- Claude 可以管 Claude 的 memory，但不知道 Personal AI 证据里哪些是公司内部推断。
- Codex/Cursor 可以管代码上下文，但不知道 Jira、会议、人际关系上下文能否外发。

Egress Firewall 是跨平台个人记忆层的控制面。

### 4. MCP 和 agent 工具生态要求更明确的人类确认与工具可见性

[MCP Tools 规范](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)建议工具调用要有清晰 UI、可见的工具暴露状态和人类确认。

[MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)列出 token passthrough、session hijack prompt injection、本地 MCP server compromise、scope minimization 等风险。

Personal AI 未来如果通过 MCP 或 provider context package 把记忆交给 Codex、Claude Code、Cursor、OpenClaw，一定需要一个统一的出站策略层。否则每个 connector 都会自己做一点脱敏和确认，最终不可审计。

### 5. 最新论文显示：外部内容、开发工具和 tool-calling agent 都会泄露个人/企业数据

- [Indirect Prompt Injection in the Wild](https://arxiv.org/abs/2604.27202) 在大规模网页中发现大量面向机器的间接 prompt injection，说明网页已经不是中性文本源。
- [Are AI-assisted Development Tools Immune to Prompt Injection?](https://arxiv.org/abs/2603.21642) 研究了 Claude Desktop、Claude Code、Cursor、Cline、Continue、Gemini CLI、Langflow 等 MCP client 的 tool-poisoning 风险，说明 coding AI 工具本身也需要外发边界。
- [Simple Prompt Injection Attacks Can Leak Personal Data Observed by LLM Agents During Task Execution](https://arxiv.org/abs/2506.01055) 说明 tool-calling agent 在攻击下可能泄露执行过程中看到的个人数据。
- [EchoLeak](https://ojs.aaai.org/index.php/AAAI-SS/article/view/36899) 把 Microsoft 365 Copilot 中的零点击 prompt injection 作为生产系统案例，强调 prompt partitioning、输入/输出过滤、provenance-based access control、least privilege 和持续对抗测试。
- [ControlNET](https://huggingface.co/papers/2504.09593) 代表了“AI firewall”研究方向：不只看输入，也要控制 RAG/LLM 系统的入站和出站流。

这些资料共同支持一个产品判断：Personal AI 如果要成为用户的跨 AI 记忆真源，不能只做更强 recall，必须做出站控制。

## 产品定义

### 功能名

推荐：**Memory Egress Firewall / 记忆外发防火墙**

备选：

- Context Firewall / 上下文防火墙
- AI Send Guard / AI 外发守门员
- Memory DLP / 记忆数据防泄漏
- Safe Context Gate / 安全上下文闸门
- Personal AI Data Boundary / 个人 AI 数据边界

推荐“记忆外发防火墙”，原因：

- “记忆”说明它服务的是 Personal AI 的私有记忆层。
- “外发”说明它只在边界事件上介入，不是常驻打扰。
- “防火墙”说明它既可以放行，也可以脱敏、降级、阻止和记录。

### 一句话产品承诺

> 在你把任何 Personal AI 记忆交给外部 AI 前，它会显示“将要发出什么、为什么有风险、安全版本是什么、是否记录 receipt”。

### 不做什么

- 不替代 ChatGPT / Claude / Codex / 豆包的官方隐私设置。
- 不假装能 100% 阻止所有 prompt injection。
- 不默认扫描用户所有键盘输入。
- 不自动把安全版本发送给外部 AI；只填入/复制，最后发送由用户控制。
- 不把所有公司内容都判定为不可外发；要支持“安全摘要”和“允许一次”。
- 不做企业管理员 DLP 控制台；这是个人决策层。

### 做什么

- 识别外发目标：ChatGPT、Claude、Codex Web、Gemini、豆包、NotebookLM、OpenClaw、Cursor、unknown AI、Google Docs、RingCentral 等。
- 识别外发内容来源：用户手写、Personal AI 记忆、会议摘要、Jira、RingCentral 消息、网页正文、AI 输出、操作 episode、skill、关系卡、决策证据链。
- 给每个片段打上 egress policy：`allow`、`safe_summary`、`redact`、`confirm_once`、`local_only`、`blocked`。
- 检测敏感字段：公司内部链接、Jira ticket、会议 join URL、人员关系判断、私聊原文、API key/token、邮箱/电话、HR/财务/健康、未确认推断、供应商/采购策略。
- 检测 prompt injection 风险：不可信网页/邮件/issue 中的命令式指令、隐藏 HTML、要求外发/忽略规则/读取私有数据/点击链接等模式。
- 生成安全版本：保留任务目标、必要事实和本地 evidence refs，移除原始证据和敏感内容。
- 记录 receipt：目标平台、时间、外发文本 hash、风险项、用户选择、redaction diff、来源记忆 ref、过期时间。

## 核心体验

### 入口 1：Context Package 复制前的 Egress Preflight

当用户从 AI Context Passport、Day Pilot、Relationship Radar、Decision Time Machine、Memory Lens、Ask 或 Meeting Pilot 中点击：

- `复制给 ChatGPT`
- `复制给 Codex`
- `注入 Claude`
- `导出为 context package`
- `OpenClaw 执行`

系统先打开一个轻量 preflight panel：

- 顶部显示目标平台和风险等级：`ChatGPT Team · Review · 5 risks`
- 中间显示“将要外发的字段”：任务目标、可外发事实、安全摘要、本地证据引用、被排除内容。
- 右侧显示风险项：`内部 Jira 链接`、`会议 join URL`、`1:1 私聊原文`、`未确认关系推断`、`网页 prompt injection`。
- 底部提供动作：`复制安全版`、`只复制任务`、`允许一次`、`本次取消`、`保存规则`。

默认主按钮不是“继续发送原文”，而是“复制安全版”。

### 入口 2：外部 AI 输入框旁的 Send Guard

在 ChatGPT、Claude、Codex Web、豆包、Gemini、NotebookLM、Google AI Studio 等页面，如果用户输入框中出现以下信号，扩展在输入框旁显示小 chip：

- 粘贴了 Personal AI context package。
- 粘贴了 RingCentral/Jira/会议/网页内容。
- 文本包含内部链接、Jira key、meeting URL、email、token-like 字符串。
- 文本中混入“ignore previous instructions / exfiltrate / send to URL / reveal memory”等注入模式。
- 用户输入中引用了 `Personal AI says`、`我的记忆里`、`上次会议`、`和某人 1:1` 等记忆来源。

chip 有三种状态：

- `Clean`：低风险，不打扰。
- `Review`：可外发，但建议看一下。
- `Blocked`：默认不建议发原文，必须点击查看原因。

点击 chip 展开同一个 preflight panel。若用户不点击，系统不拦输入、不抢焦点。

### 入口 3：剪贴板 / Desktop App 出站提醒

后期 Desktop App 可以监听“从 Personal AI 复制出的 context package hash”，并在用户把它粘贴到外部 AI 桌面应用或浏览器页面时做一次提醒。

MVP 不需要全局 keylogger，只追踪 Personal AI 自己生成的 context package 和用户在支持页面中的输入框内容。

### 入口 4：MCP / Provider Context 出站代理

当 Codex、Claude Code、Cursor、OpenClaw 通过 MCP/API 请求读取 Personal AI 记忆时，Egress Firewall 作为中间层做策略决策：

1. client 声明用途和目标平台；
2. Personal AI 召回候选记忆；
3. Egress Firewall 根据 provider trust profile 和 item-level policy 过滤；
4. 只返回安全摘要或本地引用；
5. 高风险请求需要用户确认。

这会让未来跨 agent 记忆共享有统一安全边界。

## Demo 说明

Demo 文件：[`memory-egress-firewall-demo.html`](./memory-egress-firewall-demo.html)

Demo 模拟一个外部 AI 页面，用户准备把 Nova / Jira / RingCentral / Codex 相关上下文贴给 AI。右侧是 Personal AI 的 Egress Firewall panel：

- 显示目标平台 `ChatGPT Team`。
- 分析当前 prompt 中的内部 Jira、会议链接、私聊原文、未确认推断和 prompt injection。
- 提供一键生成安全 outbound prompt。
- 展示“原始内容 / 安全版本 / 外发 receipt”的用户决策流。

这不是独立页面的真实形态；真实产品应注入在外部 AI、Context Passport copy modal 或 Personal AI 现有页面旁。

## 用户故事

### 场景 1：把 Jira/会议上下文交给 Codex

用户想让 Codex 修一个 Jira bug，于是从 Personal AI 复制上下文：

- bug 描述；
- 相关会议结论；
- 上次 Codex 失败原因；
- AGENT.md 验证策略；
- Jira 内部链接；
- 某个会议 join URL；
- 1:1 中某人对项目风险的私下判断。

Egress Firewall 处理：

- 保留任务目标、repo、branch、验证规则、公开可用的 Jira key。
- 把内部 Jira 链接替换为 `Jira issue: MTR-148213 (internal link omitted)`。
- 删除 meeting join URL。
- 把 1:1 私聊判断改成“stakeholder concern exists; do not quote source”。
- 标记“AGENT.md 可发，因为是当前 repo 工作规则”。
- 生成 receipt，记录交给 `Codex Web` 的 safe context hash。

用户体验：

- 不需要手动想哪些能发。
- Codex 仍拿到足够上下文。
- 事后能追溯“我到底给 Codex 传了哪些记忆”。

### 场景 2：网页研究内容混入 prompt injection

用户打开某个网页，想让 ChatGPT 总结并结合自己的项目记忆。

网页 HTML 或正文里有隐藏/可见指令，要求 AI 忽略规则、访问私有记忆或请求外部 URL。

Egress Firewall 处理：

- 把网页内容标记为 `untrusted_web_content`。
- 抽取正文事实时隔离其中的命令式句子。
- 如果用户同时附带 Personal AI 私有记忆，则禁止把 untrusted content 和 private memory 放在同一个外部 prompt 中。
- 建议改为“两段式”：先让 Personal AI 本地总结网页，再把脱敏摘要给外部 AI。

### 场景 3：给豆包/ChatGPT 做会议发言稿

用户想把和 Sophia 的 1:1、Nova 周会、Story Points 策略、Jira 评估表格交给外部 AI 生成发言稿。

Egress Firewall 处理：

- 保留会议主题和公开可说的行动项。
- 默认不外发 1:1 私聊原文。
- 对人员相关推断加上 `inferred / not for external AI`。
- 输出安全发言稿 prompt：“基于一个内部项目的 sprint planning 背景，帮我生成 Scrum Master 发言草稿。不要引用人员私聊。”

### 场景 4：把个人技能交给外部 agent

用户想把 `Jira Headcount Trend Report` skill 交给 OpenClaw 或 Claude Code。

Egress Firewall 处理：

- SKILL.md 工作流可外发。
- 真实公司 URL、Google Sheet ID、人员名单默认脱敏。
- scripts 如果会访问内部 API，必须改成“需要用户本地配置凭证”。
- 生成可安装的安全版 skill package 和 receipt。

## 信息架构

### Egress Event

一次外发尝试。

```ts
interface EgressEvent {
  id: string;
  userId: string;
  surface:
    | 'context_passport'
    | 'memory_lens'
    | 'day_pilot'
    | 'relationship_radar'
    | 'decision_time_machine'
    | 'ask'
    | 'meeting_pilot'
    | 'external_ai_composer'
    | 'mcp_request'
    | 'desktop_clipboard';
  targetProvider:
    | 'chatgpt'
    | 'claude'
    | 'codex'
    | 'cursor'
    | 'doubao'
    | 'gemini'
    | 'notebooklm'
    | 'openclaw'
    | 'google_docs'
    | 'ringcentral'
    | 'unknown';
  targetTrustProfileId: string;
  action: 'copy' | 'inject' | 'paste_detected' | 'mcp_read' | 'api_delivery';
  userIntent: string;
  rawTextHash: string;
  safeTextHash?: string;
  decision: 'clean' | 'review' | 'blocked' | 'allowed_once' | 'safe_version_used' | 'cancelled';
  createdAt: number;
  expiresAt?: number;
}
```

### Egress Risk Item

```ts
type EgressRiskKind =
  | 'secret'
  | 'internal_url'
  | 'meeting_join_url'
  | 'person_private_context'
  | 'one_on_one_source'
  | 'unconfirmed_inference'
  | 'company_policy'
  | 'financial_or_procurement'
  | 'hr_or_sensitive_personal'
  | 'prompt_injection'
  | 'untrusted_content'
  | 'tool_poisoning'
  | 'raw_transcript_noise'
  | 'provider_policy_unknown'
  | 'excessive_context';

interface EgressRiskItem {
  id: string;
  eventId: string;
  kind: EgressRiskKind;
  severity: 'low' | 'medium' | 'high' | 'critical';
  spanStart?: number;
  spanEnd?: number;
  sourceRef?: MemoryRef;
  title: string;
  explanation: string;
  recommendedAction:
    | 'allow'
    | 'summarize'
    | 'redact'
    | 'replace_with_local_ref'
    | 'ask_confirmation'
    | 'block';
  replacementText?: string;
}
```

### Provider Trust Profile

```ts
interface ProviderTrustProfile {
  id: string;
  provider: string;
  displayName: string;
  category: 'personal_ai' | 'enterprise_ai' | 'consumer_ai' | 'local_agent' | 'unknown';
  dataBoundary: 'local' | 'company_managed' | 'vendor_managed' | 'unknown';
  defaultPolicy: 'allow_summary' | 'review_sensitive' | 'local_only';
  supportsAuditReceipt: boolean;
  supportsMcpScopedRead: boolean;
  notes: string;
  updatedAt: number;
}
```

### Item-level Egress Policy

每条记忆、证据、摘要、关系卡、skill、operation episode 都可以带外发策略：

```ts
type MemoryEgressPolicy =
  | 'allow'
  | 'safe_summary'
  | 'redact_sensitive'
  | 'confirm_once'
  | 'local_only'
  | 'blocked';

interface MemoryEgressMetadata {
  policy: MemoryEgressPolicy;
  sensitivity:
    | 'public'
    | 'internal'
    | 'confidential'
    | 'personal'
    | 'secret';
  provenance:
    | 'user_authored'
    | 'confirmed_memory'
    | 'inferred_memory'
    | 'raw_message'
    | 'raw_meeting_transcript'
    | 'untrusted_webpage'
    | 'external_ai_output'
    | 'skill'
    | 'operation_episode';
  allowedTargets?: string[];
  blockedTargets?: string[];
  ttlSeconds?: number;
}
```

## 决策逻辑

### 风险判定不是单点分类器

采用四层决策：

1. **Deterministic scan**
   - secret/token/API key regex；
   - meeting join URL；
   - RingCentral/Jira/Google Sheet 内部链接；
   - 邮箱/电话/人名；
   - prompt injection 模式；
   - HTML hidden text / comments / zero-size text。

2. **Provenance policy**
   - `user_authored` 通常风险低；
   - `confirmed_memory` 可摘要外发；
   - `raw_message` / `one_on_one_source` 默认需脱敏；
   - `untrusted_webpage` 不能和 private memory 直接混合；
   - `external_ai_output` 再外发需要标记为 non-ground-truth；
   - `inferred_memory` 默认不可作为事实外发。

3. **Target trust profile**
   - `OpenClaw internal` 可以比 `unknown consumer AI` 放宽；
   - `ChatGPT Enterprise/Team` 和 `consumer ChatGPT` 策略不同；
   - `Codex` 可以接收 repo 验证策略，但不应接收私聊关系判断；
   - `NotebookLM` 可能适合文档摘要，但不适合贴个人画像。

4. **User intent and minimality**
   - 修代码只需要 repo、error、文件、验证规则，不需要人际关系；
   - 写会议发言稿需要项目背景和语气，不需要完整会议 join URL；
   - 问公开资料可以只给安全摘要，不给原文证据。

### 策略输出

每次外发输出四类内容：

- **Allowed**：可直接外发。
- **Redacted**：可外发但需替换或打码。
- **Local ref only**：不能外发原文，只给 `personal-ai://memory/...` 本地引用。
- **Blocked**：不建议进入任何外部 AI。

### 安全版本生成原则

安全版本不是把所有敏感字删掉，而是保留任务可完成的最小信息：

- 内部 URL → 对象类型 + key，例如 `Jira issue MTR-148213, internal URL omitted`。
- 人名 → 角色或关系，例如 `a stakeholder`、`the project owner`。
- 私聊原文 → 摘要事实，例如 `there was a stakeholder concern about scope clarity`。
- 会议 join URL → 删除。
- token / API key → 删除并提示“使用本地 env，不要贴到外部 AI”。
- 未确认推断 → 改成 `possible / unconfirmed` 或删除。
- 不可信网页指令 → 删除命令，只保留被总结内容。

## 用户体验原则

### 1. 只在出站边界打扰

不要在用户每输入一个字时跳警告。只有当内容即将复制、注入、粘贴到外部 AI、或通过 MCP/API 被外部 agent 读取时才提示。

### 2. 主动作是“复制安全版”

不要把用户推到“继续原文 / 取消”二选一。默认给出能完成任务的安全版本，降低心理成本。

### 3. 解释具体字段，不讲抽象风险

文案避免“可能存在隐私风险”。改成：

- `包含 1 个会议 join URL，已删除`
- `包含 2 条 1:1 私聊证据，改为摘要`
- `网页内容里有命令式注入句，已隔离`
- `这条关系判断未确认，不外发`

### 4. 用户可以保存例外，但例外有范围

允许：

- `本次允许`
- `对 ChatGPT Team 允许 Jira key，但不允许 Jira URL`
- `对 OpenClaw internal 允许 skill workflow`
- `未来 7 天对这个项目允许安全摘要`

不允许：

- “以后全部放行”这种无边界白名单。

### 5. 外发 receipt 默认记录 hash，不记录完整原文

为了追溯和隐私平衡：

- 记录 raw/safe 文本 hash。
- 记录 redaction diff 的结构化摘要。
- 高敏内容不重复存一份。
- 用户可在 receipt 里选择“保存安全版全文”。

## MVP 范围

### P0：Personal AI 生成内容的外发 preflight

目标：先管住 Personal AI 自己生成的 context package，不碰全局键盘监听。

范围：

- Context Passport / Ask / Day Pilot / Relationship Radar / Decision Time Machine / Memory Lens 的 `copy/export/inject` 统一走 egress preflight。
- 支持目标平台选择：`ChatGPT`、`Claude`、`Codex`、`OpenClaw`、`豆包`、`Gemini`、`Unknown AI`。
- 支持基础风险扫描：secret、internal URL、meeting URL、email、person names、raw transcript、one-on-one、unconfirmed inference、prompt injection pattern。
- 支持生成 safe context。
- 支持 egress receipt。
- UI 是 modal/panel，不新增一级页面。

成功标准：

- 用户点击复制时能看到“将外发内容”和“安全版本”。
- 高风险字段默认不进入安全版本。
- receipt 能回查来源和目标。

### P1：外部 AI 输入框旁的 Send Guard

范围：

- content script 支持 ChatGPT、Claude、Codex Web、豆包、Gemini、NotebookLM 的输入框检测。
- 当用户粘贴 Personal AI package 或包含高风险信号时显示 chip。
- 用户点击 chip 后本地分析当前输入框内容。
- 支持把当前输入框替换为 safe version，但不自动发送。
- 支持站点级静默和目标 trust profile。

成功标准：

- 在支持站点粘贴内部 Jira/meeting/person context 时能可靠提示。
- 用户能一键替换为安全版。
- 不影响普通聊天输入。

### P2：MCP / Desktop 出站边界

范围：

- Provider Context Service 接入 egress policy。
- MCP/API 读取记忆时必须声明 target/purpose。
- Desktop App 追踪 Personal AI context package hash 的剪贴板流向。
- 支持本地 AI / 公司内网 AI / 消费级 AI 不同策略。
- 支持自动过期、撤销、receipt review。

成功标准：

- Codex/Claude Code/Cursor/OpenClaw 读取 Personal AI 记忆时有统一审计。
- 用户可以回查最近 30 天外发给各 AI 的上下文。
- 高敏记忆默认只返回 local ref 或 safe summary。

## 技术实现建议

### 前端集成点

- `src/services/MemoryServiceClient.ts`
  - 新增 `checkEgress(payload)`、`createEgressReceipt(payload)`。
- `src/services/ProviderContextService` 或 memory-service 对应路由
  - 所有 provider context package 生成后进入 egress preflight。
- `src/composer-guard/ComposerGuardController.ts`
  - 复用输入框检测、sendable 校验和低打扰 UI 的经验。
- `src/contentScriptWebIntelligence.ts`
  - 复用网页来源、敏感页跳过、bubble 注入能力。
- `static/options.css` / existing modal system
  - 增加 Egress Preflight panel 样式。

### 后端服务

新增 `memory-service/src/core/EgressFirewallService.ts`：

职责：

- normalize target provider；
- collect provenance from memory refs；
- run deterministic scanners；
- call optional local/in-house LLM classifier；
- generate safe context；
- create receipt；
- expose explanation for UI。

新增 routes：

- `POST /api/v1/egress/check`
- `POST /api/v1/egress/safe-context`
- `POST /api/v1/egress/receipts`
- `GET /api/v1/egress/receipts?targetProvider=&limit=`
- `POST /api/v1/egress/policies`

### 数据表

```sql
CREATE TABLE egress_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  target_provider TEXT NOT NULL,
  target_trust_profile_id TEXT,
  action TEXT NOT NULL,
  user_intent TEXT NOT NULL DEFAULT '',
  raw_text_hash TEXT NOT NULL,
  safe_text_hash TEXT,
  decision TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE egress_risk_items (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  source_ref_json TEXT,
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  replacement_text TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(event_id) REFERENCES egress_events(id)
);

CREATE TABLE egress_provider_profiles (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  data_boundary TEXT NOT NULL,
  default_policy TEXT NOT NULL,
  supports_audit_receipt INTEGER NOT NULL DEFAULT 0,
  supports_mcp_scoped_read INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

CREATE TABLE egress_user_rules (
  id TEXT PRIMARY KEY,
  rule_scope TEXT NOT NULL,
  target_provider TEXT,
  source_kind TEXT,
  risk_kind TEXT,
  decision TEXT NOT NULL,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Scanner 设计

第一版不需要复杂模型，先做可解释规则：

- `SecretScanner`
  - OpenAI/GitHub/Slack/RingCentral token pattern；
  - JWT-like string；
  - `.env` key-value；
  - password/OTP words。
- `InternalUrlScanner`
  - `jira.ringcentral.com`；
  - `git.ringcentral.com`；
  - `docs.google.com` with internal sharing hint；
  - RingCentral meeting join links。
- `PersonalContextScanner`
  - 1:1 group；
  - relationship/person card；
  - inferred profile item；
  - private source type。
- `PromptInjectionScanner`
  - ignore/override previous/system instructions；
  - exfiltrate/send/upload/click/fetch private data；
  - hidden HTML or comments；
  - tool poisoning phrases in MCP tool descriptions。
- `ContextMinimalityScanner`
  - token budget too high；
  - unrelated memory refs；
  - raw transcript instead of summary。

第二版再加 LLM classifier：

- 输入必须先脱敏；
- 输出 structured risk items；
- 不把完整私有原文发给外部模型；
- 高风险判断必须能被 deterministic evidence 支撑，否则只作为 `suggested_review`。

## 与现有方案的边界

| 能力 | 主对象 | Egress Firewall 的边界 |
|---|---|---|
| AI Context Passport | 生成跨 AI 上下文包 | Firewall 是 Passport 的最后出站审查层 |
| Memory Lens | 当前页面相关记忆提示 | Lens 不外发；如用户要复制/交给 AI，进入 Firewall |
| Memory Day Pilot | 全天 mission 编排 | Day Pilot 的 mission context pack 外发前走 Firewall |
| Relationship Radar | 人际上下文卡 | 人际推断/1:1 证据默认由 Firewall 脱敏或阻止 |
| Decision Time Machine | 决策证据链 | 决策 replay pack 外发前去掉敏感证据和旧链接 |
| Operation Flight Recorder | 操作 episode | episode 转 skill/context 时由 Firewall 控制外发字段 |
| Personal Skill Foundry | skill 真源和平台同步 | skill 安装到外部 agent 前由 Firewall 检查脚本、secret、内部链接 |
| Memory Trust Console | 全局记忆质量和隐私治理 | Console 可做后台治理；Firewall 是出站边界的即时 UX |
| Memory Reality Check | AI 输出后的事实核验 | Firewall 是 AI 输入前的出站预检 |
| Compose Assist | 输入框写作和发送辅助 | Compose 生成的文本若包含记忆/敏感来源，可调用 Firewall |

## 竞品对比

| 产品/方向 | 类似点 | 不足 | Personal AI 机会 |
|---|---|---|---|
| Microsoft Purview DLP / DSPM for AI | AI prompt DLP、分类、审计、阻止第三方 AI 泄露 | 企业管理员视角，策略重，个人用户不易理解 | 做个人可审阅的 safe context、receipt、按目标 AI 的轻量决策 |
| OpenAI / Claude Memory controls | 用户可管理平台记忆 | 只管平台内部，不知道用户跨 RingCentral/Jira/会议复制了什么 | Personal AI 做跨平台记忆边界 |
| MCP security best practices | 工具调用可见、人类确认、scope minimization | 是协议/开发者实践，不是终端用户体验 | 把 MCP 读取 Personal AI 记忆纳入统一出站策略 |
| Prompt Shields / AI Gateway / Lakera 类 guardrail | 检测 prompt injection / data leakage | 多面向应用开发者或企业网关，通常不知道用户的 memory provenance | 利用 Personal AI 的来源、关系、证据和用户意图做更准判断 |
| Supermemory / Mem0 类跨 AI memory | 让多个 AI 共用记忆 | 共享越顺滑越需要出站控制 | Personal AI 在共享前提供 item-level policy 和 receipt |
| 普通剪贴板 DLP | 能识别敏感字符串 | 不懂“这条记忆来自哪里、是否可摘要、对哪个 AI 可发” | 结合 memory metadata 和目标 provider profile，生成可用安全版本 |

## 隐私与安全

### 默认安全边界

- Raw memory 不默认外发。
- 1:1 私聊、会议 join URL、token、内部链接、高敏个人信息默认不进入外部 prompt。
- 未确认推断不作为事实外发。
- 不可信网页内容和私有记忆默认隔离。
- 任何外部 AI 注入都不自动点击发送。

### Receipt 策略

记录：

- 时间、目标、surface、用户选择；
- raw/safe hash；
- 风险项和 redaction summary；
- 来源 memory refs；
- 过期时间。

默认不重复保存完整 raw 外发文本，避免形成新的敏感副本。

### 防止“安全幻觉”

UI 文案应避免“已完全安全”。使用：

- `Safe version generated`
- `High-risk fields removed`
- `Review recommended`
- `Cannot verify provider policy`

并在高风险场景说明：这是辅助判断，用户仍拥有最终外发权。

## 验证计划

### 单元测试

- secret scanner fixture；
- internal URL scanner fixture；
- meeting URL scanner fixture；
- prompt injection scanner fixture；
- provenance policy matrix；
- target trust profile decision matrix；
- safe context generation snapshot。

### 集成测试

- Context Passport copy → egress check → safe version → receipt。
- Relationship card with 1:1 evidence → safe summary only。
- Jira context package with meeting URL → URL removed。
- Untrusted webpage + private memory → blocked unless separated。
- Skill export with script/env vars → warns and redacts。

### E2E

- Playwright extension test on fixture ChatGPT-like page。
- Paste internal Jira context into textarea → chip appears。
- Click `Generate safe version` → textarea replacement preview。
- Confirm no auto-send。

### 真实数据 dogfood

只读选择近期真实样例：

- `Bug - AI 先修一遍我再看`；
- `MTR-148213` Jira comment；
- Nova/Sophia/Story Points 相关上下文；
- Codex/OpenAI API 相关聊天。

人工检查：

- 是否保留任务可完成信息；
- 是否正确移除内部链接和 meeting URL；
- 是否避免把 1:1 私聊原文发给外部 AI；
- 是否没有过度误杀。

## 风险与缓解

| 风险 | 表现 | 缓解 |
|---|---|---|
| 过度打扰 | 用户觉得每次复制都弹窗 | 只在出站边界、高风险、Personal AI package、支持 AI 站点触发；Clean 状态静默 |
| 误杀太多 | 安全版本信息不足，AI 完不成任务 | 给出“为什么删”和“允许一次”；支持按目标平台保存细粒度例外 |
| 虚假安全感 | 用户以为 safe version 绝对安全 | 文案使用“reduced risk”，保留人工最终确认 |
| DOM 不稳定 | 外部 AI 输入框识别失败 | P0 先从 Personal AI copy/export 做起；P1 外部站点用 adapter + fallback |
| 分类器泄露 | 为判断风险反而把原文发给外部模型 | 规则优先；LLM classifier 只用本地/内网或脱敏片段 |
| receipt 变敏感副本 | 审计日志保存过多原文 | 默认保存 hash + diff summary；全文保存需用户明确开启 |
| 用户绕过 | 用户手动复制原文 | 不做强控制；通过低摩擦 safe version 和可用性降低绕过动机 |

## 开发切片建议

### Slice 1：Egress Check API + 规则扫描

- 新增 `EgressFirewallService`。
- 支持纯文本输入、target provider、source refs。
- 返回 risk items 和 suggested safe text。
- 单元测试覆盖主要风险。

### Slice 2：Context Package Copy Preflight

- 在现有 copy/export 入口前接入。
- 做一个复用 modal。
- 支持 `复制安全版` 和 `允许一次`。
- 写入 receipt。

### Slice 3：外部 AI Composer Guard Fixture

- 建一个本地 fixture 页面模拟 ChatGPT/Codex 输入框。
- content script 检测 paste/draft。
- 低打扰 chip + panel。

### Slice 4：Provider/MCP 接入

- `ProviderContextService` 请求记忆时必须带 target/purpose。
- 返回 safe summary / local ref / blocked reason。
- receipt 能按 provider 查看。

## 关键开放问题

1. 目标 provider trust profile 应该由用户手动配置，还是先内置默认表？
2. ChatGPT Team / Enterprise、Claude Team / Enterprise、Codex、豆包等平台策略变化如何更新？
3. `internal_url` 是否一律 redacted，还是对 OpenClaw/internal agent 放行？
4. 个人关系上下文是否允许以角色摘要外发？
5. 是否需要一个“本地 AI / 内网 AI”高信任目标，供敏感任务使用？
6. receipt 保留多久，是否跟 context package TTL 一致？
7. P1 外部 AI 输入框检测是否只在 allowlist 站点启用，避免用户隐私焦虑？

## 结论建议

建议推进 **Memory Egress Firewall** 的 P0 设计验证。

原因：

- 它贴合 Personal AI 的核心目标：记忆不仅要能被召回，还要能安全地流向聊天、会议和其他 AI。
- 它解决的是用户真实高频动作：复制/粘贴上下文给外部 AI。
- 它能复用现有 Context Passport、Memory Lens、Provider Context、Composer Guard、Memory metadata。
- 它比 Trust Console 更小、更可落地；比 Reality Check 更前置；比单纯 redaction 更懂 memory provenance。
- 它会让用户更敢用 Personal AI，而不是因为“记忆太多会泄露”反而不敢复制。

如果要做 MVP，不要先做全局 DLP 或企业策略台。先把 Personal AI 自己生成的 context package 外发前变成：

1. 看得见将要发什么；
2. 自动生成安全版本；
3. 记录 receipt；
4. 不自动发送。

这四件事做稳，Personal AI 的跨 AI 记忆能力就会更可信。
