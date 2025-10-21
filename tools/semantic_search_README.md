# 🔍 ChromaDB 语义搜索工具

> 使用自然语言检索 ChromaDB 向量数据库中的相似数据

---

## ✨ 特性

- 🧠 **语义搜索**：基于向量相似度的智能搜索，不是简单的关键词匹配
- 📊 **多类型支持**：messages（消息）、entities（实体）、webpages（网页）
- 🌐 **跨集合搜索**：同时搜索多个用户、多个集合
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

## 📚 快速链接

| 文档 | 说明 |
|------|------|
| [⚡ 快速参考](./QUICK_REFERENCE.md) | 常用命令速查表，最快找到你需要的命令 |
| [📖 详细指南](./SEMANTIC_SEARCH_GUIDE.md) | 完整的使用说明、场景示例、故障排除 |
| [🎬 示例脚本](./semantic_search_examples.sh) | 交互式演示，看看工具能做什么 |
| [🧪 测试脚本](./test_semantic_search.py) | 测试工具是否正常工作 |
| [📝 更新日志](./CHANGELOG_SEMANTIC_SEARCH.md) | 版本历史和功能说明 |

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

---

## 🎯 核心命令

```bash
# 基础搜索
python tools/semantic_search.py "查询内容"

# 指定类型
python tools/semantic_search.py "查询内容" --type messages|entities|webpages

# 限制数量
python tools/semantic_search.py "查询内容" --limit 20

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
A: 使用 `--collections` 参数指定用户的集合，如 `esone.qiu-messages`。

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

**准备好了吗？开始搜索吧！** 🚀

```bash
python tools/semantic_search.py "你想搜索什么？"
```

