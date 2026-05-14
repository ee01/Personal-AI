# 新能力：AI Session Context Drift Radar / AI 会话上下文漂移雷达

> 生成日期：2026-05-13 CST  
> Codex 会话标题建议：新能力：AI 会话上下文漂移雷达  
> 交付物：功能计划 + 可预览 Demo  
> Demo：[`ai-session-context-drift-radar-demo.html`](./ai-session-context-drift-radar-demo.html)

## 结论

建议设计一个新的 Personal AI 能力：**AI Session Context Drift Radar / AI 会话上下文漂移雷达**。

它不是再做一个“上下文包导出器”。`AI Context Passport` 已经解决“把一件事的上下文交给 ChatGPT / Claude / Codex / 豆包 / Cursor / OpenClaw”。本能力解决的是下一步更真实的问题：

> 上下文交出去以后，外部 AI 会话还在继续跑，但用户的真实世界已经变了。

用户在 RingCentral、会议、Jira、日历、网页、Codex、豆包、ChatGPT、OpenClaw 里持续产生新记忆。任何一个已经开着的 AI 会话、后台 coding agent、长对话或生成中的方案，都可能仍然基于旧前提工作。Context Drift Radar 负责：

- 记录每个 AI 会话“知道了什么上下文”。
- 监控新的记忆、会议、消息、Jira、网页和操作证据是否影响这些会话。
- 判断变化是 `补充信息`、`事实变更`、`冲突`、`隐私风险`、`任务范围变化` 还是 `不必打扰`。
- 给用户生成一个最小、可审阅、可复制/注入的 **Context Patch**。
- 在目标 AI 会话旁提示“这条会话的上下文已经漂移”，但不默认自动发送。

一句话价值：

> Personal AI 不只把记忆带给别的 AI，还要在记忆变化时提醒“这个 AI 现在可能已经拿着旧地图在工作”，并给出可控的上下文补丁。

## 本次输入信号

### Reminders 检查

本机 Reminders 当前可见列表包括：

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

没有发现名为 `Personal AI` 的列表，因此本次没有从 Reminder item 随机抽取全新 idea，也没有需要标记 done 或写备注的 Reminder item。

### 真实记忆信号

按要求连接 `10.32.56.212` 查询 `esone.qiu` 用户记忆。本次 `http://10.32.56.212:3210/health` 可达但返回 `degraded`，数据库状态显示 `connected:false`。随后通过 SSH 对远端 `memory-service/data/users/esone.qiu/memory.db` 做只读查询，没有写入远端数据。

读到的关键轮廓：

- `messages_raw` 主要来自工作消息、`doubao_chat`、`ringcentral_indexeddb`、`chatgpt`，说明用户已经有跨聊天、AI 对话和日历的数据源。
- `chunks` 里包含 `glip`、`reflection_thread`、`daily_log`、`meeting`、`calendar`、`jira`、`user_core` 等来源，说明记忆系统已经不是单一聊天库。
- 高频真实场景包括 RingCentral / Glip、会议、Jira、AI Notes、SDK / Nova / RCV / Mobile、AI 工具选型和成本管理。
- 用户有活跃的 AI 相关群组和日常：`AI Tools for Engineering - Workgroup`、`AI Relevant Scrum Masters`、`CoP - 基于AI的个人发展和工具`、Codex / Claude Code / Cursor / Factory.ai / OpenClaw 讨论。
- `proposed_actions` 中多次出现 `delegate_openclaw` 成功或失败、外部查证、Glip 状态自动化、需要确认的恢复动作，说明系统已经开始把记忆转成行动，但外部 agent 能力和会话状态并不稳定。
- `personal_skills` 已有 active / suggestion / dismissed 状态，说明用户不只需要事实记忆，也需要“某个 AI 会话或 agent 当前应该遵守哪些做法”的过程性上下文。
- 最新 reflection 提到项目管理、SDK planning、AI 生成代码可维护性、AI 工具成本和 policy 变化。这些都是上下文容易过期的主题。

这些信号共同指向一个产品空位：

> 用户已经进入“多 AI、多会议、多工作流同时推进”的状态。现在缺的不是一次性把上下文塞给 AI，而是持续知道每个 AI 会话的上下文有没有变旧、变错、变敏感。

## 为什么值得做

Personal AI 的目标是留存用户与 AI、网页、消息、会议、操作、偏好、skill 等所有记忆，并在聊天、会议、其他 AI 对话等场景提供记忆关联提示。

