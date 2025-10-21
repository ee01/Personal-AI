# ChromaDB 语义搜索工具使用指南

## 🚀 快速开始

### 1. 启动 ChromaDB 服务

```bash
# 启动本地 ChromaDB 服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f chroma
```

### 2. 激活 Python 虚拟环境

```bash
# 在项目根目录下
source venv/bin/activate
```

### 3. 运行搜索

```bash
# 查看帮助
python tools/semantic_search.py --help

# 列出所有可用集合
python tools/semantic_search.py --list-collections

# 执行搜索
python tools/semantic_search.py "你的查询内容"
```

---

## 📖 详细使用说明

### 基础查询

```bash
# 搜索所有类型（messages + entities + webpages）
python tools/semantic_search.py "项目进度更新"

# 限制返回结果数量
python tools/semantic_search.py "技术讨论" --limit 5
```

### 按类型搜索

```bash
# 只搜索消息
python tools/semantic_search.py "会议记录" --type messages

# 只搜索实体（人员、项目、主题等）
python tools/semantic_search.py "张三" --type entities

# 只搜索网页
python tools/semantic_search.py "技术文档" --type webpages
```

### 指定集合搜索

```bash
# 搜索特定用户的消息
python tools/semantic_search.py "前端开发" --collections esone.qiu-messages

# 搜索多个集合
python tools/semantic_search.py "数据库" --collections esone.qiu-messages esone.qiu-entities esone.qiu-webpages
```

### 输出格式控制

```bash
# 文本格式（默认，易读）
python tools/semantic_search.py "API 设计" --format text

# JSON 格式（便于程序处理）
python tools/semantic_search.py "API 设计" --format json

# 保存结果到文件
python tools/semantic_search.py "产品需求" --output results.json

# JSON 格式保存
python tools/semantic_search.py "产品需求" --format json --output results.json
```

### 远程服务器连接

```bash
# 连接生产环境
python tools/semantic_search.py "会议纪要" --host 10.32.56.212 --port 8000

# 连接并列出集合
python tools/semantic_search.py --list-collections --host 10.32.56.212 --port 8000
```

---

## 🎯 实用场景示例

### 场景 1：查找与某个人相关的所有信息

```bash
# 查找实体
python tools/semantic_search.py "张三" --type entities --limit 3

# 查找消息
python tools/semantic_search.py "张三的讨论" --type messages --limit 10

# 查找所有类型
python tools/semantic_search.py "张三" --limit 5
```

### 场景 2：查找项目相关的讨论

```bash
# 查找项目实体
python tools/semantic_search.py "AI 项目" --type entities

# 查找项目相关的消息
python tools/semantic_search.py "AI 项目进度" --type messages --limit 15

# 保存搜索结果供后续分析
python tools/semantic_search.py "AI 项目" --output ai_project_data.json
```

### 场景 3：查找技术相关的资料

```bash
# 查找技术讨论
python tools/semantic_search.py "React Hooks 使用方法" --type messages

# 查找技术文档网页
python tools/semantic_search.py "React 官方文档" --type webpages

# 查找技术相关的所有资料
python tools/semantic_search.py "React" --limit 20
```

### 场景 4：查找会议和讨论记录

```bash
# 查找周会记录
python tools/semantic_search.py "周会讨论" --type messages --limit 10

# 查找特定主题的会议
python tools/semantic_search.py "产品设计评审" --type messages

# 查找最近的重要讨论
python tools/semantic_search.py "重要决策" --type messages --limit 5
```

### 场景 5：数据分析和导出

```bash
# 导出数据进行分析
python tools/semantic_search.py "Q4 目标" --format json --output q4_goals.json

# 批量搜索并保存（可以写成脚本）
python tools/semantic_search.py "前端开发" --output frontend.json
python tools/semantic_search.py "后端开发" --output backend.json
python tools/semantic_search.py "测试" --output testing.json
```

---

## 🔍 搜索技巧

### 1. 使用具体的描述性查询

✅ 好的查询：
- "React 组件优化方案"
- "数据库索引设计讨论"
- "张三负责的前端项目"

❌ 不好的查询：
- "React"（太宽泛）
- "讨论"（缺少上下文）
- "项目"（不够具体）

### 2. 结合类型过滤提高精度

```bash
# 如果只想找人，使用 entities
python tools/semantic_search.py "产品经理" --type entities

# 如果只想找讨论，使用 messages
python tools/semantic_search.py "产品讨论" --type messages
```

### 3. 调整返回数量

```bash
# 快速预览，只返回 3 条
python tools/semantic_search.py "API 接口" --limit 3

# 深度分析，返回 50 条
python tools/semantic_search.py "API 接口" --limit 50
```

### 4. 使用自然语言

语义搜索支持自然语言，可以像和人对话一样提问：

```bash
python tools/semantic_search.py "谁在负责前端开发"
python tools/semantic_search.py "最近讨论了什么重要的技术问题"
python tools/semantic_search.py "有哪些关于性能优化的文档"
```

---

## 📊 输出说明

### 文本格式输出（默认）

工具会根据数据类型智能格式化输出：

