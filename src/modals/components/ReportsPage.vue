<template>
  <div class="reports-page">
    <div class="header-row">
      <div>
        <h2 class="section-title">周报报告</h2>
        <p class="section-subtitle">
          从周报通知进入后直接查看对应报告；摘要推送只做提醒，正文在这里复核。
        </p>
      </div>
      <button class="secondary-action" @click="loadReports">刷新</button>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载周报...</p>
    </div>

    <template v-else>
      <div v-if="loadError" class="load-error">
        <div>
          <div class="load-error-title">周报暂时不可用</div>
          <p>{{ loadError }}</p>
        </div>
        <button class="load-error-retry" @click="loadReports">重试</button>
      </div>

      <div v-if="reportFiles.length === 0 && !loadError" class="empty-state">
        <div class="empty-title">暂无周报</div>
        <p class="empty-hint">生成周报后，`reports/` 目录里的 Markdown 会出现在这里。</p>
      </div>

      <div
        v-if="requestedMissingFilename"
        class="report-target-warning"
      >
        <div class="target-warning-title">周报通知目标暂时不可读</div>
        <p>
          通知指向的周报文件 reports/{{ requestedMissingFilename }} 暂时无法读取；已先展示最近可用周报。
        </p>
        <p>
          本页只读取 reports/ 目录里的已生成 Markdown，不会重新生成周报、写入通知中心、发送 Bot/Chrome/Doubao，或改变通知处理状态。
        </p>
      </div>

      <div v-if="reportFiles.length > 0" class="reports-layout">
        <aside class="report-list" aria-label="周报列表">
          <button
            v-for="report in reportFiles"
            :key="report.filename"
            class="report-list-item"
            :class="{ active: report.filename === selectedFilename }"
            @click="selectReport(report.filename)"
          >
            <span class="report-list-title">{{ report.title }}</span>
            <span class="report-list-meta">
              {{ report.date || '未知日期' }} · reports/{{ report.filename }}
            </span>
          </button>
        </aside>

        <article class="report-reader">
          <div class="report-reader-header">
            <div>
              <div class="report-eyebrow">reports/{{ selectedFilename }}</div>
              <h3 class="report-title">{{ currentReportTitle }}</h3>
            </div>
            <span class="report-date">{{ currentReportDate || '未知日期' }}</span>
          </div>

          <div v-if="selectedLoadError" class="report-inline-error">
            {{ selectedLoadError }}
          </div>
          <div v-else class="report-markdown" v-html="renderMarkdown(selectedContent)"></div>
        </article>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getMemoryServiceClient } from '../../services/MemoryServiceClient';

interface ReportFile {
  filename: string;
  title: string;
  date: string;
}

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const loadError = ref('');
const selectedLoadError = ref('');
const reportFiles = ref<ReportFile[]>([]);
const selectedFilename = ref('');
const selectedContent = ref('');
const requestedMissingFilename = ref('');

const currentReportTitle = computed(() => {
  const fromContent = extractTitle(selectedContent.value, selectedFilename.value);
  if (fromContent) return fromContent;
  return (
    reportFiles.value.find((report) => report.filename === selectedFilename.value)
      ?.title || '未选择周报'
  );
});

const currentReportDate = computed(() => extractDate(selectedFilename.value));

function firstQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

function normalizeReportFilename(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const filename = trimmed.startsWith('reports/')
    ? trimmed.slice('reports/'.length)
    : trimmed;
  if (
    !filename ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('..') ||
    !filename.endsWith('.md')
  ) {
    return null;
  }
  return filename;
}

