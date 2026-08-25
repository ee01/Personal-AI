export type LLMErrorKind =
  | 'auth'
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'server'
  | 'bad_request'
  | 'unknown';

export interface LLMTargetFailure {
  targetId: string;
  kind: LLMErrorKind;
  message: string;
}

export class LLMAllTargetsFailedError extends Error {
  readonly failures: LLMTargetFailure[];

  constructor(failures: LLMTargetFailure[]) {
    const summary = failures
      .map((failure) => `${failure.targetId}:${failure.kind}`)
      .join(', ');
    super(
      `[LLMClient] All targets failed (${failures.length}): ${summary || 'no attempts'}`,
    );
    this.name = 'LLMAllTargetsFailedError';
    this.failures = failures;
  }
}

export function classifyLLMError(error: unknown): LLMErrorKind {
  const message = String(
    error instanceof Error ? error.message : error || '',
  ).toLowerCase();

  if (/\b(?:401|403)\b/.test(message)) return 'auth';
  if (/\b429\b|rate limit/.test(message)) return 'rate_limit';
  if (/timeout|timed out|aborted/.test(message)) return 'timeout';
  if (
    /fetch failed|failed to fetch|network|econnrefused|enotfound|econnreset/.test(
      message,
    )
  ) {
    return 'network';
  }
  if (/\b5\d\d\b/.test(message)) return 'server';
  if (/\b4\d\d\b/.test(message)) return 'bad_request';
  return 'unknown';
}

/** Transient errors may be retried on the same target. */
export function shouldRetrySameTarget(kind: LLMErrorKind): boolean {
  return (
    kind === 'timeout' ||
    kind === 'network' ||
    kind === 'server' ||
    kind === 'rate_limit' ||
    kind === 'unknown'
  );
}
