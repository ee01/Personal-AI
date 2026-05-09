# RingCentral Native Join

_最后更新: 2026-05-09_

## 是什么

`RingCentral Native Join` 用于把 RingCentral Web 中的 Video 加会入口改为本机 RingCentral app 打开。

当用户点击可识别的 `https://v.ringcentral.com/join/...` 或 `https://v.ringcentral.com/conf/on/...` 入口时，扩展会转换为 `rcvdt://join/...`，交给 macOS 上已安装的 RingCentral native client 处理。

## 开关

配置项：`MEETING_NATIVE_CLIENT_JOIN_ENABLED`

入口：`Options -> Meeting Pilot -> 使用 Native Client 加会`

默认开启。关闭后扩展不再拦截 RingCentral Web 的加会入口，恢复 RingCentral Web 原始点击行为。

## 覆盖范围

当前覆盖三类入口：

1. Glip / Messages 中直接出现的会议链接：
   - `https://v.ringcentral.com/join/:meetingId`
   - `https://v.ringcentral.com/conf/on/:meetingId`
2. Glip / Messages 中的 `join call` rich invite 卡片。
3. `https://app.ringcentral.com/video/home/` 会议列表、会议详情页里的 `Join` 按钮。

## 实现方式

- 共享解析逻辑在 `src/ringcentralNativeJoin.ts`。
- Glip 普通链接由 `src/contentScriptGlip.tsx` 捕获 click。
- Glip rich invite 卡片需要在页面上下文读取 RingCentral React props，逻辑在 `src/glipNativePopoutPage.ts`。
- Video Home 会议列表用 DOM 上的 `data-calendar-event-item-id` 匹配 RingCentral 本地 Calendar IndexedDB event；会议详情页会从详情 DOM 或当前 `/video/home/:eventId` 路由回查 event，再从 `joinUrl`、`location` 或 `description` 提取会议链接，逻辑在 `src/contentScriptRingCentralVideoHome.ts` 和 `src/context-assist/ringCentralCalendar.ts`。

## 边界

- 如果 Chrome 第一次打开 `rcvdt://`，可能会显示外部协议确认，这是浏览器安全策略。
- 扩展只能拦截 Web 页面 DOM / React 里的入口；如果 RingCentral native app 或系统级弹窗本身不是 Web 页面，Chrome extension 无法注入拦截。
- RingCentral PWA / 独立来电弹窗中的 `Answer` 不在当前支持范围内，保留 RingCentral 原始行为。
- 找不到可验证会议链接时，扩展不会阻止 RingCentral Web 的默认点击行为。
