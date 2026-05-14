import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRepeatSubmissionFields } from '../repeatSubmission.js';

test('keeps Repeat_Count for weekly repeat messages', () => {
  assert.deepEqual(
    buildRepeatSubmissionFields({
      isRepeating: true,
      repeatEvery: 2,
      repeatUnit: 'Week',
      repeatCount: 6,
      selectedWeekDays: [1, 3, 5],
      endDate: '2026-06-30',
    }),
    {
      Repeat_Every: 2,
      Repeat_Unit: 'Week',
      Repeat_Count: 6,
      Repeat_Days: '1,3,5',
      End_Date: '2026-06-30',
    },
  );
});

test('clears all repeat fields when repeating is disabled', () => {
  assert.deepEqual(
    buildRepeatSubmissionFields({
      isRepeating: false,
      repeatEvery: 1,
      repeatUnit: 'Week',
      repeatCount: 3,
      selectedWeekDays: [1],
      endDate: '2026-06-30',
    }),
    {
      Repeat_Every: undefined,
      Repeat_Unit: undefined,
      Repeat_Count: undefined,
      Repeat_Days: undefined,
      End_Date: undefined,
    },
  );
});

test('only weekly repeats persist selected weekdays', () => {
  assert.deepEqual(
    buildRepeatSubmissionFields({
      isRepeating: true,
      repeatEvery: 1,
      repeatUnit: 'Month',
      repeatCount: 4,
      selectedWeekDays: [1, 3],
    }),
    {
      Repeat_Every: 1,
      Repeat_Unit: 'Month',
      Repeat_Count: 4,
      Repeat_Days: undefined,
      End_Date: undefined,
    },
  );
});
