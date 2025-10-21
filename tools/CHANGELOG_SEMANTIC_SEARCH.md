# ChromaDB 语义搜索工具 - 更新日志

## 2025-10-17 - 初始版本

### 🎉 新增功能

#### 1. 核心工具：`semantic_search.py`

一个功能完善的命令行工具，用于通过自然语言检索 ChromaDB 中的相似数据。

**主要特性：**
- ✅ 自然语言语义搜索
- ✅ 支持多种数据类型：messages（消息）、entities（实体）、webpages（网页）
- ✅ 支持跨用户、跨集合搜索
- ✅ 智能结果格式化（根据数据类型自动调整展示格式）
- ✅ 多种输出格式（文本/JSON）
- ✅ 结果导出功能
- ✅ 远程服务器连接支持
- ✅ 集合列表查看功能
- ✅ 灵活的命令行参数配置

**技术实现：**
- 使用 ChromaDB HttpClient 连接向量数据库
- 基于向量相似度的语义搜索
- 自动解析和格式化 JSON 元数据
- 支持批量处理多个集合
- 相关度计算（基于向量距离）
- 智能类型识别和格式化

#### 2. 配套文档

**a) README.md（更新）**
- 添加了详细的工具说明
- 包含使用示例和参数说明
- 提供了常见场景的命令示例

**b) SEMANTIC_SEARCH_GUIDE.md**
- 完整的使用指南（600+ 行）
- 包含：
  - 快速开始指南
  - 详细使用说明
  - 实用场景示例
  - 搜索技巧和最佳实践
  - 输出格式说明
  - 配置说明
  - 故障排除指南
  - 高级用法（批量搜索、脚本集成等）

**c) QUICK_REFERENCE.md**
- 快速参考卡片
- 常用命令速查表
- 参数速查表
- 实用场景速查
- 快速故障排除指南

**d) CHANGELOG_SEMANTIC_SEARCH.md**
- 本文档，记录工具的更新历史

#### 3. 示例和测试脚本

**a) semantic_search_examples.sh**
- 交互式示例演示脚本
- 展示 7 个常用场景
- 包含详细的说明和提示
- 自动检查环境配置

**b) test_semantic_search.py**
- 自动化测试脚本
- 测试核心功能：
  - 连接测试
  - 集合列表测试
  - 搜索功能测试
  - 结果格式化测试

### 📁 文件清单

```
tools/
├── semantic_search.py              # 主工具脚本（600+ 行）
├── semantic_search_examples.sh     # 示例演示脚本
├── test_semantic_search.py         # 测试脚本
├── README.md                        # 更新：添加工具说明
├── SEMANTIC_SEARCH_GUIDE.md        # 详细使用指南
├── QUICK_REFERENCE.md              # 快速参考
└── CHANGELOG_SEMANTIC_SEARCH.md    # 本文档
```

### 🎯 使用方法

#### 快速开始

```bash
# 1. 启动 ChromaDB 服务
docker-compose up -d

# 2. 激活虚拟环境
source venv/bin/activate

# 3. 查看帮助
python tools/semantic_search.py --help

# 4. 列出所有集合
python tools/semantic_search.py --list-collections

# 5. 执行搜索
python tools/semantic_search.py "项目进度更新"
```

#### 示例演示

```bash
# 运行交互式示例
./tools/semantic_search_examples.sh

# 运行测试
python tools/test_semantic_search.py
```

#### 查看文档

```bash
# 快速参考
cat tools/QUICK_REFERENCE.md

# 详细指南
cat tools/SEMANTIC_SEARCH_GUIDE.md

# 工具说明
cat tools/README.md
```

### 🔑 核心功能演示

#### 1. 按类型搜索

```bash
# 搜索消息
python tools/semantic_search.py "会议讨论" --type messages --limit 5

# 搜索实体
python tools/semantic_search.py "张三" --type entities --limit 5

# 搜索网页
python tools/semantic_search.py "技术文档" --type webpages --limit 5
```

#### 2. 指定集合搜索

```bash
# 搜索特定集合
python tools/semantic_search.py "前端开发" --collections esone.qiu-messages

# 搜索多个集合
python tools/semantic_search.py "API" --collections esone.qiu-messages esone.qiu-entities
```

#### 3. 输出控制

```bash
# JSON 格式输出
python tools/semantic_search.py "项目" --format json

# 保存到文件
python tools/semantic_search.py "项目" --output results.json

# 限制返回数量
python tools/semantic_search.py "项目" --limit 20
```

#### 4. 远程连接

```bash
# 连接生产环境
python tools/semantic_search.py "查询内容" --host 10.32.56.212 --port 8000
```

### 💡 特色功能

#### 1. 智能格式化

工具会自动识别数据类型并应用相应的格式化：

- **消息（Messages）**
  - 显示发送者、时间、团队
  - 显示摘要和完整内容
  - 提取并展示实体信息（人员、项目、主题）
  - 显示情感分析和优先级

- **实体（Entities）**
  - 显示名称、类型、描述
  - 显示属性列表
  - 显示关联数据统计
  - 显示创建和更新时间

- **网页（Webpages）**
  - 显示标题、URL、域名
  - 显示内容摘要
  - 显示分类和相关性
  - 显示提取的信息（项目、人员、标签）

#### 2. 相关度评分

每个搜索结果都包含相关度评分（0-100%），基于向量距离计算，帮助用户快速识别最相关的结果。

#### 3. 灵活的过滤和搜索

- 按数据类型过滤（messages/entities/webpages）
- 指定特定集合
- 跨集合搜索
- 跨用户搜索

#### 4. 多种输出格式

- **文本格式**：易读，适合人工查看
- **JSON 格式**：结构化，适合程序处理和分析

### 📊 性能和限制

**性能特点：**
- 使用 ChromaDB 的原生向量搜索，性能优异
- 支持并行查询多个集合
- 结果按相关度排序

**当前限制：**
- 需要 ChromaDB 服务运行
- 搜索速度取决于集合大小和数量
- 默认每个集合返回 10 条结果（可配置）

### 🛠️ 技术栈

- **Python 3.11+**
- **ChromaDB 1.1.1+**：向量数据库客户端
- **argparse**：命令行参数解析
- **json**：JSON 数据处理
- **datetime**：时间格式化

### 📝 代码质量

- ✅ 完整的文档字符串
- ✅ 类型提示（Type Hints）
- ✅ 错误处理和异常捕获
- ✅ 用户友好的错误消息
- ✅ 模块化设计
- ✅ 可测试的架构

### 🔮 未来计划

可能的增强功能：

1. **过滤和查询增强**
   - 支持时间范围过滤
   - 支持元数据条件过滤
   - 支持正则表达式匹配

2. **结果处理**
   - 结果去重
   - 结果聚合
   - 结果统计分析

3. **用户体验**
   - 交互式模式
   - 颜色输出（使用 rich 或 colorama）
   - 进度条显示

4. **高级功能**
   - 保存搜索历史
   - 搜索模板
   - 批量搜索配置文件

5. **集成**
   - Web API 接口
   - 与其他工具集成
   - 导出多种格式（CSV、Excel 等）

### 🙏 致谢

感谢 ChromaDB 团队提供优秀的向量数据库解决方案。

### 📞 反馈

如有问题或建议，请在项目中提交 Issue。

---

**版本**: 1.0.0  
**日期**: 2025-10-17  
**作者**: Esone Qiu  
**许可**: 遵循项目主许可证

