# 新能力：Desktop Selection Memory Capsule / 桌面选区记忆胶囊（搁置）

> 状态：搁置，未实现；当前不建议推进桌面 App 深入能力。
> 生成时间：2026-07-13 11:12 CST  
> Demo：[`desktop-selection-memory-capsule-demo.html`](./desktop-selection-memory-capsule-demo.html)（搁置视觉参考）
> 建议标题：`新能力：桌面选区记忆胶囊（搁置）`

## 搁置原因

本方案先标记为搁置。它仍然符合 Personal AI 的长期方向：让用户在桌面 App、外部 AI、终端、文档和浏览器之间移动时，可以把当前选区变成记忆召回锚点。但当前阶段不建议马上做桌面 App 深入能力。

当前优先级应先收敛在 **Web / Chrome extension**：

- Personal AI 的主工程形态仍是 Chrome Extension，现有 Memory Lens、Memory Capture、Compose Assist、Prompt Context Compiler、网页选区保存、context-recall 都在浏览器里有更成熟的验证路径。
- 用户现在更需要先证明：网页选区能稳定召回正确记忆、保存边界足够清楚、prompt patch 能真正帮外部 AI 对话、secret / 敏感内容能 fail closed、evals 能用真实场景持续约束效果。
- 桌面 App 深入会引入 macOS Accessibility、Services、全局快捷键、剪贴板 fallback、本地浮层、权限解释、安装包验证和跨 App 行为差异。它的价值成立，但验证成本和信任成本都比 Web 路线高，不适合作为当前 P0。
- 如果 Web/Chrome extension 的选区召回、资料保存、外部 AI prompt patch、secret 阻断和相关 eval 都跑通，再恢复评估桌面 App 版本会更稳。届时桌面 App 应复用已经验证过的 recall / save / copy contract，而不是先从全局热键和系统权限开始。

因此，本文件和 demo 仅作为未来恢复时的设计参考。近期不应进入实现排期，也不应新增 `desktop-app` 权限、全局快捷键、Accessibility 适配或安装包验证工作。

## 真实场景 1：在 Codex / 终端里遇到一个“似曾相识”的问题

1. 用户正在 Codex 里修 `NOVA-14516` 相关逻辑，终端输出一段报错或 reviewer 留下一句：“webhook overwrite detection should not reuse stale Target end”。
2. 用户不想打开 Personal AI 搜索页，也不想把整段代码/终端历史复制给另一个 AI，只选中这句话，按一次全局快捷键，例如 `Option + Space` 后再点 Personal AI，或独立 `Command + Shift + M`。
3. 屏幕上方出现一个小浮层：`选区胶囊 · Codex Terminal · 只读预览 · 未写入`。浮层把这段选区作为锚点，召回过去的 Jira 口径、表格写回边界、最近一次相似 issue 的决定，并标出“当前只读，不会写代码、不保存、不外发”。
4. 用户点 `复制给 Codex`，得到一段短上下文包：

   ```text
   你正在处理 NOVA-14516 / Target end 相关问题。Personal AI 只召回到：
   - 之前 bulk update 只允许 sheet -> Jira 的明确字段写回，不要从旧 snapshot 推断 Target end。
   - 若 Jira Advanced Roadmaps 缺 issue，优先检查 source JQL，不先假设 UI bug。
   - 本包来自 2026-07-13 的桌面选区胶囊，只读生成，未写入记忆、未执行外部动作。
   ```

5. 用户把这段贴回 Codex 或 ChatGPT，继续问问题。Personal AI 没有偷看全屏，也没有自动把终端内容存进记忆。

## 真实场景 2：在外部 AI 对话框里补一段“只够用”的个人上下文

1. 用户在 ChatGPT、Claude、豆包或 Raycast AI 里写 prompt：“帮我评估这些 Jira tickets 哪些应该进 26.3.120。”
2. 写到一半想起 Personal AI 可能知道自己之前怎么判断版本、目标日期和 spreadsheet writeback，但不想把全部项目记忆塞进去。
3. 用户选中当前 prompt，按热键。浮层识别为 `外部 AI prompt · 选区胶囊`，显示 3 个候选上下文：
   - `26.3.120` 版本判断口径；
   - `Target start / Target end` 只从当前表格写回的边界；
   - `NOVA / MTR` 项目里常见的“source JQL 先于 UI 设置”的排查经验。
