# Memory Composer Guard：记忆写作护航

> 生成日期：2026-05-07 CST  
> 交付物：功能计划 + 可预览 Demo  
> Demo：[memory-composer-guard-demo.html](./memory-composer-guard-demo.html)

## 结论

建议设计并实现一个新的 Personal AI 能力：**Memory Composer Guard（记忆写作护航）**。

它不是新的聊天机器人，也不是替用户自动发消息，而是嵌入用户每天真实输入框的“发出前记忆护航层”：当用户在 RingCentral、Jira、Gmail、Google Docs、ChatGPT/Claude/Codex prompt、会议 agenda 或网页表单里写内容时，Personal AI 基于当前 thread、收件人、项目、历史承诺、会议结论、网页研究和用户偏好，给出低打扰、可证据追溯、可一键应用的提示。

一句话价值：

> 用户不用在发送前重新翻消息、会议、Jira、AI 对话和网页资料；Personal AI 会在输入框旁边提醒“别漏这个事实、这个承诺、这个风险、这个 follow-up”。

## 为什么要做

Personal AI 的长期目标是保存用户和 AI 的所有记忆，并在聊天、会议、其他 AI 对话等场景里提供记忆关联提示。当前已有方案覆盖了很多“记忆资产”：

- Cross-AI Memory Capsule：把上下文交给其他 AI。
- Decision Time Machine：回放决策依据。
- Memory Rehearsal Studio：会前演练。
- Personal Skill Foundry / Flight Recorder：沉淀操作技能。
- Memory Trust Console：提高记忆可信度。

但真实工作里还有一个非常高频、非常靠近用户手指的场景没有被做成一等体验：**正在写一段要发出去的话**。

对当前用户尤其明显：

- 用户是 Scrum Master / 项目协调角色，每天大量工作发生在 RingCentral 消息、Jira comment、会议 agenda、AI 工具讨论、跨团队沟通中。
- 近期真实记忆显示用户频繁处理 AI coding 工具选型、Cursor/Codex/Claude/Factory.ai 成本和权限、Jira 数据自动化、Video Mobile/Rooms/Nova 责任调整、Sophia/Fred/Coa 等协作对齐。
- 这些场景里，价值不只是“AI 帮我写得更漂亮”，而是“AI 知道我不能漏掉哪条事实、哪位 stakeholder 关心什么、哪条承诺需要跟进、哪些信息还没有证据”。

换句话说，Personal AI 应该从“事后能搜到记忆”前移到“发送前帮用户用好记忆”。

## 本次输入信号

### Reminder 检查

