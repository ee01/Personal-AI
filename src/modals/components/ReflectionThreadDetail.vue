<template>
  <div class="reflection-detail-page">
    <div class="page-head">
      <button class="back-btn" @click="router.push('/reflection-threads')">← 返回线程列表</button>
      <div class="action-bar">
        <button class="primary-btn" :disabled="busy" @click="revisitThread">立即自我反思</button>
        <button v-if="detail?.thread.status === 'active'" class="ghost-btn" :disabled="busy" @click="pauseThread">暂停</button>
        <button v-if="detail?.thread.status !== 'active'" class="ghost-btn" :disabled="busy" @click="resumeThread">恢复</button>
        <button class="danger-btn" :disabled="busy" @click="closeThread">关闭</button>
      </div>
    </div>

    <div v-if="detailLoadError" class="load-error">
      <div>
        <div class="load-error-title">自我反思详情暂时不可用</div>
        <p>{{ detailLoadError }}</p>
      </div>
      <button class="load-error-retry" @click="loadDetail">重试</button>
    </div>

    <div v-if="operationError" class="operation-error">
      <span>{{ operationError }}</span>
      <button class="tiny-btn" @click="operationError = ''">关闭</button>
    </div>

    <div
      v-if="operationReceipt"
      class="operation-receipt"
      :class="operationReceipt.tone"
    >
      <div>
        <div class="operation-receipt-title">{{ operationReceipt.title }}</div>
        <p>{{ operationReceipt.summary }}</p>
        <div class="operation-receipt-grid">
          <div>
            <span>写入结果</span>
            <strong>{{ operationReceipt.writeResult }}</strong>
          </div>
          <div>
            <span>边界</span>
            <strong>{{ operationReceipt.boundary }}</strong>
          </div>
          <div>
            <span>恢复路径</span>
            <strong>{{ operationReceipt.recovery }}</strong>
          </div>
        </div>
      </div>
      <button class="tiny-btn" @click="operationReceipt = null">关闭</button>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载自我反思详情中...</p>
    </div>

    <div v-else-if="!detail" class="empty-state">
      <p>{{ detailLoadError ? '无法加载这条自我反思线程。' : '未找到自我反思线程。' }}</p>
    </div>

    <div v-else class="detail-layout">
      <section
        v-if="detailOperationReceipt"
        class="operation-scope-box"
        :class="detailOperationReceipt.tone"
      >
        <div class="operation-scope-main">
          <div class="box-title">本次操作范围</div>
          <h3>{{ detailOperationReceipt.title }}</h3>
          <p>{{ detailOperationReceipt.summary }}</p>
        </div>
        <div class="operation-scope-grid">
          <div>
            <span>手动反思</span>
            <strong>{{ detailOperationReceipt.runScope }}</strong>
          </div>
          <div>
            <span>状态按钮</span>
            <strong>{{ detailOperationReceipt.stateScope }}</strong>
          </div>
          <div>
            <span>不会发生</span>
            <strong>{{ detailOperationReceipt.boundary }}</strong>
          </div>
          <div>
            <span>恢复路径</span>
            <strong>{{ detailOperationReceipt.recovery }}</strong>
          </div>
        </div>
        <div class="operation-scope-chips">
          <span
            v-for="chip in detailOperationReceipt.chips"
            :key="chip"
            class="operation-scope-chip"
          >
            {{ chip }}
          </span>
        </div>
      </section>

      <section class="hero-card">
        <div class="hero-top">
          <div>
            <h2>{{ displayThreadTitle(detail.thread.title) }}</h2>
            <p>{{ detail.thread.latestSummary || '暂无总结。' }}</p>
          </div>
          <div class="hero-metrics">
            <span class="metric-pill">状态 {{ statusLabel(detail.thread.status) }}</span>
            <span class="metric-pill">优先级 P{{ detail.thread.priority }}</span>
            <span class="metric-pill">显著性 {{ detail.thread.salience.toFixed(2) }}</span>
          </div>
        </div>

        <div class="hero-meta">
          <span>Topic: {{ detail.thread.topicKey }}</span>
          <span>运行 {{ detail.thread.reflectionCount }}</span>
          <span v-if="detail.thread.lastReflectedAt">最近 {{ relativeTime(detail.thread.lastReflectedAt) }}</span>
          <span v-if="detail.thread.nextReflectionAt">下次 {{ relativeTime(detail.thread.nextReflectionAt) }}</span>
        </div>

        <div v-if="detail.thread.currentHypothesis" class="hypothesis-box">
          <div class="box-title">当前假设</div>
          <p>{{ detail.thread.currentHypothesis }}</p>
        </div>

        <div v-if="detail.thread.continueReason || detail.thread.closureReason" class="reason-box">
          <div class="box-title">{{ detail.thread.status === 'closed' ? '关闭原因' : '继续原因' }}</div>
          <p>{{ detail.thread.closureReason || waitingReasonLabel(detail.thread.continueReason) }}</p>
        </div>

        <div v-if="detailHandoffReceipt" class="handoff-box" :class="detailHandoffReceipt.tone">
          <div class="box-title">反思推进回执</div>
          <div class="handoff-title">{{ detailHandoffReceipt.title }}</div>
          <p>{{ detailHandoffReceipt.summary }}</p>
          <div class="handoff-grid">
            <div>
              <span>下一步</span>
              <strong>{{ detailHandoffReceipt.nextStep }}</strong>
            </div>
            <div>
              <span>边界</span>
              <strong>{{ detailHandoffReceipt.boundary }}</strong>
            </div>
            <div>
              <span>恢复</span>
              <strong>{{ detailHandoffReceipt.recovery }}</strong>
            </div>
          </div>
          <div class="handoff-chips">
            <span
              v-for="chip in detailHandoffReceipt.chips"
              :key="chip"
              class="handoff-chip"
            >
              {{ chip }}
            </span>
          </div>
        </div>
      </section>

      <section class="detail-grid">
        <div class="panel">
          <div class="panel-title">开放问题</div>
          <ul v-if="detail.thread.openQuestions.length > 0" class="bullet-list">
            <li v-for="question in detail.thread.openQuestions" :key="question">{{ question }}</li>
          </ul>
          <div v-else class="muted">暂无开放问题</div>
        </div>

        <div class="panel">
          <div class="panel-title">梦境回放</div>
          <ul v-if="detail.dreamRuns.length > 0" class="bullet-list">
            <li v-for="dream in detail.dreamRuns" :key="dream.id">
              <div class="inline-head">{{ relativeTime(dream.createdAt) }}</div>
              <div>{{ dream.summary || 'Dream replay generated.' }}</div>
            </li>
          </ul>
          <div v-else class="muted">暂无关联梦境回放</div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">动作队列</div>
        <div v-if="detail.actions.length === 0" class="muted">暂无动作</div>
        <div v-else class="action-list">
          <div v-for="action in detail.actions" :key="action.id" class="action-card">
            <div class="inline-head">
              <span>{{ action.title }}</span>
              <span class="queue-badge" :class="action.queueStatus">{{ action.queueStatus }}</span>
            </div>
            <p class="action-desc">{{ action.description || displayActionType(action.actionType) }}</p>
            <div class="action-meta">
              <span>{{ displayActionType(action.actionType) }}</span>
              <span>{{ action.executionMode }}</span>
              <span>P{{ action.priority }}</span>
            </div>
            <div class="action-buttons">
              <button
                v-if="action.queueStatus === 'queued' || action.queueStatus === 'failed'"
                class="tiny-btn"
                @click="executeAction(action.id)"
              >执行</button>
              <button
                v-if="action.queueStatus === 'failed'"
                class="tiny-btn"
                @click="retryAction(action.id)"
              >重试</button>
              <button
                v-if="action.queueStatus === 'queued'"
                class="tiny-btn danger"
                @click="cancelAction(action.id)"
              >取消</button>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">关联主动询问</div>
        <div v-if="outreachLoadError" class="sub-error">
          <div>
            关联主动询问加载失败：{{ outreachLoadError }}
            <span v-if="threadOutreachSessions.length > 0">下方保留上次成功读取的会话。</span>
          </div>
          <button class="tiny-btn" @click="loadOutreachSessions()">重试</button>
        </div>
        <div v-if="threadOutreachLoading" class="muted">加载会话中...</div>
        <div v-else-if="threadOutreachSessions.length === 0 && !outreachLoadError" class="muted">暂无关联主动询问会话</div>
        <div v-else class="run-list">
          <div
            v-for="session in threadOutreachSessions"
            :key="session.id"
            class="run-card"
          >
            <div class="inline-head">
              <span>{{ outreachStatusLabel(session.status) }}</span>
              <span class="muted small">{{ relativeTime(session.createdAt) }}</span>
            </div>
            <p class="run-summary">{{ session.renderedQuestion || '(空问题)' }}</p>
            <div class="action-meta">
              <span>{{ outreachOriginLabel(session.originKind) }}</span>
              <span>{{ outreachTargetTypeLabel(session.targetType) }} / {{ session.targetRef }}</span>
              <span>追问 {{ session.followupCount }}/{{ session.maxFollowup }}</span>
              <router-link :to="`/outreach/${session.id}`" class="thread-link">查看会话</router-link>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">外部委派结果</div>
        <div v-if="(detail.actionResults?.length ?? 0) === 0" class="muted">暂无外部委派结果</div>
        <div v-else class="run-list">
          <div
            v-for="result in detail.actionResults ?? []"
            :key="result.id"
            class="run-card"
          >
            <div class="inline-head">
              <span>{{ result.resultType }}</span>
              <span class="muted small">{{ relativeTime(result.createdAt) }}</span>
            </div>
            <p class="run-summary">{{ result.summary }}</p>

            <div v-if="result.payload && Object.keys(result.payload).length > 0" class="sub-block">
              <div class="sub-title">关键结果</div>
              <pre class="json-block">{{ formatJson(result.payload) }}</pre>
            </div>

            <div v-if="result.transcriptPath" class="sub-block">
              <div class="inline-head">
                <div class="sub-title">Transcript</div>
                <button
                  class="tiny-btn"
                  @click="toggleTranscript(result.id, result.transcriptPath)"
                >{{ transcriptVisible[result.id] ? '收起' : '展开' }}</button>
              </div>
              <div class="muted small">{{ result.transcriptPath }}</div>
              <div v-if="transcriptVisible[result.id]" class="transcript-block">
                <div v-if="transcriptLoading[result.id]" class="muted">正在加载 transcript...</div>
                <pre v-else class="json-block">{{ transcriptContent[result.id] || '未能读取 transcript 内容。' }}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">研究补查过程</div>
        <div v-if="researchPendingReceipt" class="research-pending-receipt">
          <div class="research-pending-main">
            <div class="box-title">研究请求回执</div>
            <h3>{{ researchPendingReceipt.title }}</h3>
            <p>{{ researchPendingReceipt.summary }}</p>
          </div>
          <div class="research-pending-grid">
            <div>
              <span>当前读取</span>
              <strong>{{ researchPendingReceipt.pendingLine }}</strong>
            </div>
            <div>
              <span>下方快照</span>
              <strong>{{ researchPendingReceipt.oldSnapshotLine }}</strong>
            </div>
            <div>
              <span>边界</span>
              <strong>{{ researchPendingReceipt.boundary }}</strong>
            </div>
            <div>
              <span>恢复路径</span>
              <strong>{{ researchPendingReceipt.recovery }}</strong>
            </div>
          </div>
          <div class="research-pending-chips">
            <span
              v-for="chip in researchPendingReceipt.chips"
              :key="chip"
              class="research-pending-chip"
            >
              {{ chip }}
            </span>
          </div>
        </div>
        <div v-if="researchScopeReceipt" class="research-run-scope" :class="researchScopeReceipt.tone">
          <div class="research-run-scope-main">
            <div class="box-title">本轮研究范围</div>
            <h3>{{ researchScopeReceipt.title }}</h3>
            <p>{{ researchScopeReceipt.summary }}</p>
          </div>
          <div class="research-run-scope-grid">
            <div>
              <span>查询结果</span>
              <strong>{{ researchScopeReceipt.evidenceLine }}</strong>
            </div>
            <div>
              <span>读取来源</span>
              <strong>{{ researchScopeReceipt.sourceLine }}</strong>
            </div>
            <div>
              <span>边界</span>
              <strong>{{ researchScopeReceipt.boundary }}</strong>
            </div>
            <div>
              <span>恢复路径</span>
              <strong>{{ researchScopeReceipt.recovery }}</strong>
            </div>
          </div>
          <div class="research-run-scope-chips">
            <span
              v-for="chip in researchScopeReceipt.chips"
              :key="chip"
              class="research-run-scope-chip"
            >
              {{ chip }}
            </span>
          </div>
        </div>
        <div v-if="researchAttempts.length === 0" class="muted">
          暂无本地研究查询记录；下一次自我反思会在需要时补查本地记忆。
        </div>
        <div v-if="researchAttempts.length > 0" class="research-summary-strip">
          <span class="research-summary-pill">查询 {{ researchSummary.total }}</span>
          <span class="research-summary-pill hit">命中查询 {{ researchSummary.hit }}</span>
          <span class="research-summary-pill">证据 {{ researchSummary.evidenceCount }}</span>
          <span v-if="researchSummary.degraded > 0" class="research-summary-pill degraded">
            部分失败 {{ researchSummary.degraded }}
          </span>
          <span v-if="researchSummary.empty > 0" class="research-summary-pill empty">
            无结果 {{ researchSummary.empty }}
          </span>
          <span v-if="researchSummary.skipped > 0" class="research-summary-pill skipped">
            未补查 {{ researchSummary.skipped }}
          </span>
          <span v-if="researchSummary.failed > 0" class="research-summary-pill failed">
            失败 {{ researchSummary.failed }}
          </span>
        </div>
        <div v-if="researchAttempts.length > 0" class="research-trace-list">
          <div
            v-for="attempt in researchAttempts"
            :key="attempt.id"
            class="research-trace-card"
            :class="[attempt.status, { degraded: Boolean(attempt.errorMessage && attempt.status !== 'failed') }]"
          >
            <div class="inline-head">
              <span>{{ attempt.purpose || '本地研究查询' }}</span>
              <span class="research-status" :class="attempt.status">
                {{ researchStatusLabel(attempt.status) }}
              </span>
            </div>
            <p class="run-summary">{{ attempt.query }}</p>
            <div class="action-meta">
              <span>{{ researchResultLabel(attempt) }}</span>
              <span v-if="attempt.sourceTypes.length > 0">
                {{ attempt.sourceTypes.join(' / ') }}
              </span>
              <span v-if="attempt.projectFilter">项目 {{ attempt.projectFilter }}</span>
              <span v-if="attempt.senderFilter.length > 0">
                发送人 {{ attempt.senderFilter.join(' / ') }}
              </span>
              <span v-if="attempt.groupFilter.length > 0">
                群组 {{ attempt.groupFilter.join(' / ') }}
              </span>
              <span>{{ relativeTime(attempt.createdAt) }}</span>
            </div>
            <div v-if="attempt.scopeNotice" class="research-scope-notice">
              <strong>研究范围回执</strong>
              <span>{{ attempt.scopeNotice }}</span>
              <span v-if="(attempt.rejectedSourceTypes?.length ?? 0) > 0">
                已忽略 {{ attempt.rejectedSourceTypes.join(' / ') }}
              </span>
            </div>
            <div v-if="attempt.errorMessage" class="research-error">
              {{ attempt.errorMessage }}
            </div>
            <div v-else-if="attempt.status === 'empty'" class="research-empty">
              本地没有找到可加入本轮反思的证据。
            </div>
            <div v-else-if="attempt.status === 'skipped'" class="research-skipped">
              本轮没有执行额外 recall 查询；反思继续使用已有线程证据。
            </div>
            <div v-if="attempt.evidenceRefs.length > 0" class="research-refs">
              证据 {{ attempt.evidenceRefs.slice(0, 4).join(' · ') }}
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">研究命中证据</div>
        <div v-if="researchEvidence.length === 0" class="muted">暂无研究补充证据</div>
        <div v-else class="evidence-list">
          <div v-for="link in researchEvidence" :key="link.id" class="evidence-item">
            <div class="inline-head">
              <span>{{ link.previewTitle || link.sourceKind }}</span>
              <span class="muted small">{{ link.sourceKind }}/{{ link.role }}</span>
            </div>
            <p>{{ link.preview || link.sourceId }}</p>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">证据</div>
        <div v-if="detail.links.length === 0" class="muted">暂无证据链路</div>
        <div v-else class="evidence-list">
          <div v-for="link in detail.links" :key="link.id" class="evidence-item">
            <div class="inline-head">
              <span>{{ link.previewTitle || link.sourceKind }}</span>
              <span class="muted small">{{ link.sourceKind }}/{{ link.role }}</span>
            </div>
            <p>{{ link.preview || link.sourceId }}</p>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">运行历史</div>
        <div v-if="detail.runs.length === 0" class="muted">暂无运行记录</div>
        <div v-else class="run-list">
          <div v-for="run in detail.runs" :key="run.id" class="run-card">
            <div class="inline-head">
              <span>{{ run.runType }} / {{ run.triggerType || 'unknown' }}</span>
              <span class="muted small">{{ relativeTime(run.createdAt) }}</span>
            </div>
            <p class="run-summary">{{ run.summary }}</p>

            <div v-if="run.discoveries.length > 0" class="sub-block">
              <div class="sub-title">发现</div>
              <ul class="bullet-list compact">
                <li v-for="item in run.discoveries" :key="item">{{ item }}</li>
              </ul>
            </div>

            <div v-if="run.openQuestions.length > 0" class="sub-block">
              <div class="sub-title">开放问题</div>
              <ul class="bullet-list compact">
                <li v-for="item in run.openQuestions" :key="item">{{ item }}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  getMemoryServiceClient,
  type OutreachSession,
  type ReflectionThreadDetailResponse,
} from '../../services/MemoryServiceClient';
import {
  buildReflectionHandoffReceipt,
  buildReflectionOperationScopeReceipt,
} from '../reflectionThreadPresentation';

