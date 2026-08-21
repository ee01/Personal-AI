import { describe, expect, it } from 'vitest';

import { buildHumanOutreachFollowupText } from '../core/outreachFollowupText.js';

describe('buildHumanOutreachFollowupText', () => {
  it('sends the original question without a machine prefix', () => {
    expect(
      buildHumanOutreachFollowupText('嗯好，帮忙问下，怎么突然没了'),
    ).toBe('嗯好，帮忙问下，怎么突然没了');
  });

  it('strips leftover Follow-up prefixes from older sessions', () => {
    expect(
      buildHumanOutreachFollowupText('Follow-up: 嗯好，帮忙问下，怎么突然没了'),
    ).toBe('嗯好，帮忙问下，怎么突然没了');
    expect(buildHumanOutreachFollowupText('追问：还有更新吗？')).toBe(
      '还有更新吗？',
    );
  });
});