本机 Reminders 可见列表中没有 `Personal AI` 清单。当前可见列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`。

因此本次没有从 Reminder 随机抽取全新 idea，也没有需要标记 done 的 Reminder item。

### 远端记忆查询

按要求连接 `10.32.56.212` 查询 `esone.qiu` 的记忆。本次 HTTP memory-service 端口 `3210` TCP 可连接，但 `GET /health`、`GET /api/v1/health`、`POST /api/v1/recall` 均无响应超时。随后通过 SSH 只读查看远端用户数据和 SQLite 只读 `immutable=1` 查询，没有修改远端状态。

读到的设计信号：

- `esone.qiu` 记忆库约有 `9020` 条原始消息、`4238` 个 chunk、`13517` 个实体。
- 来源主要是 `glip` 和 `meeting`，说明即时消息和会议是最重要的记忆入口。
- 用户身份为 Esone Qiu，角色为 Scrum Master，时区 `Asia/Shanghai`。
- 2026-04-30 日总结中，高频事项包括：
  - Factory.ai free trial 已通过安全审批，可用 RingCentral 邮箱登录并用于 production project。
  - 团队正在讨论 Cursor 成本、Codex / Claude Code / Factory.ai 的工具迁移和选型。
  - Gary Chevsky 请求团队在 Claude Code 与 Codex 之间快速投票。
  - Sophia 与 Esone 协作做 JIRA 数据抽取、开发人数统计、趋势图，节省大量手工时间。
  - Video Mobile / RCV SDK / Rooms / Nova 的责任调整需要节后与 Coa、Fred、Sophia 对齐。
- 近期消息里有“上个月没用 automation 亏大了”“大家 daily basis post Codex 使用场景”等信号，说明用户已经在主动收集 AI 使用场景，但缺少贴近输入框的即时复用机制。

这些信号更支持“写作护航”而不是再做一个独立知识库页面：用户真正需要的是在回复、comment、prompt、agenda 生成的一瞬间，把相关记忆推到手边。

## 行业观察

### 竞品都在做写作辅助，但大多是平台内上下文

- Microsoft Copilot in Outlook 已支持在邮件 compose 区或 chat 中生成邮件草稿，用户可以调整长度、语气、重新生成，也有 email coaching。参考：[Draft an email message with Copilot in Outlook](https://support.microsoft.com/en-gb/office/draft-an-email-message-with-copilot-in-outlook-3eb1d053-89b8-491c-8a6e-746015238d9b)。
- Gemini in Gmail 可以总结邮件 thread、建议回复、起草新邮件、查找历史邮件和 Drive 文件，并在答案中显示 sources。参考：[Collaborate with Gemini in Gmail](https://support.google.com/mail/answer/14355636?co=GENIE.Platform%3DDesktop&hl=en-in)。
- Slack AI 可以基于用户有权限的 conversation data 总结 channel、DM、thread，并在搜索答案中给出消息或文件引用。参考：[Guide to AI features in Slack](https://slack.com/intl/en-gb/help/articles/25076892548883-Guide-to-AI-features-in-Slack)。
- Grammarly / Superhuman Go 强调跨 Chrome、Edge 和文档场景的实时写作辅助，能 compose、rewrite、reply，并适配个人 voice。参考：[Introducing generative AI assistance](https://support.grammarly.com/hc/en-us/articles/14528857014285-Introducing-generative-AI-assistance)。

这些产品验证了“输入框旁边的 AI”是主流入口。但它们的局限也很明显：

- Outlook/Gmail/Slack 主要围绕单个平台数据，跨 RingCentral、Jira、会议、网页、AI 对话、本机操作的记忆弱。
- Grammarly/Superhuman 擅长语气和清晰度，但不是用户私有长期记忆真源，通常不能解释“这条建议来自哪条会议/消息/项目事实”。
- 平台 AI 往往给“完整草稿”，但 Personal AI 更适合做“发出前护航”：提醒缺失、证据、承诺、风险、隐私和 follow-up。

### 论文支持个性化、证据检索和用户 agency

- PEARL 提出用 generation-calibrated retriever 为 LLM 写作助手选择历史用户文档，让生成更符合用户偏好。参考：[Pearl](https://arxiv.org/abs/2311.09180)。
- GhostWriter 研究指出，LLM 写作系统容易因为缺少个性化和控制感让用户挫败；系统应让用户通过显式标注和编辑来教会 AI 风格。参考：[GhostWriter](https://huggingface.co/papers/2402.08855)。
- “It was 80% me, 20% AI” 研究发现专业作者认可个性化写作工具，但希望个性化不只是产出文本，还要支持作者成长和过程真实性。参考：[Seeking Authenticity in Co-Writing](https://arxiv.org/abs/2411.13032)。
- Memoro 证明实时记忆增强需要极简、低打扰界面：系统可以推断当前 memory need、检索记忆、呈现最小建议，并提升 recall confidence。参考：[Memoro](https://arxiv.org/abs/2403.02135)。

对本功能的启发：

- 不应该默认替用户整段重写，而是给小而准的建议。
- 每条建议需要来源证据、可信度和可撤回操作。
- 系统应学习用户接受/拒绝/改写的差异，沉淀个人表达偏好。
- UX 重点是“在 flow 里帮忙”，不是打开一个新页面让用户搜索。

## 功能定位

### 一句话

Memory Composer Guard 是 Personal AI 的跨输入框记忆护航层：在用户写消息、邮件、Jira comment、AI prompt 和会议 agenda 时，实时或按需检查草稿是否遗漏相关记忆、承诺、事实、风险和 follow-up。

### 不是什么

- 不是全天候 keylogger。
- 不是默认把草稿发送给云端 LLM。
- 不是自动替用户发消息。
- 不是单纯 grammar checker。
- 不是又一个“生成完整回复”的按钮。

### 是什么

- 输入框旁边的 context chip / sidecar。
- 发出前的事实、承诺、语气、隐私、后续动作检查。
- 可证据追溯的短建议。
- 用户接受/拒绝后可学习的个人 communication memory。
- 将自然写作转成 follow-up、schedule、action、skill candidate 的入口。

## 核心用户场景

### 场景 1：RingCentral 回复 AI 工具选型

用户在 `AI Tools for Engineering - Workgroup` 里准备回复：

> 我建议保留 Cursor 给活跃用户，新场景优先试 Codex。

Composer Guard 在输入框旁显示 4 个提示：

- **补事实**：Factory.ai free trial 已获安全审批，但要求 RingCentral 邮箱登录。
- **补决策动作**：Gary 之前请求 Claude Code vs Codex 快速投票，当前回复应明确下一步投票/收集数据。
- **补成本依据**：Cursor 被讨论为更贵，需要避免只说“我觉得”。
- **创建 follow-up**：节后收集团队 Codex daily usage scenarios，形成对比表。

用户点击 `Insert decision line`，草稿中插入一句：

> 建议今天先收集 Claude Code vs Codex 的投票和 daily usage scenarios，节后用实际场景再决定 Cursor 例外名单。

### 场景 2：Jira comment 前检查历史承诺

用户在 Jira ticket 里写：

> We can move this to May.

系统发现相关记忆中 Sophia 的目标是“ETA by May，把这 part 安顿清楚”，但 ticket comment 没写 owner、scope 和是否受假期影响。

提示：

- “建议加 owner 和 holiday coverage，否则后续很难追踪。”
- “是否把这条 comment 同步成 follow-thread？”
- “这张 ticket 与 Video Mobile / Rooms handoff 相关，建议引用最近 team structure context。”

### 场景 3：给 AI 写 prompt 时补足 Personal AI 记忆

用户在 ChatGPT/Codex 输入：

> 帮我整理一下近期 AI coding tools 的选型。

Composer Guard 识别这是“给外部 AI 的 prompt”，建议：

- 插入安全边界：不要包含私密一对一消息原文。
- 插入必要背景：Cursor 成本、Factory.ai 审批、Codex daily usage collection、Gary 投票请求。
- 一键生成 Cross-AI Memory Capsule，而不是把全部历史粘进去。

### 场景 4：会议 agenda 草稿补 action 和证据

用户写会议 agenda：

> Discuss Rooms transition.

系统补充：

- 最近相关人：Sophia、Fred、Coa、Zora。
- 待确认问题：Coa 的协作风格偏好、Rooms 接手时间、Nova 是否不复杂。
- 建议 agenda 项：`Confirm owner split`、`Risk if holiday delay`、`Next decision by May`。

## 关键体验设计

### 1. Composer Chip

每个可支持输入框右下角显示一个小 chip：

- 状态：`3 cues` / `ready` / `needs evidence` / `private`.
- 点击展开 sidecar。
- 默认不抢焦点，不覆盖输入文本。
- 低置信建议只进 sidecar，不主动弹出。

触发条件：

- 用户在支持站点输入超过 80 字或停顿超过 2 秒。
- 当前 thread / ticket / page 与高 salience 记忆命中。
- 草稿出现承诺、日期、owner、决策、风险、报价、工具选型、生产使用等关键词。
- 用户手动点击 `Check memory`。

### 2. Send Readiness

不是给“AI 写作评分”，而是检查这段话是否具备发送前必要上下文：

| 维度 | 检查内容 | 例子 |
|---|---|---|
| Facts | 是否有过期/冲突/缺证据事实 | “Factory.ai 可 production 使用”必须附带登录条件 |
| Commitments | 是否遗漏承诺、owner、日期 | “by May” 是否写清 owner |
| Audience | 是否适配收件人/群组上下文 | 技术群可详细，管理群先结论 |
| Privacy | 是否泄露私聊、敏感链接、内部字段 | 给外部 AI prompt 时自动提示 |
| Follow-up | 是否应创建提醒、关注 thread、Jira action | “节后对齐 Fred/Coa” |

### 3. Evidence Tray

每条建议必须能展开证据：

- 来源类型：message / meeting / webpage / AI chat / profile / action result。
- 时间和来源标题。
- 摘要，不默认展示大段原文。
- 可信度：confirmed / stale / conflicting / inferred。
- 操作：`Open memory`、`Do not use in this thread`、`Mark outdated`。

### 4. Patch, Not Replace

默认提供“局部 patch”而不是整段替换：

- `Insert one line`
- `Add owner/date`
- `Make it concise`
- `Add evidence caveat`
- `Turn into question`
- `Create follow-up`

用户可以手动选择 `Rewrite draft`，但这不是默认体验。

### 5. Personal Voice Learning

系统从用户接受/拒绝/编辑建议中学习：

- 用户喜欢中英混合还是纯中文/英文。
- 在工作群里是否偏好先结论再原因。
- 是否经常用 bullet。
- 是否避免太正式。
- 对不同人/群的沟通密度偏好。

学习只进入 `draft_preferences` 或 `user_profile_items` 的候选队列，默认需要确认或达到多次一致证据才固化。

## 信息架构

### 页面 / 入口

1. **Inline Composer Chip**
   - 在 RingCentral / Jira / Gmail / Google Docs / AI chat 页面注入。
   - 显示当前建议数量和风险等级。

2. **Composer Sidecar**
   - 当前输入框的护航面板。
   - 包含 Send Readiness、Cue Cards、Evidence Tray、Patch Buttons。

3. **Composer History**
   - 在 `memory-exploring` 或新页面查看历史 composer receipts。
   - 查看哪些建议被接受、哪些被拒绝、哪些变成 follow-up/action。

4. **Preference Studio**
   - 管理学到的个人表达偏好。
   - 可按平台、群组、联系人、语言、工作/个人 scope 分开。

### 核心对象

```ts
type ComposerSurface =
  | 'ringcentral_message'
  | 'jira_comment'
  | 'gmail_email'
  | 'google_doc'
  | 'ai_prompt'
  | 'meeting_agenda'
  | 'generic_textarea';

