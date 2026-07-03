# Memory Storyline Builder

*最后更新: 2026-06-28*

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

服务端不会完全信任 `available=true`：实际 `evidenceRefs` 少于 3 条、素材 cluster 总数少于 3 条，或实际会前准备证据只有日历标题/描述时，会自动降级为 `available=false` 并写入 `blockedReasons`。这条规则只影响入口提示，不会阻断用户已经打开 Draft 页后基于有效 prep 重新生成草稿。

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
- 入口回执：展示输出格式、素材组数量、证据条数、来源类型、受众/预计时长，并写明“点击后才调用 Draft API；Draft 页会重新核对 evidence refs、缺口和风险”。如果模型上报的素材估计和实际 `prep.evidenceRefs` 数量不同，回执必须同时展示“素材估计”和“实际 refs”，并优先用实际 evidence refs 补齐来源类型，避免把模型估算误读成已核验证据。
- 外发复核回执：基于当前 prep 的 `evidenceRefs`、`redactionPreview` 和 `risksOrOpenLoops` 展示私有素材数、脱敏提示数和风险提醒数，并说明它还不是外发就绪稿。这个回执不阻断打开 Draft 页，只是在用户点击生成前暴露复核范围。
- 生成按钮：打开 Storyline Draft 深链，并带上 `source=today_meeting_prep`、`prepId`、`target`、`audience`。
- `不需要`：写入 `chrome.storage.local.storylineOpportunityDismissals`，key 由 `prepId + sourceHash + eventExternalId` 组成，默认 30 天有效。点击后显示 `Storyline 提示已隐藏` 回执，说明这只是本机 suppression，不删除会前准备、证据、Draft 草稿或 Meeting Pilot handoff，也不会写回 Slides / Docs / RingCentral。
- 边界文案：条幅明确说明“只打开草稿页、复核证据后手动复制、不会自动写回外部平台”，避免把入口误读成自动发布或外部写回。

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
  generationReceipt: {
    generationMode: 'llm_grounded' | 'fallback_cue_cards';
    sourceEvidenceRefCount: number;
    citedEvidenceRefCount: number;
    returnedEvidenceDetailCount: number;
    missingEvidenceDetailCount: number;
    fallbackReason?: 'model_output_underused_or_invalid_evidence' | 'llm_generation_failed';
    boundary: 'draft_only_manual_copy_no_external_write';
  };
  artifactText: string;
}
```

P0 只支持 `today_meeting_prep` source。服务端只允许使用已有 prep、evidence refs 和 context pack，不允许编造不存在的来源；如果请求传入其他 `sourceKind`，API schema 会直接拒绝。Draft 页面也会在调用 API 前校验深链里的 `source`，不支持的来源只显示错误说明，不会伪装成 Today Pilot 请求继续生成。

如果来源 prep 没有任何可追溯 evidence refs，Draft API 会直接返回阻塞错误，而不是生成看似完整但无法核查的故事线。用户请求里的 `targetArtifact` 是权威输出格式；LLM 即使返回其他格式建议也不能覆盖用户在页面里选择的口播稿、Slides、分享帖或简报。最终 `artifactText` 由服务端从已通过证据校验的 segments/gaps/risk notes 重新渲染，并追加一个去重后的 `Evidence key`，把复制文本里的 evidence id 映射回来源类型和标题，方便离开页面后继续核查。若 LLM 返回的段落少于 3 个，或虽然有 3 个段落但引用的不同证据明显少于来源可用证据，服务端会回退到会前 cue cards，并在风险提醒里标出“已用会前准备证据重新生成可复制草稿”。如果 LLM 调用本身失败，服务端也会走同一个 cue-card fallback，`generationReceipt.fallbackReason=llm_generation_failed`，并在页面提示这是模型草稿失败后的证据绑定 fallback，而不是外发就绪稿。`generationReceipt` 是这次生成的服务端回执：页面用它展示 LLM / fallback 状态、fallback 原因、来源证据数、实际引用数、返回详情数、缺详情数，以及 `draft_only_manual_copy_no_external_write` 边界。LLM 失败只影响 Storyline draft 的生成方式，不应该破坏会前准备，也不应该让已有证据无法产出可复核草稿。

## Draft 页面

入口位于 `memory-exploring.html#/storylines/draft`，复用 `memory-exploring.html`，不新增独立 HTML。

页面结构遵循 `docs/progressing/memory-storyline-builder-demo.html`：

