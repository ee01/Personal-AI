import { MeetingMemoryReference, MeetingSession, MeetingVisualObservation, TranscriptChunk } from './types';

export interface MeetingRecallQuery {
  text: string;
  transcriptSummary: string;
  observationSummary: string;
  meetingId: string;
}

function clip(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

export function summarizeTranscript(chunks: TranscriptChunk[], maxLength = 420): string {
  return clip(chunks.slice(-6).map((chunk) => `${chunk.speaker ? `${chunk.speaker}: ` : ''}${chunk.text}`).join(' '), maxLength);
}

export function summarizeObservation(observation?: MeetingVisualObservation, maxLength = 240): string {
  if (!observation) {
    return '';
  }
  return clip([
    observation.sceneType,
    observation.evidenceText,
    observation.visibleEntities.join(', '),
    observation.keyNumbersAndDates.join(', '),
  ].filter(Boolean).join(' | '), maxLength);
}

export function buildMeetingRecallQuery(input: {
  session: MeetingSession;
  transcript: TranscriptChunk[];
  observation?: MeetingVisualObservation;
}): MeetingRecallQuery {
  const transcriptSummary = summarizeTranscript(input.transcript);
  const observationSummary = summarizeObservation(input.observation);
  const text = [
    `meeting ${input.session.meetingId}`,
    input.session.insights.currentTopic,
    transcriptSummary,
    observationSummary,
    input.session.activeSpeaker,
    input.session.shareOwner,
  ].filter(Boolean).join(' | ');

  return {
    text,
    transcriptSummary,
    observationSummary,
    meetingId: input.session.meetingId,
  };
}

export function mergeMemoryReferences(references: MeetingMemoryReference[]): MeetingMemoryReference[] {
  return references
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .filter((reference, index, list) => list.findIndex((item) => item.title === reference.title) === index)
    .slice(0, 4);
}
