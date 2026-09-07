/**
 * Shared Agent Result Contract — verifiable artifact checks used by all executors.
 * Extracted from OpenClawDelegationService so Gateway / ACP / legacy share one rule.
 */

export interface AgentResultArtifact {
  kind: string;
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export function getMetadataString(
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

/**
 * Accept string[] or object shapes for observed/changed fields.
 * OpenClaw sometimes returns `{"url":"...","tabId":...}` instead of `["url","tabId"]`.
 * Objects are normalized via Object.keys / key=value before emptiness checks.
 */
export function normalizeObservedFieldLabels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return Object.entries(item as Record<string, unknown>)
            .map(([key, entryValue]) =>
              entryValue === undefined || entryValue === null
                ? key
                : `${key}=${String(entryValue)}`,
            )
            .join(',');
        }
        if (typeof item === 'number' || typeof item === 'boolean') {
          return String(item);
        }
        return '';
      })
      .filter((item) => item.length > 0);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => {
        if (entryValue === undefined || entryValue === null || entryValue === '') {
          return key;
        }
        if (
          typeof entryValue === 'string' ||
          typeof entryValue === 'number' ||
          typeof entryValue === 'boolean'
        ) {
          return `${key}=${String(entryValue)}`;
        }
        return key;
      })
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
}

export function hasMetadataObservedFields(
  metadata: Record<string, unknown> | undefined,
  keys: string[] = ['observedFields', 'changedFields'],
): boolean {
  if (!metadata) return false;
  return keys.some((key) => normalizeObservedFieldLabels(metadata[key]).length > 0);
}

function artifactHasBody(artifact: AgentResultArtifact): boolean {
  return (
    (typeof artifact.content === 'string' && artifact.content.trim().length > 0) ||
    (typeof artifact.title === 'string' && artifact.title.trim().length > 0)
  );
}

function artifactVerification(
  metadata: Record<string, unknown> | undefined,
): boolean {
  return (
    metadata?.verified === true ||
    Boolean(getMetadataString(metadata, ['verification', 'verificationMethod']))
  );
}

function readMatchCount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

export type AgentTaskOutcomeVerdict = 'observed' | 'empty' | 'mutated' | 'noop';

/**
 * Executor-owned judgment. Personal AI does not infer success from domain
 * field names; it only accepts this closed shape (or one of the three
 * artifact receipts below).
 */
export interface AgentTaskOutcome {
  mode: 'read' | 'write';
  verdict: AgentTaskOutcomeVerdict;
  sourceSystem: string;
  method: string;
  subject: string;
  count: number;
}

export type VerifiableProofOptions = {
  targetSystem?: string;
  mode?: 'read' | 'write';
  outcome?: unknown;
};

export function readAgentTaskOutcome(value: unknown): AgentTaskOutcome | undefined {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  if (!record) return undefined;

  const modeRaw = String(record.mode || '').trim().toLowerCase();
  const mode = modeRaw === 'write' || modeRaw === 'read' ? modeRaw : undefined;
  const verdictRaw = String(record.verdict || '').trim().toLowerCase();
  const verdict =
    verdictRaw === 'observed' ||
    verdictRaw === 'empty' ||
    verdictRaw === 'mutated' ||
    verdictRaw === 'noop'
      ? verdictRaw
      : undefined;
  const sourceSystem = getMetadataString(record, ['sourceSystem', 'targetSystem', 'system']);
  const method = getMetadataString(record, ['method', 'verification', 'verificationMethod']);
  const subject = getMetadataString(record, ['subject', 'query', 'jql', 'url']);
  const count = readMatchCount(record.count ?? record.matchCount);
  if (!mode || !verdict || !sourceSystem || !method || !subject || count === undefined) {
    return undefined;
  }
  return { mode, verdict, sourceSystem, method, subject, count };
}

/**
 * The executor judged the run; this checks that the judgment is internally
 * consistent. `outcome.mode` is informational — a read-configured task that
 * evaluated a write condition and returned noop is still a verified success.
 * A mutated claim must name the objects it changed. Presentation notes are
 * not proof.
 */
