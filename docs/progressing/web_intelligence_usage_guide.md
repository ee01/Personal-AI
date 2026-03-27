# 🧠 智能网页分析使用指南

> 说明：本文是早期 Web Intelligence 使用草稿，和当前实际生效的“网页记忆探测与右下角提示”实现并不完全一致。当前代码请优先参考 `docs/features/webpage_memory_detection.md`。

*最后更新: 2024-12-20*

## 📋 概述

智能网页分析系统通过Content Script在用户浏览网页时自动运行，能够智能识别项目相关内容并进行分析存储。

## 🚀 如何使用

### 1. 自动分析模式

智能网页分析系统默认在**所有网页**中自动运行：

```javascript
// Content Script 自动加载
// 文件：src/contentScriptWebIntelligence.ts
// 配置：manifest.json 中的 content_scripts
```

#### 运行条件
- ✅ 所有HTTP/HTTPS网页（`<all_urls>`）
- ✅ 在 `document_idle` 时机运行
- ❌ 跳过扩展页面（chrome-extension://）
- ❌ 跳过Chrome内部页面（chrome://）
- ❌ 跳过预设的敏感域名

#### 触发时机
1. **页面加载完成后** - 延迟2秒自动分析
2. **内容动态变化时** - 检测到重要DOM变化
3. **用户手动触发** - 通过扩展消息

### 2. 手动分析模式

#### 通过演示页面触发
1. 点击扩展图标
2. 点击红色"🧠 智能分析"按钮
3. 在演示页面点击"手动分析测试"

#### 通过程序触发
```javascript
// 发送消息到当前页面的Content Script
chrome.tabs.sendMessage(tabId, {
    type: 'TRIGGER_MANUAL_ANALYSIS'
});
```

### 3. 配置和控制

#### 域名控制
```javascript
// 在 contentScriptWebIntelligence.ts 中配置
private readonly BLOCKED_DOMAINS = [
    'google.com', 'facebook.com', 'twitter.com', 
    'youtube.com', 'amazon.com', 'netflix.com'
];
```

#### 分析频率控制
```javascript
private readonly MIN_ANALYSIS_INTERVAL = 5000; // 5秒最小间隔
```

## 🔍 分析流程

### 第一层：页面内容提取
```
1. 检查域名白名单/黑名单
2. 提取页面标题、URL、主要内容
3. 计算内容字数（中英文混合）
4. 过滤无效内容（<50词跳过）
```

### 第二层：快速本地分析
```
1. URL模式匹配（GitHub、Jira、Confluence等）
2. 关键词分析（项目、开发、设计相关词汇）
3. 实体提取（项目名、人员、技术栈、行动项）
4. 相关性评分（0-1分）
```

### 第三层：后台深度处理
```
1. 相关性 > 0.3 且置信度 > 0.5 时触发
2. 发送到 background.ts 进行 agentThinking 处理
3. 存储到 ChromaDB 和图数据库
4. 触发主动通知系统
```

## 📊 支持的平台

### 高优先级平台（自动高分）
- **GitHub** (`github.com`) - 0.4分 + 开发类别
- **Jira** (`jira.*/browse`) - 0.5分 + 项目管理类别
- **Confluence** (`confluence`) - 0.4分 + 文档类别
- **Notion** (`notion.so`) - 0.4分 + 文档类别
- **Linear** (`linear.app`) - 0.4分 + 项目管理类别

### 中等优先级平台
- **Slack** (`slack.com`) - 0.3分 + 沟通类别
- **Figma** (`figma.com`) - 0.3分 + 设计类别
- **Google Docs** (`docs.google.com`) - 0.3分 + 文档类别
- **Trello** (`trello.com`) - 0.3分 + 项目管理类别

### 通用网页
- 基于关键词匹配进行评分
- 支持中英文混合内容
- 自动识别页面类型

## 🎯 识别的信息类型

### 项目信息
```javascript
// 识别模式
/项目[：:]?\s*([^\s,，。]{2,20})/g
/Project[:\s]+([A-Za-z0-9\s-]{2,30})/gi
/\[([A-Z]+-\d+)\]/g  // Jira票据格式
```

### 人员信息
```javascript
// 识别模式
/@([a-zA-Z0-9\u4e00-\u9fa5]{2,20})/g  // @提及
/负责人[：:]?\s*([^\s,，。]{2,10})/g
/Assignee[:\s]*([^\s,，。]{2,20})/gi
```

### 技术栈
```javascript
// 预定义技术关键词
const techKeywords = [
    'react', 'vue', 'angular', 'javascript', 'typescript',
    'node.js', 'python', 'java', 'spring', 'docker',
    'kubernetes', 'aws', 'mongodb', 'mysql', 'redis'
];
```

