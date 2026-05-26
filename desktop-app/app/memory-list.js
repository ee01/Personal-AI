import {
  formatDateTime,
  loadDesktopLanguage,
  t,
} from './i18n.js';

const PAGE_SIZE = 50;
const SOURCE_LABEL = {
  doubao: '豆包',
  chatgpt: 'ChatGPT',
};

const state = {
  source: 'all',
  query: '',
  items: [],
  total: 0,
  loading: false,
};

const els = {
  refresh: document.getElementById('memory-list-refresh'),
  filters: Array.from(document.querySelectorAll('.memory-list-filter')),
  query: document.getElementById('memory-list-query'),
  summary: document.getElementById('memory-list-summary'),
  list: document.getElementById('memory-list-items'),
  empty: document.getElementById('memory-list-empty'),
  loadMore: document.getElementById('memory-list-load-more'),
};

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function formatTime(iso) {
  if (!iso) return '';
  return formatDateTime(iso) || iso;
}

function getApi() {
  return typeof window !== 'undefined' ? window.explorerApi : null;
}

async function fetchPage({ append }) {
  const api = getApi();
  if (!api || typeof api.listMemories !== 'function') {
    els.summary.textContent = t('desktop.memoryList.apiUnavailable');
    return;
  }

  state.loading = true;
  els.loadMore.disabled = true;
  if (!append) {
    els.summary.textContent = t('desktop.memoryList.loading');
  }

  try {
    const result = await api.listMemories({
      source: state.source === 'all' ? undefined : state.source,
      query: state.query || undefined,
      limit: PAGE_SIZE,
      offset: append ? state.items.length : 0,
    });
    const items = Array.isArray(result?.items) ? result.items : [];
    state.items = append ? state.items.concat(items) : items;
    state.total = Number(result?.total ?? state.items.length);
    render();
  } catch (error) {
    console.error('memory-list fetch failed', error);
    els.summary.textContent = t('desktop.memoryList.fetchFailed', {
      message: error?.message || t('desktop.memoryList.unknownError'),
    });
    if (!append) {
      state.items = [];
      state.total = 0;
      els.list.innerHTML = '';
      els.empty.hidden = false;
    }
  } finally {
    state.loading = false;
    els.loadMore.disabled = false;
  }
}

function render() {
  els.list.innerHTML = '';
  if (state.items.length === 0) {
    els.empty.hidden = false;
    els.summary.textContent =
      state.query || state.source !== 'all'
        ? t('desktop.memoryList.noFiltered')
        : t('desktop.memoryList.noMemories');
    els.loadMore.hidden = true;
    return;
  }

  els.empty.hidden = true;
  for (const item of state.items) {
    els.list.appendChild(buildCard(item));
  }

  const sourceLabel =
    state.source === 'all'
      ? t('desktop.memoryList.sourceAll')
      : SOURCE_LABEL[state.source] || state.source;
  els.summary.textContent = state.query
    ? t('desktop.memoryList.summaryWithQuery', {
        total: state.total,
        source: sourceLabel,
        query: state.query,
      })
    : t('desktop.memoryList.summary', {
        total: state.total,
        source: sourceLabel,
      });

  els.loadMore.hidden = state.items.length >= state.total;
}

function buildCard(item) {
  const li = document.createElement('li');
  li.className = 'memory-list-card';

  const head = document.createElement('div');
  head.className = 'memory-list-card-head';

  const sourceTag = document.createElement('span');
  sourceTag.className = `memory-list-tag tag-source-${item.source}`;
  sourceTag.textContent = SOURCE_LABEL[item.source] || item.source;
  head.appendChild(sourceTag);

  const kindTag = document.createElement('span');
  kindTag.className = `memory-list-tag tag-kind-${item.kind}`;
  const kindLabelKey = `desktop.memoryList.kind.${item.kind}`;
  const kindLabel = t(kindLabelKey);
  kindTag.textContent = kindLabel === kindLabelKey ? item.kind : kindLabel;
  head.appendChild(kindTag);

  const time = document.createElement('span');
  time.textContent = formatTime(item.extractedAt);
  head.appendChild(time);

  li.appendChild(head);

  const text = document.createElement('p');
  text.className = 'memory-list-card-text';
  text.textContent = item.text || t('desktop.memoryList.emptyText');
  li.appendChild(text);

  if (item.sourceQuote && item.sourceQuote.trim()) {
    const quote = document.createElement('blockquote');
    quote.className = 'memory-list-card-quote';
    quote.textContent = item.sourceQuote.trim();
    li.appendChild(quote);
  }

  const meta = document.createElement('div');
  meta.className = 'memory-list-card-meta';
  if (item.conversationRef) {
    const ref = document.createElement('span');
    ref.textContent = t('desktop.memoryList.conversationRef', {
      ref: item.conversationRef,
    });
    meta.appendChild(ref);
  }
  if (item.ingestSource) {
    const ingest = document.createElement('span');
    ingest.textContent = t('desktop.memoryList.ingestSource', {
      source: item.ingestSource,
    });
    meta.appendChild(ingest);
  }
  if (meta.children.length > 0) {
    li.appendChild(meta);
  }

  return li;
}

function setActiveFilter(source) {
  state.source = source;
  for (const button of els.filters) {
    button.classList.toggle('is-active', button.dataset.source === source);
  }
  void fetchPage({ append: false });
}

const debouncedSearch = debounce(() => {
  state.query = (els.query.value || '').trim();
  void fetchPage({ append: false });
}, 200);

els.refresh.addEventListener('click', () => {
  void fetchPage({ append: false });
});

els.loadMore.addEventListener('click', () => {
  if (state.loading) return;
  void fetchPage({ append: true });
});

els.query.addEventListener('input', debouncedSearch);

for (const button of els.filters) {
  button.addEventListener('click', () => {
    if (state.loading) return;
    setActiveFilter(button.dataset.source);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  void loadDesktopLanguage(window.bridgeApi).then(() => {
    document.title = t('desktop.memoryList.titleTag');
    void fetchPage({ append: false });
  });
});
