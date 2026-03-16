import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

import { getConfig } from '../../config.js';
import { OpenClawClient } from '../../integrations/OpenClawClient.js';
import { ActionRepository, type QueuedActionRecord } from '../../repositories/ActionRepository.js';
import { NotificationRepository } from '../../repositories/NotificationRepository.js';
import { now } from '../../utils/time.js';
import { getBotSender } from '../../utils/botSender.js';
import { TruthMaintainer, type PropertyChange } from '../TruthMaintainer.js';

export interface ActionExecutionResult {
  actionId: string;
  actionType: string;
  queueStatus: string;
  result?: Record<string, unknown>;
  error?: string;
}

function safeJsonValue(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export class ActionExecutor {
  private readonly actionRepo: ActionRepository;
  private readonly notificationRepo: NotificationRepository;
  private readonly openClaw: OpenClawClient;

  constructor(
    private readonly db: Database.Database,
    private readonly userId?: string,
  ) {
    this.actionRepo = new ActionRepository(db);
    this.notificationRepo = new NotificationRepository(db);
    this.openClaw = new OpenClawClient();
  }

  async runDueActions(limit = 10): Promise<ActionExecutionResult[]> {
    const dueActions = this.actionRepo.listDueAutoActions(limit);
    const results: ActionExecutionResult[] = [];

    for (const action of dueActions) {
      results.push(await this.executeAction(action.id));
    }

    return results;
  }

  async executeAction(actionId: string): Promise<ActionExecutionResult> {
    const action = this.actionRepo.getById(actionId);
    if (!action) {
      throw new Error(`Action "${actionId}" not found`);
    }

    if (action.queueStatus === 'cancelled' || action.queueStatus === 'succeeded') {
      return {
        actionId: action.id,
        actionType: action.actionType,
        queueStatus: action.queueStatus,
        result: action.result,
      };
    }

    const attemptId = this.actionRepo.markRunning(action.id);
    try {
      const result = await this.dispatch(action);
      const updated = this.actionRepo.markSucceeded(action.id, attemptId, result) ?? action;
      return {
        actionId: updated.id,
        actionType: updated.actionType,
        queueStatus: updated.queueStatus,
        result,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const updated = this.actionRepo.markFailed(
        action.id,
        attemptId,
        message,
        action.retryCount >= 2,
      ) ?? action;
      return {
        actionId: updated.id,
        actionType: updated.actionType,
        queueStatus: updated.queueStatus,
        error: message,
      };
    }
  }

  private async dispatch(action: QueuedActionRecord): Promise<Record<string, unknown>> {
    if (action.actionType === 'notify_user') {
      return this.notifyUser(action);
    }
    if (action.actionType === 'create_confirm_request') {
      return this.createConfirmRequest(action);
    }
    if (action.actionType === 'update_truth_property') {
      return this.updateTruthProperty(action);
    }
    if (action.actionType === 'query_external_tool') {
      return this.queryExternalTool(action);
    }

    throw new Error(`Unsupported action type: ${action.actionType}`);
  }

  private async notifyUser(action: QueuedActionRecord): Promise<Record<string, unknown>> {
    const params = safeJsonValue(action.params);
    const notificationId = randomUUID();
    const currentTime = now();

    this.db
      .prepare(
        `INSERT INTO notification_records
          (id, channel, type, title, body, payload_json, topic_id, related_entity_id, utility_score, sent_at, created_at)
         VALUES (?, 'reflection_action', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        notificationId,
        action.actionType,
        String(params.title ?? action.title),
        String(params.body ?? action.description ?? ''),
        JSON.stringify(params.payload ?? { actionId: action.id }),
        String((params.payload as Record<string, unknown> | undefined)?.threadId ?? action.threadId ?? action.id),
        typeof params.relatedEntityId === 'string' ? params.relatedEntityId : null,
        action.utilityScore ?? null,
        currentTime,
        currentTime,
      );

    const botSender = getBotSender();
    const shouldPushBot =
      (action.urgencyScore ?? 0) >= getConfig().reflectionUrgentNotifyThreshold ||
      action.priority >= 8 ||
      params.botPush === true;
    if (shouldPushBot && botSender.isConfigured()) {
      await botSender.sendMarkdown(
        String(params.title ?? action.title),
        String(params.body ?? action.description ?? ''),
        { mention: action.priority >= 8, targetUserId: this.userId },
      );
    }

    return {
      notificationId,
      botPushed: shouldPushBot && botSender.isConfigured(),
    };
  }

  private async createConfirmRequest(action: QueuedActionRecord): Promise<Record<string, unknown>> {
    const params = safeJsonValue(action.params);
    const confirmRequestId = String(params.confirmRequestId ?? randomUUID());
    const currentTime = now();

    this.db
      .prepare(
        `INSERT OR REPLACE INTO confirm_requests
          (id, question, context, options_json, evidence_refs_json, category, related_entity_id,
           related_property_id, priority, state, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        confirmRequestId,
        String(params.question ?? action.title),
        typeof params.context === 'string' ? params.context : action.description ?? null,
        JSON.stringify(params.options ?? []),
        JSON.stringify(action.evidenceRefs),
        typeof params.category === 'string' ? params.category : 'reflection',
        typeof params.relatedEntityId === 'string' ? params.relatedEntityId : null,
        typeof params.relatedPropertyId === 'number' ? params.relatedPropertyId : null,
        typeof params.priority === 'string' ? params.priority : action.priority >= 8 ? 'high' : 'normal',
        currentTime,
      );

    return { confirmRequestId };
  }

  private async updateTruthProperty(action: QueuedActionRecord): Promise<Record<string, unknown>> {
    const params = safeJsonValue(action.params);
    const truthMaintainer = new TruthMaintainer(this.db);
    await truthMaintainer.processPropertyChange(params as unknown as PropertyChange);
    return { updated: true };
  }

  private async queryExternalTool(action: QueuedActionRecord): Promise<Record<string, unknown>> {
    const params = safeJsonValue(action.params);
    const rawQuery = safeJsonValue(params.query);
    const query: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(rawQuery)) {
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        query[key] = value;
      }
    }
    const result = await this.openClaw.request({
      path: typeof params.path === 'string' ? params.path : '',
      method: typeof params.method === 'string' ? params.method : 'POST',
      query,
      body: params.body,
    });

    return {
      status: result.status,
      ok: result.ok,
      data: result.data,
      text: result.text,
    };
  }
}
