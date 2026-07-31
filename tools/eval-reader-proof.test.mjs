import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  buildReaderProofModel,
  readerProofLegacyLists,
} from './eval-reader-proof.mjs';

const execFileAsync = promisify(execFile);

test('declared claim is proved only when mapped cases and score thresholds pass', () => {
  const proof = buildReaderProofModel({
    contract: {
      claims: [
        {
          id: 'resume',
          statement: '续聊会重新检索当前证据。',
          caseIds: ['resume-case'],
          requiredScores: { evidence_refresh: 3 },
        },
      ],
      boundaries: ['不覆盖客户端本地存储。'],
    },
    caseResults: [
      {
        caseId: 'resume-case',
        caseTitle: '重新打开后续聊',
        status: 'pass',
        scores: { evidence_refresh: 3 },
      },
    ],
  });

  assert.equal(proof.source, 'suite_contract');
  assert.equal(proof.claims[0].status, 'proved');
  assert.deepEqual(proof.claims[0].evidence[0].scoreChecks[0], {
    scoreKey: 'evidence_refresh',
    minimum: 3,
    actual: 3,
    status: 'pass',
  });
  assert.deepEqual(readerProofLegacyLists(proof), {
    proved: ['续聊会重新检索当前证据。'],
    notProved: ['不覆盖客户端本地存储。'],
  });
});

test('missing cases and failed score thresholds keep a claim out of proved', () => {
  const proof = buildReaderProofModel({
    contract: {
      claims: [
        {
          id: 'complete-flow',
          statement: '继续和新问题两个路径都正确。',
          caseIds: ['continue-case', 'new-case'],
          requiredScores: { context_isolation: 3 },
        },
      ],
      boundaries: ['不覆盖未声明场景。'],
    },
    caseResults: [
      {
        caseId: 'continue-case',
        caseTitle: '继续上一轮',
        status: 'pass',
        scores: { context_isolation: 2 },
      },
    ],
  });

  assert.equal(proof.claims[0].status, 'not_proved');
  assert.match(proof.claims[0].reason, /本次未运行：new-case/);
  assert.match(proof.claims[0].reason, /context_isolation=2，要求 >= 3/);
  assert.deepEqual(readerProofLegacyLists(proof).proved, []);
});

test('legacy suites derive requirement-level conclusions instead of report boilerplate', () => {
  const proof = buildReaderProofModel({
    caseResults: [
      {
        caseId: 'pass-case',
        caseTitle: '续接真实话题',
        status: 'pass',
        userConclusion: '重新打开后可以直接追问，并使用本轮 evidence。',
      },
      {
        caseId: 'fail-case',
        caseTitle: '新问题隔离',
        status: 'fail',
        userConclusion: '新问题仍然继承了上一轮话题。',
      },
    ],
  });
  const legacy = readerProofLegacyLists(proof);

  assert.equal(proof.source, 'case_fallback');
  assert.deepEqual(legacy.proved, ['重新打开后可以直接追问，并使用本轮 evidence。']);
  assert.match(legacy.notProved.join('\n'), /新问题隔离/);
  assert.doesNotMatch(JSON.stringify(legacy), /Reader Contract|样本完成运行|基础 report contract/);
});

test('legacy proofSummary statements and boundaries remain supported', () => {
  const proof = buildReaderProofModel({
    caseResults: [
      {
        caseId: 'legacy-case',
        status: 'pass',
        proofSummary: {
          proves: ['特定领域行为已通过。'],
          doesNotProve: ['不覆盖外部发送。'],
        },
      },
    ],
  });

  assert.equal(proof.claims[0].statement, '特定领域行为已通过。');
  assert.ok(proof.boundaries.includes('不覆盖外部发送。'));
});

test('hide_expected is successful proof for a correctly suppressed negative case', () => {
  const proof = buildReaderProofModel({
    contract: {
      claims: [
        {
          id: 'stay-quiet',
          statement: '没有足够相关记忆时保持静默。',
          caseIds: ['quiet-case'],
          requiredScores: { suppression_correctness: 3 },
        },
      ],
      boundaries: ['不覆盖有强相关记忆的正例。'],
    },
    caseResults: [
      {
        caseId: 'quiet-case',
        caseTitle: '弱相关页面不展示提示',
        status: 'hide_expected',
        scores: { suppression_correctness: 3 },
      },
    ],
  });

  assert.equal(proof.claims[0].status, 'proved');
  assert.equal(proof.claims[0].evidence[0].status, 'hide_expected');
});

test('rerendered HTML shows suite requirements and evidence instead of report boilerplate', async () => {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'eval-reader-proof-'));
  const caseIds = [
    ['ask-continuity-resume-ai-vbg-owner', '续接 AI VBG 后能回答下一步找谁确认'],
    ['ask-continuity-near-expiry-reretrieval', '接近过期的续聊线索仍必须重新检索'],
    ['ask-continuity-new-question-isolation', '新问题不继承上一轮 AI VBG 线索'],
  ];
  const scores = {
    continuity_contract: 3,
    evidence_refresh: 3,
    topic_alignment: 3,
    topic_selection: 3,
    context_isolation: 3,
    answer_quality: 3,
  };
  const summary = {
    suiteId: 'ask-conversation-continuity',
    runId: 'reader-proof-integration',
    title: 'Ask Conversation Continuity Eval',
    startedAt: '2026-07-16T00:00:00.000Z',
    completedAt: '2026-07-16T00:00:01.000Z',
    status: 'pass',
    repairStatus: 'not_requested',
    caseCount: caseIds.length,
    counts: { pass: caseIds.length, warn: 0, fail: 0, error: 0, skipped: 0 },
    failedCaseIds: [],
    reportContract: { status: 'pass', issueCount: 0, checkedCaseCount: caseIds.length },
    runDir,
    reportPath: path.join(runDir, 'report.html'),
  };
  const caseResults = caseIds.map(([caseId, caseTitle]) => ({
    caseId,
    caseTitle,
    suiteId: 'ask-conversation-continuity',
    status: 'pass',
    scores,
    sampleSummary: '真实场景样本',
    expectedBehavior: { userOutcome: '达到声明行为' },
    actualOutput: { answer: '本轮重新检索后的回答。' },
    userConclusion: '需求行为通过。',
    improvementSuggestions: [],
  }));

  try {
    await fs.writeFile(path.join(runDir, 'summary.json'), JSON.stringify(summary));
    await fs.writeFile(path.join(runDir, 'case-results.json'), JSON.stringify(caseResults));
    await execFileAsync(
      process.execPath,
      ['tools/eval-run.mjs', '--rerender', runDir],
      { cwd: process.cwd() },
    );

    const html = await fs.readFile(path.join(runDir, 'report.html'), 'utf8');
    const readerReport = JSON.parse(
      await fs.readFile(path.join(runDir, 'reader-report.json'), 'utf8'),
    );
    assert.equal(readerReport.summary.readerProof.source, 'suite_contract');
    assert.deepEqual(
      readerReport.summary.readerProof.claims.map((claim) => claim.status),
      ['proved', 'proved', 'proved'],
    );
    assert.match(html, /已证明的需求行为/);
    assert.match(html, /当 Quick Ask 已把本机续聊线索/);
    assert.match(html, /ask-continuity-resume-ai-vbg-owner/);
    assert.match(html, /Quick Ask 本机快照的保存、展示/);
    assert.doesNotMatch(html, /个样本完成运行并生成 Reader Contract 卡片/);
    assert.doesNotMatch(html, /所有样本都满足基础 report contract 字段要求/);
  } finally {
    await fs.rm(runDir, { recursive: true, force: true });
  }
});
