#!/bin/bash

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 显示帮助信息
show_help() {
  echo -e "${YELLOW}Chroma 服务管理脚本${NC}"
  echo "用法: ./chroma.sh [命令]"
  echo ""
  echo "命令:"
  echo "  start    启动 Chroma 服务"
  echo "  stop     停止 Chroma 服务"
  echo "  restart  重启 Chroma 服务"
  echo "  status   查看 Chroma 服务状态"
  echo "  logs     查看 Chroma 服务日志"
  echo "  help     显示帮助信息"
}

# 检查 Docker 是否安装
check_docker() {
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装。请先安装 Docker。${NC}"
    exit 1
  fi
  
  if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}错误: Docker Compose 未安装。请先安装 Docker Compose。${NC}"
    exit 1
  fi
}

# 启动服务
start_service() {
  echo -e "${YELLOW}正在启动 Chroma 服务...${NC}"
  docker-compose up -d
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Chroma 服务已成功启动！${NC}"
    echo -e "服务地址: ${GREEN}http://localhost:8000${NC}"
  else
    echo -e "${RED}启动 Chroma 服务失败。${NC}"
  fi
}

# 停止服务
stop_service() {
  echo -e "${YELLOW}正在停止 Chroma 服务...${NC}"
  docker-compose down
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Chroma 服务已停止。${NC}"
  else
    echo -e "${RED}停止 Chroma 服务失败。${NC}"
  fi
}

# 查看服务状态
check_status() {
  echo -e "${YELLOW}Chroma 服务状态:${NC}"
  docker-compose ps
}

# 查看服务日志
view_logs() {
  echo -e "${YELLOW}Chroma 服务日志:${NC}"
  docker-compose logs -f
}

# 重启服务
restart_service() {
  echo -e "${YELLOW}正在重启 Chroma 服务...${NC}"
  docker-compose down
  if [ $? -ne 0 ]; then
    echo -e "${RED}停止 Chroma 服务失败。${NC}"
    return 1
  fi
  
  docker-compose up -d
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Chroma 服务已成功重启！${NC}"
    echo -e "服务地址: ${GREEN}http://localhost:8000${NC}"
  else
    echo -e "${RED}启动 Chroma 服务失败。${NC}"
  fi
}

# 主函数
main() {
  check_docker
  
  case "$1" in
    start)
      start_service
      ;;
    stop)
      stop_service
      ;;
    restart)
      restart_service
      ;;
    status)
      check_status
      ;;
    logs)
      view_logs
      ;;
    help|*)
      show_help
      ;;
  esac
}

# 执行主函数
main "$@" 