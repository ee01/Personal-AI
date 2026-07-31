# Jira 自动化规则导入功能

## 功能介绍

该功能允许在 Jira 自动化管理页面导入之前导出的自动化规则。Personal AI 会在项目自动化页面注入 `Import rule` 按钮，对 Jira Automation JSON 做预检、项目映射、app 组件兼容性、风险摘要和禁用态导入，降低误导入后立即触发的风险。

## 大白话运行逻辑

这个功能不是“直接把规则导进去并启用”，而是先把导出的 Jira Automation JSON 拆开检查，告诉用户里面有什么触发器、外部请求、secret、JQL、schedule 和跨项目绑定，再创建一个默认禁用的副本。

结果主要受这些因素影响：

1. 导出 JSON 是否标准：格式、大小、规则数量和字段完整性决定能否进入预览。
2. 目标项目映射：project key、custom field、filter、connection、account 等环境绑定越多，迁移风险越高。
3. 目标 Jira app/module 是否一致：第三方或 app-provided component 不会被 Personal AI 自动重写，目标环境缺少同一组件时需要先修复。
4. 高风险动作：Web request、secret、外部 URL、schedule、链式触发会要求更明确的复核。
5. 重名规则处理：目标项目已有同名副本时会自动生成编号名称，避免覆盖或混淆。
6. 禁用态导入：导入成功只是创建待检查规则，真正启用仍由用户在 Jira 中完成。

2026-05-29 对齐外部产品和研究后的当前原则：Atlassian 官方导入要求同版本 JSON，且导入后默认 disabled；隐藏值和 secure storage secret 不能依赖导出/导入自动恢复，必须在目标 Jira 里重新配置；Appfire Configuration Manager 这类迁移工具也会把 automation rule 当作配置快照处理，并强调引用重映射和第三方组件复核；trigger-action programming 研究反复指出，用户容易误判触发条件、规则交互和跨服务数据流。因此 Personal AI 的导入前预览要把组件兼容性、环境绑定、隐藏 secret 重录槽位和启用顺序留在用户眼前，而不是只给一个“导入成功”的反馈。

2026-06-10 补充原则：高风险自动化导入不是一次性“确认即安全”，而是一个人审暂停点。预览顶部会先给 `Import boundary receipt`，明确这次点击只创建 disabled copy，不会自动启用、运行、激活 schedule 或恢复 secret；脱敏 review note 和 Activation plan 会写入 Jira 规则描述；真正启用前仍要在 Jira 详情里重录隐藏值、手动测试并检查第一条高风险步骤。

2026-06-11 补充：导入成功后的短回执也要继续保持这个边界，而不是只说“成功”。成功回执会显示实际创建的导入副本名（包含自动编号）、目标项目、没有自动启用/运行/恢复 secret，并提醒下一步去规则详情重录隐藏值、手动测试、再由用户启用。

2026-06-12 补充：导入预览会读取导出文件里的 `cloud` 来源格式标记。遇到 `cloud=false` 且规则包含 Web request、外部动作、app component、credential 或隐藏值时，会把“来源格式兼容性”列为高风险检查，并写进预览回执、复制包、导入后的 Jira 描述和成功回执；用户需要在目标 Jira 里确认 Cloud / Data Center / 版本差异没有导致 header、组件或凭据结构丢失，再手动启用。

2026-06-13 补充：高风险复核提示只说明“创建 disabled copy 不代表安全复核完成”。提示区、复制包和导入后写入 Jira 描述的 review note 都会明确：Jira-side review 仍然 open，用户必须在规则详情里完成 Activation plan、手动测试和 audit 检查后，才考虑启用。

2026-06-14 补充：失败回执也遵守 secret 边界。如果 Jira 创建接口返回包含 URL、header、token、email 或隐藏 secret 的校验错误，Personal AI 会先脱敏再显示和记录；失败文案只说明创建失败或未能确认、没有自动启用/运行/恢复 secret，并提醒用户先检查 Jira 是否已有 disabled copy，再重录隐藏值和重试。

