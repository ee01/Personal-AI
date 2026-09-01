# RingCentral Native Join

_最后更新: 2026-09-01_

## 是什么

`RingCentral Native Join` 用于把 RingCentral Web 中的 Video 加会入口改为本机 RingCentral app 打开。

当用户点击可识别的 `https://v.ringcentral.com/join/...`、`https://v.ringcentral.com/launcher/...` 或 `https://v.ringcentral.com/conf/on/...` 入口时，扩展会转换为 `rcvdt://join/...`，交给 macOS 上已安装的 RingCentral native client 处理。Google / Outlook Safe Links 这类 redirect-wrapper 如果在 `q`、`url`、`target`、`redirectUrl` 等常见参数里包着 RingCentral Video 链接，也会先保守解包，再走同一套可信 host 和 meetingId 校验。

打开 native client 时，页面会显示一个 `Opening RingCentral app...` 兜底浮层，并带有 `Handoff receipt`：它说明如果 Chrome 弹出外部 app 提示，应选择打开 RingCentral；这次点击会把已校验的完整会议链接交给 RingCentral app（包含 passcode/附加参数，如果原链接存在），但网页无法确认 app 是否真的接管或用户是否已经入会，所以浏览器恢复入口会保留；浮层里展示的链接会隐藏 passcode/附加参数，但恢复动作仍使用完整链接；默认加会路径还没有被改变。5 秒后如果原网页已经隐藏或失焦，系统认为用户已交给本机 app 加会并自动收起浮层；如果页面仍可见且聚焦，浮层会保留，并把标题切到 `RingCentral app did not take over`，回执也会切到“当前 tab 没检测到接管，但这不证明 app 失败或用户没有在别处入会”的恢复口径，继续提供 `Join in browser`、复制链接和可复制 `Meeting ID`，同时出现 `Try app again` 让用户显式重试同一个已规范化的 app handoff。`Meeting ID` 区块会先说明它只是手动 app 输入材料；如果原链接带常见 passcode 参数，浮层会额外显示 `Meeting passcode` 的隐藏值行，只能通过 `Copy passcode` 显式复制，不会默认把口令渲染到屏幕上。`Copy ID` 只复制会议 ID；`Copy passcode` 只复制手动 app 输入用的 passcode；两者都不代表已入会、不复制完整 URL，也不改变默认加会路径。完整参数仍只在 `Join in browser`、`Copy link` 或显式 `Show full link` 中保留。用户也可以点右上角 `x` 手动关闭；关闭后会留下一个短暂的 `RingCentral handoff hidden` 恢复条，说明没有确认已入会、默认路径未变，并提供 `Restore recovery`。恢复只重建浏览器恢复/复制/重试控件，不会重新触发 native app、打开浏览器、复制链接或改默认设置；用户仍需显式点 `Try app again` 才会重试 app。兜底浮层会限制在当前视窗内并允许内部滚动，保证浏览器加入、复制、Meeting ID、passcode 和默认路径切换在矮窗口或浏览器缩放时仍可到达。一旦用户选择浏览器加入、复制浏览器会议链接、复制 Meeting ID、复制 passcode、显式展开完整链接，或切换默认加会路径，浮层会进入手动恢复状态并取消自动消失，避免恢复操作进行中被收走。连续点击不同会议入口时，新浮层会先清理上一个浮层的计时器和临时 native launch link，避免旧 handoff 的异步清理影响当前恢复入口。`Join in browser` 会先打开新的浏览器窗口、断开 opener，再跳到 Web 会场；如果新窗口已打开，原页会留下短暂的 `Browser join requested` 回执，说明只是发起浏览器加会窗口、仍未确认用户已入会、没有重试 app 或改变默认路径，并可恢复 recovery 控件；从这个回执恢复时，面板会明确写成“从浏览器请求恢复”，并说明没有再次打开浏览器窗口、没有重试 app、旧浏览器请求仍未确认；如果浏览器拦截了新窗口，会自动改为在当前 tab 打开。浏览器兜底会直接打开 `https://v.ringcentral.com/conf/on/:meetingId`，避开 RingCentral `/launcher/:meetingId` 中间页。

