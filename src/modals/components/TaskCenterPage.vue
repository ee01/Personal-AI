<template>
  <div class="task-center-page">
    <div class="page-header">
      <div>
        <h2>任务中心</h2>
        <p>{{ pageDescription }}</p>
      </div>
      <div class="header-actions">
        <button
          v-if="completedCount > 0"
          class="tc-btn"
          @click="pendingCleanup = true"
        >清理已完成（{{ completedCount }}）</button>
        <button class="tc-btn" @click="loadAll()">刷新</button>
        <button class="tc-btn primary" @click="openCreate()">＋ 新建任务</button>
      </div>
    </div>

    <!-- One compact line: what is on, what is not, and a way in. The detail
         lives in the setup drawer rather than taking a third of the viewport. -->
    <button class="level-bar" :class="{ incomplete: levelsProbeReady && !allLevelsActive, probing: !levelsProbeReady }" @click="setupOpen = true">
      <span class="level-bar-label">能力</span>
      <span v-for="level in levels" :key="level.key" class="level-pill" :class="levelPillClass(level)">
        <span class="level-dot" />{{ level.shortLabel }}
      </span>
      <span class="level-bar-cta">{{ levelBarCta }}</span>
    </button>

    <!-- Guided setup: the same three steps as the prototype, each linking to the
         surface that actually owns that configuration. -->
    <div v-if="setupOpen" class="tc-backdrop" @click.self="setupOpen = false">
      <div class="tc-dialog" role="dialog" aria-label="任务中心初始化">
        <div class="tc-dialog-head">
          <strong>初始化任务中心</strong>
          <span class="tc-x" @click="setupOpen = false">✕</span>
        </div>
        <div class="tc-dialog-body">
          <p class="setup-intro">
            能力是分层的：装完插件就能用 L0，L1 和 L2 按需开启。未开启不影响已有功能，只是少一些投递目标和调度选择。
          </p>

          <div v-for="(level, index) in levels" :key="level.key" class="setup-step" :class="setupStepClass(level)">
            <div class="setup-step-top">
              <span class="setup-num">{{ setupStepIcon(level, index) }}</span>
              <strong>{{ level.label }}</strong>
              <span class="setup-state" :class="{ probing: !levelsProbeReady && level.key !== 'l0' }">
                {{ levelSetupState(level) }}
              </span>
            </div>
            <div class="setup-step-body">
              <p>{{ level.detail }}</p>
          <p class="setup-unlocks"><span>解锁</span>{{ level.unlocks }}</p>
          <div v-if="level.key === 'l1'" class="setup-channels">
            <div class="setup-channel" :class="channelRowClass(botConfigured)">
              <strong>🤖 Bot（SM AI · 🏠 私发）</strong>
              <span>{{ channelStatusLabel(botConfigured) }}</span>
              <button
                v-if="levelsProbeReady && !botConfigured"
                class="tc-btn sm"
                @click="openL1Config('bot')"
              >
                在此配置 Bot
              </button>
              <button v-else-if="levelsProbeReady && botConfigured" class="tc-btn sm" @click="openL1Config('bot')">
                修改
              </button>
            </div>
            <div class="setup-channel" :class="channelRowClass(asmeConfigured)">
              <strong>👤 AsMe（本人身份 · 🏠）</strong>
              <span>{{ channelStatusLabel(asmeConfigured) }}</span>
              <button
                v-if="levelsProbeReady && !asmeConfigured"
                class="tc-btn sm"
                @click="openL1Config('asme')"
              >
                在此配置 AsMe
              </button>
              <button v-else-if="levelsProbeReady && asmeConfigured" class="tc-btn sm" @click="openL1Config('asme')">
                修改
              </button>
            </div>
            <p v-if="levelsProbeReady && cloudBotConfigured && !botConfigured" class="setup-channel-note">
              本机已有 ☁️ Jira 执行规则，那是云端推送用的，不等于 🏠 Glip 私发。
            </p>
            <p class="setup-channel-note">
              与 Options / memory-service 共用同一份 runtime 配置；服务端 <code>.env</code> 有默认值时会自动生效。
            </p>
            <div v-if="l1ConfigPanel" class="l1-config-panel">
              <div class="l1-config-head">
                <strong>{{ l1ConfigPanel === 'bot' ? '配置 🏠 Bot' : '配置 🏠 AsMe' }}</strong>
                <button class="tc-btn sm" @click="closeL1Config()">收起</button>
              </div>
              <template v-if="l1ConfigPanel === 'bot'">
                <label class="l1-field">
                  <span>Bot API Base URL</span>
                  <input v-model="l1BotDraft.botApiBaseUrl" type="url" placeholder="https://botman.int.rclabenv.com/v2" />
                </label>
                <label class="l1-field">
                  <span>Bot ID（Glip）</span>
                  <input v-model="l1BotDraft.botId" type="text" placeholder="4700372020@37439510.bot.glip.net" />
                </label>
                <label class="l1-field">
                  <span>Bot Token{{ l1BotDraft.botTokenConfigured ? '（留空则保留已保存）' : '' }}</span>
                  <input v-model="l1BotDraft.botToken" type="password" autocomplete="off" />
                </label>
              </template>
              <template v-else>
                <label class="l1-field">
                  <span>RingCentral Server URL</span>
                  <input v-model="l1AsmeDraft.ringCentralServerUrl" type="url" placeholder="https://platform.ringcentral.com" />
                </label>
                <label class="l1-field">
                  <span>Client ID</span>
                  <input v-model="l1AsmeDraft.ringCentralClientId" type="text" />
                </label>
                <label class="l1-field">
                  <span>Client Secret{{ l1AsmeDraft.clientSecretConfigured ? '（留空则保留已保存）' : '' }}</span>
                  <input v-model="l1AsmeDraft.ringCentralClientSecret" type="password" autocomplete="off" />
                </label>
                <label class="l1-field">
                  <span>JWT{{ l1AsmeDraft.jwtConfigured ? '（留空则保留已保存）' : '' }}</span>
                  <input v-model="l1AsmeDraft.ringCentralJwt" type="password" autocomplete="off" />
                </label>
                <p class="setup-channel-note">与主动询问（Outreach）共用；也可在 Options → 主动询问 中修改。</p>
              </template>
              <div class="l1-config-actions">
                <button class="tc-btn primary" :disabled="l1Saving" @click="saveL1Config()">
                  {{ l1Saving ? '保存中…' : '保存到 memory-service' }}
                </button>
              </div>
            </div>
          </div>
          <div v-else-if="level.key === 'l2'" class="setup-channels">
            <div class="setup-channel" :class="channelRowClass(cloudLaneAvailable)">
              <strong>Sheet</strong>
              <span>{{ l2ChannelLabel(cloudLaneAvailable, probedSheetLabel) }}</span>
            </div>
            <div class="setup-channel" :class="channelRowClass(cloudBotConfigured)">
              <strong>☁️ Jira 执行规则</strong>
              <span>{{ l2ChannelLabel(cloudBotConfigured) }}</span>
            </div>
            <div class="setup-channel" :class="channelRowClass(cloudTimelineConfigured)">
              <strong>☁️ Timeline Sync</strong>
              <span>{{ l2ChannelLabel(cloudTimelineConfigured) }}</span>
            </div>
            <div class="setup-channel" :class="channelRowClass(cloudAsmeConfigured)">
              <strong>☁️ AsMe（Sheet）</strong>
              <span>{{ l2ChannelLabel(cloudAsmeConfigured) }}</span>
            </div>
            <div v-if="levelsProbeReady && level.action" class="setup-actions">
              <button class="tc-btn primary" @click="level.action.run()">{{ level.action.label }}</button>
              <small>{{ level.action.hint }}</small>
            </div>
          </div>
          <div v-else-if="level.action" class="setup-actions">
            <button class="tc-btn primary" @click="level.action.run()">{{ level.action.label }}</button>
            <small>{{ level.action.hint }}</small>
          </div>
            </div>
          </div>

          <div class="setup-note">
            L2 在受管 Google 账号下可能被域策略拦住（禁止匿名 Web App 部署）。届时定时消息页会给出明确原因；
            没有 L2 也不影响任何任务创建，只是调度器固定用 🏠。
          </div>
        </div>
        <div class="tc-dialog-foot">
          <span class="tc-sync-hint">配置完成后回到本页刷新即可生效</span>
          <button class="tc-btn" @click="setupOpen = false">关闭</button>
        </div>
      </div>
    </div>

    <div class="chips" role="tablist" aria-label="任务类型">
      <button
        v-for="chip in kindChips"
        :key="chip.value"
        class="chip"
        :class="{ on: activeKind === chip.value }"
        role="tab"
        :aria-selected="activeKind === chip.value"
        @click="setKind(chip.value)"
      >
        {{ chip.label }}
        <span v-if="chip.count > 0" class="chip-count">{{ chip.count }}</span>
      </button>
    </div>

    <div v-if="pendingCleanup" class="tc-confirm tc-confirm-page">
      <strong>清理 {{ completedCount }} 条已完成任务？</strong>
      <span>已完成 / 已取消的账本行会删掉，无法撤销。进行中的任务不受影响。</span>
      <div>
        <button class="tc-btn" @click="pendingCleanup = false">取消</button>
        <button class="tc-btn danger" :disabled="saving" @click="confirmCleanupCompleted()">确认清理</button>
      </div>
    </div>

    <div v-if="loading" class="tc-loading">加载任务中…</div>
    <div v-else-if="loadError" class="tc-error">
      <strong>无法读取任务</strong>
      <span>{{ loadError }}</span>
    </div>
    <div v-else-if="visibleTasks.length === 0" class="tc-empty">
      <p>{{ emptyMessage }}</p>
      <button class="tc-btn primary" @click="openCreate()">＋ 建一个试试</button>
    </div>

    <div v-else class="tc-layout">
      <section class="tc-list" aria-label="任务列表">
        <div v-for="group in groupedTasks" :key="group.title" class="tc-group">
          <div class="tc-group-head">
            {{ group.title }}<span class="tc-group-count">{{ group.tasks.length }} 条</span>
          </div>
          <div
            v-for="task in group.tasks"
            :key="task.id"
            class="tc-row"
            :class="{ on: selectedId === task.id }"
            role="button"
            tabindex="0"
            @click="select(task)"
            @keydown.enter="select(task)"
          >
            <span class="tc-time">{{ formatWhen(task) }}</span>
            <span class="tc-kind" :class="task.taskKind">{{ kindLabel(task.taskKind) }}</span>
            <span class="tc-lane" :title="laneTitle(task)">{{ task.lane === 'jira_sheet' ? '☁️' : '🏠' }}</span>
            <span class="tc-title">{{ task.title }}</span>
            <span class="tc-status" :class="statusTone(task.queueStatus)">{{ statusLabel(task) }}</span>
            <span class="tc-row-actions" @click.stop>
              <button
                v-if="canPause(task)"
                class="tc-icon-btn"
                title="暂停后到期扫描会跳过此任务"
                @click="controlTask(task, 'pause')"
              >⏸️</button>
              <button
                v-else-if="task.queueStatus === 'paused'"
                class="tc-icon-btn"
                title="恢复后按原排程继续执行"
                @click="controlTask(task, 'resume')"
              >▶️</button>
              <button
                v-if="canRetry(task)"
                class="tc-icon-btn"
                title="失败任务重新入队"
                @click="controlTask(task, 'retry')"
              >↻</button>
              <button class="tc-icon-btn" title="编辑" @click="openEdit(task)">✏️</button>
              <button class="tc-icon-btn danger" title="删除" @click="askDelete(task)">🗑️</button>
            </span>
          </div>
        </div>
      </section>

      <section v-if="selected" class="tc-detail" aria-label="任务详情">
        <div class="tc-detail-head">
          <span class="tc-kind" :class="selected.taskKind">{{ kindLabel(selected.taskKind) }}</span>
          <h3>{{ selected.title }}</h3>
          <span class="tc-status" :class="statusTone(selected.queueStatus)">{{ statusLabel(selected) }}</span>
        </div>

        <dl class="tc-facts">
          <div><dt>调度器</dt><dd>{{ laneTitle(selected) }}</dd></div>
          <div><dt>下次执行</dt><dd>{{ selected.queueStatus === 'paused' ? '已暂停' : formatWhen(selected) }}</dd></div>
          <div v-if="selected.recurrenceSpec"><dt>重复</dt><dd>{{ recurrenceLabel(selected) }}</dd></div>
          <div v-if="selectedContent"><dt>内容</dt><dd class="tc-pre">{{ selectedContent }}</dd></div>
          <div v-if="selectedNotifyLabel"><dt>通知</dt><dd>{{ selectedNotifyLabel }}</dd></div>
          <div v-if="selected.dependsOn?.length"><dt>依赖</dt><dd>{{ selected.dependsOn.length }} 个前置任务未完成前不会执行</dd></div>
          <div v-if="selected.mirrorRef"><dt>Sheet 镜像</dt><dd>{{ mirrorLabel(selected) }}</dd></div>
          <div v-if="selected.retryCount > 0"><dt>重试</dt><dd>{{ selected.retryCount }} 次</dd></div>
        </dl>

        <div v-if="selected.lastError" class="tc-error-box">
          <strong>最近一次失败</strong>
          <span>{{ selected.lastError }}</span>
        </div>

        <div v-if="childTasks.length" class="tc-children">
          <div class="tc-children-head">子任务 {{ childTasks.length }} 个</div>
          <div v-for="child in childTasks" :key="child.id" class="tc-child">
            <span class="tc-status" :class="statusTone(child.queueStatus)">{{ statusLabel(child) }}</span>
            <span>{{ child.title }}</span>
          </div>
          <small>父任务在全部子任务成功后自动完成。</small>
        </div>

        <div class="tc-detail-actions">
          <button class="tc-btn primary" @click="openEdit(selected)">编辑</button>
          <button
            v-if="canPause(selected)"
            class="tc-btn"
            @click="controlTask(selected, 'pause')"
          >暂停</button>
          <button
            v-if="selected.queueStatus === 'paused'"
            class="tc-btn"
            @click="controlTask(selected, 'resume')"
          >恢复</button>
          <button
            v-if="canRunNow(selected)"
            class="tc-btn"
            @click="controlTask(selected, 'run_now')"
          >立即执行</button>
          <button
            v-if="canRetry(selected)"
            class="tc-btn"
            @click="controlTask(selected, 'retry')"
          >重试</button>
          <button
            v-if="canComplete(selected)"
            class="tc-btn"
            @click="controlTask(selected, 'complete')"
          >标记完成</button>
          <button class="tc-btn" @click="duplicateTask(selected)">复制</button>
          <router-link
            v-if="selected.sourceRefId"
            class="tc-btn"
            :to="`/actions?sourceKind=${selected.sourceKind || 'agent_task'}&sourceRefId=${selected.sourceRefId}`"
          >查看执行记录</router-link>
          <button class="tc-btn" @click="sweep()">滚动到下一次</button>
          <button class="tc-btn danger" @click="pendingDelete = true">删除</button>
        </div>
        <div v-if="pendingDelete" class="tc-confirm">
          <strong>确定删除「{{ selected.title }}」？</strong>
          <span>账本行会删掉，无法撤销。暂停请用上面的暂停。</span>
          <div>
            <button class="tc-btn" @click="pendingDelete = false">取消</button>
            <button class="tc-btn danger" :disabled="saving" @click="confirmDeleteTask(selected)">确认删除</button>
          </div>
        </div>
      </section>
    </div>

    <!-- Create dialog: fields differ per kind, lane picker greys what is unavailable. -->
    <div v-if="createOpen" class="tc-backdrop" @click.self="closeEditor()">
      <div class="tc-dialog" role="dialog" :aria-label="isEditMode ? '编辑任务' : '新建任务'">
        <div class="tc-dialog-head">
          <strong>{{ isEditMode ? '编辑任务' : '新建任务' }}</strong>
          <span class="tc-x" @click="closeEditor()">✕</span>
        </div>

        <div class="tc-dialog-body">
          <div class="tc-field">
            <label>任务类型</label>
            <div class="tc-opts">
              <button
                v-for="opt in createKindOptions"
                :key="opt.value"
                class="tc-opt"
                :class="{ on: draft.taskKind === opt.value, off: isEditMode && draft.taskKind !== opt.value }"
                :disabled="isEditMode && draft.taskKind !== opt.value"
                @click="!isEditMode && (draft.taskKind = opt.value)"
              >
                {{ opt.label }}<small>{{ opt.hint }}</small>
              </button>
            </div>
          </div>

          <div class="tc-field">
            <label>标题 <span class="req">*</span></label>
            <input v-model="draft.title" type="text" :placeholder="titlePlaceholder" />
          </div>

          <template v-if="draft.taskKind === 'push'">
            <div class="tc-field">
              <label>推送形态</label>
              <div class="tc-opts">
                <button class="tc-opt" :class="{ on: draft.pushMethod === 'message' }" @click="draft.pushMethod = 'message'">
                  文本消息<small>到点把内容发出去</small>
                </button>
                <button class="tc-opt" :class="{ on: draft.pushMethod === 'ai' }" @click="draft.pushMethod = 'ai'">
                  AI Report<small>按 JQL 拉报表再推送</small>
                </button>
              </div>
            </div>
            <div v-if="draft.pushMethod === 'ai'" class="tc-field">
              <label>JQL <span class="req">*</span></label>
              <textarea v-model="draft.content" rows="3" placeholder="例如：project = MTR AND assignee is EMPTY" />
            </div>
            <div v-else class="tc-field">
              <label>内容</label>
              <textarea v-model="draft.content" rows="3" placeholder="要推送的内容" />
            </div>
            <div v-if="draft.pushMethod === 'ai'" class="tc-field">
              <label>补充说明</label>
              <input v-model="draft.extraText" type="text" placeholder="可选，附加在报表前面的话" />
            </div>
          </template>

          <template v-if="draft.taskKind === 'agent'">
            <div class="tc-field">
              <label>任务描述 <span class="req">*</span></label>
              <textarea v-model="draft.content" rows="4" placeholder="只描述要做什么；查到 0 条也是合法成功" />
            </div>
            <div class="tc-field">
              <label>执行边界</label>
              <div class="tc-opts">
                <button class="tc-opt" :class="{ on: draft.mode === 'read' }" @click="draft.mode = 'read'">🔍 只读查询</button>
                <button class="tc-opt" :class="{ on: draft.mode === 'write' }" @click="draft.mode = 'write'">
                  ✍️ 允许外部写入<small>执行前需你审批</small>
                </button>
              </div>
            </div>
            <div class="tc-field">
              <label class="ck">
                <input v-model="draft.successReceipt" type="checkbox" />
                成功时也私发回执给我（失败回执始终开启）
              </label>
            </div>
            <div class="tc-field">
              <label class="ck">
                <input
                  :checked="notifyWhenEmpty"
                  type="checkbox"
                  @change="notifyWhenEmptyChoice = ($event.target as HTMLInputElement).checked"
                />
                0 匹配也推送结果通知
              </label>
              <small class="tc-hint">
                默认不推送：查到 / 改到 0 条只记 run 账本。勾选后才会发到通知目标。
              </small>
            </div>
          </template>

          <template v-if="draft.taskKind === 'remind'">
            <div class="tc-field">
              <label>快捷时间</label>
              <div class="tc-opts">
                <button
                  v-for="preset in remindPresets"
                  :key="preset.label"
                  class="tc-opt"
                  :class="{ on: draft.remindPreset === preset.label }"
                  @click="applyRemindPreset(preset.label)"
                >{{ preset.label }}</button>
              </div>
              <small class="tc-hint">快捷项会写入下面的执行日期 / 时间，仍可再改。</small>
            </div>
          </template>

          <template v-if="draft.taskKind === 'dev'">
            <div class="tc-field">
              <label>任务说明</label>
              <textarea v-model="draft.content" rows="3" />
            </div>
            <div class="tc-field">
              <label>验收标准 <span class="req">*</span></label>
              <textarea
                v-model="draft.acceptance"
                rows="2"
                placeholder="怎样算完成？说不清就先回 Codex / Claude Code 里聊，定稿再委派"
              />
            </div>
          </template>

          <template v-if="draft.taskKind === 'outreach'">
            <div class="tc-field">
              <label>要问的问题 <span class="req">*</span></label>
              <textarea v-model="draft.content" rows="3" placeholder="问对方什么" />
            </div>
            <div class="tc-field">
              <label>询问对象 *</label>
              <div class="tc-opts">
                <button class="tc-opt" :class="{ on: draft.targetType === 'private' }" @click="draft.targetType = 'private'">
                  💬 私发
                </button>
                <button class="tc-opt" :class="{ on: draft.targetType === 'group' }" @click="draft.targetType = 'group'">
                  👥 群组
                </button>
              </div>
            </div>
            <div v-if="draft.targetType === 'private'" class="tc-field">
              <label>接收人 *</label>
              <div class="tc-tags">
                <span v-for="tag in draft.recipients" :key="tag" class="tc-tag">
                  {{ tag }}<button type="button" @click="removeRecipient(tag)">×</button>
                </span>
                <input
                  v-model="draft.recipientInput"
                  type="text"
                  placeholder="Esone Qiu 或 esone.qiu，Enter 添加"
                  @keydown.enter.prevent="commitRecipient()"
                  @blur="commitRecipient()"
                />
              </div>
              <small class="tc-hint">与定时消息页相同：空格或点号分隔名和姓。</small>
            </div>
            <div v-else class="tc-field">
              <label>群组 ID *</label>
              <input v-model="draft.glipTeamId" type="text" placeholder="例如 148192141318" />
            </div>
            <div class="tc-inline">
              <div class="tc-field">
                <label>最多追问次数</label>
                <input v-model.number="draft.outreachMaxFollowup" type="number" min="0" />
              </div>
              <div class="tc-field">
                <label>追问间隔（小时）</label>
                <input v-model.number="draft.outreachFollowupHours" type="number" min="1" />
              </div>
            </div>
          </template>

          <div v-if="showsNotifyChannel" class="tc-field">
            <label>通知通道</label>
            <div class="tc-opts">
              <button class="tc-opt" :class="{ on: draft.notifyVia === 'plugin' }" @click="draft.notifyVia = 'plugin'">
                🔔 插件通知<small>Chrome 通知 · 零配置</small>
              </button>
              <button
                class="tc-opt"
                :class="{ on: draft.notifyVia === 'bot', off: !levelsProbeReady || !botConfigured }"
                :disabled="!levelsProbeReady || !botConfigured"
                @click="selectNotifyVia('bot')"
              >
                🤖 Glip Bot<small>{{ notifyChannelHint('bot') }}</small>
              </button>
              <button
                class="tc-opt"
                :class="{ on: draft.notifyVia === 'asme', off: !levelsProbeReady || !asmeConfigured }"
                :disabled="!levelsProbeReady || !asmeConfigured"
                @click="selectNotifyVia('asme')"
              >
                👤 AsMe 本人身份<small>{{ notifyChannelHint('asme') }}</small>
              </button>
            </div>
            <div v-if="levelsProbeReady && !botConfigured && !asmeConfigured" class="tc-lane-note blocked">
              Glip 通道需要 Level 1（Bot 或 AsMe）。点右上「能力」去配置。
            </div>
          </div>

          <template v-if="showsNotifyTarget">
            <div class="tc-field">
              <label>推送目标 *</label>
              <div class="tc-opts">
                <button class="tc-opt" :class="{ on: draft.targetType === 'private' }" @click="draft.targetType = 'private'">
                  💬 私发消息
                </button>
                <button class="tc-opt" :class="{ on: draft.targetType === 'group' }" @click="draft.targetType = 'group'">
                  👥 群组消息
                </button>
              </div>
            </div>
            <div v-if="draft.targetType === 'private'" class="tc-field">
              <label>
                接收人 {{ draft.taskKind === 'remind' ? '（可空，空则发给自己）' : '*' }}
                <span v-if="draft.notifyVia === 'bot'" class="tc-hint-inline">Bot 只能填一个人</span>
              </label>
              <div class="tc-tags">
                <span v-for="tag in draft.recipients" :key="tag" class="tc-tag">
                  {{ tag }}<button type="button" @click="removeRecipient(tag)">×</button>
                </span>
                <input
                  v-model="draft.recipientInput"
                  type="text"
                  :placeholder="draft.notifyVia === 'bot' ? 'Esone Qiu 或 esone.qiu' : '输入人名后 Enter 添加'"
                  @keydown.enter.prevent="commitRecipient()"
                  @blur="commitRecipient()"
                />
              </div>
              <small v-if="recipientError" class="tc-field-error">{{ recipientError }}</small>
            </div>
            <div v-else class="tc-field">
              <label>群组 ID *</label>
              <input v-model="draft.glipTeamId" type="text" placeholder="例如 148192141318" />
              <small class="tc-hint">
                Bot 群发前请先把 SM AI 加进目标群。
                <a href="https://drive.google.com/file/d/1t6KrOK7OZL3f8X2LBIM02H5OsIl38_QC/view" target="_blank" rel="noopener noreferrer">如何获取 Team ID</a>
              </small>
            </div>
          </template>

          <div v-if="showsSchedule" class="tc-field">
            <label>执行时间 *</label>
            <div class="tc-inline">
              <input v-model="draft.scheduleDate" type="date" />
              <input v-model="draft.scheduleTime" type="time" />
            </div>
            <div class="tc-quick">
              <button type="button" class="tc-btn sm" @click="applyQuick('one-minute')">1 分钟后</button>
              <button type="button" class="tc-btn sm" @click="applyQuick('next-hour')">下个整点</button>
              <button type="button" class="tc-btn sm" @click="applyQuick('default-morning')">明早 9:00</button>
            </div>
          </div>

          <div v-if="showsSchedule" class="tc-field">
            <label class="ck">
              <input v-model="draft.repeating" type="checkbox" @change="onRepeatingToggle" />
              {{ draft.taskKind === 'agent' ? '重复执行' : '是否重复推送' }}
            </label>
          </div>

          <div v-if="showsSchedule && draft.repeating" class="tc-repeat">
            <div class="tc-inline">
              <div class="tc-field">
                <label>每隔 *</label>
                <input v-model.number="draft.repeatEvery" type="number" min="1" />
              </div>
              <div class="tc-field">
                <label>重复单位 *</label>
                <div class="tc-opts compact">
                  <button
                    v-for="unit in repeatUnits"
                    :key="unit.value"
                    class="tc-opt"
                    :class="{ on: draft.repeatUnit === unit.value }"
                    @click="setRepeatUnit(unit.value)"
                  >{{ unit.label }}</button>
                </div>
              </div>
            </div>
            <div v-if="draft.repeatUnit === 'Week'" class="tc-field">
              <label>每周几</label>
              <div class="tc-day-chips">
                <button
                  v-for="item in weekDays"
                  :key="item.day"
                  type="button"
                  class="tc-day"
                  :class="{ on: draft.weekDays.includes(item.day) }"
                  @click="toggleWeekDay(item.day)"
                >{{ item.label }}</button>
              </div>
              <small class="tc-hint">不选则按执行日期所在星期循环。</small>
            </div>
            <div v-if="draft.repeatUnit === 'Month'" class="tc-field">
              <label>每月几号</label>
              <div class="tc-day-chips wrap">
                <button
                  v-for="day in monthDays"
                  :key="day"
                  type="button"
                  class="tc-day"
                  :class="{ on: scheduleMonthDay === day }"
                  @click="setMonthDay(day)"
                >{{ day }}</button>
              </div>
              <small class="tc-hint">与执行日期同一天；选 31 号时短月会落到当月最后一天。</small>
            </div>
            <div v-if="draft.repeatUnit === 'Day'" class="tc-hint">「天」按工作日滚动，周六日会跳过，与定时消息页相同。</div>
            <div class="tc-inline">
              <div class="tc-field">
                <label>结束日期（可选）</label>
                <input v-model="draft.endDate" type="date" />
              </div>
              <div class="tc-field">
                <label>重复次数（可选）</label>
                <input v-model="draft.repeatCount" type="number" min="1" placeholder="留空表示无限" />
              </div>
            </div>
          </div>

          <div class="tc-field">
            <label>调度器</label>
            <div class="tc-opts">
              <button
                class="tc-opt"
                :class="{ on: effectiveLane === 'memory_cron' }"
                @click="draft.lane = 'memory_cron'"
              >
                🏠 memory_cron<small>本地到期队列 · 秒级入队</small>
              </button>
              <button
                class="tc-opt"
                :class="{ on: effectiveLane === 'jira_sheet', off: !cloudSelectable }"
                :disabled="!cloudSelectable"
                @click="cloudSelectable && (draft.lane = 'jira_sheet')"
              >
                ☁️ jira_sheet<small>{{ cloudLaneHint }}</small>
              </button>
            </div>
            <div class="tc-lane-note" :class="laneNoteTone">{{ laneNote }}</div>
          </div>
        </div>

        <div class="tc-dialog-foot">
          <span class="tc-sync-hint">{{ syncHint }}</span>
          <button class="tc-btn" @click="closeEditor()">取消</button>
          <button class="tc-btn primary" :disabled="!canSave || saving" @click="saveTask()">
            {{ saving ? '保存中…' : isEditMode ? '保存修改' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="tc-toast">{{ toast }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  getMemoryServiceClient,
  type TaskCenterTask,
  type TaskKind,
  type TaskLane,
} from '../../services/MemoryServiceClient';
import { probeTaskCenterLevels } from '../taskCenterLevels';
import {
  buildL1AsmeSavePayload,
  buildL1BotSavePayload,
  decideRingCentralAdoptFromSheet,
  hydrateL1AsmeDraft,
  hydrateL1BotDraft,
} from '../taskCenterCredentials';
import {
  WEEK_DAYS,
  MONTH_DAYS,
  addRecipientTag,
  applyQuickSchedule,
  buildNotifyPayload,
  buildRecurrenceSpec,
  createEmptyTaskDraft,
  dayOfMonth,
  formatLocalDate,
  formatLocalTime,
  hydrateTaskDraftFromTask,
  notifyTargetIncomplete,
  notifyWhenEmptyFromTask,
  recurrenceLabelFromSpec,
  resolveScheduledAtMs,
  setDateDay,
  snapScheduleDateToWeekDays,
  type NotifyVia,
  type RepeatUnit,
} from '../taskCenterSchedule';
import type { RuntimeConfigResponse } from '../../services/MemoryServiceClient';

const client = getMemoryServiceClient();

const loading = ref(true);
const loadError = ref('');
const tasks = ref<TaskCenterTask[]>([]);
const selectedId = ref('');
const activeKind = ref<TaskKind | 'all' | 'paused'>('all');
const createOpen = ref(false);
const editingTaskId = ref('');
const pendingDelete = ref(false);
const pendingCleanup = ref(false);
const isEditMode = computed(() => Boolean(editingTaskId.value));
const setupOpen = ref(false);
const saving = ref(false);
const toast = ref('');
const laneSelectableKinds = ref<TaskKind[]>(['push', 'agent']);

/**
 * Level 2 (Sheet + Apps Script + Jira rule) is configured in the extension, not
 * in memory-service, so the page reads it from chrome.storage rather than the
 * API — the backend has no way to detect it.
 */
const cloudLaneAvailable = ref(false);
const botConfigured = ref(false);
const asmeConfigured = ref(false);
const cloudBotConfigured = ref(false);
const cloudTimelineConfigured = ref(false);
const cloudAsmeConfigured = ref(false);
const probedSheetId = ref('');
const levelsProbeReady = ref(false);
const probedSheetLabel = computed(() => {
  const id = probedSheetId.value;
  if (!id) return '已探测';
  return id.length <= 18 ? id : `${id.slice(0, 8)}…${id.slice(-6)}`;
});

const l1ConfigPanel = ref<'bot' | 'asme' | null>(null);
const l1Saving = ref(false);
const l1BotDraft = ref(hydrateL1BotDraft(null));
const l1AsmeDraft = ref(hydrateL1AsmeDraft(null));
let ringCentralAdoptNotified = false;

const draft = ref(createEmptyTaskDraft({ botConfigured: false, asmeConfigured: false }));
const recipientError = ref('');
const weekDays = WEEK_DAYS;
const monthDays = MONTH_DAYS;
const repeatUnits: Array<{ value: RepeatUnit; label: string }> = [
  { value: 'Day', label: '天' },
  { value: 'Week', label: '周' },
  { value: 'Month', label: '月' },
  { value: 'Year', label: '年' },
];

/**
 * null means the task never chose. Empty results stay silent until the user
 * opts in; read and write share that default.
 */
const notifyWhenEmptyChoice = ref<boolean | null>(null);
const notifyWhenEmpty = computed(() => notifyWhenEmptyChoice.value === true);

const remindPresets = [
  { label: '1 小时后', ms: 3600_000 },
  { label: '今晚 19:00', ms: 0 },
  { label: '明早 9:00', ms: 0 },
  { label: '下周一 9:00', ms: 0 },
];

const KIND_LABELS: Record<TaskKind, string> = {
  push: '定时推送',
  agent: 'Agent 任务',
  remind: '提醒我',
  dev: '开发委派',
  reflection: '反思候选',
  outreach: '帮我问',
};

const createKindOptions: Array<{ value: TaskKind; label: string; hint: string }> = [
  { value: 'push', label: '⏰ 定时推送', hint: '定时把消息 / 报表推送出去' },
  { value: 'agent', label: '🤖 Agent 任务', hint: '让 agent 定期执行外部操作' },
  { value: 'remind', label: '⏳ 提醒我', hint: '到点提醒我自己' },
  { value: 'dev', label: '🛠 开发委派', hint: '定稿的开发 / 调研工作单' },
  { value: 'outreach', label: '📣 帮我问', hint: '向同事发起主动询问' },
];

/**
 * L2 (Sheet + Apps Script + Jira rule) lives on the scheduled-messages page.
 * L1 (Bot / AsMe) uses memory-service runtime config — same store as Options.
 */
function openScheduledMessages(hash = '') {
  window.open(chrome.runtime.getURL(`scheduled-messages.html${hash}`), '_blank');
}

async function openL1Config(kind: 'bot' | 'asme') {
  l1ConfigPanel.value = kind;
  try {
    const runtime = await client.getRuntimeConfig();
    if (kind === 'bot') {
      l1BotDraft.value = hydrateL1BotDraft(runtime);
    } else {
      l1AsmeDraft.value = hydrateL1AsmeDraft(runtime);
    }
  } catch {
    if (kind === 'bot') l1BotDraft.value = hydrateL1BotDraft(null);
    else l1AsmeDraft.value = hydrateL1AsmeDraft(null);
  }
}

function closeL1Config() {
  l1ConfigPanel.value = null;
}

async function saveL1Config() {
  l1Saving.value = true;
  try {
    const payload =
      l1ConfigPanel.value === 'bot'
        ? buildL1BotSavePayload(l1BotDraft.value)
        : buildL1AsmeSavePayload(l1AsmeDraft.value);
    await client.updateRuntimeConfig(payload);
    await detectLevels();
    showToast(l1ConfigPanel.value === 'bot' ? 'Bot 配置已保存' : 'AsMe 配置已保存');
    closeL1Config();
  } catch (error) {
    showToast(`保存失败：${(error as Error).message}`);
  } finally {
    l1Saving.value = false;
  }
}

async function adoptRingCentralFromSheetIfNeeded(
  runtime: RuntimeConfigResponse | null,
  scheduledMessagesConfig: unknown,
): Promise<RuntimeConfigResponse | null> {
  const decision = decideRingCentralAdoptFromSheet({
    runtime,
    scheduledMessagesConfig,
    ringCentralServerUrl: runtime?.ringCentralServerUrl,
  });
  if (!decision.adopt) return runtime;
  try {
    const updated = await client.updateRuntimeConfig(decision.payload);
    if (!ringCentralAdoptNotified) {
      ringCentralAdoptNotified = true;
      showToast('已从定时消息配置收编 AsMe 凭据（与 Options 共用）');
    }
    return updated;
  } catch {
    return runtime;
  }
}

const levels = computed(() => [
  {
    key: 'l0',
    shortLabel: 'L0 账本',
    label: 'L0 任务账本',
    active: true,
    detail: '零配置，装完插件即可用。',
    unlocks: '四类任务全部可创建（🏠 本地调度）+ 插件通知',
    action: null as null | { label: string; hint: string; run: () => void },
  },
  {
    key: 'l1',
    shortLabel: 'L1 推送',
    label: 'L1 推送通道',
    active: botConfigured.value || asmeConfigured.value,
    detail: !levelsProbeReady.value
      ? '正在读取 memory-service runtime 配置…'
      : botConfigured.value || asmeConfigured.value
        ? '已配置至少一条 Glip 通道。Bot 与 AsMe 相互独立，配任一即部分解锁。'
        : '未配置 Bot 或 AsMe，通知目前只走插件通知（Chrome 通知）。',
    unlocks: 'Glip Bot 私发 / 群组、AsMe 本人身份作为通知目标',
    action: null as null | { label: string; hint: string; run: () => void },
  },
  {
    key: 'l2',
    shortLabel: 'L2 云端',
    label: 'L2 云端 lane（☁️ jira_sheet）',
    active: cloudLaneAvailable.value,
    detail: !levelsProbeReady.value
      ? '正在探测本机 Sheet / Jira 缓存…'
      : cloudLaneAvailable.value
        ? `已从本机缓存探测到维护表${probedSheetId.value ? `（${probedSheetLabel.value}）` : ''}。原 Sheet / Jira 规则照常运行。`
        : '未配置。需要 Google 授权和 Jira 项目 admin 权限。',
    unlocks: '☁️ 调度器（memory-service 离线也照跑）、Timeline 里程碑触发、Drive 附件',
    action: !levelsProbeReady.value
      ? null
      : cloudLaneAvailable.value
        ? {
            label: '打开定时消息页',
            hint: '查看已接入的 Sheet、Jira 规则和 Bot 配置，不会再走一遍初始化',
            run: () => openScheduledMessages(),
          }
        : {
            label: '去一键初始化',
            hint: '定时消息页 → 一键初始化，会创建 Sheet、部署脚本、装 Jira 规则。已有维护表请改用手动绑定。',
            run: () => openScheduledMessages(),
          },
  },
]);

const allLevelsActive = computed(() => levels.value.every((level) => level.active));

const levelBarCta = computed(() => {
  if (!levelsProbeReady.value) return '检测中…';
  return allLevelsActive.value ? '查看配置' : '去配置 →';
});

function levelPillClass(level: { key: string; active: boolean }) {
  if (!levelsProbeReady.value && level.key !== 'l0') return { probing: true };
  return { on: level.active };
}

function setupStepClass(level: { key: string; active: boolean }) {
  if (!levelsProbeReady.value && level.key !== 'l0') return { probing: true };
  return { done: level.active };
}

function setupStepIcon(level: { key: string; active: boolean }, index: number) {
  if (!levelsProbeReady.value && level.key !== 'l0') return '…';
  return level.active ? '✓' : index;
}

function levelSetupState(level: { key: string; active: boolean }) {
  if (level.key === 'l0') return '已启用';
  if (!levelsProbeReady.value) return '检测中…';
  return level.active ? '已启用' : '未启用';
}

function channelStatusLabel(configured: boolean) {
  if (!levelsProbeReady.value) return '检测中…';
  return configured ? '已配置' : '未配置';
}

function channelRowClass(configured: boolean) {
  if (!levelsProbeReady.value) return { probing: true };
  return { on: configured };
}

function l2ChannelLabel(configured: boolean, detailLabel?: string) {
  if (!levelsProbeReady.value) return '检测中…';
  if (configured) return detailLabel ?? '已探测';
  return detailLabel ? '未探测到本机缓存' : '未写入本机缓存';
}

function notifyChannelHint(kind: 'bot' | 'asme') {
  if (!levelsProbeReady.value) return '检测凭据…';
  if (kind === 'bot') return botConfigured.value ? 'SM AI 机器人' : '需 Level 1 · Bot';
  return asmeConfigured.value ? '与追问共用凭据' : '需 Level 1 · AsMe';
}

const pageDescription = computed(
  () =>
    '定时推送、Agent 任务、提醒我、开发委派、帮我问共用一个账本；🏠 由 memory-service 调度，☁️ 由 Jira Automation 云端触发。',
);

const kindChips = computed(() => {
  const counts = new Map<string, number>();
  for (const task of tasks.value) {
    counts.set(task.taskKind ?? 'other', (counts.get(task.taskKind ?? 'other') ?? 0) + 1);
  }
  return [
    { value: 'all' as const, label: '全部', count: tasks.value.length },
    ...(Object.keys(KIND_LABELS) as TaskKind[]).map((kind) => ({
      value: kind,
      label: KIND_LABELS[kind],
      count: counts.get(kind) ?? 0,
    })),
    {
      value: 'paused' as const,
      label: '已暂停',
      count: tasks.value.filter((task) => task.queueStatus === 'paused').length,
    },
  ];
});

const visibleTasks = computed(() => {
  if (activeKind.value === 'paused') {
    return tasks.value.filter((task) => task.queueStatus === 'paused');
  }
  const byKind = activeKind.value === 'all'
    ? tasks.value
    : tasks.value.filter((task) => task.taskKind === activeKind.value);
  if (activeKind.value === 'all') return byKind;
  return byKind.filter((task) => task.queueStatus !== 'paused');
});

/** Ordered by when they run, which is how people actually look for a task. */
const groupedTasks = computed(() => {
  const pending: TaskCenterTask[] = [];
  const done: TaskCenterTask[] = [];
  const blocked: TaskCenterTask[] = [];
  const paused: TaskCenterTask[] = [];
  for (const task of visibleTasks.value) {
    if (task.queueStatus === 'paused') paused.push(task);
    else if (['succeeded', 'cancelled'].includes(task.queueStatus)) done.push(task);
    else if (['failed', 'dead_letter', 'input_required'].includes(task.queueStatus)) blocked.push(task);
    else pending.push(task);
  }
  const byTime = (a: TaskCenterTask, b: TaskCenterTask) =>
    (a.scheduledAt ?? a.createdAt) - (b.scheduledAt ?? b.createdAt);
  return [
    { title: '需要处理', tasks: blocked.sort(byTime) },
    { title: '待执行', tasks: pending.sort(byTime) },
    { title: '已暂停', tasks: paused.sort(byTime) },
    { title: '已完成', tasks: done.sort(byTime).reverse() },
  ].filter((group) => group.tasks.length > 0);
});

const selected = computed(() => tasks.value.find((task) => task.id === selectedId.value) ?? null);
const childTasks = computed(() =>
  selected.value ? tasks.value.filter((task) => task.parentActionId === selected.value!.id) : [],
);
const selectedContent = computed(() => {
  const task = selected.value;
  if (!task) return '';
  const params = (task.params ?? {}) as Record<string, unknown>;
  const text =
    (typeof params.content === 'string' && params.content) ||
    (typeof params.task === 'string' && params.task) ||
    (typeof params.question === 'string' && params.question) ||
    (typeof params.body === 'string' && params.body) ||
    task.description ||
    '';
  return text.trim();
});
const selectedNotifyLabel = computed(() => {
  const params = (selected.value?.params ?? {}) as Record<string, unknown>;
  const metadata = params.metadata && typeof params.metadata === 'object'
    ? (params.metadata as Record<string, unknown>)
    : {};
  const via = String(metadata.notifyVia ?? params.notifyVia ?? params.channel ?? '').trim();
  const target = (metadata.notifyTarget ?? params.notifyTarget) as Record<string, unknown> | undefined;
  if (!via && !target) return '';
  const viaLabel = via === 'bot' ? 'Bot' : via === 'asme' ? 'AsMe' : via === 'plugin' ? '插件通知' : via;
  if (target?.type === 'group' && (target.targetGroupId || target.glipTeamId)) {
    return `${viaLabel} · 群组 ${target.targetGroupId || target.glipTeamId}`;
  }
  if (target?.type === 'private' && (target.glipUserName || target.targetUserId)) {
    return `${viaLabel} · 私发 ${target.glipUserName || target.targetUserId}`;
  }
  return viaLabel;
});

const completedCount = computed(
  () => tasks.value.filter((task) => ['succeeded', 'cancelled'].includes(task.queueStatus)).length,
);

const emptyMessage = computed(() =>
  activeKind.value === 'all'
    ? '账本里还没有任务。'
    : activeKind.value === 'paused'
      ? '没有已暂停的任务。'
      : `没有${KIND_LABELS[activeKind.value as TaskKind]}类型的任务。`,
);

const showsNotifyChannel = computed(
  () => ['push', 'agent', 'remind'].includes(draft.value.taskKind),
);
const showsNotifyTarget = computed(
  () =>
    showsNotifyChannel.value &&
    (draft.value.notifyVia === 'bot' || draft.value.notifyVia === 'asme'),
);
const showsSchedule = computed(
  () => ['push', 'agent', 'remind', 'outreach'].includes(draft.value.taskKind),
);
const scheduleMonthDay = computed(() => dayOfMonth(draft.value.scheduleDate));
const cloudSelectable = computed(
  () =>
    levelsProbeReady.value &&
    cloudLaneAvailable.value &&
    laneSelectableKinds.value.includes(draft.value.taskKind),
);

const cloudLaneHint = computed(() => {
  if (!levelsProbeReady.value) return '检测 Level 2…';
  return cloudLaneAvailable.value ? 'Jira Automation 云端触发 · 24/7' : '未启用 Level 2';
});
const effectiveLane = computed<TaskLane>(() =>
  draft.value.lane === 'jira_sheet' && cloudSelectable.value ? 'jira_sheet' : 'memory_cron',
);
const laneNoteTone = computed(() => {
  if (!laneSelectableKinds.value.includes(draft.value.taskKind)) return 'locked';
  if (effectiveLane.value === 'jira_sheet') return 'cloud';
  return cloudLaneAvailable.value ? 'home' : 'blocked';
});
const laneNote = computed(() => {
  if (!levelsProbeReady.value && laneSelectableKinds.value.includes(draft.value.taskKind)) {
    return '正在探测能力与本地缓存…';
  }
  if (!laneSelectableKinds.value.includes(draft.value.taskKind)) {
    if (draft.value.taskKind === 'outreach') {
      return '🔒 帮我问需要主动询问引擎和 RingCentral 凭据，固定由 memory-service 调度';
    }
    if (draft.value.taskKind === 'remind') {
      return '🔒 个人提醒固定本地调度（零云端配置；点掉即完成）';
    }
    return `🔒 ${KIND_LABELS[draft.value.taskKind]}需要人工节点 / 依赖 / 产物能力，固定由 memory-service 调度`;
  }
  if (effectiveLane.value === 'jira_sheet') {
    return '☁️ 保存后需同步一行 Sheet，由 Jira Automation 每分钟领取；memory-service 离线也会执行。';
  }
  return cloudLaneAvailable.value
    ? '🏠 由 memory-service 调度。切到 ☁️ 会创建 Sheet 镜像行交给 Jira 调度。'
    : '☁️ 需要 Level 2（Google Sheet + Jira Automation），当前不可选；保存后使用 🏠 调度，之后可随时切换。点右上「能力」可去配置。';
});
const syncHint = computed(() =>
  effectiveLane.value === 'jira_sheet'
    ? '保存 → 写入账本 → 扩展同步器写 Sheet 行 → Jira Automation 调度'
    : '保存 → 写入账本 → memory_cron 到期队列',
);

const titlePlaceholder = computed(() => {
  switch (draft.value.taskKind) {
    case 'agent': return '例如：Nova 缺少 Assignee 的 INIT';
    case 'remind': return '提醒我做什么';
    case 'dev': return '一个明确方向的工作单';
    case 'outreach': return '例如：问 Kenny recall API 分页怎么改';
    default: return '例如：每天检查无 Assignee 的新 bug';
  }
});

const canSave = computed(() => {
  if (!draft.value.title.trim()) return false;
  if (draft.value.taskKind === 'agent' && !draft.value.content.trim()) return false;
  if (draft.value.taskKind === 'outreach' && !draft.value.content.trim()) return false;
  if (draft.value.taskKind === 'push' && draft.value.pushMethod === 'ai' && !draft.value.content.trim()) {
    return false;
  }
  if (draft.value.taskKind === 'dev' && !draft.value.acceptance.trim()) return false;
  if (draft.value.taskKind === 'outreach') {
    return !notifyTargetIncomplete({
      notifyVia: 'bot',
      targetType: draft.value.targetType,
      recipients: draft.value.recipients,
      glipTeamId: draft.value.glipTeamId,
    });
  }
  if (showsNotifyTarget.value) {
    return !notifyTargetIncomplete({
      notifyVia: draft.value.notifyVia,
      targetType: draft.value.targetType,
      recipients: draft.value.recipients,
      glipTeamId: draft.value.glipTeamId,
      allowEmptyPrivate: draft.value.taskKind === 'remind',
    });
  }
  return true;
});

function kindLabel(kind?: TaskKind) {
  return kind ? KIND_LABELS[kind] ?? kind : '任务';
}
function laneTitle(task: TaskCenterTask) {
  return task.lane === 'jira_sheet'
    ? '☁️ jira_sheet · Jira Automation 云端触发'
    : '🏠 memory_cron · memory-service 到期队列';
}
function statusTone(status: string) {
  if (status === 'succeeded') return 'ok';
  if (['failed', 'dead_letter'].includes(status)) return 'bad';
  if (status === 'running') return 'run';
  if (status === 'input_required') return 'wait-human';
  if (status === 'paused' || status === 'cancelled') return 'paused';
  return 'wait';
}
function statusLabel(task: TaskCenterTask) {
  if (task.queueStatus === 'input_required') return '等你处理';
  if (task.queueStatus === 'queued' && task.dependsOn?.length) return '等依赖';
  const map: Record<string, string> = {
    queued: '待执行',
    running: '执行中',
    succeeded: '已完成',
    failed: '失败',
    cancelled: '已取消',
    paused: '已暂停',
    dead_letter: '死信',
    awaiting_claim: '待领取',
  };
  return map[task.queueStatus] ?? task.queueStatus;
}
function formatWhen(task: TaskCenterTask) {
  const at = task.scheduledAt ?? task.createdAt;
  if (!at) return '—';
  const date = new Date(at * 1000);
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function recurrenceLabel(task: TaskCenterTask) {
  return recurrenceLabelFromSpec(task.recurrenceSpec as Record<string, unknown> | undefined);
}
function mirrorLabel(task: TaskCenterTask) {
  const ref = task.mirrorRef as Record<string, unknown> | undefined;
  if (!ref) return '—';
  return `${ref.sheetMessageId ?? '未同步'} · ${ref.syncState ?? 'pending'}`;
}

function setKind(kind: TaskKind | 'all' | 'paused') {
  activeKind.value = kind;
}
function select(task: TaskCenterTask) {
  selectedId.value = task.id;
  pendingDelete.value = false;
}

function askDelete(task: TaskCenterTask) {
  select(task);
  pendingDelete.value = true;
}
function canPause(task: TaskCenterTask) {
  return ['queued', 'awaiting_claim', 'failed', 'dead_letter', 'input_required'].includes(
    task.queueStatus,
  );
}
function canRunNow(task: TaskCenterTask) {
  return ['queued', 'paused', 'failed', 'dead_letter'].includes(task.queueStatus);
}
function canRetry(task: TaskCenterTask) {
  return ['failed', 'dead_letter'].includes(task.queueStatus);
}
function canComplete(task: TaskCenterTask) {
  return ['queued', 'paused', 'failed', 'input_required'].includes(task.queueStatus);
}

async function controlTask(
  task: TaskCenterTask,
  action: 'pause' | 'resume' | 'retry' | 'run_now' | 'complete',
) {
  try {
    const labels = {
      pause: '已暂停',
      resume: '已恢复',
      retry: '已重新入队',
      run_now: '已改为立即执行',
      complete: '已标记完成',
    };
    const result = await client.controlTaskCenterTask(task.id, action);
    showToast(`${labels[action]}「${result.task.title}」`);
    await loadAll({ silent: true });
    selectedId.value = result.task.id;
  } catch (error) {
    showToast(`操作失败：${(error as Error).message}`);
  }
}

function duplicateTask(task: TaskCenterTask) {
  draft.value = hydrateTaskDraftFromTask(task, {
    botConfigured: botConfigured.value,
    asmeConfigured: asmeConfigured.value,
  });
  draft.value.title = `${draft.value.title || task.title}（副本）`;
  editingTaskId.value = '';
  recipientError.value = '';
  notifyWhenEmptyChoice.value = notifyWhenEmptyFromTask(task.params);
  pendingDelete.value = false;
  createOpen.value = true;
}

async function confirmDeleteTask(task: TaskCenterTask) {
  saving.value = true;
  try {
    await client.deleteTaskCenterTask(task.id);
    pendingDelete.value = false;
    showToast(`已删除「${task.title}」`);
    if (selectedId.value === task.id) selectedId.value = '';
    await loadAll();
  } catch (error) {
    showToast(`删除失败：${(error as Error).message}`);
  } finally {
    saving.value = false;
  }
}

async function confirmCleanupCompleted() {
  saving.value = true;
  try {
    const result = await client.cleanupCompletedTaskCenterTasks();
    pendingCleanup.value = false;
    showToast(result.deleted > 0 ? `已清理 ${result.deleted} 条已完成任务` : '没有可清理的已完成任务');
    if (selected.value && ['succeeded', 'cancelled'].includes(selected.value.queueStatus)) {
      selectedId.value = '';
    }
    await loadAll();
  } catch (error) {
    showToast(`清理失败：${(error as Error).message}`);
  } finally {
    saving.value = false;
  }
}

function openCreate() {
  editingTaskId.value = '';
  draft.value = createEmptyTaskDraft({
    botConfigured: botConfigured.value,
    asmeConfigured: asmeConfigured.value,
  });
  recipientError.value = '';
  notifyWhenEmptyChoice.value = null;
  createOpen.value = true;
}

function openEdit(task: TaskCenterTask) {
  editingTaskId.value = task.id;
  draft.value = hydrateTaskDraftFromTask(task, {
    botConfigured: botConfigured.value,
    asmeConfigured: asmeConfigured.value,
  });
  recipientError.value = '';
  notifyWhenEmptyChoice.value = notifyWhenEmptyFromTask(task.params);
  createOpen.value = true;
}

function closeEditor() {
  createOpen.value = false;
  editingTaskId.value = '';
}

function selectNotifyVia(via: NotifyVia) {
  if (via === 'bot' && !botConfigured.value) return;
  if (via === 'asme' && !asmeConfigured.value) return;
  draft.value.notifyVia = via;
}

function commitRecipient() {
  const raw = draft.value.recipientInput;
  if (!raw.trim()) return;
  if (draft.value.notifyVia === 'bot' && draft.value.taskKind !== 'outreach' && draft.value.recipients.length >= 1) {
    recipientError.value = 'Bot 模式只能填一个人名';
    return;
  }
  const result = addRecipientTag(draft.value.recipients, raw);
  if (result.error) {
    recipientError.value = result.error;
    return;
  }
  draft.value.recipients = result.tags;
  draft.value.recipientInput = '';
  recipientError.value = '';
}

function removeRecipient(tag: string) {
  draft.value.recipients = draft.value.recipients.filter((item) => item !== tag);
}

function applyQuick(kind: 'one-minute' | 'next-hour' | 'default-morning') {
  const next = applyQuickSchedule(kind);
  draft.value.scheduleDate = next.scheduleDate;
  draft.value.scheduleTime = next.scheduleTime;
  draft.value.remindPreset = '';
}

function applyRemindPreset(label: string) {
  draft.value.remindPreset = label;
  const nowDate = new Date();
  if (label === '1 小时后') {
    const t = new Date(nowDate.getTime() + 3600_000);
    draft.value.scheduleDate = formatLocalDate(t);
    draft.value.scheduleTime = formatLocalTime(t);
    return;
  }
  const at = (hours: number, minutes: number, addDays: number) => {
    const t = new Date(nowDate);
    t.setDate(t.getDate() + addDays);
    t.setHours(hours, minutes, 0, 0);
    return t;
  };
  let next = at(19, 0, 0);
  if (label === '今晚 19:00') {
    if (next.getTime() <= nowDate.getTime()) next = at(19, 0, 1);
  } else if (label === '明早 9:00') {
    next = at(9, 0, 1);
  } else if (label === '下周一 9:00') {
    const day = nowDate.getDay();
    next = at(9, 0, ((1 - day + 7) % 7) || 7);
  }
  draft.value.scheduleDate = formatLocalDate(next);
  draft.value.scheduleTime = formatLocalTime(next);
}

function onRepeatingToggle() {
  if (draft.value.repeating) {
    draft.value.repeatEvery = draft.value.repeatEvery || 1;
    draft.value.repeatUnit = draft.value.repeatUnit || 'Week';
  }
}

function setRepeatUnit(unit: RepeatUnit) {
  draft.value.repeatUnit = unit;
}

function toggleWeekDay(day: number) {
  const current = draft.value.weekDays;
  const next = current.includes(day)
    ? current.filter((item) => item !== day)
    : [...current, day].sort((a, b) => a - b);
  draft.value.weekDays = next;
  draft.value.scheduleDate = snapScheduleDateToWeekDays(draft.value.scheduleDate, next);
}

function setMonthDay(day: number) {
  draft.value.scheduleDate = setDateDay(draft.value.scheduleDate, day);
}
function showToast(message: string) {
  toast.value = message;
  window.setTimeout(() => { toast.value = ''; }, 3500);
}

function buildRecurrence(): Record<string, unknown> | undefined {
  return buildRecurrenceSpec({
    repeating: draft.value.repeating,
    repeatEvery: Number(draft.value.repeatEvery) || 1,
    repeatUnit: draft.value.repeatUnit,
    scheduleDate: draft.value.scheduleDate,
    scheduleTime: draft.value.scheduleTime,
    weekDays: draft.value.weekDays,
    endDate: draft.value.endDate,
    repeatCount: draft.value.repeatCount,
  });
}

function resolveScheduledAt(): number {
  return Math.floor(
    resolveScheduledAtMs({
      scheduleDate: draft.value.scheduleDate,
      scheduleTime: draft.value.scheduleTime,
    }) / 1000,
  );
}

function notifyPayload() {
  return buildNotifyPayload({
    notifyVia: draft.value.notifyVia,
    targetType: draft.value.targetType,
    recipients: draft.value.recipients,
    glipTeamId: draft.value.glipTeamId,
  });
}

function outreachTargetPayload() {
  if (draft.value.taskKind !== 'outreach') return {};
  if (draft.value.targetType === 'group') {
    return {
      targetType: 'group',
      targetRef: draft.value.glipTeamId.trim(),
    };
  }
  const stored = draft.value.recipients.map((name) => name.trim()).filter(Boolean);
  return {
    targetType: 'private',
    targetRef: stored[0] ? stored[0].toLowerCase().replace(/\s+/g, '.') : '',
  };
}

function editorWriteBody() {
  const notify = notifyPayload();
  return {
    taskKind: draft.value.taskKind,
    title: draft.value.title.trim(),
    description: draft.value.content.trim() || undefined,
    lane: effectiveLane.value,
    cloudLaneAvailable: cloudLaneAvailable.value,
    requiresApproval: draft.value.taskKind === 'dev' || draft.value.mode === 'write',
    scheduledAt: resolveScheduledAt(),
    recurrenceSpec: buildRecurrence() ?? null,
    payload: {
      content: draft.value.content.trim() || undefined,
      acceptance: draft.value.acceptance.trim() || undefined,
      mode: draft.value.taskKind === 'agent' ? draft.value.mode : undefined,
      remindPreset: draft.value.taskKind === 'remind' ? draft.value.remindPreset : undefined,
      pushMethod: draft.value.taskKind === 'push' ? draft.value.pushMethod : undefined,
      task: draft.value.taskKind === 'agent' || draft.value.taskKind === 'outreach'
        ? draft.value.content.trim()
        : undefined,
      question: draft.value.taskKind === 'outreach' ? draft.value.content.trim() : undefined,
      ...outreachTargetPayload(),
      extraText: draft.value.extraText.trim() || undefined,
      teamId: draft.value.glipTeamId.trim() || undefined,
      maxFollowup: draft.value.taskKind === 'outreach' ? draft.value.outreachMaxFollowup : undefined,
      followupIntervalHours:
        draft.value.taskKind === 'outreach' ? draft.value.outreachFollowupHours : undefined,
      successReceipt: draft.value.successReceipt,
      notifyWhenEmpty:
        draft.value.taskKind === 'agent' && notifyWhenEmptyChoice.value !== null
          ? notifyWhenEmpty.value
          : undefined,
      ...notify,
    },
  };
}

async function saveTask() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const body = editorWriteBody();
    const response = editingTaskId.value
      ? await client.updateTaskCenterTask(editingTaskId.value, body)
      : await client.createTaskCenterTask(body);
    const saved = response.task;
    closeEditor();
    const lane = response.lane;
    showToast(
      lane && !lane.honoredRequest
        ? `已保存，但调度器回落为 🏠：${lane.reason}`
        : `已保存「${saved?.title ?? body.title}」· ${response.mirrorRequired ? '待同步 Sheet ☁️' : '已入 memory_cron 队列 🏠'}`,
    );
    await loadAll();
    if (saved?.id) selectedId.value = saved.id;
  } catch (error) {
    showToast(`保存失败：${(error as Error).message}`);
  } finally {
    saving.value = false;
  }
}

async function sweep() {
  try {
    const result = await client.sweepTaskCenter();
    showToast(`已滚动 ${result.rolledOver} 个重复任务，完成 ${result.parentsCompleted} 个父任务`);
    await loadAll();
  } catch (error) {
    showToast(`滚动失败：${(error as Error).message}`);
  }
}

async function detectLevels() {
  try {
    const [stored, runtimeRaw] = await Promise.all([
      chrome.storage.local.get(['scheduledMessagesConfig']),
      client.getRuntimeConfig().catch(() => null),
    ]);
    const runtime = await adoptRingCentralFromSheetIfNeeded(
      runtimeRaw,
      stored?.scheduledMessagesConfig,
    );
    const probed = probeTaskCenterLevels({
      scheduledMessagesConfig: stored?.scheduledMessagesConfig,
      runtime,
    });
    cloudLaneAvailable.value = probed.cloudLaneAvailable;
    cloudBotConfigured.value = probed.cloudBotConfigured;
    cloudTimelineConfigured.value = probed.cloudTimelineConfigured;
    cloudAsmeConfigured.value = probed.cloudAsmeConfigured;
    probedSheetId.value = probed.sheetId;
    botConfigured.value = probed.botConfigured;
    asmeConfigured.value = probed.asmeConfigured;
  } catch {
    cloudLaneAvailable.value = false;
    cloudBotConfigured.value = false;
    cloudTimelineConfigured.value = false;
    cloudAsmeConfigured.value = false;
    probedSheetId.value = '';
    botConfigured.value = false;
    asmeConfigured.value = false;
  } finally {
    levelsProbeReady.value = true;
  }
}

async function loadAll(options: { silent?: boolean } = {}) {
  if (!options.silent) loading.value = true;
  try {
    const [list, capabilities] = await Promise.all([
      client.getTaskCenterTasks({ limit: 200 }),
      client.getTaskCenterCapabilities().catch(() => null),
    ]);
    tasks.value = list.items;
    if (capabilities?.laneSelectableKinds?.length) {
      laneSelectableKinds.value = capabilities.laneSelectableKinds;
    }
    loadError.value = '';
    if (!selectedId.value && list.items.length > 0) {
      selectedId.value = list.items[0].id;
    }
  } catch (error) {
    loadError.value = (error as Error).message;
  } finally {
    loading.value = false;
  }
}

let pollId: number | null = null;
onMounted(async () => {
  await detectLevels();
  await loadAll();
  pollId = window.setInterval(() => {
    // Only poll while something is actually moving.
    if (tasks.value.some((task) => ['running', 'queued'].includes(task.queueStatus))) {
      void loadAll({ silent: true });
    }
  }, 15000);
});
onUnmounted(() => {
  if (pollId !== null) window.clearInterval(pollId);
});
</script>

<style scoped>
.task-center-page {
  --tc-panel: rgba(15, 23, 42, 0.62);
  --tc-line: rgba(148, 163, 184, 0.18);
  --tc-ink: #eef6ff;
  --tc-muted: #8fa3bb;
  --tc-dim: #64748b;
  --tc-accent: #60a5fa;
  --tc-green: #34d399;
  --tc-amber: #fbbf24;
  --tc-red: #fb7185;
  --tc-purple: #a78bfa;
  --tc-cyan: #22d3ee;
  color: var(--tc-ink);
  padding: 0.5rem 0.25rem 2rem;
}

.page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
.page-header h2 { font-size: 1.25rem; margin: 0; }
.page-header p { color: var(--tc-muted); font-size: 0.82rem; margin: 0.35rem 0 0; max-width: 640px; }
.header-actions { display: flex; gap: 0.5rem; }

.tc-btn { border: 1px solid var(--tc-line); background: var(--tc-panel); color: var(--tc-ink); border-radius: 999px; padding: 0.38rem 0.95rem; font-size: 0.78rem; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.tc-btn:hover { border-color: var(--tc-accent); }
.tc-btn.primary { background: rgba(59, 130, 246, 0.18); border-color: rgba(59, 130, 246, 0.45); color: var(--tc-accent); font-weight: 600; }
.tc-btn.danger { color: var(--tc-red); border-color: rgba(244, 63, 94, 0.35); }
.tc-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.level-bar { display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 0.8rem; padding: 0.3rem 0.7rem 0.3rem 0.6rem; border: 1px solid var(--tc-line); border-radius: 999px; background: rgba(255, 255, 255, 0.02); cursor: pointer; font-family: inherit; color: inherit; }
.level-bar:hover { border-color: var(--tc-accent); }
.level-bar.incomplete { border-color: rgba(251, 191, 36, 0.3); }
.level-bar.probing { border-color: rgba(148, 163, 184, 0.28); }
.level-bar-label { font-size: 0.68rem; color: var(--tc-dim); }
.level-pill { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.7rem; color: var(--tc-dim); }
.level-pill.on { color: var(--tc-green); }
.level-pill.probing { color: var(--tc-muted); }
.level-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--tc-dim); flex-shrink: 0; }
.level-pill.on .level-dot { background: var(--tc-green); }
.level-pill.probing .level-dot { background: rgba(148, 163, 184, 0.55); animation: tc-pulse 1.2s ease-in-out infinite; }
.level-bar-cta { font-size: 0.68rem; color: var(--tc-accent); margin-left: 0.15rem; }
.level-bar.probing .level-bar-cta { color: var(--tc-muted); }

