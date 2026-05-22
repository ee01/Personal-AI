# 新能力：Ambient Recall Calibration / 无感记忆校准层

> Codex 会话标题建议：新能力：无感记忆校准层  
> Demo：[`recall-calibration-studio-demo.html`](./recall-calibration-studio-demo.html)  
> 生成时间：2026-05-21  
> 重要修订：本方案从“Recall Calibration Studio / 记忆召回校准台”改为“Ambient Recall Calibration / 无感记忆校准层”。用户不应该上一个平台逐条核对记忆；校准必须发生在用户真实完成工作的一刻。

## 结论

继续做“记忆校准”，但不做成一个让用户专门打开、逐条审核的平台。

新的产品承诺是：

> Personal AI 在用户自然写消息、开会、查看提示、复制 context pack、确认行动项、改写 AI 建议的过程中，自动捕捉“这次记忆有没有帮上忙、哪里需要调”的弱信号和强信号，把它们沉淀成召回策略、措辞偏好、场景别名和个人回归样本。

用户感受到的不是“请你来校准系统”，而是：

- Compose Assist 越来越少给无关建议。
- 同一个人、同一个群、同一个项目里的省略语和“那个”更容易被理解对。
- 会议行动项、Today Pilot mission、Memory Lens 卡片更贴近用户真正会处理的事情。
- 用户改过的措辞会成为风格和证据选择样本，而不是一次性消失。

## 为什么要改方向

用户不会长期维护一个“记忆校准平台”。如果召回不准，真实用户的反应通常不是去逐条打标签，而是：

1. 忽略提示。
2. 自己手写回复。
3. 改掉 AI 给的措辞。
4. 关闭/静默某个提示。
5. 在会议行动项里直接修 owner、deadline、标题。
6. 最后觉得系统“不懂我”，放弃使用。

所以校准不应该变成用户的新工作。校准应该藏在这些自然行为里。

## 本次输入信号

### 现有功能已经有可用的自然反馈点

`docs/features/compose_assist.md` 当前已经定义：

- hover icon 时展示建议。
- 点击 icon 或预览内插入建议。
- 用户继续编辑草稿时旧建议会收起并重新 debounce。
- thumb-down 会降低同类建议出现概率。
- accepted/rejected 会调节 `COMPOSER_GUARD_CONFIDENCE_THRESHOLD`。
- RingCentral / Jira 输出必须是可发送正文，Web AI 输出是 context pack。

这说明 Compose Assist 已经具备一个更强的校准闭环：**send message / submit comment 那一刻**可以比较“系统建议文本”和“用户最终发出去的文本”。

`docs/features/memory_lens.md` 当前已经定义：

- Rest / Hover Peek / Expanded Card。
- “在记忆中查看”“有用”“不相关”“今天不提示”“站点静默/屏蔽”。
- 选中文本入口，点击后才查找关联记忆。
- 负反馈会进入 `/feedback` 并影响后续召回。

这说明 Memory Lens 可以用 hover、展开、打开来源、静默、忽略等行为做弱校准，不必要求用户显式评分。

`docs/features/today_pilot.md` 当前已经定义：

- mission card 的 done / later / mute / wrong / useful。
- copy context pack。
- meeting prep resolve / refresh。
- 反馈影响下一次排序。

这说明 Today Pilot 可以从“用户是否处理 mission、是否复制 context pack、是否稍后/静默”学习哪些记忆组合真正有行动价值。

`docs/features/meeting_pilot.md` 当前已经定义：

- 会前准备 cue 可以一键加入行动项。
- 行动项支持确认、忽略、完成、编辑标题/负责人/截止、人工新增。
- 行动项保留证据句和时间线锚点。
- 被忽略行动项不进入会议 recap 主行动项列表。

这说明 Meeting Pilot 的行动项 review 本身就是高质量校准数据：用户不是在“标注”，而是在把会议跟进清单整理成能用的状态。

### 真实记忆信号

远端 `10.32.56.212` 的 `esone.qiu` 数据显示：

- 记忆主要来自 Glip/RingCentral、meeting、calendar、system、Jira。
- 真实召回样本包括 Codex/Jira 经验、huashu-design skill、Nova Wiki、Sean Jira board 请求。
- 这些样本都有“语义相关但场景价值不同”的问题：同一条 Codex/Jira 记忆在 AI 工具讨论里有用，在具体项目 ready 查询里可能是噪音。