兜底浮层默认只展示去掉 query/hash 的安全浏览器会场地址，避免在共享屏幕上直接暴露 `passcode` 等会议参数；`Join in browser` 和 `Copy link` 仍使用完整链接。`Copy link` 成功后会明确回执：复制的是完整 browser meeting link（包含隐藏的 passcode/details，如果原链接存在），但这不会加入会议、不会重试 app、也不会改变默认加会路径。如果用户确实需要手动检查或选择完整 URL，可以点 `Show full link` 显示，再点 `Hide full link` 收起。如果浏览器或权限导致 `Copy link` 写入剪贴板失败，浮层会自动展开完整 browser link，并提示这是手动复制状态，避免用户只复制到去掉 passcode 的展示链接。

2026-07-10 补充：`Join in browser`、`Copy link` 和恢复态的 `Try app again` 按钮自身也有 hover / 读屏边界。它们分别说明会打开新的浏览器窗口、复制完整但默认隐藏细节的恢复链接，或重试已校验的 app handoff；这些按钮都不确认用户已入会、不隐式复制额外材料、不改变默认加会路径。

2026-07-12 补充：手动恢复控件也补齐同级按钮边界。`Copy ID`、`Copy passcode`、`Show full link` / `Hide full link`、右上角关闭、紧凑恢复条的 `Restore recovery`，以及 `Use browser by default` / `Use app by default` 都在 hover / 读屏里说明当前点击只复制指定材料、只本地显示/隐藏完整链接、只恢复控件，或只保存未来偏好；它们不会确认已入会、不会隐式重试 app、不会打开浏览器、不会复制额外会议材料，也不会改变当前会议的恢复事实。

2026-07-14 补充：RingCentral Video Home 里能匹配到已校验会议链接的 `Join` / `Join meeting` 按钮，在点击前也会通过 hover / 读屏说明 Personal AI 会先尝试 RingCentral app、Chrome 可能弹出外部 app 提示、浏览器恢复与 Meeting ID/passcode 路径仍保留、隐藏链接细节不会默认展开，并且这次点击不确认已入会、不复制会议材料、不改变默认加会路径。

浮层里的默认路径切换是可撤销的：点 `Use browser by default` 后会写入同一个 Native Join 开关，并立刻切换成 `Use app by default`，误点时不需要离开当前页面去 Options 找回。保存 app-first / browser-first 默认路径或保存失败时，面板会单独显示 `Default path receipt`：它把这次操作绑定为“未来 RingCentral 加会偏好写入”，同时说明本次点击没有加入当前会议、没有重试 app、没有打开浏览器窗口、没有复制会议材料，也没有移除当前恢复控件。Glip rich invite 这类运行在页面上下文的入口会通过 content script 桥接写入 extension storage，避免按钮看似保存但实际没有改变默认路径。如果保存默认路径失败，回执会明确说明默认设置没有改变，本次点击没有加入会议、重试 app、打开浏览器会议或复制会议材料，当前恢复控件仍可继续使用。

## 大白话运行逻辑

这个功能做的事很单一：用户点 RingCentral 网页里的入会链接时，优先尝试用本机 RingCentral app 打开，并短暂保留浏览器兜底入口；如果浏览器页面已离开焦点，浮层 5 秒后自动消失；如果用户仍停在原页面，浮层会升级为恢复提示而不是收走。

结果主要受这些因素影响：