interface ComposerContext {
  surface: ComposerSurface;
  url: string;
  title?: string;
  draftText: string;
  selectedText?: string;
  recipients?: Array<{ id?: string; name: string; type: 'person' | 'group' }>;
  thread?: {
    platform: 'ringcentral' | 'jira' | 'gmail' | 'slack' | 'generic';
    id?: string;
    recentMessages?: string[];
    sourceRefs?: string[];
  };
  userIntent?: 'reply' | 'decision' | 'status_update' | 'ask' | 'prompt' | 'agenda';
  scope: 'work' | 'personal' | 'both';
  privacyMode: 'normal' | 'strict' | 'local_only';
}

interface ComposerCue {
  id: string;
  type: 'fact' | 'commitment' | 'audience' | 'privacy' | 'follow_up' | 'style';
  severity: 'info' | 'suggest' | 'warn' | 'block';
  title: string;
  rationale: string;
  patch?: {
    kind: 'insert' | 'replace_selection' | 'append' | 'create_action' | 'open_capsule';
    text?: string;
    actionDraft?: unknown;
  };
  evidenceRefs: Array<{
    targetType: 'message' | 'chunk' | 'entity' | 'profile' | 'meeting' | 'action';
    targetId: string;
    label: string;
    timestamp?: number;
    confidence: number;
  }>;
}

