# 新能力：Persona Projection Contract / 身份投影合约

> 生成时间：2026-06-12 CST  
> Codex 会话标题：新能力：身份投影合约  
> Demo：[`persona-projection-contract-demo.html`](./persona-projection-contract-demo.html)

## 结论

建议设计一个新的底层能力：**Persona Projection Contract / 身份投影合约**。

它不是新的画像管理页，不是另一个上下文护照，也不是把所有记忆再做一次总览。它是一层在 Personal AI **准备代表用户说话、同步 persona、生成外部 AI context pack、投递提醒或写草稿之前**运行的场景化授权机制：

> 当前这个场景里，Personal AI 到底可以把哪些用户身份、偏好、事实、语气和证据投影出去？哪些只能本地参考？哪些必须降级为草稿、提醒用户确认，或者完全拦截？

一句话价值：

> 让 Personal AI 从“记得我很多事”升级为“知道什么时候可以代表我、代表到什么程度、哪些记忆不能越界”。

推荐先做 P0 后端 contract + 嵌入式 receipt，不做新的日常 review queue。用户只在高责任边界看到确认，例如外发、同步到外部 AI、写入公开/团队上下文、使用未确认画像、或把敏感/个人信息带出本地时。

## 为什么值得做

Personal AI 的长期目标是保存用户与 AI、网页、会议、消息、操作、偏好和 skill 的全部记忆，并在聊天、会议、Jira、其他 AI 对话中把记忆带回来。现在系统已经有很多原料：

- `User Profile` 保存长期事实、偏好、习惯和写作风格。
- `Compose Assist` 能在 RingCentral、Jira、Web AI 输入框旁生成草稿。
- `AI Context Passport` 能把任务上下文打包给其他 AI。
- `Doubao Bridge` 能把 persona、近期重点、提醒同步到豆包线程。
- `Memory Authority Contracts`、`Ephemeral Secret Vault`、`Outcome Loop`、`Scene Memory Autopilot` 已经分别处理证据权威、敏感内容、成效学习和展示模式。

但还缺一层非常关键的产品判断：

1. **画像可用不等于可代表用户发言。**  
   例如写作风格可以影响表达，但不能把“系统推断用户懂某个 release 流程”直接写成用户承诺。

2. **同一条记忆在不同场景的边界不同。**  
   Jira comment 可以用工作事实；发给外部 AI 的 context pack 可能只能带任务约束和来源摘要；豆包手机版近期重点不能混入长期 persona；会议提醒可以本地显示，但不该自动告诉参会者。

3. **用户需要低负担信任，不需要又一个审核工作台。**  
   真正高频的是“此刻这句建议为什么敢这么说 / 为什么没带出某条记忆 / 是否只是在草稿里用”，而不是每天打开一个列表复核所有系统判断。

4. **跨 AI 和 agent 场景正在把用户记忆变成可迁移资产。**  
   如果没有身份投影合约，Personal AI 很容易在上下文投递、persona 同步、agent work order、自动回复中混用个人偏好、工作事实、未确认推断和敏感资料。

## 本次输入信号

### Reminder 检查

本机 Reminders 可读，可见列表包括 `We`、`Next actions`、`Moives`、`Shopping List`、`家庭`、`人名记忆`、`宝宝需要办理`、`吃吃看`、`出门前检查`、`装修待办`、`Reading`、`菜头`、`Tasks`。

没有名为 `Personal AI` 的列表，因此本次没有从 Reminder 中抽取全新功能 idea，也没有标记任何 Reminder item done 或写备注。

### 真实记忆信号

本次按要求连接 `10.32.56.212` 查询 `esone.qiu` 的记忆，只读使用 HTTP API 与 SSH/SQLite，未写入远端数据。

关键观察：

