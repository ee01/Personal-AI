/**
 * Parse Personal AI agent result envelopes from model output.
 * Accepts a JSON envelope, JSON inside markdown fences, or a conservative
 * markdown receipt when the model ignored the system prompt format.
 */

import type { AgentResultEnvelope, AgentRunStatus } from './AgentExecutor.js';
import {
  detectTaskReceiptHints,
  isGenericTargetSystem,
} from './agentResultPrompt.js';
import {
  gradeAgentResultEvidence,
  normalizeAgentResultArtifacts,
  readAgentTaskOutcome,
  type AgentEvidenceGrade,
  type AgentResultArtifact,
} from './agentResultContract.js';

const ENVELOPE_STATUSES = new Set([
  'success',
  'succeeded',
  'ok',
  'capability_missing',
  'auth_error',
  'need_human_decision',
  'timeout',
  'cancelled',
  'canceled',
  'running',
  'input_required',
  'error',
  'failed',
]);

const JIRA_KEY_RE = /\b[A-Z][A-Z0-9]{1,19}-\d+\b/g;
const URL_RE = /\bhttps?:\/\/[^\s)\]>'"]+/gi;

const WRITE_VERIFICATION_RE =
  /rest\s*api|jira\s*rest|jql|复查|回读|readback|verified|verification|更新为|已通过|customfield|put\s+https?:\/\/|patch\s+https?:\/\//i;
const READ_OBSERVATION_RE =
  /状态|负责人|assignee|observedFields/i;
const SUCCESS_CLAIM_RE =
  /已更新|已同步|已检查|共更新|全部已|已完成|复查结果为\s*0|successfully updated|\bupdated\b|\bsynced\b/i;
const FAILURE_CLAIM_RE =
  /失败|无法完成|没有权限|权限不足|未配置|capability_missing|auth_error|permission denied|timed out|超时/i;

export type ParseAgentResultOptions = {
  targetSystem?: string;
  mode?: 'read' | 'write';
  task?: string;
  emptySummary?: string;
};

export function mapAgentResultStatus(status: string): AgentRunStatus {
  switch (String(status || '').trim().toLowerCase()) {
    case 'success':
    case 'succeeded':
    case 'ok':
      return 'succeeded';
    case 'capability_missing':
      return 'capability_missing';
    case 'auth_error':
      return 'auth_error';
    case 'need_human_decision':
      return 'need_human_decision';
    case 'timeout':
      return 'timeout';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    case 'running':
      return 'running';
    case 'input_required':
      return 'input_required';
    default:
      return 'failed';
  }
}

export function looksLikeAgentResultEnvelope(
  value: unknown,
): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const status = (value as Record<string, unknown>).status;
  return typeof status === 'string' && ENVELOPE_STATUSES.has(status.trim().toLowerCase());
}

