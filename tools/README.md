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

使用自然语言查询 ChromaDB 中的相似数据，支持多种数据类型。

**功能：**
- 🔍 自然语言语义搜索
- 📊 支持多种数据类型：messages（消息）、entities（实体）、webpages（网页）
- 🌐 支持跨用户、跨集合搜索
- 📝 提供详细的结果展示（文本格式 / JSON 格式）
- 💾 支持保存搜索结果到文件
- 🏷️ 智能识别并格式化不同类型的数据

**使用方法：**

```bash
# 激活虚拟环境
source venv/bin/activate

# 基础查询 - 搜索所有消息、实体和网页
python tools/semantic_search.py "项目进度更新"

# 指定数据类型
python tools/semantic_search.py "张三" --type entities
python tools/semantic_search.py "API 文档" --type webpages
python tools/semantic_search.py "会议讨论" --type messages

# 搜索指定集合
python tools/semantic_search.py "前端开发" --collections esone.qiu-messages esone.qiu-entities

# 指定返回数量
python tools/semantic_search.py "数据库设计" --limit 20

# JSON 格式输出
python tools/semantic_search.py "技术方案" --format json

# 保存结果到文件
python tools/semantic_search.py "产品需求" --output results.json

# 连接远程服务器
python tools/semantic_search.py "会议纪要" --host 10.32.56.212 --port 8000

# 列出所有可用集合
python tools/semantic_search.py --list-collections
```

**命令行参数：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `query` | 自然语言查询（必需） | - |
| `-t, --type` | 数据类型 (messages/entities/webpages/all) | all |
| `-c, --collections` | 指定集合名称（可多个） | - |
| `-n, --limit` | 每个集合返回结果数量 | 10 |
| `-f, --format` | 输出格式 (text/json) | text |
| `-o, --output` | 保存结果到文件 | - |
| `--host` | ChromaDB 主机 | localhost |
| `--port` | ChromaDB 端口 | 8000 |
| `--list-collections` | 列出所有可用集合 | - |

**示例查询：**

```bash
# 查找与"项目进度"相关的所有数据
python tools/semantic_search.py "项目进度讨论"

# 查找某个人相关的实体信息
python tools/semantic_search.py "张三的工作" --type entities --limit 5

# 查找技术文档相关的网页
python tools/semantic_search.py "React 技术文档" --type webpages

# 查找特定团队的消息
python tools/semantic_search.py "前端团队周会" --type messages --limit 15
```

**输出格式：**

工具会智能识别数据类型并提供友好的格式化输出：

- **消息（Messages）**：显示发送者、时间、团队、摘要、内容、实体信息等
- **实体（Entities）**：显示名称、类型、描述、属性、关联数据等
- **网页（Webpages）**：显示标题、URL、域名、内容、分类、标签等

**重要说明：**

工具使用与项目相同的嵌入模型 (`sentence-transformers/all-MiniLM-L6-v2`)，确保搜索结果的准确性。首次运行时会自动下载模型（约 90MB）。

**快速开始：**

```bash
# 首次使用需要安装依赖（包含 sentence-transformers）
pip install -r requirements.txt

# 运行示例脚本（交互式演示）
./tools/semantic_search_examples.sh

# 查看详细使用指南
cat tools/SEMANTIC_SEARCH_GUIDE.md
```

**相关文档：**
- ⚡ [快速参考](./QUICK_REFERENCE.md) - 常用命令速查表
- 📖 [详细使用指南](./SEMANTIC_SEARCH_GUIDE.md) - 完整的使用说明、场景示例、故障排除
- 🎬 [示例脚本](./semantic_search_examples.sh) - 交互式示例演示
- 🧪 [测试脚本](./test_semantic_search.py) - 功能测试和验证

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

