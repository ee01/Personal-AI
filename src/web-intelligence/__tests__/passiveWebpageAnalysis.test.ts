import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPassiveWebpageAnalysisKey,
  buildPassiveWebpageAnalysisPrompt,
  normalizePassiveWebpageAnalysisResult,
} from '../passiveWebpageAnalysis.js';

const page = {
  title: 'NOVA-123 rollout blocker',
  url: 'https://jira.example.com/browse/NOVA-123?utm_source=test#activity',
  mainContent:
    'NOVA-123 is blocked by the API migration. Alice owns the migration. Deadline is 2026-08-10.',
};

test('semantic key ignores tracking, fragments, and volatile timestamps', () => {
  const first = buildPassiveWebpageAnalysisKey(page);
  const second = buildPassiveWebpageAnalysisKey({
    ...page,
    url: 'https://jira.example.com/browse/NOVA-123?utm_medium=email',
    mainContent: `${page.mainContent} Updated 3 minutes ago. 12:30:41`,
  });

  assert.equal(first, second);
});

test('semantic key changes for a material page update', () => {
  assert.notEqual(
    buildPassiveWebpageAnalysisKey(page),
    buildPassiveWebpageAnalysisKey({
      ...page,
      mainContent: page.mainContent.replace('blocked', 'ready'),
    }),
  );
});

test('prompt treats page text as untrusted and forbids tools and writes', () => {
  const prompt = buildPassiveWebpageAnalysisPrompt(page);

  assert.match(prompt, /未经信任的网页数据/);
  assert.match(prompt, /不调用工具/);
  assert.match(prompt, /不执行通知、写入或外部动作/);
  assert.match(prompt, /最多 4 条/);
  assert.match(prompt, /skip 时/);
});

test('normalizer removes unsupported context entities and keeps page evidence', () => {
  const result = normalizePassiveWebpageAnalysisResult(
    {
      decision: 'remember',
      summary: 'A migration blocker has an owner and deadline.',
      durableFacts: [
        {
          statement: 'NOVA-123 is blocked by the API migration.',
          evidence: 'NOVA-123 is blocked by the API migration.',
        },
        {
          statement: 'Fabricated context fact.',
          evidence: 'Project Orbit belongs to Bob.',
        },
      ],
      entities: {
        projects: ['NOVA-123', 'Project Orbit'],
        people: ['Alice', 'Bob'],
        technologies: ['API'],
        organizations: [],
        topics: ['migration'],
      },
      actionItems: [
        {
          description: 'Finish the migration.',
          evidence: 'Alice owns the migration.',
          dueDate: '2026-08-10',
        },
      ],
      enrichmentHints: [],
      shouldNotify: true,
      notificationReason: 'Deadline risk',
      confidence: 0.9,
      reason: 'Direct page evidence',
    },
    page.mainContent,
  );

  assert.equal(result.decision, 'remember');
  assert.equal(result.durableFacts.length, 1);
  assert.deepEqual(result.entities.projects, ['NOVA-123']);
  assert.deepEqual(result.entities.people, ['Alice']);
  assert.equal(result.shouldNotify, true);
});

test('skip and evidence-free remember results are forced to an empty skip', () => {
  const skip = normalizePassiveWebpageAnalysisResult(
    {
      decision: 'skip',
      durableFacts: [{ statement: 'Do not keep', evidence: 'NOVA-123' }],
      entities: { projects: ['NOVA-123'] },
      shouldNotify: true,
    },
    page.mainContent,
  );
  const unsupported = normalizePassiveWebpageAnalysisResult(
    {
      decision: 'remember',
      durableFacts: [
        { statement: 'Made up', evidence: 'Not present on this page' },
      ],
      actionItems: [],
    },
    page.mainContent,
  );

  assert.equal(skip.decision, 'skip');
  assert.deepEqual(skip.durableFacts, []);
  assert.equal(skip.shouldNotify, false);
  assert.equal(unsupported.decision, 'skip');
});
