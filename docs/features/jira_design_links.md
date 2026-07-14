---
description: 
globs: 
alwaysApply: false
---
# Jira 设计链接显示功能

*最后更新: 2026-07-13*

## 功能概述

Jira 设计链接显示功能用于在 Jira ticket 页面自动汇总相关设计入口，让开发、测试、PM 不需要在 description、Jira 原生 Designs 区块、remote links、linked issues、Epic、Parent ticket 之间来回查找。当前实现覆盖 Figma/FigJam/Figma Slides、Miro、Loom、Google Slides、Zeplin 和 UX 项目 ticket 上维护的设计链接，并在 Jira summary 下方用紧凑面板逐条展示设计入口、UX ticket、可行动设计状态、设计更新时间、UX Epic 状态和 ETA。

## 大白话运行逻辑

这个功能会把“这个开发 ticket 相关设计到底在哪里”这件事自动找一遍：先扫当前 ticket 明面上的链接，再查 Jira 的 remote links / Designs / linked issues / Epic / Parent，最后把真正可点、可判断状态的设计入口合并到 summary 下方。

结果主要受这些因素影响：

1. 当前 ticket 本身的链接最直接：description、原生 Designs 区块和 remote links 会优先给出明确入口。
2. UX ticket 关联质量：linked issue、Epic、Parent 能不能找到 UX 项目 ticket，决定能不能补充缺失设计入口；当 Jira DOM 只暴露 query 参数、`jql` 过滤条件、属性或纯文本 key 时，面板会先显示 `恢复范围` 总览和本页实际恢复来源分布，query 来源会细分为 `selectedIssue query`、`issueKey query` 或 `JQL query`，再在具体行显示 key 来源回执和 `只读恢复` 边界，而不是把弱回退伪装成标准链接或已经写入的 Jira 关系；如果 URL path 是普通开发票、query 里才有 UX 票，也会按配置的设计项目选择 UX key，并在恢复总览中说明同一 DOM 片段里有多少非设计项目候选被忽略。
3. 域名白名单：只有 Figma、Miro、Loom、Google Slides、Zeplin 或配置过的设计域名会被当成设计链接；Miro 只收 board / live-embed 路径，Loom 只收 share / embed 路径，避免官网、帮助、博客、价格页误占交付入口。
4. 设计状态字段：remote link / UX ticket 上有状态、更新时间、ETA 时，面板才会显示更强行动提示；如果 remote link 的 `object.url` 不是设计链接，也会从 encoded `globalId`、status icon link 或跳转 URL 参数里保守补找可信设计 URL。若来源只给了 `Design updated` 状态但没有可用更新时间，会展示 `更新时间缺失`，不把缺失日期伪装成普通已更新行；若多个更新时间字段并存，会展示最新有效日期，并用可见短标签说明该日期来自 status、object 还是 remote link 元数据，hover/读屏文案继续保留完整来源；只要本页有更新时间信号或缺时间的 Design updated 行，面板顶部会显示 `复查范围`，汇总更新时间信号数量、最新有效日期、最新来源口径和缺时间数量，提醒开始实现前复查设计，但不刷新 Figma、不编辑 Jira，也不确认已经复核。
5. 去重与安全过滤：同一 Figma 文件/节点、encoded URL、重复链接会被合并；非 http/https 链接不会展示。面板首屏先显示 `扫描口径`，说明当前行只是 Jira 页面和只读 Jira API 可见的交付入口批次，不会刷新 Figma/Zeplin、枚举私有设计文件、创建/编辑 Jira 链接或标记设计已复查。Figma Community / help / marketing、Zeplin marketing / profile / project settings 这类看起来像设计工具但不是交付资源的 URL 不会变成设计行；即使它们来自 UX ticket 的设计链接字段，也不会因为该字段允许内部 generic http(s) 入口而降级成 `Design link`。如果同一面板里有真实设计入口，会先显示 `过滤范围` 回执，并在 footer 保留已过滤的 non-handoff refs、过滤来源分布和过滤原因分布，例如 Description、Design field、Figma Community、Zeplin settings；当过滤项包含 UX ticket 设计字段时，首屏额外显示 `设计字段被过滤`，说明字段已扫描但只剩非交付链接时仍保留 `Missing link`，方便用户知道这是有意剔除，不是漏扫或隐藏有效设计；如果本页只发现这类非交付设计工具链接，也会显示 `未找到交付设计入口`、过滤来源、过滤原因、设计字段过滤和 `只读扫描` 回执，而不是静默不显示。
6. 打开链接只是打开来源：设计入口、UX ticket 或 UX Epic 链接的 hover / 读屏文案会先说明目标、来源、待复查更新时间、恢复候选来源和只读边界；点击后原 Jira 页会留下 `来源打开回执`，显示刚打开的目标、来源通道和 `只读打开` 边界。如果点击的是带更新时间或缺时间状态的设计入口，回执会继续带上 `待复查` 日期、更新时间来源或 `更新时间缺失`，并说明打开不等于已核对最新更新；如果点击的是非标准 DOM 证据恢复出的 UX ticket，回执会继续显示 `Key from ...`、`恢复候选打开` 和候选关系边界，避免把能打开 ticket 误读成 Jira 已存在正式 issue link。这不会刷新 Figma/Jira 元数据、标记设计已复查、创建或编辑 Jira 关联，也不会写入 Memory Service。

## 主要功能

