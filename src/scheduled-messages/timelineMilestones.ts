export interface TimelineMilestoneOption {
  value: string;
  label: string;
}

export const STANDARD_TIMELINE_MILESTONE_OPTIONS: TimelineMilestoneOption[] = [
  { value: 'DoR', label: '📋 DoR' },
  { value: 'Embedded', label: '🔧 Embedded' },
  { value: 'FF', label: '🎯 FF' },
  { value: 'Regression', label: '🔄 Regression' },
  { value: 'CF', label: '❄️ CF' },
  { value: 'Release', label: '🚀 Release' },
];

const STANDARD_MILESTONE_ORDER = new Map(
  STANDARD_TIMELINE_MILESTONE_OPTIONS.map((option, index) => [option.value, index]),
);

function normalizeMilestoneKey(value?: string): string {
  return value?.trim() || '';
}

export function getTimelineMilestoneOption(value?: string): TimelineMilestoneOption {
  const normalizedValue = normalizeMilestoneKey(value) || 'FF';
  const standardOption = STANDARD_TIMELINE_MILESTONE_OPTIONS.find(
    option => option.value === normalizedValue,
  );

  if (standardOption) {
    return standardOption;
  }

  return {
    value: normalizedValue,
    label: normalizedValue,
  };
}

export function buildTimelineMilestoneOptions(
  cachedMilestoneKeys?: string[],
  selectedMilestone?: string,
): TimelineMilestoneOption[] {
  const normalizedKeys = Array.from(new Set(
    (cachedMilestoneKeys || [])
      .map(normalizeMilestoneKey)
      .filter(Boolean),
  ));

  if (normalizedKeys.length === 0) {
    return STANDARD_TIMELINE_MILESTONE_OPTIONS;
  }

  const options = normalizedKeys
    .sort((a, b) => {
      const orderA = STANDARD_MILESTONE_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER;
      const orderB = STANDARD_MILESTONE_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.localeCompare(b);
    })
    .map(getTimelineMilestoneOption);

  const normalizedSelectedMilestone = normalizeMilestoneKey(selectedMilestone);
  if (
    normalizedSelectedMilestone &&
    !options.some(option => option.value === normalizedSelectedMilestone)
  ) {
    options.push({
      ...getTimelineMilestoneOption(normalizedSelectedMilestone),
      label: `⚠️ ${normalizedSelectedMilestone}（当前缓存缺失）`,
    });
  }

  return options;
}

export function isTimelineMilestoneMissingFromCache(
  selectedMilestone?: string,
  cachedMilestoneKeys?: string[],
): boolean {
  const normalizedSelectedMilestone = normalizeMilestoneKey(selectedMilestone);
  if (!normalizedSelectedMilestone || !cachedMilestoneKeys || cachedMilestoneKeys.length === 0) {
    return false;
  }

  return !cachedMilestoneKeys
    .map(normalizeMilestoneKey)
    .some(key => key === normalizedSelectedMilestone);
}

export function formatTimelineMilestoneKeys(milestoneKeys?: string[]): string {
  const normalizedKeys = Array.from(new Set(
    (milestoneKeys || [])
      .map(normalizeMilestoneKey)
      .filter(Boolean),
  ));

  return normalizedKeys.length > 0 ? normalizedKeys.join(' / ') : '无可用 Milestone';
}
