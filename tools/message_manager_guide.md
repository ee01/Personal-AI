# 消息管理工具 (message_manager.py) 使用指南

## 概述

`message_manager.py` 是一个强大的 ChromaDB 消息管理工具，提供消息的查找、删除和编辑功能。它集成了 `semantic_search.py` 的语义搜索能力，同时支持通过消息 ID 进行精确查找。

## 核心功能

- 🔍 **精确查找** - 通过 messageId 直接定位消息
- 🧠 **智能搜索** - 使用自然语言语义搜索消息
- 🗑️ **安全删除** - 支持单条或批量删除，带确认机制
- ✏️ **灵活编辑** - 修改消息内容、元数据或两者
- 🎨 **交互模式** - 友好的命令行交互界面
- 🔒 **确认保护** - 所有危险操作都需要用户确认

## 快速开始

### 1. 环境准备

```bash
# 激活虚拟环境
source venv/bin/activate

# 确保 ChromaDB 服务运行中
docker-compose up -d

# 安装依赖（如果还没安装）
pip install chromadb sentence-transformers
```

### 2. 交互式模式（推荐）

最简单的使用方式：

```bash
# 基础交互模式
python tools/message_manager.py --interactive

# 或使用简写
python tools/message_manager.py -i

# 指定用户
python tools/message_manager.py -i --user esone.qiu

# 使用示例脚本（更友好）
bash tools/message_manager_examples.sh
```

### 3. 命令行模式

适合脚本自动化：

```bash
# 查找消息
python tools/message_manager.py --id MESSAGE_ID
python tools/message_manager.py --search "关键词"

# 删除消息
python tools/message_manager.py --id MESSAGE_ID --delete
python tools/message_manager.py --search "垃圾消息" --batch-delete

# 编辑消息
python tools/message_manager.py --id MESSAGE_ID --edit --content "新内容"
```

## 详细功能

### 一、查找消息

#### 1.1 通过 ID 查找

最快速、最精确的查找方式：

```bash
# 基础查找
python tools/message_manager.py --id "msg-12345"

# 指定用户（提升查找速度）
python tools/message_manager.py --id "msg-12345" --user esone.qiu

# 查找后显示详细信息
python tools/message_manager.py --id "msg-12345" --user esone.qiu
```

**适用场景：**
- 知道确切的消息 ID
- 需要快速定位特定消息
- 从其他工具获取到 ID 后的精确查找

#### 1.2 语义搜索查找

使用自然语言描述来查找相关消息：

```bash
# 基础搜索
python tools/message_manager.py --search "项目进度讨论"

# 限制用户范围
python tools/message_manager.py --search "会议纪要" --user esone.qiu

# 控制返回数量
python tools/message_manager.py --search "技术方案" --limit 20

# 元数据过滤
python tools/message_manager.py --search "讨论" \
  --where '{"sender": "张三"}'

# 组合过滤（最精确）
python tools/message_manager.py --search "API 设计" \
  --user esone.qiu \
  --where '{"teamName": "研发部"}' \
  --limit 15
```

**适用场景：**
- 不知道确切 ID，但知道消息内容
- 需要批量查找相似消息
- 根据语义相关性查找

### 二、删除消息

⚠️ **警告：删除操作不可逆，请谨慎操作！**

#### 2.1 删除单条消息

```bash
# 通过 ID 删除（会提示确认）
python tools/message_manager.py --id "msg-12345" --delete

# 通过搜索删除（如果找到多条，会提示使用 batch-delete）
python tools/message_manager.py --search "测试消息" --delete

# 指定用户
python tools/message_manager.py --id "msg-12345" --user esone.qiu --delete

# 跳过确认（危险！仅用于自动化脚本）
python tools/message_manager.py --id "msg-12345" --delete --no-confirm
```

**删除流程：**
1. 工具会显示消息的完整信息
2. 提示用户确认删除
3. 用户输入 'yes' 或 'y' 确认
4. 执行删除操作
5. 显示删除结果

#### 2.2 批量删除消息

```bash
# 先预览要删除的消息
python tools/message_manager.py --search "垃圾消息" --limit 50

# 确认后批量删除
python tools/message_manager.py --search "垃圾消息" --batch-delete --limit 50

# 组合条件批量删除
python tools/message_manager.py --search "测试" \
  --user esone.qiu \
  --where '{"sender": "测试机器人"}' \
  --batch-delete \
  --limit 100

# 批量删除特定团队的消息
python tools/message_manager.py --search "通知" \
  --where '{"teamName": "测试团队"}' \
  --batch-delete
```

