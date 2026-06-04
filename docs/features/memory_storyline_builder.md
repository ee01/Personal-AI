# Memory Storyline Builder

*最后更新: 2026-06-04*

Memory Storyline Builder 把用户已经沉淀在 Personal AI 里的会议、消息、Jira、资料记忆、AI 对话和 skill 证据，编排成一份可人工复核、可复制到其他工具的故事线草稿。它不是 PPT 生成器，也不是自动发布器；它的价值是把“我真实经历过、讨论过、做过的事”整理成给别人讲得清楚的结构。

第一版已经从探索计划进入功能文档，因为它同时具备独立后端 route、独立 `memory-exploring` 页面和专用 E2E。Today Pilot 仍是 P0 的触发入口；Storyline 的生成、编辑和复制体验由本文维护。

## 用户体验

P0 只在 Today Pilot 会前准备里提示，不自动生成，也不要求用户去一个平台新建项目。

典型路径：

1. Today Pilot 在 nightly/backfill meeting prep 中读取日历事件、召回证据并调用 LLM。
2. LLM 附带输出 typed `storylineOpportunity`，判断这场会议是否值得提示生成故事线。
3. RingCentral Video Home 的会前准备卡片在摘要和 cue cards 之间展示轻条幅。
4. 用户点击生成后打开 `memory-exploring.html#/storylines/draft?source=today_meeting_prep&prepId=...&target=...`。
5. Storyline Draft 页面调用 `POST /api/v1/storylines/draft`，生成 3-6 段草稿、证据 refs、缺口、风险提醒和可复制 artifact。
6. 用户在页面内复核段落、证据和风险后，手动复制 speaker notes、Slides outline、RingCentral post 或 Docs brief。

当前不会自动写回 Slides、Docs、RingCentral 或外部 AI，也不会在后台批量生成 Storyline 历史。`memory-exploring.html#/storylines` 只是管理入口占位，用来说明 P0 需要从会前准备深链进入。

## Opportunity 判定

`storylineOpportunity` 不是关键词匹配。关键词可以作为降低成本的弱 prefilter，但最终展示必须由 meeting prep LLM 基于完整上下文判断。

展示条件：

- 表达意图成立：这场会需要给别人讲述、汇报、培训、复盘、同步进展或解释方案。
- 素材规模足够：至少能形成 3 个 story segment，且证据不只来自日历标题本身。
- 受众可判断：能推断目标受众是团队、社区、项目干系人、会议参与者或文档读者。
- 风险边界可控：私聊、内部 Jira、meeting URL 或未确认推断不会被包装成可直接外发内容。
- 输出物明确：能落到 speaker notes、Slides outline、RingCentral post 或 Docs brief。

普通 daily sync、普通 1:1、只需要一两条 cue 的会议默认不提示。证据不足时可以返回 `available=false` 和 `blockedReasons`，前端不展示入口。

服务端不会完全信任 `available=true`：素材 cluster 总数少于 3 条，或实际会前准备证据只有日历标题/描述时，会自动降级为 `available=false` 并写入 `blockedReasons`。这条规则只影响入口提示，不会阻断用户已经打开 Draft 页后基于有效 prep 重新生成草稿。

```ts
interface StorylineOpportunity {
  available: boolean;
  confidence: number;
  storyType?: 'sharing' | 'status_report' | 'retro' | 'training' | 'proposal' | 'weekly_update';
  buttonLabel?: string;
  oneLineReason?: string;
  audienceHint?: string;
  estimatedLengthMinutes?: number;
  evidenceClusters?: Array<{
    label: string;
    sourceKinds: string[];
    evidenceCount: number;
  }>;
  blockedReasons?: string[];
  suggestedArtifact?: 'speaker_notes' | 'slides_outline' | 'ringcentral_post' | 'docs_brief';
}
```

## Today Pilot 入口

Today Pilot 是 P0 的唯一自动提示面，细节仍见 [today_pilot.md](./today_pilot.md)。

UI 规则：

- 插入位置：meeting prep summary 之后、cue cards 之前。
- 展示条件：`available=true`、本地没有 dismiss、prep 仍在有效时间窗口。
- 条幅内容：一句 `oneLineReason`、素材 cluster、生成按钮和 `不需要`。
- 生成按钮：打开 Storyline Draft 深链，并带上 `source=today_meeting_prep`、`prepId`、`target`、`audience`。
- `不需要`：写入 `chrome.storage.local.storylineOpportunityDismissals`，key 由 `prepId + sourceHash + eventExternalId` 组成，默认 30 天有效。

这条 suppression 不复用 Day Pilot card feedback，因为它不是 mission/card 级反馈。

## Draft API

