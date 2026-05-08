# Memory Trust Console：记忆可信中枢（搁置）

*创建: 2026-05-05 CST*

配套 demo：[`memory-trust-console-demo.html`](./memory-trust-console-demo.html)

## 结论

建议设计一个新能力：**Memory Trust Console（记忆可信中枢）**。

它不是再做一个记忆搜索页、跨 AI 交接包、会前演练室或技能炼金台，而是给 Personal AI 增加一层面向用户的**记忆质量、隐私、证据和修复控制台**。当 Personal AI 真的开始留存用户的消息、网页、会议、AI 对话、操作轨迹、偏好和技能时，最危险的问题不是“记得不够多”，而是“记得太多但不够可信”。

一句话价值：

> Personal AI 不只帮用户记住一切，还要让用户知道哪些记忆可信、哪些过期、哪些重复、哪些敏感、哪些不该被交给下一个 AI。

这个能力是 Personal AI 走向长期可用的底座：跨 AI 胶囊、决策时间机、技能炼金台、会前演练室都需要从同一个可信记忆层取数。否则记忆越丰富，错误上下文、隐私外泄、重复噪音和过期假设的风险越高。

## 本次输入信号

### Reminder 检查

本次尝试检查本机 Reminders 的 `Personal AI` 列表：

- AppleScript 查询 Reminders 时卡住，没有返回列表内容。
- Reminders 本地数据目录 `~/Library/Group Containers/group.com.apple.reminders` 被 macOS 隐私权限拒绝访问。
- Computer Use 能看到 Reminders App 处于 running 状态，但无法取得可读窗口。

因此本次没有可靠读取到 Reminder 中的全新 idea。按任务要求，进入“结合项目目标、用户场景、真实记忆和行业信息主动构思”的分支。

### 远端记忆查询

按要求连接 `10.32.56.212` 查询 `esone.qiu` 的记忆：

- `10.32.56.212:3210` TCP 可连接，但 `/health`、`/api/v1/stats`、`/api/v1/recall` 等 HTTP 请求本轮均超时。
- SSH 到 `rcadmin@10.32.56.212` 可用，本次只读查询了 `memory-service/data/users/esone.qiu` 下的 Markdown 摘要和 SQLite 表结构，没有修改远端服务状态。

读到的关键信号：

- 用户身份：Esone Qiu，Scrum Master，时区 Asia/Shanghai。
- 高频场景：RingCentral 消息、会议、Jira 数据分析、AI coding 工具选型、Codex / Claude Code / Cursor / Factory.ai 试用、团队责任调整、项目汇报。
- 真实记忆库中有 `glip`、`meeting`、`doubao_chat`、`chatgpt` 等多种来源，说明 Personal AI 已经在接近“跨平台记忆真源”。
- `USER_CORE.md` 里当前确认画像仍很稀疏，偏好区为空；同时查询结果里可见会议片段重复、ASR 噪音片段、来源混杂等现象。这不是单点 bug，而是所有长期记忆系统都会遇到的“记忆质量债”。
- 项目文档已经提到时间戳秒/毫秒适配、确认队列、画像校准、consolidation、forgetting、TruthMaintainer 等基础能力，说明新功能应该复用现有机制，把它们做成用户可见的可信中枢。

### 自动化历史避让

`docs/progressing` 近期已有四个新能力方案：

- `docs/features/context_assist.md`：AI Prompt Injection / Context Handoff 与会前准备。
- `decision-time-machine-plan.md`：个人决策记忆回放台。
- `personal-skill-foundry-plan.md`：个人技能炼金台。
- `docs/features/context_assist.md`：会前准备与后续情景演练扩展。

本次方案刻意避开这些主线。Memory Trust Console 的核心对象不是“上下文包”“决策 episode”“可复用技能”或“未来沟通演练”，而是这些能力共同依赖的**记忆可信度与修复工作流**。

## 为什么要做

Personal AI 的项目目标是留存用户和 AI 的所有记忆，并在聊天、会议、其他 AI 对话等场景提供记忆关联提示。这个目标越成功，越会遇到以下真实问题：

1. **记忆爆炸后，用户不知道 AI 到底依据了什么**
   - 同一个会议可能有 transcript、话题切片、摘要、action item、AI 对话复述。
   - 下一次 AI 召回时，如果只说“根据你的记忆”，用户很难判断它引用的是原始证据、摘要、推断还是过期画像。

2. **重复和噪音会污染召回**
   - 会议系统很容易产生重复片段、坏 ASR、空洞话题和半句 transcript。
   - 如果这些片段权重过高，AI 会把噪音当成重要信号。

