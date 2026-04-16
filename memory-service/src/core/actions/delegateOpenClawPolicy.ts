type ExecutionMode = 'manual' | 'auto';

export interface DelegateOpenClawPolicyInput {
  params?: Record<string, unknown>;
  requestedExecutionMode?: ExecutionMode;
  requestedRequiresApproval?: boolean;
  defaultExecutionMode?: ExecutionMode;
  defaultRequiresApproval?: boolean;
}

export interface DelegateOpenClawPolicy {
  mode: 'read' | 'write';
  executionMode: ExecutionMode;
  requiresApproval: boolean;
}

export function getDelegateOpenClawMode(
  params?: Record<string, unknown>,
): 'read' | 'write' {
  return params?.mode === 'write' ? 'write' : 'read';
}

export function resolveDelegateOpenClawPolicy(
  input: DelegateOpenClawPolicyInput,
): DelegateOpenClawPolicy {
  const mode = getDelegateOpenClawMode(input.params);
  const defaultExecutionMode =
    input.defaultExecutionMode ??
    (mode === 'write' && input.defaultRequiresApproval !== false
      ? 'manual'
      : 'auto');
  const defaultRequiresApproval =
    input.defaultRequiresApproval ?? defaultExecutionMode !== 'auto';

  let executionMode = input.requestedExecutionMode ?? defaultExecutionMode;
  let requiresApproval =
    input.requestedRequiresApproval ?? defaultRequiresApproval;

  if (requiresApproval && executionMode === 'auto') {
    executionMode = 'manual';
  }

  return {
    mode,
    executionMode,
    requiresApproval,
  };
}