因此校准重点不是让用户逐条审核全库，而是让系统从真实任务动作里学到：

- 这个场景下哪个 source 更应该排前。
- 哪些泛主题应该降权。
- 哪些省略词、别名、人名和项目锚点应该绑定到当前会话。
- 用户最终采用了什么措辞和证据组合。

## 与已有方案的边界

| 已有方案 | 主对象 | 本方案边界 |
|---|---|---|
| Memory Lens | 当前页面/选中文本旁的关联记忆展示 | 无感校准层消费 Lens 的 hover/click/open/mute/ignore 行为，不新增 Lens 入口 |
| Compose Assist | 输入框旁的建议文本和 context pack | 无感校准层优先从 Compose 的 send-time diff 学习匹配质量和措辞偏好 |
| Today Pilot | 今日 mission、会前准备、context pack | 无感校准层从 done/later/mute/wrong/copy/open 学习任务级排序 |
| Meeting Pilot | 会中提醒、行动项、会后复盘 | 无感校准层从行动项确认、编辑、忽略、人工新增学习会议抽取与召回质量 |
| User Profile System | 长期事实、偏好、习惯、兴趣 | 无感校准层不替代画像确认，只产出召回策略和少量候选偏好 |
| Memory Trust Console（搁置） | 全局可信、冲突、隐私治理 | 本方案不做治理平台，只处理真实使用中的召回/建议质量 |
| Context Gap Radar | 短问句缺少锚点时的澄清 | 本方案把用户自然完成后的结果回流成别名/锚点，不默认打断用户澄清 |
| Reality Check（搁置） | AI 输出事实核验 | 本方案校准检索和建议前半段，不做 claim-level 审稿 |

## 核心原则

### 1. 校准发生在任务完成时

不要在提示出现时就要求用户给理由。最有价值的校准点通常是任务完成时：

- 消息发送。
- Jira comment 提交。
- Web AI prompt 发送。
- mission 被打开/复制/标记完成。
- 会议行动项被确认/编辑/忽略/完成。
- 用户打开了某条记忆来源并停留。

### 2. 用行为信号分层，不把所有忽略都当负反馈

用户没点不一定是不相关，可能只是忙。信号要有强弱：

- 强正：插入建议后基本原样发送；打开来源后复制/引用；确认行动项；复制 context pack 后粘贴到 AI。
- 中正：hover 后展开；展开后打开来源；mission 打开后跳到相关页面。
- 弱负：hover 但不插入，随后用户自己发送了语义不同回复；Expanded Card 很快关闭；mission 多次出现但未处理。
- 强负：thumb-down、wrong、mute、站点屏蔽、行动项忽略、用户删除插入文本后发送完全不同内容。
- 修正样本：用户编辑建议文本后发送、编辑行动项 owner/deadline/title、人工新增 AI 漏掉的行动项。

### 3. 先学习局部策略，再考虑全局

校准规则默认只作用在窄场景：

- RingCentral group/thread。
- Jira issue/project。
- Meeting series。
- Web AI provider。
- Today Pilot mission cluster。

只有多次跨场景一致，才升级为全局别名或偏好。

### 4. 用户可见的是效果，不是标注工作

普通用户不应该看到“待校准 37 条”。最多在设置或诊断里显示：

- Personal AI 已根据你最近的编辑自动调整了 3 条召回偏好。
- 你可以撤销最近的自动学习。
- 某个站点/群组已降低提示频率。

## 无感校准场景设计

### 场景 1：Compose Assist send-time diff

这是最强、最应该优先实现的路径。

#### 行为链路

1. 用户在 RingCentral / Jira / Web AI 输入框 focus。
2. Compose Assist 生成建议，带有 evidence ids、query intent、scene key、suggestion text。
3. 用户可能：
   - hover 预览但不插入。
   - 插入后原样发送。
   - 插入后修改措辞再发送。
   - 插入后删除并自己写。
   - 完全没插入，但自己发送了一段回复。
4. 在 send message / submit comment / send prompt 那一刻，前端捕捉最终文本，生成本地 diff summary，写入校准事件。

#### 信号解释

