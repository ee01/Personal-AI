# Agent Workflow 智能工作流系统

*最后更新: 2024-12-20*

## 功能概述

Agent Workflow 智能工作流系统是一个基于协调器模式设计的智能消息分析框架，通过多个专业化的 Agent 协同工作，提供全方位的消息分析和处理能力。该系统采用轻量级架构，专注于效率和准确性。

### 核心能力

- **多 Agent 协同**：通过多个专业化 Agent 按优先级协同工作
- **智能关注项匹配**：使用 LLM 智能匹配用户关注的话题
- **自动通知推送**：支持机器人消息推送和 @我 功能
- **实体关系分析**：提取实体信息并分析相互关系
- **外部服务集成**：支持 Jira、Wiki 等外部服务查询
- **回复建议生成**：基于上下文智能生成回复建议

## 系统架构

Agent Workflow 系统由以下主要组件构成：

```
Agent Workflow 系统
├── 核心组件
│   ├── AgentCoordinator - 主要协调器
│   ├── 工具注册表 - 可用工具的注册中心
│   └── 处理流程管理器 - 管理 Agent 执行流程
│
├── 接口定义
│   ├── MessageProcessResult - 消息处理结果
│   ├── AgentConfig - Agent 配置信息
│   ├── AgentTool - 工具接口定义
│   └── messageContext - 消息上下文信息
│
├── Agent 集合
│   ├── 实体识别 Agent (priority: 100)
│   ├── 通知判断 Agent (priority: 95) 
│   ├── 关系分析 Agent (priority: 90)
│   ├── 重要性判断 Agent (priority: 80)
│   ├── 外部信息获取 Agent (priority: 70)
│   └── 回复建议 Agent (priority: 60)
│
└── 工具集
    ├── concernedItemMatcher - 关注项匹配工具
    ├── entityExtraction - 实体提取工具
    ├── relationshipAnalysis - 关系分析工具
    ├── relevanceJudgment - 重要性判断工具
    ├── externalServiceQuery - 外部服务查询工具
    └── replyAdviser - 回复建议工具
```

## Agent 详细说明

### 1. 实体识别 Agent
- **优先级**: 100 (最高)
- **工具**: entityExtraction
- **功能**: 从消息中提取人物、时间、地点、项目等实体信息
- **输出**: 结构化的实体数据

### 2. 通知判断 Agent
- **优先级**: 95
- **工具**: concernedItemMatcher
- **功能**: 检查消息是否匹配用户关注项，决定是否发送通知
- **输出**: shouldNotify、matchedRule、summary、confidence

### 3. 关系分析 Agent
- **优先级**: 90
- **工具**: relationshipAnalysis、historySearch
- **功能**: 分析实体之间的关系，查询相关历史消息
- **输出**: 实体关系数据

### 4. 重要性判断 Agent
- **优先级**: 80
- **工具**: relevanceJudgment、historySearch
- **功能**: 评估消息重要性，决定是否存储
- **输出**: isRelevant、shouldStore、priority、tags

### 5. 外部信息获取 Agent
- **优先级**: 70
- **工具**: externalServiceQuery
- **功能**: 从 Jira、Wiki 等外部服务获取相关信息
- **输出**: 外部服务数据

### 6. 回复建议 Agent
- **优先级**: 60
- **工具**: replyAdviser
- **功能**: 基于消息内容和上下文生成回复建议
- **输出**: 回复建议文本

## 核心工具详解

### concernedItemMatcher - 关注项匹配工具

这是新增的核心工具，专门负责智能匹配用户关注的话题：

```typescript
interface MatchResult {
  shouldNotify: boolean;     // 是否需要发送通知
  matchedRule: string;       // 匹配的规则原文
  summary: string;           // 消息摘要和上下文分析
  confidence: number;        // 置信度 (0-1)
  reason: string;            // 匹配原因
}
```

**工作流程**：
1. 获取用户配置的关注项列表
2. 构建 LLM 分析提示，包含消息内容和所有关注规则
3. 使用 LLM 智能分析消息是否匹配任何关注项
4. 返回匹配结果、置信度和摘要

### 其他核心工具

- **entityExtraction**: 实体提取，识别人物、项目、时间等
- **relationshipAnalysis**: 关系分析，理解实体间的关联
- **relevanceJudgment**: 重要性判断，评估消息价值
- **replyAdviser**: 回复建议，生成智能回复内容

## 消息处理结果接口

```typescript
interface MessageProcessResult {
  // 基础判断
  isRelevant: boolean;                 // 消息是否相关
  shouldStore: boolean;                // 是否需要存储
  shouldNotify: boolean;               // 是否需要发送通知
  confidence: number;                  // 整体置信度
  summary: string;                     // 消息摘要
  
  // 匹配信息
  matchedRule?: string;                // 匹配的关注项规则
  
  // 消息上下文
  messageContext?: {
    groupId?: string;                  // 群组ID
    groupName?: string;                // 群组名称
    messageContent?: string;           // 消息内容
    sender?: string;                   // 发送者
    datetime?: string;                 // 发送时间
  };
  
  // 扩展数据
  enrichedData?: any;                  // 提取的实体和关系数据
  actions?: any[];                     // 建议的行动项
  replyAdvice?: string;                // 回复建议
}
```

