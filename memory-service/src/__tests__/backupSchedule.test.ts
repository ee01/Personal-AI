import { describe, expect, it } from 'vitest';

import { computeNextBackupAt, isBackupDue } from '../core/backup/backupSchedule.js';

describe('backupSchedule', () => {
  it('is due immediately when never succeeded', () => {
    const now = new Date('2026-08-25T10:00:00.000Z');
    expect(
      isBackupDue(
        { enabled: true, scheduleType: 'daily', preferredHour: 3, intervalHours: 24 },
        undefined,
        now,
      ),
    ).toBe(true);
  });

  it('is not due before the next daily window and due after it', () => {
    const last = '2026-08-25T03:00:00.000Z';
    const config = {
      enabled: true,
      scheduleType: 'daily' as const,
      preferredHour: 3,
      intervalHours: 24,
    };
    expect(isBackupDue(config, last, new Date('2026-08-25T10:00:00.000Z'))).toBe(
      false,
    );
    expect(isBackupDue(config, last, new Date('2026-08-26T03:00:00.000Z'))).toBe(
      true,
    );
  });

  it('catches up after a missed window', () => {
    const last = '2026-08-23T03:00:00.000Z';
    expect(
      isBackupDue(
        { enabled: true, scheduleType: 'daily', preferredHour: 3, intervalHours: 24 },
        last,
        new Date('2026-08-25T10:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('uses interval hours and skips disabled users', () => {
    const last = '2026-08-25T08:00:00.000Z';
    const every = {
      enabled: true,
      scheduleType: 'every_x_hours' as const,
      preferredHour: 3,
      intervalHours: 6,
    };
    expect(isBackupDue(every, last, new Date('2026-08-25T13:00:00.000Z'))).toBe(
      false,
    );
    expect(isBackupDue(every, last, new Date('2026-08-25T14:00:00.000Z'))).toBe(
      true,
    );
    expect(
      computeNextBackupAt(
        { enabled: false, scheduleType: 'daily', preferredHour: 3, intervalHours: 24 },
        last,
      ),
    ).toBeNull();
  });
});
