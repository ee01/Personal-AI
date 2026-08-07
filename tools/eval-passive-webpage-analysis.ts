import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  normalizePassiveWebpageAnalysisResult,
  type PassiveWebpageAnalysisResult,
} from '../src/web-intelligence/passiveWebpageAnalysis';

interface EvalCase {
  id: string;
  title: string;
  input: {
    title: string;
    url: string;
    mainContent: string;
  };
  sampleModelOutput: unknown;
  expected: {
    decision: PassiveWebpageAnalysisResult['decision'];
    requiredEntities: string[];
    forbiddenEntities: string[];
    shouldNotify: boolean;
  };
}

const casesUrl = new URL(
  '../evals/cases/passive-webpage-analysis/cases.jsonl',
  import.meta.url,
);
const rows = (await readFile(casesUrl, 'utf8'))
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line) as EvalCase);

const results: Array<{
  id: string;
  title: string;
  status: 'pass' | 'fail';
  decision?: string;
  error?: string;
}> = [];

for (const testCase of rows) {
  try {
    const result = normalizePassiveWebpageAnalysisResult(
      testCase.sampleModelOutput,
      testCase.input.mainContent,
    );
    const flattenedEntities = Object.values(result.entities).flat();
    assert.equal(result.decision, testCase.expected.decision);
    assert.equal(result.shouldNotify, testCase.expected.shouldNotify);
    for (const required of testCase.expected.requiredEntities) {
      assert.ok(
        flattenedEntities.includes(required),
        `missing required page-grounded entity: ${required}`,
      );
    }
    for (const forbidden of testCase.expected.forbiddenEntities) {
      assert.ok(
        !flattenedEntities.includes(forbidden),
        `retained unsupported entity: ${forbidden}`,
      );
    }
    if (result.decision === 'skip') {
      assert.deepEqual(result.durableFacts, []);
      assert.deepEqual(result.actionItems, []);
      assert.deepEqual(result.enrichmentHints, []);
      assert.equal(flattenedEntities.length, 0);
    }
    results.push({
      id: testCase.id,
      title: testCase.title,
      status: 'pass',
      decision: result.decision,
    });
  } catch (error) {
    results.push({
      id: testCase.id,
      title: testCase.title,
      status: 'fail',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

for (const result of results) {
  console.log(
    `${result.status === 'pass' ? 'PASS' : 'FAIL'} ${result.id}: ${
      result.decision || result.error
    }`,
  );
}

const failed = results.filter((result) => result.status === 'fail');
console.log(
  `Passive webpage analysis contract eval: ${results.length - failed.length}/${results.length} passed.`,
);
console.log(
  'Boundary: this deterministic suite validates prompt-output normalization and evidence guards; it does not prove a live provider response.',
);
if (failed.length > 0) process.exitCode = 1;
