export const ASK_RESUME_STORAGE_KEY = 'desktop-app.quick-ask.resume.v1';
export const ASK_RESUME_TTL_MS = 24 * 60 * 60 * 1000;

const SNAPSHOT_VERSION = 1;
const MAX_QUESTION_LENGTH = 280;
const MAX_ANSWER_LENGTH = 720;
const MAX_TOPIC_LENGTH = 160;
const MAX_EVIDENCE_REFS = 5;
const MAX_CANDIDATES = 3;

const SECRET_VALUE_PATTERN =
  /((?:api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|password|passwd|cookie|secret)\s*[:=]\s*)[^\s,;]+/giu;
const BEARER_PATTERN = /\bbearer\s+[a-z0-9._~+/=-]{12,}/giu;
const OPENAI_KEY_PATTERN = /\bsk-[a-z0-9_-]{12,}/giu;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_CANDIDATE_PATTERN = /(?:\+?\d[\d .()-]{8,}\d)/gu;
const URL_PATTERN = /https?:\/\/[^\s<>()]+/giu;

function normalizeInlineText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function clipText(value, limit) {
  const text = normalizeInlineText(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function stripUrlSecrets(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hadSecrets = Boolean(url.search || url.hash || url.username || url.password);
    url.search = '';
    url.hash = '';
    url.username = '';
    url.password = '';
    return {
      value: url.toString(),
      redacted: hadSecrets,
    };
  } catch {
    return { value: '[链接已隐藏]', redacted: true };
  }
}

export function redactAskResumeText(value, limit = MAX_ANSWER_LENGTH) {
  let text = normalizeInlineText(value);
  let redacted = false;
  const replace = (pattern, replacement) => {
    text = text.replace(pattern, (...args) => {
      redacted = true;
      return typeof replacement === 'function'
        ? replacement(...args)
        : replacement;
    });
  };

  replace(SECRET_VALUE_PATTERN, (_match, prefix) => `${prefix}[已隐藏]`);
  replace(BEARER_PATTERN, 'Bearer [已隐藏]');
  replace(OPENAI_KEY_PATTERN, '[密钥已隐藏]');
  replace(EMAIL_PATTERN, '[邮箱已隐藏]');
  replace(PHONE_CANDIDATE_PATTERN, (candidate) => {
    const digitCount = candidate.replace(/\D/gu, '').length;
    return digitCount >= 8 ? '[电话已隐藏]' : candidate;
  });
  text = text.replace(URL_PATTERN, (rawUrl) => {
    const stripped = stripUrlSecrets(rawUrl);
    redacted = redacted || stripped.redacted;
    return stripped.value;
  });

  const clipped = clipText(text, limit);
  if (clipped !== text) redacted = true;
  return { text: clipped, redacted };
}

function normalizeDate(value) {
  const timestamp = Date.parse(String(value ?? ''));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}

function normalizeSourceType(value) {
  const normalized = normalizeInlineText(value).toLowerCase();
  if (normalized.includes('jira')) return 'jira';
  if (normalized.includes('browser') || normalized.includes('web')) {
    return 'browser';
  }
  if (normalized.includes('message') || normalized.includes('glip')) {
    return 'message';
  }
  if (normalized.includes('document') || normalized.includes('file')) {
    return 'document';
  }
  if (normalized.includes('memory')) return 'memory';
  return 'unknown';
}

function buildEvidenceRefs(evidence) {
  if (!Array.isArray(evidence)) return [];
  return evidence.slice(0, MAX_EVIDENCE_REFS).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const id = clipText(item.id || `${item.type || 'evidence'}:${index + 1}`, 160);
    const titleResult = redactAskResumeText(
      item.sourceTitle ||
        item.displayTitle ||
        item.metadata?.sourceTitle ||
        item.metadata?.groupName ||
        item.source ||
        item.type ||
        `证据 ${index + 1}`,
      180,
    );
    if (!id || !titleResult.text) return [];
    const timestamp = normalizeDate(
      typeof item.timestamp === 'number'
        ? item.timestamp * 1000
        : item.timestamp,
    );
    return [
      {
        id,
        title: titleResult.text,
        sourceType: normalizeSourceType(item.type || item.source),
        ...(timestamp ? { timestamp } : {}),
      },
    ];
  });
}