- `GET /api/v1/stats` 可达但 health 为 degraded；stats 返回 `9888` raw messages、`8215` chunks、`13796` entities、`50383` relationships。
- 主要消息来源是 `glip` `9016` 条，其次是 `calendar` `327`、`meeting` `317`、`system` `161`、`jira` `33`、`web` `22`。真实高频场景仍是团队消息、日历会议和项目协作。
- `confirm_requests` 仍有 `28` 条 pending，样本多为 evidence resolution / decision blocker，说明系统经常接近“可以代表用户判断事实”的边界，但仍缺权威或未来变化证据。
- `reflection_threads` 有 `705` 条 active，近期大量线程在持续跟进 Jira ticket、availability、license、status、monthly limit 等事实。这说明记忆系统很勤奋，但也容易产生“事实反复追踪”与“能不能拿去代表用户说”的边界问题。
- `source_memory_capsules` 里有 `437` 条自动网页资料、`54` 条自动 Jira comment capsule、`4` 条 visual memory、`88` 次 duplicate_save。资料记忆很丰富，但是否可被外发到某个 AI / 群 / Jira comment，需要更细的 projection 决策。
- `personal_skills` 已有 active / suggestion / dismissed 三类技能，说明用户的“我会怎么做事”正在成为可迁移资产；技能、画像和外部 agent 同步都需要同一套代表边界。
- `proposed_actions` 里 `delegate_openclaw` 仍有 `58` queued、`45` failed。这个方向不适合再做一个 agent 塔台，但说明“系统替我行动/委派”已经是现实边界。
- `user_profile_items` 中长期事实和推断很多；同时真正可跨产品投递的用户偏好仍需要 `active + confirmed` 这样的硬门控。仅用 `active` 或相似度决定上下文注入，会把“知道”误当成“可代表”。

这些信号共同指向：Personal AI 已经有足够记忆和动作能力，下一层不是再捕获更多，而是给每次“代表用户”建立可计算、可解释、可回滚的身份投影边界。

## 与已有能力和 progressing 方案的边界

| 已有能力 / 方案 | 解决什么 | 本方案新增什么 |
|---|---|---|
| User Profile System | 存储、校准、导出用户画像 | 不再问“这条画像是否存在”，而是问“这个场景能否用它代表用户” |
| Compose Assist | 输入框旁生成可插入草稿 | 在生成/展示前输出 representation mode：只读提示、草稿、可插入、必须确认、禁止 |
| AI Context Passport | 把任务上下文打包给另一个 AI | Passport 是包；Projection Contract 是包里哪些身份/偏好/事实可以带出的门禁 |
| Doubao Bridge | 同步长期 persona、近期重点和提醒 | 防止长期 persona、移动上下文、提醒三条线互相串味，并留下投递边界 receipt |
| Memory Authority Contracts | 判断证据角色和事实权威 | Authority 管事实能不能成立；Projection 管事实能不能代表用户说出去 |
| Ephemeral Secret Vault | 临时秘密的写入/召回隔离 | Projection 调用 Secret Vault，决定敏感项只能本地显示、短期授权复制或完全脱敏 |
| Memory Egress Firewall（搁置） | 泛化的记忆外发控制 | 本方案更窄：只管“身份、偏好、语气、承诺、代表用户发言”的投影合约 |
| Memory Trust Console（搁置） | 全局可信治理台 | 本方案不建全局 dashboard，只在高频 surfaces 上显示局部 receipt |
| Outcome Loop / Behavioral Intimacy | 学习哪些 cue 有效 | Projection 消费这些结果，避免把被多次拒绝的写作风格或 cue 继续代表用户 |
| Working Memory Return Stack（搁置） | 试图恢复隐式意图 | 本方案不推断用户意图；它只在已有明确场景触发时做代表边界判断 |
| Agent Memory Control Tower（搁置） | 多 agent 调度和合并 | 本方案不调度 agent，只给 agent work order/context pack 生成最小授权上下文 |

## 行业趋势与竞品参考

### ChatGPT Memory 和 Project-only memory

OpenAI 的 Memory FAQ 区分 saved memories 和 chat history，并强调用户可以关闭、删除和管理记忆；ChatGPT Business release notes 里的 project-only memory 则把敏感项目上下文限制在项目空间内，不把项目外 saved memory 混入响应。

参考：