.setup-intro { font-size: 0.76rem; color: var(--tc-muted); margin-bottom: 0.9rem; }
.setup-step { border: 1px solid var(--tc-line); border-radius: 0.55rem; padding: 0.7rem 0.85rem; margin-bottom: 0.6rem; background: rgba(255, 255, 255, 0.02); }
.setup-step.done { border-color: rgba(52, 211, 153, 0.35); }
.setup-step-top { display: flex; align-items: center; gap: 0.5rem; }
.setup-step-top strong { font-size: 0.84rem; flex: 1; }
.setup-num { width: 20px; height: 20px; border-radius: 50%; background: rgba(148, 163, 184, 0.15); color: var(--tc-muted); font-size: 0.68rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.setup-step.done .setup-num { background: rgba(34, 197, 94, 0.16); color: var(--tc-green); }
.setup-state { font-size: 0.68rem; color: var(--tc-muted); }
.setup-step-body { margin-left: 1.7rem; margin-top: 0.35rem; }
.setup-step-body p { font-size: 0.74rem; color: var(--tc-muted); margin: 0 0 0.3rem; }
.setup-unlocks { font-size: 0.72rem !important; color: var(--tc-dim) !important; }
.setup-unlocks span { color: var(--tc-green); margin-right: 0.35rem; }
.setup-actions { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; margin-top: 0.45rem; }
.setup-actions small { font-size: 0.68rem; color: var(--tc-dim); }
.setup-channels { display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.45rem; }
.setup-channel { display: flex; align-items: center; gap: 0.5rem; font-size: 0.74rem; color: var(--tc-muted); }
.setup-channel.on { color: var(--tc-green); }
.setup-channel.probing { color: var(--tc-muted); }
.setup-channel strong { font-size: 0.74rem; }
.setup-state.probing { color: var(--tc-muted); }
.setup-step.probing { border-color: rgba(148, 163, 184, 0.22); }
@keyframes tc-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}
.setup-channel-note { font-size: 0.68rem !important; color: var(--tc-amber) !important; margin: 0.15rem 0 0 !important; }
.l1-config-panel {
  margin-top: 0.55rem;
  padding: 0.65rem 0.7rem;
  border: 1px solid var(--tc-line);
  border-radius: 0.55rem;
  background: rgba(2, 6, 23, 0.35);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.l1-config-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.l1-field { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.72rem; color: var(--tc-muted); }
.l1-field input {
  border: 1px solid var(--tc-line);
  border-radius: 0.4rem;
  padding: 0.35rem 0.45rem;
  background: rgba(15, 23, 42, 0.75);
  color: var(--tc-ink);
  font-size: 0.74rem;
}
.l1-config-actions { display: flex; justify-content: flex-end; margin-top: 0.15rem; }
.tc-btn.sm { padding: 0.2rem 0.65rem; font-size: 0.68rem; }
.ck { display: flex; align-items: center; gap: 0.45rem; font-size: 0.76rem; color: #cbd5e1; cursor: pointer; font-weight: 400 !important; }
.tc-inline { display: flex; gap: 0.6rem; }
.tc-inline .tc-field { flex: 1; min-width: 0; }
.tc-inline select, .tc-inline input { flex: 1; }
.tc-quick { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.4rem; }
.tc-repeat {
  border: 1px solid var(--tc-line);
  border-radius: 0.55rem;
  padding: 0.7rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-bottom: 0.7rem;
}
.tc-opts.compact { gap: 0.3rem; }
.tc-opts.compact .tc-opt { min-height: 2rem; padding: 0.3rem 0.5rem; }
.tc-day-chips { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.tc-day-chips.wrap { max-width: 100%; }
.tc-day {
  min-width: 1.85rem;
  padding: 0.2rem 0.35rem;
  border: 1px solid var(--tc-line);
  border-radius: 0.35rem;
  background: transparent;
  color: var(--tc-muted);
  cursor: pointer;
  font-size: 0.7rem;
}
.tc-day.on { background: rgba(59, 130, 246, 0.2); color: var(--tc-ink); border-color: var(--tc-accent); }
.tc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  border: 1px solid var(--tc-line);
  border-radius: 0.4rem;
  padding: 0.3rem 0.4rem;
  background: rgba(15, 23, 42, 0.55);
}
.tc-tags input {
  flex: 1;
  min-width: 10rem;
  border: 0 !important;
  background: transparent !important;
  padding: 0.15rem 0 !important;
}
.tc-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(59, 130, 246, 0.18);
  color: var(--tc-ink);
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
  font-size: 0.72rem;
}
.tc-tag button { border: 0; background: transparent; color: inherit; cursor: pointer; }
.tc-field-error { color: var(--tc-red); font-size: 0.68rem; }
.tc-hint-inline { margin-left: 0.4rem; color: var(--tc-red); font-weight: 400; font-size: 0.68rem; }
.setup-note { font-size: 0.7rem; color: var(--tc-amber); background: rgba(245, 158, 11, 0.08); border-radius: 6px; padding: 0.5rem 0.65rem; margin-top: 0.6rem; }

.chips { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
.chip { border: 1px solid var(--tc-line); background: transparent; color: var(--tc-muted); border-radius: 999px; padding: 0.25rem 0.8rem; font-size: 0.74rem; cursor: pointer; }
.chip.on { background: rgba(255, 255, 255, 0.08); color: var(--tc-ink); border-color: rgba(148, 163, 184, 0.4); }
.chip-count { margin-left: 0.35rem; font-size: 0.66rem; opacity: 0.75; }

.tc-loading, .tc-empty, .tc-error { padding: 2rem; text-align: center; color: var(--tc-muted); font-size: 0.85rem; }
.tc-error { color: var(--tc-red); display: flex; flex-direction: column; gap: 0.35rem; }
.tc-empty p { margin-bottom: 0.75rem; }

.tc-layout { display: grid; grid-template-columns: minmax(320px, 420px) minmax(0, 1fr); gap: 1.05rem; align-items: start; }
@media (max-width: 900px) { .tc-layout { grid-template-columns: 1fr; } }

.tc-list { background: var(--tc-panel); border: 1px solid var(--tc-line); border-radius: 0.7rem; padding: 0.6rem 0.7rem; }
.tc-group-head { font-size: 0.72rem; font-weight: 700; color: var(--tc-muted); padding: 0.35rem 0; border-bottom: 1px solid var(--tc-line); margin-bottom: 0.25rem; }
.tc-group-count { font-size: 0.64rem; color: var(--tc-dim); font-weight: 400; margin-left: 0.4rem; }
.tc-group + .tc-group { margin-top: 0.8rem; }
.tc-row { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.35rem 0.4rem; border: 0; background: transparent; border-radius: 6px; cursor: pointer; text-align: left; color: inherit; font-size: 0.78rem; font-family: inherit; }
.tc-row:hover { background: rgba(59, 130, 246, 0.08); }
.tc-row.on { background: rgba(59, 130, 246, 0.16); }
.tc-row-actions { display: flex; gap: 0.12rem; flex-shrink: 0; opacity: 0; }
.tc-row:hover .tc-row-actions, .tc-row.on .tc-row-actions { opacity: 1; }
.tc-icon-btn {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 0.78rem;
  line-height: 1;
  padding: 0.15rem 0.22rem;
  border-radius: 4px;
  color: inherit;
}
.tc-icon-btn:hover { background: rgba(255, 255, 255, 0.08); }
.tc-icon-btn.danger:hover { background: rgba(244, 63, 94, 0.18); }
.tc-confirm-page { margin: 0 0 0.8rem; }
.tc-time { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.68rem; color: var(--tc-dim); flex-shrink: 0; }
.tc-lane { flex-shrink: 0; }
.tc-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #cbd5e1; }

.tc-kind { font-size: 0.62rem; padding: 0.08rem 0.45rem; border-radius: 999px; white-space: nowrap; flex-shrink: 0; background: rgba(255, 255, 255, 0.08); color: var(--tc-muted); }
.tc-kind.push { background: rgba(34, 211, 238, 0.14); color: var(--tc-cyan); }
.tc-kind.agent { background: rgba(147, 51, 234, 0.2); color: var(--tc-purple); }
.tc-kind.remind { background: rgba(34, 197, 94, 0.16); color: var(--tc-green); }
.tc-kind.dev { background: rgba(34, 211, 238, 0.12); color: var(--tc-cyan); }
.tc-kind.outreach { background: rgba(251, 191, 36, 0.16); color: var(--tc-amber); }

.tc-status { font-size: 0.62rem; padding: 0.08rem 0.5rem; border-radius: 999px; font-weight: 600; flex-shrink: 0; }
.tc-status.ok { background: rgba(34, 197, 94, 0.16); color: var(--tc-green); }
.tc-status.bad { background: rgba(244, 63, 94, 0.16); color: var(--tc-red); }
.tc-status.run { background: rgba(59, 130, 246, 0.18); color: var(--tc-accent); }
.tc-status.wait { background: rgba(148, 163, 184, 0.15); color: var(--tc-muted); }
.tc-status.wait-human { background: rgba(245, 158, 11, 0.16); color: var(--tc-amber); }

.tc-detail { background: var(--tc-panel); border: 1px solid var(--tc-line); border-radius: 0.7rem; padding: 0.95rem 1.1rem; }
.tc-detail-head { display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap; margin-bottom: 0.8rem; }
.tc-detail-head h3 { font-size: 0.98rem; margin: 0; flex: 1; min-width: 200px; }
.tc-facts { display: grid; gap: 0.45rem; margin: 0 0 0.8rem; }
.tc-facts > div { display: flex; gap: 0.6rem; font-size: 0.76rem; }
.tc-facts dt { color: var(--tc-dim); min-width: 72px; flex-shrink: 0; }
.tc-facts dd { margin: 0; color: #cbd5e1; }
.tc-error-box { border-left: 3px solid var(--tc-red); background: rgba(244, 63, 94, 0.07); padding: 0.5rem 0.65rem; border-radius: 0 6px 6px 0; font-size: 0.74rem; display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.8rem; }
.tc-error-box strong { color: var(--tc-red); }
.tc-children { border: 1px dashed var(--tc-line); border-radius: 0.5rem; padding: 0.6rem 0.7rem; margin-bottom: 0.8rem; }
.tc-children-head { font-size: 0.74rem; font-weight: 600; margin-bottom: 0.4rem; }
.tc-child { display: flex; gap: 0.5rem; align-items: center; font-size: 0.75rem; padding: 0.2rem 0; color: #cbd5e1; }
.tc-children small { display: block; margin-top: 0.4rem; font-size: 0.68rem; color: var(--tc-dim); }
.tc-detail-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.tc-confirm {
  margin-top: 0.7rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid rgba(244, 63, 94, 0.35);
  border-radius: 0.5rem;
  background: rgba(244, 63, 94, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.74rem;
}
.tc-confirm span { color: var(--tc-muted); }
.tc-pre { white-space: pre-wrap; word-break: break-word; }
.tc-status.paused { background: rgba(148, 163, 184, 0.15); color: var(--tc-muted); }

.tc-backdrop { position: fixed; inset: 0; background: rgba(2, 6, 23, 0.55); backdrop-filter: blur(6px); display: grid; place-items: center; z-index: 100; padding: 1rem; }
.tc-dialog { width: min(620px, 100%); max-height: 88vh; display: flex; flex-direction: column; background: #111a2e; border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 0.75rem; }
.tc-dialog-head { display: flex; align-items: center; padding: 0.85rem 1.1rem; border-bottom: 1px solid var(--tc-line); }
.tc-dialog-head strong { flex: 1; font-size: 0.95rem; }
.tc-x { cursor: pointer; color: var(--tc-dim); }
.tc-dialog-body { padding: 1rem 1.1rem; overflow-y: auto; }
.tc-dialog-foot { display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 1.1rem; border-top: 1px solid var(--tc-line); }
.tc-sync-hint { flex: 1; font-size: 0.68rem; color: var(--tc-dim); }

.tc-field { margin-bottom: 0.85rem; }
.tc-field label { display: block; font-size: 0.74rem; font-weight: 600; color: #cbd5e1; margin-bottom: 0.3rem; }
.tc-field .req { color: var(--tc-red); }
.tc-field input[type='text'], .tc-field textarea, .tc-field select {
  width: 100%; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--tc-line);
  border-radius: 8px; color: var(--tc-ink); font-size: 0.78rem; padding: 0.5rem 0.65rem;
  font-family: inherit; outline: none;
}
.tc-field textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.72rem; resize: vertical; }
.tc-field input:focus, .tc-field textarea:focus, .tc-field select:focus { border-color: rgba(59, 130, 246, 0.5); }
.tc-hint { display: block; margin-top: 0.28rem; font-size: 0.68rem; color: var(--tc-dim); line-height: 1.45; }
.tc-opts { display: flex; gap: 0.45rem; flex-wrap: wrap; }
.tc-opt { border: 1px solid var(--tc-line); background: rgba(255, 255, 255, 0.03); color: var(--tc-muted); border-radius: 8px; padding: 0.45rem 0.8rem; font-size: 0.74rem; cursor: pointer; text-align: left; font-family: inherit; }
.tc-opt.on { background: rgba(59, 130, 246, 0.18); border-color: rgba(59, 130, 246, 0.5); color: var(--tc-accent); font-weight: 600; }
.tc-opt.off, .tc-opt:disabled { opacity: 0.38; cursor: not-allowed; }
.tc-opt small { display: block; font-size: 0.62rem; font-weight: 400; color: var(--tc-dim); margin-top: 0.1rem; }
.tc-lane-note { margin-top: 0.4rem; font-size: 0.68rem; padding: 0.4rem 0.6rem; border-radius: 6px; }
.tc-lane-note.home { background: rgba(34, 197, 94, 0.14); color: var(--tc-green); }
.tc-lane-note.cloud { background: rgba(245, 158, 11, 0.14); color: var(--tc-amber); }
.tc-lane-note.locked { background: rgba(148, 163, 184, 0.1); color: var(--tc-muted); }
.tc-lane-note.blocked { background: rgba(244, 63, 94, 0.14); color: var(--tc-red); }

.tc-toast { position: fixed; bottom: 1.2rem; left: 50%; transform: translateX(-50%); background: #0e2a1c; border: 1px solid rgba(52, 211, 153, 0.45); color: var(--tc-green); font-size: 0.76rem; padding: 0.55rem 1.1rem; border-radius: 999px; z-index: 120; max-width: 90vw; }
</style>