export function extractAgentResultJson(
  raw: string,
): Record<string, unknown> | null {
  const text = String(raw || '').trim();
  if (!text) return null;

  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)(?:```|$)/gi)];
  for (let index = fenced.length - 1; index >= 0; index -= 1) {
    const parsed = parseJsonObjectOrRepair(fenced[index][1]);
    if (looksLikeAgentResultEnvelope(parsed) && !envelopeLooksTruncated(parsed, fenced[index][1])) {
      return parsed;
    }
  }

  const direct = parseJsonObjectOrRepair(text);
  if (looksLikeAgentResultEnvelope(direct) && !envelopeLooksTruncated(direct, text)) {
    return direct;
  }

  const located = findEnvelopeObject(text);
  if (located && !envelopeLooksTruncated(located, text)) {
    return located;
  }

  return recoverLooseAgentResultEnvelope(text);
}

/**
 * When the model prefixes a JSON envelope with prose (or truncates the JSON),
 * do not treat the mixed dump as the summary.
 */
export function extractSummaryFromMixedText(raw: string): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  const parsed = extractAgentResultJson(text);
  if (typeof parsed?.summary === 'string' && parsed.summary.trim()) {
    return parsed.summary.trim();
  }
  const envelopeStart = text.search(/\{\s*"status"\s*:/i);
  const before =
    envelopeStart > 0 ? text.slice(0, envelopeStart).trim() : '';
  if (
    before &&
    before.length <= 500 &&
    !/"artifacts"\s*:/.test(before) &&
    !before.includes('{')
  ) {
    return before;
  }
  const match = text.match(/"summary"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (match) {
    try {
      const decoded = JSON.parse(`"${match[1]}"`);
      if (typeof decoded === 'string' && decoded.trim()) return decoded.trim();
    } catch {
      if (match[1].trim()) return match[1].trim();
    }
  }
  const firstLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('{') && !line.startsWith('"status"'));
  return (firstLine || text).slice(0, 500);
}

export function parseAgentResultEnvelope(
  text: string,
  options: ParseAgentResultOptions = {},
): AgentResultEnvelope {
  const raw = String(text || '');
  const parsed = extractAgentResultJson(raw);
  if (parsed) {
    const parts = resolveEnvelopeParts(raw, parsed);
    const proofOptions = {
      targetSystem: options.targetSystem,
      mode: options.mode,
      outcome: parts.outcome,
    };

    const grade =
      parts.status === 'succeeded'
        ? gradeAgentResultEvidence(parts.artifacts, proofOptions)
        : undefined;

    return {
      status: parts.status,
      summary: parts.summary,
      artifacts: parts.artifacts,
      outcome: parts.outcome,
      evidenceGrade: grade,
      transcript: typeof parsed.transcript === 'string' ? parsed.transcript : undefined,
      payload: {
        ...parts.payload,
        ...(parts.outcome ? { outcome: parts.outcome } : {}),
        ...(grade ? { evidenceGrade: grade } : {}),
        ...(grade === 'reported' ? { artifactValidation: 'missing_verifiable_artifact' } : {}),
      },
    };
  }

  const recovered = recoverMarkdownReceipt(raw, options);
  if (recovered.status === 'succeeded') {
    return recovered;
  }
  // Only a stated inability to do the work is a failure here. Everything else
  // is a formatting miss, and the run still owes the user its output.
  if (recovered.payload?.recoveredFrom === 'markdown_failure_claim') {
    return recovered;
  }

  return buildUnparsedEnvelope(raw, options);
}

/**
 * The executor produced text but no shape we recognize. Keep the text as the
 * deliverable so evidence extraction, template filling and the explorer view
 * all have something to work with, rather than burying it in payload.rawText.
 */
function buildUnparsedEnvelope(
  raw: string,
  options: ParseAgentResultOptions,
): AgentResultEnvelope {
  const text = raw.trim();
  if (!text) {
    return {
      status: 'error',
      summary: options.emptySummary || '执行器没有返回任何输出',
      artifacts: [],
      payload: { rawText: raw, fallback: 'empty_executor_output' },
    };
  }

  const summary = extractSummaryFromMixedText(text).slice(0, 500) || text.slice(0, 500);
  return {
    status: 'succeeded',
    summary,
    artifacts: [
      {
        kind: 'note',
        title: '执行器原始输出',
        content: text.slice(0, 20_000),
        metadata: {
          ...(options.targetSystem ? { sourceSystem: options.targetSystem } : {}),
          evidenceGrade: 'unparsed',
        },
      },
    ],
    evidenceGrade: 'unparsed',
    payload: {
      rawText: text,
      evidenceGrade: 'unparsed' satisfies AgentEvidenceGrade,
      fallback: 'plain_text_deliverable',
    },
  };
}

function resolveEnvelopeParts(
  sourceText: string,
  parsed: Record<string, unknown>,
): {
  status: AgentRunStatus;
  summary: string;
  outcome?: ReturnType<typeof readAgentTaskOutcome>;
  artifacts: AgentResultArtifact[];
  payload: Record<string, unknown>;
} {
  const payload =
    parsed.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)
      ? (parsed.payload as Record<string, unknown>)
      : { raw: parsed };
  const rawRecord =
    payload.raw && typeof payload.raw === 'object' && !Array.isArray(payload.raw)
      ? (payload.raw as Record<string, unknown>)
      : parsed;

  let outcome = readAgentTaskOutcome(
    parsed.outcome ?? payload.outcome ?? rawRecord.outcome,
  );
  let artifacts = collectArtifactList(parsed, rawRecord, payload);
  let summary =
    typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : typeof rawRecord.summary === 'string' && rawRecord.summary.trim()
        ? rawRecord.summary.trim()
        : extractSummaryFromMixedText(sourceText);

  if (!outcome || envelopeLooksTruncated(parsed, sourceText)) {
    const loose = recoverLooseAgentResultEnvelope(sourceText);
    if (loose) {
      outcome = readAgentTaskOutcome(loose.outcome) ?? outcome;
      if (!artifacts.length && Array.isArray(loose.artifacts)) {
        artifacts = loose.artifacts as AgentResultArtifact[];
      }
      if (!summary && typeof loose.summary === 'string') summary = loose.summary;
      payload.recoveredFrom = 'loose_envelope_parse';
    }
  }

  artifacts = normalizeAgentResultArtifacts(artifacts);
  const status = mapAgentResultStatus(String(parsed.status || rawRecord.status || 'error'));

  return {
    status,
    summary,
    outcome,
    artifacts,
    payload,
  };
}

function collectArtifactList(
  parsed: Record<string, unknown>,
  rawRecord: Record<string, unknown>,
  payload: Record<string, unknown>,
): AgentResultArtifact[] {
  for (const candidate of [parsed.artifacts, rawRecord.artifacts, payload.artifacts]) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate as AgentResultArtifact[];
    }
  }
  return [];
}

export function recoverMarkdownReceipt(
  text: string,
  options: ParseAgentResultOptions = {},
  summaryOverride?: string,
): AgentResultEnvelope {
  const raw = String(text || '').trim();
  if (!raw) {
    return {
      status: 'error',
      summary: options.emptySummary || '空结果',
      artifacts: [],
    };
  }

  if (FAILURE_CLAIM_RE.test(raw) && !SUCCESS_CLAIM_RE.test(raw)) {
    return {
      status: 'error',
      summary: extractSummaryFromMixedText(raw).slice(0, 500),
      artifacts: [],
      payload: { rawText: raw, recoveredFrom: 'markdown_failure_claim' },
    };
  }

  const hints = detectTaskReceiptHints(
    `${options.task || ''}\n${raw}`,
    options.targetSystem,
  );
  const entityKeys = uniqueMatches(raw, JIRA_KEY_RE);
  const urls = uniqueMatches(raw, URL_RE);
  const sourceSystem =
    hints.likelySourceSystem && !isGenericTargetSystem(hints.likelySourceSystem)
      ? hints.likelySourceSystem
      : entityKeys.length > 0
        ? 'jira'
        : urls.length > 0
          ? 'chrome'
          : undefined;

  const hasWriteProof = WRITE_VERIFICATION_RE.test(raw);
  const hasReadProof = READ_OBSERVATION_RE.test(raw);
  const hasSuccessClaim = SUCCESS_CLAIM_RE.test(raw);
  const mode = options.mode || (hasWriteProof ? 'write' : 'read');
  const entities =
    entityKeys.length > 0 ? entityKeys : urls.slice(0, 8);

  const canRecover =
    Boolean(sourceSystem) &&
    entities.length > 0 &&
    (mode === 'write'
      ? hasWriteProof && hasSuccessClaim
      : hasWriteProof || hasReadProof);

  if (!canRecover) {
    return {
      status: 'error',
      summary: extractSummaryFromMixedText(raw).slice(0, 500) || raw.slice(0, 500),
      artifacts: [],
      payload: {
        rawText: raw,
        fallback: 'plain_text_summary_without_verifiable_artifact',
      },
    };
  }

  const changedFields = inferChangedFields(raw, options.task);
  const observedFields = inferObservedFields(raw, mode, changedFields);
  const verification = hasWriteProof
    ? inferVerification(raw)
    : 'markdown_observation';
  const summary = (summaryOverride || extractSummaryFromMixedText(raw)).slice(
    0,
    500,
  );
  const artifacts: AgentResultArtifact[] = entities.map((entityKey) => ({
    kind: sourceSystem === 'jira' ? 'jira_issue' : 'note',
    title: entityKey,
    content: excerptForEntity(raw, entityKey) || summary,
    metadata: {
      sourceSystem,
      entityKey,
      verification,
      ...(mode === 'write'
        ? {
            operation: 'update',
            ...(changedFields.length > 0 ? { changedFields } : {}),
          }
        : {}),
      ...(observedFields.length > 0 ? { observedFields } : {}),
    },
  }));

  const grade = gradeAgentResultEvidence(artifacts, options);
  return {
    status: 'succeeded',
    summary,
    artifacts,
    evidenceGrade: grade,
    payload: {
      rawText: raw,
      recoveredFrom: 'markdown_receipt',
      evidenceGrade: grade,
      ...(grade === 'reported' ? { artifactValidation: 'missing_verifiable_artifact' } : {}),
    },
  };
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* continue */
  }
  return null;
}

function parseJsonObjectOrRepair(raw: string): Record<string, unknown> | null {
  const direct = parseJsonObject(raw);
  if (direct) return direct;
  const repaired = repairJsonCandidate(raw);
  return repaired ? parseJsonObject(repaired) : null;
}

function trimTrailingJsonNoise(raw: string): string {
  return raw
    .replace(/(?:```)+\s*$/g, '')
    .replace(/[,\s:]+$/g, '')
    .trimEnd();
}

