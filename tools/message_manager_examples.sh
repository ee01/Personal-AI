#!/bin/bash
# message_manager.py 使用示例脚本

echo "=================================================="
echo "📱 消息管理工具 (message_manager.py) 使用示例"
echo "=================================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 基础路径
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TOOL="python ${SCRIPT_DIR}/message_manager.py"

echo -e "${CYAN}提示: 按 Ctrl+C 可以随时退出${NC}"
echo ""

while true; do
    echo ""
    echo "请选择示例："
    echo "  1) 🎨 交互式模式（推荐新手）"
    echo "  2) 🔍 通过 ID 查找消息"
    echo "  3) 🧠 语义搜索消息"
    echo "  4) 🗑️  删除单条消息"
    echo "  5) 🗑️  批量删除消息"
    echo "  6) ✏️  编辑消息内容"
    echo "  7) ✏️  编辑消息元数据"
    echo "  8) 🔧 高级：组合过滤查询"
    echo "  9) 📚 查看帮助文档"
    echo "  0) 👋 退出"
    echo ""
    read -p "请输入选项 (0-9): " choice

    case $choice in
        1)
            echo ""
            echo -e "${GREEN}=== 示例 1: 交互式模式 ===${NC}"
            echo "这是最推荐的使用方式，提供友好的交互界面"
            echo ""
            read -p "输入用户名（留空则搜索所有用户，例如: esone.qiu）: " username
            if [ -z "$username" ]; then
                echo -e "${YELLOW}执行命令: $TOOL --interactive${NC}"
                $TOOL --interactive
            else
                echo -e "${YELLOW}执行命令: $TOOL -i --user $username${NC}"
                $TOOL -i --user "$username"
            fi
            ;;
        
        2)
            echo ""
            echo -e "${GREEN}=== 示例 2: 通过 ID 查找消息 ===${NC}"
            echo "如果你知道消息的确切 ID，这是最快的查找方式"
            echo ""
            read -p "输入消息 ID: " msg_id
            read -p "输入用户名（可选，例如: esone.qiu）: " username
            
            if [ -z "$msg_id" ]; then
                echo -e "${YELLOW}消息 ID 不能为空${NC}"
                continue
            fi
            
            if [ -z "$username" ]; then
                echo -e "${YELLOW}执行命令: $TOOL --id $msg_id${NC}"
                $TOOL --id "$msg_id"
            else
                echo -e "${YELLOW}执行命令: $TOOL --id $msg_id --user $username${NC}"
                $TOOL --id "$msg_id" --user "$username"
            fi
            ;;
        
        3)
            echo ""
            echo -e "${GREEN}=== 示例 3: 语义搜索消息 ===${NC}"
            echo "使用自然语言搜索相关消息"
            echo ""
            read -p "输入搜索查询（例如: 项目讨论）: " query
            read -p "输入用户名（可选，例如: esone.qiu）: " username
            read -p "返回结果数量（默认 10）: " limit
            
            if [ -z "$query" ]; then
                echo -e "${YELLOW}搜索查询不能为空${NC}"
                continue
            fi
            
            limit=${limit:-10}
            
            if [ -z "$username" ]; then
                echo -e "${YELLOW}执行命令: $TOOL --search \"$query\" --limit $limit${NC}"
                $TOOL --search "$query" --limit "$limit"
            else
                echo -e "${YELLOW}执行命令: $TOOL --search \"$query\" --user $username --limit $limit${NC}"
                $TOOL --search "$query" --user "$username" --limit "$limit"
            fi
            ;;
        
        4)
            echo ""
            echo -e "${GREEN}=== 示例 4: 删除单条消息 ===${NC}"
            echo "⚠️  删除操作不可逆，请谨慎操作！"
            echo ""
            read -p "选择查找方式 (1=ID, 2=搜索): " find_method
            
            if [ "$find_method" = "1" ]; then
                read -p "输入消息 ID: " msg_id
                if [ -z "$msg_id" ]; then
                    echo -e "${YELLOW}消息 ID 不能为空${NC}"
                    continue
                fi
                echo -e "${YELLOW}执行命令: $TOOL --id $msg_id --delete${NC}"
                $TOOL --id "$msg_id" --delete
            elif [ "$find_method" = "2" ]; then
                read -p "输入搜索查询: " query
                if [ -z "$query" ]; then
                    echo -e "${YELLOW}搜索查询不能为空${NC}"
                    continue
                fi
                echo -e "${YELLOW}执行命令: $TOOL --search \"$query\" --delete${NC}"
                $TOOL --search "$query" --delete
            else
                echo -e "${YELLOW}无效选项${NC}"
            fi
            ;;
        
        5)
            echo ""
            echo -e "${GREEN}=== 示例 5: 批量删除消息 ===${NC}"
            echo "⚠️  批量删除操作不可逆，请特别谨慎！"
            echo ""
            read -p "输入搜索查询（例如: 测试消息）: " query
            read -p "输入用户名（可选）: " username
            read -p "最多删除数量（默认 10）: " limit
            
            if [ -z "$query" ]; then
                echo -e "${YELLOW}搜索查询不能为空${NC}"
                continue
            fi
            
            limit=${limit:-10}
            
            echo ""
            echo -e "${YELLOW}⚠️  将批量删除匹配的消息，这个操作不可逆！${NC}"
            read -p "确认继续？(yes/no): " confirm
            
            if [ "$confirm" != "yes" ]; then
                echo "已取消操作"
                continue
            fi
            
            if [ -z "$username" ]; then
                echo -e "${YELLOW}执行命令: $TOOL --search \"$query\" --batch-delete --limit $limit${NC}"
                $TOOL --search "$query" --batch-delete --limit "$limit"
            else
                echo -e "${YELLOW}执行命令: $TOOL --search \"$query\" --user $username --batch-delete --limit $limit${NC}"
                $TOOL --search "$query" --user "$username" --batch-delete --limit "$limit"
            fi
            ;;
        
        6)
            echo ""
            echo -e "${GREEN}=== 示例 6: 编辑消息内容 ===${NC}"
            echo ""
            read -p "输入消息 ID: " msg_id
            if [ -z "$msg_id" ]; then
                echo -e "${YELLOW}消息 ID 不能为空${NC}"
                continue
            fi
            
            echo "输入新的消息内容（可以多行，输入 END 结束）："
            content=""
            while IFS= read -r line; do
                if [ "$line" = "END" ]; then
                    break
                fi
                content="${content}${line}\n"
            done
            
            echo -e "${YELLOW}执行命令: $TOOL --id $msg_id --edit --content \"$content\"${NC}"
            $TOOL --id "$msg_id" --edit --content "$content"
            ;;
        
        7)
            echo ""
            echo -e "${GREEN}=== 示例 7: 编辑消息元数据 ===${NC}"
            echo ""
            read -p "输入消息 ID: " msg_id
            if [ -z "$msg_id" ]; then
                echo -e "${YELLOW}消息 ID 不能为空${NC}"
                continue
            fi
            
            echo "输入新的元数据（JSON 格式，例如: {\"priority\": \"high\"}）："
            read -r metadata
            
            if [ -z "$metadata" ]; then
                echo -e "${YELLOW}元数据不能为空${NC}"
                continue
            fi
            
            echo -e "${YELLOW}执行命令: $TOOL --id $msg_id --edit --metadata '$metadata'${NC}"
            $TOOL --id "$msg_id" --edit --metadata "$metadata"
            ;;
        
        8)
            echo ""
            echo -e "${GREEN}=== 示例 8: 高级组合过滤 ===${NC}"
            echo "组合使用多个过滤条件进行精确查询"
            echo ""
            read -p "输入搜索查询: " query
            read -p "输入用户名（例如: esone.qiu）: " username
            echo "输入元数据过滤条件（JSON 格式，例如: {\"sender\": \"张三\"}）："
            read -r where_filter
            
            if [ -z "$query" ]; then
                echo -e "${YELLOW}搜索查询不能为空${NC}"
                continue
            fi
            
            cmd="$TOOL --search \"$query\""
            [ ! -z "$username" ] && cmd="$cmd --user $username"
            [ ! -z "$where_filter" ] && cmd="$cmd --where '$where_filter'"
            
            echo -e "${YELLOW}执行命令: $cmd${NC}"
            eval $cmd
            ;;
        
        9)
            echo ""
            echo -e "${GREEN}=== 查看帮助文档 ===${NC}"
            $TOOL --help
            ;;
        
        0)
            echo ""
            echo "👋 再见！"
            exit 0
            ;;
        
        *)
            echo -e "${YELLOW}无效选项，请重新选择${NC}"
            ;;
    esac
    
    echo ""
    read -p "按 Enter 继续..."
done
