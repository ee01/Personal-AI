import { MeetingDomSignals, MeetingParticipant } from './types';
import { extractMeetingIdFromUrl } from './session';

function uniqueNames(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function collectParticipantsFromDocument(doc: Document): MeetingParticipant[] {
  const names = Array.from(doc.querySelectorAll('[aria-label], [title]'))
    .map((node) => node.getAttribute('aria-label') || node.getAttribute('title') || '')
    .filter((value) => /\(You\)|^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/.test(value))
    .slice(0, 12);

  return uniqueNames(names).map((name, index) => ({
    id: `participant-${index}-${name.replace(/\s+/g, '-').toLowerCase()}`,
    name,
    isSelf: /\(You\)/.test(name),
  }));
}

export function parseMeetingDomSignals(doc: Document = document): MeetingDomSignals | null {
  const meetingId = extractMeetingIdFromUrl(doc.location?.href || window.location.href);
  if (!meetingId) {
    return null;
  }

  const bodyText = doc.body?.innerText || '';
  const shareActive = Boolean(
    doc.querySelector('#screen-sharing-panel') ||
    doc.querySelector('section#screensharing') ||
    doc.querySelector('video.screencast') ||
    /waiting for .*'s screen|is sharing|screen sharing/i.test(bodyText),
  );
  const shareOwner =
    bodyText.match(/Waiting for ([^'’]+?)'s screen/i)?.[1]?.trim() ||
    bodyText.match(/([A-Za-z0-9._ -]+?) is sharing/i)?.[1]?.trim();
  const activeSpeaker =
    bodyText.match(/currently speaking[:\s]+([^\n]+)/i)?.[1]?.trim() ||
    bodyText.match(/speaker[:\s]+([^\n]+)/i)?.[1]?.trim();
  const participants = collectParticipantsFromDocument(doc);
  const participantCount = participants.length || Number(bodyText.match(/Participants\s*\(?(\d+)/i)?.[1] || 0);

  return {
    url: doc.location?.href || window.location.href,
    meetingId,
    inMeeting: /Leave meeting|Participants|Chat|Notes/i.test(bodyText),
    shareActive,
    shareOwner,
    selfSharing: shareActive && /\(You\)|your screen|you are sharing/i.test(bodyText) ? 'yes' : shareActive ? 'unknown' : 'no',
    activeSpeaker,
    participantCount,
    participants,
    aiNotesVisible: /AI Notes|Notes/i.test(bodyText),
    captionsVisible: /captions|subtitle|transcription/i.test(bodyText),
    pageTitle: doc.title,
    updatedAt: Date.now(),
  };
}

export function inferScreenShareRequest(text: string, aliases: string[] = []): boolean {
  const lowered = text.toLowerCase();
  const asksForAction = ['scroll', 'open', 'click', 'switch', 'navigate', 'refresh'].some((token) => lowered.includes(token));
  const targetsSelf = ['you', 'your'].some((token) => lowered.includes(token)) || aliases.some((alias) => lowered.includes(alias.toLowerCase()));
  return asksForAction && targetsSelf;
}
