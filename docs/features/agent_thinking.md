---
description: 
globs: 
alwaysApply: false
---
# 智能Agent系统 - 综合文档

*最后更新: 2024-12-20*

## 功能概述

智能Agent系统（agentThinking）是一个基于新接口设计的通用分析框架，提供了统一的智能分析能力。该组件是原有IntelligentAgent的升级版本，采用更灵活、可扩展的架构设计，支持多种内容类型的分析处理。

### 核心能力

- **多类型内容分析**：支持消息、项目、会议、文档、网页等多种内容的智能分析
- **思考-行动循环**：实现基于LLM的思考-行动循环，提高分析深度
- **批量处理能力**：支持高效的批量分析处理
- **兼容性保障**：提供与旧版IntelligentAgent的兼容层
- **灵活配置**：支持通过配置调整分析深度和行为
- **多工具协同处理**：动态决定工具调用顺序和使用策略
- **强类型分析结果**：不同分析类型返回特定结构的结果对象

## 系统架构

agentThinking采用模块化架构设计，将各类分析能力统一在一个框架下，同时保持扩展性。

## 系统架构

智能Agent系统由以下主要组件构成：

```
智能Agent系统
├── 核心组件
│   ├── IntelligentAgent类 - 主要智能体
│   ├── 工具注册表 - 可用工具的注册中心
│   └── 处理流程管理器 - 处理思考-行动循环
│
├── 接口定义
│   ├── 基础分析结果 (BaseAnalysisResult) - 所有分析结果的基类
│   ├── 类型特定结果 (MessageAnalysisResult, ProjectAnalysisResult等)
│   ├── 分析配置 (AnalysisConfig) - 控制分析行为 
│   └── 分析上下文 (AnalysisContext) - 提供环境信息
│
├── 工具集
│   ├── 实体提取 - 提取消息中的人物、项目等实体
│   ├── 历史消息搜索 - 查询相关历史消息
│   ├── 消息存储 - 将消息存储到向量数据库
│   ├── 消息通知 - 通过bot发送通知
│   ├── JIRA查询 - 获取JIRA任务信息
│   ├── 组织架构查询 - 获取人员的组织关系
│   ├── 发布任务查询 - 查询本月发布任务
│   └── Sprint数据查询 - 查询Sprint进度和bug数据
│
└── 可视化组件
    ├── AgentVisualizer - 显示详细的思考过程
    ├── AgentFlowVisualizer - 流程图可视化
    └── AgentResultSummary - 处理结果摘要
```

## 消息处理流程

消息处理流程展示了智能Agent如何处理收到的信息：

```
          ┌─────────────┐
          │  新消息接收  │
          └──────┬──────┘
                 │
          ┌──────▼──────┐
          │ 初始消息分析 │
          └──────┬──────┘
                 │
┌───────────────┐│┌───────────────┐
│               ▼▼▼               │
│        ┌──────────────┐         │
│        │  思考下一步  │◄────────┐│
│        └──────┬───────┘         ││
│               │                 ││
│        ┌──────▼───────┐         ││
│        │  需要更多信息? │         ││
│        └──────┬───────┘         ││
│               │                 ││
│        ┌──────▼───────┐         ││
│   ┌───►│  选择合适工具  │         ││
│   │    └──────┬───────┘         ││
│   │           │                 ││
│   │    ┌──────▼───────┐         ││
│   │    │   执行工具    │         ││
│   │    └──────┬───────┘         ││
│   │           │                 ││
│   │    ┌──────▼───────┐         ││
│   │    │  收集工具结果  │         ││
│   │    └──────┬───────┘         ││
│   │           │                 ││
│   │    ┌──────▼───────┐         ││
│   │    │ 是否需要更多工具?│────是──┘│
│   │    └──────┬───────┘          │
│   │           │否                │
│   │    ┌──────▼───────┐          │
│   │    │   信息足够?  │────否─────┘
│   │    └──────┬───────┘
│   │           │是
│   │    ┌──────▼───────┐
│   │    │ 做出最终决策  │
│   │    └──────┬───────┘
│   │           │
│   │    ┌──────▼───────┐     ┌──────────────┐
│   │    │ 是否需要存储? │──是──►│ 存储到向量数据库 │
│   │    └──────┬───────┘     └──────────────┘
│   │           │否
│   │    ┌──────▼───────┐     ┌──────────────┐
│   │    │ 是否需要通知? │──是──►│  发送bot通知   │
│   │    └──────┬───────┘     └──────────────┘
│   │           │否
│   │    ┌──────▼───────┐
│   └────┤ 处理下一条消息 │
         └──────────────┘
```

## 思考-行动循环

智能Agent系统基于"思考-行动"循环，而不是预定义的线性流程。每次循环包括：

1. **思考阶段**：Agent评估当前状态，思考下一步行动
2. **决策阶段**：决定是执行某个工具还是结束处理
3. **执行阶段**：如果选择执行工具，则调用相应工具并收集结果
4. **更新阶段**：更新内存状态，记录执行结果

