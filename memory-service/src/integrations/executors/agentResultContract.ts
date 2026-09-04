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

function hasListedEntityKeys(metadata: Record<string, unknown>): boolean {
  for (const key of ['initKeys', 'issueKeys', 'entityKeys', 'ticketKeys']) {
    const value = metadata[key];
    if (
      Array.isArray(value) &&
      value.some((item) => typeof item === 'string' && item.trim().length > 0)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Read/write receipts can prove themselves through observed/changed fields,
 * operations, timestamps, or grouped Jira reads that list the keys they scanned.
 */
export function hasMetadataProofFields(
  metadata: Record<string, unknown> | undefined,
): boolean {
  if (!metadata) return false;
  if (hasMetadataObservedFields(metadata)) return true;
  if (Boolean(getMetadataString(metadata, ['operation', 'operationType', 'action']))) {
    return true;
  }
  if (Boolean(getMetadataString(metadata, ['observedAt', 'verifiedAt', 'updatedAt']))) {
    return true;
  }
  if (hasListedEntityKeys(metadata)) return true;
  const count = metadata.initCount ?? metadata.matchCount;
  if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
    return Boolean(
      getMetadataString(metadata, ['query', 'jql', 'queryText', 'entityUrl', 'url']),
    );
  }
  return false;
}

/**
 * A task can legitimately touch zero entities — a conditional sync that finds no
 * qualifying record, a scan that comes back clean. That is a verified negative
 * result, not a missing receipt, so it needs its own artifact shape: `kind:
 * 'query_result'` (or an explicit `metadata.matchCount === 0`) backed by the
 * query that was run and how it was executed, instead of an entity identity.
 */
export function isVerifiedEmptyResultArtifact(artifact: AgentResultArtifact): boolean {
  const metadata = artifact.metadata;
  const kind = typeof artifact.kind === 'string' ? artifact.kind.trim().toLowerCase() : '';
  const matchCount = metadata?.matchCount;
  const isZeroMatch =
    kind === 'query_result' ||
    matchCount === 0 ||
    matchCount === '0';
  if (!isZeroMatch) return false;

  const sourceSystem = getMetadataString(metadata, ['sourceSystem', 'targetSystem', 'system']);
  const query = getMetadataString(metadata, ['query', 'jql', 'queryText']);
  const verification =
    metadata?.verified === true ||
    Boolean(getMetadataString(metadata, ['verification', 'verificationMethod']));
  const hasBody =
    (typeof artifact.content === 'string' && artifact.content.trim().length > 0) ||
    (typeof artifact.title === 'string' && artifact.title.trim().length > 0);

  return Boolean(sourceSystem && query && verification && hasBody);
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

  const verification =
    metadata?.verified === true ||
    Boolean(getMetadataString(metadata, ['verification', 'verificationMethod']));
  const hasBody =
    (typeof artifact.content === 'string' && artifact.content.trim().length > 0) ||
    (typeof artifact.title === 'string' && artifact.title.trim().length > 0);

  return Boolean(verification && hasBody);
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
  options: { targetSystem?: string },
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
  const verification =
    metadata?.verified === true ||
    Boolean(getMetadataString(metadata, ['verification', 'verificationMethod']));
  const hasProofFields = hasMetadataProofFields(metadata);
  const hasBody =
    (typeof artifact.content === 'string' && artifact.content.trim().length > 0) ||
    (typeof artifact.title === 'string' && artifact.title.trim().length > 0);

  return Boolean(
    sourceSystem &&
      entityId &&
      verification &&
      hasBody &&
      hasProofFields,
  );
}

export function hasVerifiableArtifact(
  artifacts: AgentResultArtifact[],
  options: { targetSystem?: string } = {},
): boolean {
  return artifacts.some(
    (artifact) =>
      hasVerifiableEntityArtifact(artifact, options) ||
      isVerifiedEmptyResultArtifact(artifact) ||
      isVerifiedFileArtifact(artifact),
  );
}