- [OpenAI Help Center - Memory FAQ](https://help.openai.com/en/articles/8590148-memory-faq)
- [OpenAI Help Center - ChatGPT Business release notes, project-only memory](https://help.openai.com/tr-tr/articles/11391654-chatgpt-business-release-notes)

启发：Personal AI 不应只有全局画像；它需要按场景、项目、目标 surface 决定哪些记忆可以参与当前代表行为。

### Claude memory import/export 和 project memory

Claude Help Center 说明 Claude 能从其他 AI 服务导入 memory，也能导出 Claude memory 用于备份或迁移；Claude projects 也支持移动 chat 来管理项目 memory。行业正在把 memory 从“某个聊天产品内部功能”推向可迁移资产。

参考：

- [Claude Help Center - chat search and memory](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context)
- [Claude Help Center - projects and memory](https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects)

启发：Personal AI 的优势是 provider-neutral，但越可迁移，越需要 scoped access、revocation 和 receipt。

### Gemini personalization 和 Privacy Hub

Gemini Privacy Hub 明确说明 saved info、instructions、past chats、connected apps、temporary chats、imported data 等不同来源的控制边界，并提示 Memory 开启时可能使用聊天中的敏感信息进行个性化。

参考：

- [Gemini Apps Privacy Hub](https://support.google.com/gemini/answer/13594961?hl=en)

启发：Personal AI 的 UI 不能只说“已个性化”；应该告诉用户“本次使用了哪些来源类别、哪些敏感/未确认内容被排除”。

### Granola 的会议记忆与分享隐私争议

Granola 这类会议产品证明“会议变成 searchable memory”是强需求；但 The Verge 2026-04 报道也提醒：外部分享链接和 AI training 默认值会直接改变用户对记忆产品的信任。

参考：

- [Granola](https://www.granola.ai/)
- [The Verge - Granola note links privacy](https://www.theverge.com/ai-artificial-intelligence/906253/granola-note-links-ai-training-psa)

启发：Personal AI 的 context pack、meeting memory 和 source capsule 一旦可以分享或投递，就必须有默认私密、明确目标、可撤回/过期的边界。

### Context engineering 正在成为 agent 可靠性的核心

Anthropic 的 context engineering 文章强调上下文要 tight、informative，不能把一堆 edge cases 塞进 prompt；OpenAI Cookbook 也把 personalization 描述为管理 stored、recalled、injected context 的过程。

参考：

- [Anthropic - Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [OpenAI Cookbook - Context Engineering for Personalization](https://developers.openai.com/cookbook/examples/agents_sdk/context_personalization)

启发：身份投影合约本质是 persona/context selection 的产品化：不要把用户的一切都塞给模型，而是按响应用途选择最小、最有用、最安全的一组身份记忆。

### 研究：记忆选择不能只看相似度

2026 年的 Response-Aware User Memory Selection 提出，个性化记忆选择应关注 memory 对响应输出的效用，而不仅是 query similarity；RUMS 报告在保持质量的同时可大幅降低计算成本。Opal 研究则强调 personal AI memory 需要在云容量、多设备和隐私之间寻找可信架构。Human Context Protocol 提出 portable、user-governed、scoped access、revocation 的偏好共享层。

参考：

- [Response-Aware User Memory Selection for LLM Personalization](https://arxiv.org/abs/2604.14473)
- [Opal: Private Memory for Personal AI](https://arxiv.org/html/2604.02522v1)
- [Robust AI Personalization Controls: The Human Context Protocol](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5403981)

启发：Personal AI 应把“这条记忆对当前输出是否有用”和“这条记忆能否越过当前边界”分开建模。

### HITL 只应该出现在高责任边界

OpenAI Agents SDK 的 human-in-the-loop 文档把 approval 用于敏感 tool calls，并支持暂停、批准/拒绝和恢复 run。

参考：

- [OpenAI Agents SDK - Human-in-the-loop](https://openai.github.io/openai-agents-python/human_in_the_loop/)

启发：身份投影合约不应该把所有个性化都变成用户审批。只有发送、外发、持久写入、权限越界、敏感内容、未确认事实代表用户时才需要打断。

## 产品定义

### 核心对象：PersonaProjection

`PersonaProjection` 是每次生成草稿、context pack、persona sync、notification copy、agent work order 前产生的短生命周期合约。

示例：

```json
{
  "id": "ppc_20260612_jira_mtr148115",
  "scene": {
    "surface": "jira_comment",
    "target": "team_visible_comment",
    "audience": "work_peer",
    "project": "MTR-148115",
    "intent": "draft_reply"
  },
  "representationMode": "draft_preview_required",
  "voiceMode": "write_as_user_after_preview",
  "allowed": [
    {
      "slot": "role",
      "value": "Scrum Master",
      "source": "confirmed_profile",
      "scope": "work"
    },
    {
      "slot": "writing_style",
      "value": "structured_status_update",
      "source": "compose_outcome_trace",
      "scope": "jira_comment"
    },
    {
      "slot": "scene_fact",
      "value": "estimate wording should preserve person-day basis",
      "source": "cue_compiler",
      "scope": "current_issue"
    }
  ],
  "blocked": [
    {
      "slot": "owner_knowledge.release_process",
      "reason": "pending_confirm_profile_item",
      "fallback": "do_not_claim_as_personal_expertise"
    },
    {
      "slot": "meeting_link_password",
      "reason": "ephemeral_secret",
      "fallback": "redacted_projection"
    }
  ],
  "approval": {
    "required": true,
    "reason": "team_visible_external_write",
    "actions": ["insert_draft", "copy_context", "send_blocked"]
  },
  "receipt": "将以草稿形式使用 3 条工作记忆；2 条未确认/敏感内容已排除。发送前仍由你确认。"
}
```

### Representation Mode

| Mode | 含义 | 示例 |
|---|---|---|
| `silent_reference` | 只在本地排序/判断中参考，不展示给用户 | 行为亲密度影响召回排序 |
| `local_hint` | 展示给用户，但不代表用户写入外部 | Memory Lens 卡片、Today cue |
| `draft_only` | 可生成草稿，但不能自动发送或同步 | Jira/RingCentral 回复建议 |
| `draft_preview_required` | 可以代表用户写草稿，插入前必须可预览 | Compose Assist 插入 |
| `context_pack_copyable` | 可复制给外部 AI，但不包含高风险身份/敏感项 | Web AI context pack |
| `provider_sync_allowed` | 可同步到已绑定 provider 的指定线程 | Doubao stable_memory/mobile_context |
| `approval_required` | 需要用户确认才可继续 | 外发、公开、跨平台、未确认事实 |
| `blocked` | 本场景禁止投影 | 敏感 secret、错误 surface、未确认 durable fact |

### Voice Mode

| Voice | 含义 |
|---|---|
| `speak_about_user` | “用户可能关心...” 这种第三方说明，可用于 AI context |
| `speak_to_user` | 面向用户自己的提示，例如 Today/Ask |
| `write_as_user_after_preview` | 草稿用用户第一人称，但必须由用户插入/发送 |
| `sync_as_personal_ai` | 以 `Personal AI` 来源说明同步，不伪装成用户本人 |
| `never_speak_as_user` | 只可引用证据，不可生成第一人称承诺 |

## 用户体验设计

### 入口 1：Compose Assist 的“代表边界”回执

用户在 Jira comment 或 RingCentral 输入框 focus 后，Personal AI 生成草稿前先生成 projection。

UI 上不弹大面板，只在 hover preview 顶部显示一句：

> 身份投影：可用 3 条工作记忆 · 已排除 2 条未确认/敏感项 · 仅生成草稿，发送前由你确认

点击 `边界` 展开小详情：

- 可用：当前项目、已确认角色、场景写作风格、强证据 cue。
- 排除：未确认 owner_knowledge、过期事实、secret vault 项。
- 为什么需要预览：这是团队可见 Jira comment。

### 入口 2：Web AI context pack 的“可带出范围”

用户在 ChatGPT / Claude / Gemini / 豆包等 Web AI 输入框旁使用 context pack 时，Projection Contract 决定：

- 是否允许带用户身份；
- 是否允许带工作项目事实；
- 是否只给 source summary，不给原文；
- 是否移除内部群组、人名、未确认画像；
- 是否加入“这些是本地记忆摘要，不是公开事实”的 disclaimer。

UI 上显示：

> 可复制给外部 AI：任务目标、3 条来源摘要、2 条约束。未带出：个人画像、未确认事实、会议密码、内部链接。

### 入口 3：Doubao Bridge 的 persona / mobile context 分流

在 Desktop App / extension 状态页里，Projection Contract 给每次同步生成 receipt：

- `stable_memory` 只能带长期 persona / voice mode；
- `mobile_context_thread` 只能带近期重点、待办、Ask 有证据答案；
- reminders 不混入长期 persona；
- 空占位包跳过；
- 外发目标线程、范围、item count、source count 可见。

### 入口 4：Quick Ask / Today / Meeting Pilot 的本地身份提示

这些入口通常不需要用户确认，但需要避免过度人格化：

- 会前准备可以说“你最近在 MTR-148115 上反复关注 estimate 口径”；
- 不能说“你承诺今天完成 BE 开发”，除非有明确外部证据和 authority；
- 可以在本地显示未确认推断，但标记“只作本地提醒，未进入对外上下文”。

## Demo

可预览 Demo：[`persona-projection-contract-demo.html`](./persona-projection-contract-demo.html)

Demo 模拟三个嵌入场景：

1. Jira comment 输入框旁的 Compose Assist 草稿和身份投影 receipt。
2. Web AI context pack 复制前的可带出范围。
3. Doubao Bridge 同步前的 persona / mobile context 分流。

## 核心工作流

### 1. Scene Frame 输入

复用或扩展现有 `SceneFrameService`：

- surface：`jira_comment` / `ringcentral_reply` / `web_ai_prompt` / `doubao_sync` / `today_brief` / `meeting_prep`。
- target：`local_user` / `work_peer` / `external_ai` / `provider_thread` / `public_link`。
- action：`show_hint` / `draft_reply` / `copy_context_pack` / `sync_provider` / `create_action`。
- authority boundary：是否外发、是否写入、是否可撤销、是否代表用户第一人称。

### 2. Candidate Memory Gathering

候选来源：

- confirmed profile items；
- writing_style scoped items；
- current scene anchors；
- cue compiler facts；
- source-memory distilled packs；
- authority contract facts；
- outcome loop policy patches；
- secret vault redacted projections；
- behavior affinity rollups；
- recent explicit user controls。

候选进入 projection 前必须带：

- `memoryRef`
- `scope`
- `sourceKind`
- `confidence`
- `authorityRole`
- `confirmedState`
- `freshness`
- `egressClass`
- `canSpeakAsUser`
- `requiresApproval`

### 3. Projection Scoring

建议用双轴评分：

```text
representational_fit =
  evidence_strength
  + scene_relevance
  + audience_match
  + user_confirmed_bonus
  + outcome_success_bonus
  - freshness_risk
  - scope_mismatch
  - privacy_risk
  - overcommitment_risk

egress_risk =
  target_externality
  + write_irreversibility
  + sensitive_content
  + unconfirmed_profile
  + personal_scope_leak
  + public_or_team_visible
```

决策：

- fit 高、risk 低：local hint 或 context pack。
- fit 高、risk 中：draft preview required。
- fit 高、risk 高：approval required。
- fit 低或 risk 极高：blocked 或 silent。

### 4. Contract Rendering

后端返回完整 contract，前端只渲染最小 receipt：

- `usedCount`
- `blockedCount`
- `mode`
- `voiceMode`
- `approvalReason`
- `scopeLine`
- `details[]`

详细项只在用户点击 `边界` / `为何` 时展开，避免高频打扰。

### 5. Outcome Feedback

把现有行为回写到 projection：

- 插入草稿后发送：该 projection 的 allowed slots 加正向信号。
- 插入后大改或删除：写作风格/事实 slot 降权。
- 复制 context pack 后继续追问成功：外部 AI context slot 加正向。
- 用户取消/拒绝：按 scene + slot 生成 suppress / caution。
- 外发被阻断后用户手动确认：记录 high-responsibility approval pattern。

这不新增日常操作，只复用已有 insert/copy/send/thumb-down/cancel/approve 事件。

## 数据模型草案

### `persona_projections`

| 字段 | 含义 |
|---|---|
| `id` | projection id |
| `scene_key` | scene frame key |
| `surface` | jira/ringcentral/web_ai/doubao/today/meeting |
| `target_type` | local_user/work_peer/external_ai/provider_thread |
| `action_type` | hint/draft/context_pack/sync/action |
| `representation_mode` | 上文 mode |
| `voice_mode` | 上文 voice |
| `approval_required` | 是否需要确认 |
| `approval_reason` | 需要确认的原因 |
| `receipt_text` | 前端短回执 |
| `created_at` / `expires_at` | 短生命周期 |

### `persona_projection_slots`

| 字段 | 含义 |
|---|---|
| `projection_id` | 所属 projection |
| `slot_type` | role/preference/style/fact/cue/source/secret |
| `memory_ref` | 来源记忆 |
| `decision` | allowed/blocked/redacted/local_only |
| `reason_code` | confirmed_profile / pending_confirm / secret / stale / scope_mismatch |
| `egress_class` | local/work/external/public |
| `source_summary` | 安全摘要 |

### `persona_projection_events`

| 字段 | 含义 |
|---|---|
| `projection_id` | 对应 projection |
| `event_type` | shown/inserted/copied/sent/cancelled/blocked/approved/rejected |
| `surface` | 来源 surface |
| `metadata_json` | 脱敏行为摘要 |
| `created_at` | 时间 |

## API 草案

### `POST /api/v1/persona/projection`

输入：

```json
{
  "sceneFrame": {
    "surface": "jira_comment",
    "targetType": "work_peer",
    "actionType": "draft_reply",
    "issueKey": "MTR-148115",
    "visibleFields": ["summary", "estimate", "assignee"],
    "audience": "team"
  },
  "candidateRefs": ["profile:language_preference", "cue:estimate_person_day"],
  "options": {
    "maxSlots": 8,
    "externalTarget": false,
    "allowUnconfirmedLocalHints": true
  }
}
```

输出：

```json
{
  "projection": {
    "id": "ppc_...",
    "representationMode": "draft_preview_required",
    "voiceMode": "write_as_user_after_preview",
    "receiptText": "可用 3 条工作记忆；已排除 2 条未确认/敏感项；仅生成草稿。",
    "usedCount": 3,
    "blockedCount": 2,
    "approvalRequired": true,
    "approvalReason": "team_visible_external_write"
  },
  "slots": []
}
```

### `POST /api/v1/persona/projection/:id/events`

记录插入、复制、发送、拒绝、取消、批准等结果，供 Outcome Loop 和行为亲密度消费。

## 实施计划

### P0：Contract engine + Compose Assist receipt

目标：先在最高频、最高风险的“代表用户写草稿”路径验证。

- 新增 `PersonaProjectionService`。
- 接入 `SceneFrameService`、profile core、Cue Compiler、Secret Vault、Authority Contract。
- `/composer/assist` 返回 `personaProjection` 字段。
- Compose Assist hover preview 顶部展示短 receipt。
- 如果 projection 为 `blocked`，前端不展示可插入 icon，改由 Memory Lens 或 local hint 告知原因。
- 行为事件复用 Compose Assist ambient calibration trace，不新增用户动作。

验收：

- Jira/RingCentral/Web AI 三类 fixture 生成不同 mode。
- 未确认 profile 不进入 `write_as_user`。
- secret vault 项只能 redacted/local-only。
- 外部 AI context pack 不带第一人称承诺。

### P1：Context Passport / Doubao Bridge projection

目标：把“上下文投递”和“provider 同步”的边界统一。

- AI Context Passport 调用 Projection Contract 决定 context pack slots。
- Doubao stable_memory / mobile_context / reminder_sync 渲染前调用 Projection Contract。
- Desktop App / extension 状态页显示同步 receipt：目标线程、范围、item count、排除原因。
- 复制 context pack 时写 projection event。

### P2：Projection outcome learning

目标：让系统学会哪类身份投影过强或过弱。

- projection events 汇入 `memory_outcome_events`。
- 对 slot 生成 scene-scoped boost/suppress/caution policy。
- 与 writing style 和 behavior affinity 分开：style 管表达，projection 管代表边界。
- 在 diagnostics 里提供只读排障视图，不做用户日常 queue。

### P3：Provider-neutral projection manifest

目标：为 MCP / external agent / skill URL 提供标准化投影协议。

- 定义 `PersonaProjectionManifest`。
- MCP server 返回 context resources 时可附带 projection manifest。
- Skill Foundry 的 public skill URL 可显示该 skill 需要哪些 persona slots，哪些被排除。
- 外部 AI import/export 场景支持 scoped access 和 revocation。

## 用户真实场景

### 场景 1：Jira comment 不再“替用户乱承诺”

用户在 MTR-148115 的 Jira comment 输入框里准备回复 estimate 口径。Personal AI 命中历史 Glip 记忆和 cue compiler，想生成一句：

> 我先按人天口径处理 original estimate，3h 可以作为补充说明。

身份投影合约检查后：

- 允许：当前 issue、estimate cue、用户已确认工作身份、Jira comment 的结构化语气。
- 拦截：`owner_knowledge.release_process` 仍 pending_confirm，不能写成“我知道 release 流程会...”。
- 模式：`draft_preview_required`，因为这是团队可见写入。

用户看到的不是大审批页，只是草稿预览上的一句 receipt。点 icon 插入，最终发送仍由用户自己完成。

### 场景 2：把上下文给 Claude/ChatGPT 时不会把“我是谁”全倒出去

用户在 Web AI 输入框里让外部 AI 帮忙分析一个 Jira 数据问题。Personal AI 生成 context pack，但身份投影合约决定：

- 可带出：任务目标、Jira key、口径约束、3 条来源摘要。
- 不带出：未确认画像、内部人名长列表、source capsule 原文、meeting password、用户长期 persona。
- 声音：`speak_about_user`，不用第一人称，不让外部 AI 误以为这些都是用户直接承诺。

用户复制前看到“可复制给外部 AI”的范围说明。如果需要更强上下文，可以展开手动勾选，但默认不外泄。

### 场景 3：豆包同步不再混淆长期人格和手机待办

早上 Desktop App 准备推送近期重点到豆包 mobile context thread。Projection Contract 发现 stable persona 与 mobile brief 的目标不同：

- stable_memory：只允许长期 persona / voice mode。
- mobile_context：允许近期重点、Ask 有证据答案、待办。
- reminder_sync：只允许待办/通知，不混入长期 persona。
- 空包或占位文本直接 skipped。

用户在同步流水里看到：“本次同步 5 条近期重点到手机版对话；长期 persona 未参与；2 条含敏感链接已脱敏。”这比一个泛泛的“同步成功”更可信。

## 成功指标

P0 指标：

- Compose Assist 中 “可插入但用户立即删除/大改” 的比例下降。
- 因未确认 profile、secret、scope mismatch 被正确 blocked/redacted 的单测覆盖。
- 用户不需要新增日常操作；显式确认只出现在外发/写入边界。
- context pack 平均 slots 更少，但用户复制后继续使用率不下降。

P1/P2 指标：

- 外部 AI context pack 的 sensitive / unconfirmed leakage 为 0。
- Doubao sync 中 skipped/blocked/target-thread receipt 可解释率 100%。
- Projection event 能回流到 outcome policy，重复被拒绝的 slot 在同场景降权。
- E2E 报告能证明同一 profile item 在 Jira、Web AI、Doubao 三个 surface 有不同投影决策。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| Receipt 太多打扰用户 | 默认只显示一句短 receipt；详情按需展开 |
| 又变成 review queue | 不建日常队列；只在外发/写入/敏感/未确认边界确认 |
| projection 太保守，个性化变弱 | Outcome Loop 记录用户插入/发送/复制后的正向结果，逐步放宽同场景 slots |
| projection 太激进，代表用户乱说 | 第一人称、外发、持久写入默认更严；pending_confirm 不进入 `write_as_user` |
| 与 Authority Contract 重叠 | Authority 判断事实真伪/证据角色；Projection 判断能否在该场景代表用户 |
| 与 Egress Firewall 重叠 | Egress Firewall 是泛化外发治理；Projection 是身份/偏好/承诺/语气的窄而高频门 |
| 规则复杂难调 | P0 只覆盖 Compose Assist 三个 surface；先用固定 reason codes + fixture eval |

## 验证建议

P0 需要的验证：

- `PersonaProjectionService` 单测：confirmed / pending / secret / stale / external target / first-person modes。
- `/composer/assist` API 测试：返回 projection 并影响 icon 展示。
- Compose Assist E2E：Jira、RingCentral、Web AI 三类页面 receipt 不溢出、不挡输入。
- Eval suite：`persona-projection-contract`，用 fixture 证明：
  - confirmed language preference 可用于 user-facing copy；
  - pending writing style 只能 draft/local hint；
  - secret link 不进 context pack；
  - external AI 不收到第一人称承诺；
  - team-visible Jira comment 必须 preview。

## 推荐决策

建议进入详细设计或 P0 实现。

理由是它补的不是“更多记忆”，而是 Personal AI 走向跨 AI、跨聊天、跨会议、跨 agent 后必须具备的代表边界。这个能力能同时提高 Compose Assist 的可信度、Context Passport 的安全性、Doubao Bridge 的同步清晰度，以及未来 Skill/Agent 外发的授权一致性。

如果要砍范围，P0 只做一件事：**在 Compose Assist 里让每条可插入草稿都带一个后端生成的 PersonaProjection receipt，并阻止未确认/敏感/越界记忆进入第一人称草稿。**
