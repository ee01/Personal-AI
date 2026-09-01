import type { UserDataManager } from '../storage/UserDataManager.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import { now } from '../utils/time.js';
import { hasVerifiableArtifact as sharedHasVerifiableArtifact } from './executors/agentResultContract.js';
import { parseAgentResultEnvelope, extractAgentResultJson } from './executors/agentResultEnvelope.js';
import {
  buildAgentResultSystemPrompt,
  buildAgentResultUserPrompt,
} from './executors/agentResultPrompt.js';

export type DelegationStatus =
  | 'success'
  | 'capability_missing'
  | 'auth_error'
  | 'need_human_decision'
  | 'timeout'
  | 'error';

export interface DelegationArtifact {
  kind: string;
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface DelegationOutcome {
  status: DelegationStatus;
  summary: string;
  artifacts: DelegationArtifact[];
  rawResponse?: Record<string, unknown>;
  outputText?: string;
  transcriptPath?: string;
  payload?: Record<string, unknown>;
}

export interface DelegationRequest {
  task: string;
  mode: 'read' | 'write';
  targetSystem?: string;
  threadId: string;
  runId?: string;
  actionId: string;
  sessionKey: string;
  agentId?: string;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

interface Envelope {
  status?: string;
  summary?: string;
  artifacts?: unknown[];
  transcript?: unknown;
  payload?: Record<string, unknown>;
  question?: string;
  options?: Array<{ label?: string; value?: string }>;
}

interface StructuredObservation {
  path: string;
  values: Record<string, string | number | boolean>;
}

function hasVerifiableArtifact(
  artifacts: DelegationArtifact[],
  input: DelegationRequest,
): boolean {
  return sharedHasVerifiableArtifact(artifacts, {
    targetSystem: input.targetSystem,
  });
}

/**
 * Notification-only delegations (agent-task success-template formatting) are pure
 * text transformations: the summary itself is the deliverable and no external
 * system is touched, so there is nothing to read back or verify. The verifiable
 * artifact gate must not apply to them — see the notificationOnly exemption in
 * delegate().
 */
function isNotificationOnlyRequest(input: DelegationRequest): boolean {
  return input.metadata?.notificationOnly === true;
}

function cleanJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    return fenced[1].trim();
  }

  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1).trim();
  }

  return trimmed;
}

function safeJsonParse<T>(raw: string | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    return undefined;
  }
}

function safeJsonCandidateParse<T>(raw: string | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(cleanJsonCandidate(raw)) as T;
  } catch {
    const repaired = repairJsonCandidate(cleanJsonCandidate(raw));
    if (!repaired) return undefined;
    return safeJsonParse<T>(repaired);
  }
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

  if (escaped) {
    candidate = candidate.slice(0, -1);
  }
  if (inString) {
    candidate += '"';
  }
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    candidate += stack[index] === '{' ? '}' : ']';
  }
  return candidate;
}

function repairJsonCandidate(raw: string): string | undefined {
  const cleaned = raw.trim();
  if (!cleaned) return undefined;

  const direct = closeOpenJsonStructures(cleaned);
  if (safeJsonParse(direct)) {
    return direct;
  }

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
    if (safeJsonParse(repaired)) {
      return repaired;
    }
  }

  return undefined;
}

function coerceArtifacts(raw: unknown): DelegationArtifact[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      kind: typeof item.kind === 'string' ? item.kind : 'note',
      title: typeof item.title === 'string' ? item.title : undefined,
      content: typeof item.content === 'string' ? item.content : undefined,
      metadata:
        item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, unknown>)
          : undefined,
    }));
}

function isScalarObservationValue(value: unknown): value is string | number | boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function collectStructuredObservations(
  value: unknown,
  path = 'payload',
  sink: StructuredObservation[] = [],
  minScalarFields = 2,
): StructuredObservation[] {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStructuredObservations(item, `${path}[${index}]`, sink, minScalarFields);
    });
    return sink;
  }
  if (!value || typeof value !== 'object') {
    return sink;
  }

  const record = value as Record<string, unknown>;
  const scalarEntries = Object.entries(record).filter(([, entryValue]) => isScalarObservationValue(entryValue));
  if (scalarEntries.length >= minScalarFields) {
    sink.push({
      path,
      values: Object.fromEntries(
        scalarEntries.map(([key, entryValue]) => [key, entryValue as string | number | boolean]),
      ),
    });
  }

  for (const [key, entryValue] of Object.entries(record)) {
    if (entryValue && typeof entryValue === 'object') {
      collectStructuredObservations(entryValue, `${path}.${key}`, sink, minScalarFields);
    }
  }
  return sink;
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function getPayloadEntityRef(payload: Record<string, unknown> | undefined): string | undefined {
  if (!payload) return undefined;
  return firstNonEmptyString(
    payload.entityId,
    payload.entityKey,
    payload.recordId,
    payload.resourceId,
    payload.ticketId,
    payload.ticketKey,
    payload.issueKey,
    payload.jiraKey,
    payload.calendarId,
    payload.target,
    payload.url,
    payload.link,
  );
}