function closeOpenJsonStructures(raw: string): string {
  let candidate = trimTrailingJsonNoise(raw);
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of candidate) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      if (inString) escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{' || char === '[') {
      stack.push(char);
      continue;
    }
    if (char === '}' && stack[stack.length - 1] === '{') {
      stack.pop();
      continue;
    }
    if (char === ']' && stack[stack.length - 1] === '[') {
      stack.pop();
    }
  }

  if (escaped) candidate = candidate.slice(0, -1);
  if (inString) candidate += '"';
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    candidate += stack[index] === '{' ? '}' : ']';
  }
  return candidate;
}

function repairJsonCandidate(raw: string): string | undefined {
  const cleaned = raw.trim();
  if (!cleaned) return undefined;
  const direct = closeOpenJsonStructures(cleaned);
  if (parseJsonObject(direct)) return direct;

  let candidate = cleaned;
  for (let attempt = 0; attempt < 24 && candidate.length > 0; attempt += 1) {
    const nextCut = Math.max(
      candidate.lastIndexOf('\n'),
      candidate.lastIndexOf(','),
      candidate.lastIndexOf('{'),
      candidate.lastIndexOf('['),
    );
    if (nextCut <= 0) break;
    candidate = candidate.slice(0, nextCut).trimEnd();
    const repaired = closeOpenJsonStructures(candidate);
    if (parseJsonObject(repaired)) return repaired;
  }
  return undefined;
}