2026-06-14 追加：脱敏不只看 `secret=true` 容器。导入文件里的规则名、原描述、label、Web request body、diagnostic body 这类自由文本如果内嵌 `clientSecret`、`Bearer`、token/password/API key 键值、带 token 的 URL 或高熵密钥片段，预览、复制复核包、导入描述、创建 payload 和 console 都会共用同一层清洗；安全的 secret key 名称仍可作为重录线索展示，但原始 secret 值不会随 disabled copy 迁移。

2026-06-16 补充：目标项目已有规则列表读取失败时，不再把整个导入流程阻塞在预览前。Personal AI 会继续打开 disabled-copy 预览，但会显示 `Name collision check` 未确认回执，说明最终导入名只是 best-effort，可能存在同名或 Jira 侧重复创建风险；这条回执会进入预览、复制包、成功回执和导入副本描述，提醒用户在重试或启用前先检查 Jira 规则列表。

2026-06-18 补充：脱敏后会显示 `Secret re-entry map`。这张 map 只列安全字段路径、可展示标签和处理原因，例如 `components[0].value.headers[0].value (Authorization: hidden secret value)`，帮助用户知道哪些位置被 `PERSONAL_AI_REENTER_SECRET` 或 `REDACTED` 替代；它不会展示原始 secret，也不会表示 Personal AI 已恢复或验证这些凭据。map 会进入预览详情、导入边界回执、复制复核包、导入副本描述和成功回执。

2026-06-18 追加：高风险复核提示始终跟随当前预览状态。用户如果切换链式触发保护（例如从默认阻止改成保留源规则可被其它规则触发），Personal AI 会重算预览、导入摘要和回执；导入按钮仍可直接点击，但新的链式触发状态会进入复制包和导入副本描述。

2026-06-19 补充：高风险预览现在会留下 create-stage review receipt。预览里会说明本次点击只创建 disabled copy，Jira 侧 Activation plan 仍然 open；导入后的规则描述也会记录同样边界，方便后续审计时区分“创建禁用副本”与“已完成启用审查”。这对齐 Atlassian disabled-by-default 导入、masked secret key 复录，以及 Power Platform import connection reference 这类目标环境绑定显式化做法；TAP 研究也说明链式自动化和规则副作用需要可理解的中间暂停点，而不是一次导入包办启用。

2026-06-21 补充：导入预览首屏会显示 `Create request scope`。这条回执先说明当前只是 preview，取消或 Escape 不会写 Jira；确认后只发送一个脱敏后的 POST，用来在目标项目创建一条 `DISABLED` 副本，不会编辑、启用或运行源规则；同时压缩说明哪些嵌入的 JQL/filter、URL、custom field、connection、account、source project 和 smart value 只会进入复核范围，不会被 Personal AI 自动重写。

2026-06-22 补充：`Enablement review packet` 复制入口现在会先显示复制范围回执，并在复制后重复提示：复制只把脱敏复核包写入本机剪贴板，用于后续 handoff；它不会创建或编辑 Jira 规则、启用自动化、运行 schedule 或恢复 secret。高风险复核仍然需要在 Jira 启用前完成。

2026-06-23 补充：URL 脱敏覆盖 signed URL 和云存储授权 query，例如 `sig`、`signature`、`X-Amz-Signature`、`X-Amz-Credential`、`X-Amz-Security-Token`、`AWSAccessKeyId`、`GoogleAccessId`、`X-Goog-Signature`。这些值会进入 `Secret re-entry map`，预览、复制包、导入描述、失败回执和 create payload 都只保留 `REDACTED`，避免把可用的临时授权 URL 带进 Jira 副本或审查文本。

2026-06-24 补充：URL query 脱敏也覆盖常见 webhook / function / API gateway 凭据参数，例如 `code`、`functionKey`、`subscription-key`、`Ocp-Apim-Subscription-Key`、`sasToken` 和 `sharedAccessKey`。这些值会像 signed URL 一样进入 `Secret re-entry map`，目标 Jira 里需要重新生成或重录；普通字段里的 `statusCode` 这类名称不会因此被当作 secret。

2026-06-26 补充：选择 JSON 文件后、预览弹窗打开前，会先显示 `Preparing disabled-copy preview` 回执。它说明当前只是在本机读取文件并检查目标 Jira 规则名，还没有创建、编辑、启用、运行规则，也没有激活 schedule 或恢复 secret；预览生成后这条等待回执会被真正的 preview / create-stage 回执替换。