interface ComposerReceipt {
  id: string;
  contextHash: string;
  surface: ComposerSurface;
  cueIds: string[];
  acceptedCueIds: string[];
  rejectedCueIds: string[];
  finalDraftHash?: string;
  createdActions?: string[];
  persistedPreferenceCandidates?: string[];
  createdAt: number;
}
```

## 技术设计

### 前端：content script adapters

新增 `src/composer-guard/`：

- `ComposerSurfaceDetector.ts`
  - 识别 `textarea`、`contenteditable`、ProseMirror、Monaco、Jira editor、RingCentral composer。
  - 排除 password、token、payment、private/incognito、用户黑名单站点。

- `SurfaceAdapters/`
  - `ringcentralAdapter.ts`
  - `jiraAdapter.ts`
  - `gmailAdapter.ts`
  - `googleDocsAdapter.ts`
  - `aiPromptAdapter.ts`
  - `genericAdapter.ts`

- `ComposerChip.tsx`
  - 低打扰 chip。
  - 只显示状态和数量。

- `ComposerSidecar.tsx`
  - cue list、readiness、evidence tray、patch preview。

- `DraftPatchApplier.ts`
  - 对 DOM selection / text area / contenteditable 做可撤回 patch。
  - 所有 patch 都必须先 preview。

### 后端：memory-service API

新增只读主接口：

```http
POST /api/v1/composer/assist
X-User-Id: esone.qiu
Content-Type: application/json
```

输入：`ComposerContext`  
输出：

```ts
interface ComposerAssistResponse {
  readiness: {
    score: number;
    labels: string[];
    blockingReasons: string[];
  };
  cues: ComposerCue[];
  evidence: EvidencePreview[];
  privacy: {
    mode: 'normal' | 'strict' | 'local_only';
    redactedItems: Array<{ kind: string; reason: string }>;
  };
  queryTimeMs: number;
}
```

新增写入接口：

```http
POST /api/v1/composer/receipts
POST /api/v1/composer/preferences/candidates
POST /api/v1/composer/actions/draft
```

写入接口遵守现有 `writeGuardMiddleware`，必须带 `X-User-Id`，高风险写入进入 confirm request。

### 召回流水线

1. **Surface parsing**
   - 解析 URL、title、thread id、收件人、当前草稿 intent。

2. **Seed recall**
   - 如果是 RingCentral/Jira/Gmail thread，先用 thread/page seed 找局部上下文。
   - 如果 seed 不完整，再按 groupId、source_url、message id、时间窗口补齐。

3. **Memory retrieval**
   - 调用现有 `ActiveRecallService`。
   - channels：`fts + graph + time + vector`。
   - sourceTypes：`glip`、`meeting`、`webpage`、`ai_chat`、`system`。
   - filters：recipient、project、time window、scope。

4. **Cue planning**
   - 轻量规则先出候选：
     - 日期但无 owner。
     - 决策但无 next step。
     - 引用事实但无最近证据。
     - 外部 AI prompt 中包含私密消息片段。
   - LLM 只负责把候选 cue 合成自然语言和 patch，不直接决定发送。

5. **Evidence grounding**
   - 每个 cue 至少一个 evidenceRef。
   - 不能提供证据的 cue 标记为 inferred，默认不主动弹出。

6. **Receipt learning**
   - 用户接受/拒绝 cue 后写 receipt。
   - 周期性汇总成 preference candidate。

## 与现有系统的关系

| 现有能力 | 复用方式 |
|---|---|
| `messageDealing` / Agent Workflow | 复用 replyAdviser、优先级、实体抽取和消息上下文 |
| `ContextRecallService` | 复用网页/消息场景的被动召回 |
| `/recall` / `ActiveRecallService` | 检索 evidence |
| `TruthMaintainer` | 检测事实是否过期、冲突、被 superseded |
| `ConfirmRequests` | 对长期偏好、自动动作、follow-up 写入做确认 |
| `ActionRepository` / scheduled messages | 将草稿中的承诺转成 action/follow-up |
| Cross-AI Memory Capsule | 当输入框是外部 AI prompt 时，建议生成胶囊 |
| Skill Foundry | 将反复接受的写作流程沉淀成 communication skill |

## 隐私和安全

### 默认原则

- 默认只在用户停顿或点击 `Check memory` 后分析草稿，不做逐击键上传。
- 严格排除 password、token、payment、medical、legal、private browsing、用户黑名单站点。
- 私聊和一对一消息不默认注入给外部 AI prompt。
- Cue 默认用摘要，不展开大段原文。
- 所有 patch 都必须用户确认后才写入输入框。
- 所有发送动作都由用户在原平台点击 Send。

### 隐私模式

| 模式 | 行为 |
|---|---|
| Normal | 发送草稿摘要、surface metadata、thread seed 到 memory-service |
| Strict | 只发送局部意图和哈希；证据侧重已确认 profile/project facts |
| Local Only | 不调用远端 LLM，只做本地规则和已有缓存 recall |

### 高风险阻断

`severity = block` 只用于明显风险：

- 草稿包含密钥、token、内部凭证。
- 对外部 AI prompt 粘贴了大量私聊原文。
- 引用被 TruthMaintainer 标记为 superseded 的事实。

阻断不是禁止发送，而是显示“建议确认后再发”。

## 数据模型建议

```sql
CREATE TABLE composer_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  surface TEXT NOT NULL,
  url TEXT,
  title TEXT,
  context_hash TEXT NOT NULL,
  draft_hash TEXT NOT NULL,
  privacy_mode TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE composer_cues (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  patch_json TEXT,
  evidence_refs_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'shown',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES composer_sessions(id)
);

