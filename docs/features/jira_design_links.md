---
description: 
globs: 
alwaysApply: false
---
# Jira 设计链接显示功能

*最后更新: 2026-05-07*

## 功能概述

Jira 设计链接显示功能用于在 Jira ticket 页面自动汇总相关设计入口，让开发、测试、PM 不需要在 description、Jira Designs/remote links、linked issues、Epic、Parent ticket 之间来回查找。当前实现覆盖 Figma、FigJam、Miro、Loom、Google Slides 和 UX 项目 ticket 上维护的设计链接，同时展示 UX Epic 状态和 ETA 信息。

## 主要功能

1. **多渠道检测**：从 description、Jira remote links、当前 ticket linked issues、Epic、Parent ticket 中收集设计相关入口。
2. **可配置 UX 项目识别**：默认使用 `UX*` 前缀模式，也支持通过 `DESIGN_JIRA_PROJECT` 改为 `UX` 这类精确匹配。
3. **自定义设计域名识别**：通过 `DESIGN_LINK_DOMAINS` 补充内部原型、设计系统或交付站点域名。
4. **层级关联分析**：Epic 和非 Epic ticket 都会尝试向上查找相关 UX ticket。
5. **稳定展示**：在 Jira summary 下方展示带总数和状态摘要的紧凑面板，长标题会截断，标签会换行，hover 不会改变面板位置或挤压页面内容；Jira SPA 切换到无设计链接的 ticket 或非 ticket 页面时会清理旧面板。
6. **状态补充**：对 UX ticket 额外显示 UX Epic、Epic 状态和 ETA（due date 或 fixVersion），对 Jira remote link/UX ticket 设计链接显示可用的设计状态；`ready_for_development`、`not_ready_for_dev` 这类机器状态会显示成人可读标签并映射到正确状态色。
7. **可行动优先级**：优先展示 `Ready for dev`、`Design updated`、`Missing link`、`Not ready` 等有行动意义的设计入口，并用状态色减少扫描成本；`Not ready for dev` 和 `Ready for review` 不会被误判成可开发。
8. **缺失链接提示**：当关联 UX ticket 没有可用设计链接时，会展示 `Missing link` 状态并把该项排在普通链接之前，避免开发者误以为没有设计依赖。
9. **安全和去重**：只接受 http/https 设计链接，过滤重复设计链接/UX 链接，并保留合并后的来源标签。

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
- `[header] Design context [6 links] [1 ready · 2 missing · 1 not ready]`
- `[icon] Design Ready checkout prototype ↗ [Ready for development] [Remote link]`
- `[icon] Design Draft onboarding walkthrough ↗ [Not ready for dev] [Remote link]`
- `[icon] Design UX-12345 页面设计稿 ↗ UX-12345 UXE-88 In Progress ETA: 2026-05-10 [Epic link]`
- `[icon] Design link missing Missing UX spec (UX-12345) [Missing link] UXE-88 In Progress [Parent child]`

## 检测逻辑

### 1. Description 扫描
- 扫描ticket描述中的所有链接
- 识别 Figma/FigJam、Miro、Loom、Google Slides 等设计或交付相关链接
- 支持 `DESIGN_LINK_DOMAINS` 中配置的内部设计/原型域名
- 支持链接元素和文本中的URL提取
- 链接元素会优先使用有意义的锚文本作为展示标题，例如 “Checkout mobile handoff”；`the design`、`click here` 这类弱标题会回退为工具名称
- 自动去掉文本 URL 末尾常见标点，避免把 `),` 等字符带入链接

### 2. Jira Remote Links 扫描
- 调用 Jira remote issue links API 读取当前 ticket 和 UX ticket 上的结构化外链
- 识别 Jira Designs/Figma 集成、Web Links 或其他工具同步进来的设计链接
- 如果 remote link 提供状态标题，会作为短标签展示
- 远程状态会兼容 `icon.title`、`status/name/value` 和 `ready_for_development` 这类机器值，避免 Jira Designs 状态落到 Neutral

### 3. Linked Issues 分析
- 从DOM中直接提取Issue Links部分
- 筛选UX开头的相关tickets
- 获取对应的summary信息

### 4. Epic 层级分析
- **当前票为Epic时**：
  - 直接从Epic中查找UX related issues
  - 检查Epic的Parent Link下的UX tickets
- **当前票非Epic时**：
  - 查找上级Epic的UX linked issues
  - 通过Epic的Parent Link查找相关UX tickets

### 5. API 数据获取
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
- 面板不再依赖 hover 展开，也不会通过动画位移挤压页面。
- 面板顶部展示 `Design context`、链接总数和非中性状态摘要，帮助多链接 ticket 快速扫读。
- 每个链接项包含 Personal AI 图标、设计入口、UX ticket、设计状态、UX Epic 状态、ETA 和来源标签；缺失设计链接时展示 UX ticket summary，方便判断是否需要补链。
- Jira/Figma 的设计状态会按 tone 展示：Ready for dev、Design updated、Missing link、Not ready、Blocked、Review、Done、Neutral；Ready/Updated/Missing/Not ready 等更需要处理的入口会排在普通 description 链接前面。
- 重复链接合并时会优先保留 Jira remote link / Designs 提供的结构化标题和状态，UX ticket 行也会优先展示具体设计名，避免 description 或工具默认名覆盖真正可行动的设计状态。

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
- 扩展配置读取会对 background 响应做超时降级，避免 service worker 未响应时阻塞 Jira 面板渲染
- 异步扫描会在 Jira SPA 页面切换后中止后续 DOM 读取；离开 ticket 页面会立即清理设计链接和 Backend Progress 面板，避免旧信息残留

## 浏览器兼容性

### 支持的浏览器
- Chrome 88+
- Edge 88+
- Firefox 78+
- Safari 14+

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

这些域名只用于 description 和 Jira remote links 的补充识别。UX ticket 设计链接字段仍允许任意 http/https 链接，以兼容团队内部维护的交付入口。

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
17. 默认 UX 项目识别使用 `UX*`，空配置也会覆盖 `UXDES-123` 这类 UX 前缀项目
18. 面板 hover 后保持原位，缺失链接行直接显示 UX ticket summary，减少扫描和误点成本
19. 设计状态解析避免把 `Not ready for dev`、`Draft`、`Ready for review` 误标成绿色 Ready，降低错误开工风险

### 未来增强计划 🔄
1. 在权限允许时展示轻量预览或缩略图，减少打开外部工具的次数。
2. 结合 Jira design JQL / Automation，把 Ready for dev / Design updated 状态用于提醒或批量处理。
3. 为缺失设计链接的 UX ticket 提供可选的批量补全入口。

## 参考资料

- [Jira REST API v2文档](https://developer.atlassian.com/cloud/jira/platform/rest/v2/)
- [Jira Remote Issue Links REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-remote-links/)
- [Atlassian + Figma integration](https://www.atlassian.com/partnerships/figma)
- [Figma Jira integration help](https://help.figma.com/hc/en-us/articles/360039827834-Jira-and-Figma)
- [Figma Dev Mode plugin docs](https://developers.figma.com/docs/plugins/working-in-dev-mode/)
- [Issue Tracking Ecosystems: Context and Best Practices](https://arxiv.org/abs/2507.06704)
- [SoK: Systematizing Software Artifacts Traceability](https://arxiv.org/abs/2603.16208)
- [Chrome扩展开发指南](https://developer.chrome.com/docs/extensions/mv3/)
- [Figma API文档](https://www.figma.com/developers/api)
- [DOM MutationObserver文档](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)
