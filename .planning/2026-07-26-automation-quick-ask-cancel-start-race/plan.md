# Quick Ask 语音启动取消竞态修复

## 体验问题

作为习惯在开会间隙用 Quick Ask 口述待办的用户，我会在误触麦克风后立刻点叉号返回文本输入。当前 renderer 先把界面切到语音态，但要等 native helper 回传 `started` 才标记为真正监听；如果取消发生在这段间隙，取消请求不会发给 helper，迟到的 `started` 或 transcript 回调还能把已退出的 voice sheet 重新打开。

这会让用户误以为已经取消的本机听写仍在运行，破坏“语音草稿不会自动发送、可随时返回文本输入”的承诺。

## 实施步骤

1. 在 `VoiceController` 中显式追踪当前 renderer 是否仍接受语音 helper 回调；启动和重试启用，取消、重置和退出关闭。
2. 取消时无论 helper 是否已发送 `started` 都发送 `quick-ask:voice-cancel`，立即回到文本输入；忽略这次会话随后迟到的开始、转写、停止和错误回调。
3. 在现有 Quick Ask 端到端脚本中模拟“立即取消后 helper 才回调”，断言界面仍为文本态、草稿未被注入、也未发起 Ask。
4. 更新 Doubao Bridge 功能文档，明确启动中的取消同样会立即停止并屏蔽迟到回调。

## 验证

- `node --check desktop-app/app/quick-ask.js`
- `npm --prefix desktop-app run test:quick-ask-status-card`
- `npm --prefix desktop-app run test:quick-ask-resume`
- `git diff --check`（限定本次文件）