CREATE TABLE composer_receipts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  accepted_cue_ids_json TEXT NOT NULL,
  rejected_cue_ids_json TEXT NOT NULL,
  final_draft_hash TEXT,
  created_actions_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES composer_sessions(id)
);

CREATE TABLE draft_preference_candidates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  surface TEXT,
  recipient_key TEXT,
  preference_text TEXT NOT NULL,
  evidence_receipt_ids_json TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## Demo 设计

Demo 文件：[memory-composer-guard-demo.html](./memory-composer-guard-demo.html)

Demo 展示一个 RingCentral 写作场景：

- 左侧是当前 thread 的上下文。
- 中间是用户正在写的 reply。
- 右侧是 Composer Guard 的 send readiness 和 cue cards。
- 底部是 evidence tray。
- 按钮可模拟：
  - 插入证据支持的一句话。
  - 把草稿转成决策请求。
  - 创建 follow-up。
  - 切换 privacy mode。

## 实施计划

### Phase 0：产品验证 Demo

目标：先验证“输入框旁的记忆护航”是否比搜索页更有价值。

范围：

- 静态 demo。
- 选 3 个真实样例：
  - RingCentral AI tools selection reply。
  - Jira handoff comment。
  - ChatGPT/Codex prompt with memory capsule suggestion。