现有 progressing 方案已经覆盖了很多基础能力：

| 已有方案 | 主对象 | 本能力的边界 |
|---|---|---|
| AI Context Passport | 一次性上下文交接包 | Drift Radar 跟踪交接后的上下文变化和补丁 |
| Operation Memory Flight Recorder | 跨工具操作 episode | Drift Radar 可消费操作结论，但不记录全量操作 |
| Personal Skill Foundry | 可复用 skill 生命周期 | Drift Radar 可以提示某会话缺少某 skill，不管理 skill |
| Memory Trust Console | 记忆质量、隐私、stale 治理 | Drift Radar 只处理“某 AI 会话是否受影响”的局部漂移 |
| Memory Day Pilot | 当天 mission 编排 | Drift Radar 处理活跃 AI 会话的实时上下文补丁 |
| Agent Memory Control Tower | 多 agent 分派和监控 | Drift Radar 不调度 agent，只维护会话上下文一致性 |
| Relationship Memory Radar | 人际上下文 | Drift Radar 可补充人物/关系变化，但不做人际 CRM |

真实痛点是：

1. **外部 AI 会话不知道新事实**
   - 早上把一段 Jira/会议上下文给 Codex，下午 RingCentral 里 owner 或 scope 变了。
   - Codex 继续基于旧目标实现，用户晚上才发现方向错了。

2. **不同 AI 拿到的上下文版本不同**
   - ChatGPT 帮写沟通稿，Claude Code 做 review，豆包保存随手记，Codex 修代码。
   - 每个 AI 都“记得一点”，但没有一个地方知道谁现在拿着哪版上下文。

3. **过期上下文会比缺失上下文更危险**
   - AI 不知道某事实时会问；AI 以为自己知道时会自信地继续错。
   - 对 Jira、release policy、AI tool cost、人员 owner、会议结论尤其危险。

4. **补上下文的动作太重**
   - 用户需要重新找消息、会议、网页、旧对话，然后手动解释“刚刚有变化”。
   - 结果是用户要么不补，要么把太多原文丢给 AI，造成 token 噪音和隐私风险。

5. **Personal AI 的记忆优势没有变成“会话级安全感”**
   - 只要能搜，不代表当前 AI 会话用的是对的上下文。
   - 用户真正需要的是“这个会话仍然可继续吗？要不要先打一个补丁？”

Context Drift Radar 的价值是把“记忆库持续变化”转成用户可理解的会话状态：

- 这个 AI 会话：上下文健康。
- 这个 AI 会话：有新证据可选补。
- 这个 AI 会话：关键事实冲突，继续前建议先 patch。
- 这个 AI 会话：涉及敏感记忆，不建议外发。
- 这个 AI 会话：缺少用户偏好/skill，输出可能不稳定。

## 行业观察与竞品参考

### ChatGPT Memory：平台内记忆变强，但跨工具会话仍是孤岛