const client = getMemoryServiceClient();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const busy = ref(false);
const detailLoadError = ref('');
const operationError = ref('');
const operationReceipt = ref<ReflectionOperationResultReceipt | null>(null);
const detail = ref<ReflectionThreadDetailResponse | null>(null);
const manualRevisitPending = ref(false);
const researchEvidence = computed(
  () => detail.value?.links.filter(link => link.role === 'research') ?? [],
);
const researchAttempts = computed(() => detail.value?.researchAttempts ?? []);
const detailHandoffReceipt = computed(() =>
  detail.value
    ? buildReflectionHandoffReceipt({
        thread: detail.value.thread,
        actions: detail.value.actions,
        researchAttempts: researchAttempts.value,
        outreachLoadError: outreachLoadError.value,
        outreachSessionCount: threadOutreachSessions.value.length,
      })
    : null,
);
const detailOperationReceipt = computed(() =>
  detail.value
    ? buildReflectionOperationScopeReceipt({
        thread: detail.value.thread,
        actions: detail.value.actions,
        researchAttempts: researchAttempts.value,
        outreachLoadError: outreachLoadError.value,
        outreachSessionCount: threadOutreachSessions.value.length,
      })
    : null,
);
const researchSummary = computed(() => {
  const attempts = researchAttempts.value;
  const evidenceRefs = new Set<string>();
  for (const attempt of attempts) {
    for (const ref of attempt.evidenceRefs) {
      evidenceRefs.add(ref);
    }
  }

  return {
    total: attempts.length,
    hit: attempts.filter(attempt => attempt.status === 'hit').length,
    empty: attempts.filter(attempt => attempt.status === 'empty').length,
    failed: attempts.filter(attempt => attempt.status === 'failed').length,
    skipped: attempts.filter(attempt => attempt.status === 'skipped').length,
    degraded: attempts.filter(
      attempt => attempt.status !== 'failed' && Boolean(attempt.errorMessage),
    ).length,
    evidenceCount: evidenceRefs.size,
  };
});
const researchScopeReceipt = computed(() => {
  const attempts = researchAttempts.value;
  const summary = researchSummary.value;
  if (attempts.length === 0) {
    return {
      tone: 'empty',
      title: '尚未计划本地研究',
      summary:
        '当前详情没有本地研究查询记录；下一次自我反思会按开放问题决定是否补查 Personal AI 本地记忆。',
      evidenceLine: '0 次查询 · 暂无补充证据',
      sourceLine: '未读取本地来源',
      boundary:
        '只说明反思准备，不触发外部搜索、发送、确认决策、执行 OpenClaw 或写 confirmed profile。',
      recovery: '点击立即自我反思会重新读取本地可见证据。',
      chips: ['未执行查询', '本地只读', '同轮反思'],
    };
  }

  const sourceTypes = uniqList(attempts.flatMap(attempt => attempt.sourceTypes));
  const rejectedSourceTypes = uniqList(
    attempts.flatMap(attempt => attempt.rejectedSourceTypes ?? []),
  );
  const queriedCount = Math.max(0, summary.total - summary.skipped);
  const tone =
    summary.failed > 0 ? 'attention' : summary.degraded > 0 ? 'waiting' : 'ready';
  const issueParts = [
    summary.degraded > 0 ? `部分失败 ${summary.degraded}` : '',
    summary.empty > 0 ? `无结果 ${summary.empty}` : '',
    summary.skipped > 0 ? `未补查 ${summary.skipped}` : '',
    summary.failed > 0 ? `失败 ${summary.failed}` : '',
  ].filter(Boolean);
  const evidenceLine =
    queriedCount === 0
      ? `未执行额外查询 · 证据 ${summary.evidenceCount}${
          issueParts.length > 0 ? ` · ${issueParts.join(' · ')}` : ''
        }`
      : `实际查询 ${queriedCount}/${summary.total} · 命中查询 ${summary.hit}/${queriedCount} · 证据 ${summary.evidenceCount}${
          issueParts.length > 0 ? ` · ${issueParts.join(' · ')}` : ''
        }`;

  return {
    tone,
    title:
      summary.failed > 0
        ? '本地研究有失败项'
        : summary.degraded > 0
          ? '本地研究部分降级'
          : summary.skipped > 0 && queriedCount === 0
            ? '本轮无需额外补查'
            : summary.skipped > 0
              ? '本地研究已完成，部分未补查'
              : '本地研究已完成',
    summary:
      queriedCount === 0
        ? '本轮没有执行额外 recall 查询；Memory Service 使用线程已有证据继续生成反思，不会另建外部动作。'
        : `本轮 ${queriedCount} 次实际查询只读取 Personal AI 本地可见记忆；命中证据会直接进入同一轮反思，不会另建外部动作。`,
    evidenceLine,
    sourceLine:
      queriedCount === 0
        ? '未读取额外来源'
        : sourceTypes.length > 0
        ? `${sourceTypes.length} 类来源：${compactList(sourceTypes)}${
            rejectedSourceTypes.length > 0
              ? `；已裁剪 ${rejectedSourceTypes.length} 类`
              : ''
          }`
        : '未记录来源范围',
    boundary:
      '只读补查，不联网搜索、不发送、不确认决策、不执行 OpenClaw、不写 confirmed profile。',
    recovery:
      summary.failed > 0
        ? '失败查询保留在下方 trace；重新反思会重新规划并再次补查。'
        : summary.skipped > 0 && queriedCount === 0
          ? '如需强制找新证据，补充开放问题后再点立即自我反思。'
        : rejectedSourceTypes.length > 0
          ? '被裁剪来源已在下方回执列出；调整问题后可重新反思。'
          : summary.skipped > 0
            ? '未执行的 trace 会说明原因；需要更多证据时补充开放问题后重新反思。'
          : '需要更多证据时，可调整开放问题后重新反思。',
    chips: [
      '本地只读',
      '同轮反思',
      queriedCount > 0 ? `实际查询 ${queriedCount}` : '未读取额外来源',
      sourceTypes.length > 0 ? `${sourceTypes.length} 类来源` : '',
      summary.skipped > 0 ? `未补查 ${summary.skipped}` : '',
      rejectedSourceTypes.length > 0 ? `裁剪 ${rejectedSourceTypes.length}` : '',
    ].filter((chip): chip is string => Boolean(chip)),
  };
});
const researchPendingReceipt = computed(() => {
  if (!manualRevisitPending.value || !detail.value) return null;
  const previousAttempts = researchAttempts.value.length;
  const previousRun = detail.value.runs[0];

  return {
    title: '新一轮本地研究提交中',
    summary:
      'Memory Service 正在为这次 manual_revisit 规划并读取本地可见证据；返回前不会把下方研究 trace 当成新结果。',
    pendingLine:
      '正在规划查询、读取本地记忆，并把命中证据并入同一轮反思。',
    oldSnapshotLine:
      previousAttempts > 0
        ? `下方仍是上次成功读取的 ${previousAttempts} 条研究 trace${
            previousRun ? `（${relativeTime(previousRun.createdAt)}）` : ''
          }，尚未被本次结果替换。`
        : '下方暂无旧研究 trace；本次结果返回前仍不能判断是否查到证据。',
    boundary:
      '提交中不代表研究已完成，也不联网搜索、发送消息、确认决策、执行 OpenClaw 或写 confirmed profile。',
    recovery:
      '成功后会刷新为新的研究范围、trace 和运行历史；失败时保留旧快照并显示错误。',
    chips: [
      '提交中',
      '旧 trace 保留',
      previousAttempts > 0 ? `旧查询 ${previousAttempts}` : '暂无旧查询',
      '本地只读',
    ],
  };
});
const transcriptVisible = ref<Record<string, boolean>>({});
const transcriptLoading = ref<Record<string, boolean>>({});
const transcriptContent = ref<Record<string, string | null>>({});
const threadOutreachLoading = ref(false);
const threadOutreachSessions = ref<OutreachSession[]>([]);
const outreachLoadError = ref('');

