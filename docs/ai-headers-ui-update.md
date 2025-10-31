# AI Headers UI 更新说明

## 📋 更新概述

将 AI 消息配置中的 Headers 输入方式从 **文本框手工输入** 改为 **下拉选择器 + 输入框** 的组合方式。

## 🎯 更新原因

由于 Jira Automation 的限制，header name 必须是固定的字符串，不能使用变量。因此我们限制用户只能选择预定义的 7 个 header 名称。

## 🔧 技术实现

### 1. 新增常量和类型

```typescript
// AI Header 选项
const AVAILABLE_AI_HEADERS = [
  { value: 'Authorization', label: 'Authorization (认证)', placeholder: 'Bearer token 或 Basic xxx' },
  { value: 'Content-Type', label: 'Content-Type (内容类型)', placeholder: 'application/json' },
  { value: 'Accept', label: 'Accept (接受类型)', placeholder: 'application/json' },
  { value: 'X-API-Key', label: 'X-API-Key (API密钥)', placeholder: 'sk-xxxxxxx' },
  { value: 'User-Agent', label: 'User-Agent (用户代理)', placeholder: 'MyApp/1.0' },
  { value: 'X-Request-ID', label: 'X-Request-ID (请求ID)', placeholder: 'req-12345' },
  { value: 'X-Custom-Header', label: 'X-Custom-Header (自定义)', placeholder: '自定义值' }
];

// AI Header 类型
interface AIHeader {
  name: string;
  value: string;
}
```

### 2. 新增状态管理

```typescript
const [aiHeaders, setAiHeaders] = useState<AIHeader[]>([]);
```

### 3. 核心函数

#### 解析函数
```typescript
// 将字符串格式的 headers 解析为数组
const parseHeadersString = (headersStr: string): AIHeader[] => {
  // 按行分割，提取 name 和 value
  // 格式：Authorization: Bearer token
}
```

#### 格式化函数
```typescript
// 将 headers 数组转换为字符串（保存到 Sheet）
const formatHeadersToString = (headers: AIHeader[]): string => {
  // 转换为：name1: value1\nname2: value2
}
```

#### 管理函数
```typescript
const addAIHeader = () => { /* 添加新 header */ };
const updateAIHeaderName = (index, name) => { /* 更新 header 名称 */ };
const updateAIHeaderValue = (index, value) => { /* 更新 header 值 */ };
const removeAIHeader = (index) => { /* 删除 header */ };
```

### 4. UI 组件

#### 原实现（文本框）
```tsx
<textarea 
  value={formData.AI_Headers || ''}
  onChange={(e) => handleChange('AI_Headers', e.target.value)}
  placeholder="Authorization: Bearer token\nContent-Type: application/json"
  rows={3}
/>
```

#### 新实现（下拉选择器）
```tsx
<div style={{ border: '1px solid #ddd', padding: '12px', backgroundColor: '#f9f9f9' }}>
  {aiHeaders.map((header, index) => (
    <div key={index} style={{ display: 'flex', gap: '8px' }}>
      {/* 下拉选择 header 名称 */}
      <select value={header.name} onChange={...}>
        <option value="">选择 Header</option>
        {AVAILABLE_AI_HEADERS.map(h => (
          <option key={h.value} value={h.value}>{h.label}</option>
        ))}
      </select>
      
      {/* 输入 header 值 */}
      <input 
        type="text" 
        value={header.value}
        onChange={...}
        placeholder={动态 placeholder}
      />
      
      {/* 删除按钮 */}
      <button onClick={() => removeAIHeader(index)}>🗑️</button>
    </div>
  ))}
  
  {/* 添加按钮 */}
  <button onClick={addAIHeader}>➕ 添加 Header</button>
</div>
```

## 🎨 UI 特性

### 1. 智能占位符
根据选择的 header 名称，自动显示相应的 placeholder：
- `Authorization`: "Bearer token 或 Basic xxx"
- `Content-Type`: "application/json"
- `X-API-Key`: "sk-xxxxxxx"

### 2. 视觉设计
- 浅灰色背景区域 (`#f9f9f9`)
- 清晰的边框
- 合理的间距
- 删除按钮使用红色 (`#dc3545`)
- 添加按钮使用绿色 (`#28a745`)

### 3. 用户体验
- ✅ 下拉选择，避免输入错误
- ✅ 动态 placeholder，提示正确格式
- ✅ 可以添加多个 headers
- ✅ 一键删除不需要的 header
- ✅ 自动保存为 Sheet 兼容格式

## 📦 数据流

### 输入流程
1. 用户选择 header 名称（下拉框）
2. 用户输入 header 值（输入框）
3. 调用 `updateAIHeaderName/Value`
4. 更新 `aiHeaders` 状态
5. 调用 `formatHeadersToString` 转换为字符串
6. 保存到 `formData.AI_Headers`

### 保存流程
1. 用户点击"创建消息"
2. `formData.AI_Headers` 已经是字符串格式
3. 直接保存到 Google Sheet 的 `AI_Headers` 列
4. 格式：`Authorization: Bearer xxx\nContent-Type: application/json`

### 读取流程（模板切换）
1. 切换到自定义模板
2. 从 `formData.AI_Headers` 读取字符串
3. 调用 `parseHeadersString` 解析为数组
4. 设置 `aiHeaders` 状态
5. UI 显示 header 列表

## ✅ 优势

1. **符合限制**：只允许预定义的 header 名称，符合 Jira Automation 要求
2. **用户友好**：下拉选择，避免拼写错误
3. **智能提示**：动态 placeholder，指导用户输入
4. **灵活管理**：可以添加/删除/修改任意数量的 headers
5. **向后兼容**：存储格式保持不变（仍是字符串）
6. **预设支持**：AI report 和 PEP report 模板的 headers 自动解析显示

## 🧪 测试场景

### 场景 1：新建自定义 AI 消息
1. 选择 Push_Method = "AI"
2. 选择模板 = "自定义"
3. 点击"➕ 添加 Header"
4. 选择 "Authorization"
5. 输入 "Bearer app-xxx"
6. 点击"➕ 添加 Header"
7. 选择 "Content-Type"
8. 输入 "application/json"
9. 提交
10. 验证：Sheet 中 `AI_Headers` 列为 `Authorization: Bearer app-xxx\nContent-Type: application/json`

### 场景 2：使用预设模板
1. 选择 Push_Method = "AI"
2. 选择模板 = "AI report"
3. Headers 自动填充：
   - Authorization: Bearer app-hTAaR1jaLnYDITixXRP5qi4Y
   - Content-Type: application/json
4. 切换到"自定义"
5. 验证：显示两个 header 行，可以编辑

### 场景 3：删除 Header
1. 添加 3 个 headers
2. 点击中间一个的删除按钮
3. 验证：该 header 被移除，其他 headers 保持不变

## 📝 注意事项

1. **只在自定义模板显示**：预设模板（AI report、PEP report）不显示 header 编辑器
2. **空值处理**：空 name 或空 value 的 header 在保存时会被过滤掉
3. **顺序保持**：headers 的顺序与用户添加的顺序一致
4. **唯一性**：不强制 header name 唯一，允许重复（虽然不推荐）

## 🔗 相关文件

- `src/scheduled-messages/ScheduledMessagesManager.tsx` - UI 组件
- `src/scheduled-messages/app-script-template.gs` - 后端解析逻辑
- `src/scheduled-messages/jira-rule-template.json` - Jira 规则模板
- `docs/jira-rule-template-fix.md` - 整体修复文档

