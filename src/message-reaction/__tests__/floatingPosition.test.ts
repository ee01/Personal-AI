import test from 'node:test';
import assert from 'node:assert/strict';

import { computeFloatingPosition } from '../floatingPosition.js';

test('computeFloatingPosition keeps a menu below the anchor when it fits', () => {
  assert.deepEqual(
    computeFloatingPosition(
      { left: 40, right: 80, top: 50, bottom: 70 },
      { width: 120, height: 80 },
      { width: 320, height: 240 },
    ),
    {
      left: 40,
      top: 74,
      placement: 'below',
    },
  );
});

test('computeFloatingPosition moves a menu above near the viewport bottom', () => {
  assert.deepEqual(
    computeFloatingPosition(
      { left: 40, right: 80, top: 190, bottom: 212 },
      { width: 120, height: 80 },
      { width: 320, height: 240 },
    ),
    {
      left: 40,
      top: 106,
      placement: 'above',
    },
  );
});

test('computeFloatingPosition clamps horizontal overflow for right alignment', () => {
  assert.deepEqual(
    computeFloatingPosition(
      { left: 280, right: 330, top: 40, bottom: 60 },
      { width: 140, height: 80 },
      { width: 320, height: 240 },
      { align: 'right' },
    ),
    {
      left: 170,
      top: 64,
      placement: 'below',
    },
  );
});
