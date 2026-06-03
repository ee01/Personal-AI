<template>
  <div class="dream-insights-container">
    <div class="header-row">
      <div>
        <h2 class="section-title">梦境重放</h2>
        <p class="section-subtitle">
          长期记忆回放生成的联想入口；新关系和风险先按线索复核。
        </p>
      </div>
      <router-link to="/reflection-threads" class="review-link">
        去自我反思复核
      </router-link>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载梦境重放...</p>
    </div>

    <template v-else>
      <div v-if="loadError" class="load-error">
        <div>
          <div class="load-error-title">梦境重放暂时不可用</div>
          <p>{{ loadError }}</p>
        </div>
        <button class="load-error-retry" @click="loadDreams()">重试</button>
      </div>

      <div v-if="dreams.length > 0" class="dream-overview">
        <div class="overview-metric">
          <span class="metric-label">梦境主题</span>
          <strong>{{ dreams.length }}</strong>
        </div>
        <div class="overview-metric">
          <span class="metric-label">洞察线索</span>
          <strong>{{ totalInsights }}</strong>
        </div>
        <div class="overview-metric risk">
          <span class="metric-label">待复核风险</span>
          <strong>{{ totalRisks }}</strong>
        </div>
        <div class="overview-metric relation">
          <span class="metric-label">新关系</span>
          <strong>{{ totalRelationships }}</strong>
        </div>
      </div>

      <div v-if="skippedFiles.length > 0" class="partial-warning">
        {{ skippedFiles.length }} 个梦境文件暂时无法读取；已先展示可用结果。
      </div>

      <div v-if="dreams.length === 0 && !loadError" class="empty-state">
        <div class="empty-title">暂无梦境重放内容</div>
        <p class="empty-hint">下一次长期记忆回放完成后会出现在这里。</p>
      </div>

      <div v-else-if="dreams.length > 0" class="dream-list">
        <article
          v-for="dream in dreams"
          :key="dream.filename"
          class="dream-card"
          :class="{ expanded: dream.expanded }"
        >
          <button
            class="dream-toggle"
            :aria-expanded="dream.expanded"
            @click="toggleExpand(dream)"
          >
            <div class="dream-header">
              <div class="dream-title-block">
                <div class="dream-title-row">
                  <div class="dream-title">{{ dream.title }}</div>
                  <span class="dream-date">{{ dream.date || '未知日期' }}</span>
                </div>
                <div class="dream-badges">
                  <span class="dream-badge">洞察 {{ dream.insights.length }}</span>
                  <span class="dream-badge risk"
                    >风险 {{ dream.risks.length }}</span
                  >
                  <span class="dream-badge relation"
                    >新关系 {{ dream.relationships.length }}</span
                  >
                </div>
                <div class="dream-source-row">
                  <span :title="`dreams/${dream.filename}`">
                    来源 dreams/{{ dream.filename }}
                  </span>
                  <span>低置信联想，需复核后使用</span>
                </div>
              </div>
              <span class="expand-indicator">{{
                dream.expanded ? '收起' : '展开'
              }}</span>
            </div>
            <div class="dream-preview" v-if="!dream.expanded">
              {{ dream.preview }}
            </div>
          </button>

          <div class="dream-brief" v-if="!dream.expanded">
            <div v-if="dream.risks.length > 0" class="brief-block risk">
              <div class="brief-label">优先复核</div>
              <ul>
                <li v-for="risk in visibleItems(dream.risks)" :key="risk">
                  {{ risk }}
                </li>
              </ul>
            </div>
            <div v-else-if="dream.insights.length > 0" class="brief-block">
              <div class="brief-label">主要洞察</div>
              <ul>
                <li v-for="insight in visibleItems(dream.insights)" :key="insight">
                  {{ insight }}
                </li>
              </ul>
            </div>
            <div v-if="dream.relationships.length > 0" class="relation-strip">
              <span>低置信度新关系</span>
              <span>{{ dream.relationships[0] }}</span>
            </div>
          </div>

          <div class="dream-content" v-if="dream.expanded">
            <div class="review-note">
              这是生成式回放产出的低置信度联想；进入行动前先核对原始记忆或对应反思线程。
            </div>
            <div class="dream-review-actions">
              <router-link
                class="dream-review-topic-link"
                :to="reflectionReviewRoute(dream)"
              >
                复核这个主题
              </router-link>
              <span>会带上当前梦境主题，方便定位对应反思线程。</span>
            </div>
            <div class="dream-markdown" v-html="renderMarkdown(dream.content)"></div>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { getMemoryServiceClient } from '../../services/MemoryServiceClient';

interface DreamItem {
  filename: string;
  title: string;
  date: string;
  preview: string;
  content: string;
  insights: string[];
  risks: string[];
  relationships: string[];
  expanded: boolean;
}

const loading = ref(true);
const loadError = ref('');
const dreams = ref<DreamItem[]>([]);
const skippedFiles = ref<string[]>([]);

