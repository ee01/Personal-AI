# Chrome Extension 帮助中心(Help Center)规划

_创建时间:2026-08-03 · 状态:待 review,未开工_

Demo HTML:[`extension-help-center-demo.html`](./extension-help-center-demo.html)(纯静态,可直接浏览器打开)

## 1. 背景与目标

popup 右上角 ❓ 目前直接跳 wiki([popup.tsx:3582](../../src/popup.tsx) `handleOpenHelp` → `WIKI_URL`)。wiki 面向团队介绍,不面向"装好扩展后的第一次使用",导致新用户不知道:

1. 记忆是怎么进来的(捕获);
2. 记忆能在哪些地方帮到我(获取);
3. 哪些功能要先配置(定时消息初始化、RingCentral token、OpenClaw API、Desktop App 等),不配置会怎样。

目标:做一个扩展内置的独立 HTML 帮助页,❓ 点击后打开。以「获取记忆」「捕获记忆」两个维度组织主功能,每个功能可展开查看:使用步骤、结果预览(截图/内嵌演示)、前置配置检查与引导。

非目标(v1 不做):英文版、站内搜索、视频教程、覆盖全部 28 个主功能。

## 2. 入口改造与页面形态

- 新增 `static/help.html` + `src/help.ts`(vanilla TS,不引 React;需要 `chrome.storage` / service 状态做配置检查,所以要打包一个入口脚本,构建方式对齐 `share-modal.html`)。
- [popup.tsx](../../src/popup.tsx) `handleOpenHelp` 改为 `chrome.tabs.create({ url: chrome.runtime.getURL('help.html') })`,普通 tab(内容长,不用 popup window)。

### 页面形态:整页 tab,双栏,内容区 1240px

**不是弹窗。** 用 `chrome.tabs.create` 开整页 tab,理由:内容有 13 个条目、含 1280 宽截图和内嵌 iframe 演示,弹窗窗口装不下且会挡住用户正在操作的页面;帮助页需要能长期停在一个 tab 里对照操作。

布局:左侧**粘性目录**(板块 + 条目,支持直接跳转)+ 右侧内容,容器 1240px。首版 demo 曾用 880px 单栏(那是文档阅读宽度的惯性),在宽屏上截图被压缩、右侧大片留白,已改。940px 以下退化为单栏、目录不再 sticky。
- wiki 链接不删,移到帮助页 footer「团队 Wiki / 完整功能文档」。
- 定时消息演示动画复制一份到 `static/help-demos/scheduled-pending.html`,帮助页内 iframe 引用(同扩展资源,无需 web_accessible_resources)。

## 3. 列表审查与展示排序(核心,请重点 review)

原则:
- **收录标准**:有独立用户入口、普通用户日常会碰到、且"看了帮助确实更会用"。系统内部件、管理员工具、团队特定工具不进主列表。
- **排序标准**:板块内按「零配置即用 → 需要配置」+ 使用频率排,让用户先尝到甜头再谈配置。
- 未收录的主功能进底部「更多能力」折叠区,一行简介 + 文档链接,不写引导。