3. **画像和偏好必须可确认**
   - 用户画像如果自动提取太激进，会让 AI 形成错误假设。
   - 如果自动提取太保守，`USER_CORE.md` 又会长期很空，跨场景个性化不明显。
   - 用户需要一个低成本校准入口，而不是埋在数据库或日志里。

4. **跨 AI 注入需要隐私闸门**
   - 当 Personal AI 把上下文交给 ChatGPT、Claude、Codex、豆包或任何 MCP client 时，用户必须知道哪些敏感内容会离开本地/内网边界。
   - 当前行业方向都在做 memory import/export 和 MCP，但真正的用户信任来自“这次到底发了什么、为什么发、能不能撤回或过期”。

5. **过期事实比缺失事实更危险**
   - 项目 owner、工具政策、Jira 口径、试用权限、会议结论都可能变化。
   - 旧事实如果没有有效期、冲突标记和复查提醒，会让 AI 给出看似合理但过时的建议。

Memory Trust Console 要解决的是：

> 把 Personal AI 的记忆层从“能存、能搜、能总结”升级为“可信、可审计、可修复、可控地流向其他 AI”。

## 行业观察

### 平台记忆正在强调控制权，但控制入口仍分散

OpenAI 的 ChatGPT Memory 已经包含 saved memories 和 reference chat history，并提供关闭、查看、删除、Temporary Chat 等控制。官方强调“越用越有用”，但也强调用户能管理记忆。参考：[OpenAI Memory and new controls](https://openai.com/index/memory-and-new-controls-for-chatgpt/)。

启发：Personal AI 不应该只做“更强的记忆”，还要把“查看、解释、修改、隔离、删除或过期”做成核心体验。

### 屏幕级记忆产品把隐私控制放在前台

Microsoft Recall 的官方说明强调 snapshots 本地保存、用户 opt-in、可暂停、可删除、可过滤应用和网站，并要求 Windows Hello 才能访问快照。参考：[Microsoft Recall privacy and control](https://support.microsoft.com/en-us/windows/privacy-and-control-over-your-recall-experience-d404f672-7647-41e5-886c-a3c59680af15)。

启发：Personal AI 如果要保存浏览、操作、会议和 AI 对话，必须提供同等级甚至更细的来源级控制：哪些来源可存、哪些可召回、哪些可被注入外部 AI、哪些只能本地搜索。

### 会议产品已经在做证据回看

Granola 的 AI-enhanced notes 允许用户查看增强笔记来自 transcript 或 raw notes 的依据，并且每次会议独立处理，避免一次编辑影响未来所有会议。参考：[Granola AI-enhanced notes](https://docs.granola.ai/help-center/taking-notes/ai-enhanced-notes)。

启发：Personal AI 的每条摘要、画像、决策、技能候选都应有 evidence trail，而不是只留下 LLM 生成后的结论。

### 个人记忆产品正在开放给其他 AI

Limitless 的最新页面强调“Never forget a thing”，并提供 MCP 接入，让 ChatGPT、Claude 等客户端连接 Limitless memory。参考：[Limitless](https://www.limitless.ai/new)。

启发：MCP / API 连接是趋势，但一旦记忆可被外部 AI 读取，用户就更需要 Trust Console 来控制“哪些记忆可被哪些客户端读取”。

### 通用 AI 助手正在走向多模态、个性化和行动

Google DeepMind 的 Project Astra 页面强调自然交互、主动响应、工具使用、个性化推理和多模态记忆。参考：[Project Astra](https://deepmind.google/models/project-astra/)。

启发：未来 Personal AI 也会从“文本记忆”走向“网页、屏幕、会议、操作、文件、语音”的多模态记忆。多模态越强，信任、来源、隐私、去噪越不能后补。

### 研究方向明确要求 ground truth 和 write-manage-read

MemMachine 强调保存完整 episode、减少有损抽取，并通过 contextualized retrieval 处理跨多轮证据；它的结论是：保留 episodic ground truth，再叠加自适应检索，能让个性化长时记忆更稳。参考：[MemMachine](https://arxiv.org/abs/2604.04853)。

2026 agent memory survey 把记忆抽象为 write-manage-read loop，并把 contradiction handling、latency budget、privacy governance、learned forgetting、multimodal embodied memory 视为工程现实。参考：[Memory for Autonomous LLM Agents](https://arxiv.org/abs/2603.07670)。

ASTRA-bench 指出下一代 AI 要处理动态个人上下文、工具和多步推理，但当前模型在复杂个人上下文中明显退化。参考：[ASTRA-bench](https://arxiv.org/abs/2603.01357)。

OpenAI Cookbook 的 context personalization 也把“存什么、召回什么、注入什么”视为 context engineering 的核心，并强调从用户角度看，AI 从 generic 变成 personal 的瞬间来自稳定的记忆管理。参考：[OpenAI Context Engineering for Personalization](https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization)。

这些资料共同指向一个产品机会：

> Personal AI 的差异化不只是捕获更多记忆，而是把记忆治理、证据保真、隐私控制和召回质量做成用户能理解和操作的产品层。

## 功能定位

### 功能名

**Memory Trust Console / 记忆可信中枢**

也可以在系统内部称为 **Memory Immune System / 记忆免疫系统**：它持续扫描、发现、隔离和修复会伤害 AI 记忆质量的“病灶”。

### 一句话产品承诺

> 让用户在任何 AI 使用场景前，都能知道 Personal AI 正在引用的记忆是否可靠、是否过期、是否敏感、是否有证据。

### 目标用户

第一目标用户就是当前 Personal AI 的真实使用者：

- 同时使用 RingCentral、Jira、会议、网页、Codex、Claude Code、Cursor、Factory.ai、ChatGPT、豆包。
- 需要 Personal AI 帮自己恢复上下文、做项目协调、会议准备、AI 工具选型、Jira 数据分析。
- 关心 AI 能不能“接着上次干”，但也担心 AI 引用错、记错、泄露、重复或过期信息。

### 不做什么

- 不自动永久删除原始记忆。
- 不把所有低质量记忆直接隐藏，避免丢证据。
- 不替用户自动把敏感记忆发给外部 AI。
- 不把“可信度分数”伪装成绝对真相。
- 不做一个面向工程师的数据库管理器；它必须是用户能理解的产品体验。

## 核心概念

### Memory Trust Issue

系统扫描发现的一个记忆可信问题。

```ts
type MemoryTrustIssueKind =
  | 'duplicate_noise'
  | 'asr_corruption'
  | 'weak_profile'
  | 'stale_fact'
  | 'conflicting_fact'
  | 'privacy_sensitive'
  | 'source_gap'
  | 'time_drift'
  | 'provider_leak_risk'
  | 'orphan_action';

interface MemoryTrustIssue {
  id: string;
  kind: MemoryTrustIssueKind;
  title: string;
  summary: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  affectedTargets: MemoryTargetRef[];
  evidenceRefs: EvidenceRef[];
  recommendedAction: TrustRepairAction;
  userImpact: string;
  createdAt: number;
  updatedAt: number;
  state: 'open' | 'snoozed' | 'resolved' | 'dismissed';
}
```

示例：

- “同一个 RingCentral meeting 片段出现 14 次，建议合并为一个 canonical meeting episode。”
- “用户画像里 `role=scrum master` 可信，但没有确认；建议用户确认后写入 USER_CORE。”
- “一个会议 ASR 片段包含大量乱码，建议降低召回权重并保留原始证据。”
- “Factory.ai 使用政策在两天内出现变化，建议标记旧事实为 `stale`。”
- “这条上下文将被注入外部 AI，包含人员和公司内部政策，建议脱敏或改为本地引用。”

### Trust Repair Proposal

对一个或多个 issue 的可预览修复方案。

```ts
interface TrustRepairProposal {
  id: string;
  issueIds: string[];
  action:
    | 'merge_duplicates'
    | 'quarantine_noise'
    | 'lower_salience'
    | 'confirm_profile_item'
    | 'mark_stale'
    | 'redact_for_provider'
    | 'link_missing_source'
    | 'create_review_reminder';
  previewBefore: MemoryPreview;
  previewAfter: MemoryPreview;
  reversible: boolean;
  requiresUserConfirmation: boolean;
  dataLossRisk: 'none' | 'low' | 'medium' | 'high';
  implementationPlan: RepairStep[];
}
```

关键原则：

- 默认不删除，只做 `archive`、`quarantine`、`lower salience`、`merge view`、`mark stale`。
- 真删除必须单独确认，不能被批量“清理”按钮带过。
- 每个修复都要有 before/after 预览。
- 修复动作要写入 audit ledger，后续可解释“为什么这条记忆被降权或脱敏”。

### Source Trust Profile

每个来源都有独立质量画像。

```ts
interface SourceTrustProfile {
  source: string;
  sourceType: 'glip' | 'meeting' | 'web' | 'chatgpt' | 'doubao_chat' | 'manual' | 'operation';
  trustScore: number;
  captureVolume: number;
  duplicateRate: number;
  noiseRate: number;
  confirmedFactRate: number;
  sensitiveRiskRate: number;
  externalSharePolicy: 'never' | 'redact' | 'ask_each_time' | 'allow';
  retentionPolicy: SourceRetentionPolicy;
}
```

这让用户能回答：

- “会议 transcript 最近质量怎么样？”
- “豆包/ChatGPT 对话能不能被用来生成长期技能？”
- “RingCentral 群聊里的哪些内容允许被交给 Codex？”
- “网页浏览记忆只用于本地搜索，还是允许被跨 AI 胶囊引用？”

### Trust Ledger

不可变的审计流水，记录记忆从捕获到召回、修复、注入、回写的关键事件。

```ts
interface TrustLedgerEvent {
  id: string;
  targetType: 'message' | 'chunk' | 'profile' | 'entity' | 'decision' | 'skill' | 'context_pack';
  targetId: string;
  eventType:
    | 'captured'
    | 'summarized'
    | 'embedded'
    | 'merged'
    | 'quarantined'
    | 'confirmed'
    | 'redacted'
    | 'injected'
    | 'recalled'
    | 'marked_stale';
  actor: 'system' | 'user' | 'agent';
  reason: string;
  evidenceRefs: EvidenceRef[];
  createdAt: number;
}
```

Trust Ledger 不是给用户每天读流水，而是用于：

- 解释 AI 为什么引用了某条记忆。
- 调试召回质量。
- 证明敏感内容没有被外发，或说明外发前做了哪些脱敏。
- 在用户质疑“你为什么这么认为”时给出证据链。

## 关键体验

### 体验 1：每日 Memory Health Inbox

每天第一次打开 Personal AI 时，用户看到一个简短的 Memory Health Inbox：

- `需要确认的画像`: 3 条
- `重复/噪音`: 18 条可合并
- `过期/冲突`: 4 条待复查
- `外发风险`: 2 个来源建议改为 ask each time

用户不需要懂数据库，只需处理卡片：

- `Confirm`
- `Merge`
- `Quarantine`
- `Mark stale`
- `Snooze`
- `Show evidence`

设计重点：不要制造新的待办压力。默认只显示高影响项，低影响项进入后台自动降权。

### 体验 2：证据三联面板

点开任意 issue 后，右侧显示三块：

1. **What AI believes**
   - AI 当前会怎么概括这条记忆。
   - 信心分、来源数量、最近更新时间。

2. **Evidence**
   - 原始消息、会议片段、网页、AI 对话、操作记录。
   - 每条证据标记 `supports / contradicts / background / noisy`。

3. **Repair preview**
   - 修复前后会如何影响召回、画像、胶囊注入、会议提示。
   - 用户确认后才执行有影响的修复。

### 体验 3：跨 AI 注入前的 Trust Gate

当 AI Prompt Injection / Context Handoff、Decision Time Machine、Skill Foundry 或 Rehearsal Studio 准备把上下文交给外部 AI 时，Memory Trust Console 提供一个轻量 gate：

> 这次上下文包含 12 条记忆，其中 2 条未确认画像、1 条公司内部政策、3 条会议 transcript。建议脱敏人员名单，并把未确认画像改成低置信提示。

用户可以选择：

- `Use redacted version`
- `Keep local references only`
- `Allow this time`
- `Open Trust Console`

这一步解决“Personal AI 越强，越容易无意识把私有上下文带出边界”的问题。

### 体验 4：来源级策略

用户可以给每个来源设置策略：

| 来源 | 默认召回 | 可写长期画像 | 可外发给其他 AI | 保留策略 |
|---|---:|---:|---:|---|
| RingCentral work group | 是 | 需确认 | 脱敏后询问 | 长期 |
| Meeting Pilot transcript | 是 | 需确认 | 脱敏后询问 | 保留原文 + 摘要 |
| ChatGPT / Doubao chat | 是 | 需确认 | 同平台可用，跨平台询问 | 长期 |
| Web browsing | 是 | 否，除非用户收藏 | 仅摘要 | 90 天原文 |
| Local operations | 仅本地 | 否 | 禁止 | 30 天细节 |

这比单一的 “memory on/off” 更符合 Personal AI 的目标：用户不是不想被记住，而是希望不同来源有不同边界。

### 体验 5：召回结果带 Trust Badges

所有 Memory Exploring、会议提示、AI 胶囊、技能候选和决策 episode 都显示简洁 badge：

- `Confirmed`
- `Raw evidence`
- `Inferred`
- `Stale risk`
- `Noisy transcript`
- `Sensitive`
- `Redacted`

用户逐渐形成直觉：哪些 AI 提示可以直接用，哪些需要点开证据。

## 与已有能力的关系

| 已有/规划能力 | Memory Trust Console 的作用 |
|---|---|
| Memory Service `/recall` | 给召回结果增加 trust score、issue badge、source policy filter |
| `memory_metadata` | 扩展 salience、redundancy、access_count、consolidation_level 的可视化和修复入口 |
| `confirm_requests` | 复用为用户确认入口，但新增 `trust` routing 和 repair preview |
| `TruthMaintainer` | 继续负责事实冲突，Trust Console 负责展示、分流、批量处理和用户体验 |
| `ProfileManager` / `USER_CORE.md` | 把弱画像、未确认偏好、过期身份事实暴露给用户校准 |
| `ConsolidationEngine` | 输出 nightly health scan，不只生成 summary 和 reflection |
| AI Prompt Injection / Context Handoff | 注入前调用 Trust Gate，避免把未确认/敏感/过期记忆交给外部 AI |
| Decision Time Machine | 决策 episode 显示 trust badges 和 changed/stale 检查 |
| Personal Skill Foundry | skill 候选必须通过证据和执行反馈可信度检查 |
| Context Assist / 后续情景演练 | 人物/会议模拟必须显示证据强度，避免无依据画像 |

## 信息架构

新页面建议放在 Desktop App 或 Memory Exploring 内，路径：

- `desktop-app/app/memory-trust.html`
- 或扩展页：`chrome-extension://.../memory-trust.html`

主导航：

1. **Overview**
   - 全局 trust score
   - 按来源/问题类型汇总
   - 本日待处理卡片

2. **Issues**
   - 问题列表
   - severity、source、impact、state 过滤
   - 批量处理

3. **Sources**
   - 来源质量画像
   - 召回/画像/外发/保留策略

4. **Policies**
   - 敏感数据分类
   - 外部 AI provider 策略
   - 本地/云端边界

5. **Ledger**
   - 只读审计日志
   - 按目标记忆追踪 capture -> summarize -> recall -> inject

## 技术方案

### 新表

```sql
CREATE TABLE memory_trust_issues (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence REAL NOT NULL,
  affected_targets_json TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  recommended_action_json TEXT NOT NULL,
  user_impact TEXT,
  state TEXT NOT NULL DEFAULT 'open',
  snooze_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_memory_trust_issues_state
  ON memory_trust_issues(state, severity, created_at DESC);

CREATE TABLE memory_repair_proposals (
  id TEXT PRIMARY KEY,
  issue_ids_json TEXT NOT NULL,
  action TEXT NOT NULL,
  preview_before_json TEXT NOT NULL,
  preview_after_json TEXT NOT NULL,
  reversible INTEGER NOT NULL DEFAULT 1,
  requires_user_confirmation INTEGER NOT NULL DEFAULT 1,
  data_loss_risk TEXT NOT NULL DEFAULT 'none',
  state TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  applied_at INTEGER
);

CREATE TABLE source_trust_profiles (
  source TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  trust_score REAL NOT NULL DEFAULT 0.5,
  capture_volume INTEGER NOT NULL DEFAULT 0,
  duplicate_rate REAL NOT NULL DEFAULT 0,
  noise_rate REAL NOT NULL DEFAULT 0,
  confirmed_fact_rate REAL NOT NULL DEFAULT 0,
  sensitive_risk_rate REAL NOT NULL DEFAULT 0,
  external_share_policy TEXT NOT NULL DEFAULT 'ask_each_time',
  retention_policy_json TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE memory_trust_ledger (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_refs_json TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);
```

### 服务

#### `MemoryHealthScanner`

夜间 consolidation 后运行，也支持手动触发。

职责：

- 汇总 `messages_raw`、`chunks`、`user_profile_items`、`entities`、`memory_metadata`。
- 生成 trust issues。
- 更新 source trust profiles。
- 只产出 proposals，不直接执行高影响修复。

#### `DuplicateNoiseDetector`

检测：

- 完全重复：content hash 相同。
- 近重复：embedding 相似 + 时间接近 + source_url/source_title 相同。
- 会议重复：meetingId/tabId/source_title 相同，内容片段高度重叠。
- ASR 噪音：异常字符比例、语言混杂异常、超低信息密度、重复音节。

输出：

- canonical target 建议。
- `memory_metadata.redundancy` 更新建议。
- `quarantine_noise` proposal。

#### `WeakProfileDetector`

检测：

- 高 salience 但未确认的画像。
- 多次出现但未进入 `USER_CORE.md` 的偏好。
- 证据单一、过期或来源不可靠的画像。
- 和显式用户设置冲突的画像。

输出：

- `confirm_profile_item` proposal。
- `lower_salience` proposal。
- `mark_stale` proposal。

#### `PrivacyPolicyClassifier`

检测：

- 联系方式、会议链接、内部政策、人员评价、客户/财务/法律/医疗等敏感类。
- 外部 AI provider 注入风险。
- 来源策略冲突：例如某来源设为 local-only，但被 AI context pack 选中。

输出：

- `redact_for_provider` proposal。
- Trust Gate warnings。
- source policy 建议。

#### `TrustAwareRecallAdapter`

在 `/recall`、`/context-recall`、`ProviderContextService` 上加一层可选策略：

```ts
interface TrustAwareRecallOptions {
  minTrustScore?: number;
  includeUnconfirmed?: boolean;
  includeNoisyTranscript?: boolean;
  externalProvider?: 'chatgpt' | 'claude' | 'codex' | 'doubao' | 'generic_mcp';
  privacyMode?: 'local_only' | 'redacted' | 'ask_each_time' | 'allow';
}
```

默认行为：

- 本地搜索可以显示低信任结果，但必须带 badge。
- 外部 AI 注入默认过滤 critical privacy issue。
- 未确认画像可作为 “possible preference” 使用，不能写成确定事实。

### API

```http
GET /api/v1/memory-health/overview
GET /api/v1/memory-health/issues?state=open&severity=high&source=meeting
GET /api/v1/memory-health/issues/:id
POST /api/v1/memory-health/issues/:id/snooze
POST /api/v1/memory-health/issues/:id/dismiss

GET /api/v1/memory-health/repair-proposals/:id
POST /api/v1/memory-health/repair-proposals/:id/apply
POST /api/v1/memory-health/repair-proposals/:id/reject

GET /api/v1/memory-health/sources
PUT /api/v1/memory-health/sources/:source/policy

GET /api/v1/memory-health/ledger?targetType=message&targetId=...
POST /api/v1/memory-health/scan

POST /api/v1/memory-health/trust-gate/preview
```

### 前端集成

新增视图可以复用当前 extension / desktop app 的现有模式：

- `src/modals/memory-trust.tsx` 或 Vue 版本。
- `desktop-app/app/memory-trust.html` + renderer。
- `MemoryServiceClient` 新增 `getMemoryHealthOverview`、`getTrustIssues`、`applyRepairProposal`、`updateSourcePolicy`。

组件：

- `TrustScoreHeader`
- `TrustIssueList`
- `TrustIssueDetail`
- `EvidenceTrail`
- `RepairPreview`
- `SourcePolicyTable`
- `TrustGateBanner`
- `LedgerTimeline`

## MVP 设计

### MVP-1：只读 Health Scan + 页面

目标：先让用户看见问题，不做自动修复。

范围：

- 新表 `memory_trust_issues`、`source_trust_profiles`、`memory_trust_ledger`。
- `MemoryHealthScanner` 基于规则产出：
  - duplicate_noise
  - asr_corruption
  - weak_profile
  - privacy_sensitive
  - stale_fact
- 新页面 Overview + Issues + Detail。
- `/memory-health/overview` 和 `/issues` API。

验收：

- 能在 `esone.qiu` 的真实数据上列出 meeting duplicate / ASR noise / weak profile / privacy candidates。
- 每个 issue 至少有 1-3 条 evidence refs。
- 页面不使用 mock 数据伪装真实扫描成熟度；demo 可以用静态样例，但实现必须连真实 API。

### MVP-2：可逆修复

目标：用户能处理高频问题，但不丢原始证据。

范围：

- repair proposals。
- merge duplicates 只创建 canonical group，不删除 raw。
- quarantine noise 只降低 salience / 标记 consolidation_level，不删除 raw。
- confirm profile item 复用 profile confirm API。
- mark stale 写 ledger 并更新 metadata。
- 批量处理同类低风险问题。

验收：

- 每个修复有 before/after。
- 每个修复可在 ledger 里追踪。
- 高风险动作必须单独确认。

### MVP-3：Trust Gate 接入跨场景

目标：让可信中枢影响真正使用体验。

范围：

- AI Prompt Injection / Context Handoff 生成前调用 `/trust-gate/preview`。
- Meeting Pilot / Rehearsal / Decision / Skill 的召回结果显示 trust badges。
- ProviderContextService 支持 `privacyMode=redacted`。
- 外部 AI 注入回执写 ledger。

验收：

- 对外部 provider 的上下文包能显示敏感/未确认/低可信来源。
- 用户能选择 redacted version。
- 注入后可查看“这次发给哪个 AI、发了哪些 blocks、哪些被脱敏”。

### MVP-4：质量闭环

目标：让用户处理行为反过来训练记忆系统。

范围：

- 用户 dismiss/confirm/merge/quarantine 行为写入 feedback。
- source trust profile 周期更新。
- 召回排序使用 source trust 和 issue state。
- consolidation prompt 使用历史修复偏好。

验收：

- 被用户多次 dismiss 的 issue 类型会降噪。
- 低质量来源不再反复污染 top recall。
- USER_CORE 的确认率和有用率提升。

## 关键算法

### 记忆可信度评分

建议先用可解释规则，不急着训练模型：

```ts
trustScore =
  0.30 * evidenceStrength +
  0.20 * sourceReliability +
  0.15 * recencyFit +
  0.15 * confirmationState +
  0.10 * contradictionPenalty +
  0.10 * noisePenalty;
```

说明：

- `evidenceStrength`: 原始证据数量、来源多样性、是否有 raw episode。
- `sourceReliability`: 来源历史噪音率、重复率、用户确认率。
- `recencyFit`: 对时效敏感事实更重视最近证据。
- `confirmationState`: 用户确认 > 系统推断 > 单条 LLM 摘要。
- `contradictionPenalty`: TruthMaintainer 命中冲突则降分。
- `noisePenalty`: ASR 噪音、重复、乱码、低信息密度降分。

### 重复合并策略

1. 先按 `source_url/source_title/meetingId/timestamp window` 聚类。
2. content hash 完全相同直接归为重复。
3. 对短 transcript 片段用字符 n-gram + embedding 双重相似。
4. 选择 canonical target：
   - 完整会议 summary 优先。
   - 有人工确认或高 salience 优先。
   - 原始 evidence 保留，不删除。
5. 更新 `memory_metadata.redundancy` 和 `canonical_ref`。
6. Trust Ledger 写入 `merged` 事件。

### 噪音识别

规则示例：

- 非目标语言字符占比异常。
- 单字符/音节重复过多。
- 标点和乱码比例过高。
- 与同一 meeting 其他片段不相似，且无实体/任务/决策。
- 多次召回但用户从不点击/使用。

动作：

- 降低 salience。
- 从外部 AI 注入候选中排除。
- 本地搜索仍可通过 `show noisy evidence` 找到。

### 隐私与外发策略

敏感分类：

- 人员身份、联系方式、会议链接、内部系统 URL。
- 公司内部政策、成本、审批、客户、财务、法律、医疗、HR。
- 对人的观点/评价。
- 精确地址、设备、账号、token、凭据。

外发策略：

- `never`: 禁止出现在外部 AI 上下文。
- `redact`: 用角色/项目别名替换，例如 `Person A`、`Internal policy`。
- `ask_each_time`: 每次展示 Trust Gate。
- `allow`: 可直接用于目标 provider，但仍写 ledger。

## Demo 说明

`memory-trust-console-demo.html` 是一个静态交互原型，模拟：

- 左侧来源健康和策略。
- 中间 issue inbox。
- 右侧 evidence + repair preview。
- 点击不同 issue 会更新详情。
- 点击 `Use redacted context` 会显示 Trust Gate 的外发预览状态。

它不依赖后端，可直接用浏览器打开。

## 竞品/业内产品对比

| 产品/能力 | 做得好的地方 | 不足 | Personal AI Trust Console 差异 |
|---|---|---|---|
| ChatGPT Memory | saved memories + chat history，用户可查看/关闭/删除 | 平台内记忆，证据链和来源质量不透明 | 统一治理所有来源，显示证据、质量和外发策略 |
| Microsoft Recall | 屏幕快照本地存储、过滤、暂停、删除、身份验证 | 偏 OS 级回看，不处理跨 AI 记忆质量 | 不只控制捕获，还控制召回、画像、注入和回写 |
| Granola | 笔记可追溯 transcript/raw notes，会议体验清晰 | 聚焦会议，每次会议独立，个人跨场景治理弱 | 覆盖会议、消息、网页、AI 对话、操作和技能 |
| Limitless | 持续捕获对话，并通过 MCP/API 暴露给其他 AI | 捕获和开放强，但任务级可信/脱敏治理需要用户自己兜底 | 外部 AI 读取前有 Trust Gate 和 source policy |
| Notion/Workspace AI | 文档和知识库权限较成熟 | 主要治理文档，不治理个人实时行为记忆 | 面向个人全域记忆，含操作、会议、AI 对话 |
| MemMachine / Mem0 / Zep | 长期记忆基础设施和检索优化 | 多为开发者层，不是最终用户控制台 | 把 memory quality 变成用户可理解的日常工作流 |

## 用户体验原则

1. **少打扰**
   - 默认只推高影响 issue。
   - 低影响重复和噪音后台处理为 proposal，不每天打断用户。

2. **先解释，再修复**
   - 不直接给“清理 128 条”按钮。
   - 先说明这会影响哪些召回和哪些 AI 场景。

3. **原始证据不可轻易丢**
   - 原始消息/会议/网页/AI 对话默认保留。
   - 修复主要调整权重、归并视图、标记状态和外发策略。

4. **外发必须可见**
   - 任何交给外部 AI 的记忆包都要能回看 receipt。

5. **把复杂性藏在 badge 后面**
   - 用户平时看 `Confirmed`、`Stale risk`、`Sensitive`。
   - 需要时再展开完整证据和 ledger。

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 用户觉得又多了一个 inbox | 不愿处理 | 每天只显示高影响 3-5 条，支持自动批处理低风险 issue |
| 错误降权重要记忆 | 召回质量下降 | 默认可逆，不删除；保留 ledger；支持恢复 |
| 隐私分类误报过多 | 跨 AI 注入变麻烦 | source policy 可调，低风险 provider 可记住用户选择 |
| 可信分数被误解为真相 | 用户过度信任 | UI 显示 evidence count、source、confidence，而不是单一绝对分 |
| 扫描成本过高 | 影响 nightly consolidation | 分阶段扫描，优先 hash/rules，再对候选做 embedding/LLM |
| 与 confirm_requests 重复 | 产品复杂 | confirm_requests 做底层确认队列，Trust Console 做上层聚合、预览和来源策略 |

## 成功指标

### 质量指标

- Top recall 中重复片段占比下降。
- Meeting transcript 噪音进入外部 AI context 的次数下降。
- USER_CORE 中用户确认画像数量上升。
- 被用户标记为“无用/错误”的 AI 关联提示下降。

### 信任指标

- 用户点击 evidence trail 的比例。
- 用户接受 redacted context 的比例。
- 用户回看 handoff receipt 的次数。
- 外发前被 Trust Gate 拦截的敏感项数量。

### 效率指标

- 用户处理每日 Memory Health Inbox 的中位时间 < 2 分钟。
- 批量修复 proposal 接受率。
- AI Prompt Injection / Rehearsal / Decision 生成时的低信任警告减少。

## 实施计划

### 第 1 周：扫描和只读页面

- 新建表和 migration。
- 实现 `MemoryHealthScanner` 的 duplicate/noise/weak profile/privacy/stale 基础规则。
- 实现 overview/issues API。
- 新建页面，展示真实 issue 和 evidence。

### 第 2 周：repair proposal

- 实现 before/after preview。
- 接入 profile confirm、metadata salience、quarantine 标记。
- 批量处理低风险 duplicate/noise。
- ledger 写入。

### 第 3 周：Trust Gate

- 给 ProviderContextService 增加 trust preview。
- 给 AI Prompt Injection / Decision / Rehearsal 的 context package 增加 trust badges。
- 实现 redacted context preview。

### 第 4 周：source policy 和反馈闭环

- 来源策略页。
- 用户处理行为反馈到 source trust profile。
- 召回排序引入 trust score。
- 加验证脚本和真实数据 smoke test。

## 验证策略

这是 docs/demo 方案阶段，本轮不改 runtime code。进入实现时建议：

- 单元测试：
  - duplicate detector。
  - ASR noise detector。
  - privacy classifier rule。
  - repair proposal before/after。
  - source policy enforcement。
- 集成测试：
  - 使用 fixture DB 构造重复会议、未确认画像、敏感外发。
  - 验证 `/memory-health/overview` 和 `/trust-gate/preview`。
- 真实环境只读验证：
  - 对 `10.32.56.212` 的 `esone.qiu` 数据运行 scan dry-run。
  - 输出 issue 统计，不直接修复。
- 前端验证：
  - 静态页面截图。
  - 桌面/扩展页面交互测试。

## Open Questions

1. `Trust Console` 首屏应该放在 Desktop App，还是嵌入现有 Memory Exploring？
2. 用户是否愿意每天处理一个很短的 Memory Health Inbox，还是希望只在跨 AI 注入前提醒？
3. 对外部 AI provider 的默认策略应该保守到什么程度？
4. 原始会议 transcript 的保留周期是否需要按来源设置？
5. 是否应该允许用户创建自定义敏感词/敏感项目规则？
6. 对“人员观点/评价”类记忆，是否默认永不外发？

## 为什么这个功能值得优先考虑

Personal AI 的长期目标是成为用户自己的长期记忆真源。真源最重要的不是“什么都存”，而是用户能信任它：

- 它不会把噪音当事实。
- 它不会把过期结论继续交给 AI。
- 它不会偷偷把敏感上下文发出去。
- 它能解释每条记忆从哪里来、为什么被用、怎么被改。

这正好满足当前用户的真实需求：在高频会议、项目协调、AI 工具迁移、Jira 数据分析和跨 AI 协作中快速恢复上下文，同时保持证据、隐私和边界可控。

亮点在于：它把“记忆治理”从后端任务变成用户能看到、能修、能放心交给下一个 AI 的产品体验。对于 Personal AI 来说，这是从 PoC 走向真正私人 AI 操作系统的关键一步。