function getMetadataCandidateArtifacts(metadata: Record<string, unknown> | undefined): Array<Record<string, unknown>> {
  if (!metadata) return [];
  const raw = metadata.candidateArtifacts;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
}

function hasPersonalAiArCandidateArtifact(input: DelegationRequest): boolean {
  return getMetadataCandidateArtifacts(input.metadata).some((artifact) => {
    const kind = typeof artifact.kind === 'string' ? artifact.kind.trim() : '';
    return kind === 'ar_binding';
  }) || (typeof input.metadata?.arBindingId === 'string' && input.metadata.arBindingId.trim().length > 0);
}

function inferDelegationEntityRef(
  input: DelegationRequest,
  artifacts: DelegationArtifact[],
  payload: Record<string, unknown> | undefined,
): string | undefined {
  const metadata = input.metadata;
  const candidateArtifacts = getMetadataCandidateArtifacts(metadata);
  return firstNonEmptyString(
    getPayloadEntityRef(payload),
    ...artifacts.flatMap((artifact) => [
      artifact.metadata?.entityId,
      artifact.metadata?.entityKey,
      artifact.metadata?.recordId,
      artifact.metadata?.resourceId,
      artifact.metadata?.ticketId,
      artifact.metadata?.ticketKey,
      artifact.metadata?.issueKey,
      artifact.title,
    ]),
    ...candidateArtifacts.flatMap((artifact) => [
      artifact.entityId,
      artifact.entityKey,
      artifact.resourceId,
      artifact.ticketId,
      artifact.ticketKey,
      artifact.issueKey,
      artifact.url,
      artifact.title,
    ]),
    metadata?.target,
    metadata?.targetRef,
  );
}

function inferDelegationSourceSystem(
  input: DelegationRequest,
  payload: Record<string, unknown> | undefined,
  artifacts: DelegationArtifact[],
): string | undefined {
  return firstNonEmptyString(
    input.targetSystem,
    payload?.sourceSystem,
    payload?.targetSystem,
    ...artifacts.flatMap((artifact) => [
      artifact.metadata?.sourceSystem,
      artifact.metadata?.targetSystem,
      artifact.metadata?.system,
    ]),
  );
}

function summarizeObservation(observation: StructuredObservation): string {
  return Object.entries(observation.values)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' | ');
}

function getPersonalAiArScalarSummary(payload: Record<string, unknown> | undefined): string | undefined {
  if (!payload) return undefined;
  const preferredKeys = [
    'replacementText',
    'displayText',
    'text',
    'issueTotal',
    'issueCount',
    'issuesTotal',
    'total',
    'count',
    'value',
  ];
  for (const key of preferredKeys) {
    const value = payload[key];
    if (isScalarObservationValue(value)) {
      return String(value);
    }
  }
  for (const value of Object.values(payload)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = getPersonalAiArScalarSummary(value as Record<string, unknown>);
      if (nested !== undefined) {
        return nested;
      }
    }
  }
  const scalarEntries = Object.entries(payload).filter(([, value]) => isScalarObservationValue(value));
  if (scalarEntries.length === 1) {
    return String(scalarEntries[0][1]);
  }
  return undefined;
}

