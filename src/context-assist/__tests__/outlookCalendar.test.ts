import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCalendarEventsForSync } from '../outlookCalendar.js';

test('calendar sync caps oversized attendee lists without dropping the event', () => {
  const attendees = Array.from({ length: 400 }, (_, index) => ({
    name: `Attendee ${index + 1}`,
    responseStatus: index % 2 === 0 ? 'accepted' : 'none',
  }));

  const [event] = normalizeCalendarEventsForSync([
    {
      externalId: 'large-meeting',
      title: 'PM & UX Session with OpenAI/RingCentral',
      startTime: 1_784_217_600_000,
      attendees,
      metadata: { provider: 'ringcentral_indexeddb' },
    },
  ]);

  assert.equal(event.attendees?.length, 120);
  assert.deepEqual(event.metadata, {
    provider: 'ringcentral_indexeddb',
    attendeeCount: 400,
    attendeesTruncated: true,
  });
});