**最佳实践：**

1. **先预览，后删除**
   ```bash
   # 第一步：预览
   python tools/message_manager.py --search "要删除的" --limit 50
   
   # 第二步：确认无误后删除
   python tools/message_manager.py --search "要删除的" --batch-delete --limit 50
   ```

2. **使用精确过滤**
   ```bash
   # 避免：范围太广
   python tools/message_manager.py --search "消息" --batch-delete
   
   # 推荐：精确过滤
   python tools/message_manager.py --search "消息" \
     --user esone.qiu \
     --where '{"sender": "特定发送者", "teamName": "特定团队"}' \
     --batch-delete
   ```

3. **小批量操作**
   ```bash
   # 避免：一次性删除大量消息
   python tools/message_manager.py --search "测试" --batch-delete --limit 1000
   
   # 推荐：分批删除
   python tools/message_manager.py --search "测试" --batch-delete --limit 50
   # 检查结果后再继续下一批
   ```

### 三、编辑消息

#### 3.1 编辑消息内容

```bash
# 基础编辑
python tools/message_manager.py --id "msg-12345" \
  --edit \
  --content "这是修改后的消息内容"

# 编辑多行内容（使用引号）
python tools/message_manager.py --id "msg-12345" \
  --edit \
  --content "第一行内容
第二行内容
第三行内容"

# 指定用户（提升速度）
python tools/message_manager.py --id "msg-12345" \
  --user esone.qiu \
  --edit \
  --content "新内容"
```

**注意事项：**
- 编辑内容时会自动重新生成嵌入向量
- 这确保语义搜索仍能正确找到该消息
- 元数据不变（除非同时使用 --metadata）

#### 3.2 编辑消息元数据

```bash
# 更新单个字段
python tools/message_manager.py --id "msg-12345" \
  --edit \
  --metadata '{"priority": "high"}'

# 更新多个字段
python tools/message_manager.py --id "msg-12345" \
  --edit \
  --metadata '{"priority": "high", "status": "urgent", "tags": ["重要"]}'

# 修改发送者信息
python tools/message_manager.py --id "msg-12345" \
  --edit \
  --metadata '{"sender": "新发送者", "senderName": "张三"}'
```

**元数据合并规则：**
- 新元数据会与现有元数据合并
- 相同的键会被新值覆盖
- 不存在的键会被添加
- 未指定的键保持不变

#### 3.3 同时编辑内容和元数据

```bash
python tools/message_manager.py --id "msg-12345" \
  --edit \
  --content "新的消息内容" \
  --metadata '{"updated": true, "lastModified": "2026-01-22"}'
```

### 四、高级用法

#### 4.1 组合过滤查询

```bash
# 查找特定发送者在特定团队的消息
python tools/message_manager.py --search "项目" \
  --user esone.qiu \
  --where '{"sender": "张三", "teamName": "研发部"}'

# 使用 $in 操作符搜索多个值
python tools/message_manager.py --search "讨论" \
  --where '{"sender": {"$in": ["张三", "李四", "王五"]}}'

# 使用 $nin 操作符排除特定值
python tools/message_manager.py --search "通知" \
  --where '{"sender": {"$nin": ["机器人", "系统"]}}'

# 复杂组合条件
python tools/message_manager.py --search "重要" \
  --user esone.qiu \
  --where '{
    "priority": "high",
    "sender": {"$in": ["张三", "李四"]},
    "teamName": "研发部"
  }' \
  --limit 30
```

#### 4.2 自动化脚本

创建自动化清理脚本：

```bash
#!/bin/bash
# cleanup_test_messages.sh

# 删除测试消息
python tools/message_manager.py \
  --search "测试消息" \
  --user esone.qiu \
  --where '{"sender": "测试机器人"}' \
  --batch-delete \
  --no-confirm \
  --limit 100

# 删除过期消息
python tools/message_manager.py \
  --search "临时" \
  --user esone.qiu \
  --where '{"tags": ["temporary"]}' \
  --batch-delete \
  --no-confirm \
  --limit 50

echo "清理完成！"
```

⚠️ **警告：** 使用 `--no-confirm` 时要格外小心，建议先在测试环境验证。

#### 4.3 连接到不同服务器

