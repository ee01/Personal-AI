# 网页记忆探测与提示

*最后更新: 2026-03-25*

## 概述

这个功能有两条相邻但不完全相同的链路：

1. **网页智能分析**：判断当前网页是否值得做深度分析和存储。
2. **网页记忆提示**：在当前网页右下角弹出记忆 icon，提示“记忆系统里存在和当前上下文相关的信息”。

当前真正在线上生效、能在网页右下角弹出记忆 icon 的实现，核心不在 `src/web-intelligence/` 目录里的那套实验型 `UniversalContentScript`，而在：

- `src/contentScriptWebIntelligence.ts`
- `src/background.ts`
- `memory-service/src/routes/contextMatch.ts`

`docs/progressing/` 下已有几篇 `web intelligence / webpage analysis` 文档，但它们大多描述的是一套更大、更理想化的架构草稿，不是当前这条实际运行的“页面记忆提示”链路。本文作为当前代码的**实际说明文档**。

## 现有文档判定

`/docs` 下和本功能直接相关的旧文档主要有：

- `docs/progressing/web_intelligence_usage_guide.md`
- `docs/progressing/web_intelligence_detailed_explanation.md`
- `docs/progressing/webpage_analysis_integration_guide.md`

判定结果：

- 这些文档**有参考价值，但不是现状 truth**。
- 它们重点描述 `UniversalContentScript` / `EnhancedUniversalContentScript` / `WebIntelligenceIntegrator` / Chrome AI 分层分析。
- 当前 manifest 真正注入所有网页的是 `contentScriptWebIntelligence.js`，而不是这些旧文档里的主角。
- 当前右下角记忆 icon 的实现，也不在旧文档描述的 UI 流程里。

因此这里不直接沿用旧文档，而是以当前代码为准重写一篇正式文档。

## 当前实现总览

### 1. 注入入口

入口在 `src/manifest.json`：

- `<all_urls>` 注入 `contentScriptWebIntelligence.js`
- `https://app.ringcentral.com/*` 额外注入 `contentScriptGlip.js`

这意味着在 RingCentral 页面里，**通用网页探测脚本**和**RingCentral 专用脚本**会同时存在。

### 2. 网页智能分析链路

这条链路负责“网页是否值得深度分析 / 存储”：

1. `src/contentScriptWebIntelligence.ts`
2. 提取标题、URL、正文，做本地规则分析
3. 如果 `isRelevant` / `suggestedStorage` 达到阈值，发消息给 background
4. `src/background.ts` 处理 `WEB_INTELLIGENCE_ANALYSIS`
5. `src/agentThinking.ts` 用 `type: 'webpage'` 做进一步分析

这条链路偏向“存储和理解网页”。

### 3. 网页记忆提示链路

这条链路负责“右下角记忆 icon 提示”：

1. `src/contentScriptWebIntelligence.ts` 在初始化 2 秒后调用 `tryContextMatch()`
2. Content script 向 `src/background.ts` 发送 `CONTEXT_MATCH_REQUEST`
3. Background 转发到 `memory-service` 的 `/context-match`
4. `memory-service/src/routes/contextMatch.ts` 做向量检索
5. 如果命中，content script 调用 `showContextBubble()`
6. 右下角显示 `.pai-context-bubble` 和 `.pai-context-card`

这条链路偏向“提醒用户当前页面和记忆中的 reflection / dream 有关联”。

## 代码职责拆解

### `src/contentScriptWebIntelligence.ts`

当前这是本功能最关键的前端入口，职责包括：

- 判断当前域名是否跳过
- 监听页面初始加载和 DOM 变化
- 提取页面文本做轻量分析
- 在初始化后触发一次 `tryContextMatch()`
- 将匹配结果显示为右下角 bubble

当前 context match 的实现细节：