function findEnvelopeObject(text: string): Record<string, unknown> | null {
  let last: Record<string, unknown> | null = null;
  const statusPattern = /\{\s*"status"\s*:/gi;
  let match: RegExpExecArray | null;
  while ((match = statusPattern.exec(text))) {
    const slice = text.slice(match.index);
    const parsed = tryParsePrefixObject(slice) ?? parseJsonObjectOrRepair(slice);
    if (looksLikeAgentResultEnvelope(parsed)) {
      last = parsed;
    }
  }
  return last;
}

/**
 * Models often emit almost-valid JSON with unescaped `"` inside summary/content.
 * When strict parsing stops early but an outcome block is still present, recover
 * the closed outcome object and use the prose above the JSON as summary.
 */
function recoverLooseAgentResultEnvelope(text: string): Record<string, unknown> | null {
  const statusMatch = text.match(/\{\s*"status"\s*:\s*"(success|succeeded|ok)"/i);
  if (!statusMatch) return null;

  const outcomeMatch = text.match(/"outcome"\s*:\s*(\{[^{}]*\})/);
  if (!outcomeMatch) return null;
  const outcome = parseJsonObject(outcomeMatch[1]);
  if (!readAgentTaskOutcome(outcome)) return null;

  const summary = summaryFromProseBeforeEnvelope(text);
  const artifacts = recoverLooseArtifacts(text);

  return {
    status: statusMatch[1],
    summary,
    outcome,
    artifacts,
    payload: { recoveredFrom: 'loose_envelope_parse' },
  };
}

function envelopeLooksTruncated(
  parsed: Record<string, unknown> | null,
  source: string,
): boolean {
  if (!parsed) return false;
  if (readAgentTaskOutcome(parsed.outcome)) return false;
  return /"outcome"\s*:\s*\{/.test(source);
}

function summaryFromProseBeforeEnvelope(text: string): string {
  const envelopeStart = text.search(/\{\s*"status"\s*:/i);
  const before = envelopeStart > 0 ? text.slice(0, envelopeStart).trim() : '';
  if (!before) return '';
  const lines = before
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^JSON 信封/.test(line));
  return lines[lines.length - 1] || before;
}

function recoverLooseArtifacts(text: string): AgentResultArtifact[] {
  const start = text.search(/"artifacts"\s*:\s*\[/i);
  if (start < 0) return [];
  const slice = text.slice(start).replace(/^"artifacts"\s*:\s*/i, '');
  const arrayStart = slice.indexOf('[');
  if (arrayStart < 0) return [];
  const arrayText = extractBalancedJsonSlice(slice, arrayStart, '[', ']');
  if (!arrayText) return [];
  const parsed = safeJsonParseArray(arrayText);
  return Array.isArray(parsed)
    ? parsed.filter((item) => item && typeof item === 'object') as AgentResultArtifact[]
    : [];
}

function extractBalancedJsonSlice(
  text: string,
  startIndex: number,
  openChar: string,
  closeChar: string,
): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return text.slice(startIndex, index + 1);
    }
  }
  return null;
}

function safeJsonParseArray(raw: string): unknown[] | null {
  const repaired = repairJsonCandidate(raw) ?? closeOpenJsonStructures(raw);
  try {
    const parsed = JSON.parse(repaired) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function tryParsePrefixObject(slice: string): Record<string, unknown> | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < slice.length; index += 1) {
    const char = slice[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return parseJsonObject(slice.slice(0, index + 1));
      }
    }
  }
  return null;
}