function buildPendingCandidates(contextMatch) {
  if (contextMatch?.state !== 'ambiguous') return [];
  if (!Array.isArray(contextMatch.candidates)) return [];
  return contextMatch.candidates
    .slice(0, MAX_CANDIDATES)
    .flatMap((candidate, index) => {
      const label = redactAskResumeText(candidate?.label, MAX_TOPIC_LENGTH).text;
      if (!label) return [];
      const reasons = Array.isArray(candidate?.reasons)
        ? candidate.reasons.slice(0, 2).map(normalizeInlineText).filter(Boolean)
        : [];
      return [
        {
          id: clipText(candidate?.id || String(index + 1), 80),
          label,
          reason: clipText(reasons.join('、') || '近期话题候选', 180),
        },
      ];
    });
}

function normalizeSnapshotObject(value) {
  if (!value || typeof value !== 'object') return null;
  if (
    value.version !== SNAPSHOT_VERSION ||
    value.surface !== 'quick_ask' ||
    value.localOnly !== true
  ) {
    return null;
  }

  const createdAt = normalizeDate(value.createdAt);
  const updatedAt = normalizeDate(value.updatedAt);
  const expiresAt = normalizeDate(value.expiresAt);
  const question = redactAskResumeText(
    value.lastUserMessage?.textPreview,
    MAX_QUESTION_LENGTH,
  );
  if (!createdAt || !updatedAt || !expiresAt || !question.text) return null;

  const answerSummary = redactAskResumeText(
    value.lastAnswer?.summary,
    MAX_ANSWER_LENGTH,
  );
  const topicTitle = redactAskResumeText(
    value.topic?.title,
    MAX_TOPIC_LENGTH,
  ).text;

  return {
    version: SNAPSHOT_VERSION,
    surface: 'quick_ask',
    createdAt,
    updatedAt,
    expiresAt,
    localOnly: true,
    ...(topicTitle
      ? {
          topic: {
            ...(value.topic?.id
              ? { id: clipText(value.topic.id, 120) }
              : {}),
            title: topicTitle,
            ...(Number.isFinite(value.topic?.confidence)
              ? { confidence: Number(value.topic.confidence) }
              : {}),
          },
        }
      : {}),
    lastUserMessage: {
      textPreview: question.text,
      redacted: Boolean(value.lastUserMessage?.redacted || question.redacted),
    },
    ...(answerSummary.text
      ? {
          lastAnswer: {
            summary: answerSummary.text,
            status:
              value.lastAnswer?.status === 'needs_topic'
                ? 'needs_topic'
                : 'answered',
          },
        }
      : {}),
    evidenceRefs: Array.isArray(value.evidenceRefs)
      ? value.evidenceRefs.slice(0, MAX_EVIDENCE_REFS).flatMap((item) => {
          const id = clipText(item?.id, 160);
          const title = redactAskResumeText(item?.title, 180).text;
          if (!id || !title) return [];
          return [
            {
              id,
              title,
              sourceType: normalizeSourceType(item?.sourceType),
              ...(normalizeDate(item?.timestamp)
                ? { timestamp: normalizeDate(item.timestamp) }
                : {}),
            },
          ];
        })
      : [],
    pendingCandidates: Array.isArray(value.pendingCandidates)
      ? value.pendingCandidates.slice(0, MAX_CANDIDATES).flatMap((item, index) => {
          const label = redactAskResumeText(item?.label, MAX_TOPIC_LENGTH).text;
          if (!label) return [];
          return [
            {
              id: clipText(item?.id || String(index + 1), 80),
              label,
              reason: clipText(item?.reason || '近期话题候选', 180),
            },
          ];
        })
      : [],
    riskFlags: Array.isArray(value.riskFlags)
      ? value.riskFlags
          .filter((flag) =>
            ['sensitive', 'stale', 'long_transcript_redacted'].includes(flag),
          )
          .slice(0, 3)
      : [],
  };
}

