import { describe, expect, it } from 'vitest';

import { parseJsonFromLlmText } from '../llm/parseLlmJson.js';

describe('parseJsonFromLlmText', () => {
  it('parses plain JSON', () => {
    expect(parseJsonFromLlmText<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips closed markdown fence', () => {
    const raw = '```json\n{"entities":[]}\n```';
    expect(parseJsonFromLlmText(raw)).toEqual({ entities: [] });
  });

  it('handles opening fence without closing backticks', () => {
    const raw = '```json\n{"entities":[{"name":"x"}]';
    expect(parseJsonFromLlmText(raw)).toEqual({ entities: [{ name: 'x' }] });
  });

  it('extracts first object when model adds prose', () => {
    const raw = 'Here is the result:\n{"ok":true}\nThanks!';
    expect(parseJsonFromLlmText(raw)).toEqual({ ok: true });
  });

  it('extracts fenced fragment when only opening fence present', () => {
    const raw = '```\n{"candidates":[]}';
    expect(parseJsonFromLlmText(raw)).toEqual({ candidates: [] });
  });
});