1. **多渠道检测**：从 description、Jira 原生 Designs 区块、Jira remote links、当前 ticket linked issues、Epic、Parent ticket 中收集设计相关入口。
2. **可配置 UX 项目识别**：默认使用 `UX*` 前缀模式，也支持通过 `DESIGN_JIRA_PROJECT` 改为 `UX` 这类精确匹配；配置会自动处理首尾空格和大小写差异。
3. **自定义设计域名识别**：通过 `DESIGN_LINK_DOMAINS` 补充内部原型、设计系统或交付站点域名；精确域名只匹配该 host，`*.example.com` 只匹配子域名。
4. **层级关联分析**：Epic 和非 Epic ticket 都会尝试向上查找相关 UX ticket。
5. **稳定展示**：在 Jira summary 下方展示紧凑面板，长标题会截断，标签会换行，面板会按实际内容高度自适应，hover 效果与 Backend ETA 卡片保持一致且不挤压页面内容；Jira SPA 切换到无设计链接的 ticket、带尾斜杠的 ticket URL 或非 ticket 页面时会正确识别并清理旧面板。
6. **状态补充**：对 UX ticket 额外显示 UX Epic、Epic 状态和 ETA（due date 或 fixVersion），对 Jira remote link/UX ticket 设计链接显示可用的设计状态和更新时间；`ready_for_development`、`not_ready_for_dev` 这类机器状态会显示成人可读标签并映射到正确状态色，Jira/Figma 的 `Changed`/过期类状态会统一呈现为 `Design updated`。
7. **可行动状态展示**：逐条展示 `Ready for dev`、`Design updated`、`Missing link`、`Not ready` 等有行动意义的状态，并用左侧状态扫描线降低多链接场景下的识别成本；`Not ready for dev` 和 `Ready for review` 不会被误判成可开发。
8. **缺失链接提示**：当关联 UX ticket 没有可用设计链接时，会展示 `Missing link` 状态和 UX ticket key，但不展示设计 ticket 标题，并把该项排在普通链接之前，避免开发者误以为没有设计依赖；如果 key 来自 query 参数（细分 `selectedIssue` / `issueKey` / `jql` 里的 issue key）、`data-issue-key`、`aria-label` 或纯文本，面板会显示恢复候选总数、实际来源分布和 `恢复范围`，具体行会额外显示 `Key from ...` 和 `只读恢复` 回执，说明 Personal AI 只是展示候选，不会创建/编辑 Jira issue links、设计字段或关联关系，也不证明这是正式 Jira 关联；点击这些恢复候选后，打开回执仍保留恢复来源和候选边界。
9. **安全和去重**：只接受 http/https 设计链接，过滤重复设计链接/UX 链接，并保留合并后的来源标签；Figma 文件/节点链接会按稳定设计身份去重，避免 Jira encoded URL、描述中的可读 URL 或分享参数差异把同一设计展示成多行。

## 使用方法

### 自动检测

功能会在Jira ticket页面自动运行，无需用户手动操作。当检测到设计链接时，会在ticket summary下方显示设计链接区域。

### 展示格式

设计链接以以下格式展示：
```
[Personal AI icon] Design [链接标题](设计链接) [UX ticket] [UX Epic 状态] [ETA] [来源标签]
```

例如：
- `[icon] Design Figma design ↗ [Description]`
- `[icon] Design Ready checkout prototype ↗ [Ready for development] [Remote link]`
- `[icon] Design Ready checkout prototype ↗ [Ready for development] [Updated 2026-05-18] [Remote link]`
- `[icon] Design Draft onboarding walkthrough ↗ [Not ready for dev] [Remote link]`
- `[icon] Design UX-12345 页面设计稿 ↗ UX-12345 UXE-88 In Progress ETA: 2026-05-10 [Epic link]`
- `[icon] Design UX-12345 [Missing link] UXE-88 In Progress [Parent child]`

## 检测逻辑

### 1. Description 扫描
- 扫描ticket描述中的所有链接
- 识别 Figma/FigJam/Figma Slides、Miro、Loom、Google Slides、Zeplin 等设计或交付相关链接
- Figma 只自动识别设计、原型、FigJam、Slides 等交付路径，避免把 Figma Community、帮助页或营销页误当成设计稿；被过滤的 Figma 参考会进入 footer 的 non-handoff refs 计数
- Miro 只识别 `/app/board/` 和 `/app/live-embed/`，Loom 只识别 `/share/` 和 `/embed/`；普通 Miro/Loom 官网、帮助、博客和价格页不会渲染成 handoff 行
- Zeplin 链接会按 URL 路径尽量区分 screen、section、project、flow、component、styleguide，减少多个交付入口混排时的扫描成本；`profile`、`integrations`、`project/<id>/settings` 等非交付页面会被过滤并进入 footer 计数
- UX ticket 设计链接字段仍允许团队内部任意 http(s) 交付入口，但已知的 Figma / Zeplin 非交付页会优先被排除，不会作为 generic `Design link` 占据 handoff 行；这些被过滤项会标记为 `Design field` 来源，让用户知道缺失链接行不是没有扫描 UX ticket 字段
- 支持 `DESIGN_LINK_DOMAINS` 中配置的内部设计/原型域名
- 支持链接元素和文本中的URL提取
- 链接元素会优先使用有意义的锚文本、`title` 或 `aria-label` 作为展示标题，例如 “Checkout mobile handoff”；`the design`、`click here` 这类弱标题会回退为工具名称
- 自动去掉文本 URL 末尾常见标点，避免把 `),` 等字符带入链接

### 2. Jira Remote Links 扫描
- 调用 Jira remote issue links API 读取当前 ticket 和 UX ticket 上的结构化外链
- 识别 Jira Designs/Figma 集成、Web Links 或其他工具同步进来的设计链接
- 如果 remote link 提供状态标题，会作为短标签展示
- 远程状态会兼容 `icon.title`、`status/name/value` 和 `ready_for_development` 这类机器值，避免 Jira Designs 状态落到 Neutral
- 如果 Jira/Figma 同步元数据包含更新时间，会展示短日期标签；当同一 remote link 同时给出 object/status/link 多个更新时间时取最新有效时间；有精确时间时 tooltip 和无障碍标签保留标准化 UTC 时间，只有 `YYYY-MM-DD` 日期时会说明来源只提供了日级更新时间，不把它伪装成 `00:00 UTC`；行内还会显示 `状态时间`、`对象日期`、`链接时间` 等短标签，说明这个可见日期的元数据口径；tooltip / `aria-label` 保留选中的具体字段来源，方便排查不同来源时间不一致；若状态是 `Design updated` 但没有有效日期，则显示 `更新时间缺失` 边界标签
- Jira/Figma 集成返回的 URL 可能包含 encoded `node-id` 或一次性分享参数；合并时会按 Figma 文件 key 和节点 identity 归并，点击时仍保留原始可打开链接
- 如果某些 remote link 把可打开设计 URL 放在 encoded `globalId`、status icon link，或普通系统跳转链接的 `target/url` 参数里，而 `object.url` 本身不是设计链接，面板会只在 URL 命中 Figma/Zeplin/Miro/Loom/Slides 或配置域名时补展示，避免把普通外链误当设计稿。

