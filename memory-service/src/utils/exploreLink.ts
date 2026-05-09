/**
 * Build stable jump links into the memory-exploring (Vue) UI.
 *
 * The links are *route fragments* relative to the modal (no host/origin)
 * because the modal is mounted into different shells (extension popup, in-page
 * modal, desktop app webview) and the host portion is decided by the consumer.
 *
 * Routes (kept in sync with src/modals/memory-exploring-entry.ts):
 *
 *   /timeline?type=<type>&focus=<id> // jump to a single message/chunk
 *   /topic/<id>                     // open topic detail
 *   /person/<id>                    // open person detail
 *   /project/<id>                   // open project placeholder/detail
 *   /entity/<type>?focus=<id>       // open entity list and focus an entity
 */

import type { Entity, EntityType, RecallItem } from '../types/index.js';

export interface ExploreLinkInput {
  type: 'message' | 'chunk' | 'entity';
  id: string;
  conversationId?: string;
  entityType?: EntityType;
  entity?: Entity;
}

export function buildExploreLink(input: ExploreLinkInput): string | undefined {
  if (!input.id) return undefined;
  if (input.type === 'entity') {
    const t = input.entity?.type || input.entityType;
    if (!t) return undefined;
    const encodedId = encodeURIComponent(input.id);
    if (t === 'Topic') return `#/topic/${encodedId}`;
    if (t === 'Person') return `#/person/${encodedId}`;
    if (t === 'Project') return `#/project/${encodedId}`;
    return `#/entity/${encodeURIComponent(t)}?focus=${encodedId}`;
  }
  if (input.conversationId) {
    return `#/timeline?thread=${encodeURIComponent(input.conversationId)}&type=${input.type}&focus=${encodeURIComponent(input.id)}`;
  }
  return `#/timeline?type=${input.type}&focus=${encodeURIComponent(input.id)}`;
}

export function attachExploreLink(item: RecallItem): RecallItem {
  if (item.exploreLink) return item;
  const conversationId =
    (item.metadata?.conversationId as string | undefined) ||
    (item.metadata?.conversation_id as string | undefined);
  const entityType = item.entity?.type;
  const link = buildExploreLink({
    type: item.type,
    id: item.id,
    conversationId,
    entityType,
    entity: item.entity,
  });
  return link ? { ...item, exploreLink: link } : item;
}
