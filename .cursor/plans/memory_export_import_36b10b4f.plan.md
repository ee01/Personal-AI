---
name: memory export import
overview: 为记忆系统设计并接入增强版 zip 备份与可恢复导入能力，采用 `A 真源 + B 现有 Markdown 产物 + C 临时生成 Markdown 快照` 的导出结构，并保证 C 只在导出临时目录生成、打包后立即删除，不污染 `data/users`。
todos:
  - id: design-backup-format
    content: 定义增强版 zip 备份格式与 manifest 字段，明确 A/B/C 三层内容、HTTP 协议和失败语义
    status: pending
  - id: implement-backend-export
    content: 升级 memory-service 导出路由为真正的 zip 下载，并纳入 A 真源、B 现有 Markdown、C 临时生成 Markdown 快照
    status: pending
  - id: implement-backend-import
    content: 新增 zip 导入路由，完成临时解包、校验、merge/replace 恢复与用户上下文重载
    status: pending
  - id: wire-client-options-ui
    content: 扩展前端 MemoryServiceClient 与 src/options.tsx，提供记忆备份 zip 导入导出按钮、checkbox 模式切换与提示
    status: pending
  - id: verify-roundtrip
    content: 验证 zip 备份导出后可成功回导，并确认导出不会污染 data/users 目录
    status: pending
isProject: false
---

# 记忆系统一键导入导出方案（增强版）

## 目标

在设置页加入“记忆导出 / 记忆导入”能力，用户可一键下载当前用户的完整记忆备份 `zip`，并可将该备份重新导入本系统继续使用。

## 默认设计决策

- 真源以 SQLite 为准：`memory-service/data/users/{userId}/memory.db`。
- 导出包采用三层结构：
  - `A 真源`：`memory.db`、`config.json`
- `B 现有 Markdown 产物`：当前用户目录下已存在的 `daily/`、`dreams/`、`entities/`、`reflections/`、`reflection-threads/`、`reports/`、`projects/`、`skills/`、`agent/`、`USER_CORE.md`、`CORE_MEMORY.md`、`WATCHED_PROJECTS.md`
  - `C 临时生成 Markdown 快照`：从 `memory.db` 真源导出的人类可读流水记忆/结构化快照，例如消息归档、画像条目、时间线或关系快照
- `C` 只允许在导出临时目录中生成，用完即删；不得写回 `data/users`。
- 备份包内增加 `manifest.json`，记录格式版本、用户 ID、导出时间、内容清单、校验信息，作为后续导入兼容层。
- 导入流程先解包到临时目录校验，再恢复到目标用户目录；不要直接边读边覆盖。
- 设置页中“不勾选覆盖替换现有记忆”时，导入语义固定为 `merge`。
- 设置页中勾选“覆盖替换现有记忆”时，导入语义固定为 `replace`。
- `merge` 与 `replace` 都必须先在临时目录解压并完成校验；一旦解压失败、校验失败或发现必需文件缺失，必须直接返回错误并终止，不得修改正式用户目录。
- `merge` 的恢复策略是“增量更新”：从临时解压目录把 `A + B` 复制到正式用户目录，覆盖同名文件，保留正式目录中备份包未包含的其他文件。
- `replace` 的恢复策略是“目录切换”：先把现有用户目录重命名为备份目录，再把临时解压后的 `user/` 目录整体切换成新的正式用户目录；只有在恢复成功并完成上下文重载后，才允许删除旧目录备份。

## 为什么这样设计

- 当前系统的主真源是 `memory.db`，大量结构化记忆、画像、关系和 persona 都在库里，不应只导 Markdown。
- 现有 Markdown 文件更像“可读副产物/派生视图”，带上它们有利于完整迁移与人工查看。
- 额外的人类可读流水记忆如果完全不提供，备份包可读性会偏弱；因此增强版加入 `C`，但它必须是“一次性导出快照”，不能反向污染运行目录。
- `zip` 适合作为单文件下载与回导载体，`manifest.json` 可以把这套能力升级成稳定的“备份格式”，而不是一次性脚本。
- `merge` 能满足日常回导与迁移补数，`replace` 能满足完整恢复，两者都需要明确失败边界，避免破坏原有用户目录。

## 备份包结构

```text
memory-backup.zip
  manifest.json
  user/config.json
  user/memory.db
  user/USER_CORE.md
  user/CORE_MEMORY.md
  user/WATCHED_PROJECTS.md
  user/daily/*
  user/dreams/*
  user/entities/*
  user/reflections/*
  user/reflection-threads/*
  user/reports/*
  user/projects/*
  user/skills/*
  user/agent/*
  derived/messages/*
  derived/profile/*
  derived/timelines/*
  derived/relationships/*
```

## HTTP 协议约定