const totalInsights = computed(() =>
  dreams.value.reduce((count, dream) => count + dream.insights.length, 0),
);
const totalRisks = computed(() =>
  dreams.value.reduce((count, dream) => count + dream.risks.length, 0),
);
const totalRelationships = computed(() =>
  dreams.value.reduce((count, dream) => count + dream.relationships.length, 0),
);

function extractDate(filename: string): string {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function extractTitle(content: string, filename: string): string {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim().replace(/^Dream:\s*/i, '');
  // Fallback: use filename without extension
  return filename.replace(/\.md$/, '').replace(/-/g, ' ');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSection(content: string, heading: string): string {
  const pattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, 'im');
  const match = pattern.exec(content);
  if (!match) return '';
  const body = content.slice(match.index + match[0].length);
  const nextHeadingIndex = body.search(/^##\s+/m);
  return (nextHeadingIndex >= 0 ? body.slice(0, nextHeadingIndex) : body).trim();
}

function extractListItems(content: string, heading: string): string[] {
  const section = extractSection(content, heading);
  if (!section) return [];
  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => cleanInlineMarkdown(line.slice(2)))
    .filter((line) => line.length > 0 && line.toLowerCase() !== 'none');
}

function truncate(text: string, maxLen: number): string {
  // Strip markdown headings and extra whitespace for preview
  const plain = text
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen) + '...';
}

function visibleItems(items: string[]): string[] {
  return items.slice(0, 2);
}

function renderMarkdown(md: string): string {
  // Simple markdown to HTML conversion for display
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

function toggleExpand(dream: DreamItem) {
  dream.expanded = !dream.expanded;
}

function reflectionReviewRoute(dream: DreamItem) {
  return {
    path: '/reflection-threads',
    query: {
      status: 'all',
      source: 'dream',
      search: dream.title,
    },
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return '无法连接 Memory Service 或读取梦境文件。';
}

async function loadDreams() {
  loading.value = true;
  loadError.value = '';
  skippedFiles.value = [];
  dreams.value = [];

  try {
    const client = getMemoryServiceClient();
    const files = await client.listUserFiles('dreams');

    // Sort by date descending (latest first)
    const sorted = [...files].sort((a, b) => {
      const dateA = extractDate(a);
      const dateB = extractDate(b);
      return dateB.localeCompare(dateA);
    });

    // Limit to 10 most recent
    const recent = sorted.slice(0, 10);

    // Fetch content for each file
    const items: DreamItem[] = [];
    const results = await Promise.allSettled(
      recent.map(async (filename) => {
        const content = await client.readUserFile('dreams', filename);
        return { filename, content };
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.content !== null) {
        const { filename, content } = result.value;
        const narrative = extractSection(content!, 'Narrative');
        items.push({
          filename,
          title: extractTitle(content!, filename),
          date: extractDate(filename),
          preview: truncate(narrative || content!, 300),
          content: content!,
          insights: extractListItems(content!, 'Insights'),
          risks: extractListItems(content!, 'Risks'),
          relationships: extractListItems(content!, 'Discovered Relationships'),
          expanded: false,
        });
      } else if (result.status === 'fulfilled') {
        skippedFiles.value.push(result.value.filename);
      } else {
        skippedFiles.value.push('unknown');
      }
    }

    dreams.value = items;
  } catch (error) {
    console.error('Failed to load dream insights:', error);
    loadError.value = errorMessage(error);
  } finally {
    loading.value = false;
  }
}

onMounted(loadDreams);
</script>

<style scoped>
.dream-insights-container {
  animation: fadeInUp 0.6s ease-out;
  max-width: 900px;
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

.review-link,
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

.review-link:hover,
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
  border: 2px solid rgba(167, 139, 250, 0.3);
  border-top: 2px solid #a78bfa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

.load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border: 1px solid rgba(248, 113, 113, 0.28);
  border-radius: 8px;
  background: rgba(127, 29, 29, 0.18);
  color: #fecaca;
  padding: 1rem;
  margin-bottom: 1rem;
}

.load-error-title {
  color: #fee2e2;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.dream-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.overview-metric {
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.55);
  padding: 0.85rem;
}

.metric-label {
  display: block;
  color: #94a3b8;
  font-size: 0.75rem;
  margin-bottom: 0.35rem;
}

.overview-metric strong {
  color: #e5e7eb;
  font-size: 1.35rem;
}

.overview-metric.risk strong {
  color: #fca5a5;
}

.overview-metric.relation strong {
  color: #6ee7b7;
}

.partial-warning {
  border: 1px solid rgba(251, 191, 36, 0.26);
  border-radius: 8px;
  background: rgba(120, 53, 15, 0.18);
  color: #fde68a;
  padding: 0.75rem 0.9rem;
  margin-bottom: 1rem;
  font-size: 0.82rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #94a3b8;
  text-align: center;
}

.empty-title {
  color: #e5e7eb;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.empty-hint {
  font-size: 0.875rem;
  color: #64748b;
  margin-top: 0.5rem;
}

.dream-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dream-card {
  background: rgba(42, 42, 62, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 8px;
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
  backdrop-filter: blur(10px);
}

.dream-card:hover {
  border-color: rgba(96, 165, 250, 0.32);
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.25);
}

.dream-card.expanded {
  border-color: rgba(96, 165, 250, 0.42);
  background: rgba(42, 42, 62, 0.95);
}

.dream-toggle {
  width: 100%;
  border: 0;
  background: transparent;
  text-align: left;
  padding: 1.15rem 1.35rem;
  cursor: pointer;
}

.dream-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.dream-title-block {
  flex: 1;
  min-width: 0;
}

.dream-title-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  flex-wrap: wrap;
}

.dream-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #e0e0e0;
}