1. 开关状态：`MEETING_NATIVE_CLIENT_JOIN_ENABLED` 关闭时完全不拦截。
2. 链接是否可识别：只有可信 `v.ringcentral.com` 的 `/join`、`/launcher`、`/conf/on` 会被转换。
3. meetingId 是否安全：异常 scheme、异常 path、过长或不安全 meeting id 不会透传给 native scheme。
4. 浏览器外部协议策略：Chrome 可能要求用户确认打开 `rcvdt://`，扩展无法绕过。
5. 兜底路径可用性：native 是否安装无法可靠探测，所以 5 秒后会结合 `document.visibilityState` / `document.hasFocus()` 判断是否像是已经离开浏览器；仍停在原页面时必须继续保留 Web fallback；一旦用户进入恢复操作，浮层必须取消自动消失。
6. App 重试：只有进入“未检测到接管”的恢复态后才显示 `Try app again`；点击只重放当前已校验的 `rcvdt://` 链接、重启 handoff 检测，不打开浏览器兜底、不复制材料、不改变默认路径，也不移除浏览器恢复。
7. 交接回执：浮层要把“Chrome 提示该选什么 / 已尝试打开 app / native handoff 使用完整会议链接 / 无法验证 app 接管或实际入会 / 浏览器恢复仍可用 / 默认路径未自动改变”放在同一个可见位置，避免用户把 external-protocol 提示取消误读成已经失败或已经改设置。
   RingCentral Video Home 的原始 `Join` 控件也要在点击前带同一类 hover / 读屏边界，避免用户直到 app handoff 已触发后才知道这是 app-first 路径。
8. 链接隐私：完整浏览器链接可能带有 passcode 或其他 query/hash，默认不在浮层正文里展示，但恢复按钮和复制动作必须保留这些参数。
9. 手动恢复：`Copy link` 成功时必须说明复制的是完整恢复链接且不代表已入会或改默认路径；如果剪贴板写入失败，当前操作已经越过“默认隐藏完整链接”的安全展示层，系统会临时展开完整链接并提醒复制后再隐藏，保证恢复链接仍可用。
10. 外层跳转包装：只解包常见 redirect 参数；外层域名本身不被当作可信会议来源，解出的目标仍必须是 `v.ringcentral.com` 的安全会议路径。
11. 点击归属：会议必须来自用户点到的那个入口本身，不能从页面别处「漂移」过来。判定分三层：点到 `<a>` 时只认这个链接自己的 `href`，不扫描它内部的文字或子链接；点到按钮类元素时，它的 `aria-label` / `title` / 文本必须读起来就是加会动作（以 `join` 开头且长度有限），仅仅名字里含 `join` 的会话（例如 `Room Smart Join - QR Code`）不算；确认是加会控件后，只在这个控件和它自己的会议卡片内找链接，不再向上遍历共同祖先。如果同一范围里出现多个不同 meetingId，视为无法归属，直接放行 RingCentral 原生点击。
12. 手动 App 加会：兜底浮层会展示并可复制已校验的 Meeting ID；如果完整链接里有常见 passcode 参数，也会显示隐藏值的 `Copy passcode`。两者都只是手动输入材料，不会自动加入会议，不会复制完整 URL，也不会改默认路径。原链接带隐藏参数时，完整恢复材料仍走 `Join in browser` / `Copy link` / `Show full link`。
13. 视窗可达性：恢复面板内容多于可视高度时只让面板内部滚动，不把 `Join in browser`、`Copy link`、`Copy ID` 或默认路径切换挤出屏幕。
14. 误关恢复：关闭浮层只隐藏完整恢复面板，不证明 app 已接管；短暂恢复条保留 `Restore recovery`，关闭和恢复按钮本身会说明不会自动重试 app、打开浏览器、复制材料、确认入会或改变默认路径。
15. 浏览器兜底请求：`Join in browser` 成功打开新窗口后，原页只显示短暂请求回执；按钮 hover / 读屏文案会在点击前说明这是新的浏览器窗口请求，不等于确认已进入会议，也不会重试 app、复制链接或改变默认路径。用户从该回执恢复 recovery 面板时，面板要保留“浏览器请求仍未确认”的来源口径，而不是复用“隐藏后恢复”的文案。
16. 默认路径回执：保存 `Use browser by default` / `Use app by default` 或保存失败时，界面要把这次操作明确成未来偏好写入；它不改变当前会议的 handoff 事实，也不自动触发入会、app retry、浏览器窗口、复制或恢复控件移除。

## 开关

配置项：`MEETING_NATIVE_CLIENT_JOIN_ENABLED`

入口：`Options -> Meeting Pilot -> 优先用 RingCentral app 加会`

默认开启。关闭后扩展不再拦截 RingCentral Web 的加会入口，恢复 RingCentral Web 原始点击行为。兜底浮层里的 `Use browser by default` 会写入同一个配置，相当于关闭 Options 里的这个开关；保存后同一浮层会显示 `Use app by default`，可直接恢复 native app 优先。

