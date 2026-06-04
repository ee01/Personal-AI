# Personal AI 官方网站

这是 Personal AI Chrome 插件的官方展示网站。

## 目录结构

```
website/
├── index.html          # 首页
├── features.html       # 功能详情页
├── install.html        # 安装指南
├── privacy.html        # 隐私政策
├── css/
│   └── style.css       # 主样式文件
├── js/
│   ├── ai-avatar.js    # AI助理头像效果
│   ├── particles.js    # 背景粒子效果
│   └── animations.js   # 页面动画
├── demo/               # 功能演示页面
│   ├── 实体记忆查询界面.html
│   ├── 项目进展图-新版.html
│   ├── 项目进展图-空间版.html
│   └── 项目进展图-缩放版.html
└── .nojekyll           # 禁用Jekyll处理
```

## 特性

- 🎨 现代化设计：蓝紫色调 + 玻璃态效果
- ✨ 动态效果：粒子背景 + AI助理头像动画
- 📱 响应式设计：完美适配移动端
- 🚀 纯静态网站：无需后端服务
- 🎬 功能演示：集成实时demo预览

## 本地预览

使用任意静态服务器即可预览：

```bash
# 方式1：使用 Python
cd website
python -m http.server 8080

# 方式2：使用 Node.js
npx serve website

# 方式3：使用 VS Code Live Server 扩展
```

然后访问 `http://localhost:8080`

## GitHub Pages 部署

### 方式一：部署到项目 Pages

1. 将 `website` 目录推送到 GitHub 仓库
2. 在仓库设置中，进入 Pages 设置
3. Source 选择 `main` 分支，目录选择 `/website`
4. 保存后等待部署完成

### 方式二：部署到独立仓库

1. 创建新仓库 `your-username.github.io`
2. 将 website 目录内的所有文件推送到该仓库根目录
3. GitHub 会自动部署

## 更新网站

1. 修改相应的 HTML/CSS/JS 文件
2. 测试本地预览确认无误
3. 提交并推送到 GitHub
4. GitHub Pages 会自动更新

## 技术栈

- HTML5
- CSS3 (CSS Grid, Flexbox, CSS Variables)
- Vanilla JavaScript (ES6+)
- Canvas API (粒子系统)

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 许可证

Copyright © 2024 Personal AI. All rights reserved.

