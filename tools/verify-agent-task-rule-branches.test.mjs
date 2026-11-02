import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const template = JSON.parse(readFileSync('src/scheduled-messages/jira-rule-template.json', 'utf8'));
const branches = [];
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'jira.condition.if.block' && node.conditions?.some(c => c.value?.first === '{{agentProvider}}')) branches.push(node);
  for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
}
visit(template);
const legacy = branches.find(n => n.conditions.some(c => c.value?.first === '{{agentProvider}}' && c.value.operator === 'NOT_EQUALS'));
const multica = branches.find(n => n !== legacy);

// Exercise the ordered Jira if/else containers against synthetic receipts.
// No network or original task execution is involved.
function run(branch, response, scheme = 'https') {
  const sent = [];
  const values = { multicaWebhookScheme: scheme, webhookResponse: { body: {} } };
  const smart = value => String(value).replace(/\{\{([^}]+)\}\}/g, (_, key) => String(key.split('.').reduce((v, k) => v?.[k], values) ?? ''));
  const matches = node => {
    const checks = (node.conditions || []).map(c => {
      const { first, second, operator } = c.value;
      return operator === 'EQUALS' ? smart(first) === second : smart(first) !== second;
    });
    return node.value?.conditionMatchType === 'ANY' ? checks.some(Boolean) : checks.every(Boolean);
  };
  function steps(nodes) {
    for (const node of nodes) {
      if (node.type === 'jira.condition.container.block') {
        const selected = node.children.find(matches);
        if (selected) steps(selected.children);
      } else if (node.type === 'jira.issue.outgoing.webhook') {
        sent.push(node.value.url);
        if (node.value.method === 'POST') values.webhookResponse.body = response;
      } else {
        assert.fail('Nested if branches must be inside a Jira condition.container.block');
      }
    }
  }
  steps(branch.children);
  return { posts: sent.filter(u => !u.includes('action=confirmBotMessageTriggered')), callbacks: sent.filter(u => u.includes('action=confirmBotMessageTriggered')) };
}

test('legacy acceptance and rejection each reach exactly one confirmation after submission', () => {
  for (const accepted of [true, false]) {
    const result = run(legacy, { data: { outputs: { accepted } } });
    assert.equal(result.posts.length, 1);
    assert.equal(result.callbacks.length, 1);
    assert.ok(result.callbacks[0].includes('success=' + accepted));
  }
});

test('Multica scheme selection completes before receipt selection; skipped and ignored are alternatives', () => {
  for (const scheme of ['http', 'https']) {
    for (const status of ['accepted', 'duplicate', 'skipped', 'ignored']) {
      const result = run(multica, { status, run_id: 'run-1' }, scheme);
      assert.equal(result.posts.length, 1);
      assert.ok(result.posts[0].startsWith(scheme + '://'));
      assert.equal(result.callbacks.length, 1);
      assert.ok(result.callbacks[0].includes('success=' + ['accepted', 'duplicate'].includes(status)));
    }
  }
});

test('unknown or unproven Multica receipts never write false success', () => {
  for (const receipt of [{ status: 'accepted' }, { status: 'duplicate' }, { status: 'mystery' }, {}]) {
    assert.equal(run(multica, receipt).callbacks.length, 0);
  }
});