整个过程由LLM驱动，每次决策都通过提示工程引导LLM做出合理的判断。

## 工具调用策略

工具调用不是预先定义的固定顺序，而是基于消息内容动态决定的。例如：

- 如果消息提到项目，Agent可能会选择查询JIRA
- 如果消息提到多个人物，Agent可能会选择查询组织架构
- 如果消息提到截止日期，Agent可能会查询发布计划

这种灵活性使Agent能够根据具体情况"思考"出最合适的行动路径，而不是按照固定流程执行。

## 接口定义

### 核心接口

```typescript
// 主要分析方法
async analyze(input: any, config: AnalysisConfig, context?: AnalysisContext): Promise<AnalysisResult>

// 批量分析方法
async analyzeBatch(
  items: any[],
  config: AnalysisConfig,
  context?: AnalysisContext,
  onProgress?: (result: AnalysisResult) => void
): Promise<AnalysisResult[]>
```

### 基础分析结果

```typescript
interface BaseAnalysisResult {
  type: string;                 // 结果类型
  confidence: number;           // 可信度
  summary: string;              // 分析总结
  thoughtProcess?: ThoughtStep[]; // 思考过程
  metaData: {
    llmCallCount: number;       // LLM调用次数
    llmCallTokens: number;      // Token使用量
    usedTools: string[];        // 使用的工具
    timestamp: number;          // 时间戳
  };
}
```

## 使用示例

### 消息分析

```typescript
import { IntelligentAgent } from './agentThinking';

const agent = new IntelligentAgent();

const result = await agent.analyze(
  {
    message_content: "团队会议将推迟到下周二，请大家准备项目进度报告。",
    sender: "项目经理",
    team_name: "产品开发组",
    datetime: "2023-12-10T10:00:00Z"
  },
  {
    type: 'message',
    analysisDepth: 'normal',
    maxActions: 3
  }
);

console.log(result.summary);
console.log(result.isImportant);
console.log(result.entities);
```

### 项目分析

```typescript
const projectResult = await agent.analyze(
  {
    project: {
      id: "PRJ-2023-001",
      name: "新版产品开发",
      status: "In Progress",
      owner: "张三",
      dueDate: "2024-03-01"
    }
  },
  {
    type: 'project',
    analysisDepth: 'deep',
    preferredTools: ['jiraQuery', 'historySearch']
  }
);

console.log(projectResult.summary);
console.log(projectResult.riskLevel);
console.log(projectResult.suggestions);
```

### 网页内容分析

```typescript
const webpageResult = await agent.analyze(
  {
    title: "项目进度更新 - 前端重构完成情况",
    url: "https://company.com/project-updates/frontend-refactor",
    mainContent: `
      前端重构项目目前已完成60%，主要完成了以下模块：
      - 用户登录系统重构 ✅
      - 数据可视化组件优化 ✅
      - 响应式设计改进 🔄 (进行中)
      
      预计12月底前完成所有重构工作。
      负责人：张三、李四
      下一步：优化性能，准备上线测试
    `,
    chromeAIResult: {
      relevance: 0.85,
      shouldStore: true,
      entities: {
        projects: ["前端重构项目"],
        people: ["张三", "李四"],
        deadlines: ["2024-12-31"]
      },
      reasoning: "包含明确的项目进度信息和截止日期"
    }
  },
  {
    type: 'webpage',
    analysisDepth: 'deep',
    maxActions: 3,
    preferredTools: ['entityExtraction', 'historySearch', 'storeMessage']
  }
);

console.log(webpageResult.summary);
console.log(webpageResult.contentRelevance);
console.log(webpageResult.extractedEntities);
console.log(webpageResult.shouldStore);
console.log(webpageResult.actionSuggestions);
```

## 系统优势

### 技术优势
1. **强类型支持**：明确的接口定义，提高代码安全性
2. **可配置性**：通过配置控制行为，无需修改核心代码
3. **可扩展性**：易于添加新的分析类型和工具

### 业务优势
1. **自主决策**：根据上下文自主选择工具
2. **灵活调用**：动态决定工具调用顺序
3. **可解释性**：完整记录思考过程
4. **批量处理**：支持高效的批量分析

## 版本历史

### v2.1.0 (2024-12-20)
- 新增网页内容分析类型 (webpage)
- 添加WebpageAnalysisResult和WebpageAnalysisInput接口
- 实现与Chrome内置AI的集成分析流程
- 支持Chrome AI预分析 + agentThinking深度分析的分层架构
- 增加网页分析专用的思考-行动循环和工具处理逻辑

### v2.0.0 (2024-12-20)
- 整合所有相关文档，形成统一的综合文档
- 完善接口定义和系统架构描述
- 添加详细的流程图和使用示例

### v1.1.0 (2024-05-08)
- 优化项目分析功能
- 改进工具系统和参数验证

### v1.0.0 (2023-12-01)
- 初始版本发布
- 支持多种内容分析
- 实现思考-行动循环引擎

---

*本文档整合了所有相关技术文档，形成了智能Agent系统的完整技术资源。*