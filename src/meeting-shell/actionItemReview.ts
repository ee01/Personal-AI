import type {
  MeetingPilotActionItem,
  MeetingPilotTimelineEvent,
} from './protocol';

export type ActionReviewWarning =
  | 'missing-owner'
  | 'missing-deadline'
  | 'missing-evidence';

const MAX_MEETING_ACTION_ITEMS = 12;
const MAX_MEETING_TIMELINE_EVENTS = 12;
const UNASSIGNED_ACTION_OWNER = '待分配';

export function normalizeActionItemReviewState(
  value: unknown,
): MeetingPilotActionItem['reviewState'] | undefined {
  return value === 'suggested' || value === 'confirmed' || value === 'dismissed'
    ? value
    : undefined;
}

function normalizeActionIdentity(value?: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[“”"'.!！?？:：;；,，、()[\]{}]/g, '');
}

function getActionItemIdentity(item: MeetingPilotActionItem): string {
  return [
    normalizeActionIdentity(item.owner),
    normalizeActionIdentity(item.title),
    normalizeActionIdentity(item.deadline),
  ].join('|');
}

function formatActionOwner(owner?: string): string {
  const normalized = String(owner || '').trim();
  return normalized && !/^unknown$/i.test(normalized)
    ? normalized
    : UNASSIGNED_ACTION_OWNER;
}

export function getActionReviewWarnings(
  item: MeetingPilotActionItem,
): ActionReviewWarning[] {
  const warnings: ActionReviewWarning[] = [];
  if (formatActionOwner(item.owner) === UNASSIGNED_ACTION_OWNER) {
    warnings.push('missing-owner');
  }
  if (!String(item.deadline || '').trim()) {
    warnings.push('missing-deadline');
  }
  if (!String(item.evidence || '').trim()) {
    warnings.push('missing-evidence');
  }
  return warnings;
}

export function getActionReviewWarningLabel(
  warning: ActionReviewWarning,
): string {
  if (warning === 'missing-owner') {
    return '补负责人';
  }
  if (warning === 'missing-deadline') {
    return '补截止';
  }
  return '缺依据';
}

function buildManualActionTimelineDescription(
  item: MeetingPilotActionItem,
): string {
  const owner = formatActionOwner(item.owner);
  const deadline = item.deadline ? `（${item.deadline}）` : '';
  const summary = `${owner} · ${item.title}${deadline}`;
  return item.evidence ? `${summary}\n依据：${item.evidence}` : summary;
}

function getManualActionTimelineEventId(item: MeetingPilotActionItem): string {
  return `timeline-${item.id}`;
}

function isManualActionTimelineEvent(
  event: MeetingPilotTimelineEvent,
): boolean {
  return Boolean(
    event.actionItemId?.startsWith('action-manual-') ||
      event.id.startsWith('timeline-action-manual-') ||
      event.id.startsWith('timeline-manual-action-'),
  );
}

function manualTimelineEventMatchesAction(
  event: MeetingPilotTimelineEvent,
  item: MeetingPilotActionItem,
): boolean {
  if (event.actionItemId) {
    return event.actionItemId === item.id;
  }
  if (!isManualActionTimelineEvent(event)) {
    return false;
  }
  const eventTitle = normalizeActionIdentity(event.title);
  const itemTitle = normalizeActionIdentity(item.title);
  return Boolean(
    itemTitle &&
      (eventTitle === itemTitle ||
        normalizeActionIdentity(event.description).includes(itemTitle)),
  );
}

export function buildManualActionTimelineEvent(
  item: MeetingPilotActionItem,
  previous?: MeetingPilotTimelineEvent,
): MeetingPilotTimelineEvent {
  return {
    id: previous?.id || getManualActionTimelineEventId(item),
    type: 'action',
    title: item.title.slice(0, 48),
    description: buildManualActionTimelineDescription(item),
    timestamp: item.timestamp || previous?.timestamp || '',
    speaker: formatActionOwner(item.owner),
    chapterId: item.chapterId || previous?.chapterId,
    actionItemId: item.id,
  };
}

function getGeneratedActionItemIdentity(
  item: MeetingPilotActionItem,
): string {
  return [
    normalizeActionIdentity(item.generatedOwner || item.owner),
    normalizeActionIdentity(item.generatedTitle || item.title),
    normalizeActionIdentity(item.generatedDeadline ?? item.deadline),
  ].join('|');
}

function applyActionItemReviewDefaults(
  item: MeetingPilotActionItem,
): MeetingPilotActionItem {
  return {
    ...item,
    reviewState:
      item.reviewState || (item.status === 'done' ? 'confirmed' : 'suggested'),
  };
}

function mergePreviousActionItemState(
  nextItem: MeetingPilotActionItem,
  previous: MeetingPilotActionItem,
): MeetingPilotActionItem {
  const manuallyEdited = Boolean(previous.editedAt);
  return {
    ...nextItem,
    title: manuallyEdited ? previous.title : nextItem.title,
    owner: manuallyEdited ? previous.owner : nextItem.owner,
    deadline: manuallyEdited ? previous.deadline : nextItem.deadline,
    status: previous.status,
    reviewState:
      normalizeActionItemReviewState(previous.reviewState) ||
      (previous.status === 'done' ? 'confirmed' : nextItem.reviewState) ||
      'suggested',
    reviewedAt: previous.reviewedAt,
    editedAt: previous.editedAt,
    generatedTitle: previous.generatedTitle,
    generatedOwner: previous.generatedOwner,
    generatedDeadline: previous.generatedDeadline,
  };
}

export function mergeActionItemReviewStates(
  nextItems: MeetingPilotActionItem[],
  previousItems: MeetingPilotActionItem[],
): MeetingPilotActionItem[] {
  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  const previousByIdentity = new Map(
    previousItems.map((item) => [getActionItemIdentity(item), item]),
  );
  const previousByGeneratedIdentity = new Map(
    previousItems
      .filter((item) => item.editedAt)
      .map((item) => [getGeneratedActionItemIdentity(item), item]),
  );
  const carriedIds = new Set<string>();
  const carriedIdentities = new Set<string>();

  const merged = nextItems.map((item) => {
    const identity = getActionItemIdentity(item);
    const previousWithSameIdentity = previousByIdentity.get(identity);
    const previousWithSameGeneratedIdentity =
      previousByGeneratedIdentity.get(identity);
    const previousWithSameId = previousById.get(item.id);
    const canReusePreviousWithSameId =
      previousWithSameId &&
      getActionItemIdentity(previousWithSameId) === identity;
    const previous =
      previousWithSameIdentity ||
      previousWithSameGeneratedIdentity ||
      (canReusePreviousWithSameId ? previousWithSameId : undefined);
    if (!previous) {
      return applyActionItemReviewDefaults(item);
    }
    carriedIds.add(previous.id);
    carriedIdentities.add(getActionItemIdentity(previous));
    carriedIdentities.add(getGeneratedActionItemIdentity(previous));
    return mergePreviousActionItemState(item, previous);
  });

  const reviewedCarryOver = previousItems
    .filter((item) => {
      if (item.source === 'manual') {
        return false;
      }
      const reviewState = normalizeActionItemReviewState(item.reviewState);
      if (reviewState !== 'confirmed' && reviewState !== 'dismissed') {
        return false;
      }
      return (
        !carriedIds.has(item.id) &&
        !carriedIdentities.has(getActionItemIdentity(item))
      );
    })
    .map(applyActionItemReviewDefaults);
  const manualCarryOver = previousItems
    .filter((item) => {
      if (item.source !== 'manual') {
        return false;
      }
      return (
        !carriedIds.has(item.id) &&
        !carriedIdentities.has(getActionItemIdentity(item))
      );
    })
    .map(applyActionItemReviewDefaults);

  const activeMerged = merged.slice(-MAX_MEETING_ACTION_ITEMS);
  const manualSlots = Math.min(
    manualCarryOver.length,
    MAX_MEETING_ACTION_ITEMS,
  );
  const cappedManualCarryOver = manualCarryOver.slice(-manualSlots);
  const activeSlots = Math.max(0, MAX_MEETING_ACTION_ITEMS - manualSlots);
  const cappedActiveMerged = activeSlots
    ? activeMerged.slice(-activeSlots)
    : [];
  const carryOverSlots = Math.max(
    0,
    MAX_MEETING_ACTION_ITEMS -
      cappedActiveMerged.length -
      cappedManualCarryOver.length,
  );
  const cappedCarryOver = carryOverSlots
    ? reviewedCarryOver.slice(-carryOverSlots)
    : [];

  return [...cappedActiveMerged, ...cappedManualCarryOver, ...cappedCarryOver];
}

export function getActiveMeetingActionItems(
  actionItems: MeetingPilotActionItem[],
): MeetingPilotActionItem[] {
  return actionItems.filter((item) => item.reviewState !== 'dismissed');
}

export function mergeManualActionTimelineEvents(
  nextTimelineEvents: MeetingPilotTimelineEvent[],
  actionItems: MeetingPilotActionItem[],
  previousTimelineEvents: MeetingPilotTimelineEvent[] = [],
  maxEvents = MAX_MEETING_TIMELINE_EVENTS,
): MeetingPilotTimelineEvent[] {
  const manualActionItems = actionItems.filter(
    (item) => item.source === 'manual' && item.reviewState !== 'dismissed',
  );
  const sourceTimelineEvents = [
    ...nextTimelineEvents,
    ...previousTimelineEvents,
  ];
  const manualEvents = manualActionItems.map((item) => {
    const previous = sourceTimelineEvents.find((event) =>
      manualTimelineEventMatchesAction(event, item),
    );
    return buildManualActionTimelineEvent(item, previous);
  });

  const baseEvents = nextTimelineEvents.filter(
    (event) => !isManualActionTimelineEvent(event),
  );
  return [...baseEvents, ...manualEvents].slice(-Math.max(1, maxEvents));
}
