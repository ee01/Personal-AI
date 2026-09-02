#!/usr/bin/env node
/**
 * Resend an AgentTask result notification using Memory Service LLM + local template fill.
 * Does not re-run OpenClaw. Does not send the owner success receipt.
 *
 * Usage: node tools/resend-agent-task-result-notify.mjs <userId> <actionId>
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = process.env.MEMORY_SERVICE_ROOT || path.join(__dirname, '..');
const distRoot = path.join(appRoot, 'dist');
const userId = process.argv[2] || 'esone.qiu';
const actionId = process.argv[3];
if (!actionId) {
  console.error('usage: node tools/resend-agent-task-result-notify.mjs <userId> <actionId>');
  process.exit(1);
}

const { UserContextManager } = await import(
  path.join(distRoot, 'core/UserContextManager.js')
);
const { ActionRepository } = await import(
  path.join(distRoot, 'repositories/ActionRepository.js')
);
const { NotificationCenterService } = await import(
  path.join(distRoot, 'core/NotificationCenterService.js')
);
const {
  formatSuccessNotificationWithTemplate,
  buildAgentTaskResultAnnouncementBody,
  getExecutionSummary,
  readLedgerNotifyConfig,
  resolveExplicitAgentTaskResultTarget,
} = await import(path.join(distRoot, 'core/agentTaskNotification.js'));

const baseDataDir = process.env.DATA_DIR || path.join(appRoot, 'data');
const manager = new UserContextManager(baseDataDir);
const ctx = manager.getContext(userId);
const action = new ActionRepository(ctx.db).getById(actionId);
if (!action) {
  console.error(JSON.stringify({ error: 'action not found', actionId }));
  process.exit(1);
}

const config = readLedgerNotifyConfig(action);
const result = action.result || {};
const summary = getExecutionSummary(result);
const defaultBody = buildAgentTaskResultAnnouncementBody({
  title: action.title,
  summary,
  result,
  template: config.notifyTemplate,
});
const log = { warn: (obj, msg) => console.warn(msg, obj) };
const body = config.notifyTemplate
  ? await formatSuccessNotificationWithTemplate({
      template: config.notifyTemplate,
      title: action.title,
      task: config.task,
      defaultBody,
      result,
      userDataManager: ctx.userDataManager,
      userId,
      taskId: config.taskId,
      actionId,
      log,
    })
  : defaultBody;

const target = resolveExplicitAgentTaskResultTarget(config.notifyTarget);
if (!target) {
  console.log(JSON.stringify({ phase: 'formatted_no_target', body }, null, 2));
  manager.closeAll();
  process.exit(0);
}

const sent = await new NotificationCenterService(ctx.db).deliverNoticeToGlip({
  sourceRef: `agent_task:${actionId}:result:resend:${Date.now()}`,
  title: '',
  body,
  mention: true,
  targetUserId: target.targetUserId,
  targetGroupId: target.targetGroupId,
});

console.log(
  JSON.stringify(
    {
      phase: 'sent',
      queueStatus: action.queueStatus,
      target,
      sent: sent.sent,
      error: sent.error,
      body,
    },
    null,
    2,
  ),
);
manager.closeAll();
process.exit(sent.sent ? 0 : 1);
