# Personal AI Chrome 插件

## 安装 wiki

https://wiki.ringcentral.com/display/XTO/Personal+AI+-+Tools

## 开发环境设置

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

## 安装 Chrome 插件

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 启用 `开发者模式`
3. 点击 `加载已解压的扩展程序`
4. 选择项目中的 `dist` 文件夹
5. 打开您想要使用插件的网页

## 权限设置
如果插件不能正常工作，请检查扩展权限：
1. 右键点击 `Personal AI` 插件图标
2. 点击 `此网站的权限`
3. 确保已授予必要的权限

## 更新插件
1. 打开 `chrome://extensions/`
2. 启用 `开发者模式`
3. 点击 `更新` 按钮
4. 重新加载您的网页

## Chroma 服务 API
Chroma 服务默认在 `http://localhost:8000` 上运行，提供以下 API：
- 集合管理：创建、列出、删除集合
- 文档操作：添加、查询、更新、删除文档
- 嵌入向量：支持多种嵌入模型

详细 API 文档请参考 [Chroma 官方文档](https://docs.trychroma.com/api-reference)