- URL 级缓存：`contextMatchCache`
- 域名级防抖：`domainLastRequest`
- 防抖时间：5 分钟
- 上下文输入：
  - `title`
  - `meta keywords`
  - `snippet`（`main/article/[role=main]` 或 `body` 的前 300 字）

### `src/background.ts`

负责两个动作：

- 处理 `CONTEXT_MATCH_REQUEST`
  - 拼 `/context-match`
  - 带上 `X-User-Id`
  - 返回 `{ match }`
- 处理 `WEB_INTELLIGENCE_ANALYSIS`
  - 命中条件后交给 `IntelligentAgent`

这里并没有页面级上下文状态管理，background 只是转发层。

### `memory-service/src/routes/contextMatch.ts`

服务端现在的匹配逻辑非常明确：

- 将 `title + keywords + snippet` 拼成 query text
- 生成 embedding
- 在 `chunks_vec` 上做 top 20 向量搜索
- 只保留以下来源：
  - `reflection-threads/`
  - `reflections/`
  - `dreams/`
- 将距离映射成 `score = 1 / (1 + distance)`
- 只有 `score >= contextMatchThreshold` 才返回

当前默认阈值在 `memory-service/src/config.ts`：

- `CONTEXT_MATCH_THRESHOLD`
- 默认值 `0.50`

### `src/contentScriptGlip.tsx`

这个文件不是当前网页记忆 bubble 的直接实现，但对 RingCentral 场景很关键，因为它已经有：

- 消息流 DOM 选择器知识
- 对会话切换的观察逻辑
- `hashchange` / `popstate` 监听
- MutationObserver 监听消息容器和主内容区域变化

它的“关注后续”视觉增强已经证明：**RingCentral 这类 SPA 场景必须按“会话切换”而不是“页面首次加载”来判断上下文变化**。

## 当前 UI 行为

`showContextBubble()` 的表现：

- 在右下角固定位置显示一个圆形 icon
- 点击 icon 展开卡片
- 卡片里显示：
  - 来源类型（Reflection / Dream）
  - score
  - 命中的内容摘要
  - source 路径

当前 UI 特征：

- 位置：`bottom: 24px; right: 24px`
- 圆形 icon
- 卡片默认隐藏
- 没有“上下文变化时重新播放”的动效
- 使用 singleton 判断：如果页面里已有 `.pai-context-bubble`，就不再重复注入

## 当前问题

### 1. context match 只在初始化时跑一次

`tryContextMatch()` 只在 `initialize()` 里被 `setTimeout(..., 2000)` 调用一次。

结果：

- 首次进入页面可以尝试匹配
- 后续 SPA 内部上下文切换不会自动重跑

### 2. 防抖粒度太粗

当前是**域名级 5 分钟防抖**。

这对 `app.ringcentral.com`、`jira.ringcentral.com/issues/...` 这类单页应用不合适，因为：

- 用户在同一域名下切换不同会话 / issue / 文档很常见
- 新上下文明明已经变了，但域名没变

### 3. bubble 不会随上下文切换清理

当前 `showContextBubble()` 会先检查：

- `document.querySelector('.pai-context-bubble')`

只要旧 bubble 还在，就不会创建新 bubble。

结果：

- 会话 A 命中过一次后
- 切到会话 B 时，旧 bubble 可能还留在页面上
- 用户看到的是**过期的记忆提示**

### 4. 通用 snippet 抽取不适合聊天类页面

当前 snippet 来自：

- `main`
- `article`
- `[role=main]`
- 或者整个 `body`

在 RingCentral 里这会带来两个问题：

- 内容太杂，容易掺入侧边栏、按钮文案、全局壳子文字
- 不能准确表达“当前聊天会话”的主题

## RingCentral 页面实测

使用 `webpage-mcp` 对已打开的 `app.ringcentral.com` 页面做了实测，结果如下。

### 实测页面

- 初始会话：`https://app.ringcentral.com/messages/35165069318`
- 切换后会话：`https://app.ringcentral.com/messages/135800094726`