interface ReflectionOperationResultReceipt {
  title: string;
  summary: string;
  writeResult: string;
  boundary: string;
  recovery: string;
  tone: 'ready' | 'waiting' | 'closed';
}

onMounted(() => {
  void loadDetail();
});

watch(
  () => route.params.id,
  () => {
    void loadDetail();
  },
);

async function loadDetail() {
  const threadId = route.params.id as string;
  if (!threadId) return;
  loading.value = true;
  detailLoadError.value = '';
  try {
    const threadDetail = await client.getReflectionThread(threadId);
    detail.value = threadDetail;
  } catch (error) {
    console.error('Failed to load reflection detail:', error);
    detailLoadError.value = errorMessage(error);
    detail.value = null;
  } finally {
    loading.value = false;
  }

  if (detail.value) {
    await loadOutreachSessions(threadId);
  } else {
    threadOutreachLoading.value = false;
    threadOutreachSessions.value = [];
  }
}

async function loadOutreachSessions(threadId = route.params.id as string) {
  if (!threadId) return;
  threadOutreachLoading.value = true;
  outreachLoadError.value = '';
  try {
    const outreach = await client.getOutreachSessions({
      threadId,
      limit: 50,
    });
    threadOutreachSessions.value = outreach.items;
  } catch (error) {
    console.error('Failed to load reflection outreach sessions:', error);
    outreachLoadError.value = errorMessage(error);
  } finally {
    threadOutreachLoading.value = false;
  }
}