> **2026-08-03 更新 3:Meeting Pilot 改名 + 条目增删**
>
> - **产品级改名:`会议全貌` → `会议弹幕`**,已在源码执行(52 处 / 13 文件):`src/popup.tsx`、`src/options.tsx`、`src/meeting-shell/{contentScriptRingCentralMeeting.ts,popupCard.tsx,meetingSidePanel.tsx}`、`src/i18n/{index.ts,staticTranslations.ts}`、`docs/features/meeting_pilot.md`、`AGENT.md`,以及 4 个断言该字符串的校验脚本 `desktop-app/scripts/meeting-pilot-{scene1,scene2-runtime,scene3-settings,options}-check.mjs`。英文侧仍是 `Meeting Pilot`(用户只要求改中文),所以 `staticTranslations` 里是 `'会议弹幕': 'Meeting Pilot'`;中文 key 与源码字面量是同一次 sed,一致性由构造保证。
> - 帮助页卡片标题 `开会带上副驾` → **开会飘弹幕**,副标题改为「提醒直接飘在会议画面上,会后一页 Panorama 回放」;推荐名 `会议副驾` → **会议弹幕**。会中配图从 side panel 换成**弹幕截图**(来自 [`docs/demo/meeting-danmaku-alerts.html`](../demo/meeting-danmaku-alerts.html),播放动画后隐藏 `.controls-overlay`/`.legend` 再截),步骤 2 改写为 P0 居中定格 / P1 飘过 / P2 轻量的分级说明。
> - **删除「粘贴/文档快速入库 + 覆盖地图」卡**;其截图改用于新增卡片 **「记忆备份」**(下载 backup zip → 从 `录入 → 备份 zip` 恢复 → 必须 dry-run + merge/replace 确认),口径取自 [memory_coverage_map.md](../features/memory_coverage_map.md) §备份下载与恢复。**归属栏目从「捕获记忆」调整到「提取记忆」#8**(记忆备份是把已有记忆取出来存到本机,语义上更接近"提取"而非"捕获新记忆"),捕获记忆栏目现收尾于 #4「它眼里的你」。
> - **Ask 不设推荐语**,只用推荐名。分享文案因此增加无推荐语时的兜底句式:有推荐语走「推荐个小工具,{推荐语}」,没有则走「推荐个小工具,有「{推荐名}」」,避免出现「推荐个小工具,」这种断句。
>
> **2026-08-03 更新 2:命名与条目按 claude design 对齐(设计稿源码已拿到)**
>
> - 板块「获取记忆」→ **提取记忆**;条目「后台消息观察」→ **消息分析入库**、「直接问它」→ **Ask 主动问答**、「网页/消息旁的记忆提示」→ **记忆提示(Memory Lens)**、「划词与整页「+ 记住」」→ **划词 / 整页保存**(全部采用设计稿标题与副标题原文)。
> - Memory Lens / 划词 / Ask 三个条目的**文案与 HTML 预览已按设计稿 1:1 复刻**:Lens = 右下角 260px 白卡(✦ 关联记忆 · 2 + 灰底正文 + 来源行);划词 = 段落内蓝色 `<mark>` 高亮 + 右上角浮出「+ 记住」pill;Ask = 蓝色右侧提问气泡 + 灰色左侧答案气泡 + 蓝色来源 chips。
> - **提取记忆新增条目「Jira 设计稿与后端依赖」**,把 [jira_design_links.md](../features/jira_design_links.md)(蓝色设计面板:多渠道扫描、Ready for dev / Design updated / Missing link 状态、只读边界)与 [jira_backend_progress.md](../features/jira_backend_progress.md)(绿色后端面板:Early Build / Rollout to Prod、`N/A` 与可点 `pending`)合并为一个用户可感知的功能;预览是双面板 HTML 仿真。
>   注:用户提到的 `jira_backend_dates.md` 在仓库中不存在,后端日期口径以 `jira_backend_progress.md` 为准。
> - Ask 条目改为**双入口卡**(浏览器内「实体记忆查询」= 已就绪 / 全局「Quick Ask 小窗」= 需先装 Desktop App),安装三步文案取自 [src/modals/desktop-app.tsx](../../src/modals/desktop-app.tsx) 的真实引导(下载 `Personal-AI-Desktop-<version>-Installer.pkg` → Applications 打开 → app 内绑定)。
>
> **2026-08-03 更新:已按 claude design 拆为三板块**(设计稿导航即 `#get / #capture / #act`),原决策点 1 落定。「获取记忆」收敛为纯零配置消费(6 条),定时消息、豆包挪入新板块「让 AI 替你做事」,并按设计稿补了「消息联动操作」条目(含 OpenClaw API 配置检查)。下表为原始审查记录,现行排序以 demo 页为准:获取 = 记忆外接/Ask/Lens/Compose/Today/Meeting;捕获 = 5 条不变;行动 = 定时消息/消息联动/豆包随身。