2026-06-27 补充：用户在预览里完成必要确认并点击导入后，会先显示 `Create request pending` 回执，再等待 Jira API 返回。它绑定实际导入副本名、目标项目、`DISABLED` payload 状态和链式触发处理结果，明确此时只是一个脱敏 POST 正在发送或等待确认，尚未证明创建成功，也没有自动启用、运行、激活 schedule 或恢复 secret。

2026-06-29 补充：高风险导入预览的 sticky header 会直接显示 create-stage ready 回执。它说明还没有向 Jira 发送 create request，点击只会创建 disabled copy，Jira 侧 Activation plan 仍然 open。切换规则或链式触发保护会重算预览，但不会把导入按钮重新锁住。

2026-06-30 补充：高风险导入不再强制用户勾选确认 checkbox。预览会继续显示高风险类别、下一步、禁用副本边界、复制复核包和 Activation plan，但 `Import disabled copy` / `导入禁用副本` 按钮默认可直接点击；链式触发保护切换后会重算预览和回执，但不会重新锁住导入。Jira 描述中的 create-stage note 也改为记录“预览已展示高风险复核项，创建禁用副本不等于启用批准”，不再声称用户已勾选确认。导入按钮、预检回执、预览弹窗、复制状态、pending / success / failure 回执会按 Options 页选择的界面语言（中文或 English）展示。

2026-07-02 补充：`Secret re-entry map` 现在会配套显示 `Credential restore gate` / `凭据恢复门控`。这条摘要说明 disabled copy 只带 `PERSONAL_AI_REENTER_SECRET` 或 `REDACTED` 占位，导入成功仍不代表凭据已恢复；启用前必须在 Jira 里重新录入、重建或明确留空这些字段。这个 gate 会进入预览边界回执、详情、复制复核包、导入副本描述和成功回执。

2026-07-03 补充：脱敏层继续覆盖 AI / webhook provider 常见凭据形态。URL query 里的 `key`、`id_token`、`jwt`、`client_assertion` 等如果值像 provider API key、JWT 或长 token，会按 secret 处理；普通文本 / JSON body 里的 `jwt`、`idToken`、`clientAssertion`、`openaiApiKey`、Anthropic / Gemini / Google 风格 key 和 `X-API-Key` header 值也会进入 `Secret re-entry map` 并在 create payload 中替换为占位。预览、复制包、导入描述、失败回执和 console 只显示安全路径与重录原因，不展示原始 provider credential。

2026-07-05 补充：导入成功后会先显示 `Post-import navigation receipt` / `导入后跳转回执`。默认仍会进入导入后的 Jira 规则详情，但用户可以留在当前页取消自动跳转；取消只影响导航，不会撤销已创建的 disabled copy、启用规则、运行自动化或完成 Jira 侧 Activation plan。

2026-07-07 补充：`Create request pending` 不再是短暂 toast。点击 `Import disabled copy` 后，等待回执会保留到 Jira 返回成功或失败，并说明关闭或刷新页面不会撤销已经发送的 create request；成功或失败回执出现前会先清掉 pending 状态，避免用户把等待中和最终结果并列误读。

2026-07-08 补充：链式触发保护旁边会显示 `Rule chaining choice` / `规则链式触发选择` 回执。它随 checkbox 更新，说明当前预览会阻止还是保留 `canOtherRuleTrigger`，这个选择只会进入后续 disabled-copy create payload；切换本身只重算预览和复核包，不会立即向 Jira 发送 create request。

2026-07-09 补充：`Secret re-entry map` 会再压成 `Credential re-entry queue` / `凭据重录队列`。队列按 hidden Jira secret、URL / signed query 凭据、inline secret-like text、命名 credential 字段等原因分组，帮助用户知道启用前要在 Jira 里先重建哪类凭据；它只来自已经脱敏的 slot 元数据，不展示 raw value，也不表示 disabled copy 已恢复凭据。

2026-07-15 补充：真正会发送 create request 的两个 `Import disabled copy` 按钮也会带本轮导入边界。按钮 hover / 读屏会说明要创建的 disabled copy、目标项目、高风险复核仍 open、凭据重录组和脱敏位置数量、当前链式触发选择，以及这次点击只发送一个已清洗 POST，不会启用、运行、激活 schedule、恢复 secret、编辑源规则或生成可工作的凭据。

