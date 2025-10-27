# 🔍 ChromaDB 语义搜索工具

> 使用自然语言检索 ChromaDB 向量数据库中的相似数据

---

## ✨ 特性

- 🧠 **语义搜索**：基于向量相似度的智能搜索，不是简单的关键词匹配
- 📊 **多类型支持**：messages（消息）、entities（实体）、webpages（网页）
- 🌐 **跨集合搜索**：同时搜索多个用户、多个集合
- 🔧 **元数据过滤**：支持 WHERE 条件精确过滤，结合语义搜索和精确匹配
- 🎨 **智能格式化**：根据数据类型自动优化展示格式
- 💾 **灵活导出**：支持文本和 JSON 格式，可保存到文件
- ⚡ **简单易用**：命令行界面，参数丰富，文档完善

---

## 🚀 5 分钟快速上手

### 第 1 步：启动服务

```bash
docker-compose up -d
```

### 第 2 步：激活环境

```bash
source venv/bin/activate
```

### 第 3 步：开始搜索

```bash
# 查看有哪些数据集合
python tools/semantic_search.py --list-collections

# 搜索！
python tools/semantic_search.py "项目进度更新"
```

就是这么简单！🎉

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [📂 工具目录](./README.md) | tools 目录总索引，所有工具概览 |
| [📖 详细指南](./SEMANTIC_SEARCH_GUIDE.md) | 完整的使用说明、场景示例、故障排除 |
| [🎬 示例脚本](./semantic_search_examples.sh) | 交互式演示，看看工具能做什么 |
| [🧪 测试脚本](./test_semantic_search.py) | 测试工具是否正常工作 |

---

## 💡 5 个典型使用场景

### 1️⃣ 查找某人的相关信息

```bash
python tools/semantic_search.py "张三" --type entities --limit 5
```

### 2️⃣ 查找项目讨论

```bash
python tools/semantic_search.py "AI项目进度" --type messages --limit 10
```

### 3️⃣ 查找技术文档

```bash
python tools/semantic_search.py "React Hooks 文档" --type webpages
```

### 4️⃣ 查找会议记录

```bash
python tools/semantic_search.py "周会讨论" --type messages
```

### 5️⃣ 导出数据分析

```bash
python tools/semantic_search.py "Q4目标" --format json --output q4_goals.json
```

### 🆕 6️⃣ 按用户搜索

```bash
# 搜索特定用户的所有数据
python tools/semantic_search.py "项目" --user esone.qiu

# 搜索特定用户的消息
python tools/semantic_search.py "会议讨论" --user esone.qiu --type messages

# 搜索特定用户的实体
python tools/semantic_search.py "团队成员" --user esone.qiu --type entities
```

### 7️⃣ 元数据过滤精确搜索

```bash
# 搜索特定发送者的消息
python tools/semantic_search.py "项目讨论" --type messages --where '{"sender": "张三"}'

# 搜索特定用户和团队的内容
python tools/semantic_search.py "技术方案" --user esone.qiu --where '{"teamName": "研发部"}'

# 搜索特定类型的实体
python tools/semantic_search.py "项目" --type entities --where '{"type": "Project"}'
```

---

## 🎯 核心命令

```bash
# 基础搜索
python tools/semantic_search.py "查询内容"

# 指定类型
python tools/semantic_search.py "查询内容" --type messages|entities|webpages

# 🆕 指定用户
python tools/semantic_search.py "查询内容" --user esone.qiu

# 🆕 用户+类型组合（最精确）
python tools/semantic_search.py "查询内容" --user esone.qiu --type messages

# 限制数量
python tools/semantic_search.py "查询内容" --limit 20

# 元数据过滤（where 条件）
python tools/semantic_search.py "查询内容" --where '{"字段名": "值"}'
python tools/semantic_search.py "查询内容" -w '{"sender": "张三"}'

# JSON 输出
python tools/semantic_search.py "查询内容" --format json

# 保存结果
python tools/semantic_search.py "查询内容" --output results.json

# 远程服务器
python tools/semantic_search.py "查询内容" --host 10.32.56.212 --port 8000

# 查看帮助
python tools/semantic_search.py --help
```

---

## 🎨 输出示例

### 消息搜索结果

```
================================================================================
结果 #1 [消息] - 相关度: 87.45%
================================================================================
ID: msg-12345
时间: 2025-10-15 14:30:00
发送者: 张三
团队: 开发团队

📝 摘要:
  讨论 AI 项目的进度更新和下一步计划

💬 内容:
  大家好，本周 AI 项目完成了核心算法的优化...

🏷️ 实体:
  人员: 张三, 李四
  项目: AI 项目, 推荐系统
  主题: 算法优化, 性能提升

📊 情感: positive | 优先级: high
```