```ts
POST /api/v1/storylines/draft
{
  sourceKind: 'today_meeting_prep',
  prepId: string,
  targetArtifact?: 'speaker_notes' | 'slides_outline' | 'ringcentral_post' | 'docs_brief',
  audienceHint?: string
}
```

返回：

```ts
interface StorylineDraftResponse {
  id: string;
  sourceKind: 'today_meeting_prep';
  sourceId: string;
  title: string;
  audience: string;
  targetArtifact: 'speaker_notes' | 'slides_outline' | 'ringcentral_post' | 'docs_brief';
  segments: Array<{
    title: string;
    intent: string;
    narrative: string;
    evidenceIds: string[];
  }>;
  evidence?: ComposerAssistEvidence[];
  gaps: string[];
  riskNotes: string[];
  artifactText: string;
}
```

P0 只支持 `today_meeting_prep` source。服务端只允许使用已有 prep、evidence refs 和 context pack，不允许编造不存在的来源；如果来源 prep 没有任何可追溯 evidence refs，Draft API 会直接返回阻塞错误，而不是生成看似完整但无法核查的故事线。用户请求里的 `targetArtifact` 是权威输出格式；LLM 即使返回其他格式建议也不能覆盖用户在页面里选择的口播稿、Slides、分享帖或简报。最终 `artifactText` 由服务端从已通过证据校验的 segments/gaps/risk notes 重新渲染，并追加一个去重后的 `Evidence key`，把复制文本里的 evidence id 映射回来源类型和标题，方便离开页面后继续核查。若 LLM 返回的段落没有足够有效证据，服务端会回退到会前 cue cards，并在风险提醒里标出“已用会前准备证据重新生成可复制草稿”。LLM 失败只影响 Storyline draft，不应该破坏会前准备。

## Draft 页面

入口位于 `memory-exploring.html#/storylines/draft`，复用 `memory-exploring.html`，不新增独立 HTML。

页面结构遵循 `docs/progressing/memory-storyline-builder-demo.html`：

- 顶部：`memory-exploring · /storylines/draft`、标题、来源 chip、输出格式 segmented control、重新生成和复制按钮。
- Coverage strip：展示证据 refs、story segments、gaps 和粗略 sendable score。
- Draft tab：P0 只展示当前草稿；未来有持久化后再展示多草稿列表。
- Storyline canvas：按段落展示叙事顺序、证据 ref、shareable/internal/needs-redaction 边界。
- Inspector：展示当前段落、段落级 grounding 摘要、证据详情、缺口、风险提醒和 artifact 选择；证据卡只开放安全的内部记忆路由和 http(s) 来源链接，不安全链接显示已隐藏原因。段落级 grounding 只帮助复核当前段落的证据密度和来源分布，不替代人工判断事实是否可外发。
- Artifact output：展示可复制文本，不自动写回外部平台；输出会保留每段 `Evidence refs` 和末尾 `Evidence key`，让复制到 Slides、Docs 或 RingCentral 后仍能追溯来源。若草稿仍有待确认项或风险提醒，需要先勾选复核确认再复制，顶部复制按钮同步显示被阻止的复核原因。复制按钮优先用浏览器剪贴板，失败时回退到临时 textarea 复制，仍失败才提示用户手动选择文本。

同一 `prepId/source/target/audience` 的生成结果用 `sessionStorage` 缓存，避免刷新反复打 LLM。缓存必须同时匹配来源和输出格式；用户快速切换输出格式时，旧请求晚返回不能覆盖当前选择。点击 `重新生成` 会清除当前缓存并重新请求。

## 与其他能力的边界

- Today Pilot：负责判断和提示，不负责生成完整 Storyline。
- Compose Assist：P0 不接入；未来只有在用户输入明确要求长表达材料时才提示。
- Memory Lens：P0 不接入；未来可在用户打开 Slides/Docs/AI 写作页面时提示。
- Google Slides Analyzer：Storyline 只输出 outline/speaker notes，不批量写回 deck。
- Personal Skill Foundry：skill 是可执行流程，Storyline 是面向人类受众的讲述结构。

## 验证

关键验证脚本：

- `npm --prefix memory-service test -- --run src/__tests__/api-today-pilot-meeting-prep.test.ts src/__tests__/api-storylines.test.ts`
- `npm --prefix memory-service run build`
- `npm start`，等待第一次 webpack compile 成功后停止
- `node tools/verify-storyline-video-home-e2e.mjs`
- `node tools/verify-storyline-draft-page-e2e.mjs`

若要在真实记忆库端到端验证，先确认远端 `GET /api/v1/today-pilot/meeting-prep/resolve` 返回的 prep 中 `storylineOpportunity.available=true`，再刷新 RingCentral Video Home 对应会议；条幅应出现在摘要和 cue cards 之间。