### 3. Jira 原生 Designs 区块扫描
- 当 Jira 页面本身已经渲染 Designs/Figma 设计卡片时，会直接从该区块读取设计链接、卡片标题和常见状态标签。
- 这个入口不依赖 remote link API，能在 API 被权限、编辑态安全策略或 Jira 集成差异阻塞时继续保留页面上已经可见的设计上下文。

### 4. Linked Issues 分析
- 从DOM中直接提取Issue Links部分
- 筛选UX开头的相关tickets；如果 Jira DOM 只暴露 issue key 文本、`aria-label`、`data-issue-key`，新版 Jira issue URL（例如 `/jira/.../issues/KEY`），或链接 query 上的 `selectedIssue` / `issueKey` / `jql` 参数，也会按配置的 UX 项目优先选择正确 key，并用 `/browse/KEY` 作为回退链接继续展示；即使 href path 本身是当前开发票，只要 query 里有匹配的 UX key，也不会被 path key 抢走；`jql=project%3DUX` 这类只有项目名、没有 `UX-123` 形态 issue key 的查询不会生成候选
- 标准 `/browse/KEY` 和新版 `/issues/KEY` 路径不额外打扰；只有 query 参数、属性、aria 或纯文本回退会显示 `Key from ...` 标签；query 会进一步区分 `selectedIssue query`、`issueKey query` 和 `JQL query`，hover 说明这是 Personal AI 从非标准 DOM 中恢复出来的 UX 项目 key
- 获取对应的summary信息

### 5. Epic 层级分析
- **当前票为Epic时**：
  - 直接从Epic中查找UX related issues
  - 检查Epic的Parent Link下的UX tickets
- **当前票非Epic时**：
  - 查找上级Epic的UX linked issues
  - 通过Epic的Parent Link查找相关UX tickets

### 6. API 数据获取
- 调用Jira REST API获取ticket详细信息
- 提取UX tickets的customfield_21233字段（设计链接）
- 读取 Jira remote links，作为比 description 更结构化的设计来源
- 使用JQL查询获取child issues
- 拉取 UX ticket 的summary、status、Epic Link、due date、fixVersion，用于补充上下文

## 技术架构

### 核心模块

```typescript
src/contentScriptJira.ts        // Jira 页面检测、API 查询、面板渲染
src/jiraDesignLinks.ts          // URL 清理、HTML 转义、来源标签、去重、状态 tone
tools/verify-jira-design-links.ts // 本功能的轻量验证脚本
tools/verify-jira-design-links-e2e.mjs // 加载 dist 扩展的 Jira fixture E2E
```

### 数据结构

```typescript
interface DesignData {
  type: 'figma' | 'ux_ticket';
  url: string;
  summary?: string;
  uxTicketKey?: string;
  source: string;
  linkProvided?: boolean;
  designStatus?: string;
  designUpdatedAt?: string;
  uxEpicKey?: string;
  uxEpicStatus?: string;
  uxEta?: string;
}

interface DirectDesignItem {
  type: 'figma' | 'design_link';
  url: string;
  source: string;
  label?: string;
  title?: string;
  status?: string;
}

interface UXTicket {
  key: string;
  summary: string;
  source: string;
}

interface FigmaLink {
  type: 'figma';
  url: string;
  source: 'description';
}
```

## 来源标识说明

| 标识 | 说明 |
|------|------|
| `description` | 从 ticket 描述中提取的设计链接 |
| `remote_link` | 从 Jira remote links / Designs / Web Links 中提取的设计链接 |
| `jira_designs` | 从 Jira 页面已渲染的原生 Designs 区块中提取的设计链接 |
| `design_field` | 从 UX ticket 设计链接字段中提取的链接 |
| `linked_issues` | 从当前页面 Issue Links 中提取的 UX tickets |
| `epic_subtask` | 从Epic的subtask中提取的UX tickets |
| `epic_issue_link` | 从Epic的issue links中提取的UX tickets |
| `epic_child_issue` | 从Epic的child issues中提取的UX tickets |
| `parent_subtask` | 从Parent ticket的subtask中提取的UX tickets |
| `parent_issue_link` | 从Parent ticket的issue links中提取的UX tickets |
| `parent_child_issue` | 从Parent ticket的child issues中提取的UX tickets |

## 样式设计

