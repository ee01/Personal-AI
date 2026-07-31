import {
  MeetingPilotChapter,
  MeetingPilotMemoryRef,
  MeetingPilotSessionSnapshot,
  MeetingPilotTranscriptChunk,
  createDemoMeetingSnapshot,
} from './protocol';
import type { MeetingOutcomeBinder } from '../services/MemoryServiceClient';

function buildDemoMeetingOutcomeBinder(
  meetingId: string,
): MeetingOutcomeBinder {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: 'demo-outcome-binder',
    userId: 'demo',
    prepId: 'demo-meeting-prep',
    eventExternalId: 'demo-q3-planning',
    eventSeriesKey: 'demo-q3-series',
    eventTitle: '2026 Q3 planning for video mobile',
    eventStartAt: now - 3600,
    meetingId,
    status: 'partial',
    slots: [
      {
        id: 'demo-slot-estimate',
        title: '确认 Dev / QA estimate 口径',
        type: 'decision',
        status: 'resolved',
        mentionState: 'supported',
        sourceEvidenceIds: ['calendar:demo-q3-planning'],
        evidence: [
          {
            id: 'D1',
            kind: 'decision',
            refId: 'demo-decision-estimate',
            label: '决议',
            snippet: 'QA estimate 统一按 5 人天进入 Q3 planning。',
          },
        ],
        resultSummary: 'Dev / QA 估时口径已统一，QA 按 5 人天进入排期。',
        confidence: 0.91,
      },
      {
        id: 'demo-slot-capacity',
        title: '确认 team capacity 和 owner',
        type: 'action',
        status: 'partially_resolved',
        mentionState: 'supported',
        sourceEvidenceIds: ['calendar:demo-q3-planning'],
        evidence: [
          {
            id: 'A1',
            kind: 'action',
            refId: 'demo-action-capacity',
            label: '行动项',
            snippet: 'Alex 在周五前补齐 mobile team capacity，状态 pending。',
          },
        ],
        resultSummary: 'owner 已明确，但 capacity 数字仍待 Alex 补齐。',
        confidence: 0.78,
      },
      {
        id: 'demo-slot-risk',
        title: '确认 rollout risk 是否阻塞 Q3',
        type: 'open_question',
        status: 'carried_over',
        mentionState: 'mentioned',
        sourceEvidenceIds: ['calendar:demo-q3-planning'],
        evidence: [
          {
            id: 'T1',
            kind: 'transcript',
            refId: 'demo-transcript-risk',
            label: 'Transcript',
            snippet: 'rollout risk 下次 planning 继续核对。',
          },
        ],
        resultSummary: '风险有提及但没有形成结论，已带到下次 planning。',
        confidence: 0.64,
      },
    ],
    sourceEvidence: [],
    sourceHash: 'demo-outcome-source',
    bindingMode: 'deterministic_fallback',
    generatedAt: now - 7200,
    boundAt: now - 120,
    createdAt: now - 7200,
    updatedAt: now - 120,
    receipt: {
      source: 'Meeting Pilot：会前目标与本场 transcript、决议、行动项的证据装订。',
      coverage: '1 项已闭环，2 项仍需继续。',
      freshness: '刚刚装订',
      boundary:
        '当前为 Personal AI 只读派生结果；不会写回 Calendar、Jira、RingCentral、消息或外部任务。',
    },
  };
}

export function getDemoMeetingSessionSnapshot(tabId = 0, meetingId = 'demo-000000000'): MeetingPilotSessionSnapshot {
  return createDemoMeetingSnapshot({
    meetingId,
    tabId,
    url: `https://v.ringcentral.com/conf/on/${meetingId}`,
    title: 'Meeting Pilot demo',
    outcomeBinder: buildDemoMeetingOutcomeBinder(meetingId),
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