### 3.1 获取记忆(排序后)

| # | 条目(帮助页标题) | 对应主功能 | 内容积木 | 前置配置检查 | 素材 |
|---|---|---|---|---|---|
| 1 | 把记忆带到任何 AI(Prompt 直供) | 新功能,见 §4 | 默认拉取结果预览 + 预设/自定义选择 + 接口示例 | Memory Service 可达(可选:OpenClaw/MCP 接入引导) | 展开即显示默认 prompt 拉取结果 |
| 2 | 直接问它(Ask / Quick Ask) | Ask、Doubao Bridge(Quick Ask 小窗) | 步骤 + 结果预览 | 无 | 截图 ×2 |
| 3 | 网页/消息旁的记忆提示(Memory Lens) | Memory Lens | 步骤 + 结果预览 | 无(附:站点白名单/静默设置入口) | 截图 ×2(角标 + 展开卡) |
| 4 | 回复时的 AI 助手(Compose Assist) | Compose Assist | 步骤 + 结果预览 | 无 | 截图 ×1 |
| 5 | 每天先看「今天」(Today Pilot) | Today Pilot | 步骤 + 结果预览 | 无(日历数据到位更佳) | 截图 ×1(popup Top 3) |
| 6 | 开会带上副驾(Meeting Pilot) | Meeting Pilot(捕获侧一并说明) | 步骤 + 配置检查 + 结果预览 | tab capture / 麦克风授权;可选 Desktop App 本地 ASR | 截图 ×2(会中 side panel + 会后 Panorama) |
| 7 | Glip 快速定时消息 | Scheduled Messages | 配置检查 + 演示预览 + 步骤 | ✅ 定时消息初始化(Sheet/Apps Script/触发器) ✅ RingCentral token | **配置前可先看内嵌演示动画**(定时消息-待发送动画);截图 ×1 |
| 8 | 记忆随身(豆包互联 / Desktop App) | Doubao Bridge | 步骤 + 配置检查 | Desktop App 安装 + 绑定 | 截图 ×1 |

> 归类说明:定时消息严格说是"让 AI 替你行动"而非"取记忆",但用户视角它和 Ask/Compose 一样是"装了扩展后能得到什么",且是配置引导的最典型案例,故放获取维度末段(需配置组)。若 review 时觉得别扭,备选方案是加第三板块「让 AI 替你做事」,把 7、8 挪过去。

### 3.2 捕获记忆(排序后)

| # | 条目(帮助页标题) | 对应主功能 | 内容积木 | 前置配置检查 | 素材 |
|---|---|---|---|---|---|
| 1 | 划词与整页「+ 记住」 | Memory Capture | 步骤 + 结果预览 | 无 | 截图 ×2 |
| 2 | 后台消息观察(静默分析) | Message Analysis | 步骤 + 配置检查 | popup 静默分析开关;规则页入口 | 截图 ×1(规则页) |
| 3 | 导入外部 AI 的历史 | Doubao Bridge(explorer 链路)、Coverage Map(zip 导入) | 步骤 + 配置检查 | 豆包/ChatGPT 抓取需 Desktop App;zip 导入无 | 截图 ×1 |
| 4 | 粘贴/文档快速入库 + 覆盖地图 | Memory Coverage Map | 步骤 + 结果预览 | 无 | 截图 ×1(coverage 页) |
| 5 | 它眼里的你(用户画像) | User Profile | 步骤 + 结果预览 | 无 | 截图 ×1 |

### 3.3 不收录(进「更多能力」折叠区)

| 主功能 | 不进主列表的理由 |
|---|---|
| Task Scheduler | 系统内部维护面,popup 已有状态面板 |
| Agent Thinking / Agent Workflow | 高级编排与调试,受众窄 |
| Notification Center | 横切能力,在各功能条目内顺带提及即可 |
| Rehearsal / Storyline / Relationship Radar / Skill Foundry | 记忆平台进阶玩法,二期再补条目 |
| Topic Messages / Message Reaction | 消息工作流工具,二期;Reaction 的「联动操作/Openclaw」在 Prompt 直供条目里交叉引用 |
| Project Dashboard / Personal Roadmap / Google Slides Analyzer / Jira 三件套 / AR Data / Native Join | 团队/角色特定工具,折叠区一行带过 |
| Usage Analytics | 仅管理员 |