### 基本样式
- 使用浅灰背景和 Atlassian 风格蓝色链接，尽量贴近 Jira 页面本身。
- 面板 hover 使用与 Backend ETA 卡片一致的轻微浮动和 footer 展开效果，不挤压页面内容。
- 面板不做顶部开工判定、状态摘要或主行动推荐，因为真实设计入口可能分布在多个 UX ticket 中；用户直接扫描每一条 ticket/link 自行判断。
- 每个链接项包含 Personal AI 图标、设计入口、UX ticket、设计状态、UX Epic 状态、ETA 和来源标签；缺失设计链接时只展示 UX ticket key 和 `Missing link` 状态，并在 hover 说明里提示先打开 UX ticket 补查/补齐交付入口，避免设计 ticket 标题占据扫描空间。
- Remote link 提供更新时间时额外显示 `Updated YYYY-MM-DD`，同等行动状态下最近更新的设计会排在更前；旁边的 `状态时间` / `对象日期` / `链接时间` 等 chip 会把时间来源口径直接露出来，避免用户必须 hover 才知道这是 status、object 还是 remote-link 元数据。日期 hover 和屏幕阅读器标签会说明“如果实现已经开始，需要重新检查设计”。有具体时刻时会显示标准化 UTC 时间；只有日期时只按日级证据说明，避免把来源没有给出的时间精度说成确定事实；如果 Jira/Figma 同步了多个更新时间字段，tooltip 会标明当前采用的字段来源；若只能确认设计已更新、不能确认更新时间，会用灰色虚线 `更新时间缺失` 标签说明这是来源缺口。面板顶部的 `复查范围` 会把这些更新时间信号先汇总出来，并直接显示最新日期的来源口径，让用户不用逐行找 chip 才知道本页是否需要重新检查设计。
- 点击设计入口、UX ticket 或 UX Epic 之前，链接本身的 `title` / `aria-label` 会先说明打开目标、来源通道、更新时间或恢复来源，以及只读打开、不刷新 Figma/Jira、不标记复查、不写 Jira/Memory Service 的边界；点击后面板内会出现 `来源打开回执`，保留同一批信息。如果打开的是有更新时间信号的设计入口，回执会保留 `待复查 YYYY-MM-DD`、时间来源 chip 或缺时间提示，防止用户回到 Jira 页后把“打开过”误读成“已经复查确认”；如果打开的是恢复候选 UX ticket，回执会继续显示恢复来源和候选关系边界，防止用户把“能打开”误读成“已建立正式 Jira 关联”。这个回执不会把点击解释成设计复查完成、Jira 关系写入、Figma/Jira 元数据刷新或 Memory Service 写入。
- 每行会按状态添加轻量视觉扫描线：Ready、Updated、Missing/Not ready/Blocked、Review 使用不同边线和浅底色，普通链接保持中性样式。
- Jira/Figma 的设计状态会按 tone 展示：Ready for dev、Design updated、Missing link、Not ready、Blocked、Review、Done、Neutral；Ready/Updated/Missing/Not ready 等更需要处理的入口会排在普通 description 链接前面。状态标签 hover 会说明它对开发者意味着什么，例如设计已变更时提示重新检查链接设计。
- 重复链接合并时会优先保留 Jira remote link / Designs 提供的结构化标题和状态，UX ticket 行也会优先展示具体设计名，避免 description 或工具默认名覆盖真正可行动的设计状态。
- 行内来源 tag 会优先显示更权威的来源，例如合并行显示 `Remote link, Linked issue`，而不是按内部合并顺序把关联票放在前面；hover 文案使用 `Source: ...` 人类可读格式，不暴露 `linked_issues` 这类内部 key。
- 面板首屏会展示 `扫描口径`，把本次交付入口数量、来源通道、被过滤的非交付设计工具 URL 数量和只读边界放在所有设计行之前；这表示 Personal AI 只汇总本页和 Jira 只读 API 当前可见的 handoff 批次，不刷新 Figma/Zeplin、不枚举私有文件、不写 Jira，也不确认用户已经复查设计。
- 面板 footer 和无障碍标签会展示紧凑来源摘要，例如 `8 entries · Remote link, Jira Designs, Linked issue, Description`，用于快速确认本次结果来自哪些扫描通道；如果 description / Jira Designs / remote link / UX ticket 设计字段里同时出现被过滤的 Figma/Zeplin 文档、社区、营销或设置链接，会在设计行上方显示 `过滤范围` 回执，并在 footer 保留 `filtered non-handoff refs`、`来源 Description 3, Remote link 1`、`原因 Figma Community 2, Zeplin non-resource project page 1` 和 `设计字段被过滤 1` 这类小标签，只解释过滤边界，不把这些 URL 展示成设计入口。若本页没有任何真实 handoff 行、但确实出现了这些设计工具 URL，会渲染一行 `未找到交付设计入口 / 仅过滤非交付链接 / 过滤来源 / 过滤原因 / 设计字段被过滤 / 只读扫描`，说明 Personal AI 只是读页面和 remote link，不创建或编辑 Jira 设计链接、issue link 或关联关系；当 UX ticket 字段只剩非交付链接时，UX ticket 行仍保留 `Missing link`。
- 对非标准 linked issue key 恢复路径，面板会先显示 `恢复范围` 行、候选数量和实际来源分布，只列出本页真正用到的 query 参数、`data-issue-key`、ARIA label 或纯文本等非标准页面证据；如果同一 DOM 片段里还出现当前开发票、其他项目票或不匹配 `DESIGN_JIRA_PROJECT` 的 key，恢复范围会显示被忽略的非设计项目候选数量，并把过滤来源放进 hover/读屏说明；UX ticket 行会显示 `Key from selectedIssue query`、`Key from issueKey query`、`Key from JQL query`、`Key from data-issue-key`、`Key from ARIA label` 或 `Key from raw text`，并带 `只读恢复` 标签，让用户知道这张缺失设计链接卡片来自可见但不完整的 Jira 结构，而不是完整 remote link 或已经写入的 Jira 关联。

### 响应式设计
- 多个设计链接垂直排列。
- 长 summary 保持单行省略，其他标签允许换行。
- 状态和来源使用短标签，减少 summary 区域拥挤。

## 性能优化

### API 调用优化
- 去重处理避免重复的设计链接
- 并行读取 UX ticket 设计上下文，减少多个 UX 关联票带来的等待时间
- 异步获取设计链接内容
- 缓存 issue context 和 remote links，避免同一 UX ticket 或 UX Epic 重复请求

### DOM 操作优化
- 检查并移除已存在的设计链接容器
- 仅在检测到设计链接时才创建展示元素
- SPA 切换 ticket 时会跳过过期请求结果，避免把旧 ticket 的设计链接渲染到新页面