## 覆盖范围

当前覆盖三类入口：

1. Glip / Messages 中直接出现的会议链接：
   - `https://v.ringcentral.com/join/:meetingId`
   - `https://v.ringcentral.com/launcher/:meetingId`
   - `https://v.ringcentral.com/conf/on/:meetingId`
2. Glip / Messages 中的 `join call` rich invite 卡片。
3. `https://app.ringcentral.com/video/home/` 会议列表、会议详情页里的 `Join` 按钮。

## 实现方式

- 共享解析逻辑在 `src/ringcentralNativeJoin.ts`。
- Glip 普通链接由 `src/contentScriptGlip.tsx` 捕获 click。
- Glip rich invite 卡片需要在页面上下文读取 RingCentral React props，逻辑在 `src/glipNativePopoutPage.ts`。
- Video Home 由于是 SPA/PWA，`src/contentScriptRingCentralVideoHome.ts` 会在 `app.ringcentral.com/*` 注入并监听路由变化；因为 content script 的 isolated world 不能可靠拦截页面自身的 React Router `pushState`，这里同时用短间隔 URL 轮询兜底，覆盖“刷新 Messages 页面后切到 Video Home”的路径。会议列表优先用 DOM 上的 `data-calendar-event-item-id` 匹配 RingCentral 本地 Calendar IndexedDB event；如果按钮没有稳定的测试属性，会退回到可见的 `Join` button 语义识别。会议详情页会从详情 DOM、当前 `/video/home/:eventId` 路由或当前选中的会议回查 event。会议链接提取会检查 `joinUrl`、`meetingUrl`、`meetingUri`、`location`、`description`，并递归扫描 event 嵌套字段中的 RingCentral Video URL / meetingId。相关逻辑在 `src/contentScriptRingCentralVideoHome.ts` 和 `src/context-assist/ringCentralCalendar.ts`。
- Native scheme 触发使用当前用户点击链路中的临时顶层链接，不依赖 iframe 发起外部协议导航。
- 解析层只接受 `https://v.ringcentral.com/...`、`http://v.ringcentral.com/...` 和规范化后的 `rcvdt://join/:meetingId`；`http` 入口会在浏览器兜底里升级为 `https`，`/join`、`/launcher` 和 `/conf/on` 输入都会归一到直接浏览器会场 `https://v.ringcentral.com/conf/on/:meetingId`，其他 scheme 即使 host 看起来正确也不会被转换。meetingId 只允许短的安全字母、数字、`-`、`_` 片段，native scheme 也必须只有一个 meetingId path 片段，避免异常 path 被原样透传给 app 重试。提取逻辑会兼容 DOM/JSON 里常见的转义斜杠、`\u003f` / `\u003d` / `\u0026` 标点转义、百分号编码 URL，以及 Google / Outlook / 安全扫描器常见 redirect 参数里的内层会议链接；解包后仍统一回到可信 host 校验。

## 验证

- `npm run verify:ringcentral-native-join-glip-click`：用 Playwright 加载 `dist/contentScriptGlip.js`，在一个「左侧会话列表 + 当前会话」共享祖先的 fixture 上验证点击归属。它断言点名字含 `join` 的会话不会触发 app handoff 且能正常导航，同时会话里贴的会议链接和会议卡片上的 `Join` 按钮各自仍然交给正确的 meetingId。
- `npm run verify:ringcentral-native-join:e2e`：Video Home 的 `Join` 按钮与兜底浮层 E2E。
- 两个脚本都读 `dist/`，跑之前先用 `npm start` 编译一次。

## 产品参考

