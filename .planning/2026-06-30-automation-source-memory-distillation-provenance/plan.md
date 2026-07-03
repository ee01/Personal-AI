# Source Memory Distillation Provenance Plan

## 目标功能

- 随机选择：`Source Memory 蒸馏器`
- 所属能力：Memory Capture
- 功能文档：`docs/features/memory_capture.md`

## 当前状态

- `docs/progressing/to-verify.md` 为空，没有待接续校验项。
- 本机 Reminders 可读，但没有 `Personal AI` 列表；本轮无 Reminder 条目可合并或标记完成。
- `metadata.distillation` 已包含 `generatedAt`、`sourceAsOf` 和 `inputHash`，但资料详情页只展示生成时间，不展示“基于哪一版来源资料/备注生成”。

## 外部参考

- ChatGPT Memory sources 把个性化来源、可管理性和历史版本放在用户可见控制里：https://help.openai.com/en/articles/8590148-memory-faq
- Readwise Reader / Web Clipper 类产品把保存内容、来源和后续检索管理作为同一个资料对象处理：https://docs.readwise.io/reader/docs/saving-content
- Keeping Found Things Found on the Web 强调网页资料保存后的再查找与上下文复用：https://www.microsoft.com/en-us/research/publication/keeping-found-things-found-web/
- Personal Information Management 综述强调个人资料的保存、组织、再检索需要保留上下文和状态线索：https://arxiv.org/abs/2107.03291

## 改进计划

1. 在 Source Memory 详情页的 `资料蒸馏回执` 中展示已有 `sourceAsOf`，命名为 `来源快照`，说明蒸馏依据的 capsule/source 版本。
2. 同一区域展示短 `inputHash`，命名为 `输入指纹`，用于用户/维护者判断当前蒸馏是否来自同一版证据输入；只显示短 hash，不暴露原文。
3. 更新 `tools/verify-source-memory-capsule-e2e.mjs` fixture 和断言，覆盖 `来源快照`、`输入指纹` 两个可见字段。
4. 更新 `docs/features/memory_capture.md`，保持文档与最新 UX 行为一致。
5. 验证：`node --check tools/verify-source-memory-capsule-e2e.mjs`、`npm start` 首次成功编译、`node tools/verify-source-memory-capsule-e2e.mjs`、必要的 memory-service source-memory 测试、scoped `git diff --check`。
