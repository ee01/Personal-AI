# Topic source link open receipt

## Target

- Random feature: `Topic 来源链接安全展示`
- Source doc: `docs/features/topic_based_messages.md`
- Main code: `src/modals/topic-link-safety.ts`, `src/modals/components/TopicDetailPage.vue`

## Findings

- The existing allowlist is correct for this sweep: only safe `http(s)` URLs without userinfo are clickable.
- Topic detail already exposes the destination host for safe conversation, resource, and webpage links.
- Hidden single-link cases show the blocked reason, but multi-candidate hidden cases only show a count unless the user hovers.
- Safe source clicks open a new tab with `noopener noreferrer`, but the page does not give a visible receipt explaining that opening the source is not a Memory Service reread, sync, confirmation, read-state mutation, or writeback.

## External references

- Microsoft Defender Safe Links uses click-time link protection in Teams and Office apps.
- Zulip keeps message, topic, and channel URLs shareable/permanent so source links can work as stable context anchors.
- RFC 3986 warns about the `userinfo` URI component being misleading and sensitive.
- URL inspection research shows users benefit when the UI draws attention to the real domain and link structure.

## Implementation plan

1. Keep URL safety behavior unchanged.
2. Make hidden multi-candidate labels include a compact visible reason summary.
3. Add a Topic Detail `来源打开回执` shown after clicking a safe source link.
4. Update docs and targeted/E2E assertions.
5. Verify with Topic messages targeted checks, dev webpack compile, Topic E2E, scoped diff check, and watcher cleanup.
