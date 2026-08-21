/**
 * AgentExecutor — shared control-plane interface for all agent runtimes.
 * Protocol details (Gateway WS / ACP stdio / legacy HTTP) stay inside implementations.
 */

import type { AgentResultArtifact } from './agentResultContract.js';

export type AgentRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'input_required'
  | 'timeout'
  | 'auth_error'
  | 'capability_missing'
  | 'need_human_decision'
  | 'error';

export interface AgentResultEnvelope {
  status: AgentRunStatus;
  summary: string;
  artifacts: AgentResultArtifact[];
  transcript?: string;
  transcriptPath?: string;
  payload?: Record<string, unknown>;
  remoteRunId?: string;
  eventCursor?: string;
  sessionKey?: string;
}

export interface AgentSubmitRequest {
  task: string;
  mode: 'read' | 'write';
  targetSystem?: string;
  threadId: string;
  runId?: string;
  actionId: string;
  /** Stable per remote execution attempt; differs when a failed action is retried. */
  idempotencyKey?: string;
  sessionKey: string;
  agentId?: string;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentExecutor {
  readonly id: string;
  readonly type: string;
  submit(request: AgentSubmitRequest): Promise<AgentResultEnvelope>;
  poll?(remoteRunId: string, cursor?: string): Promise<AgentResultEnvelope>;
  cancel?(remoteRunId: string): Promise<AgentResultEnvelope>;
  resume?(remoteRunId: string, input: Record<string, unknown>): Promise<AgentResultEnvelope>;
}
