#!/usr/bin/env node
/**
 * Render an AgentTask result notification body from a saved run payload without
 * touching the DB, the LLM target or Glip. Used to inspect template shape.
 *
 * Usage: node tools/probe-notify-template-render.mjs <payload.json>
 * Payload: { template, title, task, result }
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = process.env.MEMORY_SERVICE_ROOT || path.join(__dirname, '..');
const distRoot = path.join(appRoot, 'dist');
const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error('usage: node tools/probe-notify-template-render.mjs <payload.json>');
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
const {
  buildAgentTaskResultAnnouncementBody,
  extractNotificationEvidence,
  formatSuccessNotificationWithTemplate,
  getExecutionSummary,
} = await import(path.join(distRoot, 'core/agentTaskNotification.js'));

const result = payload.result || {};
const evidence = extractNotificationEvidence(result);
const defaultBody = buildAgentTaskResultAnnouncementBody({
  title: payload.title,
  summary: getExecutionSummary(result),
  result,
  template: payload.template,
});
const body = await formatSuccessNotificationWithTemplate({
  template: payload.template,
  title: payload.title,
  task: payload.task || '',
  defaultBody,
  result,
  userDataManager: undefined,
  userId: 'probe',
  taskId: 'probe',
  actionId: 'probe',
  log: { warn: (obj, msg) => console.warn(msg, obj) },
  generate: async () => {
    throw new Error('probe: LLM call not expected');
  },
});

console.log(JSON.stringify({ evidenceLines: evidence.lines.length }, null, 2));
console.log('----- body -----');
console.log(body);