## 使用方法

1. **访问 Jira 自动化页面**
   - 打开 Jira 项目的自动化管理页面
   - URL 格式：`https://jira.ringcentral.com/secure/AutomationProjectAdminAction!default.jspa?projectKey=YOUR_PROJECT_KEY`

2. **导入规则**
   - 在页面加载完成后，会在 "Create rule" 按钮旁边看到新的 "Import rule" / "导入规则" 按钮，显示语言跟随 Options 页语言设置
   - 点击 "Import rule" / "导入规则" 按钮只会打开本机 JSON 选择器并准备 disabled-copy 预览；按钮 hover / 读屏会先说明这一步不会创建、编辑、启用、运行 Jira automation、激活 schedule 或恢复 secret
   - 选择之前从 Jira Automation 导出的 JSON 文件
   - 文件选中后，如果 Personal AI 正在解析 JSON 或读取目标项目已有规则名，会先看到预检回执；这一步只是准备 disabled-copy 预览，不会向 Jira 创建或修改规则
   - 如果文件中有多条规则，先在预览弹窗中选择要导入的一条
   - 确认目标项目、触发器、组件数量、custom/app component、Web request / external action / secret / sensitive or hidden value / JQL / URL / custom field / filter / connection / account / smart value / schedule 摘要、迁移复核清单和导入警告后再执行导入
   - 预览会显示最终导入规则名；如果目标项目里已经有同名导入副本，会自动生成编号名称，避免重复导入后难以区分
   - 如果读取目标项目现有规则名失败，预览不会伪装成“无冲突”；会标记 `Name collision check` 未确认，并提示导入名只是 best-effort，启用或重试前先检查 Jira 里是否已有同名 disabled copy
   - 预览会显示来源导出格式；如果文件标记为 `cloud=false`，会提示先确认目标 Jira Automation 版本/部署形态兼容，尤其是 Web request headers、app-provided component 和 credential
   - 预览会汇总启用前检查数量，并把精简复核备注和关键环境绑定样例写入导入副本的描述，方便跳转到 Jira 规则详情后继续检查
   - 预览会生成 `Activation plan`，把导入后到启用前最该做的几步排出来：保持 disabled、映射目标项目查询依赖、重连外部请求/secret/账号、确认 app-provided component 可用、测试 schedule / smart value / 链式触发，再确认 actor 权限和 audit 结果
   - 预览顶部会显示 `Import boundary receipt`：创建什么、不会自动做什么、哪些复核内容会写进 Jira 描述、导入后第一步去哪处理；这让用户在点击前先看到 create-stage 边界，而不是只在 checklist 里找风险
   - 隐藏 secret、明显 token/password/API key 字段和 URL 里的凭据片段不会随导入原样迁移；Personal AI 在创建 disabled copy 时用 `PERSONAL_AI_REENTER_SECRET` / `REDACTED` 占位，用户需要在目标 Jira 里重新录入真实值后再启用
   - 预览会显示 `Secret re-entry map`，把需要重录或复核的安全字段路径压缩成清单；占位符不是可工作的凭据，启用前仍要在 Jira 里重新录入或确认留空
   - `Credential restore gate` 会把 Secret 重录图压缩成启用前门控摘要，明确创建 disabled copy 可以继续，但凭据恢复仍未完成
   - `Credential re-entry queue` 会把同一批脱敏 slot 按处理类型分组：hidden Jira secret 需要在目标规则重录或重建，signed URL / function key / API gateway query 需要重新生成，inline secret-like text 需要确认是否恢复目标环境安全值，命名 credential 字段需要重新录入 API key / JWT / Authorization 等；这只是启用前队列，不会恢复真实凭据
   - 如果 secret 被写在规则名、描述、label、Web request body 等普通文本里，也会先被脱敏再展示、复制或写入导入副本；这些文本只保留业务上下文和重录提示，不保留原始 token
   - 如果 Web request URL 使用 AWS / Azure / Google 等 signed URL query，或用 `code` / `subscription-key` / `sasToken` 等 query 传递临时授权，签名、credential、security token、access id、function key 和 API gateway key 都会被当作 secret 清洗；目标 Jira 里需要重新生成或重新配置这类 URL 后再启用
   - 如果 URL 或请求体里使用 AI / provider 凭据，例如 `key=AIza...`、`id_token=...`、`jwt`、`clientAssertion`、`openaiApiKey`、`X-API-Key` 或 Anthropic / Gemini / OpenAI 风格 token，也会作为需要重录的 credential slot 处理
   - 预览里可复制一份脱敏的启用前复核包，包含目标项目、最终导入名、高/中/低风险检查、环境绑定样例、隐藏 secret 重录提示、Activation plan 和导入警告，便于在 Jira 规则详情或审查线程里继续跟进
   - 复制复核包前会显示 `Clipboard only` / `Does not` 范围回执；复制成功也只表示本机剪贴板写入成功，不会替用户完成 Jira 侧复核、创建 Jira 副本、启用规则或恢复 secret
   - 复制包和导入副本描述会包含 `Secret re-entry map`，但只包含安全路径和原因，不包含原始 secret 值
   - 复制包、导入副本描述和成功回执也会包含 `Credential re-entry queue`，避免用户离开预览后只看到占位符却不知道下一步先处理哪类凭据
   - 如果预检发现高风险项，预览会直接列出高风险类别和下一步处理建议，但不再强制勾选确认；用户可以直接创建禁用态副本，启用前仍需在 Jira 里完成高风险复核
   - sticky header 会同步显示当前 create stage 是 ready：按钮只会创建 disabled-copy，不会启用、运行、激活 schedule 或恢复 secret；高风险复核仍然留在 Jira 启用前完成
   - 如果源规则允许被其它规则触发，预览会默认阻止导入副本继承这个链式触发能力；确实需要时可手动保留。旁边的链式触发选择回执会说明当前状态会怎样进入 disabled-copy payload；切换这个安全选项只会重算预览、复核包和 create payload，不会发送 Jira create request，也不会要求重新勾选确认
   - 预览首屏会显示 `Create request scope`：当前还没有向 Jira 发送 create request；点击确认后只创建一个脱敏的 disabled copy；源规则不会被编辑、启用或运行；嵌入的环境引用只进入复核，不会被自动重写
   - 顶部和底部的 `Import disabled copy` / `导入禁用副本` 按钮会在 hover / 读屏里重复本轮 create request 边界：目标副本、目标项目、凭据重录队列数量、链式触发选择、启用计划仍 open，以及不会启用、运行、恢复 secret 或编辑源规则
   - 点击导入后、Jira 返回前，会显示持久 `Create request pending`：说明一个脱敏 POST 正在创建该 disabled copy，Jira 尚未确认成功；这条回执会保留到成功或失败返回，且关闭或刷新页面不会撤销已经发送的 create request；它也会继续说明不会自动启用、运行、激活 schedule 或恢复 secret

