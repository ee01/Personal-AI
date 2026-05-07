import { describe, expect, it } from 'vitest';

import { buildExploreLink } from '../utils/exploreLink.js';

describe('buildExploreLink', () => {
  it('maps messages and chunks to existing timeline routes', () => {
    expect(buildExploreLink({ type: 'message', id: 'msg-1' })).toBe(
      '#/timeline?focus=msg-1',
    );
    expect(buildExploreLink({ type: 'chunk', id: '42' })).toBe(
      '#/timeline?focus=42',
    );
  });

  it('preserves conversation focus without using an unregistered thread route', () => {
    expect(
      buildExploreLink({
        type: 'message',
        id: 'msg-1',
        conversationId: 'thread-7',
      }),
    ).toBe('#/timeline?thread=thread-7&focus=msg-1');
  });

  it('maps known entity types to registered detail routes', () => {
    expect(
      buildExploreLink({
        type: 'entity',
        id: 'project-1',
        entityType: 'Project',
      }),
    ).toBe('#/project/project-1');
    expect(
      buildExploreLink({
        type: 'entity',
        id: 'person-1',
        entityType: 'Person',
      }),
    ).toBe('#/person/person-1');
    expect(
      buildExploreLink({
        type: 'entity',
        id: 'topic-1',
        entityType: 'Topic',
      }),
    ).toBe('#/topic/topic-1');
  });

  it('falls back to entity lists for entity types without detail pages', () => {
    expect(
      buildExploreLink({
        type: 'entity',
        id: 'doc-1',
        entityType: 'Document',
      }),
    ).toBe('#/entity/Document?focus=doc-1');
  });
});