### 实体搜索结果

```
================================================================================
结果 #1 [实体] - 相关度: 92.18%
================================================================================
ID: entity-67890
名称: AI 项目
类型: Project

📖 描述:
  使用机器学习技术的智能推荐系统项目

🔧 属性:
  status: 进行中
  team: 研发部
  priority: high

🔗 关联数据:
  会话: 45 条
  网页: 12 个
  项目: 3 个

创建时间: 2025-09-01 10:00:00
```

---

## ❓ 常见问题

**Q: 搜索不到结果怎么办？**  
A: 尝试使用更宽泛的查询词，或检查是否选择了正确的数据类型。

**Q: 如何搜索特定用户的数据？**  
A: 使用 `--user` 参数指定用户名，如 `--user esone.qiu`。可以结合 `--type` 进一步过滤。

**Q: 支持中文搜索吗？**  
A: 完全支持！语义搜索对中文支持很好。

**Q: 可以同时搜索多种类型吗？**  
A: 可以！不指定 `--type` 参数就会搜索所有类型。

**Q: 结果的相关度是如何计算的？**  
A: 基于向量空间中的余弦相似度，范围 0-100%，越高越相关。

---

## 🐛 遇到问题？

### 连接失败

```bash
# 检查服务状态
docker-compose ps

# 重启服务
docker-compose restart chroma
```

### Python 错误

```bash
# 激活虚拟环境
source venv/bin/activate

# 重新安装依赖
pip install -r requirements.txt
```

### 查看日志

```bash
# ChromaDB 日志
docker-compose logs -f chroma

# 工具调试
python tools/semantic_search.py "test" --type messages 2>&1 | tee debug.log
```

---

## 🎓 学习资源

### 新手入门

1. 阅读 [快速参考](./QUICK_REFERENCE.md)
2. 运行示例脚本：`./tools/semantic_search_examples.sh`
3. 尝试搜索你的数据

### 进阶使用

1. 阅读 [详细指南](./SEMANTIC_SEARCH_GUIDE.md)
2. 了解高级参数和技巧
3. 编写自己的搜索脚本

### 开发集成

1. 查看源码：`tools/semantic_search.py`
2. 运行测试：`python tools/test_semantic_search.py`
3. 集成到你的工作流

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可

遵循项目主许可证

---

## 🌟 快速提示

💡 **提示 1**：使用具体的、描述性的查询会得到更好的结果  
💡 **提示 2**：先用小的 `--limit` 值快速测试  
💡 **提示 3**：重要搜索建议保存到文件  
💡 **提示 4**：使用 `--type` 可以大大提高搜索速度  
💡 **提示 5**：语义搜索不需要精确匹配，相近的词也能找到

---

## 🔧 高级功能：元数据过滤（WHERE 条件）

### 什么是 WHERE 过滤？

WHERE 过滤允许你在语义搜索的基础上，添加精确的元数据条件。这样可以：
- ✅ 缩小搜索范围，提高精度
- ✅ 过滤特定用户、团队、时间段的数据
- ✅ 结合语义搜索和精确匹配的优势

### 基本语法

```bash
python tools/semantic_search.py "查询内容" --where '{"字段名": "值"}'
# 或使用短参数
python tools/semantic_search.py "查询内容" -w '{"字段名": "值"}'
```

**注意**：
- WHERE 参数必须是有效的 JSON 格式
- 使用单引号包裹 JSON 字符串
- JSON 内部的字符串使用双引号

### 常用元数据字段

#### 消息（Messages）
- `sender`: 发送者
- `teamName`: 团队名称
- `sentiment`: 情感（positive/negative/neutral）
- `priority`: 优先级（high/medium/low）

#### 实体（Entities）
- `name`: 实体名称
- `type`: 实体类型（Person/Project/Topic/Organization）

#### 网页（Webpages）
- `title`: 网页标题
- `domain`: 域名
- `url`: 网址
- `contentCategory`: 内容分类
- `contentRelevance`: 内容相关性

### 使用示例

#### 1. 搜索特定人的消息

```bash
python tools/semantic_search.py "项目进度" --type messages --where '{"sender": "张三"}'
```

#### 2. 搜索特定团队的讨论

```bash
python tools/semantic_search.py "技术方案" --type messages --where '{"teamName": "研发部"}'
```

