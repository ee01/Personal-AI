import { useEffect, useState } from 'react';
import {
  MeetingPilotSessionSnapshot,
  MeetingPilotStateResponse,
} from './protocol';

export function getRequestedTabId(): number | undefined {
  const raw = new URLSearchParams(window.location.search).get('tabId');
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function useMeetingPilotState(): [
  MeetingPilotStateResponse | null,
  () => Promise<void>,
] {
  const [state, setState] = useState<MeetingPilotStateResponse | null>(null);
  const requestedTabId = getRequestedTabId();

  const refresh = async () => {
    const snapshot = (await chrome.runtime.sendMessage({
      type: 'MEETING_PILOT_GET_STATE',
      tabId: requestedTabId,
    })) as MeetingPilotStateResponse;
    setState(snapshot);
  };

  useEffect(() => {
    void refresh();
    const listener = (message: any) => {
      if (message.type !== 'MEETING_PILOT_SESSION_SNAPSHOT') {
        return;
      }
      const incoming = message.snapshot as MeetingPilotSessionSnapshot;
      if (requestedTabId && incoming.tabId !== requestedTabId) {
        return;
      }
      setState((current) => {
        const priorSessions = current?.sessions || [];
        const existingIndex = priorSessions.findIndex(
          (item) => item.tabId === incoming.tabId,
        );
        const nextSessions = [...priorSessions];
        if (existingIndex >= 0) {
          nextSessions[existingIndex] = incoming;
        } else {
          nextSessions.push(incoming);
        }
        nextSessions.sort((left, right) => right.updatedAt - left.updatedAt);
        return {
          activeMeetingId:
            incoming.inMeeting && incoming.status !== 'ended'
              ? incoming.meetingId
              : current?.activeMeetingId,
          sessions: nextSessions,
          activeSession: incoming,
        };
      });
    };
    chrome.runtime.onMessage.addListener(listener);
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      window.clearInterval(timer);
    };
  }, []);

  return [state, refresh];
}
