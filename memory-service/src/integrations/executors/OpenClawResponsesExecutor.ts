/**
 * Legacy OpenClaw /v1/responses adapter behind the AgentExecutor interface.
 * Block C will add OpenClawGatewayExecutor; this path stays as fallback.
 */

import type { OpenClawDelegationService } from '../OpenClawDelegationService.js';
import type {
  AgentExecutor,
  AgentResultEnvelope,
  AgentRunStatus,
  AgentSubmitRequest,
} from './AgentExecutor.js';
import type { AgentExecutorInstance } from './executorRegistry.js';

function mapStatus(status: string): AgentRunStatus {
  switch (status) {
    case 'success':
      return 'succeeded';
    case 'capability_missing':
      return 'capability_missing';
    case 'auth_error':
      return 'auth_error';
    case 'need_human_decision':
      return 'need_human_decision';
    case 'timeout':
      return 'timeout';
    case 'error':
      return 'error';
    default:
      return 'failed';
  }
}

export class OpenClawResponsesExecutor implements AgentExecutor {
  readonly id: string;
  readonly type = 'openclaw-responses';

  constructor(
    private readonly delegationService: OpenClawDelegationService,
    instance?: Pick<AgentExecutorInstance, 'id'>,
  ) {
    this.id = instance?.id || 'openclaw';
  }

  async submit(request: AgentSubmitRequest): Promise<AgentResultEnvelope> {
    const outcome = await this.delegationService.delegate({
      task: request.task,
      mode: request.mode,
      targetSystem: request.targetSystem,
      threadId: request.threadId,
      runId: request.runId,
      actionId: request.actionId,
      sessionKey: request.sessionKey,
      agentId: request.agentId,
      timeoutMs: request.timeoutMs,
      metadata: request.metadata,
    });

    return {
      status: mapStatus(outcome.status),
      summary: outcome.summary,
      artifacts: outcome.artifacts || [],
      transcriptPath: outcome.transcriptPath,
      payload: outcome.payload,
    };
  }
}