#### 3. 搜索特定类型的实体

```bash
# 搜索项目类型的实体
python tools/semantic_search.py "AI" --type entities --where '{"type": "Project"}'

# 搜索人员类型的实体
python tools/semantic_search.py "前端" --type entities --where '{"type": "Person"}'
```

#### 4. 搜索特定情感的消息

```bash
# 搜索积极情感的消息
python tools/semantic_search.py "反馈" --type messages --where '{"sentiment": "positive"}'
```

#### 5. 搜索高优先级事项

```bash
python tools/semantic_search.py "任务" --type messages --where '{"priority": "high"}'
```

#### 6. 搜索特定域名的网页

```bash
python tools/semantic_search.py "文档" --type webpages --where '{"domain": "docs.google.com"}'
```

### ChromaDB WHERE 查询操作符

ChromaDB 支持多种查询操作符，可以构建复杂的过滤条件：

#### 基础操作符

```bash
# 等于
--where '{"sender": "张三"}'

# 不等于
--where '{"sender": {"$ne": "张三"}}'

# 包含（数组字段）
--where '{"tags": {"$contains": "urgent"}}'
```

#### 比较操作符

```bash
# 大于
--where '{"priority": {"$gt": 5}}'

# 大于等于
--where '{"priority": {"$gte": 5}}'

# 小于
--where '{"priority": {"$lt": 10}}'

# 小于等于
--where '{"priority": {"$lte": 10}}'
```

#### 逻辑操作符

```bash
# AND - 多个条件同时满足
--where '{"$and": [{"sender": "张三"}, {"teamName": "研发部"}]}'

# OR - 满足任一条件
--where '{"$or": [{"sender": "张三"}, {"sender": "李四"}]}'

# NOT - 排除条件
--where '{"$not": {"sender": "张三"}}'
```

#### IN / NOT IN

```bash
# 在列表中
--where '{"sender": {"$in": ["张三", "李四", "王五"]}}'

# 不在列表中
--where '{"sender": {"$nin": ["张三", "李四"]}}'
```

### 复杂查询示例

#### 1. 搜索多个人的消息

```bash
python tools/semantic_search.py "项目讨论" \
  --type messages \
  --where '{"sender": {"$in": ["张三", "李四", "王五"]}}'
```

#### 2. 搜索特定团队的高优先级消息

```bash
python tools/semantic_search.py "紧急任务" \
  --type messages \
  --where '{"$and": [{"teamName": "研发部"}, {"priority": "high"}]}'
```

#### 3. 排除某些人的消息

```bash
python tools/semantic_search.py "会议纪要" \
  --type messages \
  --where '{"sender": {"$nin": ["系统消息", "机器人"]}}'
```

#### 4. 搜索积极或中性情感的消息

```bash
python tools/semantic_search.py "客户反馈" \
  --type messages \
  --where '{"sentiment": {"$in": ["positive", "neutral"]}}'
```

### 常见问题

**Q: WHERE 过滤和语义搜索有什么区别？**  
A: 
- 语义搜索：基于内容相似度，找到语义相关的结果
- WHERE 过滤：基于元数据精确匹配，在语义搜索结果中进一步筛选
- 两者结合：先用 WHERE 缩小范围，再做语义匹配，精度最高

**Q: WHERE 参数的 JSON 格式总是报错怎么办？**  
A: 确保：
1. 使用单引号包裹整个 JSON：`'{"key": "value"}'`
2. JSON 内部使用双引号：`{"key": "value"}` ✅，`{'key': 'value'}` ❌
3. 可以使用在线 JSON 验证工具检查格式

**Q: 如何知道有哪些元数据字段可以过滤？**  
A: 使用 `--format json` 查看搜索结果，查看 `metadata` 字段中的内容：
```bash
python tools/semantic_search.py "测试" --limit 1 --format json
```

**Q: WHERE 过滤会影响搜索性能吗？**  
A: 
- 通常会提高性能，因为缩小了搜索范围
- 复杂的逻辑操作符（多层嵌套的 AND/OR）可能略微降低性能

**Q: 可以同时使用多个过滤条件吗？**  
A: 可以！使用 `$and` 或直接在 JSON 中列出多个字段：
```bash
# 方式1：直接列出（隐式 AND）
--where '{"sender": "张三", "priority": "high"}'

# 方式2：显式 AND
--where '{"$and": [{"sender": "张三"}, {"priority": "high"}]}'
```

---

**准备好了吗？开始搜索吧！** 🚀

```bash
python tools/semantic_search.py "你想搜索什么？"
```