### 错误处理
- API调用失败的降级处理
- DOM元素不存在时的兜底逻辑
- DOM 等待超时后继续扫描已存在内容，避免 optional 字段缺失阻塞 description 链接展示
- 扩展配置读取会做总超时降级，避免 storage 或 service worker 未响应时阻塞 Jira 面板渲染
- 设计链接相关 Jira API 只做只读 GET；配置 token 已读取后会显式传入请求，没有 token 时直接走 cookie GET，避免重复配置读取拖慢面板
- 异步扫描会在 Jira SPA 页面切换后中止后续 DOM 读取；离开 ticket 页面会立即清理设计链接和 Backend Progress 面板，避免旧信息残留

## 浏览器兼容性

### 支持的浏览器
- 当前主要作为 Chrome / Chromium 扩展验证。
- Edge Chromium 理论上兼容同一 content script 路径。
- Firefox / Safari 未作为当前验证目标，不在本功能交付范围内承诺。

### 依赖的Web API
- Fetch API (Jira REST API调用)
- DOM Selection API (元素查找)
- CSS Custom Properties (样式定制)

## 配置选项

### 自定义字段映射
```typescript
// UX ticket的设计链接字段
const DESIGN_LINK_FIELD = 'customfield_21233';

// Epic Link字段
const EPIC_LINK_FIELD = 'customfield_11450';

// Parent Link字段  
const PARENT_LINK_FIELD = 'customfield_15751';
```

### 设计域名白名单
`DESIGN_LINK_DOMAINS` 支持逗号、分号或换行分隔：
```text
prototype.example.com, *.design.example.com
```

这些域名只用于 description、Jira 原生 Designs 区块和 Jira remote links 的补充识别。UX ticket 设计链接字段仍允许任意 http/https 链接，以兼容团队内部维护的交付入口。

匹配语义：
- `prototype.example.com` 只匹配这个精确 host。
- `*.design.example.com` 匹配 `flow.design.example.com` 等子域名，不匹配裸域 `design.example.com`。

### 等待超时设置
```typescript
// DOM元素等待超时
const DOM_WAIT_TIMEOUT = 5000;

// 页面变化检测延迟
const PAGE_CHANGE_DELAY = 1000;
```

## 使用场景

### 设计师工作流
- 快速查找ticket相关的设计稿
- 验证设计实现与原稿的一致性
- 跟踪设计变更历史

### 开发者工作流
- 开发时快速访问设计资源
- 理解需求背景和设计意图
- 确认实现规格

### 项目经理工作流
- 跟踪设计进度
- 协调设计与开发资源
- 项目状态汇报

## 故障排除

### 常见问题

1. **设计链接不显示**
   - 检查ticket是否有UX相关的关联
   - 确认UX ticket中是否包含设计链接字段
   - 验证DOM结构是否正确加载

2. **API调用失败**
   - 检查网络连接
   - 确认Jira权限设置
   - 验证ticket key格式正确性

3. **样式显示异常**
   - 检查Content Security Policy设置
   - 确认扩展图标资源加载正常
   - 验证CSS样式是否被覆盖

### 调试方法
- 打开浏览器开发者工具查看控制台日志
- 检查Network面板中的API请求
- 使用扩展的background页面进行调试

## 实施计划

