# 🧪 测试说明

## 快速测试

网站已在后台运行：**http://localhost:8888**

### 1. 测试中文首页
```
打开: http://localhost:8888/index.html
```
- [ ] 查看AI头像效果
- [ ] 切换V1/V2/V5版本
- [ ] 点击"EN"切换到英文

### 2. 测试英文首页
```
打开: http://localhost:8888/index-en.html
```
- [ ] 查看英文内容
- [ ] 点击"中文"返回中文版
- [ ] 测试导航链接

### 3. 测试头像版本
- **V1**: 蓝紫色粒子系统（流动的粒子+连接线）
- **V2**: 蓝紫色简单球体（整齐砖块，无五官）
- **V5**: 绿色对话气泡（笑脸+对话尾巴）

### 4. 测试所有页面
- 中文: index.html, features.html, install.html, privacy.html
- 英文: index-en.html, features-en.html, install-en.html, privacy-en.html

## 部署命令

确认测试通过后：

```bash
cd /Users/esone.qiu/Downloads/personal-ai
git add website/
git commit -m "Complete: Static multi-language site with V1/V2/V5 avatars"
git push origin main
```

## 预览地址

本地: http://localhost:8888
部署后: https://your-username.github.io/personal-ai/

---

**全部完成！** 🎉