function inferVerification(text: string): string {
  if (/jql/i.test(text)) return 'jql_requery';
  if (/rest\s*api|jira\s*rest/i.test(text)) return 'rest_api_readback';
  if (/回读|readback|复查/i.test(text)) return 'readback';
  return 'tool_confirmation';
}

function inferChangedFields(text: string, task?: string): string[] {
  const blob = `${task || ''}\n${text}`;
  const fields: string[] = [];
  if (/committed/i.test(blob)) fields.push('Committed');
  if (/customfield_\d+/i.test(blob)) {
    const match = blob.match(/customfield_\d+/i);
    if (match) fields.push(match[0]);
  }
  return unique(fields);
}

function inferObservedFields(
  text: string,
  mode: 'read' | 'write',
  changedFields: string[],
): string[] {
  if (mode === 'write' && changedFields.length > 0) return changedFields;
  const fields: string[] = [];
  if (/状态|status/i.test(text)) fields.push('status');
  if (/负责人|assignee/i.test(text)) fields.push('assignee');
  if (/title|标题/i.test(text)) fields.push('title');
  if (/url/i.test(text)) fields.push('url');
  if (/committed/i.test(text)) fields.push('Committed');
  return unique(fields);
}

function excerptForEntity(text: string, entityKey: string): string | undefined {
  const line = text
    .split(/\n/)
    .map((item) => item.trim())
    .find((item) => item.includes(entityKey));
  return line;
}

function uniqueMatches(text: string, pattern: RegExp): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  const cloned = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;
  while ((match = cloned.exec(text))) {
    const value = match[0];
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }
  return values;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
