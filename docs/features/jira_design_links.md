---
description: 
globs: 
alwaysApply: false
---
# Jira设计链接显示功能

*最后更新: 2024-12-20*

## 功能概述

Jira设计链接显示功能是一个专门用于在Jira ticket页面上自动检测并显示相关设计链接的工具。它能够智能识别多种来源的设计资源，包括Figma链接、UX ticket的设计链接等，并以统一的方式展示给用户。

## 主要功能

1. **多渠道设计链接检测**：从description、linked issues、Epic关联等多个来源获取设计链接
2. **智能UX ticket识别**：自动识别并提取UX开头的相关tickets
3. **层级关联分析**：支持Epic、Parent ticket等多层级的关联分析
4. **统一展示界面**：以一致的格式展示多个设计链接
5. **来源标识**：清晰标识每个设计链接的来源渠道

## 使用方法

### 自动检测

功能会在Jira ticket页面自动运行，无需用户手动操作。当检测到设计链接时，会在ticket summary下方显示设计链接区域。

### 展示格式

设计链接以以下格式展示：
```
[Personal AI icon] Design Link: [链接标题](设计链接) [来源标签]
```

例如：
- `[icon] Design Link: Figma Design ↗️ [description]`
- `[icon] Design Link: UX-12345 页面设计稿 ↗️ [linked_issues]`

## 检测逻辑

### 1. Description 扫描
- 扫描ticket描述中的所有链接
- 识别figma.com相关的设计链接
- 支持链接元素和文本中的URL提取

### 2. Linked Issues 分析
- 从DOM中直接提取Issue Links部分
- 筛选UX开头的相关tickets
- 获取对应的summary信息

### 3. Epic 层级分析
- **当前票为Epic时**：
  - 直接从Epic中查找UX related issues
  - 检查Epic的Parent Link下的UX tickets
- **当前票非Epic时**：
  - 查找上级Epic的UX linked issues
  - 通过Epic的Parent Link查找相关UX tickets

### 4. API 数据获取
- 调用Jira REST API获取ticket详细信息
- 提取UX tickets的customfield_21233字段（设计链接）
- 使用JQL查询获取child issues

## 技术架构

### 核心模块

```typescript
// DOM 操作相关
function getFigmaLinksFromDescription(): FigmaLink[]
function getUXTicketsFromLinkedIssues(): UXTicket[]
function getParentEpicFromDOM(): EpicInfo | null

// API 操作相关  
function fetchTicketData(ticketKey: string): Promise<any>
function findUXTickets(parentData: any, currentTicketKey: string): Promise<UXTicket[]>
function getDesignLink(uxTicketKey: string): Promise<string | null>

// 展示相关
function displayDesignLinks(designData: DesignData[]): void
```

### 数据结构

```typescript
interface DesignData {
  type: 'figma' | 'ux_ticket';
  url: string;
  summary?: string;
  uxTicketKey?: string;
  source: string;
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
| `description` | 从ticket描述中提取的Figma链接 |
| `linked_issues` | 从当前页面Issue Links中提取的UX tickets |
| `epic_subtask` | 从Epic的subtask中提取的UX tickets |
| `epic_issue_link` | 从Epic的issue links中提取的UX tickets |
| `epic_child_issue` | 从Epic的child issues中提取的UX tickets |
| `parent_subtask` | 从Parent ticket的subtask中提取的UX tickets |
| `parent_issue_link` | 从Parent ticket的issue links中提取的UX tickets |
| `parent_child_issue` | 从Parent ticket的child issues中提取的UX tickets |

## 样式设计

### 基本样式
- 淡蓝色背景 (#f0f5ff)
- 圆角边框和阴影效果
- 鼠标悬停时展开显示完整信息

### 动态效果
- 容器高度根据链接数量动态调整
- 悬停时显示footer信息
- 平滑的过渡动画效果

### 响应式设计
- 支持多个设计链接的垂直排列
- 每个链接项包含图标、标题、外链图标和来源标签
- 底部显示扩展信息和作者信息

## 性能优化

### API 调用优化
- 去重处理避免重复的设计链接
- 批量处理相关的API请求
- 异步获取设计链接内容

### DOM 操作优化
- 检查并移除已存在的设计链接容器
- 使用documentFragment减少DOM操作
- 仅在检测到设计链接时才创建展示元素

### 错误处理
- API调用失败的降级处理
- DOM元素不存在时的兜底逻辑
- 网络超时的重试机制

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

### 未来增强计划 🔄
1. 缓存机制优化API调用性能
2. 支持更多设计工具链接识别
3. 批量操作多个ticket的设计链接
4. 设计链接变更通知功能
5. 与其他设计工具的深度集成

## 参考资料

- [Jira REST API v2文档](https://developer.atlassian.com/cloud/jira/platform/rest/v2/)
- [Chrome扩展开发指南](https://developer.chrome.com/docs/extensions/mv3/)
- [Figma API文档](https://www.figma.com/developers/api)
- [DOM MutationObserver文档](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) 