### 已完成功能 ✅
1. 基础DOM检测和API调用框架
2. 多渠道设计链接获取逻辑
3. Epic和Parent层级分析
4. 统一的设计链接展示界面
5. 去重和错误处理机制
6. UX Epic 状态与 ETA 展示
7. URL 安全清理、HTML 转义和 SPA 陈旧渲染保护
8. Jira remote links 识别、多设计工具链接识别、重复来源合并
9. UX ticket 行保留并展示 Jira/Figma remote link 的 Ready for dev / Design updated 等设计状态
10. 按设计状态排序和着色，优先暴露 Ready for dev / Design updated 等行动入口
11. 缺失设计链接的 UX ticket 会显示 `Missing link` 状态，并在普通设计链接之前提醒
12. UX ticket 设计上下文改为并行读取，减少多个关联票时的面板空白等待
13. Content script 初始化兼容已加载页面，降低 Jira SPA 或扩展重载后的漏展示概率
14. 配置读取增加 background 超时降级，防止扩展 service worker 异常时阻塞设计链接展示
15. Jira SPA 切到没有设计链接的 ticket 时会移除旧面板，避免误导用户
16. 支持 `DESIGN_LINK_DOMAINS` 自定义内部设计/原型域名
17. 默认 UX 项目识别使用 `UX*`，空配置也会覆盖 `UXDES-123` 这类 UX 前缀项目；配置输入支持大小写和首尾空格容错
18. 面板整体样式和 hover 效果与 Backend ETA 卡片保持一致；缺失链接行不展示设计 ticket 标题，减少扫描噪音
19. 设计状态解析避免把 `Not ready for dev`、`Draft`、`Ready for review` 误标成绿色 Ready，降低错误开工风险
20. 额外设计域名区分精确 host 与通配子域，避免把 `prototype.example.com` 意外放宽成所有子域
21. Description 中弱锚文本会回退检查 `title` 和 `aria-label`，避免 Jira Smart Link 或 “the design” 这类文本掩盖真实设计名
22. Jira `/browse/KEY/` 这类带尾斜杠 URL 会按正确 issue key 处理，避免 API 请求空 key 或 SPA 陈旧面板
23. Jira 设计链接配置读取增加总超时兜底；配置异常时仍用默认 `UX*` 继续渲染可见设计上下文
24. Jira 设计链接的只读 API 请求复用已读取 token；无 token 时直接走 cookie GET，避免二次配置读取或编辑态检查阻塞设计面板
25. Jira 原生 Designs 卡片优先读取结构化标题元素，避免把 `Design updated` 或 `Open in Figma` 等状态/按钮文案拼进设计名
26. 面板移除顶部开工判定、状态摘要和主行动推荐，只逐条展示可点击设计入口和 UX ticket，避免错误假设哪一张 ticket 才是真正设计来源
27. 自动识别 Zeplin Jira 交付链接，并收紧 Figma URL 识别范围，避免把 Figma Community/帮助页误报为设计入口
28. Jira remote link / Figma 同步元数据包含更新时间时，面板会展示 `Updated YYYY-MM-DD`，并在 UX ticket 去重合并后保留最新时间
29. 设计链接行按状态输出 `data-design-attention` 并展示轻量扫描线，用户在 Jira summary 下方可以更快定位 Ready、Updated、Missing link 和 Not ready 项
30. Zeplin 链接标签会区分 `Zeplin screen`、`Zeplin section`、`Zeplin project`、`Zeplin flow`、`Zeplin component` 和 `Zeplin styleguide`，但仍只把 `app.zeplin.io/project/...` 与 `zpl.io` 短链当作默认可信设计入口
31. Figma 设计链接去重使用稳定 identity key，`node-id=89%3A6`、`node-id=89-6`、重命名后的路径标题和非身份分享参数不会把同一设计节点拆成多行
32. Jira/Figma `Changed`、过期或 out-of-sync 状态会显示为 `Design updated`，并在状态标签 tooltip 中给出重新检查设计的含义；面板 footer 会显示本次结果的来源摘要
33. 合并后的行内来源 tag 会按来源权威性排序，并使用人类可读 hover 文案，帮助用户确认状态来自 Jira remote link、Jira Designs、UX ticket 还是 description
34. 同等状态优先级下，带有更新时间的设计行会先按最新更新时间排序；更新时间标签 hover 会把原始日期转成复查提示，避免用户只看到一个孤立日期
35. Linked issue 解析支持没有 href 的纯文本 issue key；当 Jira 或插件只渲染 `UX-123` 文本时，相关 UX ticket 仍会进入设计上下文并显示 `Missing link`
36. 混合文本里同时出现当前开发票和 UX 票时，解析会按配置的设计项目选择 UX key，不会被第一个非目标 issue key 抢走
37. Remote link 同时提供 object/status/link 多级更新时间时，会展示最新有效时间；短标签保持 `Updated YYYY-MM-DD`，tooltip 和 `aria-label` 包含 UTC 时间与复查含义
38. Linked issue href 不是 `/browse/KEY`、而是 Jira Cloud 新视图的 `/jira/.../issues/KEY` 或 `/projects/.../issues/KEY` 时，也会保留目标 UX ticket，避免可见文本只有 “Open dependency” 时漏掉缺失设计链接提醒
39. Jira remote link 不再只依赖 `object.url`；当 encoded `globalId`、status icon link 或跳转 URL 参数中包含可信设计 URL 时也会保留为 `Remote link` 来源，同时继续过滤普通系统链接和 Figma Community/帮助页等非交付入口
40. `Design updated` 行如果没有有效更新时间，会展示 `更新时间缺失` 边界标签和 hover 说明，避免用户误以为只是普通日期隐藏或样式拥挤
41. Linked issue href 只有 board/search URL 且目标 key 在 `selectedIssue` / `issueKey` query 参数或 `jql` 过滤条件里时，也会恢复 UX ticket；这种非标准恢复会显示 key 来源回执，标准 `/browse/KEY` 路径不显示额外标签；只有 `project=UX` 这类项目过滤不会生成候选
42. Linked issue href 同时包含普通 path key 和 UX query key 时，会把 path 与 query 作为候选集一起过滤，优先保留匹配设计项目的 UX key，并继续显示 `Key from selectedIssue query`、`Key from issueKey query` 或 `Key from JQL query`，避免当前开发票遮住实际设计依赖
43. Remote link 只有 `YYYY-MM-DD` 日级更新时间时，面板仍显示 `Updated YYYY-MM-DD`，但 tooltip / `aria-label` 会说明来源没有提供具体时间，不再把日期解析成假的 `00:00 UTC`
44. Figma Community / help / marketing、Zeplin marketing / profile / project settings 这类非交付 URL 会被计入 footer 的 `filtered non-handoff refs` 回执，并显示 `原因 ...` 分布；`app.zeplin.io/project/<id>/settings` 不再被当成 Zeplin 交付入口，避免项目设置页误占设计行。
45. `Updated YYYY-MM-DD` 的可见短标签不变；行内会额外显示 `状态时间`、`对象日期`、`链接时间` 等来源口径 chip，tooltip / `aria-label` 继续说明最新日期来自 `object.updatedDate`、`object.status.updatedAt` 或 remote link 自身的更新时间字段，避免 object/status/link 时间不一致时用户无法审计。
46. 非标准恢复的 UX key 行会显示 `只读恢复`，tooltip 说明 Personal AI 只展示候选，不创建/编辑 Jira issue links、设计字段或关联关系；标准 `/browse/KEY` 和 Jira Cloud issue URL 不额外打扰。
47. 当本次结果里包含一个或多个非标准恢复候选时，面板顶部会显示 `恢复范围` 总览、候选数量和实际来源分布，说明这些 key 来自页面元数据/文本，只是只读候选，不证明正式 Jira 关联。
48. 只有 Figma/Zeplin 文档、社区、营销、profile 或 settings 这类非交付设计工具 URL 时，面板会显示 `未找到交付设计入口`、过滤计数和 `只读扫描` 边界；普通没有设计引用的 ticket 仍不显示面板，避免制造噪音。
49. UX ticket 设计链接字段的 generic http(s) 兼容不再覆盖已知设计工具排除规则：Figma Community/help/blog、Zeplin support/marketing/profile/settings 等非交付页会保持过滤，不会显示成 `Design link`。
50. 更新时间来源 chip 只解释本行 `Updated` 日期的元数据口径；它不会重新读取 Figma、编辑 Jira，也不会确认该设计更新已经被人复核。
51. 当同一票同时有真实交付设计入口和被过滤的 Figma / Zeplin 非交付 URL 时，面板会在设计行上方显示 `过滤范围` 回执，说明只展示可开发交付入口、过滤数量、过滤来源、过滤原因和只读边界；footer 仍保留来源摘要。
52. 当本页存在更新时间信号或缺少更新时间的 `Design updated` 行时，面板会在设计行上方显示 `复查范围` 回执，汇总信号数量、最新有效日期、最新来源口径和缺时间数量；它只是复查提示，不刷新 Figma、不编辑 Jira，也不确认设计更新已经被人复核。
53. `恢复范围` 不再笼统列出所有可能来源；它会按本页实际恢复结果展示类似 `2 selectedIssue query, 1 JQL query, 1 data-issue-key, 1 ARIA label` 的分布，避免用户误以为纯文本等更弱来源也参与了本次恢复。
54. `过滤范围` 会显示被过滤 Figma/Zeplin 非交付 URL 的来源分布，例如 `来源 Design field 1, Description 5`，也会显示原因分布，例如 `原因 Figma Community 2, Figma documentation 1`；同一 URL 从多个通道出现时会合并 URL 但保留来源计数，filtered-only 空状态也会把来源和原因放进无障碍 summary。
55. `恢复范围` 会同时显示同一 DOM 片段中被 `DESIGN_JIRA_PROJECT` 过滤掉的非设计项目 issue-key 候选数量，并在 tooltip / ARIA 中说明过滤来源；例如 `/browse/ABC-123?selectedIssue=UX-700` 会保留 UX 候选，同时把普通开发票 path key 计入被忽略候选，而不是让用户误以为 Personal AI 采用了所有 key。
56. 点击带更新时间或缺时间状态的设计入口后，`来源打开回执` 会保留该行的待复查日期、时间来源或缺时间提示，并明确点击只是只读打开，不代表已经复查最新设计。
57. 面板首屏新增 `扫描口径` 回执，显示当前 Jira 可见 handoff 批次、来源通道、过滤项数量和只读边界，避免用户把本地扫描结果误读成 Figma/Zeplin 的实时全量清单或 Jira 写回。
58. 设计入口、UX ticket 和 UX Epic 链接的 hover / 读屏文案会在点击前说明只读打开、更新时间待复查、恢复候选关系和不刷新/不写入边界；点击后的 `来源打开回执` 只是把这次打开结果留在原 Jira 页。
59. Miro / Loom 不再按 host 全量识别；只有 Miro board/live-embed 和 Loom share/embed 这类可交付路径会进入设计行，普通产品、帮助、博客、价格页不会被误显示成 handoff。