async function revisitThread() {
  if (!detail.value) return;
  busy.value = true;
  manualRevisitPending.value = true;
  operationError.value = '';
  operationReceipt.value = null;
  try {
    const result = await client.revisitReflectionThread(detail.value.thread.id, true);
    await loadDetail();
    operationReceipt.value = {
      title: '手动反思已完成',
      summary:
        'Memory Service 已确认这次 manual_revisit，并已刷新线程详情。',
      writeResult: `写入运行 ${result.run.id}；候选动作 ${result.actions.length}`,
      boundary:
        '这次回执不代表已发送消息、确认决策、执行 OpenClaw、写 confirmed profile 或删除原始证据。',
      recovery:
        '查看运行历史、研究补查和动作队列；如结论仍缺证据，可再次立即自我反思。',
      tone: result.actions.length > 0 ? 'waiting' : 'ready',
    };
  } catch (error) {
    operationError.value = `立即自我反思失败：${errorMessage(error)}`;
  } finally {
    manualRevisitPending.value = false;
    busy.value = false;
  }
}

async function pauseThread() {
  if (!detail.value) return;
  busy.value = true;
  operationError.value = '';
  operationReceipt.value = null;
  try {
    const result = await client.pauseReflectionThread(
      detail.value.thread.id,
      'Paused from UI',
    );
    await loadDetail();
    operationReceipt.value = {
      title: '反思线程已暂停',
      summary: 'Memory Service 已把这条线程设为 paused，并保留历史证据和运行记录。',
      writeResult: `线程状态 ${statusLabel(result.thread.status)}`,
      boundary:
        '暂停只停止后续自动推进；不会删除证据、取消已排队动作、撤回主动询问或清空运行历史。',
      recovery: '需要继续时点击恢复；如果要马上补查，恢复后再点立即自我反思。',
      tone: 'waiting',
    };
  } catch (error) {
    operationError.value = `暂停失败：${errorMessage(error)}`;
  } finally {
    busy.value = false;
  }
}

