import {
  defineComponent,
  h,
  type PropType,
} from 'vue';

export interface RichEvidenceTextPart {
  text: string;
  href?: string;
}

interface MentionLabelSource {
  evidence?: Array<{
    metadata?: Record<string, any>;
  }>;
  outcome?: Record<string, any>;
}

const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const TOKEN_RE = /!\[:Person\]\(([^)]+)\)|(https?:\/\/[^\s<>"'`]+)/gi;
const TRAILING_URL_PUNCTUATION_RE = /[.,;:!?，。；：！？、)\]}）】》"'”’]+$/;

export function collectEvidenceMentionLabels(
  source?: MentionLabelSource | null,
): Record<string, string> {
  const labels: Record<string, string> = {};
  if (!source) return labels;
  for (const item of source.evidence ?? []) {
    mergeMentionLabels(labels, item.metadata);
  }
  mergeMentionLabels(labels, source.outcome);
  return labels;
}

export function buildRichEvidenceTextParts(
  rawText: string,
  mentionLabels?: Record<string, string>,
): RichEvidenceTextPart[] {
  const text = String(rawText ?? '').replace(/<br\s*\/?>/gi, '\n');
  const parts: RichEvidenceTextPart[] = [];
  let cursor = 0;

  ANCHOR_RE.lastIndex = 0;
  for (const match of text.matchAll(ANCHOR_RE)) {
    const index = match.index ?? 0;
    appendPlainText(parts, text.slice(cursor, index), mentionLabels);

    const attrs = match[1] ?? '';
    const label = decodeHtmlEntities(stripHtmlTags(match[2] ?? ''));
    const href = normalizeSafeHref(extractHtmlAttribute(attrs, 'href'));
    if (href && label) {
      parts.push({ text: label, href });
    } else {
      appendPlainText(parts, label, mentionLabels);
    }

    cursor = index + match[0].length;
  }

  appendPlainText(parts, text.slice(cursor), mentionLabels);
  return mergeAdjacentTextParts(parts);
}

export const RichEvidenceText = defineComponent({
  name: 'RichEvidenceText',
  props: {
    text: {
      type: String,
      default: '',
    },
    mentionLabels: {
      type: Object as PropType<Record<string, string>>,
      default: () => ({}),
    },
  },
  setup(props) {
    return () =>
      h(
        'span',
        { class: 'rich-evidence-text' },
        buildRichEvidenceTextParts(props.text, props.mentionLabels).map(
          (part, index) =>
            part.href
              ? h(
                  'a',
                  {
                    key: index,
                    class: 'rich-evidence-link',
                    href: part.href,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  },
                  part.text,
                )
              : h('span', { key: index }, part.text),
        ),
      );
  },
});

function appendPlainText(
  parts: RichEvidenceTextPart[],
  rawText: string,
  mentionLabels?: Record<string, string>,
) {
  const text = decodeHtmlEntities(stripHtmlTags(rawText));
  if (!text) return;

  let cursor = 0;
  TOKEN_RE.lastIndex = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    appendText(parts, text.slice(cursor, index));

    const personId = match[1];
    if (personId) {
      appendText(parts, formatPersonMention(personId, mentionLabels));
      cursor = index + match[0].length;
      continue;
    }

    const urlMatch = match[2] ?? '';
    const { url, trailing } = splitUrlTrailingPunctuation(urlMatch);
    if (url) {
      parts.push({ text: url, href: url });
    }
    appendText(parts, trailing);
    cursor = index + urlMatch.length;
  }

  appendText(parts, text.slice(cursor));
}

function appendText(parts: RichEvidenceTextPart[], text: string) {
  if (!text) return;
  parts.push({ text });
}

function mergeAdjacentTextParts(
  parts: RichEvidenceTextPart[],
): RichEvidenceTextPart[] {
  const merged: RichEvidenceTextPart[] = [];
  for (const part of parts) {
    const previous = merged[merged.length - 1];
    if (previous && !previous.href && !part.href) {
      previous.text += part.text;
    } else {
      merged.push({ ...part });
    }
  }
  return merged;
}

function formatPersonMention(
  rawId: string,
  mentionLabels?: Record<string, string>,
): string {
  const id = rawId.trim();
  const label = normalizeMentionLabel(mentionLabels?.[id]);
  if (label) {
    return label.startsWith('@') ? label : `@${label}`;
  }
  return `@Person ${id}`;
}

function normalizeMentionLabel(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mergeMentionLabels(
  target: Record<string, string>,
  metadata?: Record<string, any>,
) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return;
  }
  const raw = metadata.mentionLabels;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return;
  }
  for (const [id, label] of Object.entries(raw)) {
    if (typeof label === 'string' && label.trim()) {
      target[id] = label.trim();
    }
  }
}

function splitUrlTrailingPunctuation(rawUrl: string): {
  url: string;
  trailing: string;
} {
  const trailing = rawUrl.match(TRAILING_URL_PUNCTUATION_RE)?.[0] ?? '';
  const url = trailing ? rawUrl.slice(0, -trailing.length) : rawUrl;
  return { url, trailing };
}

function normalizeSafeHref(value: string): string {
  const href = decodeHtmlEntities(value.trim());
  if (/^(https?:\/\/|mailto:)/i.test(href)) {
    return href;
  }
  return '';
}

function extractHtmlAttribute(attrs: string, name: string): string {
  const match = attrs.match(
    new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '');
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity, body: string) => {
      const normalized = body.toLowerCase();
      if (normalized === 'amp') return '&';
      if (normalized === 'lt') return '<';
      if (normalized === 'gt') return '>';
      if (normalized === 'quot') return '"';
      if (normalized === 'apos') return "'";
      if (normalized === 'nbsp') return ' ';
      if (normalized.startsWith('#x')) {
        return decodeCodePoint(parseInt(normalized.slice(2), 16), entity);
      }
      if (normalized.startsWith('#')) {
        return decodeCodePoint(parseInt(normalized.slice(1), 10), entity);
      }
      return entity;
    },
  );
}

function decodeCodePoint(value: number, fallback: string): string {
  if (!Number.isFinite(value)) return fallback;
  try {
    return String.fromCodePoint(value);
  } catch {
    return fallback;
  }
}