## 与其他模式的比较

| 功能特性 | agentWorkflow | agentThinking | 普通模式 |
|---------|---------------|---------------|----------|
| **架构设计** | 协调器 + 多Agent | 单Agent + 工具集 | 直接LLM调用 |
| **处理效率** | 高 | 中 | 低 |
| **分析深度** | 中 | 高 | 低 |
| **资源消耗** | 中 | 高 | 低 |
| **扩展性** | 优秀 | 良好 | 一般 |
| **关注项匹配** | ✅ 智能匹配 | ✅ 智能匹配 | ✅ 规则匹配 |
| **机器人通知** | ✅ 完整支持 | ✅ 完整支持 | ✅ 基础支持 |
| **@我功能** | ✅ | ✅ | ✅ |
| **实体提取** | ✅ | ✅ | ✅ |
| **关系分析** | ✅ | ✅ | ❌ |
| **外部集成** | ✅ | ❌ | ❌ |

## 配置和使用

### 环境配置

在配置文件中设置分析类型：

```javascript
ANALYSIS_TYPE: 'agentWorkflow'
```

### Agent 自定义

系统支持添加自定义 Agent：

```typescript
const customAgent: AgentConfig = {
  id: 'customAgent',
  name: '自定义Agent',
  description: '执行特定任务的Agent',
  enabled: true,
  priority: 85,
  tools: ['customTool']
};

await agentCoordinator.addAgent(customAgent);
```

### 工具开发

开发自定义工具：

```typescript
const customTool: AgentTool = {
  name: '自定义工具',
  description: '执行特定功能的工具',
  execute: async (params) => {
    // 工具逻辑实现
    return result;
  }
};
```

## 处理流程

### 消息分析流程

1. **接收消息**: 系统接收来自群组的消息数据
2. **Agent协调**: AgentCoordinator 按优先级调度各个 Agent
3. **工具执行**: 每个 Agent 执行其配置的工具集
4. **结果合并**: 将所有 Agent 的结果合并为最终结果
5. **动作执行**: 根据结果执行存储、通知等动作

### 通知决策流程

1. **关注项匹配**: concernedItemMatcher 分析消息是否匹配关注项
2. **置信度评估**: 基于匹配结果计算置信度
3. **通知决策**: 根据 shouldNotify 标志决定是否发送通知
4. **@我判断**: 检查关注项的 mentionMe 配置
5. **消息推送**: 发送机器人消息（可选 @用户）

## 性能优化

### 批量处理

系统支持高效的批量消息处理：

```typescript
// 逐个群组处理
for (const item of data) {
  for (const post of item.posts) {
    const result = await processNewMessage(messageData);
    // 处理结果
  }
}
```

### 缓存策略

- **实体缓存**: 缓存已提取的实体信息
- **关系缓存**: 缓存已分析的实体关系
- **历史搜索缓存**: 缓存历史消息查询结果

### 错误处理

- **Agent级错误隔离**: 单个Agent失败不影响其他Agent
- **工具级容错**: 工具执行失败不中断整个流程
- **优雅降级**: 关键工具失败时提供基础功能

## 最佳实践

### Agent 优先级设计

1. **实体识别**: 优先级最高，为其他Agent提供基础数据
2. **通知判断**: 高优先级，快速决定是否需要通知
3. **分析类Agent**: 中等优先级，提供深度分析
4. **辅助工具**: 较低优先级，提供补充信息

### 工具开发建议

1. **单一职责**: 每个工具专注于一个特定功能
2. **错误处理**: 实现完善的错误处理机制
3. **性能优化**: 避免重复计算和不必要的API调用
4. **结果缓存**: 合理使用缓存提高效率

### 配置建议

1. **按需启用**: 根据实际需求启用相应的Agent
2. **优先级调整**: 根据业务重要性调整Agent优先级
3. **监控评估**: 定期评估各Agent的性能和效果

## 故障排除

### 常见问题

1. **消息未被匹配**: 检查关注项配置和匹配逻辑
2. **通知未发送**: 确认 ENABLE_BOT 配置和网络连接
3. **性能问题**: 检查Agent配置和工具实现
4. **结果不准确**: 调整LLM提示词和分析逻辑

### 调试方法

1. **日志分析**: 查看详细的处理日志
2. **结果检查**: 验证每个Agent的输出结果
3. **配置验证**: 确认系统配置正确
4. **工具测试**: 单独测试各个工具的功能

---

更多详细信息请参考源码和相关技术文档。