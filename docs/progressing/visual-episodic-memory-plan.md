# 新能力：Visual Episodic Memory / 视觉情境记忆层

> 生成日期：2026-06-02 CST  
> Codex 会话标题建议：`新能力：视觉情境记忆层`  
> Demo：[`visual-episodic-memory-demo.html`](./visual-episodic-memory-demo.html)  
> Idea 来源：未使用 Reminder。本机 Reminders 通过 AppleScript 可见列表没有 `Personal AI` 清单，因此没有可随机选择或标记完成的全新功能 idea。本方案来自 `docs/progressing` 去重、远端 `esone.qiu` 真实记忆抽样，以及 2025-2026 年多模态 AI、screen share、visual RAG 和个人记忆产品趋势。

## 结论

建议设计一个新能力：**Visual Episodic Memory / 视觉情境记忆层**，中文 UI 可以叫 **视觉记忆** 或 **画面记忆**。

一句话：

> Personal AI 不只记住网页/聊天/会议里的文字，还要能记住用户“看到过的画面证据”：图表、截图、表格布局、按钮状态、页面视觉结构、设计稿缩略图和 AI 对话中的图片/附件，并在用户之后回到相关场景时，把这些视觉证据低打扰地找回来。

它不是 Microsoft Recall 式全量屏幕快照，也不是 Operation Memory Flight Recorder 的任务回放。它是一层更窄、更可控的多模态记忆能力：**只在用户主动保存、强信号网页、会议/Slides/Jira 等工作场景中，捕获小块视觉证据，并把它和文字、DOM、来源、项目、人、时间绑定起来。**

## 为什么值得做

Personal AI 的长期目标是保留用户与 AI、网页、会议、消息、操作、偏好、skill 等所有记忆，并在聊天、会议、其他 AI 对话等场景提供关联提示。现在系统已经覆盖很多文本和结构化记忆：

- `Memory Capture`：网页选中文本、整页高置信资料保存、source memory capsule。
- `Memory Lens / Context Recall`：在网页、消息、会议等场景做被动关联提示。
- `Compose Assist`：在外发消息或 AI prompt 前补上下文。
- `Operation Memory Flight Recorder`：在用户授权的任务窗口里记录操作 episode。
- `Personal Skill Foundry`：把反复成功的流程沉淀为 skill。
- `AI Context Passport`：把上下文交给其他 AI。

但真实用户经常记住的不是一句话，而是一个画面：

- “上次那张 Jira 状态图里黄色那块是什么？”
- “我看过一个 Slides 里关于 Cursor AI review gate 的流程图，在哪个群/会议？”
- “某个 RingCentral 线程里有人贴过一张部署截图，里面是 green 还是 red？”
- “ChatGPT/豆包给过一张表格或截图，后来我想继续问 Codex，但只剩模糊印象。”
- “我记得某个页面右上角有一个 `restore` / `debug info` 开关，怎么找回当时状态？”

这些问题文本检索很难稳定回答，因为关键线索可能来自：

- 图片里的 OCR 文本。
- 表格和图形的空间关系。
- 颜色/状态/形状，例如 red badge、yellow warning、green check。
- 截图里可见但 DOM 抓取不到的 canvas、图片、远端应用 UI。
- 用户模糊记忆中的视觉特征，例如“黄色卡片”“三列流程图”“灰色 modal 右侧的按钮”。

本次真实数据抽样也显示这个缺口和用户场景一致：

- 远端 `esone.qiu` Memory Service 可读，但 `/health` 仍显示 DB degraded；`/api/v1/stats` 返回约 `10095` 条 messages、`7433` 个 chunks、`50228` 条 relationships、`50` 个 pending confirm requests、`448` 个 queued/proposed actions。
- `/recall` 抽样显示用户近期仍高频切换 Codex、Cursor、OpenClaw、ChatGPT/豆包等 AI 工具，并关注 Jira、AI review、工具配额、Story Points estimation、AI 工程实践等工作流。
- 现有 `docs/features/doubao_bridge.md` 已记录 ChatGPT / 豆包 explorer 输入链路，但这些 AI 对话和网页材料主要被整理为文本 artifact；图片、截图、表格视觉布局还不是一等记忆对象。
- `docs/features/memory_capture.md` 明确当前不保存完整截图；`docs/features/compose_assist.md` 也写明 Phase 1 不做截图、OCR 或上传图片 binary。这说明视觉记忆不是已经实现的能力。
- `docs/progressing/operation-memory-flight-recorder-plan.md` 提到关键截图，但它的目标是“回放一次工作过程”。视觉情境记忆的目标更小：**把单个视觉证据变成可召回、可引用、可比较的 memory capsule**。