- 导出接口继续使用 `POST /export`，响应体必须是 `application/zip` 下载流，而不是 JSON。
- 导出文件名建议固定为 `personal-ai-memory-<userId>-<timestamp>.zip`。
- 导入接口提供 `POST /import`，请求体为 zip 文件上传。
- 第一版优先采用 `multipart/form-data`：
  - `file`: 备份 zip
  - `mode`: `merge` 或 `replace`
- 导入接口响应统一为 JSON，至少包含：
  - `mode`
  - `importedAt`
  - `restoredLayers`
  - `writtenFiles`
  - `preservedFiles`
  - `deletedFiles`
  - `warnings`

## A / B / C 分层定义

- `A 真源`
  - 目标：保证可导入恢复、继续运行。
  - 内容：`memory.db`、`config.json`。
- `B 现有 Markdown 产物`
  - 目标：保留用户当前已经能看到的梦境、反思、画像、周报等文档。
  - 内容：用户目录下已存在、且属于白名单范围的 Markdown 文件。
  - 第一版白名单建议固定为：
    - 根目录：`USER_CORE.md`、`CORE_MEMORY.md`、`WATCHED_PROJECTS.md`
    - 子目录：`daily/`、`dreams/`、`entities/`、`reflections/`、`reflection-threads/`、`reports/`、`projects/`、`skills/`、`agent/`
- `C 临时生成 Markdown 快照`
  - 目标：把 DB 里的关键真源内容转成便于人读和审计的导出视图。
  - 内容建议：
    - `derived/messages/`：按时间切分的源消息/消息摘要导出
    - `derived/profile/`：画像条目、社交边、opinion、agent profile 的快照
    - `derived/timelines/`：实体属性历史、项目关键事实时间线
    - `derived/relationships/`：关系图谱或按实体归档的关系摘要
  - 第一版最小快照集建议固定为：
    - `derived/messages/messages-overview.md`
    - `derived/profile/profile-overview.md`
    - `derived/timelines/entity-property-timeline.md`
    - `derived/relationships/relationship-overview.md`
  - 约束：只在导出临时目录生成，打包完成后立刻删除；不写回用户运行目录。
  - 导入规则：不恢复到正式用户目录，只允许存在于备份 zip 和导入临时解压目录中；导入结束后随临时目录一起清理。
  - 命名要求：
    - 文件名稳定、可重复生成
    - Markdown 顶部标明 “Derived from memory.db export”
    - 单个快照失败不阻断整包导出，但必须在 `manifest.json` 中记录失败项

## 主要改动点

- 后端导出：把现有只返回清单的 [memory-service/src/routes/export.ts](/Users/Esone/git/personal-ai/memory-service/src/routes/export.ts) 升级为真正生成并返回 `zip` 下载流；复用/扩展 [memory-service/src/core/ExportEngine.ts](/Users/Esone/git/personal-ai/memory-service/src/core/ExportEngine.ts) 负责列出 A/B 文件、生成 manifest，并增加 C 层临时 Markdown 快照的生成逻辑。
- 后端导入：新增一个导入路由，建议新增 `memory-service/src/routes/import.ts`，负责接收 zip、解包到临时目录、校验 `manifest.json`、检查必需文件、再执行恢复流程。
- 客户端 API：扩展 [src/services/MemoryServiceClient.ts](/Users/Esone/git/personal-ai/src/services/MemoryServiceClient.ts)，把现在名义上的 `exportMemory()` JSON manifest 调用改成真正的文件下载，并新增 `importMemory()` 上传 zip 的方法。
- 设置页 UI：在 [src/options.tsx](/Users/Esone/git/personal-ai/src/options.tsx) 的“记忆系统 (Memory Service)”区域新增“导出记忆 zip / 导入记忆 zip”按钮、checkbox 模式切换与状态提示，而不是混在现有“配置导入/导出”中。
- 后端依赖：`memory-service/package.json` 需要加入 zip 打包/解包依赖，用于生成下载包和解析导入包。

## 导出实现要点

- 直接从用户目录收集 `A + B`。
- 为 `C` 创建专用临时导出目录，例如系统临时目录下的 `memory-export-<userId>-<timestamp>`。
- 在该临时目录下按 `derived/` 结构生成 DB 真源对应的 Markdown 快照，不写回正式用户目录。
- 导出时构造临时 manifest：
  - `formatVersion`
  - `transport`: `zip`
  - `exportedAt`
  - `userId`
  - `includes` 列表
  - `layers`：明确列出 A/B/C 各自包含内容
  - 每个文件的校验信息（文件大小、mtime、sha256）
  - `derivedGeneration`：记录成功项、失败项、跳过项
- `zip` 在临时目录或流式内存中构建，完成后立即删除 `C` 生成文件与整个临时导出目录。
- HTTP 响应返回 `application/zip` 和建议文件名，例如 `personal-ai-memory-<userId>-<date>.zip`。

