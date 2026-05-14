# RingCentral Native Join

_最后更新: 2026-05-12_

## 是什么

`RingCentral Native Join` 用于把 RingCentral Web 中的 Video 加会入口改为本机 RingCentral app 打开。

当用户点击可识别的 `https://v.ringcentral.com/join/...` 或 `https://v.ringcentral.com/conf/on/...` 入口时，扩展会转换为 `rcvdt://join/...`，交给 macOS 上已安装的 RingCentral native client 处理。

打开 native client 时，页面会显示可关闭的兜底浮层；如果本机 app 未安装、外部协议弹窗被取消，或 native client 没有正常接管，用户可以选择 `Join in browser`。该按钮只打开一个新的浏览器窗口，并会关闭当前兜底浮层；浏览器兜底会直接打开 `https://v.ringcentral.com/conf/on/:meetingId`，避开 RingCentral `/launcher/:meetingId` 中间页。

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
- Video Home 由于是 SPA/PWA，`src/contentScriptRingCentralVideoHome.ts` 会在 `app.ringcentral.com/*` 注入并监听路由变化；因为 content script 的 isolated world 不能可靠拦截页面自身的 React Router `pushState`，这里同时用短间隔 URL 轮询兜底，覆盖“刷新 Messages 页面后切到 Video Home”的路径。会议列表优先用 DOM 上的 `data-calendar-event-item-id` 匹配 RingCentral 本地 Calendar IndexedDB event；如果按钮没有稳定的测试属性，会退回到可见的 `Join` button 语义识别。会议详情页会从详情 DOM 或当前 `/video/home/:eventId` 路由回查 event。会议链接提取会检查 `joinUrl`、`meetingUrl`、`meetingUri`、`location`、`description`，并递归扫描 event 嵌套字段中的 RingCentral Video URL / meetingId。相关逻辑在 `src/contentScriptRingCentralVideoHome.ts` 和 `src/context-assist/ringCentralCalendar.ts`。
- 解析层只接受 `https://v.ringcentral.com/...`、`http://v.ringcentral.com/...` 和已生成的 `rcvdt://join/...`；`http` 入口会在浏览器兜底里升级为 `https`，其他 scheme 即使 host 看起来正确也不会被转换。

## 产品参考

- RingCentral、Teams 和 Zoom 都把浏览器加入作为无下载或失败恢复路径呈现；本功能保持 native 优先，但必须让 Web fallback 一直可见。
- 深链研究和安全资料反复强调 deep link 覆盖、稳定性、失效反馈和 scheme hijack 风险；本功能只从可信 RingCentral Video host 提取 join URL，不把任意 URL 或敏感 token 透传给外部协议。

## 边界

- 如果 Chrome 第一次打开 `rcvdt://`，可能会显示外部协议确认，这是浏览器安全策略。
- 浏览器和扩展无法可靠判断 native client 是否真的安装或成功打开，因此不会做安装探测，只提供 Web 兜底入口。
- 扩展只能拦截 Web 页面 DOM / React 里的入口；如果 RingCentral native app 或系统级弹窗本身不是 Web 页面，Chrome extension 无法注入拦截。
- RingCentral PWA / 独立来电弹窗中的 `Answer` 不在当前支持范围内，保留 RingCentral 原始行为。
- 找不到可验证会议链接时，扩展不会阻止 RingCentral Web 的默认点击行为。