**消息（Messages）**
- 消息 ID
- 发送时间
- 发送者
- 团队/群组
- 消息摘要
- 完整内容
- 提取的实体（人员、项目、主题）
- 情感分析和优先级

**实体（Entities）**
- 实体 ID
- 名称和类型
- 描述
- 属性列表
- 关联数据统计（会话、网页、项目等）
- 创建时间

**网页（Webpages）**
- 网页 ID
- 标题和 URL
- 域名
- 内容摘要
- 分类和相关性
- 提取的信息（项目、人员、标签）
- 提取时间

### JSON 格式输出

结构化数据，包含：
- `id`: 数据 ID
- `distance`: 向量距离（越小越相似）
- `relevance`: 相关度（0-1，越大越相关）
- `document`: 文档内容
- `metadata`: 元数据对象

---

## ⚙️ 配置说明

### 默认配置

- **主机**: localhost
- **端口**: 8000
- **返回数量**: 每个集合 10 条
- **输出格式**: text

### 修改默认配置

可以通过命令行参数覆盖默认配置：

```bash
python tools/semantic_search.py "查询内容" \
  --host 10.32.56.212 \
  --port 8000 \
  --limit 20 \
  --format json
```

### 环境变量配置（未来支持）

可以考虑添加环境变量支持：
- `CHROMA_HOST`
- `CHROMA_PORT`
- `SEARCH_DEFAULT_LIMIT`

---

## 🐛 故障排除

### 1. 连接失败

```
❌ 连接失败: Could not connect to a Chroma server
```

**解决方法：**
```bash
# 启动 ChromaDB 服务
docker-compose up -d

# 检查服务状态
docker-compose ps

# 检查端口是否被占用
lsof -i :8000
```

### 2. 没有找到结果

```
❌ 没有找到任何结果
```

**可能原因：**
- 查询过于具体
- 数据库中确实没有相关数据
- 集合为空或不存在

**解决方法：**
```bash
# 1. 先列出所有集合，确认数据存在
python tools/semantic_search.py --list-collections

# 2. 使用更宽泛的查询
python tools/semantic_search.py "项目" --limit 5

# 3. 尝试搜索特定集合
python tools/semantic_search.py "内容" --collections esone.qiu-messages
```

### 3. Python 依赖错误

```
ImportError: cannot import name 'field_validator' from 'pydantic'
```

**解决方法：**
```bash
# 确保使用虚拟环境
source venv/bin/activate

# 重新安装依赖
pip install -r requirements.txt

# 如果问题持续，尝试升级 chromadb
pip install --upgrade chromadb
```

---

## 🔧 高级用法

### 1. 批量搜索脚本

创建一个脚本进行批量搜索：

```bash
#!/bin/bash
# batch_search.sh

QUERIES=(
  "前端开发"
  "后端架构"
  "数据库设计"
  "API 接口"
  "测试方案"
)

for query in "${QUERIES[@]}"; do
  echo "搜索: $query"
  python tools/semantic_search.py "$query" --limit 5 --output "results_${query// /_}.json"
done
```

### 2. 结合 jq 处理 JSON 结果

```bash
# 搜索并提取特定字段
python tools/semantic_search.py "项目" --format json | jq '.[] | .[].id'

# 统计每个集合的结果数量
python tools/semantic_search.py "API" --format json | jq 'to_entries | map({collection: .key, count: (.value | length)})'

# 提取相关度最高的结果
python tools/semantic_search.py "技术讨论" --format json --output results.json
jq '.[] | .[0]' results.json  # 每个集合的第一条结果
```

### 3. 定时搜索和监控

```bash
#!/bin/bash
# monitor_keywords.sh - 监控关键词

while true; do
  timestamp=$(date +%Y%m%d_%H%M%S)
  python tools/semantic_search.py "紧急问题" \
    --type messages \
    --limit 3 \
    --output "monitoring/urgent_${timestamp}.json"
  sleep 3600  # 每小时执行一次
done
```

---

## 📝 注意事项

1. **性能考虑**
   - 搜索大量集合会比较慢
   - 建议使用 `--type` 参数限制搜索范围
   - 合理设置 `--limit` 参数

2. **数据隐私**
   - 搜索结果可能包含敏感信息
   - 保存到文件时注意权限设置
   - 不要将包含敏感数据的结果文件提交到代码仓库

3. **结果解读**
   - `relevance` 值越高表示越相关
   - 语义搜索基于向量相似度，不是关键词匹配
   - 结果排序是按相似度，不是按时间

4. **最佳实践**
   - 使用具体的、描述性的查询
   - 先用小的 `--limit` 值快速测试
   - 重要搜索建议保存结果文件
   - 定期备份 ChromaDB 数据

---

## 🆘 获取帮助

```bash
# 查看完整帮助
python tools/semantic_search.py --help

# 查看版本和信息
python tools/semantic_search.py --version  # 待实现

# 查看示例
python tools/semantic_search.py --examples  # 待实现
```

---

## 🔗 相关资源

- [ChromaDB 官方文档](https://docs.trychroma.com/)
- [项目主文档](../docs/README.md)
- [工具目录 README](./README.md)

---

## 📮 反馈和建议

如果你有任何问题或建议，请在项目中提交 Issue。