| 用户行为 | 校准含义 |
|---|---|
| 插入后几乎原样发送 | 记忆匹配 + 语气 + 输出格式都正确，提升当前 scene/source/evidence 权重 |
| 插入后小幅修改措辞发送 | 记忆匹配大概率正确，但语气、称呼、结构或冗余需要学习 |
| 插入后删掉大段证据，只保留一句 | 证据匹配可能正确，但输出太长或重点不清 |
| 插入后完全删除并发送另一段 | 建议不可用，降低同 evidence / same scene 的匹配 |
| hover 预览未插入，随后用户自己发送 | 如果最终回复与建议主题相近，说明“匹配对、措辞错”；如果主题不同，说明“匹配错” |
| 固定预览打开后复制 context pack | Web AI 场景中视为高价值正信号，但需要等待是否继续编辑 prompt |

#### 可学习内容

- `recall_positive`: 哪些 evidence 真能支撑用户回复。
- `recall_negative`: 哪些 evidence 被用户忽略或删除。
- `style_delta`: 用户把“我这边先补充”改成了更自然的说法。
- `compression_delta`: 用户删除了哪些冗余背景。
- `audience_tone`: 同样事实在老板、开发群、Jira comment、Web AI prompt 的措辞差异。
- `sendable_pattern`: 用户最终发送的格式如何组织。

#### 隐私边界

- 不保存完整最终消息作为全局训练语料。
- 默认保存短 diff summary、hash、证据 id、编辑类型和少量安全片段。
- 对一对一私聊、敏感字段、token、API key、会议链接等做 redaction。
- 用户可在设置里关闭“从发送后的编辑中学习”。

### 场景 2：Memory Lens engagement trail

Memory Lens 不生成回复，但它能通过用户是否深入查看来判断召回是否有价值。

#### 行为链路

1. Rest icon 出现。
2. 用户可能 hover、展开、打开记忆、打开来源链接、复制片段、关闭、静默站点。
3. 系统把这些行为转成低打扰校准信号。

#### 信号解释

| 用户行为 | 校准含义 |
|---|---|
| hover 后点击 Expanded Card | 当前页面触发点有一定价值 |
| Expanded Card 打开后点击“在记忆中查看” | 当前 evidence 对用户有价值 |
| 打开来源链接并停留 | source/evidence 高价值 |
| 快速关闭 Expanded Card | 可能是标题吸引但内容不匹配，只做弱负 |
| 同站点多次忽略 p2 记忆 | 降低该 host/contextType 的展示频率 |
| 点击“今天不提示 / 站点静默” | 强负，作用到 surface/site |
| 选中文本后主动点击 Lens icon | selected_text 触发是强意图，命中结果应进入高质量样本 |

#### 可学习内容

- 页面 host 到 source type 的偏好。
- selected text 的实体/关键词如何映射到历史记忆。
- 哪些 displayPriority=p2 的提示其实用户从不打开。
- 哪些 title/snippet 会吸引点击但打开后被快速关闭。

### 场景 3：Today Pilot mission outcome

Today Pilot 是任务级入口，适合校准“哪些记忆组合值得变成今日提醒”。

#### 行为链路

1. Today Pilot 生成 mission card。
2. 用户可能展开、复制 context pack、打开目标页面、done、later、mute、wrong。
3. 系统观察 card 后续是否引导了真实行动。

#### 信号解释

| 用户行为 | 校准含义 |
|---|---|
| 展开后复制 context pack | evidence 组合和任务描述有用 |
| 打开目标页面后完成相关动作 | mission trigger 和证据有效 |
| done | 任务确实可执行；同类 trigger 可保留 |
| later | 不是错，但时机或 urgency 需要降权 |
| mute | 同类 source/cluster 在近期不应再打扰 |
| wrong | 任务聚类或证据选择错误 |
| 多次显示但从不展开 | 弱负，降低类似 mission 的 proactive rank |

#### 可学习内容

- 哪些 evidence combinations 适合成为 mission。
- 哪些日历/系统/heartbeat 信号只是噪音。
- 用户对 meeting prep、Jira follow-up、skill suggestion、relationship follow-up 的处理偏好。

### 场景 4：Meeting Pilot action item review

会议行动项是天然的高质量校准样本，因为用户会为了真实跟进而编辑它。

#### 行为链路

1. Meeting Pilot 从 transcript / Today Pilot handoff / context recall 中生成行动项或 cue。
2. 用户确认、忽略、完成、编辑标题/负责人/截止、人工新增漏项。
3. 这些改动回流到会议召回、行动项抽取和会前准备排序。

#### 信号解释