```bash
# 连接到本地服务器
python tools/message_manager.py \
  --host localhost \
  --port 8000 \
  --search "测试"

# 连接到生产服务器
python tools/message_manager.py \
  --host 10.32.56.212 \
  --port 8000 \
  --search "项目"

# 连接到自定义服务器
python tools/message_manager.py \
  --host 192.168.1.100 \
  --port 8080 \
  --user esone.qiu \
  --interactive
```

## 交互式模式详解

交互式模式提供最友好的操作体验：

### 启动交互模式

```bash
python tools/message_manager.py -i
```

### 主菜单

```
请选择操作：
  1. 通过 ID 查找消息
  2. 语义搜索消息
  3. 退出
```

### 操作流程

1. **选择查找方式**
   - 方式 1：通过 ID（如果知道确切 ID）
   - 方式 2：语义搜索（根据内容搜索）

2. **查看消息详情**
   - 工具会显示消息的完整信息
   - 包括内容、元数据、实体等

3. **选择操作**
   ```
   请选择操作：
     1. 删除此消息
     2. 编辑此消息
     3. 返回
   ```

4. **执行操作**
   - 删除：确认后执行删除
   - 编辑：可以修改内容和/或元数据
   - 返回：返回主菜单

### 交互模式优势

✅ **用户友好**
- 清晰的提示信息
- 逐步引导操作
- 实时反馈

✅ **更安全**
- 每一步都可以取消
- 预览后再操作
- 多重确认机制

✅ **适合探索**
- 适合不熟悉命令行的用户
- 适合需要反复操作的场景
- 适合学习工具功能

## 参数参考

### 查找参数

| 参数 | 简写 | 类型 | 说明 | 示例 |
|------|------|------|------|------|
| `--id` | - | string | 消息 ID | `--id "msg-12345"` |
| `--search` | - | string | 语义搜索查询 | `--search "项目讨论"` |
| `--user` | `-u` | string | 用户名过滤 | `-u esone.qiu` |
| `--limit` | `-n` | number | 搜索结果数量 | `-n 20` |
| `--where` | `-w` | JSON | 元数据过滤条件 | `-w '{"sender": "张三"}'` |

### 操作参数

| 参数 | 说明 | 用途 |
|------|------|------|
| `--delete` | 删除单条消息 | 与 --id 或 --search 配合使用 |
| `--batch-delete` | 批量删除消息 | 只能与 --search 配合使用 |
| `--edit` | 编辑消息 | 需配合 --content 或 --metadata |
| `--content` | 新的消息内容 | 与 --edit 配合使用 |
| `--metadata` | 新的元数据（JSON） | 与 --edit 配合使用 |
| `--no-confirm` | 跳过确认提示 | 用于自动化脚本，危险！ |

### 系统参数

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--interactive` | `-i` | - | 启动交互模式 |
| `--host` | - | `10.32.56.212` | ChromaDB 服务器地址 |
| `--port` | - | `8000` | ChromaDB 服务器端口 |
| `--help` | `-h` | - | 显示帮助信息 |

## 常见场景

### 场景 1：清理测试消息

```bash
# 步骤 1: 先预览要删除的消息
python tools/message_manager.py --search "测试" --limit 50

# 步骤 2: 确认后删除
python tools/message_manager.py --search "测试" --batch-delete --limit 50
```

### 场景 2：修正错误消息

```bash
# 找到错误的消息
python tools/message_manager.py --search "错误内容"

# 获取消息 ID 后修正
python tools/message_manager.py --id "msg-12345" \
  --edit \
  --content "正确的内容"
```

### 场景 3：批量更新优先级

```bash
# 搜索需要更新的消息
python tools/message_manager.py --search "紧急" --limit 10

# 逐个更新优先级（使用交互模式更方便）
python tools/message_manager.py -i
```

### 场景 4：删除特定用户的所有消息

```bash
# 先统计数量
python tools/message_manager.py --search "" \
  --where '{"sender": "离职员工"}' \
  --limit 100

# 分批删除
python tools/message_manager.py --search "" \
  --where '{"sender": "离职员工"}' \
  --batch-delete \
  --limit 50
```

### 场景 5：数据迁移前的清理

```bash
# 删除所有测试数据
python tools/message_manager.py --search "测试" \
  --user test.user \
  --batch-delete \
  --limit 1000

# 删除所有临时数据
python tools/message_manager.py --search "" \
  --where '{"tags": ["temporary", "temp", "test"]}' \
  --batch-delete