## C 层快照设计原则

- `C` 是“导出视图”，不是新的运行时真源。
- `C` 允许冗余，但必须清晰标注来源来自 `memory.db` 导出。
- `C` 文件命名应稳定、可读、可在导入时忽略；导入恢复仍以 `A` 为主、`B` 为辅，`C` 主要用于审计和人工查看。
- `C` 必须作为外层备份 zip 内的普通目录存在，禁止再打成内嵌 zip。
- 如果某类快照生成失败，不应阻断整包导出；可以在 `manifest.json` 中标记缺失项。

## 导入实现要点

- 导入路由接收 zip 后先解到临时目录，不直接写正式目录。
- 校验必须在任何正式目录写入前完成，校验项至少包括：
  - `manifest.json` 可解析
  - `manifest.formatVersion` 在支持范围内
  - `user/memory.db` 存在
  - `user/config.json` 存在
  - `manifest.json` 中记录的关键文件 hash 与实际文件一致
- 导入时 `C` 视为可选层：可在临时解压目录中用于校验、调试或人工检查，但恢复流程不依赖它，也不允许把它写回系统运行目录。
- `merge` 恢复策略：
  - 默认只恢复 `A + B`
  - 从临时解压目录复制到正式用户目录
  - 同名文件覆盖，不同名旧文件保留
  - `memory.db` 采用增量更新语义，不直接删除正式目录中的额外运行文件
- `replace` 恢复策略：
  - 必须显式勾选“覆盖替换现有记忆”
  - 先将现有用户目录重命名为临时备份目录，例如 `<userDir>.backup-<timestamp>`
  - 再把临时解压后的 `user/` 目录切换为新的正式用户目录
  - 若后续步骤失败，优先回滚旧目录
- 恢复完成后重新初始化该用户上下文，确保新的 `memory.db`、配置和文件视图生效。
- 导入完成后清理整个临时解压目录，其中包括 `derived/`。
- 请求级失败语义：
  - 解压失败、manifest 缺失、必需文件缺失、hash 校验失败、目录切换失败、上下文重载失败，都应直接返回错误
  - 失败时不允许留下半恢复状态
  - `merge` 失败时正式目录应保持导入前状态
  - `replace` 失败时应恢复旧目录备份

## 前端交互建议

- 在设置页提供两个独立动作：
  - `导出记忆备份 (.zip)`
  - `导入记忆备份 (.zip)`
- 在导入按钮旁提供一个 checkbox：
  - 文案：`覆盖替换现有记忆`
  - 默认不勾选
  - 不勾选时传 `merge`
  - 勾选时传 `replace`
- 导入前展示简短说明：会恢复记忆数据库与相关文件，建议先导出现有备份。
- 导入成功后提示用户刷新记忆相关页面；如果容易接入，可进一步触发内存页状态刷新。

## 风险与验证

- 风险：直接覆盖当前用户目录可能造成不可逆数据丢失，因此导入必须先临时解包并做校验/确认。
- 风险：只导 Markdown 会导致结构化真源丢失，因此第一版必须把 `memory.db` 作为核心内容。
- 风险：`C` 的生成规则如果设计过重，会拖慢导出；因此应先做最小快照集，并允许部分失败不影响主备份。
- 验证：
  - 导出 zip 后可解压检查结构完整。
  - 验证 `zip` 中同时存在 A/B/C 三层内容，且 `manifest.json` 记录正确。
  - 验证设置页默认不勾选 checkbox 时，后端收到的是 `merge`。
  - 验证勾选 checkbox 时，后端收到的是 `replace`。
  - 用空白用户目录做一次回导，确认 `/stats`、`/profile/core`、Dream/Reflection/Report 页面都能读到数据。
  - 用已有用户目录做一次 `merge` 回导，确认同名文件被覆盖、未包含文件被保留。
  - 用已有用户目录做一次 `replace` 回导，确认旧目录先被备份，再被新目录替换。
  - 故意制造解压失败 / manifest 缺失 / hash 不匹配，确认请求报错且旧目录未被破坏。
  - 验证导出过程中 `data/users/{userId}` 下没有新增人为快照文件，临时目录在导出完成后被清理。
  - 验证导入结束后，临时解压目录和 `derived/` 都被清理。

## 关键参考文件

- [docs/memory_system.md](/Users/Esone/git/personal-ai/docs/memory_system.md)
- [memory-service/src/routes/export.ts](/Users/Esone/git/personal-ai/memory-service/src/routes/export.ts)
- [memory-service/src/core/ExportEngine.ts](/Users/Esone/git/personal-ai/memory-service/src/core/ExportEngine.ts)
- [src/services/MemoryServiceClient.ts](/Users/Esone/git/personal-ai/src/services/MemoryServiceClient.ts)
- [src/options.tsx](/Users/Esone/git/personal-ai/src/options.tsx)
