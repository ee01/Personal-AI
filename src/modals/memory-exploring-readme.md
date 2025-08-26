# 单文件 Vue.js 记忆查询系统

## 文件结构（简化版）

```
src/modals/
├── memory-exploring.vue           # 🎯 主要文件：包含所有功能的单一Vue组件
├── memory-exploring-entry.ts      # 📄 入口文件：应用初始化
└── memory-exploring-readme.md     # 📖 本文档

static/
└── memory-exploring.html          # 🌐 HTML模板：包含应用容器
```

## 解决的问题

### ✅ Chrome Extension CSP 兼容性
- **问题**：HTML版本使用内联脚本，被CSP阻止
- **解决**：外部脚本文件，完全符合Chrome Extension CSP要求

### ✅ 简化文件结构
- **问题**：Vue项目通常需要多个文件和文件夹
- **解决**：所有组件、状态管理、路由都在单一`.vue`文件中

### ✅ 保持Vue.js优势
- **TypeScript支持**：类型安全和自动补全
- **组件化开发**：内部组件定义，结构清晰
- **状态管理**：内置Pinia store
- **路由功能**：支持hash模式路由

## 核心功能

### 🏗️ 应用架构
- **主组件**：`memory-exploring.vue` 包含所有UI和逻辑
- **状态管理**：内置Pinia store处理数据状态
- **路由系统**：支持实体详情、主题详情等页面导航
- **Chrome API**：集成Chrome Extension API，支持数据获取

### 🎨 界面功能
- **侧边栏导航**：实体类型分类浏览
- **搜索功能**：全局搜索实体和内容
- **概览页面**：显示统计数据和推荐内容
- **实体详情**：按类型浏览实体列表
- **主题详情**：包含项目、资源、聊天记录、网页记录
- **时间轴**：显示时间线事件

### 🔗 路由支持
- `#/` - 首页概览
- `#/timeline` - 时间轴
- `#/entity/:type` - 实体详情页（如`#/entity/Project`）
- `#/topic/:id` - 主题详情页（如`#/topic/ai-workflow`）
- `#/topic/:id?messageId=123` - 精准定位到特定消息
- `#/user-profile` - 用户画像（开发中）
- `#/search` - 搜索结果（开发中）

## 技术栈

- **Vue 3** - 响应式框架
- **Vue Router** - 路由管理（Hash模式）
- **Pinia** - 状态管理
- **TypeScript** - 类型安全
- **CSS** - 完整样式系统

## 使用方法

### 1. 安装依赖（需要一次性安装）
```bash
npm install vue@3 vue-router@4 pinia@2
npm install --save-dev vue-loader@17 @vue/compiler-sfc@3 vue-style-loader@4
```

### 2. 构建项目
```bash
npm run build
```

### 3. 在Chrome Extension中使用
- **HTML文件**：`static/memory-exploring.html`
- **JavaScript文件**：`dist/memory-exploring.js`

### 4. 集成到manifest.json
```json
{
  "web_accessible_resources": [
    {
      "resources": [
        "memory-exploring.html",
        "memory-exploring.js"
      ],
      "matches": ["<all_urls>"]
    }
  ]
}
```

## 开发说明

### 修改功能
所有功能都在 `memory-exploring.vue` 文件中：
- **模板部分**：HTML结构和组件模板
- **脚本部分**：组件逻辑、状态管理、路由配置
- **样式部分**：完整的CSS样式定义

### 添加新页面
1. 在Vue文件中定义新的组件（如`defineComponent`）
2. 在routes数组中添加路由配置
3. 更新侧边栏导航

### Chrome API集成
- `chromeAPI.sendMessage()` 封装了Chrome Extension消息传递
- 自动降级到模拟数据（开发环境）
- 支持的消息类型：
  - `GET_ENTITY_STATISTICS`
  - `GET_ENTITIES_BY_TYPE`
  - `SEARCH_ENTITIES`
  - `GET_TOPIC_DETAIL`

## 优势对比

| 特性 | HTML版本 | 单文件Vue版本 |
|------|----------|---------------|
| **CSP兼容性** | ❌ 内联脚本 | ✅ 外部脚本 |
| **文件数量** | 1个HTML文件 | 2个核心文件 |
| **开发体验** | 📝 混合代码 | 🎯 组件化 |
| **类型安全** | ❌ 无 | ✅ TypeScript |
| **模块化** | ❌ 无 | ✅ ES模块 |
| **构建集成** | ❌ 无 | ✅ Webpack |
| **维护性** | 📊 较难 | 🚀 优秀 |

## 故障排除

### 常见问题

1. **构建失败**
   - 确保Vue依赖已安装
   - 检查webpack配置中的vue-loader

2. **路由不工作**
   - 确认使用hash模式（`createWebHashHistory()`）
   - 检查HTML文件中的挂载点ID

3. **样式显示异常**
   - 检查CSS是否正确加载
   - 确认vue-style-loader配置

4. **TypeScript错误**
   - 安装@vue/compiler-sfc
   - 确认Vue类型声明正确

通过这个单文件Vue实现，我们成功地：
- ✅ 解决了Chrome Extension CSP问题
- ✅ 大幅简化了文件结构（从10+文件减少到2个核心文件）
- ✅ 保持了Vue.js的所有优势
- ✅ 维持了原有的完整功能
