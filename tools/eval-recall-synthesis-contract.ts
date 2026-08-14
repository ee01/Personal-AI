import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ActiveRecallService,
  clearActiveRecallSynthesisCacheForTests,
} from '../memory-service/src/core/ActiveRecallService.js';
import {
  cleanupTestDb,
  getTestDb,
} from '../memory-service/src/__tests__/setup.js';

interface RecallSynthesisEvalCase {
  id: string;
  title: string;
  query: string;
  evidence: string[];
  request: {
    presentationBlocks?: Array<'evidence_list' | 'timeline' | 'media'>;
    synthesis?: {
      mode: 'none' | 'summary';
      trigger?: 'user' | 'api';
      maxTokens?: number;
      minEvidenceItems?: number;
    };
  };
  sampleModelOutput?: unknown;
  repeatRequest?: boolean;
  expected: {
    synthesisStatus: string;
    llmCalls: number;
    analysisGrounded?: boolean;
    presentationBlock?: 'evidence_list' | 'timeline' | 'media';
    secondRequestCacheHit?: boolean;
  };
}

const casesUrl = new URL(
  '../evals/cases/recall-synthesis-contract/cases.jsonl',
  import.meta.url,
);
const cases = (await readFile(casesUrl, 'utf8'))
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line) as RecallSynthesisEvalCase);
const caseArgIndex = process.argv.indexOf('--case');
const selectedCaseId = caseArgIndex >= 0 ? process.argv[caseArgIndex + 1] : '';
const jsonOutput = process.argv.includes('--json');
const selectedCases = selectedCaseId
  ? cases.filter((testCase) => testCase.id === selectedCaseId)
  : cases;
if (selectedCaseId && selectedCases.length === 0) {
  throw new Error(`Unknown Recall synthesis eval case: ${selectedCaseId}`);
}

const db = getTestDb();
const results: Array<{
  id: string;
  title: string;
  status: 'pass' | 'fail';
  actual?: string;
  details?: {
    synthesisStatus?: string;
    llmCalls: number;
    evidenceCount: number;
    summary?: string;
    secondRequestCacheHit?: boolean;
  };
  error?: string;
}> = [];

try {
  for (const [caseIndex, testCase] of selectedCases.entries()) {
    try {
      clearActiveRecallSynthesisCacheForTests();
      // getTestDb() is intentionally shared; isolate each eval corpus so an
      // earlier case cannot raise a later case above its evidence threshold.
      db.exec('DELETE FROM chunks_fts; DELETE FROM chunks;');
      const now = Math.floor(Date.now() / 1000);
      for (const [evidenceIndex, content] of testCase.evidence.entries()) {
        const chunkId = 80_000 + caseIndex * 100 + evidenceIndex;
        db.prepare(
          `INSERT INTO chunks
            (chunk_id, file_path, line_start, line_end, content, content_hash, scope, source, source_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          chunkId,
          `eval/${testCase.id}/${evidenceIndex}`,
          1,
          1,
          content,
          `eval-${testCase.id}-${evidenceIndex}`,
          'work',
          'manual',
          'manual',
          now - evidenceIndex,
        );
        db.prepare(`INSERT INTO chunks_fts(rowid, content) VALUES (?, ?)`).run(
          chunkId,
          content,
        );
      }

      let llmCalls = 0;
      const generate = async () => {
        llmCalls += 1;
        return {
          content: JSON.stringify(testCase.sampleModelOutput ?? {}),
        };
      };
      const service = new ActiveRecallService(db, {
        llmClient: { generate },
      });
      const request = {
        query: testCase.query,
        topK: 10,
        retrievalMode: 'fast' as const,
        presentationBlocks: testCase.request.presentationBlocks,
        synthesis: testCase.request.synthesis,
      };

      const first = await service.recall(request);
      const second = testCase.repeatRequest
        ? await service.recall(request)
        : undefined;

      assert.equal(
        first.synthesisReceipt?.status,
        testCase.expected.synthesisStatus,
      );
      assert.equal(llmCalls, testCase.expected.llmCalls);
      if (testCase.expected.presentationBlock) {
        assert.ok(
          first.blocks?.some(
            (block) => block.type === testCase.expected.presentationBlock,
          ),
          `missing ${testCase.expected.presentationBlock} block`,
        );
      }
      if (testCase.expected.analysisGrounded) {
        assert.ok(first.analysis, 'expected a synthesized analysis');
        assert.ok(
          (first.analysis.evidenceItemIds?.length ?? 0) > 0,
          'analysis has no evidence item IDs',
        );
        const returnedIds = new Set(first.items.map((item) => item.id));
        for (const evidenceId of first.analysis.evidenceItemIds ?? []) {
          assert.ok(
            returnedIds.has(evidenceId),
            `analysis references an item outside the returned snapshot: ${evidenceId}`,
          );
        }
      } else {
        assert.equal(first.analysis, undefined);
      }
      if (testCase.repeatRequest) {
        assert.equal(
          second?.synthesisReceipt?.cacheHit,
          testCase.expected.secondRequestCacheHit,
        );
      }

      results.push({
        id: testCase.id,
        title: testCase.title,
        status: 'pass',
        actual: `${first.synthesisReceipt?.status}; llmCalls=${llmCalls}`,
        details: {
          synthesisStatus: first.synthesisReceipt?.status,
          llmCalls,
          evidenceCount: first.items.length,
          summary: first.analysis?.summary,
          secondRequestCacheHit: second?.synthesisReceipt?.cacheHit,
        },
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
} finally {
  cleanupTestDb();
}

const failed = results.filter((result) => result.status === 'fail');
if (jsonOutput) {
  console.log(
    JSON.stringify({
      results,
      passed: results.length - failed.length,
      total: results.length,
      boundary:
        'Synthetic evidence and model output validate routing, evidence gates, grounding receipts, and cache reuse; live-model prose quality is not proved.',
    }),
  );
} else {
  for (const result of results) {
    console.log(
      `${result.status === 'pass' ? 'PASS' : 'FAIL'} ${result.id}: ${
        result.actual || result.error
      }`,
    );
  }
  console.log(
    `Recall synthesis contract eval: ${results.length - failed.length}/${results.length} passed.`,
  );
  console.log(
    'Boundary: this deterministic suite validates routing, evidence gates, grounding receipts, and cache reuse with synthetic evidence and model output; it does not prove live-model prose quality.',
  );
}
if (failed.length > 0) process.exitCode = 1;
