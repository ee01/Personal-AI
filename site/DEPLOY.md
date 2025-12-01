# Personal AI 网站部署指南

## 快速开始

本网站是纯静态网站，无需构建步骤，可直接部署。

## 部署到 GitHub Pages

### 方法 1：从 website 目录部署（推荐）

1. **配置 GitHub Pages**
   ```bash
   # 确保所有文件已提交
   git add website/
   git commit -m "Add Personal AI website"
   git push origin main
   ```

2. **在 GitHub 仓库中设置 Pages**
   - 进入仓库的 Settings → Pages
   - Source 选择 `main` 分支
   - Folder 选择 `/website`
   - 点击 Save

3. **等待部署完成**
   - GitHub 会自动部署，通常需要 1-2 分钟
   - 部署完成后会显示网站 URL
   - URL 格式：`https://your-username.github.io/personal-ai/`

### 方法 2：部署到根目录

如果你想让网站在 `https://your-username.github.io/` 上：

1. **创建专用仓库**
   ```bash
   # 仓库名必须是 your-username.github.io
   ```

2. **复制文件到根目录**
   ```bash
   # 将 website 目录的内容复制到仓库根目录
   cp -r website/* .
   git add .
   git commit -m "Deploy Personal AI website"
   git push origin main
   ```

## 部署到其他平台

### Netlify

1. 登录 [Netlify](https://netlify.com)
2. 点击 "Add new site" → "Import an existing project"
3. 连接 GitHub 仓库
4. Build settings:
   - Base directory: `website`
   - Build command: 留空
   - Publish directory: `.`
5. 点击 "Deploy site"

### Vercel

1. 登录 [Vercel](https://vercel.com)
2. 点击 "New Project"
3. 导入 GitHub 仓库
4. Framework Preset: 选择 "Other"
5. Root Directory: `website`
6. 点击 "Deploy"

### Cloudflare Pages

1. 登录 [Cloudflare Pages](https://pages.cloudflare.com)
2. 点击 "Create a project"
3. 连接 GitHub 仓库
4. Build settings:
   - Build command: 留空
   - Build output directory: `website`
5. 点击 "Save and Deploy"

## 本地测试

在部署前，建议先在本地测试：

```bash
# 进入 website 目录
cd website

# 使用 Python 启动服务器
python -m http.server 8080

# 或使用 Node.js
npx serve

# 或使用 PHP
php -S localhost:8080
```

然后访问 `http://localhost:8080`

## 检查清单

部署前请确认：

- [ ] 所有 HTML 文件正确加载 CSS 和 JS
- [ ] AI 助理头像动画正常显示
- [ ] 粒子背景效果正常
- [ ] 所有内部链接正常工作
- [ ] Demo 预览按钮可以打开演示页面
- [ ] 移动端响应式设计正常
- [ ] 视频嵌入正常加载（需要网络连接）
- [ ] 所有外部链接（Chrome 商店、GitHub等）正确

## 自定义配置

### 修改 GitHub 链接

在所有 HTML 文件的 footer 中，将：
```html
<a href="https://github.com/your-repo/personal-ai" target="_blank">GitHub</a>
```
改为你的实际 GitHub 仓库地址。

### 更新 Chrome 商店链接

如果你的 Chrome 商店 ID 不同，请在所有页面中更新：
```html
https://chromewebstore.google.com/detail/your-extension-id
```

## 常见问题

### Q: 样式没有加载？
A: 检查 CSS 文件路径是否正确。如果部署在子目录，可能需要调整路径为相对路径。

### Q: JavaScript 不工作？
A: 打开浏览器控制台查看错误信息。确保所有 JS 文件路径正确。

### Q: Demo 页面打不开？
A: 确认 demo 文件已正确复制到 `website/demo/` 目录。

### Q: Canvas 动画不显示？
A: 某些浏览器可能需要 HTTPS 才能完整显示 Canvas 效果。本地测试使用 http 没问题，但生产环境建议使用 HTTPS。

### Q: 移动端菜单不工作？
A: 检查 JavaScript 是否正确加载，特别是 `animations.js` 文件。

## 更新网站

1. 修改文件
2. 本地测试
3. 提交到 Git
4. 推送到 GitHub
5. GitHub Pages 会自动重新部署

## 性能优化建议

- [ ] 压缩图片（如果添加了图片资源）
- [ ] 启用 CDN（通过 Cloudflare 等服务）
- [ ] 启用 Gzip 压缩（大多数托管平台默认启用）
- [ ] 添加 Service Worker 实现离线缓存（可选）

## 监控

部署后，可以使用以下工具监控网站性能：

- Google PageSpeed Insights
- GTmetrix
- WebPageTest
- Lighthouse（Chrome DevTools）

## 支持

如有问题，请查看：
- [GitHub Issues](https://github.com/your-repo/personal-ai/issues)
- [文档](https://wiki.ringcentral.com/display/XTO/Personal+AI+-+Tools)

