/**
 * Shared executor construction. Readiness probes and real dispatch build the
 * executor here so a probe can never test a different protocol than the one
 * execution will use.
 */

import type { OpenClawDelegationService } from '../OpenClawDelegationService.js';
import type { AgentExecutor } from './AgentExecutor.js';
import { AcpExecutor } from './AcpExecutor.js';
import {
  OpenClawGatewayExecutor,
  type GatewayProgressPatch,
} from './OpenClawGatewayExecutor.js';
import { OpenClawResponsesExecutor } from './OpenClawResponsesExecutor.js';
import { isAcpExecutorType, type AgentExecutorInstance } from './executorRegistry.js';

export interface AgentExecutorFactoryDeps {
  delegationService: OpenClawDelegationService;
  userId: string;
  defaultTimeoutMs?: number;
  onProgress?: (patch: GatewayProgressPatch) => void | Promise<void>;
}

export function isSupportedExecutorType(type: string): boolean {
  return (
    type === 'openclaw-responses' ||
    type === 'openclaw-gateway' ||
    isAcpExecutorType(type)
  );
}

export function createAgentExecutor(
  instance: AgentExecutorInstance,
  deps: AgentExecutorFactoryDeps,
): AgentExecutor {
  if (instance.type === 'openclaw-gateway') {
    return new OpenClawGatewayExecutor(instance, {
      defaultTimeoutMs: deps.defaultTimeoutMs,
      onProgress: deps.onProgress,
    });
  }
  if (isAcpExecutorType(instance.type)) {
    return new AcpExecutor(instance, {
      userId: deps.userId,
      defaultTimeoutMs: deps.defaultTimeoutMs,
    });
  }
  return new OpenClawResponsesExecutor(deps.delegationService, instance);
}
