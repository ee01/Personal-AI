<template>
  <div class="dream-insights-container">
    <div class="header">
      <h2>🌙 梦境重放</h2>
      <p class="header-desc">AI 在系统空闲时回放长期记忆并生成新的联想与线索</p>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>正在加载梦境重放...</p>
    </div>

    <div v-else-if="dreams.length === 0" class="empty-state">
      <div class="empty-icon">🌙</div>
      <p>暂无梦境重放内容</p>
      <p class="empty-hint">梦境重放会在系统空闲时自动生成</p>
    </div>

    <div v-else class="dream-list">
      <div
        v-for="dream in dreams"
        :key="dream.filename"
        class="dream-card"
        :class="{ expanded: dream.expanded }"
        @click="toggleExpand(dream)"
      >
        <div class="dream-header">
          <div class="dream-title-row">
            <h3 class="dream-title">{{ dream.title }}</h3>
            <span class="dream-date">{{ dream.date }}</span>
          </div>
          <div class="expand-indicator">{{ dream.expanded ? '▲' : '▼' }}</div>
        </div>
        <div class="dream-preview" v-if="!dream.expanded">
          {{ dream.preview }}
        </div>
        <div class="dream-content" v-if="dream.expanded">
          <div class="dream-markdown" v-html="renderMarkdown(dream.content)"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getMemoryServiceClient } from '../../services/MemoryServiceClient';

interface DreamItem {
  filename: string;
  title: string;
  date: string;
  preview: string;
  content: string;
  expanded: boolean;
}

const loading = ref(true);
const dreams = ref<DreamItem[]>([]);

function extractDate(filename: string): string {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function extractTitle(content: string, filename: string): string {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  // Fallback: use filename without extension
  return filename.replace(/\.md$/, '').replace(/-/g, ' ');
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

onMounted(async () => {
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
        items.push({
          filename,
          title: extractTitle(content!, filename),
          date: extractDate(filename),
          preview: truncate(content!, 300),
          content: content!,
          expanded: false,
        });
      }
    }

    dreams.value = items;
  } catch (error) {
    console.error('Failed to load dream insights:', error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.dream-insights-container {
  animation: fadeInUp 0.6s ease-out;
  max-width: 900px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

.header h2 {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #a78bfa, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.5rem;
}

.header-desc {
  color: #94a3b8;
  font-size: 0.875rem;
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #94a3b8;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
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
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.dream-card:hover {
  border-color: rgba(167, 139, 250, 0.3);
  box-shadow: 0 4px 24px rgba(167, 139, 250, 0.08);
  transform: translateY(-1px);
}

.dream-card.expanded {
  border-color: rgba(167, 139, 250, 0.4);
  background: rgba(42, 42, 62, 0.95);
}

.dream-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
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

.dream-date {
  font-size: 0.75rem;
  color: #64748b;
  background: rgba(100, 116, 139, 0.15);
  padding: 0.2rem 0.6rem;
  border-radius: 0.5rem;
  white-space: nowrap;
}

.expand-indicator {
  color: #64748b;
  font-size: 0.75rem;
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.dream-preview {
  margin-top: 0.75rem;
  color: #94a3b8;
  font-size: 0.875rem;
  line-height: 1.6;
}

.dream-content {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
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
</style>
