# 已核实事实
- 用户确认主路径是 backlog 新建弹窗中的 AI 批量创建，辅路径独立 Roadmap MCP + Skill，Codex Plugin 打包。
- 此前成本比较混用 Skill+脚本与 MCP+Skill，不可同口径说 Plugin 更低。
- docs/features/personal_roadmap.md 是现有行为文档，Draft 唯一判据为 jiraKey 空；保留 LOCAL key。
- 当前工作树大量非本任务修改；本次只拥有新 plan 文档。
- roots 扫描后扩展了打包讨论和此前 Draft 结果线程；根 planning 文件属于无关旧任务。

## 并行审查完成
- Roadmap /intents 是单 op，add_item 不自动排期，add_sub 不返回 id；没有批量创建事务/幂等。
- days 是自然日含首尾；item 无 owner、sub 才有 owner；description 上限 2000。
- share 端点对自报 creator/extension 的例外、SSE 广播 request/actor 中 token 是新增付费入口前要收紧的静态风险，未做线上利用。
- Memory Claude 当前走 OpenAI-compatible API，generateJSON 只 parse；Roadmap 应独立 adapter+validator，不 import Memory 类。
- rooms-kit 已读取固定 revision 0461936e06e8a68370625ac355f75e054a585609；MCP 和无 MCP 插件并存。
- OpenAI 当前官方文档支持 repo/personal marketplace；公开目录另走 portal 审核，不能说 git push 自动上架。
- 旧线程要求每个 Epic 保留 overall 背景、风险和里程碑；此前描述和 assignee 的细节必须纳入验收。