### 页面结构

在当前 RingCentral 消息页，可以稳定观察到：

- 左侧会话列表项：
  - `[role="tab"]`
  - 当前选中项：`[role="tab"][aria-selected="true"]`
- 主面板标题：
  - `main` 区域内的 heading
- 消息流容器：
  - `#message-chat-stream-wrapper`
- 消息卡片：
  - `.conversation-card-wrapper[data-id]`

### 会话切换时真实发生的变化

实测确认，切换会话时以下信号会一起变化：

- `window.location.href`
  - `/messages/{chatId}` 中的 `chatId` 改变
- `document.title`
- 左侧选中 tab 的 `aria-selected`
- 主面板标题
- 消息流中的 `.conversation-card-wrapper[data-id]`

### 当前 bug 已被实测复现

切换到新的 RingCentral 会话后：

- URL 已经变成新的 `/messages/{chatId}`
- 主面板标题和消息列表也已切换
- 但页面右下角的 `.pai-context-bubble` 仍然存在
- 卡片内容还是旧会话对应的 Dream 匹配结果

这说明当前实现的问题不是“匹配算法完全没工作”，而是：

- **上下文触发时机不对**
- **旧 UI 没有在会话切换时被重置**

## 设计目标

对于 RingCentral 这类动态页面，用户真正期望的是：

- 当用户切换到某个聊天会话
- 且该会话最近消息与记忆系统中已有内容相关
- 右下角弹出记忆 icon
- 并通过轻量动效告诉用户“这是新会话触发的新提示”

因此，探测单位必须从“页面”升级为“当前会话上下文”。

## RingCentral 会话级探测设计

### 设计原则

1. **按会话而不是按页面检测**
2. **等待会话稳定后再检索**
3. **每个会话独立缓存**
4. **旧提示在会话切换后必须清理**
5. **抽取聊天语义，而不是整页 body 语义**

### 可用信号

建议同时使用三类信号，避免只依赖单点：

1. **主信号：URL**
   - `location.pathname` 匹配 `/messages/{chatId}`
   - `chatId` 是最稳定的会话标识

2. **确认信号：选中会话**
   - `[role="tab"][aria-selected="true"]`
   - 能判断左侧选中状态是否已更新

3. **就绪信号：主面板**
   - 主标题已变更
   - `#message-chat-stream-wrapper` 已出现
   - `.conversation-card-wrapper[data-id]` 已渲染出至少 1 到 3 条消息

### 会话上下文对象

建议把 RingCentral 当前会话抽象成：

```ts
interface RingCentralConversationContext {
  conversationId: string;
  title: string;
  selectedTabText: string;
  url: string;
  messageIds: string[];
  messageSnippet: string;
  participants?: string[];
}
```

其中：

- `conversationId`：来自 URL
- `title`：来自主面板 heading
- `messageIds`：前几条可见消息的 `data-id`
- `messageSnippet`：最近 N 条消息拼接出的摘要文本

### 稳定性判断

不能在用户刚点开会话的瞬间立刻请求，因为这时 DOM 可能还在重绘。

建议流程：

1. 监听 URL 变化、左侧选中项变化、消息容器变化
2. 统一进入 `scheduleConversationEvaluation(500~800ms)`
3. 连续两次采样得到相同 `conversationKey` 才认为“已稳定”

建议的 `conversationKey`：

```ts
const conversationKey = [
  conversationId,
  title,
  messageIds.slice(0, 3).join(',')
].join('|');
```

如果 key 改了，说明上下文已切换。

### 检索触发策略

当检测到**新的稳定会话**时：

1. 清理旧的 bubble / card
2. 取消上一个尚未完成的 context-match 请求
3. 使用当前会话构造新的 payload
4. 请求返回后：
   - 命中：显示新 bubble
   - 未命中：保持无提示状态

建议 payload 至少包含：

