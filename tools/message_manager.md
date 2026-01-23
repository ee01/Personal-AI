# 消息管理工具 (message_manager.py) - 完整说明

## 📋 概述

`message_manager.py` 是一个功能强大的 ChromaDB 消息管理工具，提供消息的查找、删除和编辑功能。

**核心亮点：**
- 🔍 **双重查找** - 支持通过 ID 精确查找或语义搜索
- 🗑️ **安全删除** - 单条或批量删除，带确认机制
- ✏️ **灵活编辑** - 修改消息内容和元数据
- 🎨 **交互模式** - 友好的命令行界面
- 🔧 **可选依赖** - 基础功能无需额外安装

## 🚀 快速开始

### 1. 最简单的方式 - 交互模式

```bash
# 启动交互模式
python tools/message_manager.py --interactive

# 或使用简写 + 指定用户
python tools/message_manager.py -i --user esone.qiu

# 或使用友好的示例脚本
bash tools/message_manager_examples.sh
```

### 2. 通过 ID 查找消息

```bash
# 基础查找
python tools/message_manager.py --id "msg-12345"

# 指定用户（更快）
python tools/message_manager.py --id "msg-12345" --user esone.qiu

# 查找并删除
python tools/message_manager.py --id "msg-12345" --delete

# 查找并编辑
python tools/message_manager.py --id "msg-12345" \
  --edit \
  --content "新内容"
```

### 3. 语义搜索消息（需要安装 sentence-transformers）

```bash
# 基础搜索
python tools/message_manager.py --search "项目讨论"

# 精确搜索
python tools/message_manager.py --search "会议纪要" \
  --user esone.qiu \
  --limit 20

# 搜索并删除
python tools/message_manager.py --search "测试消息" --batch-delete
```

## 📦 安装依赖

### 基础功能（通过 ID 查找）

```bash
# 只需要 chromadb
pip install chromadb
```

**可用功能：**
- ✅ 通过 ID 查找
- ✅ 删除消息
- ✅ 编辑元数据

### 完整功能（包括语义搜索）

```bash
# 安装完整依赖
pip install chromadb sentence-transformers
```

**新增功能：**
- ✅ 语义搜索
- ✅ 编辑内容（自动重新生成嵌入）
- ✅ 批量搜索和删除

详细安装说明请查看：[安装指南](./message_manager_install.md)

## 📚 文档导航

| 文档 | 说明 |
|------|------|
| [README.md](./README.md) | 工具集总览 |
| [message_manager_guide.md](./message_manager_guide.md) | 详细使用指南 |
| [message_manager_install.md](./message_manager_install.md) | 安装说明 |
| [message_manager_examples.sh](./message_manager_examples.sh) | 交互式示例脚本 |

## 🎯 常用命令速查

### 查找消息

```bash
# 通过 ID
python tools/message_manager.py --id MESSAGE_ID

# 语义搜索
python tools/message_manager.py --search "关键词"

# 组合过滤
python tools/message_manager.py --search "关键词" \
  --user esone.qiu \
  --where '{"sender": "张三"}' \
  --limit 20
```

### 删除消息

```bash
# 删除单条（通过 ID）
python tools/message_manager.py --id MESSAGE_ID --delete

# 批量删除（通过搜索）
python tools/message_manager.py --search "测试" --batch-delete --limit 50
```

### 编辑消息

```bash
# 编辑内容
python tools/message_manager.py --id MESSAGE_ID \
  --edit \
  --content "新内容"

# 编辑元数据
python tools/message_manager.py --id MESSAGE_ID \
  --edit \
  --metadata '{"priority": "high"}'

# 同时编辑内容和元数据
python tools/message_manager.py --id MESSAGE_ID \
  --edit \
  --content "新内容" \
  --metadata '{"updated": true}'
```

## 💡 使用场景示例

### 场景 1：清理测试消息

```bash
# 步骤 1: 预览
python tools/message_manager.py --search "测试" --limit 50

# 步骤 2: 确认后删除
python tools/message_manager.py --search "测试" --batch-delete --limit 50
```

### 场景 2：修正错误内容

```bash
# 找到错误的消息
python tools/message_manager.py --search "错误内容"

# 编辑修正
python tools/message_manager.py --id "msg-12345" \
  --edit \
  --content "正确的内容"
```

### 场景 3：批量更新优先级

```bash
# 使用交互模式逐个处理
python tools/message_manager.py -i --user esone.qiu
```

## ⚠️ 安全提示

**删除操作不可逆！** 请务必：

1. ✅ 先预览再删除
2. ✅ 使用精确过滤条件
3. ✅ 小批量操作
4. ✅ 生产环境谨慎操作
5. ❌ 避免使用 --no-confirm（除非在脚本中）

## 🔧 参数参考

### 核心参数

| 参数 | 简写 | 说明 |
|------|------|------|
| `--interactive` | `-i` | 交互模式（推荐） |
| `--id` | - | 消息 ID |
| `--search` | - | 语义搜索查询 |
| `--user` | `-u` | 用户名过滤 |
| `--limit` | `-n` | 结果数量 |
| `--where` | `-w` | 元数据过滤（JSON） |

### 操作参数

| 参数 | 说明 |
|------|------|
| `--delete` | 删除单条消息 |
| `--batch-delete` | 批量删除 |
| `--edit` | 编辑消息 |
| `--content` | 新的内容 |
| `--metadata` | 新的元数据（JSON） |
| `--no-confirm` | 跳过确认（危险！） |

完整参数列表：`python tools/message_manager.py --help`

## 📖 相关工具

- **semantic_search.py** - 语义搜索工具（本工具依赖）
- **query_conversations.py** - 会话数据分析
- **migrate_chroma_via_http.py** - 数据迁移

## 🐛 故障排除

### 连接失败

```bash
# 检查并启动 ChromaDB 服务
docker-compose up -d
```

### 缺少依赖

```bash
# 安装完整依赖
pip install chromadb sentence-transformers
```

### 找不到消息

```bash
# 不指定用户，搜索所有集合
python tools/message_manager.py --id MESSAGE_ID

# 或使用语义搜索
python tools/message_manager.py --search "部分内容"
```

更多问题请查看：[详细指南](./message_manager_guide.md)

## 📞 获取帮助

```bash
# 查看命令行帮助
python tools/message_manager.py --help

# 运行示例脚本
bash tools/message_manager_examples.sh

# 查看完整文档
cat tools/message_manager_guide.md
```

## 📝 版本信息

- **版本**: 1.0.0
- **创建日期**: 2026-01-22
- **最后更新**: 2026-01-22

## 👥 贡献

欢迎提出问题和建议！

---

**快速上手：**
```bash
# 1. 启动服务
docker-compose up -d

# 2. 运行交互模式
python tools/message_manager.py -i

# 3. 享受高效的消息管理！
```
