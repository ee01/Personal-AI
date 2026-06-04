# 隐私政策更新说明

## 更新日期
2025年12月10日

## 更新原因
Google OAuth 审核反馈：**"Your privacy policy does not state what Google user data is accessed by your application."**

根据 [Google Cloud OAuth 审核指南](https://support.google.com/cloud/answer/13806988)，隐私政策必须明确说明：
1. 访问的具体 Google 用户数据
2. 如何使用这些数据
3. 与谁共享数据
4. 数据保护机制
5. 数据保留和删除政策

## 主要更新内容

### 英文版 (privacy-en.html)

#### Section 5: Google API Services Data Usage - 大幅扩展

**5.1 What Google User Data We Access** - 新增详细说明
- **Google Sheets API**
  - 访问的数据：电子表格内容、单元格值、公式、格式和元数据
  - 权限：读写访问
  - 用途：
    - 同步 Jira 工单数据到 Google Sheets
    - 创建和管理定时消息数据表
    - 部署 Google Apps Script 实现自动化

- **Google Slides API**
  - 访问的数据：幻灯片内容、文本、图像和演示结构
  - 权限：只读访问
  - 用途：
    - 分析项目进度信息
    - 提取和整理内容帮助创建摘要
    - 协助内容组织和信息检索

- **Google Drive API**
  - 访问的数据：Sheets 和 Slides 文件的元数据和内容
  - 权限：仅限应用创建或共享的文件
  - 用途：
    - 存储和检索定时消息电子表格
    - 访问用户选择分析的演示文稿

- **明确声明不访问的服务**：Gmail、Google Calendar、Google Contacts、Google Photos 等

**5.2 How We Use Google User Data** - 新增
- 详细说明每个功能如何使用 Google 数据
- 强调仅在用户明确请求时处理数据
- 符合 Google Limited Use 要求

**5.3 How We Share Google User Data** - 新增
- 明确声明：**不与任何第三方共享、出售或传输 Google 用户数据**
- 说明数据传输的唯一场景：
  - 回传到 Google APIs（提供功能所需）
  - 可选的 AI 服务（需用户配置 API 密钥）
  - 无其他第三方

**5.4 How We Protect Google User Data** - 新增
- HTTPS/TLS 传输加密
- OAuth 2.0 令牌加密存储
- 最小数据保留策略
- 访问控制机制
- 无中央数据库

**5.5 Data Retention and Deletion** - 新增
- 详细说明数据保留时长
- 提供 4 种数据删除方法：
  1. 通过 Google 账户撤销访问
  2. 清除本地数据
  3. 删除 Google Drive 中的文件
  4. 联系支持团队

**5.6 Your Control Rights** - 新增
- 细粒度权限控制
- 随时撤销访问
- 审计访问历史
- 删除数据

### 中文版 (privacy.html)

#### 完整重构，与英文版保持一致

**新增完整的章节结构（1-11节）：**

1. **我们收集的数据**
   - 1.1 用户提供的数据
   - 1.2 自动收集的数据

2. **如何使用您的数据**
   - 2.1 提供服务
   - 2.2 改进服务
   - 2.3 我们不会做的事

3. **数据存储和安全**
   - 3.1 本地存储
   - 3.2 云端存储
   - 3.3 安全措施

4. **第三方服务**
   - 4.1 AI 服务
   - 4.2 工作平台

5. **Google API 服务数据使用** ⭐ 核心更新
   - 5.1 我们访问的 Google 用户数据（详细说明）
   - 5.2 如何使用 Google 用户数据
   - 5.3 如何共享 Google 用户数据
   - 5.4 如何保护 Google 用户数据
   - 5.5 数据保留和删除
   - 5.6 您的控制权

6. **您的权利**
   - 6.1 访问和导出
   - 6.2 修改和删除
   - 6.3 控制和授权

7. **数据保留**
   - 7.1 本地数据
   - 7.2 云端数据

8. **儿童隐私**

9. **隐私政策更新**

10. **联系我们**

11. **法规合规**

**新增 CTA Section**：
- 与英文版保持一致的行动号召区域

## 符合 Google 审核要求

### ✅ 已满足的要求

1. **明确说明访问的 Google 用户数据** ✅
   - 详细列出 Google Sheets、Slides、Drive API 访问的具体数据类型

2. **说明如何使用数据** ✅
   - 每个 API 都有明确的使用目的说明
   - 与应用功能直接关联

3. **说明与谁共享数据** ✅
   - 明确声明不与第三方共享
   - 列出唯一的数据传输场景

4. **数据保护机制** ✅
   - 详细的安全措施说明
   - 加密、访问控制、最小权限原则

5. **数据保留和删除** ✅
   - 明确的保留时长
   - 详细的删除步骤

6. **Limited Use 合规** ✅
   - 明确声明不用于训练 AI 模型
   - 不用于广告投放
   - 仅用于提供用户请求的功能

## 关键改进点

### 1. 数据访问透明度
- **之前**：笼统说明"访问 Google Sheets、Slides"
- **现在**：详细说明访问的具体数据类型、权限级别、使用目的

### 2. 数据使用说明
- **之前**：简单列出用途
- **现在**：每个功能都有详细的数据使用说明，与实际应用场景对应

### 3. 数据共享政策
- **之前**：简单声明不共享
- **现在**：详细说明所有可能的数据传输场景，包括可选的 AI 服务

### 4. 用户控制权
- **之前**：基本的撤销说明
- **现在**：完整的 4 步删除流程，包括 Google 账户、本地数据、Drive 文件、支持请求

### 5. 中英文一致性
- **之前**：中文版内容不完整
- **现在**：中英文版本完全对应，无内容缺失

## 应用功能与数据访问对应关系

| 功能 | Google API | 访问的数据 | 权限 | 用途 |
|------|-----------|-----------|------|------|
| Jira 同步 | Sheets API | 电子表格内容 | 读写 | 同步 Jira 工单数据到 Sheets |
| 定时消息 | Sheets API + Apps Script | 电子表格内容、脚本 | 读写 | 创建和管理定时消息表 |
| Slides 分析 | Slides API | 幻灯片内容 | 只读 | 分析项目进度信息 |
| 文件管理 | Drive API | 文件元数据 | 限制访问 | 访问授权的 Sheets 和 Slides |

## 下一步建议

1. **更新 OAuth Consent Screen**
   - 确保 OAuth 同意屏幕上的隐私政策链接指向更新后的页面
   - 验证链接可访问性

2. **回复 Google 审核团队**
   - 通知已更新隐私政策
   - 提供更新后的隐私政策 URL
   - 说明更新内容符合审核要求

3. **验证域名**
   - 确保隐私政策托管在已验证的域名上
   - 域名应与应用主页域名一致或属于同一组织

4. **测试可访问性**
   - 确保隐私政策页面可以正常访问
   - 测试中英文切换功能
   - 验证所有链接有效

## 参考资料

- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
- [Google OAuth Verification Quick Reference](https://support.google.com/cloud/answer/13806988)
- [Chrome Web Store Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)

## 联系信息

如有问题，请联系：
- Email: privacy@personal-ai.example.com
- GitHub: https://github.com/your-repo/personal-ai/issues
- 文档: https://wiki.ringcentral.com/display/XTO/Personal+AI+-+Tools