async function resumeThread() {
  if (!detail.value) return;
  busy.value = true;
  operationError.value = '';
  operationReceipt.value = null;
  try {
    const result = await client.resumeReflectionThread(detail.value.thread.id);
    await loadDetail();
    operationReceipt.value = {
      title: '反思线程已恢复',
      summary:
        'Memory Service 已把这条线程设回 active，并排到当前时间等待下一轮推进。',
      writeResult: `线程状态 ${statusLabel(result.thread.status)}`,
      boundary:
        '恢复不会补齐外部回复、确认决策、执行动作或把旧结论升格为 confirmed profile。',
      recovery: '如需立刻推进，可点击立即自我反思；否则等待 heartbeat 自动处理。',
      tone: 'ready',
    };
  } catch (error) {
    operationError.value = `恢复失败：${errorMessage(error)}`;
  } finally {
    busy.value = false;
  }
}

async function closeThread() {
  if (!detail.value) return;
  if (!window.confirm('确认关闭这个反思线程吗？')) return;
  busy.value = true;
  operationError.value = '';
  operationReceipt.value = null;
  try {
    const result = await client.closeReflectionThread(
      detail.value.thread.id,
      'Closed from UI',
    );
    await loadDetail();
    operationReceipt.value = {
      title: '反思线程已关闭',
      summary: 'Memory Service 已停止这条线程的后续自动推进。',
      writeResult: `线程状态 ${statusLabel(result.thread.status)}`,
      boundary:
        '关闭不会删除历史证据、撤销已经发生的外部副作用或取消其它队列里的独立动作。',
      recovery: '如果后续仍需跟进，点击恢复后再重新反思。',
      tone: 'closed',
    };
  } catch (error) {
    operationError.value = `关闭失败：${errorMessage(error)}`;
  } finally {
    busy.value = false;
  }
}

async function executeAction(id: string) {
  operationError.value = '';
  operationReceipt.value = null;
  try {
    await client.executeAction(id);
    await loadDetail();
  } catch (error) {
    operationError.value = `执行动作失败：${errorMessage(error)}`;
  }
}

async function retryAction(id: string) {
  operationError.value = '';
  operationReceipt.value = null;
  try {
    await client.retryAction(id);
    await loadDetail();
  } catch (error) {
    operationError.value = `重试动作失败：${errorMessage(error)}`;
  }
}

async function cancelAction(id: string) {
  operationError.value = '';
  operationReceipt.value = null;
  try {
    await client.cancelAction(id, 'Cancelled from UI');
    await loadDetail();
  } catch (error) {
    operationError.value = `取消动作失败：${errorMessage(error)}`;
  }
}

