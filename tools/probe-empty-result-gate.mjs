/**
 * Replay real AgentTask run results against the deployed notification code and
 * print how the empty-result gate classifies each one. Cases come from a JSON
 * array of `{ label, result, template }`, so a production run ledger entry can
 * be pasted in verbatim.
 *
 * Usage (inside the memory-service container):
 *   node /app/tools/probe-empty-result-gate.mjs /app/tools/probe-cases.json
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const appRoot = process.env.PROBE_APP_ROOT || '/app';
const distRoot = path.join(appRoot, 'dist');

const { isEmptyResultOutcome, shouldNotifyEmptyResult, buildAgentTaskResultAnnouncementBody } =
  await import(path.join(distRoot, 'core/agentTaskNotification.js'));

const casesPath = process.argv[2];
if (!casesPath) throw new Error('usage: probe-empty-result-gate.mjs <cases.json>');
const cases = JSON.parse(readFileSync(casesPath, 'utf8'));

for (const item of cases) {
  const empty = isEmptyResultOutcome(item.result);
  const notifyDefault = shouldNotifyEmptyResult({ mode: 'read' });
  const notifyOptedIn = shouldNotifyEmptyResult({ mode: 'read', notifyWhenEmpty: true });
  console.log('='.repeat(72));
  console.log(`case: ${item.label}`);
  console.log(`isEmptyResultOutcome = ${empty}`);
  console.log(`delivers result notice: default=${empty ? notifyDefault : true} optedIn=${empty ? notifyOptedIn : true}`);
  console.log('--- body if it were delivered ---');
  console.log(
    buildAgentTaskResultAnnouncementBody({
      title: item.label,
      summary: item.result?.summary,
      result: item.result,
      template: item.template,
    }),
  );
}
