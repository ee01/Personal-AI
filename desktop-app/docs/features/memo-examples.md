# Desktop App 随手记使用示例

## 快速开始

## 推荐存入话术

这些是更适合触发豆包“随手记”存入的参考表达，建议在自动同步生成文案、手动同步文案和调试发送时尽量贴近这种语气：

| Personal AI 场景              | 随手记类型      | 示例话术                                                                                      |
| ----------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| `mobile_briefing`（近期重点） | 普通笔记        | `帮我把以下近期重点记到随手记里，方便我后面查看：项目 A 卡在接口联调，本周优先处理发布问题。` |
| `reminder_sync`（提醒）       | 待办清单        | `帮我记一下，周五下班前交周报。`                                                              |
| 位置相关数据                  | 停车位置 / 地址 | `帮我记一下，我车停在 B2 层 A 区 123 号。`                                                    |
| 重要日期                      | 重要日子        | `帮我记一下，妈妈生日是 3 月 15 号。`                                                         |
| 笔记 / 摘抄                   | 句子摘抄        | `帮我记一下这个句子：种一棵树最好的时间是十年前，其次是现在。`                                |
| 身份信息                      | 证件 / 卡号     | `帮我记一下身份证号是 123456789012345678。`                                                   |
| 健康数据                      | 健康数据        | `帮我记下，体重 68.5kg，今天早上血压 120/80。`                                                |

避免使用这类会削弱“存入随手记”意图的句子：

- `请把它们当成当前会话提醒，不要长期记住全部原文。`
- `这只是当前会话上下文，不需要长期记住。`

### 1. 测试文本分类

```bash
curl -X POST http://127.0.0.1:46321/memo/classify \
  -H "Content-Type: application/json" \
  -H "X-Bridge-Token: YOUR_TOKEN" \
  -d '{"text": "车停在B2层A区123号"}'
```

响应示例：

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

### 2. 同步随手记内容

```bash
curl -X POST http://127.0.0.1:46321/memo/sync \
  -H "Content-Type: application/json" \
  -H "X-Bridge-Token: YOUR_TOKEN" \
  -d '{
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
    ]
  }'
```

### 3. 随手记格式的长期记忆同步

```bash
curl -X POST http://127.0.0.1:46321/memo/stable-memory \
  -H "Content-Type: application/json" \
  -H "X-Bridge-Token: YOUR_TOKEN" \
  -d '{
    "items": [
      {
        "title": "停车位置",
        "body": "车停在B2层A区123号车位"
      },
      {
        "title": "重要日子",
        "body": "妈妈生日是3月15号"
      }
    ]
  }'
```

## 支持的随手记类型

### 生活助手类

#### 待办清单 (todo)

```json
{
  "type": "todo",
  "title": "完成项目",
  "content": "需要在下周五前完成项目报告",
  "metadata": {
    "dueDate": "2024-01-12",
    "importance": "high"
  }
}
```

#### 购物清单 (shopping)

```json
{
  "type": "shopping",
  "title": "购物清单",
  "content": "牛奶、面包、鸡蛋、水果",
  "metadata": {
    "category": "日常购物"
  }
}
```

#### 停车位置 (parking)

```json
{
  "type": "parking",
  "title": "停车位置",
  "content": "车停在B2层A区123号",
  "metadata": {
    "location": "B2层A区123"
  }
}
```

#### 东西在哪 (where)

```json
{
  "type": "where",
  "title": "钥匙位置",
  "content": "钥匙放在抽屉里了",
  "metadata": {
    "location": "抽屉",
    "tags": ["钥匙"]
  }
}
```

#### 重要日子 (important_date)

```json
{
  "type": "important_date",
  "title": "妈妈生日",
  "content": "妈妈生日是3月15号",
  "metadata": {
    "dueDate": "2024-03-15"
  }
}
```

### 信息记录类

#### 句子摘抄 (quote)

```json
{
  "type": "quote",
  "title": "名言摘抄",
  "content": "\"人生如梦\"—苏轼",
  "metadata": {}
}
```

#### 地址 (address)

```json
{
  "type": "address",
  "title": "公司地址",
  "content": "北京市朝阳区建国路88号",
  "metadata": {}
}
```

#### 证件/卡号 (card)

```json
{
  "type": "card",
  "title": "身份证号",
  "content": "身份证号：123456789012345678",
  "metadata": {
    "importance": "high"
  }
}
```

#### 号码/数字 (number)

```json
{
  "type": "number",
  "title": "手机号",
  "content": "我的手机号是13812345678",
  "metadata": {
    "tags": ["phone"]
  }
}
```

#### 健康数据 (health)

```json
{
  "type": "health",
  "title": "健康数据",
  "content": "体重68.5kg，血压120/80",
  "metadata": {
    "tags": ["健康"]
  }
}
```

## 实际使用场景

### 场景 1：停车后记录位置

用户说："车停在B2层A区123号"

系统会：

1. 自动识别为 `parking` 类型
2. 提取位置信息 `B2层A区123`
3. 格式化为结构化消息发送到豆包

### 场景 2：记录待办事项

用户说："记得明天下午3点开会"

系统会：

1. 自动识别为 `todo` 类型
2. 提取时间信息（明天下午3点）
3. 转换为标准日期格式
4. 格式化并同步

### 场景 3：记录物品位置

用户说："钥匙放在抽屉里了"

系统会：

1. 自动识别为 `where` 类型
2. 提取物品（钥匙）和位置（抽屉）
3. 标记便于后续查询

## 与 Memory Service 集成

当 Memory Service 推送内容时，系统会自动：

1. 分析内容类型
2. 智能分类
3. 提取结构化信息
4. 格式化为豆包随手记格式
5. 同步到指定线程

示例流程：

```
Memory Service → Context Package → Memo Classifier → Memo Formatter → Desktop App
```

## 高级用法

### 批量同步

```bash
curl -X POST http://127.0.0.1:46321/memo/sync \
  -H "Content-Type: application/json" \
  -H "X-Bridge-Token: YOUR_TOKEN" \
  -d '{
    "items": [
      {"type": "todo", "title": "任务1", "content": "内容1"},
      {"type": "shopping", "title": "购物清单", "content": "物品列表"},
      {"type": "parking", "title": "停车位置", "content": "B2-A123"}
    ],
    "context": "stable"
  }'
```

### Dry Run 测试

```bash
curl -X POST http://127.0.0.1:46321/memo/sync \
  -H "Content-Type: application/json" \
  -H "X-Bridge-Token: YOUR_TOKEN" \
  -d '{
    "items": [{"type": "todo", "title": "测试", "content": "测试内容"}],
    "dryRun": true
  }'
```

## 故障排查

### 分类不准确

如果分类结果不符合预期：

1. 使用 `/memo/classify` 测试分类
2. 检查文本是否包含足够的关键词
3. 考虑添加更明确的描述

### 同步失败

常见原因：

1. Token 无效或过期
2. 线程未绑定
3. 豆包登录状态失效
4. 网络问题

### 查看日志

```bash
# 查看服务日志
tail -f /path/to/desktop-app/logs/service.log
```

## 最佳实践

1. **使用明确的描述**: "车停在B2层A区123号" 比 "停好车了" 更容易被正确分类
2. **包含关键信息**: 对于待办事项，尽量包含截止日期
3. **敏感信息**: 证件、卡号会自动标记为高重要性
4. **定期同步**: 建议开启自动同步，保持数据最新
