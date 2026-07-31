import { describe, expect, it, vi } from 'vitest';

import { ActiveRecallService } from '../core/ActiveRecallService.js';
import { RecallEngine } from '../core/RecallEngine.js';
import { getTestDb } from './setup.js';

describe('ActiveRecallService', () => {
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
    recallSpy.mockRestore();
  });
});
