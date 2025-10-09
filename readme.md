# Personal AI Chrome 插件

## Quick Installatioin

https://chromewebstore.google.com/detail/kefnadjndpllbibeklhajjddgmlbafel?authuser=0&hl=zh-CN

[More in wiki](https://wiki.ringcentral.com/display/XTO/Personal+AI+-+Tools)

## 主要功能

### AI 智能消息分析过滤功能
- **智能消息过滤**：基于自定义规则自动过滤重要消息
- **多模式分析**：支持智能Agent、Agent工作流和普通模式三种分析方式
- **上下文理解**：智能分析消息上下文，提供相关性和重要性评估
- **实体提取**：自动提取消息中的人物、项目、话题、行动项等实体信息
- **情感分析**：识别消息的情感倾向（积极/消极/中性）
- **智能通知**：根据消息重要性自动推送到指定渠道
- **消息存储**：将重要消息存储到向量数据库，支持后续检索和分析
- **回复建议**：基于消息上下文提供智能回复建议
- **定时分析**：支持定时任务自动分析新消息
- **进度跟踪**：实时显示分析进度和统计信息
- 详细文档：[docs/features/message_analysis_filter.md](docs/features/message_analysis_filter.md)

### Jira 设计链接显示功能
- 在 Jira ticket 页面自动显示相关的设计链接
- 支持从 Epic、Parent Link 和 Linked Issues 中查找 UX ticket 的设计链接
- 详细文档：[docs/features/jira_design_links.md](docs/features/jira_design_links.md)

### Jira 自动化规则导入功能
- 在 Jira 自动化管理页面添加导入功能
- 支持导入之前导出的自动化规则 JSON 文件
- 自动格式转换和 API 调用
- 详细文档：[docs/features/jira_automation_import.md](docs/features/jira_automation_import.md)

### Google Slides 分析功能
- AI 驱动的幻灯片内容分析
- 智能内容提取和总结
- 详细文档：[docs/features/google_slides_analyzer.md](docs/features/google_slides_analyzer.md)

### Agent 思维可视化
- 显示 AI 代理的思考过程
- 交互式思维流程图
- 详细文档：[docs/features/agent_thinking.md](docs/features/agent_thinking.md)

## 发布流程

1. 从 .env.example 创建 .env 文件以及内部的敏感字段清除
2. 替换 GOOGLE_CLIENT_ID 为正式 oauth client_id: 850492875483-kmbu6or52oi6lsnapoqklbs5fo94jplv.apps.googleusercontent.com
3. npm run build
5. 上传 personal-ai.zip 到 chrome store: https://chrome.google.com/webstore/devconsole/2ae6926c-357d-4b1b-b4fc-5313c4e19f24/kefnadjndpllbibeklhajjddgmlbafel/edit/package?pli=1

## 开发环境设置

1. 从 .env.example 创建 .env.development 配置
2. 替换 GOOGLE_CLIENT_ID: 850492875483-m5hdm6mtj068npvdl9r8sr51n9cijndg.apps.googleusercontent.com （配置测试设备：https://console.cloud.google.com/auth/clients?invt=AbuzdQ&project=sync-data-with-jira）

### 安装依赖
```bash
yarn install
```

### 启动 Chroma 向量数据库服务
有三种方式可以启动 Chroma 服务：

#### 方式一：使用便捷脚本（最推荐）
```bash
# 添加执行权限
chmod +x chroma.sh

# 启动服务
./chroma.sh start

# 查看服务状态
./chroma.sh status

# 查看服务日志
./chroma.sh logs

# 停止服务
./chroma.sh stop

# 查看帮助信息
./chroma.sh help
```

#### 方式二：使用 Docker Compose
```bash
# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 停止服务
docker-compose down
```

#### 方式三：直接使用 Docker 命令
```bash
docker run -d --name chroma-server \
  -p 8000:8000 \
  -v $PWD/chroma-data:/chroma/chroma \
  chromadb/chroma:latest
```

### 开发模式
```bash
yarn start
```
这将启动 webpack 的监视模式，自动重新编译代码变更。

### 构建生产版本
```bash
yarn build
```

### 安装 Chrome 插件

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 启用 `开发者模式`
3. 点击 `加载已解压的扩展程序`
4. 选择项目中的 `dist` 文件夹
5. 打开您想要使用插件的网页

## 数据备份

运行如下命令备份本地 chroma data 文件夹
```bash
tar -czf ./chroma-backup/chroma-backup-$(date +%Y%m%d).tar.gz ./chroma-data
```

### 迁移数据

从备份文件夹解压出chroma-data目录后，使用 migrate_chroma_via_http.py 脚本迁移恢复
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

python migrate_chroma_via_http.py
```
