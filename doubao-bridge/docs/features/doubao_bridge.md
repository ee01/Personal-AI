# Doubao Bridge 随手记功能

## 概述

Doubao Bridge 的随手记功能允许将 Memory Service 中的内容智能分类后同步到豆包，以结构化的格式呈现，便于用户在手机端查看和管理。

## 功能特性

### 智能类型分类

系统会自动分析消息内容，将其分类到最合适的随手记类型：

#### 生活助手类
- **待办清单 (todo)**: 待办事项、任务提醒
- **购物清单 (shopping)**: 需要购买的物品
- **停车位置 (parking)**: 车辆停放位置
- **东西在哪 (where)**: 物品存放位置
- **重要日子 (important_date)**: 生日、纪念日、会议等

#### 信息记录类
- **句子摘抄 (quote)**: 名言、金句、引用
- **地址 (address)**: 地址信息
- **证件/卡号 (card)**: 身份证、银行卡等
- **号码/数字 (number)**: 电话号码、验证码等
- **健康数据 (health)**: 血压、体重等健康数据
- **普通笔记 (note)**: 默认类型

### 分类算法

分类器使用关键词匹配和正则表达式模式识别：

1. **优先级匹配**: 高优先级类型优先匹配（如停车位置、证件卡号）
2. **多重匹配**: 支持关键词和模式的组合匹配
3. **置信度评分**: 每次分类都会输出置信度（0-1）

## API 接口

### 同步随手记

**POST /memo/sync**

同步自定义随手记内容。

```json
{
  "items": [
    {
      "type": "todo",
      "title": "完成报告",
      "content": "需要在周五前完成季度报告",
      "metadata": {
        "dueDate": "2024-01-05",
        "importance": "high"
      }
    }
  ],
  "context": "stable"
}
```

### 随手记格式的长期记忆同步

**POST /memo/stable-memory**

将长期记忆自动分类后同步。

```json
{
  "items": [
    {
      "title": "停车位置",
      "body": "车停在B2层A区123号车位"
    }
  ]
}
```

### 随手记格式的提醒同步

**POST /memo/reminders**

将提醒转换为待办格式同步。

```json
{
  "reminders": [
    {
      "title": "周会",
      "dueAt": "2024-01-05T10:00:00",
      "severity": "medium"
    }
  ]
}
```

### 分类测试

**POST /memo/classify**

测试文本分类结果。

```json
{
  "text": "车停在B2层A区123号"
}
```

响应：

```json
{
  "type": "parking",
  "confidence": 0.85,
  "matchedPatterns": ["keyword:停车", "pattern:/[Bb][12]/"],
  "metadata": {
    "location": "B2层A区123"
  }
}
```

## 使用示例

### 智能分类示例

| 输入文本 | 分类结果 |
|---------|---------|
| "车停在B2层A区123号" | 🅿️ 停车位置 |
| "钥匙放在抽屉里了" | 📍 东西在哪 |
| "下周三要交报告" | ✅ 待办清单 |
| "妈妈生日是3月15号" | 📅 重要日子 |
| "身份证号：123456789012345678" | 💳 证件/卡号 |
| "我的手机号是13812345678" | 🔢 号码/数字 |
| "体重68.5kg，血压120/80" | ❤️ 健康数据 |

### 消息格式示例

分类后的消息会以结构化格式呈现：

```
🅿️ 【停车位置】

📌 车辆位置
📝 车停在B2层A区123号车位

---
📍 位置: B2层A区123
📡 来源: memory_service

_类型: 停车位置_
```

## 核心模块

### memoTypes.ts

定义随手记类型、匹配模式和显示配置。

```typescript
export type MemoType = 
  | 'todo' | 'shopping' | 'parking' | 'where' | 'important_date'
  | 'quote' | 'address' | 'card' | 'number' | 'health' | 'note';
```

### memoClassifier.ts

智能分类器，包含：
- `classifyMessage()`: 单条消息分类
- `extractMemoContent()`: 提取结构化信息
- `convertToMemoItems()`: 转换 Memory Package
- `convertRemindersToMemoItems()`: 转换提醒事项