.dream-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.65rem;
}

.dream-source-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.55rem;
  color: #94a3b8;
  font-size: 0.74rem;
  line-height: 1.4;
}

.dream-source-row span:first-child {
  color: #cbd5e1;
}

.dream-badge {
  border: 1px solid rgba(96, 165, 250, 0.18);
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
  color: #bfdbfe;
  padding: 0.18rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
}

.dream-badge.risk {
  border-color: rgba(248, 113, 113, 0.22);
  background: rgba(127, 29, 29, 0.18);
  color: #fecaca;
}

.dream-badge.relation {
  border-color: rgba(45, 212, 191, 0.2);
  background: rgba(20, 83, 45, 0.16);
  color: #99f6e4;
}

.dream-date {
  font-size: 0.75rem;
  color: #64748b;
  background: rgba(100, 116, 139, 0.15);
  padding: 0.2rem 0.6rem;
  border-radius: 0.5rem;
  white-space: nowrap;
}

.expand-indicator {
  color: #93c5fd;
  font-size: 0.75rem;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.dream-preview {
  margin-top: 0.75rem;
  color: #94a3b8;
  font-size: 0.875rem;
  line-height: 1.6;
}

.dream-brief {
  padding: 0 1.35rem 1.1rem;
}

.brief-block {
  border-left: 3px solid rgba(96, 165, 250, 0.5);
  background: rgba(15, 23, 42, 0.38);
  padding: 0.7rem 0.85rem;
}

.brief-block.risk {
  border-left-color: rgba(248, 113, 113, 0.72);
  background: rgba(127, 29, 29, 0.12);
}

.brief-label {
  color: #e5e7eb;
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 0.35rem;
}

.brief-block ul {
  margin: 0;
  padding-left: 1rem;
  color: #cbd5e1;
  font-size: 0.82rem;
  line-height: 1.55;
}

.relation-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.65rem;
  color: #99f6e4;
  font-size: 0.78rem;
}

.relation-strip span:first-child {
  color: #6ee7b7;
  font-weight: 700;
}

.dream-content {
  margin: 0 1.35rem 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.review-note {
  border: 1px solid rgba(251, 191, 36, 0.22);
  border-radius: 8px;
  background: rgba(120, 53, 15, 0.14);
  color: #fde68a;
  padding: 0.65rem 0.75rem;
  margin-bottom: 0.85rem;
  font-size: 0.8rem;
  line-height: 1.5;
}

.dream-review-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-bottom: 0.9rem;
  color: #94a3b8;
  font-size: 0.8rem;
}

.dream-review-topic-link {
  border: 1px solid rgba(45, 212, 191, 0.26);
  border-radius: 8px;
  background: rgba(20, 83, 45, 0.16);
  color: #99f6e4;
  padding: 0.48rem 0.72rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
}

.dream-review-topic-link:hover {
  border-color: rgba(45, 212, 191, 0.5);
  color: #ccfbf1;
}

.dream-markdown {
  color: #cbd5e1;
  font-size: 0.875rem;
  line-height: 1.7;
}

.dream-markdown :deep(h2) {
  font-size: 1.2rem;
  font-weight: 600;
  color: #a78bfa;
  margin: 1rem 0 0.5rem;
}

.dream-markdown :deep(h3) {
  font-size: 1.05rem;
  font-weight: 600;
  color: #60a5fa;
  margin: 0.75rem 0 0.5rem;
}

.dream-markdown :deep(h4) {
  font-size: 0.95rem;
  font-weight: 600;
  color: #93c5fd;
  margin: 0.5rem 0 0.25rem;
}

.dream-markdown :deep(strong) {
  color: #e0e0e0;
  font-weight: 600;
}

.dream-markdown :deep(em) {
  color: #94a3b8;
  font-style: italic;
}

.dream-markdown :deep(code) {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  padding: 0.1rem 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.8rem;
}

.dream-markdown :deep(ul) {
  padding-left: 1.25rem;
  margin: 0.5rem 0;
}

.dream-markdown :deep(li) {
  padding: 0.2rem 0;
  color: #cbd5e1;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .header-row {
    flex-direction: column;
  }

  .review-link {
    width: 100%;
    text-align: center;
  }

  .dream-overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
