# Meeting Pilot 补齐计划

## Summary

- 现状已完成的主链路：RingCentral meeting 检测、页内 overlay、P0/P1/P2 提醒层、hover 参会者 stance 卡片、side panel、live map、panorama、offscreen 录制、视频上传与 digest 轮询、`meeting` sourceType、`GET /api/v1/meetings` API。
- `UI/UX` 基本对齐的部分：`meeting-danmaku-alerts.html` 对应的 overlay / side panel 主视觉、时间线展开详情、记忆链接弹幕、panorama 的立场区块与 PDF 预览都已落地。
- 还未完整实现的部分：会议历史查询入口没有接到 `memory-exploring`；meeting 数据只在 digest `completed` 后才 ingest，没有按 plan 在会议结束即落库；长时间 digest 没有 background 持续轮询；配置缺失时没有 preflight/readiness 机制；真实 capture 启动仍把 `open panel` 和 `start capture` 绑死。
- 需要明确调整的实现差异：`chrome.sidePanel.open()` 现在从 service worker 消息链路调用，和 Chrome 官方要求的“只能在用户动作下调用”不一致，[Chrome sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) 已明确限制；当前 `SpeechRecognition.start()` 没传 `audioTrack`，按 [MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start) 会默认走麦克风，不是会议 tab 音频，因此不能当成可靠的会中转写降级。
- 文档现状：`.cursor/plans/meeting-pilot.PLAN.md` 明确写了“会议记录应存到 memory-service，并在 `memory-exploring` 提供 `📡 会议记录` 查询入口”；`docs/features/meeting_pilot.md` 只记录了 `GET /api/v1/meetings` API，没有记录用户可见入口；当前代码也确实没有 `memory-exploring` 路由/列表。
- 校验基线：`npm run test:meeting-pilot-memory` 已通过，但现有 harness 没覆盖 `sidePanel.open` 失败回退、history UI、preflight 缺配置、以及“会议结束先 ingest、后补 pdfUrl”这几条关键路径。

## Key Changes

- 修正 capture 启动链路。`开始 Capture` 必须先做 preflight，再单独启动 capture；`open side panel` 失败不能让 capture 整体判定失败。overlay 点击后默认行为改为：成功开启 capture，若 side panel 因平台限制打不开，则给出明确提示和备用入口，不再返回 fatal error。
- 收敛 `sidePanel` 打开策略。保留 `setOptions` 在 background 中配置 panel；`open()` 只放在真正能拿到扩展侧用户手势的入口里使用。overlay 路径不再假设能自动打开 side panel；popup 可以继续作为显式打开入口；如需一键展示主界面，fallback 用独立扩展窗口承载 `meeting-sidepanel.html`，不要继续依赖不稳定的 `sidePanel.open()`。
- 增加 `Meeting Pilot readiness / preflight`。idle overlay、popup card、side panel 顶部都展示 readiness 状态，区分 `Ready` / `Degraded` / `Blocked`。阻断项只包括：`MEETING_PILOT_ENABLED` 关闭、Minutes API 未配置或探活失败。降级项包括：Whisper 未配置或探活失败、analysis model 不可用、memory-service 不可用。
- 重做缺配置行为。缺 `Minutes API` 时不允许开始 capture；缺 Whisper 时允许进入“仅录制 + 低实时智能”模式，但不能再依赖当前 mic-based `SpeechRecognition` 假装支持会中转写；缺 memory-service 时允许 capture，但关闭 recall、历史写入状态提示为降级，并在 UI 中明确说明。
- 显式处理 analysis 依赖。当前代码隐式依赖 `MEETING_ANALYSIS_MODEL`，但 options/side panel 都没暴露；补齐为正式配置项，或改成固定内建默认并在 preflight 中验证 provider 是否支持该模型，避免“Whisper 能用、结构化分析全失败”的隐性故障。
- 改成“会议结束即落库”。capture stop 后立即把当前结构化数据 ingest 到 memory-service，`source_type='meeting'`，`group_id=meetingId`，metadata 先写 `digestId` 和 `pdfUrl: null`。不要等 digest `completed` 才落库，否则历史列表和 panorama 都会缺席。
- 把 digest 长轮询放回 background。offscreen 可以负责短链路上传，但 `pdfUrl` 的长轮询和 session 更新应由 background 继续维护；panorama 页面只负责展示和 opportunistic refresh，不应成为唯一的“补全 PDF 状态”入口。
- 补齐会议历史查询入口。`memory-exploring` 新增 `📡 会议记录` 导航、路由和列表页，直接调用 `getMeetings()`；列表展示标题、日期、参会者、digest/PDF 状态，并支持打开 panorama。当前 `memory-service` 的 `/meetings` 已够做第一版列表，不需要新增存储位置。
- 修正文案和入口一致性。popup 里现在 `Catch Up` 实际打开的是 `Live Map`，要改成真实动作名；panorama 页面里“可从 popup 历史记录入口重新打开”的文案在入口未落地前先移除；`Debug` tab 正式更名为 `Capture Log`。
- 清理 settings 责任边界。按 plan，side panel 的 settings 只保留个性化和会中行为配置；核心服务配置以 `options.tsx` 为唯一真源。若 side panel 继续显示 provider/minutes 字段，只做只读状态或跳转 options，不再双写 secrets。
- 真正按构建环境裁剪 debug。现有实现虽然有 `__DEV__`，但 `meetingSidePanel.tsx` 仍靠 `?debug=1` 渲染完整 debug 代码。改为编译期条件 + 动态 import，生产包不再包含 Capture Log 组件。
- 保持 demo 一致。`meeting-danmaku-alerts.html` 和 `meeting-panorama-view.html` 作为 UI 真源，后续侧重修正交互差异，不再另起风格分支；`meetingLiveMap` 继续沿用其独立 demo 视觉，但 popup/overlay 上的命名必须与实际页面一致。