OpenAI Help Center 说明 ChatGPT memory 分为 saved memories 和 chat history；saved memories 适合保持 top-of-mind 的信息，chat history 可引用过去对话但不会保留所有细节。参考：[What is Memory?](https://help.openai.com/en/articles/8983136-what-is-memory)。

启发：

- 记忆平台正在从“用户手写偏好”走向“历史对话自动参与回答”。
- 但这仍主要发生在 ChatGPT 内部。ChatGPT 不知道 Claude、Codex、豆包、RingCentral 和本地 Personal AI 哪些事实刚刚变化。
- Personal AI 的机会是做跨平台的会话上下文账本。

### Claude Memory Tool / Context Editing：长任务需要外部记忆和上下文修剪

Claude Memory Tool 允许 Claude 在跨会话的 memory file directory 中读写持久信息。参考：[Claude Memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)。

Claude Context Editing 则说明 agentic workflow 里需要清理旧 tool results / thinking blocks，并能在 response 中看到 context management 统计。参考：[Claude Context editing](https://platform.claude.com/docs/en/build-with-claude/context-editing)。

启发：

- 主流 agent 平台已经承认“上下文不是越多越好”，需要管理、清理和持久化。
- 但这些机制是单平台 runtime 内部能力。Personal AI 可以把“哪个外部 AI 会话现在该被补什么上下文”做成用户可见的 UX。

### Anthropic Context Engineering：高信号、最小上下文是 agent 可靠性的核心

Anthropic 的工程文章把 context engineering 定义为管理 LLM inference 时进入上下文窗口的信息集合，并强调 context 是有限资源；好上下文工程要找到最小但高信号的 token 集合。参考：[Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)。

启发：

- Context Patch 不应该把所有新记忆都复制给目标 AI。
- 设计重点应该是“最小补丁”：发生了什么变化、影响哪个假设、需要 AI 改什么、证据在哪里。

### Granola MCP：会议上下文会流向 Claude / ChatGPT / Cursor

Granola MCP 的产品文案直接描述了一个典型场景：用户在 Claude、ChatGPT、Cursor 工作时想起“上周会议聊过这个”，MCP 让会议上下文能被 AI 工具访问。参考：[Introducing Granola MCP](https://www.granola.ai/blog/granola-mcp)。

启发：

- 跨 AI 获取外部上下文已经成为真实需求。
- 但 Granola 主要回答“帮我取会议内容”。Personal AI 可以进一步回答“你给这个 AI 的会议上下文已经过期了吗？”

### Codex / Cursor / Copilot：后台 agent 让上下文漂移更危险

OpenAI Codex cloud 可以在后台并行执行任务，并在自己的 cloud environment 中工作。参考：[Codex web docs](https://developers.openai.com/codex/cloud)。

VS Code / GitHub Copilot Memory 文档把记忆分成 user / repository / session，并特别提到 Copilot Memory 会在使用前 against current codebase 验证，且自动过期，避免 stale 或不正确记忆影响结果。参考：[Memory in VS Code agents](https://code.visualstudio.com/docs/copilot/agents/memory)。

OpenAI 的 Codex 安全文章强调 bounded environment、高风险动作显式 review、agent-native telemetry 和 logs。参考：[Running Codex safely at OpenAI](https://openai.com/index/running-codex-safely/)。

启发：

- 后台 agent 越多，越需要知道它们的上下文是否仍然有效。
- “使用前验证”和“自动过期”应该成为 Context Patch 的默认策略。
- Drift Radar 可以把 agent telemetry / run receipt 接入 Personal AI，但 MVP 不需要直接调度这些 agent。

### Zep / Graphiti：时态知识图谱适合处理动态事实

Zep 的论文提出用 Graphiti temporal knowledge graph 处理 agent memory，强调在非结构化对话和结构化业务数据中维护历史关系。参考：[Zep: A Temporal Knowledge Graph Architecture for Agent Memory](https://arxiv.org/abs/2501.13956)。

启发：

- Context drift 不是简单“时间久了就过期”，而是某个事实、关系、owner、deadline、policy 出现了新版本。
- Personal AI 已有 entity / property / truth maintainer 基础，适合加一层“会话使用了哪个事实版本”的账本。

## 相关论文和技术依据

### A-MEM：记忆需要动态组织和链接

[A-MEM: Agentic Memory for LLM Agents](https://arxiv.org/abs/2502.12110) 借鉴 Zettelkasten，让新记忆带 contextual descriptions、keywords、tags，并动态链接到既有记忆网络。

对本方案的启发：

- 新记忆进来时，不只要入库，还要检查它和哪些活跃 AI session 的上下文 seed 相关。
- Context Patch 应该携带“影响的旧假设”和“新的证据链接”，而不是只给摘要。

### AgeMem：记忆操作应成为 agent 策略的一部分

[Agentic Memory: Learning Unified Long-Term and Short-Term Memory Management for Large Language Model Agents](https://arxiv.org/abs/2601.01885) 把存储、检索、更新、总结、丢弃等操作暴露为 tool-based actions，让 agent 自主决定何时管理长期/短期记忆。

对本方案的启发：

- Personal AI 可以先用 rule + retrieval 做 patch 候选，未来让 agent 自己判断“这个会话是否需要补丁”。
- 但写入/外发仍必须保留用户审核，因为目标是私人记忆中枢而不是黑箱自动同步。

### Agentic Context Engineering：上下文会随执行反馈持续演化

[Agentic Context Engineering](https://arxiv.org/abs/2510.04618) 把 context 看作会演化的 playbook，通过生成、反思和策展逐步更新，并强调避免 context collapse 和细节流失。

对本方案的启发：

- Context Patch 不只是一次提醒，还会形成 session-level context ledger。
- 用户接受、编辑、拒绝某个 patch 后，这个反馈会反哺下一次 patch 策略。

### Context Rot：长上下文不是万能解

Chroma 的 [Context Rot](https://www.trychroma.com/research/context-rot) 技术报告测试多个模型，指出模型在输入变长时表现会变得不稳定，相关 distractors 会放大问题。

对本方案的启发：

- 不能把“全量上下文更新”当作默认补丁。
- UI 需要支持 `brief patch`、`evidence patch`、`do not send raw evidence` 三种模式。

## 功能定义

### 什么是 AI Session

AI Session 是 Personal AI 能识别的一段外部或内部 AI 工作上下文：

- ChatGPT / Claude / Gemini / 豆包网页对话。
- Codex web / Codex app / Codex CLI 会话。
- Cursor Background Agent / GitHub Copilot agent / Claude Code subagent。
- OpenClaw delegated task。
- Personal AI 自己生成的 Context Passport 使用记录。

MVP 不要求全部自动抓取。可以分三种 session 来源：

1. **Observed session**
   - 浏览器内容脚本或 Desktop App explorer 能读到页面标题、输入内容摘要、最后一次 context injection 记录。

2. **Declared session**
   - 用户点击 `Attach to current AI` 或 `Build Passport` 后创建 session record。

3. **Imported session**
   - 从 Codex / OpenClaw / ChatGPT / 豆包 explorer 抓取历史对话后创建。

### 什么是 Context Contract

当 Personal AI 把上下文给某个 AI session 时，保存一份轻量账本：

```ts
interface AiSessionContextContract {
  id: string;
  sessionId: string;
  targetSurface: 'chatgpt' | 'claude' | 'doubao' | 'codex' | 'cursor' | 'openclaw' | 'copilot' | 'other';
  mission: string;
  generatedAt: number;
  usedAt?: number;
  scope: 'work' | 'personal' | 'both';
  status: 'active' | 'stale' | 'superseded' | 'closed';
  includedMemoryRefs: ContextMemoryRef[];
  includedEntityFacts: ContextFactRef[];
  includedSkills: ContextSkillRef[];
  assumptions: ContextAssumption[];
  outputContract?: string;
  privacyEnvelope: ContextPrivacyEnvelope;
  freshnessPolicy: ContextFreshnessPolicy;
}
```

它回答：

- 这个 AI 被告知的任务是什么？
- 它拿到了哪些记忆、哪些事实版本、哪些 skill、哪些约束？
- 哪些内容被排除，因为敏感或无关？
- 什么时候应该检查是否过期？

### 什么是 Context Drift

Context Drift 是某个 active session 的 context contract 和新进入记忆之间的影响关系。

```ts
type ContextDriftKind =
  | 'new_relevant_evidence'
  | 'fact_changed'
  | 'fact_conflict'
  | 'owner_or_deadline_changed'
  | 'skill_updated'
  | 'privacy_boundary_changed'
  | 'task_scope_changed'
  | 'target_context_too_old'
  | 'low_confidence_noise';

interface ContextDriftCandidate {
  id: string;
  sessionId: string;
  contractId: string;
  kind: ContextDriftKind;
  severity: 'info' | 'watch' | 'patch_recommended' | 'stop_before_continue';
  confidence: number;
  detectedAt: number;
  changedMemoryRefs: ContextMemoryRef[];
  affectedAssumptions: string[];
  recommendedPatchId?: string;
  reason: string;
  userState: 'unseen' | 'ignored' | 'patched' | 'snoozed' | 'resolved';
}
```

### 什么是 Context Patch

Context Patch 是给目标 AI 的最小上下文补丁，不是完整上下文包。

```ts
interface ContextPatch {
  id: string;
  sessionId: string;
  targetSurface: string;
  title: string;
  patchType: 'brief' | 'evidence_backed' | 'correction' | 'scope_update' | 'do_not_continue';
  bodyMarkdown: string;
  evidenceRefs: ContextMemoryRef[];
  excludedRefs: ContextMemoryRef[];
  risk: 'low' | 'medium' | 'high';
  requiresUserApproval: boolean;
  deliveryMode: 'copy' | 'inject_input' | 'mcp_tool' | 'openclaw_api' | 'codex_task_comment';
  status: 'draft' | 'approved' | 'delivered' | 'dismissed' | 'expired';
}
```

示例 patch：

```md
Context update for this task:

The earlier context said AI VBG BE delivery was expected by end of May. New RingCentral evidence on 2026-05-12 suggests the BE completion status is still unverified and needs external confirmation.

Please do not assume BE is complete. Before proposing timeline or Jira comments, treat this as an open question:
- Verify owner/source of truth for BE completion.
- Separate confirmed facts from assumptions.
- If outputting a plan, mark this dependency as "needs confirmation".

Evidence available in Personal AI:
- RingCentral memory, 2026-05-12, AI VBG BE follow-up
- Reflection action: delegate_openclaw failed due to missing capability
```

## 核心体验

### 体验 1：AI 输入框旁的 Drift Chip

当用户在 ChatGPT / Claude / 豆包 / Codex / Cursor web 页面聚焦输入框时，Personal AI 显示轻量 chip：

- `Context current`
- `2 updates available`
- `Patch before continue`
- `Sensitive update - review`

点击后打开 Patch Preview。

默认不自动塞入，不自动发送。

### 体验 2：Patch Preview

Patch Preview 不是长文摘要，而是一个决策面板：

- 左上：目标 AI session 和当前 mission。
- 中间：新变化影响了哪些旧假设。
- 右侧：patch 正文，可切换 `Brief` / `Evidence-backed` / `Correction only`。
- 底部：证据清单和隐私闸门。
- 主动作：`Copy patch`、`Inject to input`、`Dismiss for this session`、`Open in Radar`。

高风险 patch 必须显示：

- 会发给哪个平台。
- 包含哪些来源。
- 排除了哪些敏感证据。
- 为什么建议先补丁再继续。

### 体验 3：Context Drift Radar 页面

新的 `memory-exploring.html#/ai-sessions` 页面或 Desktop App 页面。

结构：

- 左列：活跃 AI sessions。
  - ChatGPT 方案写作、Codex bug fix、豆包随手记同步、OpenClaw 外部查证。
  - 每条显示 drift score、最后 patch 时间、目标平台、任务状态。

- 中列：当前 session 的 context contract。
  - Mission、included memories、assumptions、skills、privacy envelope。
  - 以“AI 已知道 / Personal AI 新知道 / 不应外发”三段显示。

- 右列：Context patches。
  - Draft patch、blocked patch、delivered patch、dismissed patch。
  - 可以查看 diff：旧假设 -> 新证据 -> 建议指令。

- 底部：Patch ledger。
  - 记录每一次复制、注入、OpenClaw API 投递、用户拒绝和后续效果。

### 体验 4：AI Context Passport 的后续状态

Passport 生成后进入一个生命周期：

1. `ready`：用户还没使用。
2. `used`：已注入某个 AI session，创建 context contract。
3. `watched`：Drift Radar 开始监听相关 memory deltas。
4. `patch_available`：出现影响这个 session 的变化。
5. `patched`：用户已投递补丁。
6. `closed`：用户结束任务或 session 长时间无活动。

这样 Passport 不再是一次性文件，而是可追踪的上下文承诺。

### 体验 5：低打扰策略

不是所有变化都打扰用户。

打扰等级：

| 等级 | 展示方式 | 示例 |
|---|---|---|
| `silent` | 只写 ledger | 新增弱相关背景资料 |
| `badge` | 页面 chip 数字 | 会议补充了非关键证据 |
| `toast` | 轻通知，可忽略 | 输出格式偏好或 skill 更新 |
| `blocker` | 继续前建议 patch | owner/deadline/policy 变更 |
| `sensitive` | 必须审阅 | 涉及个人/公司敏感内容外发 |

## 设计原则

1. **补丁优先，不重发全量上下文**
   - 目标 AI 已经知道的内容不重复发。
   - 只表达“变了什么、影响什么、下一步怎么处理”。

2. **事实变化优先于相关性**
   - 新证据只是“更多背景”时不打扰。
   - 新证据推翻旧假设、改变 owner/deadline/status/policy 时才升级。

3. **用户拥有最终外发权**
   - Personal AI 可以生成 patch，但不能默认把私人记忆发到外部 AI。
   - 对 OpenClaw 这类已授权接口也保留风险 gating。

4. **每个 patch 都要能解释**
   - 为什么这个 session 受影响？
   - 哪个旧假设被影响？
   - 新证据来自哪里？
   - 为什么不是噪音？

5. **不要创造又一个 inbox 噪音源**
   - 只跟踪 active sessions。
   - session 过期后自动归档。
   - 低置信变化默认聚合到每日 brief，而不是即时推送。

## 技术方案

### 数据表

新增表：

```sql
CREATE TABLE ai_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  target_surface TEXT NOT NULL,
  external_session_ref TEXT,
  title TEXT NOT NULL,
  mission TEXT,
  source_kind TEXT NOT NULL,
  source_ref_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_observed_at INTEGER,
  last_user_activity_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE ai_session_context_contracts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  passport_id TEXT,
  scope TEXT NOT NULL DEFAULT 'work',
  contract_json TEXT NOT NULL,
  privacy_envelope_json TEXT NOT NULL,
  freshness_policy_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  generated_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE ai_session_drift_candidates (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence REAL NOT NULL,
  reason TEXT NOT NULL,
  affected_assumptions_json TEXT NOT NULL,
  changed_refs_json TEXT NOT NULL,
  user_state TEXT NOT NULL DEFAULT 'unseen',
  detected_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE ai_session_context_patches (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  drift_id TEXT,
  target_surface TEXT NOT NULL,
  title TEXT NOT NULL,
  patch_type TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  excluded_refs_json TEXT NOT NULL,
  risk TEXT NOT NULL DEFAULT 'low',
  delivery_mode TEXT NOT NULL DEFAULT 'copy',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  delivered_at INTEGER
);

CREATE TABLE ai_session_patch_events (
  id TEXT PRIMARY KEY,
  patch_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_json TEXT,
  created_at INTEGER NOT NULL
);
```

### 后端服务

新增 `AiSessionService`：

- `createSessionFromPassport(passport, targetSurface)`
- `registerContextContract(sessionId, contract)`
- `scanDriftForNewMemory(memoryRef)`
- `scanDriftForSession(sessionId)`
- `generateContextPatch(driftCandidate, mode)`
- `recordPatchDelivery(patchId, event)`
- `closeInactiveSessions()`

新增 `ContextDriftScanner`：

1. 新 memory/chunk/entity/property/skill 进入后触发低成本 scan。
2. 用 entity refs / topic refs / project refs / source refs 找到候选 session。
3. 对候选做 `impact scoring`：
   - 旧 contract 是否包含同 entity/property。
   - 新证据是否更新 owner/status/deadline/policy。
   - 新证据是否和旧假设冲突。
   - session 最近是否活跃。
   - target surface 是否外部平台。
   - privacy envelope 是否允许外发。
4. 生成 drift candidate。
5. 达到阈值时生成 patch draft，否则只写 ledger。

### API

```http
GET /api/v1/ai-sessions?status=active
POST /api/v1/ai-sessions
GET /api/v1/ai-sessions/:id
POST /api/v1/ai-sessions/:id/contracts
POST /api/v1/ai-sessions/:id/scan-drift
GET /api/v1/ai-sessions/:id/drifts
POST /api/v1/ai-session-drifts/:id/patches
POST /api/v1/ai-session-patches/:id/approve
POST /api/v1/ai-session-patches/:id/dismiss
POST /api/v1/ai-session-patches/:id/delivered
POST /api/v1/ai-sessions/:id/close
```

### 前端入口

1. `memory-exploring.html#/ai-sessions`
   - Radar 主页面。

2. Content Script chip
   - ChatGPT / Claude / Gemini / 豆包 / Codex web / Cursor web 等页面输入框旁。
   - MVP 先支持 ChatGPT + 豆包 + Codex web，因为项目已有 ChatGPT/豆包 explorer 和 Codex 使用信号。

3. Desktop App
   - 在 explorer 和 provider settings 里显示 observed sessions。
   - 对无法自动注入的平台，只提供 copy patch。

4. Context Passport integration
   - Passport `used` 时自动创建 session contract。
   - Passport `stale` 时不再只是状态，而是可进入 Drift Radar。

### 与现有系统复用关系

- `Memory Service /recall`：生成 patch evidence 时拉取相关 evidence。
- `TruthMaintainer` / `entity_properties`：判断 fact changed / fact conflict。
- `memory_metadata` / feedback：过滤低质量或低显著性证据。
- `personal_skills`：检测目标 session 缺少或使用了过期 skill。
- `provider_bindings`：记录目标平台能力和可注入方式。
- `confirm_requests`：高风险 patch 可以转成确认请求。
- `notification_records`：只用于 blocker/sensitive 级别提示。
- `day_pilot`：沉默级 drift 聚合进每日 brief。

## Drift Scoring

初始评分可解释，不需要一上来训练模型。

```ts
impact =
  0.30 * entityOverlap +
  0.20 * propertyChange +
  0.15 * assumptionOverlap +
  0.10 * sourceTrust +
  0.10 * sessionRecency +
  0.10 * taskCriticality +
  0.05 * userPatternBoost
  - 0.20 * lowConfidencePenalty
  - 0.20 * privacyPenalty
```

升降级规则：

- `fact_conflict` 且影响 included assumptions：至少 `patch_recommended`。
- owner/deadline/status/policy 变化：至少 `watch`，如果 session 最近 24h 活跃则 `patch_recommended`。
- 涉及 sensitive source 且 target 是外部 AI：`sensitive`，必须审阅。
- 新证据只增加背景且 score < 0.55：`silent`。
- 同一 session 同一 entity 24h 内多次低风险变化：合并成一个 batch patch。

## MVP 范围

### MVP 做

- 基于 Context Passport 使用记录创建 AI session。
- 通过 Memory Service 新记忆 / entity property update 扫描 drift。
- 支持 ChatGPT / 豆包 / Codex web 的 copy/inject patch。
- 实现 `memory-exploring.html#/ai-sessions` Radar 页面。
- Patch Preview 支持 Brief / Evidence-backed 两种模式。
- 高风险内容需要用户确认，默认不外发原文。
- Patch delivery ledger 记录复制、注入、dismiss。

### MVP 不做

- 不自动控制所有外部 AI 平台。
- 不自动发送 ChatGPT/Claude/豆包消息。
- 不做多 agent 任务分派、merge、push、PR 创建。
- 不全量抓屏，不保存敏感 UI 截图。
- 不把所有 active browser tabs 都当 AI session。
- 不要求外部平台支持 MCP；MCP 只作为后续优化路径。

## 里程碑

### Phase 0：只读设计验证

- 定义 `AiSession`、`ContextContract`、`DriftCandidate`、`ContextPatch` schema。
- 用当前 `esone.qiu` 真实 memory DB 做 dry-run：
  - 选取过去 7 天的 AI/Jira/meeting/Glip 信号。
  - 人工构造 5 个 session contracts。
  - 评估 drift candidates 是否符合直觉。

### Phase 1：Passport 后续追踪

- `AI Context Passport` 使用后创建 session contract。
- Memory Service 新增只读 Radar API。
- 页面展示 active sessions 和 patch drafts。
- 只支持 copy patch，不做注入。

### Phase 2：Browser chip + patch preview

- 内容脚本识别 ChatGPT / 豆包 / Codex web 输入框。
- 显示 drift chip。
- 支持把 patch 插入当前输入框，但不自动发送。
- 记录 `delivered` / `dismissed` 事件。

### Phase 3：OpenClaw / Codex 集成

- OpenClaw 已授权任务可通过 API 附加 patch comment。
- Codex web/cloud 如果能识别 task URL，则生成任务 comment 或 follow-up prompt。
- 对 Codex CLI / local app，先生成 copy patch +本地 session ledger。

### Phase 4：学习用户偏好

- 从用户接受/编辑/拒绝 patch 学习阈值。
- 不同 target surface 有不同 patch 风格。
- 高频成功 patch 可沉淀到 Personal Skill Foundry。

## UX 细节

### Patch 文案格式

默认短格式：

```md
Context patch:

New evidence after the previous handoff changes one assumption:
- Previous assumption: <old>
- Update: <new>
- Please adjust: <instruction>

Evidence: <source + date + memory link>
```

Evidence-backed 格式：

```md
Context patch for <mission>:

What changed:
1. ...

Impacted assumption:
- ...

Please do:
- ...

Do not assume:
- ...

Evidence trail:
- ...
```

### 空态

Radar 页面空态不应该是“暂无数据”。更具体：

- `No watched AI sessions`
- 主动作：`Create from current Passport`
- 次动作：`Import recent AI conversations`
- 说明只用一句：`Context drift is only tracked after you hand context to an AI session.`

### 扰动控制

- 每个 session 可设置 `Watch for 2h / 24h / 7d / until closed`。
- 每个平台可设置默认 watch 时长。
- 每个 source 可设置 `never patch to external AI`。
- 用户 dismiss 后，同一 drift 不能反复弹。

### 可解释 badge

- `New evidence`
- `Fact changed`
- `Conflict`
- `Sensitive`
- `Skill updated`
- `Scope changed`
- `Expired`

## 竞品对比

| 产品/方向 | 做什么 | 缺口 | Personal AI 差异 |
|---|---|---|---|
| ChatGPT Memory | ChatGPT 内部个性化和历史引用 | 不知道其他 AI / RingCentral / Jira 的上下文状态 | 跨平台会话账本和补丁 |
| Claude Memory Tool | Claude 跨会话 memory files | Claude runtime 内部，不管理外部会话 | 面向用户的 session-level patch |
| Granola MCP | 让 AI 工具访问会议记录 | 取上下文，不判断已发上下文是否过期 | 监控已交付上下文的漂移 |
| Copilot Memory | repo scoped memory，使用前验证并自动过期 | 主要是 GitHub/Copilot repo 内 | 覆盖私人会议、消息、AI 对话和操作记忆 |
| Memento / Engram 类 memory layer | 多 AI 共享记忆底层 | 更偏 memory API，UX 弱 | 在真实页面旁提示和审阅 patch |
| Personal AI Context Passport | 构建可迁移上下文包 | 一次性交付后缺持续状态 | Drift Radar 是 Passport 的 watch layer |

## 风险与对策

### 风险 1：提示太多，变成新的通知噪音

对策：

- 只跟踪 active/watched sessions。
- 默认 24h 后归档低活动 session。
- `silent` / `badge` / `toast` / `blocker` 分级。
- 同一主题合并 patch。

### 风险 2：误判相关性，打断用户

对策：

- MVP 使用可解释规则，不让黑箱模型直接决定打断。
- Patch Preview 显示“为什么影响这个 session”。
- 用户 dismiss 反馈回写阈值。

### 风险 3：隐私外发

对策：

- 默认不发送原文。
- 外部 AI patch 使用摘要 + evidence label，用户可手动展开。
- 来源级策略：`local_only` / `can_summarize` / `can_quote` / `never_external`。
- 高风险 patch 进入 confirm request。

### 风险 4：目标平台注入不稳定

对策：

- 注入只是增强路径，MVP 先支持 copy。
- 每个平台 adapter 独立降级。
- 注入后仍不自动点击发送。

### 风险 5：和 Trust Console / Passport 重叠

对策：

- Trust Console 管全局记忆质量。
- Passport 管上下文包生成。
- Drift Radar 管某个 AI session 的上下文是否仍然有效。

## 成功指标

产品指标：

- Patch accept rate。
- Patch edit distance：用户需要改多少才能用。
- False positive dismiss rate。
- Stale-session prevented count：用户接受 blocker patch 后避免继续旧任务。
- Average patch length / evidence count。
- External raw evidence exposure rate，目标接近 0。

体验指标：

- 用户是否能在 10 秒内判断“这个 patch 值不值得发”。
- 用户是否愿意开启 `watch after passport handoff`。
- 被 dismiss 的 patch 是否不再重复出现。

工程指标：

- Drift scan p95 < 300ms for incremental memory event。
- Radar active sessions load p95 < 500ms。
- Patch generation p95 < 2s without LLM summary；< 8s with LLM evidence-backed mode。

## Demo

Demo 文件：

```text
docs/progressing/ai-session-context-drift-radar-demo.html
```

Demo 展示：

- 左侧活跃 AI sessions。
- 中间“AI 已知道 / Personal AI 新知道 / 不应外发”的 context diff。
- 右侧 Context Patch composer。
- 顶部 drift score 和 watch state。
- 可点击切换 ChatGPT / Codex / 豆包 / OpenClaw 示例。

## 结论建议

建议把 **AI 会话上下文漂移雷达** 作为 `AI Context Passport` 的后续能力，而不是独立孤岛。它非常贴合 Personal AI 的目标：

- 保存用户和 AI 的所有记忆。
- 在其他平台的 AI 对话中提供记忆关联提示。
- 把记忆从“能查”推进到“能保证当前 AI 会话不拿旧上下文继续错”。

这个能力的亮点不是炫技，而是非常实用：

> 当用户同时使用多个 AI 工具、多个会议和多个聊天线程时，Personal AI 能告诉用户：哪个 AI 需要补上下文，补什么，为什么补，以及哪些内容不能外发。

