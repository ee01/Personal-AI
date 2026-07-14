# Findings

- 虚线卡片 DOM 在 `src/contentScriptGlip.tsx` 的 `renderGlipPendingScheduledMessages` 中生成；它读取 `GlipMessageMarkerService` 缓存的 `pendingScheduledByChatId[chatId]`。数组为空时会移除所有 `.pai-glip-pending-scheduled-list`（约 4107-4130 行）。
- 卡片文案、时间标签、虚线 bubble 和“管理”按钮均由 `contentScriptGlip.tsx` 生成（约 4152-4208 行）；截图与这一实现完全吻合。
- 初始渲染会在内容脚本语言初始化、定时创建事件、后续 DOM/缓存监听路径上触发；需要继续追踪哪个路径在真正发送后更新缓存。
- 缓存服务定义了 `PENDING_SCHEDULED_RETENTION_AFTER_DUE_MS = 6h`，说明仅靠时间裁剪不会在到点立刻删除；真正的“已发送”同步逻辑仍需继续确认。
- `background.ts` 每 5 分钟运行 `refreshGlipMessageMarkers`。刷新会读取 Scheduled Messages 的最近 500 条 Push Logs，把 `Status === 'Success'` 的 `Message_ID` 传给缓存裁剪；`GlipMessageMarkerService` 以 messageId 命中后删除虚线卡片来源记录。
- 内容脚本监听 `chrome.storage.local` 的 `glipMessageMarkers` 变化，缓存更新后再防抖 500ms 重新渲染；此时 `pendingMessages.length === 0` 才真正移除 DOM。因此正常消失不是看到 Glip 真消息即刻触发，而是“执行日志成功 -> 周期刷新 -> storage 更新 -> 500ms 重绘”。
- 页面初次初始化也会主动请求一次 `REFRESH_GLIP_MESSAGE_MARKERS`，所以重进/刷新页面可能比等待下一轮 5 分钟 alarm 更快触发清理。
- `docs/features/scheduled_messages_manager.md` 是 canonical 文档，但当前关键词检索没有发现输入框闹钟、虚线待发送卡片或 `ComposeScheduled` 的说明；旧 roadmap 只在较早规划中提过“输入框旁定时回复按钮”。
- App Script 在一次执行结束时调用 `insertPushLog`，成功写 `Status='Success'` 且 `Message_ID=rowData.ID`；这正是 background 清理 pending 记录所匹配的主键。失败日志不会移除占位。
- 5 分钟 alarm 只是 background 的缓存同步节奏；卡片删除不看 Glip DOM 中是否已经出现相同正文，也不看计划时间是否已到。新真实消息到来只会触发重新读取当前本地缓存，因此成功日志尚未进入缓存时仍会继续显示。
- 安全兜底是到期后保留 6 小时再按时间裁剪；它防止缺失/无法读取 Logs 时无限残留，但也意味着日志匹配失败时可能显示很久。
- 完整视觉规格在 `docs/progressing/glip-compose-scheduled-pending-animation-demo.html`：输入框闹钟约 723-730 行、虚线未来卡约 665-691 行、视觉含义约 270-348/742-744 行；该 demo 没有真实发送后消失规则。
- canonical `docs/features/scheduled_messages_manager.md` 仅在未来规划中同时写 `[ ] RingCentral 聊天界面集成` 与 `[x] 一键定时回复按钮`（约 866-867 行），状态有歧义；`docs/features/index.md` 也没有这两个当前能力条目。
- 文档收口采用窄删除范围：`glip-compose-scheduled-pending-animation-demo.html` 是本能力唯一直接 progressing 产物；`schedule-messages-potential-requirements.md` 是覆盖多种 Glip 场景的大清单，`scheduled-messages-channel-activation-*` 是独立的通道激活方案，均不应因本次收口被误删。
