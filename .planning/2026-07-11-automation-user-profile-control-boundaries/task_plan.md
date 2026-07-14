# 用户画像条目控制点边界

## 目标

本轮随机扫中 `docs/features/index.md` 的 `用户画像条目`。`docs/progressing/to-verify.md` 当前为空；本机 `Personal AI` Reminders 共有 4 条、0 条未完成，历史 Doubao / 通知反馈与用户画像条目无关。

## 业内与论文信号

- OpenAI Memory FAQ 强调用户能查看、编辑、删除、搜索/排序、优先或降权记忆，并且 memory summary 不等于所有潜在来源。
- Claude memory import/export 强调迁移、备份、查看和编辑时要保留“AI 实际看到什么”的路径，并提示导入仍可能有遗漏。
- Response-Aware User Memory Selection 指出画像/记忆选择不能只按语义相似度，要看对响应质量的实际效用。
- MemFlow 将 profile lookup、targeted retrieval 和 deep reasoning 分层，说明画像条目应该有场景预算和路由边界。
- Mem0 / MemoryBank 都强调长期记忆需要选择性提炼、强化、遗忘和画像更新；用户界面不能把当前可见切片伪装成完整记忆。

## 改进 Plan

1. 不改画像后端数据模型、确认规则、导出分页和 Memory Service 路由，只做前端控制点可见性。
2. 在 `UserProfilePage.vue` 给导出、搜索、状态筛选、排序、清除、加载全部、查看已排除、显示更多控件补动态 `title` / `aria-label`。
3. 文案必须说明：
   - 当前搜索/筛选只匹配已加载切片，加载全部前不能证明全库不存在。
   - 搜索、筛选、排序、显示更多只改变本地显示，不确认、排除或写入画像。
   - 导出会重新分页请求全部状态，不受当前筛选/切片限制；本地 JSON 不会恢复、删除、同步或发送画像。
   - 加载全部是只读扩页，不写 USER_CORE，不刷新证据，不调用外部 provider。
4. 扩展 `tools/verify-user-profile-export-e2e.mjs`，断言这些控件的 `title` / `aria-label`。
5. 更新 `docs/features/user_profile_system.md` 和 `docs/features/index.md`，保持描述简洁。
6. 验证：`node --check tools/verify-user-profile-export-e2e.mjs`、`npm start -- --progress` 首次成功后停止、`node tools/verify-user-profile-export-e2e.mjs`、scoped `git diff --check`。

## 非目标

- 不改变 `/api/v1/profile/items`、`/api/v1/profile/core`、导出 manifest、确认/排除/恢复 API。
- 不引入新的画像排序、LLM eval 或记忆选择算法。
- 不标记 Reminder 完成，因为本轮没有未完成且相关的 Reminder item。