```

## 故障排除

### 问题 1：连接失败

```
❌ 连接失败: [Errno 61] Connection refused
```

**解决方案：**
```bash
# 检查 ChromaDB 服务是否运行
docker-compose ps

# 启动服务
docker-compose up -d

# 检查服务日志
docker-compose logs chromadb
```

### 问题 2：找不到消息

```
❌ 未找到消息 ID: msg-12345
```

**可能原因：**
1. 消息 ID 错误
2. 消息在其他用户的集合中
3. 消息已被删除

**解决方案：**
```bash
# 不指定用户，搜索所有集合
python tools/message_manager.py --id "msg-12345"

# 使用语义搜索代替
python tools/message_manager.py --search "消息部分内容"
```

### 问题 3：嵌入模型加载失败

```
❌ 加载嵌入模型失败
```

**解决方案：**
```bash
# 安装 sentence-transformers
pip install sentence-transformers

# 或安装所有依赖
pip install -r requirements.txt
```

### 问题 4：JSON 格式错误

```
❌ where 参数 JSON 格式错误
```

**解决方案：**
```bash
# 确保使用正确的 JSON 格式
# 错误示例
--where {sender: "张三"}

# 正确示例
--where '{"sender": "张三"}'

# 使用单引号包裹整个 JSON
--where '{"key": "value", "nested": {"key2": "value2"}}'
```

## 最佳实践

### 1. 安全操作

✅ **推荐做法：**
- 删除前先预览
- 使用精确过滤条件
- 小批量操作
- 生产环境谨慎操作

❌ **避免做法：**
- 直接使用 --no-confirm
- 范围过大的批量删除
- 不预览直接删除

### 2. 性能优化

✅ **推荐做法：**
- 指定 --user 参数（减少搜索范围）
- 使用合理的 --limit（避免返回过多结果）
- 使用 --where 精确过滤

❌ **避免做法：**
- 不指定任何过滤条件
- 设置过大的 limit
- 频繁的全量搜索

### 3. 工作流程

**推荐工作流程：**

1. **探索阶段** - 使用交互模式
   ```bash
   python tools/message_manager.py -i --user esone.qiu
   ```

2. **确定操作** - 使用命令行模式预览
   ```bash
   python tools/message_manager.py --search "关键词" --limit 10
   ```

3. **批量操作** - 使用脚本自动化
   ```bash
   bash cleanup_script.sh
   ```

### 4. 数据备份

在执行大量删除操作前，建议：

```bash
# 1. 导出要删除的消息（用于备份）
python tools/semantic_search.py "要删除的内容" \
  --output backup_$(date +%Y%m%d).json

# 2. 执行删除
python tools/message_manager.py --search "要删除的内容" --batch-delete

# 3. 验证结果
python tools/semantic_search.py "要删除的内容"
```

## 相关工具

- **semantic_search.py** - 语义搜索工具（message_manager 依赖此工具）
- **query_conversations.py** - 会话数据分析工具
- **migrate_chroma_via_http.py** - 数据迁移工具

## 技术细节

### 嵌入向量更新

当编辑消息内容时，工具会：
1. 使用 `sentence-transformers/all-MiniLM-L6-v2` 模型
2. 为新内容生成嵌入向量
3. 更新到 ChromaDB 中
4. 确保语义搜索仍能找到该消息

### 元数据合并

编辑元数据时：
```python
# 现有元数据
old_metadata = {"sender": "张三", "priority": "low", "tags": ["work"]}

# 新元数据
new_metadata = {"priority": "high", "status": "urgent"}

# 合并后的元数据
merged_metadata = {"sender": "张三", "priority": "high", "tags": ["work"], "status": "urgent"}
```

### 批量操作

批量删除时按顺序处理：
```python
for message in messages:
    try:
        delete_message(message)
        success_count += 1
    except:
        error_count += 1
```

## 获取帮助

```bash
# 查看命令行帮助
python tools/message_manager.py --help

# 运行交互式示例
bash tools/message_manager_examples.sh

# 查看详细文档
cat tools/message_manager_guide.md
```

## 许可证

本工具是 personal-ai 项目的一部分，遵循项目的许可证。

## 更新日志

- **2026-01-22** - 初始版本发布
  - 支持通过 ID 和语义搜索查找消息
  - 支持删除和编辑消息
  - 提供交互式模式
  - 集成 semantic_search.py
