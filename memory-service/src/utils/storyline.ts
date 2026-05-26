import type {
  StorylineOpportunity,
  StorylineSuggestedArtifact,
  StorylineType,
} from '../types/index.js';

export const STORYLINE_TYPES: StorylineType[] = [
  'sharing',
  'status_report',
  'retro',
  'training',
  'proposal',
  'weekly_update',
];

export const STORYLINE_ARTIFACT_TARGETS: StorylineSuggestedArtifact[] = [
  'speaker_notes',
  'slides_outline',
  'ringcentral_post',
  'docs_brief',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function compactText(value: unknown, maxLength: number): string | undefined {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return undefined;
  return text.length <= maxLength
    ? text
    : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => compactText(item, 120))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function clampConfidence(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return Math.round(numeric * 100) / 100;
}

export function normalizeStorylineType(
  value: unknown,
): StorylineType | undefined {
  return STORYLINE_TYPES.includes(value as StorylineType)
    ? (value as StorylineType)
    : undefined;
}

export function normalizeStorylineArtifactTarget(
  value: unknown,
): StorylineSuggestedArtifact | undefined {
  return STORYLINE_ARTIFACT_TARGETS.includes(value as StorylineSuggestedArtifact)
    ? (value as StorylineSuggestedArtifact)
    : undefined;
}

export function defaultStorylineButtonLabel(
  target: StorylineSuggestedArtifact | undefined,
  storyType: StorylineType | undefined,
  minutes?: number,
): string {
  if (target === 'slides_outline') return '生成 Slides 提纲';
  if (target === 'ringcentral_post') return '生成分享帖故事线';
  if (target === 'docs_brief') return '生成 Docs 简报';
  if (storyType === 'retro') return '整理复盘故事线';
  if (storyType === 'training') return '生成培训故事线';
  if (minutes && minutes >= 5) return `生成 ${minutes} 分钟故事线`;
  return '生成故事线草稿';
}

export function normalizeStorylineOpportunity(
  value: unknown,
): StorylineOpportunity | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const confidence = clampConfidence(record.confidence);
  const storyType = normalizeStorylineType(record.storyType);
  const suggestedArtifact = normalizeStorylineArtifactTarget(
    record.suggestedArtifact,
  );
  const oneLineReason = compactText(record.oneLineReason, 180);
  const audienceHint = compactText(record.audienceHint, 100);
  const blockedReasons = normalizeStringArray(record.blockedReasons, 6);
  const estimatedLengthMinutesValue = Number(record.estimatedLengthMinutes);
  const estimatedLengthMinutes =
    Number.isFinite(estimatedLengthMinutesValue) &&
    estimatedLengthMinutesValue > 0
      ? Math.min(30, Math.round(estimatedLengthMinutesValue))
      : undefined;
  const evidenceClusters = Array.isArray(record.evidenceClusters)
    ? record.evidenceClusters
        .map((cluster) => {
          const clusterRecord = asRecord(cluster);
          if (!clusterRecord) return null;
          const label = compactText(clusterRecord.label, 80);
          const evidenceCount = Math.max(
            0,
            Math.min(99, Math.round(Number(clusterRecord.evidenceCount) || 0)),
          );
          const sourceKinds = normalizeStringArray(
            clusterRecord.sourceKinds,
            6,
          );
          if (!label || evidenceCount <= 0) return null;
          return { label, sourceKinds, evidenceCount };
        })
        .filter(
          (
            cluster,
          ): cluster is {
            label: string;
            sourceKinds: string[];
            evidenceCount: number;
          } => Boolean(cluster),
        )
        .slice(0, 6)
    : [];

  const isAvailable =
    record.available === true &&
    confidence >= 0.55 &&
    Boolean(oneLineReason) &&
    evidenceClusters.length > 0;
  const buttonLabel = isAvailable
    ? compactText(record.buttonLabel, 40) ||
      defaultStorylineButtonLabel(
        suggestedArtifact,
        storyType,
        estimatedLengthMinutes,
      )
    : undefined;

  return {
    available: isAvailable,
    confidence: isAvailable ? confidence : Math.min(confidence, 0.49),
    ...(storyType ? { storyType } : {}),
    ...(buttonLabel ? { buttonLabel } : {}),
    ...(oneLineReason ? { oneLineReason } : {}),
    ...(audienceHint ? { audienceHint } : {}),
    ...(estimatedLengthMinutes ? { estimatedLengthMinutes } : {}),
    ...(evidenceClusters.length ? { evidenceClusters } : {}),
    ...(blockedReasons.length ? { blockedReasons } : {}),
    ...(suggestedArtifact ? { suggestedArtifact } : {}),
  };
}