- 顶部：`memory-exploring · /storylines/draft`、标题、来源 chip、输出格式 segmented control、重新生成和复制按钮。
- 生成范围回执：在 coverage strip 前展示服务端 `generationReceipt`，先告诉用户这次是 LLM 草稿还是 fallback 草稿、用了多少 refs、有没有缺失证据详情，以及页面只生成可复制草稿，不写回 Slides / Docs / RingCentral、不保存长期 Storyline 历史、不发送消息。
- Coverage strip：展示当前草稿实际引用的 refs、返回给页面的证据详情数、story segments、gaps 和粗略 sendable score；避免把“返回过但没有被段落引用”的证据误读成已支撑生成稿。
- Draft tab：P0 只展示当前草稿；未来有持久化后再展示多草稿列表。
- Storyline canvas：按段落展示叙事顺序、证据 ref、shareable/internal/needs-redaction 边界。
- Inspector：展示当前段落、段落级 grounding 摘要、证据详情、缺口、风险提醒和 artifact 选择；证据卡只开放安全的内部记忆路由和 http(s) 来源链接，不安全链接显示已隐藏原因。页面还会汇总整份草稿的 `段落证据复核`：无 ref、只有 ref id、缺少证据详情、单条证据或单一来源支撑的段落会列成可点击的复核项，并纳入复制前确认。段落级 grounding 只帮助复核当前段落的证据密度和来源分布，不替代人工判断事实是否可外发。
- 来源打开回执：用户点击安全的外部来源后，Inspector 会显示 `来源打开回执`，说明这只是在新标签打开该来源；不会重新读取会前准备、刷新证据、同步 Memory Service、确认可外发、写回 Slides / Docs / RingCentral，也不会满足复制前复核。
- Artifact output：展示可复制文本，不自动写回外部平台；输出会保留每段 `Evidence refs` 和末尾 `Evidence key`，让复制到 Slides、Docs 或 RingCentral 后仍能追溯来源。若草稿仍有待确认项、风险提醒或段落证据边界，需要先勾选复核确认再复制，顶部复制按钮同步显示被阻止的复核原因；复制前复核区会列出具体清单，包含 gaps、risk notes 和可点击定位的段落证据边界，避免用户只看到数量却不知道要复核哪里。这次复核确认只绑定当前草稿，切换输出格式、重新生成、加载中或生成失败时都不能沿用旧确认复制隐藏的旧草稿。复制成功后页面显示 `复制回执`，记录本机剪贴板快照的输出格式、标题、引用 refs、返回证据详情和复核项，并说明没有写回 Slides / Docs / RingCentral、没有发送消息、没有保存长期 Storyline 历史、没有更新 Memory Service 证据状态；如果用户切换输出格式或重新生成，回执会变成 `旧复制回执`，提醒剪贴板仍是上一份输出，交付前需要重新复制。复制按钮优先用浏览器剪贴板，失败时回退到临时 textarea 复制，仍失败才提示用户手动选择文本。

同一 `prepId/source/target/audience` 的生成结果用 `sessionStorage` 缓存，避免刷新反复打 LLM。命中缓存时页面显示 `会话缓存回执`，说明这次没有重新调用 Draft API、重新读取会前准备、刷新证据详情、同步 Memory Service 或确认外发状态；会议资料或证据刚变化时应点 `重新生成`。缓存必须同时匹配来源和输出格式；用户快速切换输出格式时，旧请求晚返回不能覆盖当前选择。点击 `重新生成` 会清除当前缓存并重新请求。不支持的 `source` 深链不会展示生成、重新生成或复制控件，避免用户在错误来源上继续操作。

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

## 参考

- [Microsoft Teams intelligent recap](https://support.microsoft.com/en-us/teams/meetings/recap-in-microsoft-teams)：成熟会议 AI 会把摘要、任务、分享和敏感度限制放在 recap 流程里，支持 Storyline 的人工复核/手动复制边界。
- [Google Meet take notes for me](https://support.google.com/meet/answer/14754931)：会议记录功能强调 consent、host controls、分享范围和输出文档归属，支持 Storyline 在生成前后持续暴露来源/分享边界。
- [PowerPoint Copilot speaker notes](https://support.microsoft.com/en-US/PowerPoint/copilot/add-speaker-notes-to-your-presentations-using-copilot)：生成 speaker notes 后仍需要用户 review 并选择 keep/discard，支持这里不自动写回 deck。
- [Attribution, Citation, and Quotation: A Survey of Evidence-based Text Generation with LLMs](https://arxiv.org/html/2508.15396v1)：证据型生成的核心是 traceability / verifiability，因此 Storyline 的服务端生成回执要直接暴露证据引用和 fallback 状态。
- [DocuNarrator: AI-driven narrative structure generation](https://dl.acm.org/doi/full/10.1145/3803686.3803700)：叙事结构生成仍需要挑选高信号片段并核对证据，支持把 Storyline 定位成 grounded draft，而不是自动发布器。