4. 用户只勾选前两项，点 `复制 prompt patch`。系统复制一段更窄的补充上下文，并显示 `外发前复核：2 条项目记忆，0 条人物敏感上下文，0 条 secret`。
5. 用户自己决定是否粘贴到外部 AI。Personal AI 不自动提交、不接管外部 AI 会话，也不会把这次选择视为“用户确认事实”。

## 一句话

**桌面选区记忆胶囊**是一个用户主动触发的 OS 级微入口：在任意 macOS App 里选中文字后按热键，Personal AI 用这段选区、前台 App、窗口标题和最小邻近上下文做即时记忆召回，生成可复制的上下文包、可复核的保存候选或一次 Ask 追问，但默认只读、未写入、未外发。

当前结论：这是一条未来桌面延伸路线，不是近期 P0。近期先在 Web/Chrome extension 中验证同类选区锚点和上下文包能力。

## 为什么值得做

Personal AI 已经能在浏览器、Jira、RingCentral、会议和 Quick Ask 里召回记忆，但用户的真实工作越来越多发生在 **桌面 App 与外部 AI 之间的缝隙**：Codex、终端、ChatGPT desktop、Claude desktop、Cursor、Notes、Slack/邮件、PDF、表格、任意网页输入框。用户需要的是“我正在看的这句话，Personal AI 记得什么”，而不是先切到一个搜索页重新描述问题。

这次本机 Reminders 的 `Personal AI` 清单存在，但未完成项为 0，因此没有 Reminder idea 被选中或标记。远端 `10.32.56.212` 上 `esone.qiu` 的真实 memory-service 数据显示：消息约 11,350 条，source memory capsules 约 613 条，reflection threads 活跃约 885 条，proposed actions 多数是通知、OpenClaw 委托和 confirm request。也就是说，记忆素材已经很多，但高频桌面工作流仍缺一个“按住当前选区就能把正确记忆带回来”的低摩擦入口。

这个能力的亮点不是再做一个搜索页，也不是做全屏记录器，而是把 Personal AI 变成 **可控的上下文显微镜**：

- 选区就是用户意图声明，减少隐式推断。
- 热键就是授权边界，避免后台监控。
- 胶囊浮层只给可行动的少量记忆，不把长期记忆库倾倒给外部 AI。
- 每个按钮前都说明会不会写入、复制、外发、创建任务或修改画像。

## 行业和研究信号