export function createAskResumeSnapshot({ query, result, now = Date.now() }) {
  const question = redactAskResumeText(query, MAX_QUESTION_LENGTH);
  const answer = redactAskResumeText(result?.answer, MAX_ANSWER_LENGTH);
  if (!question.text || !answer.text) return null;

  const contextMatch = result?.contextMatch;
  const selectedTopic = contextMatch?.selectedTopic;
  const topicTitle = redactAskResumeText(
    selectedTopic?.label,
    MAX_TOPIC_LENGTH,
  ).text;
  const pendingCandidates = buildPendingCandidates(contextMatch);
  const createdAt = new Date(now).toISOString();
  const riskFlags = [];
  if (question.redacted || answer.redacted) riskFlags.push('sensitive');
  if (answer.redacted) riskFlags.push('long_transcript_redacted');

  return normalizeSnapshotObject({
    version: SNAPSHOT_VERSION,
    surface: 'quick_ask',
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(now + ASK_RESUME_TTL_MS).toISOString(),
    localOnly: true,
    ...(topicTitle
      ? {
          topic: {
            ...(selectedTopic?.id ? { id: selectedTopic.id } : {}),
            title: topicTitle,
            ...(Number.isFinite(selectedTopic?.score)
              ? { confidence: selectedTopic.score }
              : {}),
          },
        }
      : {}),
    lastUserMessage: {
      textPreview: question.text,
      redacted: question.redacted,
    },
    lastAnswer: {
      summary: answer.text,
      status: pendingCandidates.length ? 'needs_topic' : 'answered',
    },
    evidenceRefs: buildEvidenceRefs(result?.evidence),
    pendingCandidates,
    riskFlags,
  });
}

export function loadAskResumeSnapshot(
  storage = window.localStorage,
  now = Date.now(),
) {
  try {
    const raw = storage.getItem(ASK_RESUME_STORAGE_KEY);
    if (!raw) return null;
    const snapshot = normalizeSnapshotObject(JSON.parse(raw));
    if (!snapshot || Date.parse(snapshot.expiresAt) <= now) {
      storage.removeItem(ASK_RESUME_STORAGE_KEY);
      return null;
    }
    return snapshot;
  } catch {
    try {
      storage.removeItem(ASK_RESUME_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
    return null;
  }
}

export function saveAskResumeSnapshot(snapshot, storage = window.localStorage) {
  const normalized = normalizeSnapshotObject(snapshot);
  if (!normalized) return null;
  try {
    storage.setItem(ASK_RESUME_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
}

export function clearAskResumeSnapshot(storage = window.localStorage) {
  try {
    storage.removeItem(ASK_RESUME_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function toAskResumeContextHints(snapshot, selectedTopicTitle = '') {
  const normalized = normalizeSnapshotObject(snapshot);
  if (!normalized) return null;
  const selectedTopic = redactAskResumeText(
    selectedTopicTitle || normalized.topic?.title,
    MAX_TOPIC_LENGTH,
  ).text;
  return {
    source: 'local_ask_resume_snapshot',
    localOnly: true,
    updatedAt: normalized.updatedAt,
    ...(selectedTopic ? { topicTitle: selectedTopic } : {}),
    previousQuestion: normalized.lastUserMessage.textPreview,
    ...(normalized.lastAnswer?.summary
      ? { previousAnswerSummary: normalized.lastAnswer.summary }
      : {}),
    evidenceRefs: normalized.evidenceRefs.map((item) => item.id),
  };
}