- 手工定义 cue JSON，验证信息密度和 UI 干扰度。

### Phase 1：RingCentral + Jira MVP

目标：支持最高频工作输入框。

范围：

- RingCentral composer adapter。
- Jira comment adapter。
- `POST /api/v1/composer/assist` 只读接口。
- Cue types：fact、commitment、follow_up、privacy。
- Evidence tray 绑定 `exploreLink`。
- Patch preview + apply。
- Receipt 写入。

不做：

- Gmail/Docs。
- 自动发送。
- 长期偏好自动固化。

### Phase 2：AI Prompt Guard

目标：用户在 ChatGPT/Claude/Codex/豆包写 prompt 时，Personal AI 提醒应带哪些上下文、哪些不该泄露。

范围：

- AI chat textarea adapter。
- 与 Cross-AI Memory Capsule 集成。
- 外部 AI prompt privacy guard。
- `Generate capsule instead` 动作。

### Phase 3：Personal Voice Learning

目标：让系统逐步学会用户如何写、对谁写、在哪些群里怎样写。

范围：

- 从 accepted/rejected cues 汇总 preference candidates。
- Preference Studio 页面。
- 按 surface / group / recipient / language 区分。
- 与 `user_profile_items` 的确认和 TruthMaintainer 联动。

### Phase 4：Follow-up Loop

目标：把“写出去的话”连接到后续结果。

范围：

- 草稿中出现日期/owner/action 时生成 proposed action。
- 与 scheduled messages / follow thread / confirm requests 集成。
- 当对方回复后，receipt 回流：“这个 cue 是否有效？”
- 生成 communication skill candidate。

## 验证方案

### 单元测试