| 用户行为 | 校准含义 |
|---|---|
| 确认行动项 | transcript evidence、owner/deadline/title 抽取正确 |
| 编辑 owner | 人物识别或 pronoun resolution 需要校准 |
| 编辑 deadline | 时间表达解析需要校准 |
| 编辑标题 | 任务压缩/措辞需要校准 |
| 忽略行动项 | 这类 transcript pattern 不应生成正式 follow-up |
| 人工新增行动项 | AI 漏掉了重要 action pattern，作为 must-have recall / extraction case |
| 会前 cue 一键加入行动项 | Today Pilot handoff 的会前记忆有用 |

#### 可学习内容

- 会议 series 内常见 owner、项目、组件、deadline 表达。
- 用户如何命名 follow-up。
- 哪些“we should / 下周 / 看一下”只是讨论，不是行动项。
- 哪些会前问题确实会变成会中任务。

### 场景 5：Ask / Search reformulation trail

Ask 和 Search 也有无感信号，但要保守使用。

#### 行为链路

1. 用户搜索或提问。
2. 用户可能点击某条结果、打开来源、复制内容、马上改写查询、追问“不是这个”。

#### 信号解释

| 用户行为 | 校准含义 |
|---|---|
| 点击结果并停留 | 正信号 |
| 复制结果或 evidence | 强正 |
| 同一 query 后立即改写，加人名/项目/时间 | 原 query 缺 anchor；把改写作为 expansion 样本 |
| 追问“不是这个 / 不是这个项目 / 还有吗” | 上一轮 top results 负样本 |
| 无点击后离开 | 弱负，不单独使用 |

#### 可学习内容

- 用户常用缩写、别名、中文/英文混写。
- 哪些 query intent 需要先查消息、Jira、会议或 profile。
- 哪些 top result 看似相关但不会被用户点击。

### 场景 6：Relationship Radar / User Profile 的自然确认

这不是本方案主入口，但可以贡献召回校准。

#### 可用信号

- 用户在人物页确认/排除关系事实。
- 用户降低某个 profile item 的影响。
- 用户从某个人物 context card 复制 context package。
- 用户在 Compose Assist 中持续删除某个人相关证据。

#### 可学习内容

- 某个人在什么项目/群/会议里重要。
- 某个 profile/preference 不应进入某些 surface 的上下文。

## 系统设计

### 新核心对象：Calibration Trace

`Calibration Trace` 是一次自然行为留下的轻量事件。它不是用户标注任务。

```ts
interface CalibrationTrace {
  id: string;
  createdAt: number;
  surface:
    | 'compose_assist'
    | 'memory_lens'
    | 'today_pilot'
    | 'meeting_pilot'
    | 'ask'
    | 'search'
    | 'relationship_radar'
    | 'user_profile';
  sceneKey: string;
  intentKey?: string;
  sourceRequestId?: string;
  action:
    | 'shown'
    | 'hovered'
    | 'expanded'
    | 'inserted'
    | 'sent_after_insert'
    | 'sent_without_insert'
    | 'edited_before_send'
    | 'deleted_before_send'
    | 'opened_source'
    | 'copied_context'
    | 'done'
    | 'later'
    | 'mute'
    | 'wrong'
    | 'confirmed'
    | 'edited'
    | 'ignored'
    | 'manual_added';
  strength: 'weak' | 'medium' | 'strong';
  polarity: 'positive' | 'negative' | 'correction' | 'neutral';
  evidenceRefs: Array<{
    type: 'message' | 'chunk' | 'entity' | 'meeting_action' | 'mission' | 'profile_item';
    id: string;
    role: 'used' | 'ignored' | 'deleted' | 'missing' | 'background';
  }>;
  redactedDiff?: {
    editDistanceBand?: 'none' | 'small' | 'medium' | 'large';
    semanticRelation?: 'same_intent' | 'narrowed' | 'different_intent';
    removedClaims?: string[];
    addedAnchors?: string[];
    toneChange?: 'more_direct' | 'more_polite' | 'more_formal' | 'shorter' | 'longer';
  };
  privacyClass: 'normal' | 'sensitive_redacted' | 'local_only';
}
```

### 新派生对象：Calibration Rule

Trace 不直接改变召回。后台聚合后才生成规则。

