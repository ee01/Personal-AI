import type { Entity, RecallItem } from '../types/index.js';

const GENERIC_ENTITY_LABELS = new Set(['entity', '实体', 'chunk', 'message']);

function normalizeLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

function isGenericEntityLabel(value: string | undefined): boolean {
  if (!value) return true;
  return GENERIC_ENTITY_LABELS.has(value.toLowerCase());
}

function clipSummary(value: string, maxLength = 220): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function firstMeaningfulLine(content: string | undefined): string | undefined {
  if (!content) return undefined;
  for (const line of content.split(/\r?\n/)) {
    const cleaned = line.replace(/\s+/g, ' ').trim();
    if (cleaned.length >= 8 && !isGenericEntityLabel(cleaned)) {
      return cleaned;
    }
  }
  return undefined;
}

export function resolveRecallEntityName(item: RecallItem): string | undefined {
  const metadata = item.metadata ?? {};
  const candidates = [
    item.entity?.name,
    metadata.entityName,
    metadata.entity_name,
    item.sourceTitle,
    item.displayTitle,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeLabel(candidate);
    if (normalized && !isGenericEntityLabel(normalized)) {
      return normalized;
    }
  }
  return undefined;
}

export function resolveRecallEntitySummary(item: RecallItem): string | undefined {
  const metadata = item.metadata ?? {};
  const candidates = [
    item.entity?.description,
    metadata.entitySummary,
    metadata.entity_summary,
    metadata.oneLineSummary,
    item.previewText,
    firstMeaningfulLine(item.displayText),
    firstMeaningfulLine(item.content),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeLabel(candidate);
    if (normalized && !isGenericEntityLabel(normalized)) {
      return clipSummary(normalized);
    }
  }
  return undefined;
}

export function enrichRecallItemEntityProvenance(item: RecallItem): RecallItem {
  if (item.type !== 'entity' && !item.entity) return item;

  const entity = item.entity;
  const name = resolveRecallEntityName(item) ?? entity?.name;
  const summary = resolveRecallEntitySummary(item);
  const metadata = { ...(item.metadata ?? {}) };

  if (name && !isGenericEntityLabel(name)) {
    metadata.entityName = metadata.entityName ?? name;
    metadata.entity_name = metadata.entity_name ?? name;
  }
  if (entity?.type) {
    metadata.entityType = metadata.entityType ?? entity.type;
    metadata.entity_type = metadata.entity_type ?? entity.type;
  }
  if (summary) {
    metadata.entitySummary = metadata.entitySummary ?? summary;
    metadata.entity_summary = metadata.entity_summary ?? summary;
  }

  return {
    ...item,
    source: item.source ?? 'entity',
    sourceTitle: name && !isGenericEntityLabel(item.sourceTitle)
      ? item.sourceTitle
      : name ?? item.sourceTitle,
    displayTitle: name && !isGenericEntityLabel(item.displayTitle)
      ? item.displayTitle
      : name ?? item.displayTitle,
    previewText: summary ?? item.previewText,
    metadata,
    entity: entity ?? item.entity,
  };
}

export function enrichRecallItemsEntityProvenance(items: RecallItem[]): RecallItem[] {
  return items.map(enrichRecallItemEntityProvenance);
}

export function entityFromRecallItem(item: RecallItem): Entity | undefined {
  return item.entity;
}
