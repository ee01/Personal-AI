import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isRingCentralTranscriptNoiseLine,
  looksLikeMeetingChromeTranscriptDump,
  shouldKeepRingCentralTranscriptText,
} from '../ringCentralTranscriptFilter.ts';

const GALLERY_CHROME_DUMP =
  'Esone Qiu (You) Karan Bhujbal Nasen You Echo Li Venky Iyer Wilson Chen Esther (Xiying) Pan Allen Wang Yarnon Cao Satya Pati Jia Zhang Fred Gu Nicole Zheng XMN - Phuket Coa Ke Daniel Huang 1/2 Unmute Start video Share Invite Participants 22 Chat 11 React Raise hand More Leave Esone Qiu (You) Karan Bhujbal Nasen You Echo Li Venky Iyer Wilson Chen Esther (Xiying) Pan Allen Wang Yarnon Cao Satya Pati Jia Zhang Fred Gu Nicole Zheng XMN - Phuket Coa Ke Daniel Huang 1/2 Joined late? Catch up using meeting notes. View notes Unmute Start video Share Invite Participants 22 Chat 11 React Raise hand More Leave';

const REAL_SPEECH =
  "Of everything that's in GA. But uh, I'm optimistic, therefore that things will go really well. Tomorrow, that's number 1. Second, uh, update from my side on the product side is that, uh, uh, Savio z, uh, principal designer in the United States for video. Uh, for phone for apps, is leaving the company. Uh, and his replacement has not been identified for each of those 3 tracks so far, and that's partly because, uh, there are some other changes on the ux organization, uh, such as aloe leaving, uh, RC access head of design role. So, we've had an attrition of top You know, 1 level from the head of design leads outside the United States. Uh, the plans are unclear as to who will backfill for Sam but he and I work in closely through the transition to ensure minimum amount of disruptions for everybody particularly on the ux side. So I'm talking of your you know, minimum disruption for Eric...";

test('looksLikeMeetingChromeTranscriptDump rejects gallery + toolbar dump', () => {
  assert.equal(looksLikeMeetingChromeTranscriptDump(GALLERY_CHROME_DUMP), true);
  assert.equal(shouldKeepRingCentralTranscriptText(GALLERY_CHROME_DUMP), false);
});

test('shouldKeepRingCentralTranscriptText keeps real speech', () => {
  assert.equal(looksLikeMeetingChromeTranscriptDump(REAL_SPEECH), false);
  assert.equal(shouldKeepRingCentralTranscriptText(REAL_SPEECH), true);
});

test('shouldKeepRingCentralTranscriptText keeps normal CC short sentence', () => {
  assert.equal(
    shouldKeepRingCentralTranscriptText(
      "I'm optimistic that things will go really well tomorrow.",
    ),
    true,
  );
});

test('shouldKeepRingCentralTranscriptText drops time lines and chrome controls', () => {
  assert.equal(shouldKeepRingCentralTranscriptText('11:32 AM'), false);
  assert.equal(isRingCentralTranscriptNoiseLine('Unmute'), true);
  assert.equal(shouldKeepRingCentralTranscriptText('Unmute'), false);
  assert.equal(shouldKeepRingCentralTranscriptText('Start video'), false);
  assert.equal(shouldKeepRingCentralTranscriptText('Leave'), false);
});

test('looksLikeMeetingChromeTranscriptDump rejects joined-late banner blobs', () => {
  assert.equal(
    looksLikeMeetingChromeTranscriptDump(
      'Joined late? Catch up using meeting notes. View notes',
    ),
    true,
  );
});