async function toggleTranscript(resultId: string, transcriptPath?: string) {
  if (!transcriptPath) return;
  const nextVisible = !transcriptVisible.value[resultId];
  transcriptVisible.value = {
    ...transcriptVisible.value,
    [resultId]: nextVisible,
  };
  if (!nextVisible || transcriptContent.value[resultId] !== undefined) {
    return;
  }

  const filename = transcriptFilename(transcriptPath);
  if (!filename) {
    transcriptContent.value = {
      ...transcriptContent.value,
      [resultId]: '暂不支持读取该 transcript 路径。',
    };
    return;
  }

  transcriptLoading.value = {
    ...transcriptLoading.value,
    [resultId]: true,
  };
  try {
    const content = await client.readUserFile('delegations', filename);
    transcriptContent.value = {
      ...transcriptContent.value,
      [resultId]: content,
    };
  } finally {
    transcriptLoading.value = {
      ...transcriptLoading.value,
      [resultId]: false,
    };
  }
}

function transcriptFilename(transcriptPath: string): string | null {
  if (!transcriptPath.startsWith('delegations/')) {
    return null;
  }
  return transcriptPath.slice('delegations/'.length);
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusLabel(status: string) {
  if (status === 'active') return '进行中';
  if (status === 'paused') return '已暂停';
  return '已关闭';
}

function displayActionType(actionType: string) {
  if (actionType === 'ask_external_user') return '主动询问';
  if (actionType === 'delegate_openclaw') return 'OpenClaw 委派';
  if (actionType === 'query_external_tool') return 'query_external_tool（兼容模式）';
  return actionType;
}

function outreachStatusLabel(status: string) {
  if (status === 'pending_approval') return '待审批';
  if (status === 'scheduled') return '已排程';
  if (status === 'waiting_reply') return '等待回复';
  if (status === 'deferred') return '延期等待';
  if (status === 'resolved') return '已拿到结果';
  if (status === 'no_reply') return '无回复';
  if (status === 'escalated') return '已升级';
  if (status === 'cancelled') return '已取消';
  if (status === 'failed') return '失败';
  return status || '未知状态';
}

function outreachOriginLabel(originKind?: string) {
  if (originKind === 'reflection_action') return '自我反思';
  if (originKind === 'scheduled_template' || originKind === 'manual_action') return '手动/定时';
  return '未知来源';
}

function outreachTargetTypeLabel(targetType?: string) {
  if (targetType === 'private') return '私聊';
  if (targetType === 'group') return '群组';
  return targetType || '未知目标';
}

function waitingReasonLabel(reason?: string) {
  if (reason === 'waiting_for_delegation') return '等待外部委派结果回流';
  if (reason === 'waiting_for_confirm_request') return '等待用户在决策中心确认';
  if (reason === 'waiting_for_outreach') return '等待关联主动询问回复';
  if (reason === 'waiting_for_manual_action') return '等待用户处理手动动作';
  return reason || '等待下一轮自我反思';
}

function researchStatusLabel(status: string) {
  if (status === 'hit') return '已命中';
  if (status === 'empty') return '无结果';
  if (status === 'failed') return '查询失败';
  if (status === 'skipped') return '未补查';
  return status || '未知';
}

function researchResultLabel(attempt: { status: string; resultCount: number }) {
  if (attempt.status === 'skipped') return '未执行 recall';
  return `命中 ${attempt.resultCount}`;
}

function uniqList(values: string[]) {
  return Array.from(
    new Set(
      values
        .map(value => value.trim())
        .filter(Boolean),
    ),
  );
}

function compactList(values: string[], limit = 5) {
  if (values.length <= limit) return values.join(' / ');
  return `${values.slice(0, limit).join(' / ')} 等 ${values.length} 类`;
}

function displayThreadTitle(title: string) {
  return title.replace(/^思考反思:/, '自我反思:');
}

function relativeTime(ts: number) {
  const normalized = normalizeTimestamp(ts);
  const diff = normalized - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.floor(abs / 60000);
  if (minutes < 1) return diff >= 0 ? '即将' : '刚刚';
  if (minutes < 60) return diff >= 0 ? `${minutes}分钟后` : `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return diff >= 0 ? `${hours}小时后` : `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return diff >= 0 ? `${days}天后` : `${days}天前`;
}

function normalizeTimestamp(ts: number) {
  return ts > 1_000_000_000_000 ? ts : ts * 1000;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : '无法连接 Memory Service，请稍后重试。';
}
</script>

<style scoped>
.reflection-detail-page {
  animation: fadeInUp 0.5s ease-out;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.back-btn,
.primary-btn,
.ghost-btn,
.danger-btn,
.tiny-btn {
  border: none;
  border-radius: 0.8rem;
  padding: 0.7rem 1rem;
  cursor: pointer;
}

.back-btn,
.ghost-btn,
.tiny-btn {
  background: rgba(30, 41, 59, 0.8);
  color: #e2e8f0;
}

.primary-btn {
  background: linear-gradient(135deg, #0284c7, #2563eb);
  color: white;
}

.danger-btn,
.tiny-btn.danger {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

.action-bar {
  display: flex;
  gap: 0.75rem;
}

.detail-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.operation-scope-box {
  background: rgba(8, 47, 73, 0.46);
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-left: 3px solid rgba(56, 189, 248, 0.78);
  border-radius: 0.9rem;
  padding: 1rem;
}

.operation-scope-box.waiting {
  background: rgba(69, 26, 3, 0.36);
  border-color: rgba(251, 191, 36, 0.28);
  border-left-color: rgba(251, 191, 36, 0.86);
}

.operation-scope-box.attention {
  background: rgba(69, 10, 10, 0.34);
  border-color: rgba(248, 113, 113, 0.3);
  border-left-color: rgba(248, 113, 113, 0.88);
}

.operation-scope-box.paused {
  background: rgba(49, 46, 129, 0.34);
  border-color: rgba(167, 139, 250, 0.28);
  border-left-color: rgba(167, 139, 250, 0.84);
}

.operation-scope-box.closed {
  background: rgba(30, 41, 59, 0.62);
  border-color: rgba(148, 163, 184, 0.22);
  border-left-color: rgba(148, 163, 184, 0.78);
}

.operation-scope-main h3 {
  color: #e2e8f0;
  font-size: 1rem;
  margin: 0 0 0.35rem;
}

.operation-scope-main p {
  color: #cbd5e1;
  font-size: 0.86rem;
  line-height: 1.55;
  margin: 0;
}

.operation-scope-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0.85rem;
}

.operation-scope-grid div {
  background: rgba(15, 23, 42, 0.52);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  padding: 0.72rem;
}

.operation-scope-grid span {
  display: block;
  color: #94a3b8;
  font-size: 0.72rem;
  margin-bottom: 0.32rem;
}

.operation-scope-grid strong {
  color: #e2e8f0;
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.45;
}

.operation-scope-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
  margin-top: 0.78rem;
}

.operation-scope-chip {
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.62);
  color: #cbd5e1;
  font-size: 0.72rem;
  line-height: 1;
  padding: 0.3rem 0.5rem;
}

.hero-card,
.panel {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 1rem;
  padding: 1.25rem;
}

.load-error,
.operation-error,
.operation-receipt,
.sub-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(248, 113, 113, 0.28);
  border-radius: 8px;
  background: rgba(127, 29, 29, 0.22);
  color: #fecaca;
  padding: 0.85rem 0.95rem;
  margin-bottom: 1rem;
}