## Test Plan

- 增加一个真实失败回归用例：overlay 点击 `开始 Capture` 时强制让 `sidePanel.open()` 抛出 user-gesture 错误，断言 capture 仍进入 `armed/recording`，overlay 显示非阻断提示。
- 增加 preflight 场景：分别验证 `Minutes API` 缺失、Whisper 缺失、memory-service 不可达、analysis model 不可达时的 `Blocked/Degraded` UI 和按钮可用性。
- 增加 persistence 场景：stop capture 后先出现 meeting history 项，`pdfUrl` 为空；background 轮询完成后 history/panorama 自动更新为 ready。
- 增加 `memory-exploring` 会议记录列表页测试：列表渲染、排序、状态 badge、点击打开 panorama。
- 调整现有 `scene2` harness，不再只用 `TEST_BOOTSTRAP_CAPTURE` 绕过真实启动链路，而是覆盖真实 `START_CAPTURE` + preflight + fallback。
- 保留并继续跑当前 meeting memory tests，确认 `/api/v1/meetings`、recall `sourceUrl`、ask evidence 行为不回退。

## Assumptions

- 会议历史的用户主入口确定为 `memory-exploring` 的 `📡 会议记录`，不是 side panel，也不是仅靠 popup。
- `Meeting Pilot` 不是“所有外部服务都齐了才能录制”的全硬阻断产品；默认策略是 `Minutes API` 为硬依赖，Whisper 和 memory-service 为可降级依赖。
- 当前 `SpeechRecognition` 实现不满足会议转写 fallback 要求，补齐时默认不再把它当作有效 meeting-audio transcript 方案；只有在确认浏览器支持 `start(audioTrack)` 且确实接入 tab audio track 时才保留。
- 主改动面集中在 [src/meeting-shell/background.ts](/Users/Esone/git/personal-ai/src/meeting-shell/background.ts), [src/meeting-shell/meetingOffscreen.ts](/Users/Esone/git/personal-ai/src/meeting-shell/meetingOffscreen.ts), [src/modals/memory-exploring-entry.ts](/Users/Esone/git/personal-ai/src/modals/memory-exploring-entry.ts) 及新增会议记录页面组件。