3. **导入完成**
   - 导入成功后会显示成功回执，使用实际导入副本名，而不是源规则名；如果因为同名自动编号，用户可以在跳转前确认这次创建的是哪一个 disabled copy
   - 如果创建前没有确认目标规则名列表，成功回执会继续提示先检查 Jira 规则列表，避免用户把 best-effort 名称误读成已确认无冲突
   - 成功回执会再次说明这次没有自动 enable、run、激活 schedule 或恢复 secret；脱敏 review note 和 Activation plan 已写入 Jira 描述
   - 如果来源文件是 `cloud=false`，成功回执会提醒先检查格式敏感的 Web request、app component 和 credential，再启用
   - 如果预检发现 secret 或敏感隐藏值，成功回执会继续提醒先在 Jira 规则详情里重录隐藏值、手动测试，再启用
   - 成功回执会复述 `Secret re-entry map` 摘要，避免用户离开预览后忘记哪些字段只是占位符
   - 成功回执会继续显示凭据恢复门控，提醒导入成功后仍要在 Jira 规则详情里复录或明确留空这些凭据字段，再考虑启用
   - 成功回执会继续显示凭据重录队列；如果队列还存在，导入成功只代表 disabled copy 创建成功，不代表凭据、signed URL、provider token 或隐藏值已经可用
   - 成功回执会显示导入后跳转状态：可以立即打开规则详情，也可以留在当前页继续复制或核对；留在当前页只取消自动跳转，不撤销 disabled copy 或确认启用复核
   - 如果 Jira API 创建失败，失败回执不会直接展示原始 API response；URL 凭据、token/query、Authorization、`keyOrValue`、email 和高熵 path token 会被替换为 `REDACTED` / `REDACTED_EMAIL`，并提示先检查是否已有 disabled copy 后再重试
   - 新规则默认是 `DISABLED`，需要用户检查后在 Jira 中手动启用
   - 页面会跳转到新导入的规则详情