### 未来增强计划 🔄
1. 在权限允许时展示轻量预览或缩略图，减少打开外部工具的次数。
2. 结合 Jira design JQL / Automation，把 Ready for dev / Design updated 状态用于提醒或批量处理。
3. 为缺失设计链接的 UX ticket 提供可选的批量补全入口。

## 业内对照与改进判断

- Figma for Jira 已把设计更新时间、`Ready for dev` 和 `Design updated` 放在 Jira 内作为核心状态信号；当前功能继续保留这些信号，并避免额外强提醒。Figma / Atlassian 的集成文档也把可打开的设计卡片和状态变化作为 handoff 核心，因此当前功能不会把 Figma help、community、marketing 等页面伪装成交付入口，即使这些 URL 被维护在 UX ticket 的设计链接字段里。
- Atlassian Automation 暴露的 design URL 可能是 encoded URL，当前功能把 encoded URL 与页面可读 URL 归并，优先解决重复行和状态丢失，而不是额外做自动提醒。
- Zeplin for Jira 支持把 screens、sections、projects 和 flows 等设计资源挂到 Jira；当前功能只做路径级标签细分，不尝试推断具体屏幕状态或替代 Zeplin 预览，同时把 profile、integration、settings 等非资源页排除在设计行之外。若一张票只有这些非资源页，也会把过滤结果明说出来，避免用户误以为扩展没有扫描。
- Jira issue linking 的核心对象仍是明确 issue key；当前功能在非标准 DOM 中保留 raw-text fallback，并支持 Jira 新旧 issue URL 形态，但只把匹配设计项目配置的 key 纳入设计上下文，且把 query/raw-text/ARIA/data 属性恢复标成只读候选，避免普通说明文字把面板带偏或让用户误以为 Personal AI 已经补写 Jira 关系。
- Jira board/search 页面和插件化 issue link 可能只把目标 issue 放在 `selectedIssue`、`issueKey`、`jql` 等 query 参数或 DOM 属性里；当前功能恢复这些 key 后会显式标出来源，并且在 path 与 query 同时出现时按设计项目过滤，顶部 `恢复范围` 也只汇总本页真实出现的来源，避免用户把当前开发票误读成设计依赖或误以为使用了更弱的 raw-text 恢复。
- Atlassian issue links 仍是明确 issue 之间的关系对象；当 Personal AI 只能从 Jira DOM/query/文本里恢复候选时，最稳妥的 UX 是把“保留了哪些候选、忽略了哪些不匹配项目 key”解释清楚，而不是暗示这些候选已经是 Jira 正式 issue link。
- Atlassian Automation 支持设计链接创建、更新和状态变化触发；后续如果要做提醒或批量处理，应优先基于这些状态事件，而不是在当前面板里加入需要用户决策的自动改票。
- Figma Dev Mode 把 `Changed` 视为已标记 Ready/Completed 的设计被修改后的状态；当前面板把这类状态归一为 `Design updated`，比直接显示 `Changed` 更贴近开发者下一步动作。
- Figma/Jira 与 Atlassian Automation 都把设计更新、设计状态变化视为独立事件；Jira JQL 也把 `design[lastUpdated]` 作为可搜索属性。当前面板在多个更新时间字段并存时取最新有效值，避免旧 object 时间掩盖较新的状态更新时间，并在 `复查范围`、可见 chip、tooltip 和读屏文案里保留所选字段来源；顶部回执也会显示最新日期的来源口径，避免只看到日期却不知道它来自 status、object 还是 remote-link 元数据。如果只有日期就按日级证据展示，如果没有任何可解析时间，则显式标出来源缺口。
- Figma/Jira 官方体验强调能在 Jira 里直接看到设计状态、更新时间和真实可打开的设计；Zeplin/Jira 也把 screen、section、project、component、flow 等资源挂到 Jira issue。当前改进把“过滤了哪些非交付设计工具 URL”“为什么过滤”和“过滤来自哪些扫描通道”前置成可见回执，避免用户把文档/社区/设置页当成交付入口，也避免把保守过滤误读成扩展漏扫；当用户打开带更新时间信号的设计后，原页继续保留待复查口径，避免跨工具跳转后丢掉时间来源上下文。
- Miro / Loom 的交付 URL 也按资源路径保守识别：只把 board、live-embed、share、embed 作为交付入口，避免把工具官网或帮助内容当成设计证据。
- Provenance / 时间来源相关研究指出，用户可能把来源元数据、可信度和操作状态混在一起理解；因此当前功能把 `待复查` 和 `只读打开` 放在同一个点击回执里，明确“已打开来源”不是“已确认设计更新”。
- Jira remote issue links 的 UI 分组依赖 `globalId`、`relationship`、`application` 和 `object/status` 字段；当前面板不会把这些字段全量展示给用户，但会把里面出现的可信设计 URL，包括跳转 URL 参数里的设计入口，纳入同一低噪音列表。
- 软件 artifact traceability 研究强调不同工程 artifact 之间的路径要能被角色快速理解，且错误链接会增加清理成本；近期关于 artifact traceability 与 requirements traceability auxiliary artifacts 的系统综述也强调辅助元数据会影响链接理解和验证。当前面板用按权威性排序的逐行 source tag、更新时间来源 chip、footer 来源摘要、filtered non-handoff refs 和原因分布，保持低噪音同时让用户知道结果来自 description、Jira Designs、remote links 还是 UX ticket，以及哪些设计工具 URL 被故意剔除。
- Jira issue link 可视化研究强调大项目里缺失或未知 issue links 会破坏依赖总览；因此当前功能在 linked issue 只有纯文本 key 时也保留 `Missing link` 提醒，而不是因为 DOM 不是标准链接就静默忽略。
- Traceability-link recovery 的行业实践通常把自动恢复结果当作需要可视化置信/边界的候选；因此当前改进选择加只读边界，而不是自动创建 Jira issue link 或把弱恢复行并入正式来源。
- Trace link explanation 研究也说明，自动恢复出的链接如果缺少解释，非领域专家很难判断正确性；因此当前改进把候选过滤结果放到首屏恢复回执，而不是只藏在具体行的 hover 文案里。
- Relay 设计交付研究强调开发者容易丢失设计意图；当前阶段更适合提高设计入口和状态的可追溯性，暂不把缩略图或模型化意图解释做成默认阻塞流程。

