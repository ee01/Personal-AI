import { describe, expect, it } from 'vitest';

import type { RecallItem } from '../types/index.js';
import {
  enrichRecallItemGroupProvenance,
  resolveRecallGroupProvenance,
} from '../utils/recallGroupProvenance.js';

function mkItem(over: Partial<RecallItem>): RecallItem {
  return {
    id: over.id || 'x',
    type: 'message',
    content: over.content || 'content',
    score: 0.9,
    source: over.source,
    timestamp: 1_700_000_000,
    ...over,
  } as RecallItem;
}

describe('resolveRecallGroupProvenance', () => {
  it('prefers explicit metadata groupName', () => {
    const item = mkItem({
      source: 'glip',
      sourceTitle: 'Meeting memo 9/16',
      metadata: { groupName: 'Video Weekly Sync Up' },
    });
    expect(resolveRecallGroupProvenance(item)).toBe('Video Weekly Sync Up');
  });

  it('falls back to glip sourceTitle when group_name column was not stored', () => {
    const item = mkItem({
      source: 'glip',
      sourceTitle: 'Video Weekly Sync Up',
      content: 'Next: Finalize AVA delegate beta scope by 9/17 @Karan Bhujbal',
    });
    expect(resolveRecallGroupProvenance(item)).toBe('Video Weekly Sync Up');
  });

  it('does not treat memo-style source titles as group names', () => {
    const item = mkItem({
      source: 'glip',
      sourceTitle: 'Meeting memo 9/16',
      displayTitle: 'Meeting memo 9/16',
    });
    expect(resolveRecallGroupProvenance(item)).toBeUndefined();
  });

  it('strips meeting memory suffix for meeting sources', () => {
    const item = mkItem({
      source: 'meeting-pilot',
      sourceTitle: 'Video Weekly Sync Up — Meeting Memory',
    });
    expect(resolveRecallGroupProvenance(item)).toBe('Video Weekly Sync Up');
  });

  it('backfills metadata.groupName on enrich', () => {
    const item = mkItem({
      source: 'ringcentral',
      sourceTitle: 'MTR-141852: AI Custom VBG',
    });
    const enriched = enrichRecallItemGroupProvenance(item);
    expect(enriched.metadata?.groupName).toBe('MTR-141852: AI Custom VBG');
    expect(enriched.metadata?.group_name).toBe('MTR-141852: AI Custom VBG');
  });
});
