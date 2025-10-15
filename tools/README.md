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

### 2. migrate_chroma_via_http.py - ChromaDB 数据迁移工具

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

