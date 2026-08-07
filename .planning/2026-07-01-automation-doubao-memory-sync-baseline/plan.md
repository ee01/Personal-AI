# Doubao Memory Sync Thread 首次同步基线计划

## 目标功能

- 随机选中：`Memory Sync Thread`（`docs/index.md` -> `docs/features/doubao_bridge.md`）
- 用户路径：Desktop App 中的 `绑定长期记忆线程` 卡片，负责 `memory_sync_thread` 和 `stable_memory` / persona 同步。

## 已确认状态

- `docs/progressing/to-verify.md` 当前为空。
- 本机 Reminders 可读，但没有 `Personal AI` 列表，所以没有可纳入或标记完成的 Reminder item。
- 当前 worktree 已有大量非本轮脏改，本轮只追加一个 `.planning` 目录并修改目标功能相关文件。

## 外部参考

- ChatGPT Memory / saved memories、Claude memory、Gemini saved info 都把长期记忆做成可见、可管理、可删除或可关闭的状态，而不是隐式把一次绑定当成已经写入。
- Mem0、LongMemEval 等长期记忆研究强调 extraction、update、refusal、provenance 和长期可审计性；对应到本功能，首次绑定后需要显式区分“线程可用”和“稳定记忆已经送达/跳过/失败”。

## 改进计划

1. 在 `renderMemoryThreadDetail` 中识别 `memory_sync_thread` 已绑定但没有任何 `stable_memory` recent attempt 的状态。
2. 将卡片标题/徽章从普通“已绑定 / 可审计”细化为“待首推 / 未投递”，避免用户误以为 persona 已经同步。
3. 增加 `首次同步基线` 回执：
   - 当前只确认线程绑定；
   - 还没有 `stable_memory` 自动或手动同步流水；
   - 下一步依赖 Memory Service、豆包登录和首推；
   - 无稳定内容只记 skipped，不发送空占位；
   - 不写 `mobile_context_thread`，不把建线 seed 当作 persona 同步。
4. 扩展 `desktop-app/scripts/doubao-source-toggle-gating-check.mjs`，模拟无 `stable_memory` attempt 的首推前状态并断言新回执。
5. 更新 `docs/features/doubao_bridge.md`，只记录用户可见行为，不展开过度实现细节。
6. 验证顺序：
   - `node --check desktop-app/app/renderer.js`
   - `node --check desktop-app/scripts/doubao-source-toggle-gating-check.mjs`
   - `npm --prefix desktop-app run test:source-toggle-gating`
   - `npm start -- --progress` 首次成功编译后停止
   - scoped `git diff --check`