- `ComposerSurfaceDetector`：支持 textarea/contenteditable/Jira/RingCentral，排除敏感输入。
- `DraftPatchApplier`：插入、替换、撤销不会破坏光标和文本。
- `composer cue planner`：日期无 owner、决策无 next step、外部 prompt 隐私风险。

### 集成测试

- mock RingCentral thread + memory-service，验证 cue evidenceRefs。
- mock Jira comment，验证 action/follow-up candidate。
- mock AI prompt，验证 capsule suggestion 和 privacy mode。

### E2E

- 用 Playwright 加载 extension `dist/`。
- 在 fixture RingCentral/Jira 页面输入草稿。
- 检查 chip 出现、sidecar cue 正确、apply patch 后 draft 更新。
- 发送动作不自动点击，只验证用户可手动发送。

### 产品指标

| 指标 | 目标 |
|---|---|
| Cue accept rate | MVP 后 > 25% |
| False interruption report | < 10% sessions |
| Evidence open rate | > 15%，说明用户信任来源 |
| Follow-up created | 每周至少数条真实行动 |
| Draft time saved | 用户主观评分 |
| Missed commitment prevention | 通过人工回顾标注 |

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 太打扰 | 默认 chip，不弹窗；低置信 cue 收纳 |
| 像 Grammarly 一样只改语气 | Cue 类型优先 fact/commitment/follow-up，不把 grammar 当核心 |
| 误读人物偏好 | 只用证据说“历史上在此类场景中”，不推断人格 |
| 隐私风险 | strict/local mode、敏感输入排除、外部 AI prompt guard |
| 草稿 patch 破坏编辑器 | 先支持 textarea/contenteditable，复杂编辑器只 preview/copy |
| 证据过期 | 联动 TruthMaintainer，stale cue 不默认插入 |
| 后端负载 | 停顿 debounce、短 query、缓存 thread seed、只在高信号触发 |

## 与竞品差异总结

| 产品 | 主要能力 | Personal AI 差异 |
|---|---|---|
| Copilot in Outlook | 邮件草稿、rewrite、coaching | 不限 Outlook；使用 RingCentral/Jira/会议/AI 对话/网页统一记忆 |
| Gemini in Gmail | 邮件总结、回复建议、Drive/Calendar 引用 | 不限 Google；每条 cue 都可回到 Personal AI evidence |
| Slack AI | conversation summary、recap、search citations | 不只总结消息，还检查用户即将发出的草稿是否遗漏 action |
| Grammarly/Superhuman | 跨应用写作、语气、个人 voice | 不只是写得像用户，而是知道用户过去承诺了什么 |
| 普通 prompt 模板 | 静态风格和格式 | 动态召回当前 thread、收件人、项目、时间和真值状态 |

## 为什么这个功能值得优先

1. **高频**
   - 用户每天都在写消息、Jira comment、AI prompt、会议 agenda。入口比独立搜索页更自然。

2. **贴近 Personal AI 目标**
   - 记忆不是被动仓库，而是在聊天、会议、其他 AI 对话里主动关联提示。

3. **可小步落地**
   - 先做 RingCentral/Jira 的 cue + evidence + patch，不需要先完成跨平台全链路。

4. **能把其他能力串起来**
   - Cross-AI Capsule、Follow Thread、Scheduled Actions、TruthMaintainer、Skill Foundry 都能通过输入框入口被自然使用。

5. **用户体验有亮点**
   - 用户看到的不是“AI 又生成一段套话”，而是“Personal AI 记得我这件事的上下文，并在我发出去前提醒我”。

## 决策建议

建议把它作为一个短周期可验证的新能力：

- 先用 demo 评估信息密度和是否打扰。
- 如果认可，Phase 1 只做 RingCentral + Jira。
- 与现有 message-reaction / webpage memory detection 共用注入基础设施。
- 把 API 设计为 read-first、write-confirmed，避免一开始就引入自动发送风险。

如果只选一个切入场景，建议从 **RingCentral reply** 开始，因为远端记忆显示当前数据主源就是 Glip/RingCentral，并且用户的项目协调、AI 工具讨论、Jira 数据自动化都发生在这里。