## 支持的文件格式

导入功能支持 5MB 以内的 Jira 标准导出格式 JSON 文件，包含以下结构：

```json
{
  "rules": [
    {
      "name": "规则名称",
      "state": "ENABLED",
      "canOtherRuleTrigger": false,
      "notifyOnError": "FIRSTERROR",
      "authorAccountId": "用户ID",
      "trigger": { ... },
      "components": [ ... ],
      "projects": [ ... ],
      "labels": [ ... ]
    }
  ],
  "cloud": false
}
```

## 技术实现

### 核心功能

1. **JSON 格式转换**
   - 将导出格式转换为 API 创建格式
   - 递归生成新的组件 ID，避免嵌套 action / condition 沿用源规则 ID
   - 更新项目信息为当前项目
   - 多项目来源会折叠为当前项目，避免重复项目 scope
   - 导入时强制新规则为 `DISABLED`
   - 生成 `(Imported by Personal AI) ...` 导入名，并在目标项目已有同名规则时追加编号
   - 保留原规则描述，并追加 Personal AI 导入复核备注，记录目标项目、环境绑定摘要、Activation plan 和链式触发状态
   - 复核备注会记录导出来源格式；`cloud=false` 会进入启用前计划，提醒先确认 Cloud / Data Center / 版本兼容性
   - 复核备注会记录高风险 gate 的真实含义：acknowledgement 只发生在 disabled-copy creation 前，Jira-side review 仍然要在 enablement 前完成
   - 复核备注会记录 create-stage review receipt：通过 Personal AI preview 创建的高风险 disabled copy 会说明预览已展示复核项，创建禁用副本不是 enablement approval
   - 复核备注会保留关键 JQL/filter、URL、secret、敏感或隐藏值、custom field、saved filter、connection、账号/收件人、smart value 和源项目引用样例；复核备注中的敏感值只记录脱敏标签，URL 中的 token/API key/password 等参数和常见 webhook path token 会写成 `REDACTED`
   - 对 `secret=true` 字段只记录安全标签：有安全 secret 名时展示名称；没有时使用邻近字段名生成 `Authorization: hidden secret value` 这类重录槽位；不会把 `keyOrValue` 里的原始值写进预览、描述、复制包或浏览器 console，也不再把隐藏值二次识别成 URL、JQL、smart value 或 source project 样例
   - 创建 disabled copy 的 POST payload 会把 `secret=true` 容器里的 `keyOrValue`、`value`、token/password/API key 等值承载字段，以及普通字段里明显命名为 token/password/API key 的值替换为 `PERSONAL_AI_REENTER_SECRET`；规则名、描述、label 和普通文本字段里的内嵌 secret 也会用同一套规则清洗；URL 会保留主机和业务路径，但 token query、function/API gateway key query、signed URL signature/credential/security token、凭据用户名密码和常见 webhook path token 会写成 `REDACTED`
   - Provider credential 也走同一套 create payload 清洗：JWT/id token/client assertion、`key=` 携带的高熵 provider key、`openaiApiKey`、Anthropic / Gemini / Google 风格 key 和 `X-API-Key` header 值不会写入导入副本
   - 转换层会生成 `Secret re-entry map`，记录被替换或脱敏的安全 payload 路径、可展示字段标签和处理原因；UI、复制包、review note 和成功回执复用这一份 map，避免各处对“哪些字段需要重录”的说法不一致
   - 转换层会基于同一份 map 生成 `Credential restore gate` 摘要；它不重新读取原始值，只说明哪些占位位置仍阻止启用前的凭据恢复
   - 转换层会基于同一份已脱敏 slot 元数据生成 `Credential re-entry queue`，按 hidden secret、URL / query credential、inline secret-like text、命名 credential field 等原因分组，并把队列写入预览、复制包、导入副本描述、warning 和成功回执
   - 导入 UI 默认关闭链式触发开关，避免启用后被其它规则意外触发
   - 转换层默认不保留链式触发能力，只有用户在预览中明确保留时才会写入
   - 对超长规则名做截断，降低 Jira API 因名称长度拒绝创建的概率
   - 通过当前 Jira 项目 key 解析 numeric projectId，避免把 projectKey 当作 API projectId
   - 尽量把 `authorAccountId` / `actorAccountId` 设置为当前 Jira 用户，减少跨项目导入后的权限歧义
   - 扫描规则内部的 JQL/filter、硬编码 URL、custom field、saved filter、connection/credential、邮箱/账号、敏感或隐藏值、smart value、custom/app component 和源项目引用，提示用户启用前完成环境迁移检查