- RingCentral、Teams 和 Zoom 都把浏览器加入作为无下载或失败恢复路径呈现；本功能保持 native 优先，同时把 Web fallback 做成短暂可见但可恢复的入口：已离开浏览器时自动收起，仍停在原页面时保留恢复按钮，并用交接回执说明当前只是“尝试打开 app”，避免 external-protocol 被取消或没有安装 app 时用户被卡住。Teams / Zoom 这类入会页也会把 app 打开和浏览器加入作为可重复选择的恢复路径；Teams 还保留 Meeting ID + passcode 的手动加入路径，因此本功能补了只复制 Meeting ID 的恢复动作，并在完整链接含常见 passcode 参数时补一个隐藏值的 `Copy passcode`，但仍不把 passcode 默认展示出来。2026-07-01 再核对 RingCentral browser join、Zoom browser join、Teams `Continue on this browser` / Meeting ID fallback、USENIX deep-link hijacking 论文和 Android deep-link 安全建议后，关闭恢复面板也不能被当成“已成功加会”：UI 应保留一个轻量恢复条，同时继续把 custom scheme handoff 视为未确认执行。
- Teams Rooms 文档也提醒，安全扫描器或 URL 包装可能让第三方会议链接变得不可识别；本功能只恢复包装里的 RingCentral Video 内层链接，不把外层跳转域加入白名单。
- 深链研究和安全资料反复强调 deep link 覆盖、稳定性、失效反馈和 scheme hijack 风险；本功能只从可信 RingCentral Video host 提取 join URL，并尽量把失败恢复路径留在浏览器内。

参考链接：RingCentral 的 [browser join 说明](https://www.ringcentral.com/us/en/blog/ringcentral-meetings-from-any-browser/)、Zoom 的 [Join from your browser](https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0067293)、Teams 的 [Join with a meeting ID](https://support.microsoft.com/en-us/teams/meetings/join-a-meeting-in-microsoft-teams)、USENIX Security 2017 的 [deep link insecurity paper](https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/liu)。

## 边界

- 如果 Chrome 第一次打开 `rcvdt://`，可能会显示外部协议确认，这是浏览器安全策略。
- 浏览器和扩展无法可靠判断 native client 是否真的安装或成功打开，因此不会做安装探测，只提供 Web 兜底入口。
- `Try app again` 不重新解析页面链接，也不会放宽 host / meetingId 校验；它只重放本次点击已经生成的 native URL。
- `Restore recovery` 只恢复本页控件，不重新打开 app、不打开浏览器、不写剪贴板、不改变默认加会路径，也不确认用户已经入会；如果恢复来源是 `Browser join requested`，还要说明此前浏览器窗口请求仍未被 Personal AI 确认。
- `Browser join requested` 只说明浏览器会场窗口已请求打开；它不证明新窗口加载成功、不确认用户已入会，也不会自动重试 app、复制链接或保存默认路径。
- `Use browser by default` / `Use app by default` 只保存未来 RingCentral 加会偏好；当前会议的恢复面板、浏览器链接、Meeting ID/passcode 和 app retry 仍按用户显式动作执行。
- `Copy ID` 不等于加入会议，也不复制 passcode、query/hash、浏览器链接或外部执行凭据；`Copy passcode` 只在完整链接含常见 passcode 参数时出现，只复制 passcode 本身，不复制完整 URL、不重试 app、不改变默认路径；需要完整邀请参数时仍用 `Join in browser`、`Copy link` 或显式 `Show full link`。这些手动恢复按钮的 hover / 读屏文案会重复说明上述边界。
- 为了减少共享屏幕时泄露会议参数，兜底浮层默认隐藏完整 URL 的 query/hash；但用户点 `Show full link` 后仍可能看到完整链接，需要自行判断当前屏幕环境。
- 窄屏或矮窗口里，恢复浮层会在视窗内滚动；这只改变恢复控件可达性，不改变 native handoff、浏览器加入、复制或默认路径保存语义。
- 扩展只能拦截 Web 页面 DOM / React 里的入口；如果 RingCentral native app 或系统级弹窗本身不是 Web 页面，Chrome extension 无法注入拦截。
- RingCentral PWA / 独立来电弹窗中的 `Answer` 不在当前支持范围内，保留 RingCentral 原始行为。
- 找不到可验证会议链接时，扩展不会阻止 RingCentral Web 的默认点击行为。
- 拦截范围只覆盖用户点到的入口自身及其会议卡片。左侧会话列表、导航项这类只是名字里带 `join` 的元素不会被当成加会控件，点击它们仍然正常打开会话；页面上别处（包括当前打开的会话）出现的会议链接也不会被算到这次点击头上。
