# ChromaDB 工具集

本目录包含用于管理和分析 ChromaDB 数据的实用工具脚本。

## 工具列表

### 1. query_conversations.py - Conversations 数据分析工具

查询和分析 ChromaDB 中 `esone.qiu-graph-entities` collection 的 conversations 数据。

**功能：**
- 连接生产环境 ChromaDB (10.32.56.212:8000)
- 统计 `relatedData.conversations` 的分布情况
- 按实体类型（Topic、Person、Organization、Project、Document）分类统计
- 生成详细的 JSON 数据文件和可读性文本报告

**使用方法：**
```bash
# 激活虚拟环境
source venv/bin/activate

# 运行脚本
python tools/query_conversations.py
```

**输出文件：**
- `tools/conversations_analysis.json` - 完整的 JSON 格式数据
- `tools/conversations_analysis_report.txt` - 可读性文本报告

**最新统计结果（2025-10-15）：**

总实体数: 11,398 个
- 有 conversations: 5,360 个 (47.03%)
- 无 conversations: 6,038 个 (52.97%)

按实体类型统计：
- **Topic**: 2,813 个 (有 conversations: 47.2%)
- **Person**: 2,704 个 (有 conversations: 47.2%)
- **Organization**: 2,282 个 (有 conversations: 45.8%)
- **Project**: 1,978 个 (有 conversations: 46.7%)
- **Document**: 1,621 个 (有 conversations: 48.6%)

---

### 2. semantic_search.py - ChromaDB 语义搜索工具

使用自然语言查询 ChromaDB 中的相似数据，支持多种数据类型和高级过滤功能。

**核心特性：**
- 🧠 **语义搜索** - 基于向量相似度的智能搜索
- 📊 **多类型支持** - messages（消息）、entities（实体）、webpages（网页）
- 👤 **用户过滤** - 按用户名搜索特定用户的数据
- 🔧 **WHERE 过滤** - 支持元数据精确过滤条件
- 🎨 **智能格式化** - 根据数据类型自动优化展示
- 💾 **灵活导出** - 支持文本和 JSON 格式输出

**快速开始：**

```bash
# 1. 激活虚拟环境
source venv/bin/activate

# 2. 启动 ChromaDB 服务
docker-compose up -d

# 3. 基础搜索
python tools/semantic_search.py "项目进度"

# 4. 查看所有集合
python tools/semantic_search.py --list-collections
```

**常用命令示例：**

```bash
# 按类型搜索
python tools/semantic_search.py "张三" --type entities
python tools/semantic_search.py "会议讨论" --type messages

# 按用户搜索（推荐）
python tools/semantic_search.py "项目" --user esone.qiu
python tools/semantic_search.py "讨论" --user esone.qiu --type messages

# WHERE 元数据过滤
python tools/semantic_search.py "任务" --where '{"sender": "张三"}'
python tools/semantic_search.py "项目" --where '{"priority": "high"}'

# 用户 + 类型 + WHERE 组合（最精确）
python tools/semantic_search.py "项目" \
  --user esone.qiu \
  --type messages \
  --where '{"priority": "high"}'

# 控制输出
python tools/semantic_search.py "API" --limit 20
python tools/semantic_search.py "数据" --format json
python tools/semantic_search.py "报告" --output results.json
```

**核心参数：**

| 参数 | 简写 | 说明 | 示例 |
|------|------|------|------|
| `query` | - | 查询内容（必需） | `"项目进度"` |
| `--type` | `-t` | 数据类型 | `messages`, `entities`, `webpages` |
| `--user` | `-u` | 用户名过滤 | `esone.qiu` |
| `--where` | `-w` | 元数据过滤（JSON） | `'{"sender": "张三"}'` |
| `--limit` | `-n` | 结果数量 | `10` (默认) |
| `--format` | `-f` | 输出格式 | `text`, `json` |
| `--output` | `-o` | 保存到文件 | `results.json` |
| `--host` | - | 服务器地址 | `localhost` |
| `--port` | - | 服务器端口 | `8000` |

**使用技巧：**

1. **精确搜索**（推荐）
   ```bash
   python tools/semantic_search.py "项目" --user esone.qiu --type entities
   ```

2. **全局搜索**
   ```bash
   python tools/semantic_search.py "项目"
   ```

3. **高级过滤**
   ```bash
   # 搜索多个发送者
   python tools/semantic_search.py "讨论" --where '{"sender": {"$in": ["张三", "李四"]}}'
   
   # 排除某些内容
   python tools/semantic_search.py "会议" --where '{"sender": {"$nin": ["机器人"]}}'
   ```

**详细文档：**
- 📖 [完整使用指南](./semantic_search_README.md) - 包含所有功能说明和 WHERE 过滤详解
- 📚 [详细教程](./SEMANTIC_SEARCH_GUIDE.md) - 场景示例、最佳实践、故障排除
- 🎬 [示例脚本](./semantic_search_examples.sh) - 交互式演示

---

### 3. migrate_chroma_via_http.py - ChromaDB 数据迁移工具

用于从本地 ChromaDB v1 数据库迁移数据到运行中的 Chroma HTTP 服务。

**功能：**
- 从本地 v1 数据库读取 collections
- 通过 HTTP API 写入运行中的 Chroma 服务
- 确保迁移数据的完整性

**配置：**
```python
v1_folder = Path("./chroma-data-v1")  # 旧数据库路径
chroma_host = "localhost"              # Chroma 服务地址
chroma_port = "8000"                   # Chroma 服务端口
```

**使用方法：**
```bash
python tools/migrate_chroma_via_http.py
```

---

## 依赖要求

所有脚本都需要以下 Python 包：
- chromadb
- 其他依赖请参考 `requirements.txt`

安装依赖：
```bash
pip install -r requirements.txt
```

或使用项目虚拟环境：
```bash
source venv/bin/activate
```

---

## 注意事项

1. 确保 ChromaDB 服务正在运行
2. 对于生产环境操作，请谨慎执行
3. 建议在执行迁移前备份数据
4. 所有输出文件都保存在 `tools/` 目录下

---

## 相关文档

- [ChromaDB 官方文档](https://docs.trychroma.com/)
- [项目主文档](../docs/README.md)

