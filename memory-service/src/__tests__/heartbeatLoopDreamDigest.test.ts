import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeartbeatLoop } from '../core/HeartbeatLoop.js';
import { NotificationCenterService } from '../core/NotificationCenterService.js';
import { UserDataManager } from '../storage/UserDataManager.js';
import { getTestDb } from './setup.js';

describe('HeartbeatLoop dream digest', () => {
  const db = getTestDb();
  let tempDir = '';
  let userDataManager: UserDataManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25, 8, 30, 0));
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dream-digest-'));
    userDataManager = new UserDataManager();
    userDataManager.initialize(tempDir);
    userDataManager.writeFile(
      'config.json',
      JSON.stringify({
        dreamDigestEnabled: true,
        dreamDigestScheduleType: 'weekly',
        dreamDigestPushTarget: 'me',
      }),
    );
    db.prepare('DELETE FROM notification_records').run();
    db.prepare('DELETE FROM channel_delivery_records').run();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function writeDream(filename: string, title: string, generated?: string) {
    userDataManager.writeFile(
      `dreams/${filename}`,
      `# Dream: ${title}

${generated ? `_Generated: ${generated}_\n` : ''}
## Narrative
${title} narrative.

## Insights
- ${title} insight.
`,
    );
  }

  it('limits weekly digest content to current digest period dreams', () => {
    writeDream('old-strategy-2026-05-10.md', 'Old Strategy', '2026-05-10');
    writeDream(
      'sunday-risk-2026-05-24.md',
      'Sunday Risk',
      '2026-05-24',
    );
    writeDream(
      'current-launch-2026-05-25.md',
      'Current Launch',
      '2026-05-25',
    );
    writeDream('undated-note.md', 'Undated Note');

    const loop = new HeartbeatLoop(db, userDataManager);
    const candidate = (loop as any).buildDreamDigestCandidate({
      ignoreScheduleWindow: true,
      ignoreIdempotency: true,
      ignorePushDisabled: true,
      manual: true,
    });

    expect(candidate).not.toBeNull();
    expect(candidate.body).toBe('2 dream(s) generated this period');

    const digestBody = String(candidate.payload.digestBody);
    expect(digestBody).toContain('Current Launch');
    expect(digestBody).toContain('Sunday Risk');
    expect(digestBody).not.toContain('Old Strategy');
    expect(digestBody).not.toContain('Undated Note');
    expect(digestBody.indexOf('Current Launch')).toBeLessThan(
      digestBody.indexOf('Sunday Risk'),
    );
  });

  it('does not create a notification or Bot send when manual push target is none', async () => {
    writeDream(
      'current-launch-2026-05-25.md',
      'Current Launch',
      '2026-05-25',
    );
    const glipSpy = vi.spyOn(
      NotificationCenterService.prototype,
      'deliverNoticeToGlip',
    );

    const loop = new HeartbeatLoop(db, userDataManager, 'esone.qiu');
    const result = await loop.triggerDreamDigestNow('esone.qiu', {
      pushTarget: 'none',
    });

    expect(result).toMatchObject({
      generated: true,
      delivered: false,
      botSent: false,
      pushTarget: 'none',
    });
    expect(glipSpy).not.toHaveBeenCalled();
    const row = db
      .prepare("SELECT COUNT(*) AS cnt FROM notification_records WHERE type = 'dream_digest'")
      .get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });

  it('routes manual dream digest Bot delivery to the selected group', async () => {
    writeDream(
      'current-launch-2026-05-25.md',
      'Current Launch',
      '2026-05-25',
    );
    const glipSpy = vi
      .spyOn(NotificationCenterService.prototype, 'deliverNoticeToGlip')
      .mockResolvedValue({ sent: true, messageId: 'group-message-1' });

    const loop = new HeartbeatLoop(db, userDataManager, 'esone.qiu');
    const result = await loop.triggerDreamDigestNow('esone.qiu', {
      pushTarget: 'group',
      pushGroupId: 'team-123',
    });

    expect(result).toMatchObject({
      generated: true,
      delivered: true,
      botSent: true,
      pushTarget: 'group',
    });
    expect(glipSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        targetUserId: undefined,
        targetGroupId: 'team-123',
      }),
    );
    const row = db
      .prepare("SELECT COUNT(*) AS cnt FROM notification_records WHERE type = 'dream_digest'")
      .get() as { cnt: number };
    expect(row.cnt).toBe(1);
  });
});