## 4. 新功能:Prompt 直供(命名待定,见下)

### 4.1 是什么

一个 Memory Service 只读接口:调用后输出一段可直接粘贴/注入到任何外部 AI(ChatGPT、Claude、Cursor、OpenClaw system prompt……)的 prompt 文本,默认内容 = 用户身份 + 偏好。帮助页条目展开时即实时拉取并展示默认结果,旁边给复制按钮和接口调用示例。

### 4.2 命名:定为「记忆外接(Context Pack)」

采纳 claude.ai 设计稿([Help Page.dc.html](https://claude.ai/design/p/aad296b0-86f8-4d6b-b5b2-4c01511c3857?file=Help+Page.dc.html))中的命名「记忆外接」——中文语义准确("把记忆接出去给外部系统用"),比之前候选的「Prompt 直供」更形象。此前否决的候选:「Prompt 嵌入」(与向量 embedding 必混淆)、「Prompt/上下文注入」(撞 prompt injection 安全术语)。

⚠️ 遗留一个决策点:英文名 Context Pack 与 Today Pilot 已有的「Context Pack」(当日上下文包,一次性复制)撞名。建议:功能/接口层用 `context-pack` 归本功能,Today Pilot 侧 UI 术语改为「当日上下文包」或后续把 Today Pilot 的复制能力并入本功能的 `scope=today` 预设(两者本质同源)。

### 4.3 预设下拉 vs 自定义文本 → 推荐两者混合

- **预设下拉为主**(默认「身份与偏好」):`身份与偏好` / `近期重点` / `今日安排` / `重点项目动态`。预设按 key 走固定管线(画像投影 / Recent Focus / Today Pilot / watched projects),输出结构稳定、可脱敏审计、可缓存、接口文档好写。
- **下拉最后一项「自定义…」展开小输入框**:自由描述如"XX 项目的近期动态",映射到 recall/ask 管线生成。满足长尾,但输出质量不承诺,UI 上标注"实验性"。
- 理由:纯下拉不够灵活,纯文本框让用户面对空白输入不知道能要什么、输出也无法稳定脱敏。预设负责可靠性与可发现性,自定义负责长尾,互不拖累。

### 4.4 接口草案(实现期再细化,按设计稿口径)

```
GET  /api/v1/context-pack?scope=identity_preferences|recent_focus|today|projects
GET  /api/v1/context-pack?scope=custom&q=XX+项目的近期动态   ← 自定义(实验性)
Authorization: Bearer <token>
200 → { "prompt": "...", "sources": [...], "generatedAt": "...", "redactionReceipt": {...} }
```

- 只读,不写记忆;返回 `{ prompt, sources[], generatedAt, redactionReceipt }`。
- 输出经画像投影/脱敏层(对齐 Compose「身份投影」既有门控),USER_CORE 原文不外发。
- 与既有 MCP Server(`context_brief`/`profile_hint`)的关系:MCP 面向程序化接入,本接口面向"人肉复制粘贴 + 简单 HTTP 集成";帮助页条目内交叉引导两条路。

## 5. 条目内容模式:三段式「使用前检查 → 步骤 → 结果预览」(定稿,对齐 claude design)

每个条目展开后固定三段(不需要的段落省略),demo 已全量实现:

1. **使用前检查**:满幅状态条。已就绪 = 绿底 + ✓ 圆标 + 右侧「已就绪」;待办 = 浅橙底 + ⓘ 圆标 + 右侧描边「去授权/去配置/去安装」pill 按钮;下方可跟一行灰色 hint(如"未初始化时 popup 提供一键初始化")。真实页面实时检测,未就绪不锁死后续内容。
2. **步骤**:蓝圆 ①②③ + 单行文案,纯文本、不内嵌大块内容——快速读完即知使用路径。
3. **结果预览**:统一容器 = 灰底 header(标题 + 右侧「▶ 加载预览 / 查看真实界面」蓝色链接)+ 内容区。内容区优先放<b>轻量 HTML 静态仿真</b>(定时消息 = composer 输入框 + 虚线未来消息行;Ask = 问题行 + 带来源 chips 的答案卡,均照设计稿复刻);重量级内容(动画 iframe、整页截图)收在「加载预览」toggle 里按需展开。截图类条目内容区直接放真实渲染图。

「记忆外接」条目的结果预览是唯一实时交互块(预设下拉 + Prompt + 复制)。配置检查数据源(实现期):`chrome.storage`、Memory Service `/stats`、各功能状态端点;每条目声明 prerequisites 数组,由 help.ts 统一驱动。

### 5.1 目录 scrollspy(已在 demo 实现)

左侧目录锚到每个条目(`#get-1`…`#cap-5`);滚动时按「视口上 1/3 基准线」计算当前条目并高亮(蓝底 + 左侧竖条),点目录项自动展开对应折叠卡。940px 以下退化为单栏静态目录。

## 6. 截图与演示素材清单(M4 生产)

| 素材 | 用于条目 |
|---|---|
| Ask 搜索结果页 / Quick Ask 小窗 | 获取 #2 |
| Lens 右下角角标 + 展开卡 | 获取 #3 |
| Compose 输入框辅助 | 获取 #4 |
| popup Top 3 | 获取 #5 |
| 会中 side panel、会后 Panorama | 获取 #6 |
| 定时消息管理页 + Glip 闹钟 icon | 获取 #7(动画 demo 已有) |
| 豆包 Memory Sync Thread | 获取 #8 / 捕获 #3 |
| 划词「+ 记住」、复核面板 | 捕获 #1 |
| 记忆入口规则页 | 捕获 #2 |
| Coverage 地图页 | 捕获 #4 |
| 画像页 | 捕获 #5 |

截图统一浅色/页面自带主题、2x retina,最终存 `static/help-assets/`(demo 阶段暂存 `docs/progressing/extension-help-center-assets/`)。

### 6.1 出图流水线(已落地:`tools/shoot-help-assets.mjs`)

**A 类 · 扩展自有页面 —— 全自动,已产出。** Playwright(复用 `desktop-app/node_modules/playwright`)加载**真实 dist 扩展**渲染后截图,Memory Service 流量全部被 route 拦截、按 fixture 应答:

- 关键坑(都已踩平):正式版 Chrome 137+ 移除了 `--load-extension`,必须用 Playwright 的 `channel:'chromium'`;而默认 headless 走 headless_shell(不支持扩展),`channel:'chromium'` 才是完整二进制的新 headless。unpacked 扩展 ID 可确定性算出(`sha256(dist 绝对路径)` 前 16 字节映射 a-p),不必等 service worker。
- 拦截 `memory.xmnup.com` + `localhost:3210` 全部请求,未命中 fixture 的端点自动打印清单——补数据有精确依据,**绝不触碰真实服务/真实数据,零外发副作用**。
- **重要发现**:Meeting Pilot 的两个页面自带 `?demo=1` 演示态([src/meeting-shell/demo.ts](../../src/meeting-shell/demo.ts)),数据完整且是项目自己维护的口径——比外部 fixture 更权威。其他页面若也有类似内置 demo 参数,优先复用。
- 已产出 9 张:`popup.png`、`explore-search.png`(记忆查询)、`explore-profile.png`(画像)、`explore-rules.png`(入口规则)、`explore-coverage.png`(loading 态,fixture 待补)、`scheduled-messages.png`(一键初始化向导)、`desktop-app.png`、`meeting-sidepanel.png`、`meeting-panorama.png`(后两张走 `?demo=1`,4 人参会 / 结果装订 3 项 / 3 个待复核行动项)。
- M4 待迭代:补 `/ask`、`/today-pilot/today`、`/coverage/*` 等 fixture 让搜索结果与今日卡片更丰满(脚本会自动列出未命中端点)。

**B 类 · content script 注入型 UI —— 配图已全部齐备。** 这类 UI 必须注入真实登录站点才会出现,自动化够不着。**关键发现:仓库里 [`docs/demo/screenshots/`](../demo/screenshots/) 已有 14 张真实界面截图**(不是 `.planning/.../screenshots/`,那里只有「记忆主张归属」的桌面/移动两张,不覆盖任何缺口)。真图比 HTML 仿真说服力强得多,已直接采用:

| 位置 | 条目 | 素材 |
|---|---|---|
| Compose Assist 输入框旁「建议内容」 | 提取 #4 | ✅ 真实截图 `Personal AI - assist.png` |
| Jira 蓝色设计面板 + 绿色后端面板 | 提取 #7 | ✅ 真实截图 `Personal AI - design link and BE dates.png`(sips 裁 y=295 起 215px 高,保留两张面板) |
| 消息 hover 四按钮(稍后/关注后续/答复/联动) | 行动 #2 | ✅ 真实截图 `Personal AI - message reaction.png` |
| Memory Lens 角标卡 | 提取 #3 | ✅ 按设计稿 HTML 复刻(设计稿此处本就是 HTML 仿真) |
| 划词「+ 记住」高亮 pill | 捕获 #1 | ✅ 按设计稿 HTML 复刻 |

`docs/demo/screenshots/` 里还有 `ask.png` / `memory.png` / `messages filter.png` / `People network.png` / `follow up.png` / `Jira preview.png` / `ask project.png` 等未使用,M4 可按需替换掉现在的 headless 渲染图(真图内容更丰满)。所有真实截图都含同事姓名和真实消息,**若帮助页要对外分享需先脱敏**——这是采用真图的唯一代价,已记录待你决策。

(如需在截图上标注控件,用 HTML/SVG 叠加而非烧进 PNG;按 review 意见,demo 页不再单列标注样例节。)

## 6.4 中英双语与语言联动(demo 已实现双语,联动待开发)

**渲染机制(照搬设计稿):** 每处文案写成一对 `<span class="l-zh">中文</span><span class="l-en">English</span>`,靠根节点 `data-l` + 两条 CSS 规则切换,零 JS 开销:

```css
[data-l="en"] .l-zh { display: none !important; }
[data-l="zh"] .l-en { display: none !important; }
```

例外:`<option>` 内不能塞 span,用 `data-zh` / `data-en` 属性 + 切换时改 `textContent`(demo 已这样做);`placeholder`、动态生成的分享文案同理走 JS 分支。

**真实开发要处理的语言联动(demo 用 localStorage 占位):**

1. **初始语言**:`help.ts` 挂载前读 `chrome.storage.local` 的 `personalAiUiPreferences.language`(现有 key,见 [docs/index.md 语言偏好画像条目](../index.md)),`'en-US'` → `data-l="en"`,`'zh-CN'` → `data-l="zh"`;读取失败或无值回落 `zh`。**必须在首帧前同步设好 `data-l`**,否则会闪一下中文再切英文。
2. **跟随 Options 变更**:注册 `chrome.storage.onChanged` 监听同一 key,用户在 Options 改语言后已打开的帮助页实时切换,不需要重新打开。
3. **页内切换的写回口径**:页头的中文/EN 按钮**只影响本页展示,不写回 Options 全局语言**(避免用户在帮助页试一下英文就改掉整个扩展的语言);仅存到 `chrome.storage.local` 的一个独立 key(如 `helpCenterLangOverride`)。若该 override 存在则优先于 Options 语言,并在页头给一行「已按本页设置显示英文 · 恢复跟随设置」的复位入口。
4. **复用既有 i18n**:扩展已有 `src/i18n/`(`useExtensionUiLanguage` / `UiLanguage` 类型),帮助页的语言判定应复用这套而不是自己写一份;但**文案本身不进 i18n 资源包**——帮助页是长文案页,双 span 内联在 HTML 里比拆成 key 更好维护。

## 6.5 share-modal 融合(方案 A 已在 demo 实现)

[share-modal.tsx](../../src/modals/share-modal.tsx) 的本质是「挑功能 → 生成推荐文案 → 复制或走定时消息代发」——功能清单与帮助页完全同源,合并后互相成就:帮助页给分享提供了"逛着选"的货架,分享给帮助页提供了传播出口。三个方案:

| 方案 | 形态 | 判断 |
|---|---|---|
| **A · 推荐托盘**(推荐,demo 已实现) | 每张功能卡头部一个「+ 推荐」小按钮;右下角浮动「↗️ 推荐给同事 (n)」托盘,展开即文案预览 + 接收人 + 复制/代发。 | ✅ 购物车心智,零学习成本;分享行为发生在浏览功能的当下("这个不错→推荐");不打断阅读,不占版面 |
| B · 分享模式开关 | 页头切换进「分享模式」,所有卡片变成可勾选态,底部出操作栏。 | 模式切换有认知成本;为低频动作引入全局状态,过重 |
| C · 独立分享区块 | 页面底部保留一个类似现 share-modal 的区块,卡片上的按钮只是滚动锚过去。 | 最接近现状、最割裂;两块 UI 重复列功能清单 |

A 的实现要点(见 demo 右下角):选中的功能生成文案沿用 share-modal 现有模板(首个功能做主推语,其余列「还可以做到」);「代发」按钮沿用现有配置门控(定时消息未初始化 → ⚠️ 提示 + 引导);popup 的 ↗️ 分享入口改为打开 `help.html#share`(自动展开托盘),`share-modal.html` 下线。托盘选中态可存 localStorage,跨次打开保留。

## 7. 实施分期

- **M1 静态骨架**:help.html/help.ts + 全部条目文案 + 截图占位 + popup 入口切换。定时消息 demo iframe 接入。
- **M2 配置检查**:prerequisites 驱动的实时 checklist + 「去配置」跳转。
- **M3 Prompt 直供**:memory-service 新增 context-feed 路由(预设 4 档),帮助页条目实时拉取 + 复制;自定义输入(实验性)。
- **M4 素材完善**:落地 `tools/shoot-help-assets.mjs`(A 类自动出图,fixture 补丰满)+ B 类 mockup 手绘;标注坐标标定;「更多能力」折叠区补链接。

验收:新装用户(无任何配置)打开帮助页,每个条目都能看懂"是什么、怎么用、要不要配";已配置用户看到的 checklist 全绿;Prompt 直供默认预设 3 秒内出结果。

## 8. 待 review 决策点

1. ~~是否拆第三板块~~ 已落定:按设计稿拆「让 AI 替你做事」(定时消息 / 消息联动操作 / 豆包随身)。
2. 命名已定「记忆外接」;英文 Context Pack 与 Today Pilot 撞名怎么收敛(见 §4.2)?
3. 自定义 prompt 输入是否 v1 就做?当前方案:M3 做,标实验性。
4. 二期条目(Rehearsal/Radar/Skill Foundry/Topic Messages 等)是否需要占位露出?当前方案:折叠区一行链接。
5. 剩下 3 张 content-script 图(Lens 角标 / Compose 草稿 / 划词记住)走 HTML 仿真图——我来画,接受吗?还是你要提供真实站点实拍图?
6. share-modal 融合采用方案 A(推荐托盘)?确认后 `share-modal.html` 下线,popup ↗️ 入口改指 `help.html#share`。
7. **真实截图含同事姓名与真实消息内容**(Juan de Bravo / April Huang / Esther Pan 等),帮助页随扩展分发即等于对内公开。是否接受?可选:(a) 原样用,内部工具无妨;(b) 我把人名和正文替换成演示数据后重截;(c) 换回 HTML 仿真。
8. 页内语言切换是否写回 Options 全局语言?当前方案:**不写回**,只存本页 override + 给「恢复跟随设置」入口(见 §6.4)。
