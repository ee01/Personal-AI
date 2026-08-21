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
  hasVerifiableArtifact,
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
    if (looksLikeAgentResultEnvelope(parsed)) return parsed;
  }

  const direct = parseJsonObjectOrRepair(text);
  if (looksLikeAgentResultEnvelope(direct)) return direct;

  return findEnvelopeObject(text);
}

export function parseAgentResultEnvelope(
  text: string,
  options: ParseAgentResultOptions = {},
): AgentResultEnvelope {
  const raw = String(text || '');
  const parsed = extractAgentResultJson(raw);
  if (parsed) {
    const artifacts = Array.isArray(parsed.artifacts)
      ? (parsed.artifacts as AgentResultArtifact[])
      : [];
    let status = mapAgentResultStatus(String(parsed.status || 'error'));
    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : raw.slice(0, 500);
    const payload =
      parsed.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)
        ? (parsed.payload as Record<string, unknown>)
        : { raw: parsed };

    if (status === 'succeeded' && !hasVerifiableArtifact(artifacts, options)) {
      return {
        status: 'error',
        summary: `${summary}（缺少可验证 artifact）`,
        artifacts,
        payload: {
          ...payload,
          artifactValidation: 'missing_verifiable_artifact',
        },
      };
    }

    return {
      status,
      summary,
      artifacts,
      transcript: typeof parsed.transcript === 'string' ? parsed.transcript : undefined,
      payload,
    };
  }

  const recovered = recoverMarkdownReceipt(raw, options);
  if (recovered.status === 'succeeded') {
    return recovered;
  }

  return {
    status: 'error',
    summary:
      raw.trim().slice(0, 500) ||
      options.emptySummary ||
      '未返回可解析的 JSON 信封或可验证收据',
    artifacts: [],
    payload: {
      rawText: raw,
      fallback: 'plain_text_summary_without_verifiable_artifact',
    },
  };
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
      summary: raw.slice(0, 500),
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
      summary: raw.slice(0, 500),
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
  const summary = (summaryOverride || raw).slice(0, 500);
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

  if (!hasVerifiableArtifact(artifacts, options)) {
    return {
      status: 'error',
      summary: `${summary}（缺少可验证 artifact）`,
      artifacts,
      payload: {
        rawText: raw,
        artifactValidation: 'missing_verifiable_artifact',
      },
    };
  }

  return {
    status: 'succeeded',
    summary,
    artifacts,
    payload: {
      rawText: raw,
      recoveredFrom: 'markdown_receipt',
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
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '{') continue;
    const slice = text.slice(index);
    const parsed = tryParsePrefixObject(slice);
    if (looksLikeAgentResultEnvelope(parsed)) {
      last = parsed;
    }
  }
  return last;
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
