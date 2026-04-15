import {
  MeetingPilotChapter,
  MeetingPilotMemoryRef,
  MeetingPilotSessionSnapshot,
  MeetingPilotTranscriptChunk,
  createDemoMeetingSnapshot,
} from './protocol';

export function getDemoMeetingSessionSnapshot(tabId = 0, meetingId = 'demo-000000000'): MeetingPilotSessionSnapshot {
  return createDemoMeetingSnapshot({
    meetingId,
    tabId,
    url: `https://v.ringcentral.com/conf/on/${meetingId}`,
    title: 'Meeting Pilot demo',
  });
}

export function buildDefaultChapters(): MeetingPilotChapter[] {
  return getDemoMeetingSessionSnapshot().chapters;
}

export function buildDefaultTranscript(): MeetingPilotTranscriptChunk[] {
  return getDemoMeetingSessionSnapshot().transcript;
}

export function buildDefaultMemoryRefs(): MeetingPilotMemoryRef[] {
  return getDemoMeetingSessionSnapshot().memoryRefs;
}