## 参考资料

- [Jira REST API v2文档](https://developer.atlassian.com/cloud/jira/platform/rest/v2/)
- [Jira Remote Issue Links REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-remote-links/)
- [Atlassian: identify Jira issue ID/key in Cloud](https://support.atlassian.com/jira/kb/how-to-identify-the-jira-issue-id-in-cloud/)
- [Atlassian: Jira smart values - issue links](https://confluence.atlassian.com/automation/jira-smart-values-issue-links-1540234922.html)
- [Atlassian Developer Community: Jira issue URL format](https://community.developer.atlassian.com/t/getting-issue-url-from-jira-cloud/62268)
- [Atlassian + Figma integration](https://www.atlassian.com/partnerships/figma)
- [Figma: Power up your designer-developer handoff with Figma and Jira](https://www.figma.com/blog/designer-developer-handoff-with-figma-and-jira/)
- [Atlassian Jira automation design triggers](https://support.atlassian.com/cloud-automation/docs/jira-automation-triggers/)
- [Atlassian Jira automation design smart values](https://support.atlassian.com/cloud-automation/docs/jira-smart-values-design/)
- [Figma Jira integration help](https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma)
- [Atlassian JQL design search](https://support.atlassian.com/jira-software-cloud/docs/jql-design-search/)
- [Figma Dev Mode statuses and notifications](https://help.figma.com/hc/en-us/articles/26781702258583-Dev-Mode-statuses-and-notifications)
- [Figma Dev Mode plugin docs](https://developers.figma.com/docs/plugins/working-in-dev-mode/)
- [Zeplin + Jira integration](https://zeplin.io/integrations/jira/)
- [Examining the Impact of Provenance-Enabled Media on Trust and Accuracy Perceptions](https://arxiv.org/abs/2303.12118)
- [Relay: A collaborative UI model for design handoff](https://research.google/pubs/relay-a-collaborative-ui-model-for-design-handoff/)
- [Facilitation of Regular Communication between UI Designers and Developers through a Continuous Pipeline Tool](https://odr.chalmers.se/items/a2377031-375a-4470-ae47-bfecf4f588ca)
- [Evaluating ReLink for Traceability Link Recovery in Practice](https://www.researchgate.net/publication/387983699_Evaluating_ReLink_for_Traceability_Link_Recovery_in_Practice)
- [A Literature Review of Automatic Traceability Links Recovery for Software Change Impact Analysis](https://yuleisui.github.io/publications/icpc20.pdf)
- [Issue Tracking Ecosystems: Context and Best Practices](https://arxiv.org/abs/2507.06704)
- [SoK: Systematizing Software Artifacts Traceability](https://arxiv.org/abs/2603.16208)
- [Auxiliary Artifacts in Requirements Traceability](https://arxiv.org/abs/2504.19658)
- [Chrome扩展开发指南](https://developer.chrome.com/docs/extensions/mv3/)
- [Figma API文档](https://www.figma.com/developers/api)
- [DOM MutationObserver文档](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