2. **API 调用**
   - 使用 `/rest/cb-automation/latest/project/{projectId}/rule` 接口
   - 自动处理认证和请求头

3. **用户界面**
   - 在 iframe 内动态添加导入按钮
   - 如果 Jira Automation 工具栏异步渲染，会继续等待 `Create rule` 按钮出现再插入；慢加载时会有限重试，避免按钮只尝试一次后消失
   - 入口按钮的 `title` / `aria-label` 先说明只打开本机 JSON 选择器并准备 disabled-copy 预览；取消文件选择或尚未确认预览时不会发送 Jira create request
   - 提供文件选择、规则选择、导入预览和进度反馈
   - 预览中突出显示 custom/app component、Web request、外部集成动作、secret 引用、敏感或隐藏值、JQL/filter、custom field、saved filter、connection/credential、硬编码 URL、账号引用、smart value、源项目引用、scheduled trigger、链式触发和版本兼容风险，并按高 / 中 / 低风险生成启用前复核清单
   - 预览顶部先显示 create request scope，区分当前 preview 无写入、确认后的单个 disabled-copy POST、源规则不变、以及内嵌环境引用不自动重写
   - 预览中显示最终导入名称和同名冲突状态
   - 目标规则名读取成功时，预览、复制包和描述会记录已对多少条目标规则完成同名检查；读取失败时会降级为未确认回执，并清洗失败详情里的 URL token / secret 后展示
   - 预览顶部显示导入结果摘要，明确新规则会作为 disabled copy 创建
   - 预览顶部同时显示导入边界回执：不会自动 enable、run、激活 schedule 或恢复 secret，来源格式、脱敏复核备注和 Activation plan 会随 disabled copy 留在 Jira 描述里
   - 预览中按类别展示检测到的环境绑定和 app-provided component，和导入后写入描述的复核样例保持一致
   - 预览中显示高 / 中 / 低风险检查数量，并说明复核备注会随规则一起导入
   - 预览中的 `Activation plan` 复用同一套风险扫描结果，给出启用前的下一步顺序；这份计划也会写入复制包和导入副本描述，避免用户离开预览后丢失复核路径
   - 预览中提供 `Copy review packet`，复制内容复用同一套脱敏检查结果，不额外暴露 secret、token 或隐藏 payload，并列出启用前需要在目标 Jira 重录的隐藏 secret 字段
   - `Copy review packet` 区块会直接说明它只是本机剪贴板 handoff，不会创建/编辑/启用 Jira automation，也不会运行 schedule 或恢复 secret
   - 预览详情、导入边界回执和两个 create 按钮都会显示 `Secret re-entry map` / `Credential re-entry queue` 的压缩口径；用户可以在创建 disabled copy 前看到哪些字段只是占位符，而不是导入后才发现凭据没有恢复
   - 检测到高风险项时，预览会显示 JQL/过滤器、源项目引用、外部效果、环境绑定等高风险类别，以及 Activation plan 的首个高风险步骤；导入按钮不再因为高风险项而禁用
   - sticky header 的导入按钮旁会显示 create-stage ready 回执，说明点击只会创建禁用副本，Jira-side Activation plan review 仍然 open
   - 链式触发保护在预览里可见、可切换，目标状态会直接显示在摘要和 `规则链式触发选择` 回执中；每次切换都会重算导入副本预览和复核包，但不再重新锁住导入按钮，也不会在点击导入前写 Jira
   - 导入预览、按钮、复制复核包状态、预检 / pending / success / failure 回执会读取 Options 页的 `personalAiUiPreferences.language`，按中文或 English 展示
   - 创建成功后显示短暂但可读的 post-import 回执，复述 disabled copy、secret 重录、手动测试、Jira 描述中保留 Activation plan，以及即将跳转到导入规则详情；错误时显示脱敏失败回执，不回显 Jira/API 返回的原始 secret-bearing response
   - post-import 回执会给出自动跳转、立即打开和留在当前页三个状态；留在当前页只取消导航，不改变导入结果或启用复核状态
   - 创建请求等待中会先显示持久 pending 回执，绑定实际导入名、目标项目、payload disabled 状态和链式触发处理结果；成功或失败回执出现后会清理 pending 状态再确认最终结果