### memoFormatter.ts

消息格式化器，包含：
- `formatMemoItem()`: 格式化单条
- `formatMemoBatch()`: 批量格式化
- `smartFormat()`: 智能选择格式

## 集成到现有同步流程

### 自动同步（已启用）

定时同步**默认使用随手记格式**，在 `BridgeSyncManager.tick()` 中：

```typescript
// 长期记忆同步 - 使用随手记格式
await syncManager.syncStableMemoryAsMemo();

// 移动简报同步 - 保持原样
await syncManager.syncMobileBriefing();

// 提醒事项同步 - 使用随手记格式（转为待办）
await syncManager.syncRemindersAsMemo();
```

**同步周期配置：**

| 同步类别 | 默认间隔 | 配置环境变量 | 使用接口 |
|---------|---------|-------------|---------|
| 长期记忆 | 12 小时 | `DOUBAO_BRIDGE_STABLE_SYNC_INTERVAL_MS` | `syncStableMemoryAsMemo()` |
| 移动简报 | 4 小时 | `DOUBAO_BRIDGE_MOBILE_SYNC_INTERVAL_MS` | `syncMobileBriefing()` |
| 提醒事项 | 15 分钟 | `DOUBAO_BRIDGE_REMINDER_SYNC_INTERVAL_MS` | `syncRemindersAsMemo()` |

### 手动调用

```bash
# 通过 API 调用
curl -X POST http://127.0.0.1:46321/memo/sync \
  -H "Content-Type: application/json" \
  -H "X-Bridge-Token: YOUR_TOKEN" \
  -d '{"items": [{"type": "todo", "title": "测试", "content": "测试内容"}]}'
```

## 扩展指南

### 添加新的随手记类型

1. 在 `memoTypes.ts` 中添加类型定义：

```typescript
export type MemoType = ... | 'new_type';

export const MEMO_TYPE_PATTERNS: MemoTypePattern[] = [
  {
    type: 'new_type',
    keywords: ['关键词1', '关键词2'],
    patterns: [/正则表达式/],
    priority: 70,
  },
  // ...
];
```

2. 更新显示配置：

```typescript
export const MEMO_TYPE_NAMES: Record<MemoType, string> = {
  // ...
  new_type: '新类型名称',
};

export const MEMO_TYPE_ICONS: Record<MemoType, string> = {
  // ...
  new_type: '🆕',
};
```

3. 在 `memoClassifier.ts` 中添加提取逻辑（如需要）。

### 自定义格式化

继承或修改 `memoFormatter.ts` 中的格式化函数：

```typescript
export function customFormatter(item: MemoItem): string {
  // 自定义格式化逻辑
}
```

## 技术细节

### 分类优先级

类型的匹配优先级（从高到低）：

1. 停车位置 (90) - 高准确度，特定模式
2. 东西在哪 (85) - 位置相关
3. 证件/卡号 (85) - 敏感信息
4. 重要日子 (80) - 时间相关
5. 号码/数字 (80) - 数字模式
6. 购物清单 (75) - 购物相关
7. 健康数据 (75) - 健康指标
8. 待办清单 (70) - 通用任务
9. 地址 (65) - 地址格式
10. 句子摘抄 (60) - 引用格式

### 元数据提取

系统会自动从文本中提取：
- 日期（支持多种格式）
- 位置信息
- 联系方式
- 重要性标记

## 最佳实践

1. **使用明确的描述**: "车停在B2层A区123号" 比 "停好车了" 更容易被正确分类
2. **包含关键信息**: 对于待办事项，尽量包含截止日期
3. **敏感信息标记**: 证件、卡号会自动标记为高重要性

## 未来规划

- [ ] 支持豆包手机端 API 直连（如果开放）
- [ ] 添加更多类型的智能识别
- [ ] 支持自定义分类规则
- [ ] 添加分类准确率统计
- [ ] 支持批量学习和规则优化