function enrichArtifactsWithDelegationContext(
  artifacts: DelegationArtifact[],
  input: DelegationRequest,
  payload: Record<string, unknown> | undefined,
  outputText: string,
  summary: string | undefined,
): DelegationArtifact[] {
  const allowSingleScalarObservation =
    input.targetSystem === 'personal_ai_ar' || hasPersonalAiArCandidateArtifact(input);
  const observations = collectStructuredObservations(
    payload,
    'payload',
    [],
    allowSingleScalarObservation ? 1 : 2,
  );
  const sourceSystem = inferDelegationSourceSystem(input, payload, artifacts);
  const entityRef = inferDelegationEntityRef(input, artifacts, payload);
  const observedFields = Array.from(
    new Set(observations.flatMap((observation) => Object.keys(observation.values))),
  ).slice(0, 16);
  const observedAt = new Date(now() * 1000).toISOString();

  const enrichedArtifacts = artifacts.map((artifact) => {
    const metadata = artifact.metadata ?? {};
    const nextMetadata: Record<string, unknown> = { ...metadata };
    if (!nextMetadata.sourceSystem && sourceSystem) nextMetadata.sourceSystem = sourceSystem;
    if (!nextMetadata.entityId && !nextMetadata.entityKey && entityRef) nextMetadata.entityKey = entityRef;
    if (!nextMetadata.verification && sourceSystem && entityRef && observedFields.length > 0) {
      nextMetadata.verification = 'delegated_structured_result';
    }
    if (!Array.isArray(nextMetadata.observedFields) && observedFields.length > 0) {
      nextMetadata.observedFields = observedFields;
    }
    if (!nextMetadata.observedAt && observedFields.length > 0) {
      nextMetadata.observedAt = observedAt;
    }
    return {
      ...artifact,
      metadata: Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined,
    };
  });

  if (hasVerifiableArtifact(enrichedArtifacts, input)) {
    return enrichedArtifacts;
  }

  if (!sourceSystem || !entityRef || observations.length === 0) {
    return enrichedArtifacts;
  }

  const contentLines = [
    summary?.trim(),
    ...observations.slice(0, 6).map((observation, index) => `${index + 1}. ${summarizeObservation(observation)}`),
    !summary?.trim() && outputText.trim().length > 0 ? outputText.trim() : undefined,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (contentLines.length === 0) {
    return enrichedArtifacts;
  }

  return [
    ...enrichedArtifacts,
    {
      kind: 'delegation_result',
      title: summary?.trim() || `Delegated ${sourceSystem} result`,
      content: contentLines.join('\n'),
      metadata: {
        sourceSystem,
        entityKey: entityRef,
        verification: 'delegated_structured_result',
        observedFields,
        observedAt,
      },
    },
  ];
}

function extractOutputText(raw: Record<string, unknown>): string {
  if (typeof raw.output_text === 'string' && raw.output_text.trim()) {
    return raw.output_text.trim();
  }

  const outputs = Array.isArray(raw.output) ? raw.output : [];
  const parts: string[] = [];
  for (const output of outputs) {
    if (!output || typeof output !== 'object') continue;
    const outputRecord = output as Record<string, unknown>;
    const contentItems = Array.isArray(outputRecord.content) ? outputRecord.content : [];
    for (const content of contentItems) {
      if (!content || typeof content !== 'object') continue;
      const contentRecord = content as Record<string, unknown>;
      if (typeof contentRecord.text === 'string' && contentRecord.text.trim()) {
        parts.push(contentRecord.text.trim());
      }
    }
  }

  return parts.join('\n').trim();
}

function buildResponsesUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/responses') || trimmed.endsWith('/v1/responses')) {
    return trimmed;
  }
  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/responses`;
  }
  return `${trimmed}/v1/responses`;
}

export class OpenClawDelegationService {
  constructor(
    private readonly userDataManager?: UserDataManager,
    private readonly userId?: string,
  ) {}

  private getRuntimeConfig() {
    return getUserRuntimeConfig(this.userDataManager);
  }

  private isConfigured(): boolean {
    const config = this.getRuntimeConfig();
    // baseUrl only — openClawEnabled is the reflection/linkage master switch.
    return Boolean(config.openClawBaseUrl);
  }

  async delegate(input: DelegationRequest): Promise<DelegationOutcome> {
    const config = this.getRuntimeConfig();
    if (!this.isConfigured()) {
      return {
        status: 'capability_missing',
        summary: 'OpenClaw 未配置，无法执行外部委派。',
        artifacts: [],
        payload: { configured: false },
      };
    }

    const developerPrompt = buildAgentResultSystemPrompt(
      {
        task: input.task,
        mode: input.mode,
        targetSystem: input.targetSystem,
        threadId: input.threadId,
        runId: input.runId,
        metadata: input.metadata,
      },
      { runtime: 'openclaw' },
    );

    const userPrompt = [
      this.userId ? `Personal AI User ID: ${this.userId}` : undefined,
      buildAgentResultUserPrompt({
        task: input.task,
        mode: input.mode,
        targetSystem: input.targetSystem,
        threadId: input.threadId,
        runId: input.runId,
        metadata: input.metadata,
      }),
    ]
      .filter(Boolean)
      .join('\n');

    const body = {
      model: `openclaw:${input.agentId ?? 'main'}`,
      user: input.sessionKey,
      stream: false,
      input: [
        {
          type: 'message',
          role: 'developer',
          content: [{ type: 'input_text', text: developerPrompt }],
        },
        {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: userPrompt }],
        },
      ],
    };

    const requestTimeoutMs =
      typeof input.timeoutMs === 'number' && Number.isFinite(input.timeoutMs)
        ? Math.max(1000, Math.min(Math.floor(input.timeoutMs), config.openClawTimeoutMs))
        : config.openClawTimeoutMs;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(buildResponsesUrl(config.openClawBaseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(config.openClawApiKey
            ? {
                Authorization: `Bearer ${config.openClawApiKey}`,
                'x-api-key': config.openClawApiKey,
              }
            : {}),
          'x-openclaw-session-key': input.sessionKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await response.text();
      const parsed = safeJsonParse<Record<string, unknown>>(text);
      if (response.status === 401 || response.status === 403) {
        return {
          status: 'auth_error',
          summary: 'OpenClaw 返回鉴权失败或权限不足。',
          artifacts: [],
          rawResponse: parsed,
          outputText: text,
          payload: { httpStatus: response.status },
        };
      }

      if (!response.ok) {
        return {
          status: 'error',
          summary: `OpenClaw 请求失败（HTTP ${response.status}）。`,
          artifacts: [],
          rawResponse: parsed,
          outputText: text,
          payload: { httpStatus: response.status },
        };
      }

      const outputText = parsed ? extractOutputText(parsed) : text;
      const envelope = extractAgentResultJson(outputText) as Envelope | null;
      const parseOptions = {
        targetSystem: input.targetSystem,
        mode: input.mode,
        task: input.task,
      };
      const transcriptPath = this.writeTranscript(input, {
        request: body,
        response: parsed ?? { rawText: text },
        outputText,
      });

      if (!envelope) {
        const recovered = parseAgentResultEnvelope(outputText, parseOptions);
        if (recovered.status === 'succeeded') {
          return {
            status: 'success',
            summary: recovered.summary,
            artifacts: recovered.artifacts,
            rawResponse: parsed,
            outputText,
            transcriptPath,
            payload: recovered.payload,
          };
        }
        if (outputText.trim().length > 0) {
          return {
            status: 'error',
            summary: 'OpenClaw 未返回结构化结果或可验证 artifact。',
            artifacts: [],
            rawResponse: parsed,
            outputText,
            transcriptPath,
            payload: {
              fallback: 'plain_text_summary_without_verifiable_artifact',
              rawSummary: outputText.trim(),
            },
          };
        }
        return {
          status: 'error',
          summary: 'OpenClaw 未返回可解析的 JSON 委派结果。',
          artifacts: [],
          rawResponse: parsed,
          outputText,
          transcriptPath,
        };
      }

      const normalizedStatus = this.normalizeStatus(envelope.status);
      const artifacts = normalizedStatus === 'success'
        ? enrichArtifactsWithDelegationContext(
            coerceArtifacts(envelope.artifacts),
            input,
            envelope.payload,
            outputText,
            envelope.summary,
          )
        : coerceArtifacts(envelope.artifacts);
      if (
        normalizedStatus === 'success' &&
        !isNotificationOnlyRequest(input) &&
        !hasVerifiableArtifact(artifacts, input)
      ) {
        return {
          status: 'error',
          summary: 'OpenClaw 返回了 success，但缺少可验证 artifact。',
          artifacts,
          rawResponse: parsed,
          outputText,
          transcriptPath,
          payload: {
            ...(envelope.payload ?? {}),
            artifactValidation: 'missing_verifiable_artifact',
          },
        };
      }
      if (normalizedStatus === 'error' && hasPersonalAiArCandidateArtifact(input)) {
        const arArtifacts = enrichArtifactsWithDelegationContext(
          coerceArtifacts(envelope.artifacts),
          input,
          envelope.payload,
          outputText,
          envelope.summary,
        );
        const arSummary = getPersonalAiArScalarSummary(envelope.payload);
        if (arSummary && hasVerifiableArtifact(arArtifacts, input)) {
          return {
            status: 'success',
            summary: arSummary,
            artifacts: arArtifacts,
            rawResponse: parsed,
            outputText,
            transcriptPath,
            payload: {
              ...(envelope.payload ?? {}),
              recoveredFrom: 'personal_ai_ar_scalar_payload',
            },
          };
        }
      }

      return {
        status: normalizedStatus,
        summary: envelope.summary?.trim() || 'OpenClaw 已返回外部委派结果。',
        artifacts,
        rawResponse: parsed,
        outputText,
        transcriptPath,
        payload: envelope.payload,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const timedOut =
        error instanceof Error &&
        (error.name === 'AbortError' || /aborted|timeout/i.test(error.message));
      return {
        status: timedOut ? 'timeout' : 'error',
        summary: timedOut ? 'OpenClaw 委派超时。' : `OpenClaw 委派失败：${message}`,
        artifacts: [],
        payload: { error: message },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeStatus(status: string | undefined): DelegationStatus {
    switch (status) {
      case 'success':
      case 'capability_missing':
      case 'auth_error':
      case 'need_human_decision':
        return status;
      default:
        return 'error';
    }
  }

  private writeTranscript(
    input: DelegationRequest,
    payload: Record<string, unknown>,
  ): string | undefined {
    if (!this.userDataManager) return undefined;
    const fileName = `delegations/${input.threadId}-${input.actionId}-${now()}.json`;
    this.userDataManager.writeFile(fileName, JSON.stringify(payload, null, 2));
    return fileName;
  }
}