### 文件列表

- `src/contentScriptJiraAutomation.ts` - 主要实现文件
- `src/jira-automation-import/transform.ts` - 导入 JSON 校验与转换逻辑
- 已在 `src/manifest.json` 中配置相应的 content script
- 已在 `webpack.common.cjs` 中添加构建配置

## 错误处理

- 文件格式验证
- 5MB 文件大小限制
- 缺少项目 ID / projectKey 时阻止导入
- 缺少目标 projectId 时阻止转换
- 对环境绑定值和 app-provided component 做导入前预检，但不会自动改写 JQL、URL、custom field、saved filter、connection、账号、敏感/隐藏值、smart value 或第三方组件；预览和复核备注会脱敏 URL query / fragment 和常见 webhook path 里的凭据样本
- `secret=true` 容器会被视为不可展开的 secret 引用，只展示安全标签或安全字段上下文，避免隐藏 payload 通过其它扫描类别被回显；如果没有可显示名称，复核清单会把它当作需要在目标 Jira 重录的隐藏值；导入 payload 同样只带重录占位符，不携带原始隐藏值、明显敏感字段值或 URL 凭据片段
- 自由文本里的 secret 也会清洗，包括规则名、原描述、label、Web request body、诊断 body、复制复核包和 console 可见文本；只保留 `REDACTED` / `PERSONAL_AI_REENTER_SECRET` 和必要业务上下文
- 创建 API 失败时会先清洗失败详情，再进入 toast 和 console：保留 HTTP status / Jira 错误大意，脱敏 URL 用户名密码、token query/fragment、Authorization/Bearer、`keyOrValue`、secret/password/API key 字段、email 和高熵 path token
- 读取目标项目已有规则名失败时，只降级同名检查，不阻止 disabled-copy 预览；复制包和导入描述会保留未确认回执，提醒先检查已有或新建 disabled copy 再重试/启用
- API 调用错误处理
- 用户友好的错误消息提示

## 注意事项

1. 导入的规则会使用当前项目的 projectId
2. 如果文件包含多个规则，需要在预览弹窗中选择其中一条
3. 导入的规则会被标记为新规则（isNewRule: true）
4. 原有的规则 ID 会被替换为新的临时 ID
5. 导入后的规则默认暂停，避免导入后立即执行
6. Jira 官方导入要求导出 JSON 与当前 Jira Automation 版本兼容；Personal AI 会提示该风险，但最终兼容性仍以 Jira API 返回为准
7. Web request URL、外部集成账号、secret、敏感或隐藏值、JQL、custom field、saved filter、connection、smart value、custom/app component、链式触发和定时计划不会自动判断业务正确性，启用前仍需人工复核；预检只负责把疑似环境绑定值和兼容性风险提前暴露出来
8. 链式触发默认按安全导入处理；如果业务需要其它 automation rule 继续触发它，需要在预览里明确保留

## 验证建议

- 转换逻辑：`npm run verify:jira-automation-import`
- 扩展构建：运行 `npm start`，等第一次 webpack 编译成功后停止 watch
- 端到端模拟：`npm run verify:jira-automation-import:e2e`
- 端到端：用导出的 Jira Automation JSON 在项目自动化页触发预览，确认新规则是 disabled copy 后再手动启用