```ts
interface CalibrationRule {
  id: string;
  status: 'candidate' | 'active' | 'paused' | 'dismissed';
  ruleType:
    | 'scene_source_weight'
    | 'negative_evidence'
    | 'alias_expansion'
    | 'tone_preference'
    | 'compression_preference'
    | 'meeting_action_pattern'
    | 'mission_rank_adjustment';
  scope: {
    surface?: string;
    groupId?: string;
    issueProject?: string;
    meetingSeries?: string;
    host?: string;
    provider?: string;
  };
  learnedFromTraceIds: string[];
  confidence: number;
  effectPreview: string;
  expiresAt?: number;
}
```

### 数据表草案

```sql
CREATE TABLE ambient_calibration_traces (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  surface TEXT NOT NULL,
  scene_key TEXT NOT NULL,
  intent_key TEXT,
  source_request_id TEXT,
  action TEXT NOT NULL,
  strength TEXT NOT NULL,
  polarity TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL,
  redacted_diff_json TEXT,
  privacy_class TEXT NOT NULL,
  processed_at INTEGER
);

CREATE TABLE ambient_calibration_rules (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  learned_from_trace_ids TEXT NOT NULL,
  confidence REAL NOT NULL,
  effect_preview TEXT NOT NULL,
  rule_json TEXT NOT NULL,
  expires_at INTEGER
);

CREATE TABLE ambient_calibration_eval_cases (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  surface TEXT NOT NULL,
  scene_key TEXT NOT NULL,
  query_or_trigger TEXT,
  expected_refs_json TEXT,
  rejected_refs_json TEXT,
  source_trace_ids TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);
```

## 后端服务草案

### `AmbientCalibrationCollector`

职责：

- 接收各 surface 的 trace。
- 做敏感信息 redaction。
- 归一化 evidence refs。
- 对弱信号做节流，避免每次 hover 都写入大量噪音。

### `ComposeSendDiffService`

职责：

- 对比 `suggestionText` 与 final sent text。
- 输出 redacted diff summary。
- 判断是 style correction、compression correction、recall mismatch 还是 accepted.
- 不保存完整 final message，除非用户明确打开调试导出。

### `CalibrationRuleMiner`

职责：

- 每日或轻量后台聚合 traces。
- 同一 scene 需要多个信号才产出 active rule。
- 单个强负可以立即生成局部 suppression，但默认短期有效。
- 输出可解释 effect preview。

### `RecallCalibrationPolicy`

职责：

- 在 `ContextRecallService` / `RecallEngine` 前后应用规则。
- 支持 query expansion、source weight、negative evidence filter、scene threshold、tone/compression hint。
- 在 debug metadata 中记录 rule ids，但默认不打扰用户。

## API 草案

### 上报 trace

```http
POST /api/v1/ambient-calibration/traces
```

示例：Compose Assist 发送时上报编辑差异。

```json
{
  "surface": "compose_assist",
  "sceneKey": "ringcentral:group:35165069318",
  "sourceRequestId": "composer_20260521_001",
  "action": "edited_before_send",
  "strength": "strong",
  "polarity": "correction",
  "evidenceRefs": [
    { "type": "chunk", "id": "65147", "role": "used" },
    { "type": "chunk", "id": "65138", "role": "deleted" }
  ],
  "redactedDiff": {
    "editDistanceBand": "medium",
    "semanticRelation": "narrowed",
    "removedClaims": ["泛 AI 工具背景"],
    "addedAnchors": ["当前 thread 的 BE readiness"],
    "toneChange": "shorter"
  },
  "privacyClass": "sensitive_redacted"
}
```

### 查询最近自动学习摘要

这个接口只给设置页/诊断页，不作为主产品入口。

```http
GET /api/v1/ambient-calibration/summary
```

返回：

```json
{
  "learned": [
    "RingCentral 35165069318 中 BE ready 查询会优先当前 thread 和 Jira owner update",
    "Jira comment 建议已学习更短、更正式的回复格式"
  ],
  "pausedRules": [],
  "localOnlyTraceCount": 8
}
```

### 撤销最近学习

```http
POST /api/v1/ambient-calibration/rules/:id/pause
POST /api/v1/ambient-calibration/rules/:id/delete
```

## 实施计划

### P0：Compose Assist send-time calibration

优先做 Compose，因为它能拿到最强样本：系统建议、用户最终发送文本、真实上下文、证据列表。

范围：

- RingCentral message/thread。
- Jira comment。
- Web AI prompt 先只记录 copy/insert/send，不默认读取外部平台最终响应。