## 行业趋势与竞品参考

### Microsoft Recall：用户确实想找回“看过的画面”

[Microsoft Recall](https://support.microsoft.com/en-us/windows/retrace-your-steps-with-recall-aa03f8a0-a78b-4b3e-b0a1-2eb8ac48701c) 的核心体验是让用户通过语义搜索找回以前在 PC 上见过的内容，并把结果分为 text matches / visual matches。官方文档强调它需要用户 opt-in，快照保存在本机并加密，也提供暂停、删除、过滤 apps/websites 和敏感信息过滤。

对 Personal AI 的启发：

- “我看到过但忘了在哪里”是强需求。
- 视觉匹配不能只依赖 OCR，还要能理解图片和布局。
- 隐私控制必须是主功能，不是设置页角落。

Personal AI 不应复制 Recall 的全量屏幕快照。更好的路径是：**先做工作场景的视觉证据 capsule，默认小而精，能撤销、能解释、能回到原始上下文。**

### Gemini Live / ChatGPT Screen Share：AI 正在理解用户当前画面

Google 在 [Gemini I/O 2025 更新](https://blog.google/products-and-platforms/products/gemini/gemini-app-updates-io-2025/) 中把 Gemini Live camera and screen sharing 推给 Android/iOS 用户，强调用户可以直接“show what you mean”。OpenAI 的 [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) 也记录了 voice chats 中 real-time video、screen share、image upload 的推出。

对 Personal AI 的启发：

- 行业正在从“用户输入文字”走向“AI 看见当前画面”。
- 但 screen share 多数是即时会话能力，用户关闭会话后视觉上下文很难成为长期私人记忆。
- Personal AI 的机会是把“AI 看到过什么”沉淀成私有视觉记忆，之后可以在 Ask、Context Recall、Compose Assist、Context Passport 中再次使用。

### Notion Enterprise Search：跨工具搜索正在变成工作入口

[Notion 2.51](https://www.notion.com/releases/2025-05-13) 发布了 Enterprise Search、AI Meeting Notes、Research Mode，并支持跨 Notion 与连接工具搜索，连 PDF 也自动可搜。

对 Personal AI 的启发：

- 用户不想知道信息在哪个工具，只想找回答案和证据。
- 但企业搜索通常仍以文档/文本为主。Personal AI 面向私人使用，可以补足“我看过的图、表、页面状态、AI 对话截图”这类个人视觉记忆。

### ColPali / Visual RAG：技术上不必先 OCR 成文本

[ColPali](https://arxiv.org/abs/2407.01449) 指出文档不仅有文字，还有 figures、layout、tables、fonts 等视觉线索；传统检索只抽文本会漏掉关键视觉信息。它用 VLM 直接对页面图像生成多向量 embedding，再用 late interaction 做视觉文档检索。

[RAG-Anything](https://arxiv.org/abs/2510.12323) 进一步把 text、images、tables、equations 等多模态内容看成互联知识实体，而不是孤立数据类型，并用 cross-modal hybrid retrieval 做统一检索。

对 Personal AI 的启发：

- 第一版可以 OCR + VLM caption + DOM context 混合；后续可以接视觉 embedding。
- 视觉记忆不应该被强行降级成“截图的文字摘要”。应该保留 visual tile、region、layout、OCR、caption、source anchor，并支持图文混合召回。

## 产品定义

### 功能名

**Visual Episodic Memory / 视觉情境记忆层**

UI 中可以简称：

- `视觉记忆`
- `画面记忆`
- `视觉证据`

### 核心承诺

1. **保存用户真正“看见过”的关键画面**
   只保存用户主动点选、强信号阅读、会议/Slides/Jira/AI chat 等工作场景中的小块视觉证据，不默认全屏持续录制。

2. **让视觉证据可召回**
   用户可以用自然语言问：“那张黄色 warning 图在哪？”、“上次看到的 MTR-133897 录制权限图是什么状态？”系统返回视觉卡片和来源。

3. **让当前场景自动联想到过去画面**
   当用户再次进入相同 Jira、RingCentral 线程、Slides、AI 对话或网页，Memory Lens 可以显示一个低打扰视觉证据 chip。

4. **把图像和文字记忆连接起来**
   每个视觉 capsule 同时保留 screenshot tile、OCR、VLM caption、DOM/text context、source URL、conversation/meeting/project/entity links。

5. **隐私默认保守**
   敏感表单、密码、支付、隐身窗口、黑名单站点、用户输入框默认不保存。视觉内容被外发给云端模型前需要经过本地裁剪、打码和策略检查。

6. **不新增独立浮动入口**
   网页里的视觉记忆入口应复用现有 webpage `+ 入库` 体系。`Memory Lens` 继续负责“召回已有记忆”，`+` 继续负责“把当前内容入库”；视觉记忆只是把 `+` 的保存对象从文字扩展到视觉证据。

### 不是什么

- 不是全局录屏软件。
- 不是 Microsoft Recall 的 Personal AI 复刻。
- 不是 Operation Flight Recorder 的替代品。
- 不是把所有截图都塞进向量库。
- 不是默认把用户屏幕上传给外部 LLM。
- 不是新的截图相册。

一句边界：

> Flight Recorder 记住“我怎么做成一件事”；视觉情境记忆记住“我在哪个场景看到过这个画面证据”。

## 和已有能力的边界

| 已有能力 / plan | 解决什么 | 视觉情境记忆不重复的地方 |
| --- | --- | --- |
| Memory Capture | 保存网页文字、选区、source memory capsule | 视觉记忆保存图片/图表/表格布局/截图区域，并补 OCR + VLM caption |
| Memory Lens / Context Recall | 当前页面关联旧记忆 | 视觉记忆给 Lens 增加 visual evidence card，不改变 Lens 主流程 |
| Compose Assist | 写消息/Jira/AI prompt 时补上下文 | 视觉记忆可作为“附带证据图”进入建议，但默认不直接外发图片 |
| Operation Memory Flight Recorder | 授权任务窗口里的操作 episode | 视觉记忆是更小的视觉 capsule，可被 Flight Recorder 引用 |
| Artifact Lineage（搁置） | 成果物从哪些来源产生 | 视觉记忆只管视觉证据本身和来源，不追踪完整成果链 |
| Memory Reality Check（搁置） | 对 AI 输出做 claim 核验 | 视觉记忆提供 evidence，不负责事实裁判 |
| Memory Freshness Radar | 旧来源变化提醒 | 视觉记忆可记录 visual diff，但不负责 source watch 策略 |
| AI Conversation Memory Loom（搁置） | 多 AI 对话聚合 | 视觉记忆可保存 AI 对话中的图片/截图片段，但不合成整个对话主题 |

## 核心用户体验

### 入口 1：扩展现有网页 `+ 入库` 入口

在用户浏览 Jira、RingCentral、Google Slides、Notion、ChatGPT/豆包、技术文档或内部 dashboard 时，不新增一个和 Memory Lens 并列的新浮动入口，而是复用现有 webpage 记忆入口：

- 选区旁原有半露出 `+ 入库`：可从“入库这段文字”扩展成“入库这段文字 / 保存这块画面”。
- 页面级原有右侧 `+ 入库`：可从“入库当前页面资料”扩展成“入库当前页面正文 / 保存当前视觉证据”。
- 当页面存在高信号图表、截图、canvas、表格或流程图时，`+` 的文案、hover 态或轻量面板里显示 `保存画面`、`识别到 3 个视觉证据`、`上次保存过相似图表`。

点击后打开轻量面板：

- 当前候选区域缩略图。
- 为什么建议保存：例如 `图表 + 项目名 + 停留 90s`。
- 自动打码结果。
- OCR / caption 预览。
- 保存范围：当前区域 / 当前卡片 / 当前可见页面。
- 默认操作是 `先保存`，不要求用户在保存前先写备注。

保存后的交互建议沿用当前网页入库原则，分两步：

1. **先入库**
   用户点击 `保存视觉证据` 后立即完成入库，toast / receipt 只展示高信号反馈：`已保存`、`撤销`、`查看预览`、`此站点不再保存画面`。
2. **再展开预览和备注**
   如果用户需要确认保存了什么、补充一句备注、检查 OCR/caption、复制文字版或删除，再点 `查看预览`。展开态和备注应在同一个右侧窗体中完成，不再额外弹第二个模态。

这样做的原因：

- 保存动作保持轻，延续现有 `+ 入库` 的快速心智。
- 备注不应成为入库前置门槛，否则会显著降低保存率。
- 真正需要深看的人，可以在保存后进入“预览 + 备注”一体面板。

这里的产品边界应明确：

- `Memory Lens` icon 仍只负责“看已有相关记忆”。
- `+` 入口仍只负责“把当前内容记住”。
- 视觉记忆不应该再发明一个第三种网页浮动 affordance 去和前两者抢注意力。

### 保存后如何展开预览

保存成功后，不建议立刻自动弹出大预览。更合适的是：

- 先显示一个 **compact receipt**：
  - `已保存视觉证据`
  - `查看预览`
  - `补备注`
  - `撤销`
- 用户点击 `查看预览` 或 `补备注` 后，在同一右侧窗体展开 **saved preview panel**。

这个展开面板建议包含：

- 左上：缩略图和视觉类型。
- 右上：来源、保存时间、隐私级别。
- 中部：OCR、caption、source link、关联记忆。
- 底部：备注输入框。
- 操作区：`保存备注`、`复制文字版`、`打开原始上下文`、`删除这条视觉记忆`。

备注和预览应在一个窗体里处理，而不是两个不同弹层，因为这两件事都属于“我刚刚保存的这条视觉记忆的后处理”。

### 入口 2：Memory Lens 的视觉证据卡

当当前页面命中过去的视觉 capsule，Memory Lens 不再只显示文字记忆：

```text
------------------------------------------------+
| 视觉记忆                                      |
| 你 5 月 27 日在 Jira MTR-133897 看到过相似图 |
| [缩略图] 录制权限：host + coworkers / watch  |
| 为什么相关：同 ticket + same recording flow   |
| [查看证据] [复制给 AI 的文字版] [忽略此图]    |
+------------------------------------------------+
```

视觉证据卡默认不弹大图；需要用户点击展开。

这一步仍然属于召回，不属于入库。所以它应该沿用现有 Lens 交互，而不是和 `+ 入库` 入口混成一个按钮。

### 入口 3：Ask / Quick Ask 中的模糊视觉搜索

用户可以问：

- “上次那个黄色 warning 卡片在哪？”
- “我看过一个 Cursor AI review gate 的截图，找一下。”
- “哪次会议里有人贴过 live transcription 的权限图？”
- “帮我找图里有 `Download` / `Watch` 权限对比的那张。”

返回结果不是纯文本，而是：

- 缩略图。
- 来源 URL / 线程 / meeting。
- OCR 命中词。
- VLM caption。
- 相关文字记忆。
- 打开原始上下文的按钮。

### 入口 4：当前画面 vs 旧画面比较

当用户回到同一个 Jira ticket、Slides、dashboard 或 AI 工具页面时，可以点：

`和上次看到的画面对比`

对比结果：

- 哪些文字变了。
- 哪些 badge / 图表颜色 / 数值状态变了。
- 旧画面证据和新画面的 crop。
- 可信度和风险：OCR 可能误读、视觉模型可能把装饰色当状态色。

这个能力适合：

- Jira 状态图是否更新。
- Meeting recording 权限页面是否变了。
- AI 工具配额/价格页是否变化。
- 文档中的架构图是否换版。

## 信息架构

### Memory Exploring 新增页面

建议新增：

```text
Memory Exploring
  ├── 今日领航
  ├── 搜索
  ├── 时间轴
  ├── 资料记忆
  ├── 视觉记忆       <- 新增
  ├── 人物
  ├── 项目
  └── 技能
```

`视觉记忆` 页不是截图瀑布流，而是工作证据列表：

- 按项目 / 来源 / 时间 / 类型过滤。
- 类型：chart、table、screenshot、diagram、status badge、slide、AI image、attachment。
- 每张卡展示：缩略图、caption、OCR top terms、来源、保存原因、隐私策略、关联记忆。
- 支持 `只看可外发文字版` / `只看本机图片`。

### Source Memory Capsule 扩展

视觉 capsule 应和 `source_memory_capsules` 形成引用关系：

- 同一个网页可有文字 capsule 和多个 visual region。
- 视觉 capsule 可以挂在 source memory detail 下。
- Ask / Context Recall 返回时可以把文字和视觉证据合并成一个 evidence group。

## 核心对象模型

### Visual Memory Capsule

```ts
type VisualMemoryCapsule = {
  id: string;
  userId: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceType:
    | 'webpage'
    | 'jira'
    | 'ringcentral'
    | 'meeting'
    | 'slides'
    | 'ai_chat'
    | 'desktop_app'
    | 'file';
  captureMode: 'manual' | 'suggested' | 'auto_high_signal' | 'episode_reference';
  visualType:
    | 'chart'
    | 'table'
    | 'diagram'
    | 'screenshot'
    | 'status_badge'
    | 'slide'
    | 'image_attachment'
    | 'ui_state';
  imagePath: string;
  thumbnailPath: string;
  perceptualHash: string;
  ocrText: string;
  vlmCaption: string;
  layoutSummary: string;
  captureReason: string;
  privacyClass: 'normal' | 'work_sensitive' | 'private' | 'blocked';
  redactionSummary?: string;
  relatedMemoryIds: string[];
  relatedEntityIds: string[];
  createdAt: number;
  updatedAt: number;
};
```

### Visual Region

```ts
type VisualMemoryRegion = {
  id: string;
  capsuleId: string;
  bbox: { x: number; y: number; width: number; height: number };
  label: string;
  text?: string;
  colorSignals?: Array<{ color: string; meaning?: string; confidence: number }>;
  objectType?: 'button' | 'badge' | 'chart_bar' | 'table_cell' | 'person_avatar' | 'code_block';
  confidence: number;
};
```

### Visual Link

```ts
type VisualMemoryLink = {
  id: string;
  capsuleId: string;
  targetType: 'message' | 'meeting' | 'source_memory' | 'entity' | 'project' | 'skill' | 'operation_episode';
  targetId: string;
  relation: 'same_scene' | 'mentions' | 'explains' | 'evidence_for' | 'used_in' | 'follow_up';
  confidence: number;
};
```

## 技术设计

### 捕获层

P0 只做浏览器可见区域，避免桌面全局隐私风险：

- Chrome extension content script 识别候选区域：
  - 图片、canvas、SVG、table、chart-like DOM、Slides iframe、Jira issue panel、AI chat image attachment。
  - 用户通过现有 `+ 入库` 入口里的视觉分支，或右键/toolbar 的同源动作点 `保存画面` 时，用 `chrome.tabs.captureVisibleTab` 或 content script crop 生成视觉 tile。
  - 对跨域 iframe 无法直接 crop 时，保存外层 screenshot + region bbox + page metadata。
- Desktop App 后续接入：
  - 只在用户启用 `桌面画面记忆` 时捕获应用窗口。
  - 不做后台持续快照。

### 处理层

建议新增 `VisualMemoryService`：

1. **Preflight**
   - URL/site 黑名单检查。
   - 输入框、密码、支付、个人账号页敏感检测。
   - 图片尺寸、正文区域占比、重复 hash 检查。

2. **Redaction**
   - 本地先打码：邮箱、电话号码、token-like 字符串、银行卡/支付、头像可选模糊。
   - 保存原图策略默认 `local_only`；用于外部模型的版本必须是 redacted tile。

3. **OCR**
   - P0 可用系统 OCR / Tesseract / PaddleOCR / Vision API 之一，先保持接口抽象。
   - OCR 结果只作为 evidence，不作为 confirmed fact。

4. **VLM caption**
   - 生成短 caption：`这是一张 Jira recording permission flow 的状态截图，突出 Download / Watch 权限差异。`
   - 提取视觉类型、关键对象、颜色/状态词。

5. **Embedding**
   - P0：`ocrText + caption + DOM context` 进现有 text embedding。
   - P1：接入视觉 embedding / ColPali-like page tile embedding。
   - P2：跨模态 rerank：query text -> text candidates + visual candidates -> VLM rerank。

6. **Linking**
   - 使用 URL、title、conversation id、Jira key、meeting id、entity mentions 绑定已有记忆。
   - 不把 visual capsule 孤立成截图库。

### 召回层

`RecallEngine` / `ContextRecallService` 增加视觉候选通道：

```ts
type RecallSourceType = ExistingSourceType | 'visual_memory';

type VisualRecallItem = RecallItem & {
  source: 'visual_memory';
  thumbnailUrl: string;
  visualType: VisualMemoryCapsule['visualType'];
  ocrText: string;
  caption: string;
  redactionSummary?: string;
  visualMatchReason: string;
  openInContextUrl?: string;
};
```

召回策略：

- Ask/Quick Ask：允许显式视觉搜索。
- Context Recall / Memory Lens：默认只返回强相关 visual memory，避免弹图噪音。
- Compose Assist：默认只提供文字化 caption/OCR，不直接外发图片；用户明确点击才附图。
- Context Passport：只导出 caption + OCR + source link；图片本体默认 `local_only`。

## 用户体验原则

### 1. 视觉证据不等于事实

UI copy 必须避免把视觉模型 caption 写成确定事实：

- 好：`图中疑似显示 Download / Watch 权限差异`
- 差：`权限已经改为 Watch`

视觉证据卡要显示：

- `OCR 命中`
- `视觉模型判断`
- `来源上下文`
- `可信度`
- `可能误读`

### 2. 先裁剪，再理解

不要把整页/整屏直接送给模型。先识别 region，再裁剪，再打码，再做 OCR/VLM。

### 3. 默认低打扰

候选视觉记忆只在强信号出现时提示：

- 用户停留较久且滚动/缩放到图表区域。
- 用户复制/截图/下载图片。
- 页面是 Jira/Slides/meeting/transcript/AI chat 等工作来源。
- 当前页面已有高相关 text memory。

普通浏览图片、广告图、头像、装饰图不提示。

### 4. 有明确撤销和禁止

保存成功后 toast 必须有：

- `撤销`
- `查看预览`
- `此站点不再保存画面`
- `只保存文字，不保存图片`

如果当前页面已经打开 saved preview panel，则 toast 可以更短，只承担“保存成功 + 可撤销”的提醒，不必重复展示全部动作。

### 5. 图片外发必须显式

任何把图片本体交给 ChatGPT/Claude/Codex/OpenClaw/Gemini/豆包的行为，都要显式显示：

- 哪张图。
- 是否已打码。
- 会发给哪个 AI。
- 只发 caption / 发送图片本体 / 发送裁剪图。

## 隐私与安全

### 默认策略

| 场景 | 默认行为 |
| --- | --- |
| 密码/支付/登录表单 | 阻止保存 |
| 私人邮箱/个人银行/健康 | 阻止或手动确认 |
| RingCentral / Jira / Slides / Docs | 允许手动保存，自动只保存高信号区域 |
| ChatGPT/豆包/Claude/Cursor | 允许保存 AI 输出区域；输入框草稿默认不保存 |
| 图片含人脸 | 默认保留但头像可模糊；不做人脸识别 |
| 外发到其他 AI | 默认只发文字版视觉摘要 |

### 存储策略

- 原图和缩略图保存在本机或用户专属 memory data 目录。
- Memory Service 只保存路径、hash、caption、OCR、metadata。
- 支持按站点、来源、时间批量删除。
- 支持 `local_only`：可检索但不会进入外部 AI context package。

### Prompt injection

截图/OCR 里可能含恶意 prompt，例如网页图片写着“ignore previous instructions”。处理规则：

- OCR 文本永远标记为 `source_content`，不是 system/user instruction。
- 视觉 caption 进入外部 AI 前必须包在证据区，不允许混入操作指令。
- Compose Assist / Context Passport 使用 Egress Firewall 规则复核外发。

## 数据库草案

```sql
CREATE TABLE visual_memory_capsules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT,
  source_type TEXT NOT NULL,
  capture_mode TEXT NOT NULL,
  visual_type TEXT NOT NULL,
  image_path TEXT NOT NULL,
  thumbnail_path TEXT NOT NULL,
  perceptual_hash TEXT NOT NULL,
  ocr_text TEXT NOT NULL DEFAULT '',
  vlm_caption TEXT NOT NULL DEFAULT '',
  layout_summary TEXT NOT NULL DEFAULT '',
  capture_reason TEXT NOT NULL DEFAULT '',
  privacy_class TEXT NOT NULL DEFAULT 'normal',
  redaction_summary TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE visual_memory_regions (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  bbox_json TEXT NOT NULL,
  label TEXT NOT NULL,
  text TEXT,
  object_type TEXT,
  color_signals_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (capsule_id) REFERENCES visual_memory_capsules(id) ON DELETE CASCADE
);

CREATE TABLE visual_memory_links (
  id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (capsule_id) REFERENCES visual_memory_capsules(id) ON DELETE CASCADE
);

CREATE INDEX idx_visual_memory_user_time ON visual_memory_capsules(user_id, created_at DESC);
CREATE INDEX idx_visual_memory_source ON visual_memory_capsules(user_id, source_type, source_url);
CREATE INDEX idx_visual_memory_hash ON visual_memory_capsules(user_id, perceptual_hash);
```

如果现有 embedding 表支持 target type，可新增：

- `target_type = 'visual_memory_capsule'`
- `embedding_text = caption + ocr + source title + linked entities`

## API 草案

### 候选评分

```http
POST /api/v1/visual-memory/candidates/score
```

```ts
type VisualMemoryCandidateRequest = {
  sourceUrl?: string;
  sourceTitle?: string;
  sourceType: string;
  viewportMeta: {
    width: number;
    height: number;
    scrollDepth?: number;
    dwellMs?: number;
  };
  regions: Array<{
    kind: 'image' | 'canvas' | 'table' | 'svg' | 'slide' | 'ui_state';
    bbox: { x: number; y: number; width: number; height: number };
    altText?: string;
    nearbyText?: string;
    domRole?: string;
  }>;
};
```

返回：

```ts
type VisualMemoryCandidateResponse = {
  decision: 'ignore' | 'suggest' | 'auto_save' | 'blocked';
  reason: string;
  regions: Array<{
    regionId: string;
    score: number;
    reason: string;
    privacyClass: 'normal' | 'work_sensitive' | 'private' | 'blocked';
  }>;
};
```

### 保存视觉 capsule

```http
POST /api/v1/visual-memory/capsules
```

### 查询/详情

```http
GET /api/v1/visual-memory/capsules?sourceType=jira&query=recording
GET /api/v1/visual-memory/capsules/:id
POST /api/v1/visual-memory/capsules/:id/dismiss
POST /api/v1/visual-memory/capsules/:id/compare
```

### Recall 集成

```http
POST /api/v1/recall
{
  "query": "上次看到的黄色 warning 卡片",
  "sourceTypes": ["visual_memory"],
  "topK": 5
}
```

## MVP 范围

### P0：浏览器手动视觉保存 + Ask 搜索

做：

- Chrome extension 复用现有网页 `+ 入库` 入口，在面板里增加 `保存画面` / `保存视觉证据` 分支。
- 用户手动选择当前可见区域中的 image/table/canvas/SVG/DOM card。
- 保存裁剪图、缩略图、source URL/title、DOM nearby text、OCR、caption。
- 保存后先显示 compact receipt；用户点击后在同一右侧窗体展开 saved preview，并允许补备注。
- `Memory Exploring` 新增视觉记忆列表/详情。
- `/recall` 显式 `sourceTypes: ['visual_memory']` 可搜到。
- Context Recall 强相关时返回视觉证据卡。
- 本地撤销、删除、站点禁用。

不做：

- 不做后台持续录屏。
- 不做桌面全局截图。
- 不做跨 AI 自动上传图片。
- 不做视觉模型事实核验。
- 不做完整 visual diff 自动告警。

### P1：高信号自动建议 + visual evidence card

- 对 Jira、Slides、RingCentral、AI chat、docs 页面做场景 adapter。
- 只在高信号区域增强现有 `+ 入库` 的视觉提示，不新增独立浮动 chip。
- Memory Lens 支持视觉证据卡。
- Ask/Quick Ask 返回图文混合证据。
- 视觉 capsule 和 source memory detail 互相跳转。

### P2：视觉对比和工作流引用

- 当前画面和旧视觉 capsule 做 OCR/布局/状态差异比较。
- Flight Recorder 引用视觉 capsule 作为 episode step evidence。
- Skill Foundry 从视觉 episode 里提取操作前提和界面状态。
- Context Passport 可导出图片的文字化证据包。

### P3：桌面/多 AI/多模态 embedding

- Desktop App opt-in 窗口级视觉记忆。
- 对 ChatGPT/豆包/Claude/Cursor/OpenClaw 页面中的图片和截图做来源归档。
- 接入视觉 embedding / ColPali-like retrieval。
- 支持“找相似画面”。

## 竞品对比

| 产品/方向 | 它做什么 | Personal AI 视觉情境记忆的差异 |
| --- | --- | --- |
| Microsoft Recall | PC 屏幕快照时间线、语义搜索、visual/text matches | Personal AI 不做全量快照；做工作场景小块视觉证据，强绑定消息/项目/AI 对话/skill |
| Gemini Live / ChatGPT Screen Share | AI 即时看当前屏幕或摄像头 | Personal AI 把关键视觉上下文变成长期私有记忆，之后可召回/引用 |
| Notion Enterprise Search | 跨工具和 PDF 搜索 | Personal AI 面向私人多工具记忆，补 AI 对话截图、Jira/RingCentral/Slides 视觉状态 |
| Rewind / Limitless 类个人记忆 | 记录看到/听到/说过的内容 | Personal AI 更保守，不做默认全局 recording，视觉证据要有来源、隐私策略和可撤销路径 |
| ColPali / Visual RAG | 技术层视觉文档检索 | Personal AI 把 visual retrieval 产品化成低打扰 memory capsule，而不是研究 demo |

## 成功指标

### 早期定性

- 用户能通过模糊视觉线索找回正确页面。
- 视觉证据卡不让用户觉得“被截图监控”。
- 用户愿意在 Jira/Slides/AI chat 中手动保存 1-2 个关键视觉证据。
- 用户在外部 AI 对话中能用 caption/OCR context 继续任务，而不需要重新截图解释。

### MVP 量化

- 手动保存后的 7 天内 recall reuse rate。
- visual search top-3 命中率。
- visual save suggestion dismiss rate。
- 保存后撤销率。
- 敏感页面 blocked/ignored 准确率。
- 图片本体外发次数应远低于 caption/OCR 外发次数。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 用户担心被监控 | P0 只手动保存；自动只提示不保存；所有保存有 toast + 撤销 |
| 存储膨胀 | 缩略图 + 区域裁剪；hash 去重；按来源和时间清理 |
| OCR/VLM 误读 | UI 明确 `OCR` / `视觉判断` / `来源上下文`，不写入 confirmed fact |
| 敏感信息泄漏 | 本地 preflight + redaction + site blacklist + external export gate |
| 和 Flight Recorder 重叠 | 本方案只生成 visual capsule；Flight Recorder 可引用 capsule 但不由它驱动 |
| 视觉噪音过多 | 候选评分默认严格，只在工作来源和强信号区域提示 |
| 实现太大 | P0 浏览器手动保存；P1 才做高信号建议；桌面放 P3 |

## 两个真实用户场景

### 场景 1：找回 Jira 录制权限截图

用户在 RingCentral/Jira 里处理 `MTR-133897` 或 recording permission 问题。几天后用户只记得：“有一张图把 Download 和 Watch 权限放在一起对比，应该是某个线程里看到的。”

体验：

1. 用户打开 Quick Ask，输入：`找一下上次看到 Download / Watch 权限对比的那张图。`
2. Personal AI 返回视觉证据卡：缩略图、OCR 命中 `Download` / `Watch`、来源是某个 RingCentral 线程/Jira ticket、关联项目 `MTR-133897`。
3. 用户点击 `打开原始上下文` 回到线程，或点击 `复制给 Codex 的文字版` 得到已打码的 caption + source link。
4. 如果用户后续在同一个 Jira ticket 页面，Memory Lens 低调提示：`你之前保存过相似权限图`。

满足需求：

- 不再从聊天、Jira、浏览历史里重新翻图。
- 外部 AI 继续处理问题时有视觉证据摘要，不必直接泄露截图。

### 场景 2：AI 工具 CoP 前找回视觉材料

用户准备 AI 工程实践分享，记得某个 Slides/网页里有 “Cursor AI review gate” 的流程图，也记得有人在群里贴过 `Codex 可以直连 Jira` 的截图。

体验：

1. 用户在 Memory Exploring 打开 `视觉记忆`，筛选 `AI tools / Cursor / Codex`。
2. 看到一组视觉 capsule：流程图、聊天截图、工具配额图、AI review gate 截图。
3. 每张图都有来源和 OCR/caption，用户点 `加入 Storyline 素材`。
4. Storyline Builder 只拿 caption、OCR、来源链接和缩略图，不默认导出原图。

满足需求：

- 用户能把“看过的画面”转成可复用素材。
- 个人视觉记忆和 Storyline / Skill / Context Passport 形成闭环。

## Demo 说明

Demo 文件：[`visual-episodic-memory-demo.html`](./visual-episodic-memory-demo.html)

Demo 模拟一个用户正在浏览 Jira/Slides/AI chat 的网页环境，右侧弹出 Personal AI 视觉记忆面板：

- 可以切换 `Jira 图表`、`Slides 流程图`、`AI 对话截图` 三个场景。
- 可以点击保存视觉证据，看到 OCR/caption/source links。
- 可以运行一次模糊视觉搜索。
- 可以查看“外发给 AI 时默认只发文字版”的安全提示。

## 推荐决策

建议进入 **P0 设计评审**，但不要马上做桌面全局捕获。

推荐第一版只做：

1. Browser 手动视觉保存。
2. Source Memory Detail 中展示 visual capsule。
3. Ask/Quick Ask 显式视觉搜索。
4. Memory Lens 强相关视觉证据卡。

这个方向值得做，因为它补上了 Personal AI 当前记忆体系的一个明显盲点：**用户的大量真实记忆不是文字，而是画面。** 只要边界收窄、隐私默认保守，它会成为 Memory Capture、Context Recall、AI Context Passport、Storyline Builder、Skill Foundry 的共同多模态原料层。