### 行动项
```javascript
// 识别模式
/TODO[:\s]*([^。！!.\n]{5,50})/gi
/需要\s*([^。！!.]{5,50})/g
/- \[ \]\s*([^。！!.\n]{5,50})/g  // Markdown复选框
```

## 🔔 用户通知

### 触发条件
- 置信度 > 0.8 时显示页面通知
- 自动6秒后消失
- 点击可手动关闭

### 通知样式
```css
/* 渐变背景，右上角显示 */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
position: fixed;
top: 20px;
right: 20px;
z-index: 2147483647;
```

## 📈 监控和调试

### 控制台日志
```javascript
// 查看分析日志
console.log('🔍 开始智能分析 #X: URL');
console.log('✅ 分析完成: { 相关性: X%, 是否相关: X, 分类: X }');
```

### 通过演示页面监控
1. 打开"🧠 智能分析"演示页面
2. 查看系统状态和统计数据
3. 执行手动测试和健康检查

### 通过扩展消息获取状态
```javascript
chrome.tabs.sendMessage(tabId, {
    type: 'GET_ANALYSIS_STATS'
});
// 返回：{ analysisCount, lastAnalysisTime, isAnalyzing, currentDomain }
```

## ⚙️ 配置选项

### 修改阻止域名列表
编辑 `contentScriptWebIntelligence.ts`：
```javascript
private readonly BLOCKED_DOMAINS = [
    // 添加或删除域名
    'example.com'
];
```

### 修改分析频率
```javascript
private readonly MIN_ANALYSIS_INTERVAL = 5000; // 毫秒
```

### 修改内容长度阈值
```javascript
if (pageContent.wordCount < 50) {  // 修改最小词数
    console.log('📄 页面内容不足，跳过分析');
    return null;
}
```

## 🔧 故障排除

### 1. Content Script 未运行
**检查项：**
- ✅ manifest.json 中是否正确配置 content_scripts
- ✅ 文件名是否匹配（contentScriptWebIntelligence.js）
- ✅ 是否在被阻止的域名中

**解决方案：**
```bash
# 检查扩展加载状态
chrome://extensions/
# 查看控制台是否有错误信息
# 重新加载扩展
```

### 2. 分析未触发
**检查项：**
- ✅ 页面内容是否足够（>50词）
- ✅ 是否在分析间隔限制内（5秒）
- ✅ 控制台是否有"🧠 智能网页分析已启动"日志

**解决方案：**
```javascript
// 手动触发分析
chrome.tabs.sendMessage(tabId, {
    type: 'TRIGGER_MANUAL_ANALYSIS'
});
```

### 3. 通知未显示
**检查项：**
- ✅ 置信度是否 > 0.8
- ✅ 页面是否已存在通知
- ✅ CSS样式是否被覆盖

### 4. 后台处理失败
**检查项：**
- ✅ background.js 是否正确处理 WEB_INTELLIGENCE_ANALYSIS 消息
- ✅ agentThinking 是否正常工作
- ✅ 存储系统是否可用

## 📚 扩展开发

### 添加新的识别模式
```javascript
// 在 extractSimpleEntities 方法中添加
const newPattern = /新的模式[：:]?\s*([^\s,，。]{2,20})/g;
const newEntities = this.extractWithPattern(content, [newPattern]);
if (newEntities.length > 0) entities.newType = newEntities;
```

### 添加新的平台支持
```javascript
// 在 analyzeUrl 方法中添加
{ 
    pattern: /newplatform\.com/i, 
    score: 0.4, 
    reason: '新平台', 
    category: 'new_category' 
}
```

### 自定义分析逻辑
```javascript
// 继承或修改 quickAnalyze 方法
private quickAnalyze(pageContent: SimplePageContent): SimpleAnalysisResult {
    // 自定义分析逻辑
    // 返回标准格式结果
}
```

## 🎯 最佳实践

1. **性能优化**
   - 避免频繁分析同一页面
   - 使用缓存机制
   - 限制提取的实体数量

2. **隐私保护**
   - 配置域名黑名单
   - 不分析敏感页面
   - 本地处理优先

3. **用户体验**
   - 适度的通知频率
   - 非阻塞式运行
   - 清晰的状态反馈

4. **扩展性**
   - 模块化设计
   - 配置化参数
   - 标准化接口

## 🔗 相关文档

- [项目总体架构](../项目进度分析扩展总体架构.md)
- [智能代理工作流](./agent_thinking.md)
- [智能网页分析技术详解](./web_intelligence_detailed_explanation.md)
- [系统集成总结](./system_integration_summary.md)
