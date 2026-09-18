import { describe, expect, it } from 'vitest';

import type { RecallItem } from '../types/index.js';
import {
  enrichRecallItemEntityProvenance,
  resolveRecallEntityName,
  resolveRecallEntitySummary,
} from '../utils/recallEntityProvenance.js';

function mkEntityItem(over: Partial<RecallItem>): RecallItem {
  return {
    id: 'entity-1',
    type: 'entity',
    content: 'Milo · [RCV-BE-VAS] Establish a Reliable Pre-Merge Quality Assurance System',
    score: 1,
    source: 'entity',
    ...over,
  } as RecallItem;
}

describe('recallEntityProvenance', () => {
  it('uses entity.name instead of generic type label', () => {
    const item = mkEntityItem({
      entity: {
        id: 'entity-1',
        type: 'project',
        name: 'RCV-BE-VAS QA System',
        description: 'Pre-merge QA system for RCV backend validation.',
        importance: 0.8,
        accessCount: 0,
        mentionCount: 3,
        status: 'active',
        createdAt: 1,
      },
    });
    expect(resolveRecallEntityName(item)).toBe('RCV-BE-VAS QA System');
    expect(resolveRecallEntitySummary(item)).toContain('Pre-merge QA system');
  });

  it('backfills displayTitle and entitySummary metadata on enrich', () => {
    const enriched = enrichRecallItemEntityProvenance(
      mkEntityItem({
        displayTitle: 'entity',
        entity: {
          id: 'entity-2',
          type: 'person',
          name: 'Karan Bhujbal',
          description: 'Owns AVA delegate beta scope follow-up.',
          importance: 0.7,
          accessCount: 0,
          mentionCount: 5,
          status: 'active',
          createdAt: 1,
        },
      }),
    );
    expect(enriched.displayTitle).toBe('Karan Bhujbal');
    expect(enriched.metadata?.entitySummary).toContain('AVA delegate beta scope');
  });
});
