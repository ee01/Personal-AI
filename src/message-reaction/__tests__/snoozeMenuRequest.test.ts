import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRenderSnoozeQuickMenuRequest } from '../snoozeMenuRequest.js';

const activeHoverRequest = {
  requestSeq: 3,
  currentSeq: 3,
  activeAnchorMatches: true,
  anchorInDocument: true,
  anchorHovered: true,
};

test('snooze quick menu request renders while the same hovered anchor is current', () => {
  assert.equal(shouldRenderSnoozeQuickMenuRequest(activeHoverRequest), true);
});

test('snooze quick menu request aborts after hover leaves before async snapshot read completes', () => {
  assert.equal(
    shouldRenderSnoozeQuickMenuRequest({
      ...activeHoverRequest,
      anchorHovered: false,
    }),
    false,
  );
});

test('snooze quick menu request aborts after a newer menu request invalidates it', () => {
  assert.equal(
    shouldRenderSnoozeQuickMenuRequest({
      ...activeHoverRequest,
      currentSeq: 4,
    }),
    false,
  );
});

test('snooze quick menu request aborts when another anchor became active', () => {
  assert.equal(
    shouldRenderSnoozeQuickMenuRequest({
      ...activeHoverRequest,
      activeAnchorMatches: false,
    }),
    false,
  );
});

test('snooze quick menu request keeps keyboard and click opens independent of hover', () => {
  assert.equal(
    shouldRenderSnoozeQuickMenuRequest({
      ...activeHoverRequest,
      anchorHovered: false,
      allowWithoutHover: true,
    }),
    true,
  );
});

test('snooze quick menu request aborts while the custom picker is open', () => {
  assert.equal(
    shouldRenderSnoozeQuickMenuRequest({
      ...activeHoverRequest,
      pickerOpen: true,
    }),
    false,
  );
});