```ts
{
  title,
  keywords,
  snippet,
  sourceUrl: url,
  metadata: {
    domain: 'app.ringcentral.com',
    conversationId
  }
}
```

现有 `/context-match` 只接收 `title / keywords / snippet`，短期内可以继续兼容；中期建议扩展接口，让服务端知道这是“聊天会话”而不是普通网页。

### 会话级缓存建议

当前的域名级 5 分钟防抖应改成更细粒度：

- 不再按 domain 防抖
- 改成按 `conversationKey` 缓存结果
- TTL 可以保留 2 到 5 分钟

这样：

- 切到新会话时可以立刻重查
- 回到同一会话时又能避免重复请求

### UI 行为建议

当会话切换后命中新记忆，UI 建议采用：

1. 旧 bubble 立即移除
2. 新 bubble 从 `scale(0.85)` + `opacity(0)` 过渡到正常状态
3. 第一次出现时增加 1 次到 2 次轻微 pulse
4. 停止为静态 icon，避免持续打扰

建议动效：

- `slide-up + fade-in`
- `pulse ring` 只播放一次
- 用户点开后卡片展开
- 用户切会话时卡片自动关闭

## 推荐实现方式

### 方案 A：在 `contentScriptWebIntelligence.ts` 内直接增强

优点：

- 修改范围小
- 能快速验证

做法：

- 新增 RingCentral 专用检测分支
- 如果 `hostname === 'app.ringcentral.com'`，使用“会话级上下文提取”替代通用 `body snippet`
- 增加 bubble 清理和会话级重检逻辑

缺点：

- 通用网页逻辑和站点特化逻辑会继续混在一起

### 方案 B：引入站点适配器

更推荐：

```ts
interface SiteContextAdapter {
  matches(location: Location): boolean;
  watch(onContextMaybeChanged: () => void): () => void;
  getStableContext(): Promise<{
    contextKey: string;
    title: string;
    keywords?: string[];
    snippet?: string;
  } | null>;
}
```

默认实现：

- `GenericPageAdapter`

站点特化实现：

- `RingCentralConversationAdapter`

这样可以把：

- 通用网页探测
- RingCentral 会话探测
- 未来 Jira / Google Docs / Confluence 的动态上下文探测

统一到一个机制里。

## 可复用的现有能力

RingCentral 会话探测不需要从零开始写，当前代码里已经有可复用基础：

- `src/contentScriptGlip.tsx`
  - 已有 URL 变化监听
  - 已有 MutationObserver
  - 已经知道 RingCentral 消息卡片和消息容器结构

可直接借用的经验：

- 等待消息流渲染完成再处理
- 对 DOM 变化做防抖
- 对会话切换和消息新增分别处理

## 建议的最小实现步骤

1. 在 `contentScriptWebIntelligence.ts` 中抽出 bubble 的 `show / hide / update`
2. 新增 `clearContextBubble()`
3. 为 `app.ringcentral.com` 增加 `watchConversationSwitch()`
4. 使用 `URL + selected tab + heading + first message ids` 生成 `conversationKey`
5. 将 domain debounce 改为 `conversationKey` 级缓存
6. 使用会话消息摘要替换 body 前 300 字
7. 新匹配命中时播放一次 icon 动效

## 当前结论

当前“网页记忆提示”功能是**存在且在线的**，但它仍然是“页面级、首次加载式”的实现。

对普通静态网页，这个实现可以工作。

对 RingCentral 这种 SPA，会出现两个核心问题：

- 不会在会话切换后自动重检
- 旧会话的记忆 bubble 会残留到新会话

因此，后续演进方向应该明确为：

- 从**页面级探测**升级到**会话级探测**
- 从**域名防抖**升级到**上下文 key 防抖**
- 从**整页 snippet**升级到**会话消息摘要**

这才符合“切到某个聊天会话时，如果上面的聊天内容有相关记忆，则弹出记忆 icon 并通过动效提醒”的真实用户预期。
