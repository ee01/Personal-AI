#!/bin/bash
# semantic_search_examples.sh - ChromaDB 语义搜索工具示例脚本
#
# 这个脚本演示了 semantic_search.py 的各种使用方法
# 使用前请确保：
# 1. ChromaDB 服务正在运行: docker-compose up -d
# 2. Python 虚拟环境已激活: source venv/bin/activate

set -e  # 遇到错误立即退出

echo "======================================"
echo "ChromaDB 语义搜索工具 - 使用示例"
echo "======================================"
echo ""

# 检查虚拟环境
if [[ -z "$VIRTUAL_ENV" ]]; then
    echo "⚠️  警告: 虚拟环境未激活"
    echo "请先运行: source venv/bin/activate"
    echo ""
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 工具路径
TOOL="python tools/semantic_search.py"

echo "示例 1: 列出所有可用集合"
echo "命令: $TOOL --list-collections"
echo "--------------------------------------"
$TOOL --list-collections
echo ""
echo "按 Enter 继续..."
read

echo ""
echo "示例 2: 基础搜索 - 搜索所有类型"
echo "命令: $TOOL \"项目进度\" --limit 3"
echo "--------------------------------------"
$TOOL "项目进度" --limit 3
echo ""
echo "按 Enter 继续..."
read

echo ""
echo "示例 3: 按类型搜索 - 只搜索消息"
echo "命令: $TOOL \"会议讨论\" --type messages --limit 3"
echo "--------------------------------------"
$TOOL "会议讨论" --type messages --limit 3
echo ""
echo "按 Enter 继续..."
read

echo ""
echo "示例 4: 按类型搜索 - 只搜索实体"
echo "命令: $TOOL \"前端开发\" --type entities --limit 3"
echo "--------------------------------------"
$TOOL "前端开发" --type entities --limit 3
echo ""
echo "按 Enter 继续..."
read

echo ""
echo "示例 5: 按类型搜索 - 只搜索网页"
echo "命令: $TOOL \"技术文档\" --type webpages --limit 3"
echo "--------------------------------------"
$TOOL "技术文档" --type webpages --limit 3
echo ""
echo "按 Enter 继续..."
read

echo ""
echo "示例 6: JSON 格式输出"
echo "命令: $TOOL \"API\" --type messages --limit 2 --format json"
echo "--------------------------------------"
$TOOL "API" --type messages --limit 2 --format json
echo ""
echo "按 Enter 继续..."
read

echo ""
echo "示例 7: 保存结果到文件"
OUTPUT_FILE="/tmp/search_results_$(date +%Y%m%d_%H%M%S).json"
echo "命令: $TOOL \"数据库\" --limit 5 --format json --output $OUTPUT_FILE"
echo "--------------------------------------"
$TOOL "数据库" --limit 5 --format json --output "$OUTPUT_FILE"
if [ -f "$OUTPUT_FILE" ]; then
    echo ""
    echo "✅ 结果已保存到: $OUTPUT_FILE"
    echo "文件大小: $(ls -lh "$OUTPUT_FILE" | awk '{print $5}')"
    echo ""
    echo "预览前 20 行:"
    head -n 20 "$OUTPUT_FILE"
fi
echo ""
echo "按 Enter 继续..."
read

echo ""
echo "======================================"
echo "✅ 所有示例运行完成！"
echo "======================================"
echo ""
echo "更多使用方法请参考:"
echo "  - 帮助文档: $TOOL --help"
echo "  - 详细指南: tools/SEMANTIC_SEARCH_GUIDE.md"
echo "  - 工具文档: tools/README.md"
echo ""

