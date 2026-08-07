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
4. 上传 personal-ai.zip 到 chrome store: https://chrome.google.com/webstore/devconsole/2ae6926c-357d-4b1b-b4fc-5313c4e19f24/kefnadjndpllbibeklhajjddgmlbafel/edit/package?pli=1

## Desktop App 记忆流

### 用户主流程

v2 中，`Personal AI.app` 是唯一配置中心。Chrome extension 里的 Desktop App 页面只负责安装引导和状态摘要。

最终用户主流程：

1. 从 GitHub Release 下载 `Personal-AI-Desktop-<version>-Installer.pkg`
2. 安装后打开 `/Applications/Personal AI.app`
3. 在 app 内依次完成：
   - 连接 Memory Service
   - 登录豆包
   - 创建/修复长期记忆线程
   - 绑定手机版对话
   - 开启自动同步
   - 视需要检查 explorer 来源状态
4. 看到 app 提示“现在已经可以自动推送记忆”后，关闭窗口即可

行为说明：

- 默认本地服务固定运行在 `http://127.0.0.1:46321`
- 普通用户不需要配置本机服务地址和 token
- 关闭窗口后 app 会继续后台运行
- `Cmd+Q` 不会停止同步；真正停止请在 app 内点击“停止后台并退出”
- GitHub Release 面向用户只发布 `.pkg` 安装包，不额外暴露 `.app` 调试产物
- Desktop App 同时负责把记忆推送到豆包，以及把 explorer 输入链路整理后的内容写回 Memory Service

### 开发与发布

初始化本地开发：

```bash
cd desktop-app
npm install
npx playwright install chromium
```

本地调试 app：

```bash
npm --prefix desktop-app run app:dev
```

打包 `.app` 和 `.pkg`：

```bash
npm run build:desktop
```

发布到 GitHub Release：

```bash
npm run deploy:desktop
```

如果要让发布出来的 `.pkg` 在其他 Mac 上尽量不被 Gatekeeper 拦截，先检查本机签名/公证准备状态：

```bash
npm --prefix desktop-app run macos:signing-info
```

## 开发环境设置

### 开箱使用（本地开发）

```bash
# 1. 依赖
yarn install

# 2. 启动 Memory Service（记忆系统）
cd memory-service
cp .env.example .env
# 编辑 .env 填入 OPENAI_API_KEY
npm install && npm run build
npm run dev   # 保持运行，或改用 docker-compose up -d

# 3. 新终端：插件开发模式
yarn start

# 4. Chrome 加载 dist 目录
```

插件默认连接 `http://localhost:3210`。可在插件**选项页**的「记忆系统」中修改 API 地址，或通过 `.env` 的 `MEMORY_SERVICE_BASE_URL` 设置默认值。记忆系统文档：[docs/memory_system.md](docs/memory_system.md)

---

1. 从 .env.example 创建 .env.development 配置
2. 替换 GOOGLE_CLIENT_ID: 850492875483-m5hdm6mtj068npvdl9r8sr51n9cijndg.apps.googleusercontent.com （配置测试设备：https://console.cloud.google.com/auth/clients?invt=AbuzdQ&project=sync-data-with-jira）

### 安装依赖

```bash
yarn install
```

### 启动 Memory Service（记忆系统后端）

记忆系统已迁移至独立后端服务，需先启动 Memory Service，插件才能使用记忆、知识图谱、用户画像等功能。

#### 方式一：Docker Compose（推荐）

```bash
# 1. 构建并启动
cd memory-service
cp .env.example .env
# 编辑 .env，至少配置 OPENAI_API_KEY（用于实体抽取等 LLM 能力）
npm install && npm run build
cd ..
docker-compose up -d

# 2. 验证
curl http://localhost:3210/health

# 查看日志 / 停止
docker-compose logs -f memory-service
docker-compose down
```

#### 方式二：本地开发模式

```bash
cd memory-service
cp .env.example .env
# 编辑 .env，配置 OPENAI_API_KEY
npm install
npm run dev
```

服务默认运行在 `http://localhost:3210`，API 文档：http://localhost:3210/docs

> **说明**：Embedding 使用本地模型（Xenova），无需额外 API。LLM 用于实体抽取、问答等，需配置 `OPENAI_API_KEY` 或改用 Groq/Ollama/Dify。

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

Memory Service 数据位于 `memory-service/data/`，按用户隔离（`users/{userId}/memory.db` 及 markdown 日志）。

```bash
tar -czf ./memory-backup-$(date +%Y%m%d).tar.gz ./memory-service/data
```
