import type {
  ClaimAttributionReceipt,
  ClaimAttributionReceiptItem,
} from './services/MemoryServiceClient';

export type ClaimAttributionCompactTone =
  | 'info'
  | 'warning'
  | 'corrected';

export interface ClaimAttributionCompactPresentation {
  label: '记忆归属';
  title: string;
  summary: string;
  boundary: string;
  tone: ClaimAttributionCompactTone;
  changedCount: number;
  usedCount: number;
  backgroundOnlyCount: number;
  blockedCount: number;
  correctedCount: number;
  details: string[];
  ariaLabel: string;
}

export interface ClaimAttributionCompactPresentationOptions {
  /**
   * Compose uses the presence of a receipt as a review gate. When that happens,
   * even an all-used receipt needs a compact explanation inside the locked
   * preview so the journey never becomes stricter without telling the user why.
   */
  includeUsedOnly?: boolean;
}

function uniqueReceiptItems(
  items: readonly ClaimAttributionReceiptItem[],
): ClaimAttributionReceiptItem[] {
  return Array.from(
    new Map(
      items.map((item) => [
        `${item.claimId}:${item.revision}:${item.effect}`,
        item,
      ]),
    ).values(),
  );
}

function countReceiptBuckets(
  buckets: ClaimAttributionReceipt['used'],
): number {
  return buckets.reduce(
    (total, bucket) => total + Math.max(0, Number(bucket.count) || 0),
    0,
  );
}

function buildSummary(input: {
  usedCount: number;
  backgroundOnlyCount: number;
  blockedCount: number;
}): string {
  return [
    input.usedCount > 0 ? `采用 ${input.usedCount} 条` : '',
    input.backgroundOnlyCount > 0
      ? `仅作背景 ${input.backgroundOnlyCount} 条`
      : '',
    input.blockedCount > 0 ? `未使用 ${input.blockedCount} 条` : '',
  ]
    .filter(Boolean)
    .join('；');
}

function buildCompactPresentation(input: {
  items: readonly ClaimAttributionReceiptItem[];
  summary?: string;
  boundary?: string;
  bucketCounts?: {
    used: number;
    backgroundOnly: number;
    blocked: number;
  };
  correctedCount?: number;
  includeUsedOnly?: boolean;
}): ClaimAttributionCompactPresentation | null {
  const items = uniqueReceiptItems(input.items);
  const usedCount = Math.max(
    items.filter((item) => item.effect === 'used').length,
    input.bucketCounts?.used ?? 0,
  );
  const backgroundOnlyCount = Math.max(
    items.filter((item) => item.effect === 'background_only').length,
    input.bucketCounts?.backgroundOnly ?? 0,
  );
  const blockedCount = Math.max(
    items.filter((item) => item.effect === 'blocked').length,
    input.bucketCounts?.blocked ?? 0,
  );
  const correctedCount = Math.max(
    items.filter((item) => item.corrected).length,
    input.correctedCount ?? 0,
  );
  const changedCount = backgroundOnlyCount + blockedCount + correctedCount;
  const explainUsedOnly =
    changedCount === 0 && input.includeUsedOnly === true;

  // A receipt is useful only when attribution changed how evidence was used.
  // Ordinary self-authored evidence stays completely UI-silent unless a caller
  // has already used the receipt to upgrade the journey to a review step.
  if (changedCount === 0 && !explainUsedOnly) return null;

  const title = explainUsedOnly
    ? '已按归属采用证据'
    : correctedCount > 0
    ? '归属已纠正'
    : blockedCount > 0 && backgroundOnlyCount > 0
    ? '已按归属限制证据'
    : blockedCount > 0
    ? '已阻止误用'
    : '部分证据仅作背景';
  const tone: ClaimAttributionCompactTone = correctedCount > 0
    ? 'corrected'
    : blockedCount > 0
    ? 'warning'
    : 'info';
  const summary =
    input.summary?.trim() ||
    buildSummary({
      usedCount,
      backgroundOnlyCount,
      blockedCount,
    }) ||
    '本轮证据已按归属完成分级';
  const boundary = input.boundary?.trim() ||
    '只影响 Personal AI 如何使用派生记忆，不修改原始消息。';
  const details = items
    .filter(
      (item) => explainUsedOnly || item.effect !== 'used' || item.corrected,
    )
    .map((item) => `${item.displayLabel}：${item.consequence}`)
    .filter((detail, index, all) => all.indexOf(detail) === index)
    .slice(0, 3);

  return {
    label: '记忆归属',
    title,
    summary,
    boundary,
    tone,
    changedCount,
    usedCount,
    backgroundOnlyCount,
    blockedCount,
    correctedCount,
    details,
    ariaLabel: `记忆归属回执：${title}。${summary}。${boundary}`,
  };
}

export function buildClaimAttributionCompactPresentation(
  receipt?: ClaimAttributionReceipt | null,
  options: ClaimAttributionCompactPresentationOptions = {},
): ClaimAttributionCompactPresentation | null {
  if (!receipt) return null;
  return buildCompactPresentation({
    items: receipt.claims ?? [],
    summary: receipt.summary,
    boundary: receipt.boundary,
    bucketCounts: {
      used: countReceiptBuckets(receipt.used ?? []),
      backgroundOnly: countReceiptBuckets(receipt.backgroundOnly ?? []),
      blocked: countReceiptBuckets(receipt.blocked ?? []),
    },
    correctedCount: receipt.correctedCount,
    includeUsedOnly: options.includeUsedOnly,
  });
}

export function buildClaimAttributionCompactPresentationFromItems(
  items?: readonly ClaimAttributionReceiptItem[] | null,
): ClaimAttributionCompactPresentation | null {
  if (!items?.length) return null;
  return buildCompactPresentation({ items });
}
