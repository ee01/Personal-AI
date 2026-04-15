import { MeetingSession, MeetingVisualObservation, TranscriptChunk } from './types';
import { applyDomSignals, createMeetingSession } from './session';

export function createHostShareDemoSession(): MeetingSession {
  const session = createMeetingSession({
    tabId: 1,
    meetingId: '363648544',
    meetingUrl: 'https://v.ringcentral.com/conf/on/363648544',
    pageTitle: 'Meeting Pilot host share demo',
    now: Date.UTC(2026, 3, 3, 9, 0, 0),
  });

  return applyDomSignals(session, {
    url: session.meetingUrl,
    meetingId: session.meetingId,
    inMeeting: true,
    shareActive: true,
    shareOwner: 'Esone Qiu',
    selfSharing: 'yes',
    activeSpeaker: 'Alex',
    participantCount: 6,
    participants: [
      { id: 'alex', name: 'Alex', isHost: true },
      { id: 'esone', name: 'Esone Qiu (You)', isSelf: true, isSharing: true },
      { id: 'bella', name: 'Bella' },
    ],
    aiNotesVisible: true,
    captionsVisible: false,
    pageTitle: session.pageTitle,
    updatedAt: Date.now(),
  });
}

export function createParticipantDemoSession(): MeetingSession {
  const session = createMeetingSession({
    tabId: 2,
    meetingId: '491366909',
    meetingUrl: 'https://v.ringcentral.com/conf/on/491366909',
    pageTitle: 'Meeting Pilot participant demo',
    now: Date.UTC(2026, 3, 3, 9, 15, 0),
  });

  return applyDomSignals(session, {
    url: session.meetingUrl,
    meetingId: session.meetingId,
    inMeeting: true,
    shareActive: false,
    selfSharing: 'no',
    activeSpeaker: 'Alex',
    participantCount: 8,
    participants: [
      { id: 'alex', name: 'Alex', isHost: true },
      { id: 'esone', name: 'Esone Qiu (You)', isSelf: true },
      { id: 'dana', name: 'Dana' },
    ],
    aiNotesVisible: true,
    captionsVisible: false,
    pageTitle: session.pageTitle,
    updatedAt: Date.now(),
  });
}

export function createDemoTranscript(): TranscriptChunk[] {
  return [
    {
      seq: 1,
      startMs: 0,
      endMs: 12000,
      speaker: 'Alex',
      text: 'We need to confirm the backend release window and whether the ETA changed.',
      confidence: 0.95,
      language: 'en',
    },
    {
      seq: 2,
      startMs: 12000,
      endMs: 21000,
      speaker: 'Bella',
      text: 'Could you scroll to the blocker section on the checklist?',
      confidence: 0.92,
      language: 'en',
    },
  ];
}

export function createDemoObservation(): MeetingVisualObservation {
  return {
    id: 'demo-observation-1',
    ts: Date.now(),
    sceneType: 'shared_checklist',
    evidenceText: 'Checklist shows owner, ETA, blocker and status columns.',
    visibleEntities: ['BE release', 'owner', 'ETA', 'blocker'],
    keyNumbersAndDates: ['Friday', '4/15'],
    candidateTopics: ['BE release', 'ETA'],
    uiActionsSuggested: ['scroll', 'open release plan'],
    confidence: 0.92,
  };
}