工作项：

1. Compose Assist response 带 `suggestionId`、`sourceRequestId`、evidence ids、scene key、suggestion hash。
2. 前端记录建议生命周期：shown、hovered、inserted、previewOpened、dismissed。
3. 在 send/submit 捕获 final text，计算本地 diff summary。
4. 写入 `/ambient-calibration/traces`。
5. 后端先只存 trace，不改变排序。
6. 增加一个开发/设置页轻量摘要：“最近自动学习了什么”，可撤销。

验收：

- 插入后原样发送产生 strong positive trace。
- 插入后小幅改写产生 correction trace，包含 redacted diff summary。
- hover 不插入但用户发送自己的回复，产生 weak/medium trace。
- 敏感文本不保存原文。
- 不影响现有 Compose Assist 展示阈值逻辑。

### P1：Memory Lens engagement calibration

范围：

- Rest shown。
- hover peek。
- expanded。
- open memory / open source。
- close quickly。
- mute/block site。
- selected text lookup。

工作项：

1. 对 hover 写入节流：同 page/session 只保留聚合计数。
2. open memory/source 作为中强正信号。
3. quick close 只是弱负，不单独降权。
4. site mute/block 直接生成 surface/site 级 suppression rule。
5. selected text click + source open 进入 eval case。

验收：

- 用户打开来源后，同类 context source weight 提升。
- 同一站点多次忽略 p2 后，展示频率下降。
- 站点静默不会被后台学习自动撤销。

### P2：Meeting Pilot review calibration

范围：

- 行动项 confirm / ignore / complete。
- edit owner/deadline/title。
- manual added action item。
- Today Pilot cue 加入行动项。

工作项：

1. 行动项 review 写 calibration trace。
2. 编辑 owner/deadline/title 产出 extraction correction。
3. 忽略行动项降低同类 transcript pattern。
4. 人工新增项成为 meeting_action eval case。
5. 同 meeting series 内优先生效，不全局扩散。

验收：

- owner 被用户反复修改时，同 meeting series 里的 owner inference 调整。
- 被忽略的泛泛 “we should” pattern 不再频繁进入待复核。
- 人工新增行动项能成为后续抽取 must-have 样本。

### P3：Today Pilot mission outcome calibration

范围：

- expand / open target / copy context pack。
- done / later / mute / wrong。
- meeting prep refresh / resolve。

工作项：

1. copy context pack + open target 作为正信号。
2. later 调整时机，不视为错误。
3. mute/wrong 生成 mission cluster suppression。
4. 多次不展开只作为弱负。
5. mission 排序读取 calibration policy。

验收：

- 泛系统通知、heartbeat、无行动日历壳被持续降权。
- 用户经常复制的 context pack 类型更容易进入 top 3。
- later 不会误伤同类 mission，只调整 urgency/time window。

### P4：Ask/Search reformulation calibration

范围：

- clicked result。
- opened source。
- copied evidence。
- query reformulation。
- “不是这个”类追问。

工作项：

1. 记录 query session id。
2. 把连续改写合并成一个 reformulation trace。
3. 提取新增 anchors，例如人名、项目、时间、source type。
4. 只在多次重复后生成 alias/query expansion rule。

验收：

- “AI VBG 的 BE”这类 query 能从用户后续改写中学习锚点。
- 无点击离开不直接作为强负。

## 用户体验

### 主体验

没有新的“校准平台”。

用户在原场景里只看到原本该做的事：

- 写消息。
- 看 Memory Lens。
- 处理 Today Pilot。
- 开会确认行动项。
- 搜索或 Ask。

### 可见控制

只在设置/诊断里提供很轻的控制：

- `允许 Personal AI 从我发送前的编辑中学习`
- `允许从 hover / 点击 / 静默行为中调整提示频率`
- `查看最近自动学习`
- `撤销最近 7 天学习`
- `暂停某个群组/站点的自动学习`

### 不做的 UI

- 不做“待校准列表”作为日常入口。
- 不做让用户逐条选 expected / rejected evidence 的任务流。
- 不默认弹出校准原因表单。
- 不在用户发送消息后打 toast 说“已学习”，避免显得监控感太强。

## Demo 说明

Demo 文件：[`recall-calibration-studio-demo.html`](./recall-calibration-studio-demo.html)

新版 demo 不再模拟一个独立平台，而是模拟四个真实使用 surface：

