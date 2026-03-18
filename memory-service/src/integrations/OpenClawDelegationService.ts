import type { UserDataManager } from '../storage/UserDataManager.js';
import { getUserRuntimeConfig } from '../runtimeConfig.js';
import { now } from '../utils/time.js';

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

function getMetadataString(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!metadata) return undefined;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function hasMetadataStringArray(
  metadata: Record<string, unknown> | undefined,
  keys: string[],
): boolean {
  if (!metadata) return false;
  return keys.some((key) => {
    const value = metadata[key];
    return Array.isArray(value) && value.some((item) => typeof item === 'string' && item.trim().length > 0);
  });
}

function hasVerifiableArtifact(
  artifacts: DelegationArtifact[],
  input: DelegationRequest,
): boolean {
  return artifacts.some((artifact) => {
    const metadata = artifact.metadata;
    const sourceSystem =
      getMetadataString(metadata, ['sourceSystem', 'targetSystem', 'system']) ??
      input.targetSystem?.trim();
    const entityId = getMetadataString(metadata, [
      'entityId',
      'entityKey',
      'recordId',
      'resourceId',
      'ticketId',
      'ticketKey',
      'issueKey',
    ]);
    const verification =
      metadata?.verified === true || Boolean(getMetadataString(metadata, ['verification', 'verificationMethod']));
    const hasObservedFields = hasMetadataStringArray(metadata, ['observedFields', 'changedFields']);
    const hasOperation = Boolean(getMetadataString(metadata, ['operation', 'operationType', 'action']));
    const hasObservedAt = Boolean(getMetadataString(metadata, ['observedAt', 'verifiedAt', 'updatedAt']));
    const hasBody =
      (typeof artifact.content === 'string' && artifact.content.trim().length > 0) ||
      (typeof artifact.title === 'string' && artifact.title.trim().length > 0);

    return Boolean(sourceSystem && entityId && verification && hasBody && (hasObservedFields || hasOperation || hasObservedAt));
  });
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
    return undefined;
  }
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
    return config.openClawEnabled && Boolean(config.openClawBaseUrl);
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

    const developerPrompt = [
      'You are an external delegation agent invoked by Personal AI.',
      `Mode: ${input.mode}`,
      input.targetSystem ? `Target system: ${input.targetSystem}` : undefined,
      'Return JSON only with this envelope:',
      '{"status":"success|capability_missing|auth_error|need_human_decision|error","summary":"...","artifacts":[{"kind":"note","title":"...","content":"...","metadata":{}}],"transcript":"optional compact transcript","payload":{}}',
      'On status=success, artifacts MUST include at least one verifiable artifact.',
      'A verifiable artifact must include content plus metadata.sourceSystem, metadata.entityId or metadata.entityKey, metadata.verification, and metadata.observedFields (read) or metadata.operation / metadata.changedFields (write).',
      'If you cannot provide a verifiable artifact, do not return success.',
      'If required capability/tool is unavailable, use status=capability_missing.',
      'If credentials or permissions are insufficient, use status=auth_error.',
      'If human choice is required before continuing, use status=need_human_decision and include payload.question plus payload.options.',
      'Keep the summary concise and factual.',
    ]
      .filter(Boolean)
      .join('\n');

    const userPrompt = [
      `Thread ID: ${input.threadId}`,
      input.runId ? `Run ID: ${input.runId}` : undefined,
      this.userId ? `Personal AI User ID: ${this.userId}` : undefined,
      input.metadata ? `Context metadata: ${JSON.stringify(input.metadata)}` : undefined,
      '',
      'Task:',
      input.task,
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.openClawTimeoutMs);

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
      const envelope = safeJsonCandidateParse<Envelope>(outputText);
      const normalizedStatus = this.normalizeStatus(envelope?.status);
      const transcriptPath = this.writeTranscript(input, {
        request: body,
        response: parsed ?? { rawText: text },
        outputText,
      });

      if (!envelope) {
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

      const artifacts = coerceArtifacts(envelope.artifacts);
      if (normalizedStatus === 'success' && !hasVerifiableArtifact(artifacts, input)) {
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