| 来源 | 观察 | 对本方案的启发 |
| --- | --- | --- |
| [OpenAI Work with Apps on macOS](https://help.openai.com/en/articles/10119604-work-with-apps-on-macos) | ChatGPT macOS 可通过 `Option + Space` 与 IDE、Terminal、Notes 等 App 协作，并把选区及邻近文本作为上下文。 | OS 级 AI 入口已经是主流方向；Personal AI 的差异应是“用户自己的长期记忆 + 可控边界”，不是再做一个通用 ChatGPT。 |
| [OpenAI new ChatGPT desktop app notes](https://help.openai.com/en/articles/20001276-moving-to-the-new-chatgpt-desktop-app) | Chat、Work、Codex 在桌面 App 中合并，Work 可以在授权下使用本地文件和桌面 App。 | 用户会越来越频繁在桌面 AI、代码、文档和网页之间移动；Personal AI 需要成为跨 App 的私人记忆层。 |
| [Raycast AI Commands](https://manual.raycast.com/ai/ai-commands) | Raycast 把“选中文本 -> 打开命令 -> 得到 AI 结果”做成一键命令。 | 用户已熟悉选区驱动的轻量 AI 操作；Personal AI 可以把结果从“通用 AI 改写”升级为“个人记忆召回”。 |
| [Microsoft Recall privacy controls](https://support.microsoft.com/en-us/windows/privacy/privacy-and-control-over-your-recall-experience) 与 [Click to Do](https://support.microsoft.com/en-us/windows/ai/ai-features/click-to-do-in-recall-do-more-with-what-s-on-your-screen) | Recall/Click to Do 说明 OS 级屏幕记忆和屏幕动作有强需求，但隐私控制必须足够明确。 | 本方案 P0 不做周期截图、不做全屏 OCR、不做后台历史，先走用户显式选区和本地回执。 |
| [Apple macOS systemwide Services](https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/MakeaSystem-WideService.html) | macOS Services 允许 App 对其他 App 中选中的文本提供系统级操作。 | 技术上可以用 Services / Accessibility / Clipboard fallback 逐层实现，不必一开始侵入所有 App。 |
| [Budzik & Hammond, IUI 2000](https://dl.acm.org/doi/10.1145/325737.325776) | 经典 just-in-time information access 研究把日常 App 交互作为信息需求上下文。 | Personal AI 的记忆召回应该贴着“用户正在操作的对象”出现，而不是要求用户改写成搜索 query。 |
| [Memento: Proactive Visualization of Everyday Memories](https://arxiv.org/html/2601.17622v1) | 2026 年 AR/LLM 个人记忆研究强调上下文触发、日常记忆可视化和用户纠错控制。 | 记忆 resurfacing 必须可修正、可关掉、粒度可控；本方案用热键和选区降低误触发。 |
| [Toward a Unified Framework for Collaborative Design of Human-AI Interaction](https://arxiv.org/html/2605.01153v1) | 近期 mixed-initiative 研究强调不要让系统只靠隐式满意度判断，要给用户可接受、拒绝、修改的机会。 | 胶囊浮层每个候选记忆都可勾选、隐藏、反馈，不把召回直接变成动作。 |
| [Preference-Aligned Proactive Assistants](https://arxiv.org/html/2602.04000v1) | 主动助手需要学用户偏好和场景，但更重要的是训练它在合适时机介入。 | P0 先用显式选区触发收集 outcome，再决定是否进入更主动的 P1。 |

## 与现有能力的去重边界

| 已有能力 / 计划 | 已经解决什么 | 本方案新增什么 | 不做什么 |
| --- | --- | --- | --- |
| Memory Lens | 浏览器页面、Jira、RingCentral 中的只读关联记忆提示。 | 把“当前选区触发召回”扩展到任意桌面 App 和外部 AI 输入框。 | 不替代网页内 hover / 页面召回。 |
| Memory Capture / Source Memory | 网页选区、整页、视觉证据的保存、蒸馏和资料详情。 | 给桌面选区一个可保存为 `source_memory_capsule` 的入口，带 `desktop_selection` 来源和保存前复核。 | 不自动保存选区，不跳过复核。 |
| Quick Ask / Ask Continuity | menubar / 桌面问答入口，用户先输入问题。 | 选区先行：用户不需要重新描述问题，胶囊以当前选区为上下文锚。 | 不做完整聊天页。 |
| Prompt Context Compiler | 在 Web AI prompt 写作时补齐缺失槽位。 | OS 级触发，可对 ChatGPT desktop、Codex、终端、Notes 等非扩展内页面生成 prompt patch。 | 不自动插入或提交外部 AI。 |
| AI Context Passport | 把一件事的上下文打包交给外部 AI。 | 生成更小的“当前选区 context patch”，适合 30 秒内一次性使用。 | 不创建长期 session contract。 |
| Memory Egress Firewall（搁置） | 记忆外发前的泛化风险审查。 | 只对本次复制出去的 context patch 做轻量 secret / sensitive receipt。 | 不建设全局 DLP 控制台。 |
| Working Memory Return Stack（搁置） | 试图根据离开前的隐式意图恢复断点。 | 只在用户明确选中并按热键时工作。 | 不做跨 App 后台意图推断。 |
| Operation Memory Flight Recorder | 记录跨工具操作 episode，未来可沉淀 skill。 | 捕获的是一段选区和当下可用记忆，不记录操作链。 | 不做屏幕录像、步骤回放或自动 skill 建议。 |

## 未来恢复时的 P0 用户体验参考

以下内容保留为未来恢复评估时的 P0 参考，不代表当前实现承诺。

### 入口

- 默认全局快捷键：`Command + Shift + M`，可在 Desktop App 设置中改。
- 备选入口：macOS Services 菜单 `用 Personal AI 召回选区记忆`，兼容不允许全局快捷键的 App。
- 触发时只读取：
  - 当前前台 App 名称和 bundle id；
  - 当前窗口标题；
  - 用户选中的文本；
  - 选区附近少量文本，仅在 App API 可明确返回时读取；
  - 当前剪贴板 fingerprint，仅用于 fallback 防误读，不上传完整 clipboard，除非用户选择“用剪贴板作为选区”。

### 胶囊浮层

浮层是一个轻量 overlay，固定在当前屏幕上方或选区附近，内容分四层：

1. **边界条**：`只读预览 · 未写入 · 未外发 · 来源：Codex Terminal 选区`。
2. **选区摘要**：显示最多 2 行选区，长文本折叠，提供 `重新抓取` 和 `改为手动粘贴`。
3. **关联记忆**：最多 3 条，高置信优先，必须有来源、时间、为什么命中、是否 stale。
4. **动作区**：
   - `复制上下文包`：复制勾选记忆和边界 header，不发送。
   - `Ask 一下`：在 Personal AI 内用选区提问，不外发到其他 AI。
   - `保存为资料记忆`：进入复核，不直接写入。
   - `隐藏这条`：记录本地负反馈，不删除记忆。

### 状态和失败态

- `未授权 Accessibility`：说明只能手动粘贴选区，不要求用户立刻授权。
- `未检测到选区`：显示 `用剪贴板作为选区` 与 `手动粘贴`，默认不读 clipboard 明文。
- `疑似 secret`：只显示本地红线，不调用召回，不保存，不复制。
- `召回很薄`：明确说“只找到 1 条弱关联，建议打开 Ask 或缩小/换选区”。
- `服务不可用`：保留选区预览，但所有记忆区显示 `未读取远端记忆，不会使用缓存伪装成最新结果`。

## 数据和系统设计

### 新的 scene contract

```ts
type DesktopSelectionCapsuleRequest = {
  userId: string;
  requestId: string;
  trigger: 'global_shortcut' | 'macos_service' | 'manual_paste' | 'clipboard_fallback';
  surface: 'desktop_selection_capsule';
  frontApp: {
    name: string;
    bundleId?: string;
    windowTitle?: string;
    trustedAdapter?: 'accessibility' | 'app_plugin' | 'service' | 'manual';
  };
  selection: {
    text: string;
    textHash: string;
    charCount: number;
    languageHints: string[];
    captureMethod: 'accessibility_selection' | 'service_payload' | 'manual_paste' | 'clipboard_after_hotkey';
    nearbyText?: string;
    snapshotAt: string;
  };
  privacy: {
    secretScan: 'clear' | 'blocked' | 'needs_review';
    screenshotIncluded: false;
    backgroundCapture: false;
    externalSendRequested: false;
  };
};
```

### 返回结构

```ts
type DesktopSelectionCapsuleResponse = {
  capsuleId: string;
  sceneLabel: string;
  receipt: {
    mode: 'read_only_preview' | 'blocked_secret' | 'manual_only' | 'service_unavailable';
    copySafe: boolean;
    writeState: 'not_written' | 'review_required' | 'saved';
    externalState: 'not_sent' | 'copied_by_user' | 'blocked';
    freshness: 'live' | 'stale_cache' | 'unavailable';
  };
  recallMatches: Array<{
    id: string;
    type: 'message' | 'source_memory' | 'reflection_thread' | 'user_core' | 'rehearsal' | 'skill';
    title: string;
    cue: string;
    evidenceRef: string;
    score: number;
    whyMatched: string;
    stale?: boolean;
    sensitiveHiddenCount?: number;
  }>;
  promptPatch?: {
    title: string;
    markdown: string;
    tokenEstimate: number;
    selectedMatchIds: string[];
    copyReceipt: string;
  };
  saveCandidate?: {
    allowed: boolean;
    defaultSourceKind: 'desktop_selection';
    reviewRequired: true;
    reason: string;
  };
};
```

### 后端复用

- `/context-recall` 增加 `surface: 'desktop_selection_capsule'`，消费 `DesktopSelectionCapsuleRequest` 的 `frontApp + selection`。
- `ContextAssistService` 复用现有 source allowlist 和 attention budget，新增桌面 App 场景的 `sourceTypes` 默认：
  - `message`
  - `source_memory`
  - `reflection_thread`
  - `user_core`
  - `manual`
  - `rehearsal`
  - `personal_skill`
- `SourceMemoryCaptureService` 新增候选类型 `desktop_selection`，保存前必须进入 review panel，写入 `source_memory_capsules.source_kind = 'desktop_selection'` 或 metadata fallback。
- `Prompt Context Compiler` 提供 `compileDesktopSelectionPatch`，只生成可复制 markdown，不触碰外部输入框。
- `Memory Egress` 的轻量规则以内联 helper 形式复用：secret scan、敏感人物计数、external target receipt。

### Desktop App 复用

- 复用现有 menubar / Quick Ask 窗口基础设施，新增 `selection-capsule` mini window。
- macOS 取选区优先级：
  1. App-specific adapter，例如 VS Code / Cursor / Terminal 后续可通过插件或 AppleScript 获取更可信选区；
  2. Accessibility selected text；
  3. macOS Services payload；
  4. 用户确认后的 clipboard fallback；
  5. 手动粘贴。
- P0 不要求 Screen Recording 权限。截图/OCR 只列为 P2，并且必须是用户显式 `抓取当前窗口截图`。

## 隐私和信任边界

P0 必须在 UI 和 API 层同时 fail closed：

- 不做后台屏幕记录。
- 不周期性读取 clipboard。
- 不在没有用户热键/Services 操作时读取前台 App。
- 不自动保存选区。
- 不自动把上下文贴进外部 AI。
- 不自动点击、发送、提交、修改 Jira、修改代码或创建任务。
- 不把外部 AI 当前 prompt 视作用户确认的事实。
- 发现 secret/token/password/private key/银行卡/验证码时，不调用远端召回，只显示本地阻断。
- 如果返回的是 cache 或 stale 结果，首屏必须显示 `非最新`，不能把旧快照伪装成 live。

## 交互细节

### 候选记忆排序

排序不是简单相似度，应该综合：

- 选区里的项目 / issue / 人名 / 文件名 / 技术词命中；
- 当前 App 类型：Codex/Terminal 偏代码、Jira/浏览器偏项目、外部 AI prompt 偏 context pack；
- 最近 30/90 天是否被用户打开、复制、采纳或标记有用；
- `source_memory_takeaways` 是否 ready；
- 是否有明确 stale/freshness 标记；
- 敏感内容是否默认隐藏。

### 可复制上下文包格式

复制内容必须包含 header：

```md
Personal AI desktop selection context
Generated: 2026-07-13 11:12 CST
Source: user-selected text in Codex Terminal
Boundary: read-only recall; not saved; not sent; review before sharing externally.
```

然后才列记忆。这样用户贴到任意外部 AI 后，外部 AI 也能看到这段上下文的来源和边界。

### 反馈回流

- `复制上下文包` 成功：记录 `desktop_selection copied`，只影响排序，不确认事实。
- `隐藏这条`：记录 match-level negative feedback。
- `保存为资料记忆` 确认后：写 source-memory capsule，并生成 `writeReceipt`。
- `Ask 一下`：进入 Personal AI Ask thread，并在 ask payload 中带 `sceneCapsuleId`，便于后续 eval 追踪。

## 未来恢复时的 MVP 范围参考

以下分期只在恢复该方向时重新评估。当前阶段不进入桌面 App 实现。

### P0

- Desktop App 全局快捷键或 macOS Services 入口。
- 手动粘贴 fallback。
- 选区 secret scan。
- 调 `/context-recall` 的 desktop selection surface。
- 胶囊浮层：边界条、3 条记忆、复制 context pack、Ask、保存复核入口。
- 中文/英文界面文案。
- `desktop_selection` source-memory 保存候选。
- E2E demo + eval suite。

### P1

- App-specific adapter：Terminal、VS Code/Cursor、ChatGPT desktop、Notes。
- 记忆候选可勾选后生成不同 token budget 的 patch。
- 最近 5 次胶囊本地历史，默认不进入长期记忆。
- 与 Quick Ask 顶部续聊条整合：从胶囊进入 Ask 后可返回选区。

### P2

- 显式截图/OCR 单次授权。
- 与 AI Context Passport 联动：从选区升级成完整 handoff pack。
- 与 Personal Skill Foundry 联动：多次相似胶囊可建议“这是一个可沉淀 skill”，但必须人工确认。
- 跨设备：手机上复制的一段文字可发到 Desktop App 生成胶囊。

## 不做范围

- 不做 Microsoft Recall 式持续截图历史。
- 不做所有 App 的隐式 intent detection。
- 不做自动贴入、自动提交、自动代理执行。
- 不做全局记忆治理台。
- 不做一个新的大型 inbox 或 review queue。
- 不把桌面选区当作“用户想永久记住”的默认信号。

## 需要的 evals

需要。这个能力的风险不是 UI 能不能打开，而是“选区锚点能不能召回真正有用且不会过度分享的记忆”。实现后应创建 eval suite，例如 `evals/workflows/desktop-selection-memory-capsule/` 与 `evals/cases/desktop-selection-memory-capsule/cases.jsonl`。

建议测试场景：

1. **Codex/Jira 选区**：输入 `NOVA-14516 Target end stale overwrite`，期望召回 Jira field writeback / Roadmaps source JQL 相关记忆，不召回无关会议。
2. **外部 AI prompt patch**：输入 `帮我评估这些 tickets 哪些进 26.3.120`，期望生成版本/Target dates context patch，且 header 明确不发送、不确认事实。
3. **secret 阻断**：输入包含 `sk-...`、password 或 token 的选区，期望本地 blocked，不调用 recall，不生成 copy patch。
4. **弱选区降级**：输入 `这个怎么看` 或 5 个字以内的模糊选区，期望提示手动补充，不强行召回。
5. **跨 App 边界**：ChatGPT desktop 选区不应把 `chatgpt` 自身历史原样回填给同一目标 AI，避免回声和过度外发。
6. **保存复核**：确认保存才写 `source_memory_capsule`，取消或失败必须返回 `noWriteReceipt`。

验证命令应按实现落点调整，至少包括：

```bash
npm run eval:validate
npm run eval:run -- --suite desktop-selection-memory-capsule --no-repair
```

如果缺少真实场景或 golden，可从 `10.32.56.212` 上 `esone.qiu` 的 memory-service 数据中抽取只读样本生成 fixtures。达不到 recall precision、secret block、copy boundary 的通过标准时，不应上线，应继续改进到所有 eval 通过。

## 未来实现后的正式文档维护

实现完成后，必须把关键行为和关键逻辑精简维护到正式功能文档：

- 如果 Desktop App 侧成为独立入口，新增 `desktop-app/docs/features/desktop_selection_memory_capsule.md`。
- 在 `desktop-app/docs/features/doubao_bridge.md` 或现有 Quick Ask 文档中补充“桌面入口与 Quick Ask 的关系”，避免用户误以为胶囊会写入豆包线程或移动上下文线程。
- 在 `docs/features/memory_capture.md` 补 `desktop_selection` source-memory 保存边界。
- 在 `docs/features/memory_lens.md` 或 `docs/features/memory_system.md` 补 `surface='desktop_selection_capsule'` 的 recall 规则。
- 在 `docs/features/compose_assist.md` 补外部 AI prompt patch 的复制边界：只复制，不插入，不发送。
- 更新 `docs/features/index.md`，把该能力归到桌面入口、记忆召回、资料保存、外部 AI context 四个索引点。

如果后续实现并验收通过，应删除本 `docs/progressing` plan，并把 demo 移到 `docs/demo/` 或保留为 release demo。

## 成功指标

- 选区触发到首屏可读结果 P95 < 1.5 秒，本地 fallback P95 < 300ms。
- 有效选区场景下，前 3 条记忆至少 1 条被用户复制、Ask、保存或标记有用的比例 > 35%。
- secret 阻断漏报为 0。
- 复制出去的 context patch 100% 带来源和边界 header。
- 用户取消/关闭胶囊后无长期写入。
- 相比打开搜索页手动查，完成“拿到可用上下文包”的步骤从 5-7 步降到 2-3 步。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| macOS Accessibility 取选区不稳定 | Services 和手动粘贴 fallback；首屏标明 capture method。 |
| 用户误以为已经保存 | 所有状态默认显示 `未写入`，保存按钮进入复核面板。 |
| 外部 AI 过度分享私密记忆 | 默认只复制勾选项，敏感上下文隐藏计数，secret scan 阻断。 |
| 变成另一个大搜索页面 | P0 限 3 条记忆 + 3 个动作，不做完整 Memory Exploring。 |
| 与 Quick Ask 重叠 | Quick Ask 是问题驱动；胶囊是选区驱动，Ask 只是一个后续动作。 |
| 与已搁置的 Return Stack 重叠 | 本方案不推断离开前意图，只响应用户显式选区和热键。 |

## 未来恢复条件

暂不推进本方案。未来如果重新评估，建议先确认以下 Web/Chrome extension 能力已经可用并通过真实场景验证：

- 网页选区的 Memory Lens 召回相关性稳定，能用 eval 证明噪声可控。
- 网页选区保存到 source-memory 的复核、写入回执、撤销和详情链路稳定。
- Web AI prompt patch 能在 Chrome extension 内完成复制/插入前复核，并明确不自动发送。
- Secret / token / password 等敏感选区能本地阻断，且 eval 覆盖漏报风险。
- 用户真实使用中证明“选区锚点 + 个人记忆召回”比打开 Ask 搜索自然。

如果这些条件成立，再恢复桌面 App 方向。恢复时也应先做 **手动粘贴 / macOS Services / 胶囊浮层** 的窄切片，不要一开始追求所有 App 的 Accessibility adapter 或全局屏幕能力。
