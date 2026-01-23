# 消息管理工具 - 安装指南

## 快速开始

### 1. 基础功能（通过 ID 查找）

如果你只需要通过消息 ID 查找和管理消息，不需要安装额外依赖：

```bash
# 直接使用
python tools/message_manager.py --id MESSAGE_ID --user esone.qiu
```

### 2. 完整功能（包括语义搜索）

如果需要使用语义搜索功能，需要安装额外依赖。

#### 方式 1：使用 pip 安装（推荐）

```bash
# 安装 sentence-transformers
pip install sentence-transformers

# 验证安装
python -c "import sentence_transformers; print('✅ 安装成功')"
```

#### 方式 2：使用虚拟环境

```bash
# 创建虚拟环境（如果还没有）
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install sentence-transformers chromadb

# 验证安装
python tools/message_manager.py --help
```

#### 方式 3：从 requirements.txt 安装

如果项目中有 requirements.txt：

```bash
pip install -r requirements.txt
```

## 依赖说明

### 必需依赖

- **chromadb** - ChromaDB 客户端库
  - 用途：连接 ChromaDB 服务，执行数据操作
  - 安装：`pip install chromadb`

### 可选依赖

- **sentence-transformers** - 语义嵌入模型
  - 用途：生成文本嵌入向量，支持语义搜索和编辑功能
  - 安装：`pip install sentence-transformers`
  - 说明：如果不安装，仍可使用通过 ID 查找和删除功能

## 功能对照表

| 功能 | 需要的依赖 | 说明 |
|------|-----------|------|
| 通过 ID 查找消息 | chromadb | ✅ 基础功能 |
| 删除消息（通过 ID） | chromadb | ✅ 基础功能 |
| 编辑元数据 | chromadb | ✅ 基础功能 |
| 语义搜索消息 | chromadb + sentence-transformers | ⭐ 高级功能 |
| 编辑消息内容 | chromadb + sentence-transformers | ⭐ 高级功能（需要重新生成嵌入） |
| 批量操作 | chromadb (+ sentence-transformers 用于搜索) | ⭐ 高级功能 |

## 安装验证

### 1. 检查基础功能

```bash
python tools/message_manager.py --help
```

**期望输出：**
- 如果缺少 sentence-transformers，会看到警告信息
- 帮助信息正常显示
- 可以使用通过 ID 查找功能

### 2. 检查完整功能

```bash
# 测试语义搜索
python tools/message_manager.py --search "测试" --limit 5
```

**期望输出：**
- 如果成功：显示搜索结果
- 如果失败：提示安装 sentence-transformers

### 3. 测试连接

```bash
# 确保 ChromaDB 服务运行
docker-compose up -d

# 测试连接
python tools/message_manager.py -i
```

## 常见问题

### Q1: 提示 "No module named 'sentence_transformers'"

**解决方案：**
```bash
pip install sentence-transformers
```

### Q2: 提示 "No module named 'chromadb'"

**解决方案：**
```bash
pip install chromadb
```

### Q3: sentence-transformers 安装很慢

**原因：** 该包较大（包含深度学习模型）

**解决方案：**
1. 使用国内镜像源：
   ```bash
   pip install -i https://pypi.tuna.tsinghua.edu.cn/simple sentence-transformers
   ```

2. 或者耐心等待（首次安装需要下载模型文件）

### Q4: 能不能在没有 sentence-transformers 的情况下编辑消息内容？

**回答：** 可以，但有限制：
- 消息内容会被更新
- 但不会重新生成嵌入向量
- 这意味着语义搜索可能无法找到该消息
- 工具会显示警告信息

**建议：** 如果需要编辑消息内容，建议安装 sentence-transformers

### Q5: 模型文件存储在哪里？

**回答：** sentence-transformers 会自动下载并缓存模型：
- macOS/Linux: `~/.cache/huggingface/`
- Windows: `C:\Users\<用户名>\.cache\huggingface\`

第一次运行时会下载模型（约 90MB），之后会使用缓存。

## 最小依赖安装

如果你只需要基础功能（通过 ID 管理消息），可以只安装：

```bash
pip install chromadb
```

这样可以：
- ✅ 通过 ID 查找消息
- ✅ 删除消息
- ✅ 编辑元数据
- ❌ 无法使用语义搜索
- ❌ 编辑内容时无法重新生成嵌入

## 完整依赖安装

如果需要所有功能：

```bash
pip install chromadb sentence-transformers
```

这样可以使用所有功能，包括语义搜索和完整的编辑功能。

## 环境要求

- Python 3.8 或更高版本
- pip (Python 包管理器)
- 足够的磁盘空间（约 500MB 用于模型缓存）

## 获取帮助

如果遇到其他安装问题：

1. 查看错误信息
2. 检查 Python 版本：`python --version`
3. 更新 pip：`pip install --upgrade pip`
4. 查看工具文档：`cat tools/message_manager_guide.md`
