import type { MeetingPilotActionItem } from './protocol';

const MAX_MEETING_ACTION_ITEMS = 12;

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

  const activeMerged = merged.slice(-MAX_MEETING_ACTION_ITEMS);
  const carryOverSlots = Math.max(
    0,
    MAX_MEETING_ACTION_ITEMS - activeMerged.length,
  );
  const cappedCarryOver = carryOverSlots
    ? reviewedCarryOver.slice(-carryOverSlots)
    : [];

  return [...activeMerged, ...cappedCarryOver];
}

export function getActiveMeetingActionItems(
  actionItems: MeetingPilotActionItem[],
): MeetingPilotActionItem[] {
  return actionItems.filter((item) => item.reviewState !== 'dismissed');
}
