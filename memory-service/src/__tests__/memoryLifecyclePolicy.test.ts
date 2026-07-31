import { describe, expect, it } from 'vitest';

import {
  classifyMemoryLifecycle,
  decideMemoryLifecycle,
} from '../core/MemoryLifecyclePolicy.js';

describe('MemoryLifecyclePolicy', () => {
  it('maps salience thresholds to retrieval tiers', () => {
    expect(
      classifyMemoryLifecycle({ salienceScore: 0.01 }).tier,
    ).toBe('forgotten');
    expect(
      classifyMemoryLifecycle({ salienceScore: 0.1 }).tier,
    ).toBe('archive_only');
    expect(
      classifyMemoryLifecycle({ salienceScore: 0.2, createdAt: 1, currentTime: 2 }).tier,
    ).toBe('weak');
    expect(
      classifyMemoryLifecycle({ salienceScore: 0.6 }).tier,
    ).toBe('active');
  });

  it('downgrades old low-salience memory to historical', () => {
    const currentTime = 2_000_000;
    const createdAt = currentTime - 220 * 86400;

    const classified = classifyMemoryLifecycle({
      salienceScore: 0.2,
      createdAt,
      currentTime,
    });

    expect(classified.tier).toBe('historical');
  });

  it('keeps recent positive feedback active for a short floor', () => {
    const currentTime = 2_000_000;
    const classified = classifyMemoryLifecycle({
      salienceScore: 0.12,
      createdAt: currentTime - 120 * 86400,
      feedbackAction: 'positive',
      feedbackUpdatedAt: currentTime - 3 * 86400,
      currentTime,
    });

    expect(classified.tier).toBe('active');
    expect(classified.effectiveSalience).toBeGreaterThanOrEqual(0.4);
  });

  it('suppresses negative feedback on passive and composer surfaces', () => {
    const passive = decideMemoryLifecycle(
      {
        salienceScore: 0.8,
        retrievalTier: 'active',
        feedbackAction: 'negative',
      },
      'passive_surface',
    );
    const composer = decideMemoryLifecycle(
      {
        salienceScore: 0.8,
        retrievalTier: 'active',
        feedbackAction: 'negative',
      },
      'composer_surface',
    );

    expect(passive.allowed).toBe(false);
    expect(composer.allowed).toBe(false);
  });

  it('allows archive-only memory only for historical or explicit search modes', () => {
    const active = decideMemoryLifecycle(
      { salienceScore: 0.1, retrievalTier: 'archive_only' },
      'active_default',
    );
    const historical = decideMemoryLifecycle(
      { salienceScore: 0.1, retrievalTier: 'archive_only' },
      'historical',
    );

    expect(active.allowed).toBe(false);
    expect(historical.allowed).toBe(true);
    expect(historical.weight).toBe(0.55);
  });
});
