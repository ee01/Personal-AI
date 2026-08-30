import { describe, expect, it } from 'vitest';

import { cueValuesMatch, isCueStopword } from '../core/cueMatching.js';

describe('cueValuesMatch', () => {
  it('matches the same person name as a whole token', () => {
    expect(cueValuesMatch('Colin Liu', 'Colin Liu')).toBe(true);
    expect(cueValuesMatch('colin', 'Colin Liu')).toBe(true);
  });

  it('does not treat a company stopword as a hit', () => {
    expect(isCueStopword('ringcentral')).toBe(true);
    expect(cueValuesMatch('ringcentral', 'RingCentral Glip thread')).toBe(false);
  });

  it('does not match a substring of a longer identifier', () => {
    expect(cueValuesMatch('central', 'ringcentral')).toBe(false);
    expect(cueValuesMatch('mail', 'gmail')).toBe(false);
  });

  it('matches CJK as a contiguous run', () => {
    expect(cueValuesMatch('打印机', '三楼的打印机又卡纸了')).toBe(true);
    expect(cueValuesMatch('打', '打印机')).toBe(false);
  });
});