1. RingCentral Compose Assist：用户 hover、插入建议、修改后发送，系统在 send 时后台生成校准 trace。
2. Memory Lens：用户展开卡片、打开来源或静默站点，后台调整 source weight。
3. Today Pilot：用户复制 context pack、later、mute、wrong，后台调整 mission 排序。
4. Meeting Pilot：用户编辑/确认/忽略行动项，后台学习 action extraction pattern。

右侧只显示“后台学习摘要”，相当于设置/诊断视图，不是要求用户每天处理的工作台。

## 真实使用场景

### 场景 A：Compose Assist 建议对了记忆，但措辞需要用户改

用户在 RingCentral 回复里看到 Compose Assist 建议：

> 我这边先补充几个相关点：之前 Patricia 提到 Codex 可以直连 Jira...

用户插入后改成：

> 可以，我理解这里先按当前 thread 的 BE readiness 看，不把 Codex/Jira 工具分享混进来。现在关键是 owner update 和 review 状态。

发送时系统学习：

- 这次并不是完全无关，因为用户保留了当前 thread / BE readiness。
- Patricia 的泛 AI 工具分享被删除，应在这个 scene 降权。
- 用户更喜欢短、直接、带当前判断的回复。

下一次同群里出现“那个 BE ready 了吗”，Personal AI 优先找当前 thread、Jira owner update、最近 standup，而不是泛 AI 工具讨论。

### 场景 B：Meeting Pilot 行动项被用户改 owner

会议中系统抽取：

> 跟进 Nova Brandy BE blocker，Owner: Esone，Deadline: 本周五。

用户把 owner 改成 Felix，并确认。

系统学习：

- 当前 meeting series 里 “Felix take BE blocker” 这类表达之前被错归给 Esone。
- owner inference 需要更重视发言句中的名字和前后文，而不是默认当前用户。
- 这条 corrected action item 进入 meeting_action eval case。

用户没有做额外标注，只是在整理真实跟进清单。

### 场景 C：Today Pilot mission 被 later，不是 wrong

Today Pilot 给出一个 “整理 Nova Wiki / Jira rules” mission。用户点 later 6 小时，而不是 wrong。

系统学习：

- 这条不是错误召回。
- 它可能时机不对或优先级过高。
- 同类 mission 的 urgency 降低，但 source/evidence 不进入负样本。

这避免了把“稍后处理”误学成“永远不相关”。

## 风险与控制

### 风险 1：把用户忽略误判为不相关

控制：

- 无点击/无 hover 只作为弱信号。
- 只有重复发生或和强信号组合后才影响排序。
- later 不等于 wrong。

### 风险 2：监控感太强

控制：

- 默认不保存完整发送文本。
- 只保存 redacted diff summary、hash、证据 id 和编辑类型。
- 设置里明确可关闭“从发送前编辑中学习”。
- 不在每次发送后弹“已学习”。

### 风险 3：局部规则污染全局

控制：

- 规则默认局部 scope。
- 跨 surface 多次一致才升级。
- 每条 rule 有过期时间和可撤销入口。

### 风险 4：编辑差异不一定代表记忆错

控制：

- diff 分类区分 recall mismatch、tone correction、compression correction、audience correction。
- 插入后小幅改写优先视为“记忆对、表达需调”，不是负反馈。
- 只有删除全部建议并发送不同主题，才作为强负。

## 推荐优先级

推荐优先级：高，但实现顺序必须从 Compose Assist P0 开始。

原因：

1. Compose Assist 的 send-time diff 能拿到最接近真实用户意图的样本。
2. 不要求用户打开新页面，不增加用户工作量。
3. 能直接改善当前最影响体验的召回准确性和可发送文本质量。
4. 可渐进接入 Memory Lens、Today Pilot、Meeting Pilot，不需要一次性改完整系统。

## 下一步如果决定实现

建议只先做 P0：

1. 在 Compose Assist 生命周期中加入 `suggestionId/sourceRequestId/sceneKey/evidenceRefs`。
2. 前端在 send/submit 时生成 redacted diff summary。
3. 新增 `/api/v1/ambient-calibration/traces`。
4. 后端只存 trace，不先改排序。
5. 用一页设置/诊断摘要证明系统确实能从自然行为中学到东西。

等 trace 数据积累后，再决定哪些规则进入 `RecallCalibrationPolicy`。
