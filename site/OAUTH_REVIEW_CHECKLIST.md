# Google OAuth 审核检查清单

## ✅ 已完成的更新

### 1. 隐私政策更新
- [x] 明确说明访问的 Google 用户数据（Sheets、Slides、Drive）
- [x] 详细说明每个 API 访问的具体数据类型
- [x] 说明数据使用目的（Jira 同步、定时消息、Slides 分析）
- [x] 明确数据共享政策（不与第三方共享）
- [x] 说明数据保护机制（加密、OAuth 2.0、最小权限）
- [x] 提供数据保留和删除说明
- [x] 中英文版本内容一致

### 2. 文件更新
- [x] `site/privacy-en.html` - 英文隐私政策
- [x] `site/privacy.html` - 中文隐私政策
- [x] `site/PRIVACY_POLICY_UPDATE.md` - 更新说明文档

## 📋 提交审核前检查清单

### 隐私政策要求

- [ ] **可访问性测试**
  - [ ] 隐私政策 URL 可以正常访问
  - [ ] 页面加载速度正常
  - [ ] 移动端显示正常
  - [ ] 中英文切换功能正常

- [ ] **域名验证**
  - [ ] 隐私政策托管在已验证的域名上
  - [ ] 域名与应用主页域名一致或属于同一组织
  - [ ] SSL 证书有效

- [ ] **内容完整性**
  - [ ] 包含应用名称 "Personal AI"
  - [ ] 包含开发者/组织名称
  - [ ] 包含最后更新日期
  - [ ] 包含联系方式

### OAuth Consent Screen 配置

- [ ] **基本信息**
  - [ ] 应用名称：Personal AI
  - [ ] 应用主页 URL
  - [ ] 隐私政策 URL：指向更新后的隐私政策页面
  - [ ] 服务条款 URL（如有）

- [ ] **Scopes（权限范围）**
  - [ ] Google Sheets API - 读写权限
    - `https://www.googleapis.com/auth/spreadsheets`
  - [ ] Google Slides API - 只读权限
    - `https://www.googleapis.com/auth/presentations.readonly`
  - [ ] Google Drive API - 限制访问
    - `https://www.googleapis.com/auth/drive.file`

- [ ] **应用说明**
  - [ ] 清楚说明为什么需要这些权限
  - [ ] 说明如何使用这些数据
  - [ ] 与隐私政策内容一致

### 应用功能验证

- [ ] **Jira 同步功能**
  - [ ] 可以读取 Jira 数据
  - [ ] 可以写入 Google Sheets
  - [ ] 数据同步正常

- [ ] **定时消息功能**
  - [ ] 可以创建 Google Sheets
  - [ ] 可以部署 Apps Script
  - [ ] 定时消息发送正常

- [ ] **Slides 分析功能**
  - [ ] 可以读取 Slides 内容
  - [ ] 分析功能正常
  - [ ] 只读权限限制有效

### 安全和合规

- [ ] **数据保护**
  - [ ] 所有 API 调用使用 HTTPS
  - [ ] OAuth 令牌加密存储
  - [ ] 实施最小权限原则
  - [ ] 无中央服务器存储用户数据

- [ ] **Limited Use 合规**
  - [ ] 不用于训练 AI/ML 模型
  - [ ] 不用于广告投放
  - [ ] 不出售给数据经纪人
  - [ ] 仅用于提供用户请求的功能

- [ ] **用户控制**
  - [ ] 用户可以撤销授权
  - [ ] 用户可以删除数据
  - [ ] 用户可以导出数据
  - [ ] 提供清晰的撤销和删除说明

## 📝 提交审核步骤

### 1. 更新 OAuth Consent Screen

```
1. 访问 Google Cloud Console
   https://console.cloud.google.com/apis/credentials/consent?project=[YOUR_PROJECT_ID]

2. 更新隐私政策 URL
   - 确保指向更新后的隐私政策页面
   - 测试 URL 可访问性

3. 检查 Scopes 配置
   - 确保只请求必要的权限
   - 与隐私政策中的说明一致

4. 保存更改
```

### 2. 准备审核材料

- [ ] **Demo 视频**（如需要）
  - [ ] 展示应用如何使用 Google 数据
  - [ ] 展示用户授权流程
  - [ ] 展示数据保护措施

- [ ] **测试账户**（如需要）
  - [ ] 提供测试账户凭据
  - [ ] 确保测试账户可以访问所有功能

- [ ] **补充说明**
  - [ ] 说明应用的业务用途
  - [ ] 说明为什么需要这些权限
  - [ ] 说明数据处理流程

### 3. 提交审核

```
1. 在 OAuth Consent Screen 页面
2. 点击 "Prepare for verification"
3. 确认所有信息正确
4. 点击 "Submit for verification"
```

### 4. 回复审核反馈

如果收到审核反馈：

```
1. 仔细阅读反馈内容
2. 根据要求更新隐私政策或应用配置
3. 回复审核邮件，说明已完成的更改
4. 提供更新后的 URL 或说明
```

## 🔍 常见审核问题及解决方案

### 问题 1: 隐私政策不明确访问的数据
**解决方案**: ✅ 已在 Section 5.1 中详细说明

### 问题 2: 隐私政策与应用主页域名不一致
**解决方案**: 
- 确保隐私政策托管在与主页相同的域名
- 或通过域名验证证明所有权

### 问题 3: 请求的权限超过实际需要
**解决方案**: 
- 仅请求必要的最小权限
- 在隐私政策中说明每个权限的用途

### 问题 4: 数据使用不符合 Limited Use 要求
**解决方案**: 
- 确保不用于训练 AI 模型
- 确保不用于广告投放
- 在隐私政策中明确声明

### 问题 5: 缺少数据删除说明
**解决方案**: ✅ 已在 Section 5.5 中提供详细步骤

## 📞 需要帮助？

### Google 支持资源
- [OAuth Verification Support](https://support.google.com/cloud/answer/9110914)
- [API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
- [OAuth Quick Reference Guides](https://support.google.com/cloud/answer/13806988)

### 内部联系
- Email: privacy@personal-ai.example.com
- GitHub Issues: https://github.com/your-repo/personal-ai/issues
- 文档: https://wiki.ringcentral.com/display/XTO/Personal+AI+-+Tools

## 📊 审核时间线

| 阶段 | 预计时间 | 说明 |
|------|---------|------|
| 提交审核 | 即时 | 提交后立即进入审核队列 |
| 初步审查 | 1-3 个工作日 | Google 团队进行初步检查 |
| 详细审核 | 3-7 个工作日 | 深入审查应用和隐私政策 |
| 反馈/批准 | 1-2 个工作日 | 收到审核结果或反馈 |
| **总计** | **5-12 个工作日** | 完整审核周期 |

*注意：复杂应用或需要额外审查的应用可能需要更长时间*

## ✨ 最后检查

在提交审核前，请确认：

1. ✅ 隐私政策已更新并可访问
2. ✅ 隐私政策内容完整且准确
3. ✅ OAuth Consent Screen 配置正确
4. ✅ 应用功能与隐私政策说明一致
5. ✅ 实施了必要的安全措施
6. ✅ 符合 Google Limited Use 要求
7. ✅ 提供了数据删除方法
8. ✅ 中英文版本内容一致

**准备好了吗？点击提交审核！** 🚀