.operation-error,
.operation-receipt,
.sub-error {
  margin-bottom: 0.8rem;
}

.operation-receipt {
  background: rgba(20, 83, 45, 0.22);
  border-color: rgba(74, 222, 128, 0.28);
  border-left: 3px solid rgba(74, 222, 128, 0.78);
  color: #dcfce7;
}

.operation-receipt.waiting {
  background: rgba(69, 26, 3, 0.28);
  border-color: rgba(251, 191, 36, 0.3);
  border-left-color: rgba(251, 191, 36, 0.84);
  color: #fef3c7;
}

.operation-receipt.closed {
  background: rgba(30, 41, 59, 0.62);
  border-color: rgba(148, 163, 184, 0.22);
  border-left-color: rgba(148, 163, 184, 0.78);
  color: #e2e8f0;
}

.operation-receipt-title {
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.operation-receipt p {
  color: #cbd5e1;
  font-size: 0.84rem;
  line-height: 1.5;
  margin: 0;
}

.operation-receipt-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
  margin-top: 0.72rem;
}

.operation-receipt-grid div {
  background: rgba(15, 23, 42, 0.46);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  padding: 0.62rem;
}

.operation-receipt-grid span {
  display: block;
  color: #94a3b8;
  font-size: 0.72rem;
  margin-bottom: 0.28rem;
}

.operation-receipt-grid strong {
  color: #e2e8f0;
  display: block;
  font-size: 0.78rem;
  line-height: 1.45;
}

.sub-error {
  background: rgba(120, 53, 15, 0.24);
  border-color: rgba(251, 146, 60, 0.3);
  color: #fed7aa;
}

.load-error-title {
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.load-error p {
  color: #fca5a5;
  font-size: 0.84rem;
  line-height: 1.5;
  margin: 0;
}

.load-error-retry {
  flex-shrink: 0;
  border: 1px solid rgba(248, 113, 113, 0.36);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.7);
  color: #fee2e2;
  padding: 0.48rem 0.75rem;
  cursor: pointer;
}

.load-error-retry:hover {
  border-color: rgba(248, 113, 113, 0.58);
  color: #fff1f2;
}

.hero-top,
.hero-meta,
.inline-head,
.action-meta,
.action-buttons {
  display: flex;
  gap: 0.75rem;
}

.hero-top {
  justify-content: space-between;
  align-items: flex-start;
}

.hero-top h2 {
  margin-bottom: 0.5rem;
}

.hero-top p,
.action-desc,
.run-summary,
.evidence-item p {
  color: #cbd5e1;
  line-height: 1.6;
}

.hero-metrics,
.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.hero-meta {
  color: #94a3b8;
  font-size: 0.83rem;
  margin-top: 0.9rem;
}

.transcript-block,
.json-block {
  margin-top: 0.6rem;
}

.json-block {
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.8rem;
  padding: 0.85rem;
  color: #cbd5e1;
  font-size: 0.8rem;
  line-height: 1.5;
}

.metric-pill,
.queue-badge {
  padding: 0.18rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
}

.queue-badge.queued {
  background: rgba(14, 165, 233, 0.16);
  color: #7dd3fc;
}

.queue-badge.failed {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.queue-badge.succeeded {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}

.queue-badge.running {
  background: rgba(245, 158, 11, 0.16);
  color: #fcd34d;
}

.research-trace-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.research-run-scope {
  background: rgba(8, 47, 73, 0.38);
  border: 1px solid rgba(56, 189, 248, 0.2);
  border-left: 3px solid rgba(56, 189, 248, 0.74);
  border-radius: 0.9rem;
  padding: 1rem;
  margin-bottom: 0.9rem;
}

.research-pending-receipt {
  background: rgba(69, 26, 3, 0.3);
  border: 1px solid rgba(251, 191, 36, 0.24);
  border-left: 3px solid rgba(251, 191, 36, 0.82);
  border-radius: 0.9rem;
  padding: 1rem;
  margin-bottom: 0.9rem;
}

.research-run-scope.ready {
  border-left-color: rgba(34, 197, 94, 0.78);
}

.research-run-scope.waiting {
  background: rgba(69, 26, 3, 0.3);
  border-color: rgba(251, 191, 36, 0.24);
  border-left-color: rgba(251, 191, 36, 0.82);
}

.research-run-scope.attention {
  background: rgba(69, 10, 10, 0.32);
  border-color: rgba(248, 113, 113, 0.28);
  border-left-color: rgba(248, 113, 113, 0.86);
}

.research-run-scope.empty {
  background: rgba(30, 41, 59, 0.5);
  border-color: rgba(148, 163, 184, 0.16);
  border-left-color: rgba(148, 163, 184, 0.72);
}

.research-run-scope-main h3 {
  color: #e2e8f0;
  font-size: 1rem;
  margin: 0 0 0.35rem;
}

.research-pending-main h3 {
  color: #e2e8f0;
  font-size: 1rem;
  margin: 0 0 0.35rem;
}

.research-run-scope-main p {
  color: #cbd5e1;
  font-size: 0.86rem;
  line-height: 1.55;
  margin: 0;
}

.research-pending-main p {
  color: #cbd5e1;
  font-size: 0.86rem;
  line-height: 1.55;
  margin: 0;
}

.research-run-scope-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0.85rem;
}

.research-pending-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0.85rem;
}

.research-run-scope-grid div {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  padding: 0.72rem;
}

.research-pending-grid div {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  padding: 0.72rem;
}

.research-run-scope-grid span {
  display: block;
  color: #94a3b8;
  font-size: 0.72rem;
  margin-bottom: 0.32rem;
}

.research-pending-grid span {
  display: block;
  color: #94a3b8;
  font-size: 0.72rem;
  margin-bottom: 0.32rem;
}

.research-run-scope-grid strong {
  color: #e2e8f0;
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.45;
}

