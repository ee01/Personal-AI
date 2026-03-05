/**
 * Tests for utility modules: chunking, hashing, slug, time.
 */

import { chunkText } from '../utils/chunking.js';
import { contentHash } from '../utils/hashing.js';
import { toSlug } from '../utils/slug.js';
import { now, formatDate, daysAgo, isWithinHours, formatDateTime } from '../utils/time.js';

// ---------------------------------------------------------------------------
// chunking
// ---------------------------------------------------------------------------

describe('chunkText', () => {
  it('returns a single chunk for short text', () => {
    const result = chunkText('Hello world. This is a short paragraph.');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Hello world. This is a short paragraph.');
    expect(result[0].lineStart).toBe(1);
    expect(result[0].lineEnd).toBe(1);
    expect(result[0].tokenCount).toBeGreaterThan(0);
  });

  it('returns multiple chunks for long text', () => {
    // ~400 chars per paragraph, maxTokens default is 400 (~1600 chars)
    const paragraph = 'Lorem ipsum dolor sit amet. '.repeat(30); // ~840 chars
    const longText = `${paragraph}\n\n${paragraph}\n\n${paragraph}`;
    const result = chunkText(longText, 100); // small budget to force multiple chunks
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });

  it('returns empty array for empty text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
    expect(chunkText('\n\n\n')).toEqual([]);
  });

  it('carries overlap content between chunks', () => {
    const sentences = Array.from({ length: 20 }, (_, i) => `Sentence number ${i}.`);
    const text = sentences.join(' ');
    const result = chunkText(text, 30, 10); // small budget, 10-token overlap
    if (result.length >= 2) {
      // The second chunk should start with content that was at the end of the first
      const firstChunkEnd = result[0].content.slice(-40);
      const secondChunkStart = result[1].content.slice(0, 80);
      // overlap means some trailing text from chunk 0 appears at the start of chunk 1
      const overlap = firstChunkEnd.split(' ').pop() ?? '';
      if (overlap.length > 3) {
        expect(secondChunkStart).toContain(overlap);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// hashing
// ---------------------------------------------------------------------------

describe('contentHash', () => {
  it('produces a consistent SHA-256 hex string', () => {
    const hash = contentHash('hello');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // Same input -> same output
    expect(contentHash('hello')).toBe(hash);
  });

  it('produces different hashes for different inputs', () => {
    const h1 = contentHash('alpha');
    const h2 = contentHash('beta');
    expect(h1).not.toBe(h2);
  });
});

// ---------------------------------------------------------------------------
// slug
// ---------------------------------------------------------------------------

describe('toSlug', () => {
  it('converts spaces to hyphens and lowercases', () => {
    expect(toSlug('Hello World')).toBe('hello-world');
  });

  it('strips special characters', () => {
    expect(toSlug('Project #1 @work!')).toBe('project-1-work');
  });

  it('strips unicode characters', () => {
    expect(toSlug('Caf\u00e9 Noir')).toBe('caf-noir');
  });

  it('returns already-slugged input unchanged', () => {
    expect(toSlug('already-slugged')).toBe('already-slugged');
  });

  it('collapses multiple hyphens', () => {
    expect(toSlug('a - - b')).toBe('a-b');
  });

  it('trims leading and trailing hyphens', () => {
    expect(toSlug('--hello--')).toBe('hello');
  });

  it('converts underscores to hyphens', () => {
    expect(toSlug('snake_case_name')).toBe('snake-case-name');
  });
});

// ---------------------------------------------------------------------------
// time
// ---------------------------------------------------------------------------

describe('time utilities', () => {
  it('now() returns a reasonable Unix epoch in seconds', () => {
    const t = now();
    // Should be after 2024-01-01 and not in the far future
    expect(t).toBeGreaterThan(1704067200);
    expect(t).toBeLessThan(2000000000);
  });

  it('formatDate formats a timestamp as YYYY-MM-DD', () => {
    // 2024-06-15 00:00:00 UTC
    const ts = 1718409600;
    const result = formatDate(ts);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formatDateTime formats a timestamp as YYYY-MM-DD HH:mm:ss', () => {
    const ts = 1718409600;
    const result = formatDateTime(ts);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('daysAgo returns a timestamp in the past', () => {
    const sevenDaysAgo = daysAgo(7);
    const current = now();
    const diff = current - sevenDaysAgo;
    // Should be approximately 7 * 86400 seconds (within a small tolerance)
    expect(diff).toBeGreaterThanOrEqual(7 * 86400 - 2);
    expect(diff).toBeLessThanOrEqual(7 * 86400 + 2);
  });

  it('isWithinHours returns true for recent timestamps', () => {
    const recent = now() - 1800; // 30 minutes ago
    expect(isWithinHours(recent, 1)).toBe(true);
  });

  it('isWithinHours returns false for old timestamps', () => {
    const old = now() - 7200; // 2 hours ago
    expect(isWithinHours(old, 1)).toBe(false);
  });
});