function extractDate(filename: string): string {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function extractTitle(content: string, filename: string): string {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  return filename ? filename.replace(/\.md$/, '').replace(/-/g, ' ') : '';
}

function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '')
    .replace(/\n{2,}/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function buildReportFile(filename: string): ReportFile {
  return {
    filename,
    title: filename.replace(/\.md$/, '').replace(/-/g, ' '),
    date: extractDate(filename),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '无法连接 Memory Service 或读取 reports 目录。';
}

async function loadSelectedReport(filename: string): Promise<boolean> {
  selectedLoadError.value = '';
  selectedContent.value = '';
  selectedFilename.value = filename;

  const client = getMemoryServiceClient();
  const content = await client.readUserFile('reports', filename);
  if (content === null) {
    selectedLoadError.value = `无法读取 reports/${filename}。`;
    return false;
  }
  selectedContent.value = content;
  return true;
}

async function loadReports() {
  loading.value = true;
  loadError.value = '';
  selectedLoadError.value = '';
  requestedMissingFilename.value = '';

  try {
    const client = getMemoryServiceClient();
    const files = await client.listUserFiles('reports');
    const normalized = Array.from(
      new Set(
        files
          .map((file) => normalizeReportFilename(file))
          .filter((file): file is string => Boolean(file)),
      ),
    ).sort((a, b) => b.localeCompare(a));

    reportFiles.value = normalized.map(buildReportFile);
    const requested = normalizeReportFilename(firstQueryValue(route.query.file));
    const fallbackFilename = reportFiles.value[0]?.filename || '';

    if (!requested && !fallbackFilename) {
      selectedFilename.value = '';
      selectedContent.value = '';
      return;
    }

    if (requested) {
      const requestedLoaded = await loadSelectedReport(requested);
      if (requestedLoaded) {
        if (!reportFiles.value.some((report) => report.filename === requested)) {
          reportFiles.value = [buildReportFile(requested), ...reportFiles.value];
        }
        return;
      }

      requestedMissingFilename.value = requested;
    }

    if (fallbackFilename && fallbackFilename !== requested) {
      await loadSelectedReport(fallbackFilename);
      return;
    }
  } catch (error) {
    console.error('Failed to load weekly reports:', error);
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

async function selectReport(filename: string) {
  if (filename === selectedFilename.value) return;
  await router.replace({ path: '/reports', query: { file: filename } });
}

onMounted(loadReports);
watch(
  () => route.query.file,
  () => {
    void loadReports();
  },
);
</script>

<style scoped>
.reports-page {
  animation: fadeInUp 0.6s ease-out;
  max-width: 1080px;
  margin: 0 auto;
}

.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #e5e7eb;
}

.section-subtitle {
  color: #94a3b8;
  font-size: 0.875rem;
  line-height: 1.5;
}

.secondary-action,
.load-error-retry {
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.8);
  color: #e5e7eb;
  padding: 0.55rem 0.8rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.secondary-action:hover,
.load-error-retry:hover {
  border-color: rgba(96, 165, 250, 0.55);
  color: #bfdbfe;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #94a3b8;
}

.loading-spinner {
  width: 2.5rem;
  height: 2.5rem;
  border: 2px solid rgba(96, 165, 250, 0.25);
  border-top: 2px solid #60a5fa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

.load-error,
.report-inline-error,
.report-target-warning {
  border: 1px solid rgba(248, 113, 113, 0.28);
  border-radius: 8px;
  background: rgba(127, 29, 29, 0.18);
  color: #fecaca;
  padding: 1rem;
}

.load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.load-error-title {
  color: #fee2e2;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.report-target-warning {
  border-color: rgba(251, 191, 36, 0.36);
  background: rgba(120, 53, 15, 0.18);
  color: #fde68a;
  margin-bottom: 1rem;
}

.report-target-warning p {
  margin: 0.35rem 0 0;
  line-height: 1.5;
}

.target-warning-title {
  color: #fef3c7;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.empty-state {
  border: 1px dashed rgba(148, 163, 184, 0.28);
  border-radius: 8px;
  padding: 2rem;
  color: #94a3b8;
  background: rgba(15, 23, 42, 0.45);
}

.empty-title {
  color: #e5e7eb;
  font-size: 1rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.empty-hint {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.reports-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.report-list {
  display: grid;
  gap: 0.5rem;
}

.report-list-item {
  width: 100%;
  min-height: 72px;
  text-align: left;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.62);
  color: #dbeafe;
  padding: 0.7rem 0.8rem;
  cursor: pointer;
}

.report-list-item.active {
  border-color: rgba(96, 165, 250, 0.58);
  background: rgba(30, 64, 175, 0.24);
}

.report-list-title,
.report-list-meta {
  display: block;
}

.report-list-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #e5e7eb;
  margin-bottom: 0.35rem;
  overflow-wrap: anywhere;
}

.report-list-meta {
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.report-reader {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.52);
  padding: 1rem;
  min-width: 0;
}

.report-reader-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  margin-bottom: 1rem;
}

.report-eyebrow,
.report-date {
  color: #94a3b8;
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

.report-title {
  color: #f8fafc;
  font-size: 1.15rem;
  line-height: 1.3;
  margin: 0.25rem 0 0;
  overflow-wrap: anywhere;
}

.report-date {
  white-space: nowrap;
}

.report-markdown {
  color: #dbeafe;
  font-size: 0.92rem;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.report-markdown :deep(h2),
.report-markdown :deep(h3),
.report-markdown :deep(h4) {
  color: #f8fafc;
  margin: 1rem 0 0.5rem;
  line-height: 1.25;
}

.report-markdown :deep(ul) {
  margin: 0.4rem 0 0.8rem;
  padding-left: 1.2rem;
}

.report-markdown :deep(code) {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 4px;
  background: rgba(2, 6, 23, 0.55);
  padding: 0.08rem 0.25rem;
}

@media (max-width: 760px) {
  .header-row,
  .report-reader-header {
    flex-direction: column;
  }

  .reports-layout {
    grid-template-columns: 1fr;
  }

  .report-date {
    white-space: normal;
  }
}
</style>