.research-pending-grid strong {
  color: #e2e8f0;
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.45;
}

.research-run-scope-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
  margin-top: 0.78rem;
}

.research-pending-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
  margin-top: 0.78rem;
}

.research-run-scope-chip {
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.58);
  color: #cbd5e1;
  font-size: 0.72rem;
  line-height: 1;
  padding: 0.3rem 0.5rem;
}

.research-pending-chip {
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.58);
  color: #fde68a;
  font-size: 0.72rem;
  line-height: 1;
  padding: 0.3rem 0.5rem;
}

.research-summary-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-bottom: 0.85rem;
}

.research-summary-pill {
  padding: 0.32rem 0.62rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.14);
  color: #bfdbfe;
  font-size: 0.78rem;
  line-height: 1;
}

.research-summary-pill.hit {
  background: rgba(34, 197, 94, 0.14);
  color: #bbf7d0;
}

.research-summary-pill.degraded {
  background: rgba(251, 191, 36, 0.16);
  color: #fde68a;
}

.research-summary-pill.empty {
  background: rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
}

.research-summary-pill.skipped {
  background: rgba(168, 85, 247, 0.16);
  color: #ddd6fe;
}

.research-summary-pill.failed {
  background: rgba(239, 68, 68, 0.16);
  color: #fecaca;
}

.research-trace-card {
  background: rgba(30, 41, 59, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 0.8rem;
  padding: 1rem;
}

.research-trace-card.failed {
  border-color: rgba(248, 113, 113, 0.28);
}

.research-trace-card.degraded {
  border-color: rgba(251, 191, 36, 0.32);
}

.research-trace-card.skipped {
  border-color: rgba(168, 85, 247, 0.26);
}

.research-status {
  flex-shrink: 0;
  padding: 0.18rem 0.58rem;
  border-radius: 999px;
  font-size: 0.74rem;
  background: rgba(59, 130, 246, 0.16);
  color: #93c5fd;
}

.research-status.hit {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}

.research-status.empty {
  background: rgba(148, 163, 184, 0.14);
  color: #cbd5e1;
}

.research-status.failed {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.research-status.skipped {
  background: rgba(168, 85, 247, 0.16);
  color: #ddd6fe;
}

.research-error,
.research-scope-notice,
.research-empty,
.research-skipped,
.research-refs {
  margin-top: 0.55rem;
  border-radius: 0.65rem;
  padding: 0.55rem 0.65rem;
  font-size: 0.8rem;
  line-height: 1.5;
  word-break: break-word;
}

.research-error {
  background: rgba(127, 29, 29, 0.26);
  color: #fecaca;
}

.research-scope-notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  background: rgba(30, 64, 175, 0.18);
  color: #bfdbfe;
}

.research-scope-notice strong {
  color: #dbeafe;
}

.research-empty,
.research-skipped,
.research-refs {
  background: rgba(15, 23, 42, 0.55);
  color: #94a3b8;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.panel-title,
.box-title,
.sub-title {
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.hypothesis-box {
  margin-top: 1rem;
  background: rgba(30, 41, 59, 0.66);
  border-radius: 0.9rem;
  padding: 1rem;
}

.reason-box {
  margin-top: 1rem;
  background: rgba(22, 78, 99, 0.28);
  border: 1px solid rgba(45, 212, 191, 0.18);
  border-radius: 0.9rem;
  padding: 1rem;
}

.handoff-box {
  margin-top: 1rem;
  background: rgba(15, 23, 42, 0.58);
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-left: 3px solid rgba(56, 189, 248, 0.68);
  border-radius: 0.9rem;
  padding: 1rem;
}

.handoff-box.waiting {
  border-left-color: rgba(251, 191, 36, 0.82);
}

.handoff-box.attention {
  border-left-color: rgba(248, 113, 113, 0.86);
}

.handoff-box.paused {
  border-left-color: rgba(167, 139, 250, 0.8);
}

.handoff-box.closed {
  border-left-color: rgba(148, 163, 184, 0.7);
}

.handoff-title {
  color: #e2e8f0;
  font-weight: 700;
  margin-bottom: 0.4rem;
}

.handoff-box p {
  color: #cbd5e1;
  line-height: 1.55;
  margin: 0 0 0.8rem;
}

.handoff-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.7rem;
}

.handoff-grid div {
  background: rgba(30, 41, 59, 0.58);
  border-radius: 8px;
  padding: 0.72rem;
}

.handoff-grid span {
  display: block;
  color: #94a3b8;
  font-size: 0.72rem;
  margin-bottom: 0.32rem;
}

.handoff-grid strong {
  color: #e2e8f0;
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.45;
}

.handoff-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.42rem;
  margin-top: 0.8rem;
}

.handoff-chip {
  border-radius: 999px;
  background: rgba(30, 41, 59, 0.82);
  color: #cbd5e1;
  font-size: 0.72rem;
  line-height: 1;
  padding: 0.3rem 0.5rem;
}

.muted,
.small {
  color: #94a3b8;
}

.small {
  font-size: 0.78rem;
}

.bullet-list {
  padding-left: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bullet-list.compact {
  gap: 0.35rem;
}

.action-list,
.evidence-list,
.run-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.action-card,
.evidence-item,
.run-card {
  background: rgba(30, 41, 59, 0.65);
  border-radius: 0.9rem;
  padding: 1rem;
}

.inline-head {
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.45rem;
}

.action-meta,
.action-buttons {
  flex-wrap: wrap;
  color: #94a3b8;
  font-size: 0.8rem;
  margin-top: 0.55rem;
}

.sub-block + .sub-block {
  margin-top: 0.75rem;
}

.loading-container,
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
}

.loading-spinner {
  width: 2.3rem;
  height: 2.3rem;
  border: 2px solid rgba(56, 189, 248, 0.18);
  border-top: 2px solid #38bdf8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 1rem;
}

@media (max-width: 900px) {
  .page-head {
    flex-direction: column;
    align-items: stretch;
  }

  .action-bar {
    flex-wrap: wrap;
  }

  .load-error,
  .operation-error,
  .operation-receipt,
  .sub-error {
    align-items: flex-start;
    flex-direction: column;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .operation-scope-grid {
    grid-template-columns: 1fr;
  }

  .research-run-scope-grid {
    grid-template-columns: 1fr;
  }

  .research-pending-grid {
    grid-template-columns: 1fr;
  }

  .handoff-grid {
    grid-template-columns: 1fr;
  }

  .operation-receipt-grid {
    grid-template-columns: 1fr;
  }
}
</style>