export function isVerifiedOutcome(
  outcome: AgentTaskOutcome | undefined,
  artifacts: AgentResultArtifact[],
  options: VerifiableProofOptions = {},
): boolean {
  if (!outcome) return false;
  void options.mode;

  if (outcome.verdict === 'observed') return true;
  if (outcome.verdict === 'empty' || outcome.verdict === 'noop') {
    return outcome.count === 0;
  }
  if (outcome.verdict !== 'mutated' || outcome.count <= 0) return false;
  return artifacts.some((artifact) => hasVerifiableEntityArtifact(artifact, options));
}

/**
 * Scan / list / group / 0-match receipt. matchCount is a query cardinality,
 * not a domain-specific key list. 0 is a verified negative, not a failure.
 */
export function isVerifiedQueryResultArtifact(artifact: AgentResultArtifact): boolean {
  const metadata = artifact.metadata;
  const kind = typeof artifact.kind === 'string' ? artifact.kind.trim().toLowerCase() : '';
  const matchCount = readMatchCount(metadata?.matchCount);
  if (kind !== 'query_result' && matchCount === undefined) return false;
  if (matchCount === undefined) return false;

  const sourceSystem = getMetadataString(metadata, ['sourceSystem', 'targetSystem', 'system']);
  const query = getMetadataString(metadata, ['query', 'jql', 'queryText', 'url', 'entityUrl']);
  return Boolean(
    sourceSystem && query && artifactVerification(metadata) && artifactHasBody(artifact),
  );
}

/** @deprecated Use isVerifiedQueryResultArtifact — 0-match is one of its cases. */
export function isVerifiedEmptyResultArtifact(artifact: AgentResultArtifact): boolean {
  return isVerifiedQueryResultArtifact(artifact);
}

/**
 * A research or authoring task's real output is a file, not a record it touched.
 * Its receipt is the deliverable itself: a path under the user's data directory
 * plus how it was produced.
 *
 * The path is required to be relative and free of traversal segments — a
 * receipt naming /etc/passwd or ../../ is a prompt-injection attempt, not a
 * deliverable, and this contract is what everything downstream trusts.
 */
export function isVerifiedFileArtifact(artifact: AgentResultArtifact): boolean {
  const kind = typeof artifact.kind === 'string' ? artifact.kind.trim().toLowerCase() : '';
  if (kind !== 'file') return false;

  const metadata = artifact.metadata;
  const filePath = getMetadataString(metadata, ['path', 'filePath', 'relativePath']);
  if (!filePath || !isSafeRelativeArtifactPath(filePath)) return false;

  return Boolean(artifactVerification(metadata) && artifactHasBody(artifact));
}

/** Relative, no traversal, no absolute or Windows-drive prefix, no NUL. */
export function isSafeRelativeArtifactPath(value: string): boolean {
  const path = value.trim();
  if (!path || path.includes('\0')) return false;
  if (path.startsWith('/') || path.startsWith('\\')) return false;
  if (/^[a-zA-Z]:/.test(path)) return false;
  return !path
    .split(/[\\/]+/)
    .some((segment) => segment === '..');
}

function hasVerifiableEntityArtifact(
  artifact: AgentResultArtifact,
  options: VerifiableProofOptions,
): boolean {
  const metadata = artifact.metadata;
  const sourceSystem =
    getMetadataString(metadata, ['sourceSystem', 'targetSystem', 'system']) ??
    options.targetSystem?.trim();
  const entityId = getMetadataString(metadata, [
    'entityId',
    'entityKey',
    'recordId',
    'resourceId',
    'ticketId',
    'ticketKey',
    'issueKey',
  ]);
  const hasObservedFields = hasMetadataObservedFields(metadata);
  const hasOperation = Boolean(
    getMetadataString(metadata, ['operation', 'operationType', 'action']),
  );
  const hasObservedAt = Boolean(
    getMetadataString(metadata, ['observedAt', 'verifiedAt', 'updatedAt']),
  );

  return Boolean(
    sourceSystem &&
      entityId &&
      artifactVerification(metadata) &&
      artifactHasBody(artifact) &&
      (hasObservedFields || hasOperation || hasObservedAt),
  );
}

export function hasVerifiableArtifact(
  artifacts: AgentResultArtifact[],
  options: VerifiableProofOptions = {},
): boolean {
  if (isVerifiedOutcome(readAgentTaskOutcome(options.outcome), artifacts, options)) {
    return true;
  }
  return artifacts.some(
    (artifact) =>
      hasVerifiableEntityArtifact(artifact, options) ||
      isVerifiedQueryResultArtifact(artifact) ||
      isVerifiedFileArtifact(artifact),
  );
}
