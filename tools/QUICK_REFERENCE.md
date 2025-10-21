# 语义搜索工具 - 快速参考

## 🚀 快速启动

```bash
# 1. 启动服务
docker-compose up -d

# 2. 激活环境
source venv/bin/activate

# 3. 开始搜索
python tools/semantic_search.py "你的查询"
```

## 📋 常用命令

### 基础操作

```bash
# 查看帮助
python tools/semantic_search.py --help

# 列出所有集合
python tools/semantic_search.py --list-collections

# 基础搜索
python tools/semantic_search.py "项目进度"
```

### 按类型搜索

```bash
# 搜索消息
python tools/semantic_search.py "会议讨论" --type messages

# 搜索实体
python tools/semantic_search.py "张三" --type entities

# 搜索网页
python tools/semantic_search.py "技术文档" --type webpages
```

### 控制输出

```bash
# 限制结果数量
python tools/semantic_search.py "API" --limit 5

# JSON 格式
python tools/semantic_search.py "API" --format json

# 保存到文件
python tools/semantic_search.py "项目" --output results.json
```

### 指定集合

```bash
# 搜索特定集合
python tools/semantic_search.py "查询" --collections esone.qiu-messages

# 搜索多个集合
python tools/semantic_search.py "查询" --collections esone.qiu-messages esone.qiu-entities
```

### 远程服务器

```bash
# 连接生产环境
python tools/semantic_search.py "查询" --host 10.32.56.212 --port 8000
```

## 🎯 实用场景

| 场景 | 命令 |
|------|------|
| 查找某人的信息 | `python tools/semantic_search.py "张三" --type entities` |
| 查找项目讨论 | `python tools/semantic_search.py "AI项目" --type messages --limit 15` |
| 查找技术文档 | `python tools/semantic_search.py "React" --type webpages` |
| 查找会议记录 | `python tools/semantic_search.py "周会" --type messages` |
| 导出分析数据 | `python tools/semantic_search.py "Q4目标" --output q4.json` |

## ⚡ 快捷脚本

### 一键测试

```bash
# 运行交互式示例
./tools/semantic_search_examples.sh

# 运行自动化测试
python tools/test_semantic_search.py
```

### 批量搜索

```bash
# 创建批量搜索脚本
cat > batch_search.sh << 'EOF'
#!/bin/bash
for query in "前端" "后端" "测试" "设计"; do
  python tools/semantic_search.py "$query" --output "${query}.json"
done
EOF
chmod +x batch_search.sh
./batch_search.sh
```

## 🔧 参数速查

| 参数 | 简写 | 说明 | 示例 |
|------|------|------|------|
| `query` | - | 查询内容（必需） | `"项目进度"` |
| `--type` | `-t` | 数据类型 | `messages`, `entities`, `webpages` |
| `--collections` | `-c` | 指定集合 | `esone.qiu-messages` |
| `--limit` | `-n` | 结果数量 | `10` |
| `--format` | `-f` | 输出格式 | `text`, `json` |
| `--output` | `-o` | 保存文件 | `results.json` |
| `--host` | - | 服务器地址 | `localhost`, `10.32.56.212` |
| `--port` | - | 服务器端口 | `8000` |
| `--list-collections` | - | 列出集合 | - |

## 💡 搜索技巧

✅ **好的查询**
- "React 组件优化方案"
- "张三负责的前端项目"
- "数据库索引设计讨论"

❌ **不好的查询**
- "React"（太宽泛）
- "讨论"（缺少上下文）
- "项目"（不够具体）

## 🐛 快速故障排除

| 问题 | 解决方法 |
|------|----------|
| 连接失败 | `docker-compose up -d` |
| 没有结果 | 使用更宽泛的查询词 |
| Python 错误 | `source venv/bin/activate` |
| 导入错误 | `pip install -r requirements.txt` |

## 📚 完整文档

- 📖 [详细使用指南](./SEMANTIC_SEARCH_GUIDE.md)
- 📝 [工具目录 README](./README.md)
- 🎬 [示例脚本](./semantic_search_examples.sh)
- 🧪 [测试脚本](./test_semantic_search.py)

## 🆘 获取帮助

```bash
# 查看完整帮助
python tools/semantic_search.py --help

# 查看项目文档
cat tools/README.md
cat tools/SEMANTIC_SEARCH_GUIDE.md
```

