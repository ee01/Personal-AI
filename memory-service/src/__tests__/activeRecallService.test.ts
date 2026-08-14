import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ActiveRecallService,
  clearActiveRecallSynthesisCacheForTests,
} from '../core/ActiveRecallService.js';
import { RecallEngine } from '../core/RecallEngine.js';
import { getTestDb } from './setup.js';

describe('ActiveRecallService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearActiveRecallSynthesisCacheForTests();
  });

  it('retains a direct raw claim after truncating an over-fetched result set', async () => {
    const recallSpy = vi.spyOn(RecallEngine.prototype, 'recall').mockResolvedValue({
      items: [
        {
          id: 'generic-cursor-project',
          type: 'entity',
          content: 'Cursor project metadata',
          score: 0.9,
        },
        {
          id: 'generic-cursor-license',
          type: 'message',
          content: 'Cursor license metadata',
          score: 0.8,
        },
        {
          id: 'cursor-cost-raw-only',
          type: 'message',
          content: 'Cursor is 30% more expensive than Codex.',
          score: 0.66,
          metadata: {
            lexicalFallback: true,
            lexicalDirectClaim: true,
          },
        },
      ],
      totalFound: 3,
      channels: ['fts'],
      queryTimeMs: 1,
    } as any);

    const result = await new ActiveRecallService(getTestDb()).recall(
      {
        query: 'Cursor 的成本结论是什么？',
        topK: 2,
        blockTypes: ['evidence_list'],
      },
      { skipAnalysis: true },
    );

    expect(result.items.map((item) => item.id)).toEqual([
      'cursor-cost-raw-only',
      'generic-cursor-project',
    ]);
  });

  it('keeps deterministic presentation independent from fast retrieval', async () => {
    const recallSpy = vi
      .spyOn(RecallEngine.prototype, 'recall')
      .mockResolvedValue({
        items: [
          {
            id: 'memory-1',
            type: 'message',
            content: 'Release decision evidence',
            score: 0.9,
          },
        ],
        totalFound: 1,
        channels: ['fts'],
        queryTimeMs: 1,
      } as any);

    const result = await new ActiveRecallService(getTestDb()).recall({
      query: 'release decision',
      topK: 5,
      retrievalMode: 'fast',
      presentationBlocks: ['evidence_list'],
    });

    expect(recallSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: ['fts'],
        topK: 5,
      }),
    );
    expect(result.blocks?.map((block) => block.type)).toEqual([
      'evidence_list',
    ]);
    expect(result.synthesisReceipt?.status).toBe('not_requested');
  });

  it('returns grounded synthesis with explicit receipts', async () => {
    vi.spyOn(RecallEngine.prototype, 'recall').mockResolvedValue({
      items: [
        {
          id: 'memory-1',
          type: 'message',
          content: 'The launch is planned for Friday.',
          score: 0.9,
        },
        {
          id: 'memory-2',
          type: 'message',
          content: 'QA approval is still pending.',
          score: 0.8,
        },
      ],
      totalFound: 2,
      channels: ['vector', 'fts'],
      queryTimeMs: 2,
    } as any);
    const generate = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Launch is planned for Friday, pending QA approval.',
        summaryEvidence: [1, 2],
        keyFindings: [
          { text: 'QA approval remains open.', evidence: [2] },
          { text: 'Unsupported finding is removed.', evidence: [99] },
        ],
        confidence: 0.85,
      }),
    });

    const result = await new ActiveRecallService(getTestDb(), {
      llmClient: { generate },
    }).recall({
      query: 'What is the launch status?',
      topK: 5,
      channels: ['vector', 'fts'],
      retrievalMode: 'balanced',
      presentationBlocks: ['evidence_list'],
      synthesis: { mode: 'summary', trigger: 'user', maxTokens: 400 },
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.analysis).toMatchObject({
      evidenceItemIds: ['memory-1', 'memory-2'],
      keyFindings: ['QA approval remains open.'],
      groundedFindings: [
        { text: 'QA approval remains open.', evidenceItemIds: ['memory-2'] },
      ],
    });
    expect(result.synthesisReceipt).toMatchObject({
      requested: true,
      status: 'succeeded',
      cacheHit: false,
      trigger: 'user',
    });
    expect(result.retrievalTimeMs).toEqual(expect.any(Number));
    expect(result.synthesisTimeMs).toEqual(expect.any(Number));
  });

  it('rejects ungrounded model output and exposes an invalid-output receipt', async () => {
    vi.spyOn(RecallEngine.prototype, 'recall').mockResolvedValue({
      items: [
        {
          id: 'memory-1',
          type: 'message',
          content: 'One grounded memory.',
          score: 0.9,
        },
      ],
      totalFound: 1,
      channels: ['fts'],
      queryTimeMs: 1,
    } as any);
    const generate = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'A claim without valid evidence.',
        summaryEvidence: [99],
      }),
    });

    const result = await new ActiveRecallService(getTestDb(), {
      llmClient: { generate },
    }).recall({
      query: 'grounding check',
      synthesis: { mode: 'summary', trigger: 'api' },
    });

    expect(result.analysis).toBeUndefined();
    expect(result.synthesisReceipt).toMatchObject({
      status: 'invalid_output',
      errorCode: 'invalid_output',
    });
  });

  it('skips synthesis before calling the model when evidence is insufficient', async () => {
    vi.spyOn(RecallEngine.prototype, 'recall').mockResolvedValue({
      items: [
        {
          id: 'memory-1',
          type: 'message',
          content: 'Only one matching memory.',
          score: 0.9,
        },
      ],
      totalFound: 1,
      channels: ['fts'],
      queryTimeMs: 1,
    } as any);
    const generate = vi.fn();

    const result = await new ActiveRecallService(getTestDb(), {
      llmClient: { generate },
    }).recall({
      query: 'insufficient evidence',
      synthesis: {
        mode: 'summary',
        trigger: 'user',
        minEvidenceItems: 3,
      },
    });

    expect(generate).not.toHaveBeenCalled();
    expect(result.synthesisReceipt).toMatchObject({
      requested: true,
      status: 'skipped_insufficient',
      trigger: 'user',
      minimumEvidenceItems: 3,
    });
  });

  it('exposes model failures without returning a synthesized analysis', async () => {
    vi.spyOn(RecallEngine.prototype, 'recall').mockResolvedValue({
      items: [
        {
          id: 'memory-1',
          type: 'message',
          content: 'A valid evidence item.',
          score: 0.9,
        },
      ],
      totalFound: 1,
      channels: ['fts'],
      queryTimeMs: 1,
    } as any);
    const generate = vi.fn().mockRejectedValue(new Error('model unavailable'));

    const result = await new ActiveRecallService(getTestDb(), {
      llmClient: { generate },
    }).recall({
      query: 'failure receipt',
      synthesis: { mode: 'summary', trigger: 'api' },
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.analysis).toBeUndefined();
    expect(result.synthesisReceipt).toMatchObject({
      requested: true,
      status: 'failed',
      errorCode: 'llm_failed',
    });
  });

  it('reuses synthesis only for the same query and evidence snapshot', async () => {
    vi.spyOn(RecallEngine.prototype, 'recall').mockResolvedValue({
      items: [
        {
          id: 'memory-1',
          type: 'message',
          content: 'Stable snapshot.',
          score: 0.9,
        },
      ],
      totalFound: 1,
      channels: ['fts'],
      queryTimeMs: 1,
    } as any);
    const generate = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Stable summary.',
        summaryEvidence: [1],
      }),
    });
    const service = new ActiveRecallService(getTestDb(), {
      llmClient: { generate },
    });
    const query = {
      query: 'same query',
      synthesis: { mode: 'summary' as const, trigger: 'user' as const },
    };

    const first = await service.recall(query);
    const second = await service.recall(query);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(first.synthesisReceipt?.cacheHit).toBe(false);
    expect(second.synthesisReceipt?.cacheHit).toBe(true);
  });

  it('does not reuse synthesis across different user database instances', async () => {
    vi.spyOn(RecallEngine.prototype, 'recall').mockResolvedValue({
      items: [
        {
          id: 'shared-looking-id',
          type: 'message',
          content: 'The same-looking evidence must stay user-isolated.',
          score: 0.9,
        },
      ],
      totalFound: 1,
      channels: ['fts'],
      queryTimeMs: 1,
    } as any);
    const generateFirst = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'First user summary.',
        summaryEvidence: [1],
      }),
    });
    const generateSecond = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Second user summary.',
        summaryEvidence: [1],
      }),
    });
    const query = {
      query: 'isolated query',
      synthesis: { mode: 'summary' as const, trigger: 'user' as const },
    };

    const first = await new ActiveRecallService({} as any, {
      llmClient: { generate: generateFirst },
    }).recall(query);
    const second = await new ActiveRecallService({} as any, {
      llmClient: { generate: generateSecond },
    }).recall(query);

    expect(generateFirst).toHaveBeenCalledTimes(1);
    expect(generateSecond).toHaveBeenCalledTimes(1);
    expect(first.analysis?.summary).toBe('First user summary.');
    expect(second.analysis?.summary).toBe('Second user summary.');
    expect(second.synthesisReceipt?.cacheHit).toBe(false);
  });

  it('keeps legacy summary callers working during migration', async () => {
    const recallSpy = vi
      .spyOn(RecallEngine.prototype, 'recall')
      .mockResolvedValue({
        items: [
          {
            id: 'legacy-1',
            type: 'message',
            content: 'Legacy evidence.',
            score: 0.9,
          },
        ],
        totalFound: 1,
        channels: ['fts'],
        queryTimeMs: 1,
      } as any);
    const generate = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        summary: 'Legacy summary.',
        summaryEvidence: [1],
      }),
    });

    const result = await new ActiveRecallService(getTestDb(), {
      llmClient: { generate },
    }).recall({
      query: 'legacy query',
      topK: 4,
      blockTypes: ['summary', 'evidence_list'],
    });

    expect(recallSpy).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 6 }),
    );
    expect(result.synthesisReceipt).toMatchObject({
      status: 'succeeded',
      trigger: 'api',
    });
  });
});
