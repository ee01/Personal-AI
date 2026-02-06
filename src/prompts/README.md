# Prompts 重构说明

## 📁 新的文件结构

### 1. `/src/utils/ruleTextBuilder.ts` - 规则文本构建器
复用的工具函数，用于构建完整的规则文本描述。

**导出的函数：**
- `buildRuleText()` - 根据 TopicItem 构建完整规则文本
- `extractRuleIdsFromMatchedRule()` - 从 LLM 返回的匹配规则中提取规则 ID

**使用位置：**
- `messageDealing.ts` - 消息过滤分析
- `NotificationService.ts` - LLM 审核通知
- `messageAnalysis.ts` prompt 构建

### 2. `/src/prompts/` - Prompt 模板目录

#### `/src/prompts/messageAnalysis.ts` - 消息分析相关 Prompts
**函数：**
- `buildMessageFilterSystemPrompt()` - 构建消息过滤系统 Prompt
- `buildLLMReviewPrompt()` - 构建 LLM 审核 Prompt

**使用位置：**
- `messageDealing.ts` - 消息过滤
- `NotificationService.ts` - 通知前审核

#### `/src/prompts/entityExtraction.ts` - 实体提取相关 Prompts
**函数：**
- `buildEntityExtractionPrompt()` - 构建消息实体提取 Prompt
- `buildQueryIntentAnalysisPrompt()` - 构建查询意图分析 Prompt

**使用位置：**
- `services/entityExtraction.ts`

#### `/src/prompts/autoReply.ts` - 自动答复相关 Prompts
**函数：**
- `buildAutoReplyPrompt()` - 构建自动答复生成 Prompt

**使用位置：**
- `llm.ts` - `generateAutoReply()` 函数

#### `/src/prompts/index.ts` - 统一导出
统一导出所有 prompt 构建函数，方便导入使用。

## 🔄 重构改动

### 文件变更清单

1. **新增文件**
   - `src/utils/ruleTextBuilder.ts` ✨
   - `src/prompts/messageAnalysis.ts` ✨
   - `src/prompts/entityExtraction.ts` ✨
   - `src/prompts/autoReply.ts` ✨
   - `src/prompts/index.ts` ✨

2. **修改文件**
   - `src/messageDealing.ts`
     - 删除了本地的 `buildRuleText()` 和 `extractRuleIdsFromMatchedRule()` 函数
     - 从 `utils/ruleTextBuilder` 导入这些函数
     - 使用 `buildMessageFilterSystemPrompt()` 替代内联的 system_prompt
   
   - `src/services/NotificationService.ts`
     - 删除了本地的 `buildRuleText()` 方法
     - 从 `utils/ruleTextBuilder` 和 `prompts` 导入相关函数
     - 使用 `buildLLMReviewPrompt()` 替代内联的 reviewPrompt
   
   - `src/services/entityExtraction.ts`
     - 使用 `buildEntityExtractionPrompt()` 替代内联的 prompt
     - 使用 `buildQueryIntentAnalysisPrompt()` 替代内联的 analysisPrompt
   
   - `src/llm.ts`
     - 使用 `buildAutoReplyPrompt()` 替代内联的 prompt

## ✅ 重构优势

### 1. **代码复用**
- `buildRuleText` 函数原本在两个地方重复实现，现在统一到一个位置
- 所有 prompt 模板统一管理，避免重复代码

### 2. **易于维护**
- Prompt 模板集中在 `prompts/` 目录，修改时不需要在多个文件中搜索
- 每个文件按功能分类（消息分析、实体提取、自动答复），职责清晰

### 3. **类型安全**
- 所有 prompt 构建函数都有明确的参数类型定义
- 使用 TypeScript 接口确保参数正确性

### 4. **可测试性**
- Prompt 构建逻辑独立出来，便于单独测试
- 可以轻松验证不同参数组合生成的 prompt 是否正确

### 5. **易于扩展**
- 新增 prompt 时只需在 `prompts/` 目录下创建新文件
- 遵循统一的命名和组织规范

## 📖 使用示例

### 导入方式 1：从索引文件统一导入
```typescript
import { 
  buildMessageFilterSystemPrompt,
  buildLLMReviewPrompt,
  buildEntityExtractionPrompt,
  buildAutoReplyPrompt 
} from './prompts';
```

### 导入方式 2：从具体文件导入
```typescript
import { buildLLMReviewPrompt } from './prompts/messageAnalysis';
import { buildRuleText } from './utils/ruleTextBuilder';
```

### 使用示例
```typescript
// 构建消息过滤 prompt
const systemPrompt = buildMessageFilterSystemPrompt({
  concernedItems: concernedItems,
  username: 'John Doe',
  envConfig: envConfig
});

// 构建规则文本
const ruleText = buildRuleText(topicItem);

// 构建 LLM 审核 prompt
const reviewPrompt = buildLLMReviewPrompt({
  sender: '张三',
  teamName: '项目组',
  messageContent: '消息内容',
  summary: '消息摘要',
  userName: '李四',
  concernedItems: [item1, item2]
});
```

## 🎯 迁移指南

如果你在其他地方使用了相关函数，请按以下方式更新：

### 旧代码
```typescript
// messageDealing.ts 中直接定义
function buildRuleText(item) { ... }

// NotificationService.ts 中的方法
private buildRuleText(item) { ... }
```

### 新代码
```typescript
// 统一导入
import { buildRuleText } from './utils/ruleTextBuilder';
import { buildLLMReviewPrompt } from './prompts';

// 直接使用
const text = buildRuleText(item);
const prompt = buildLLMReviewPrompt({ ... });
```

## 📝 注意事项

1. **保持向后兼容**：所有函数签名保持不变，现有调用无需修改参数
2. **导入路径**：注意根据文件位置调整导入路径（`./prompts` 或 `../prompts`）
3. **类型定义**：确保导入了必要的类型（如 `TopicItemWithAutoReply`）
