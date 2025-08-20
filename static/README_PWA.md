# 📱 PWA 使用说明

## 🎯 功能说明

这个目录包含了 Personal AI 记忆系统的 PWA（渐进式Web应用）版本文件。

## ⚠️ 重要提醒

**Chrome扩展本身无法成为PWA！** 

- PWA需要通过 `https://` 访问，而扩展通过 `chrome-extension://` 访问
- `beforeinstallprompt` 事件不会在扩展页面中触发
- 要使用PWA功能，需要将这些文件部署到HTTPS服务器

## 📁 文件说明

### PWA核心文件
- `memory.html` - 主应用页面
- `pwa-manifest.json` - PWA配置文件
- `sw.js` - Service Worker
- `pwa-init.js` - PWA初始化脚本

### 调试和启动器
- `memory-launcher.html` - PWA启动器页面
- `pwa-test.html` - PWA功能测试页面

## 🚀 使用方式

### 方式1: 扩展内使用 (当前)
- 通过Chrome扩展popup访问
- 功能完整，但无PWA特性
- 自动fallback到此模式

### 方式2: 独立PWA部署
1. 将文件部署到HTTPS服务器
2. 在扩展中配置PWA地址
3. 享受PWA的所有功能特性

## 🔧 部署到PWA

参考项目根目录的 `PWA_DEPLOYMENT_GUIDE.md` 获取详细部署指南。

### 快速部署示例

#### 使用Netlify
1. 将这些文件上传到新的Git仓库
2. 连接到Netlify
3. 部署后获得HTTPS地址
4. 在扩展中配置此地址

#### 使用Vercel
1. 使用 `vercel` CLI
2. 在此目录运行 `vercel --prod`
3. 获得HTTPS部署地址

## ✨ PWA功能特性

一旦正确部署到HTTPS服务器，将支持：

- 📱 **桌面安装**: 可安装为独立应用
- 🔄 **离线访问**: Service Worker缓存支持
- 📬 **推送通知**: 原生通知支持
- ⚡ **快速启动**: 缓存优化的快速加载
- 🖥️ **独立窗口**: 不依赖浏览器窗口运行

## 🐛 常见问题

### Q: 为什么PWA安装按钮没有反应？
A: 确保页面通过HTTPS访问，而不是 `chrome-extension://`

### Q: 如何测试PWA功能？
A: 访问 `pwa-test.html` 进行完整的功能诊断

### Q: 可以在localhost测试PWA吗？
A: 可以，localhost被认为是安全上下文

## 📞 技术支持

如需帮助，请：
1. 使用 `pwa-test.html` 进行诊断
2. 查看浏览器控制台错误信息
3. 参考完整的部署指南
