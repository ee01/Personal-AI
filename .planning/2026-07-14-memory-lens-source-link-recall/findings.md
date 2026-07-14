# Memory Lens Source-Link Recall Findings

## Initial context

- User-visible symptom: the Lens card identifies “Story Points estimation by AI Service - Google Docs” but exposes no clickable document link.
- Supplied request is a passive `web_passive` `/api/v1/context-recall` call for the “RCVSDK team stretch goal - Google Sheets” page with `limit: 3` and `X-User-Id: esone.qiu`.
- Existing project history says Memory Lens already has source-link safety, read-only open semantics, post-click `来源打开回执`, and Source Memory-specific controls. The investigation must locate the missing data/normalization step before changing UI behavior.

## Supplied response and screenshot

- The recalled item is concrete: chunk `68515`, title/snippet `Story Points estimation by AI Service - Google Docs`, `sourceLabel: web`, and `exploreLink: #/timeline?type=chunk&focus=68515`.
- The API already identifies its Source Memory capsule through `metadata.filePath: source-memory/8121557d-149a-4a80-8f4b-22a2f812350f.md` and `metadata.source: source-memory:8121557d-149a-4a80-8f4b-22a2f812350f`.
- The direct failure is visible in the payload: `links: []`. Therefore the Lens cannot offer a Google Docs source-open control from this response even though it can still offer the internal `exploreLink` route.
- The screenshot confirms the card shows title, summary, merged-source/date/match receipts, feedback/pagination, and a top-right arrow, but no labeled Google Docs/source action. The design must distinguish `在记忆中查看` (internal detail/timeline) from `打开原始文档` (safe external source).

## Existing UX contract to preserve

- A July 11 Source Memory sweep already added Source Memory-specific `title` / `aria-label` copy to both `在记忆中查看` and safe original-source controls. It intentionally left URLs, click handling, source-open receipts, and backend behavior unchanged.
- Existing browser fixtures cover both a safe visible source URL and a hidden sensitive source URL. A new fix should extend these fixtures to cover the third state seen here: a Source Memory match with a capsule identifier but no serialized `links`.
- Design review principle: do not repurpose the existing unlabeled arrow as if internal memory detail and external document were equivalent. Show two explicit actions only when their destinations exist, and keep blocked/missing source states honest rather than inferring a URL from the title.

## Current canonical behavior and worktree constraints

- `docs/features/memory_lens.md` already specifies that Expanded Card should render `sourceUrl` even when `links[]` is empty, dedupe to at most three sources, accept only safe HTTP(S), and show `原始来源缺失` / hidden-source receipts rather than silently removing traceability.
- The failing payload has neither `links[]` nor a top-level `sourceUrl`; only `metadata.source` and `metadata.filePath` identify the Source Memory capsule. The existing documented frontend fallback therefore cannot recover the Google Docs URL.
- The main consumer paths include Memory Lens, RingCentral Video Home, Meeting Side Panel / Meeting Prep, Storyline evidence, Timeline, Search Results, and Source Memory detail. Several consumers separately assemble `exploreLink` plus `links`, so a shared backend serialization repair is higher leverage than a Lens-only workaround if the capsule stores the URL.
- Relevant files `src/contentScriptWebIntelligence.ts`, `src/background.ts`, and `docs/features/memory_lens.md` already contain unrelated uncommitted changes. Any patch must be line-local, diff-reviewed, and must not revert or absorb other work.

## Likely backend loss point

- FTS/vector chunk recall asks `RecallEngine.resolveChunkSourceRef()` for provenance. That helper only resolves `messages_raw` through `related_entity_id` or message/calendar file paths; if no linked message row survives, it immediately returns `{}`.
- Source Memory chunks are self-identifying even without the message row: `file_path = source-memory/<capsuleId>.md` and `source = source-memory:<capsuleId>`. The live payload contains both clues, but the resolver currently ignores them.
- `source_memory_capsules` already stores `source_url` and `source_title`. `ContextRecallService.toContextMatch()` already converts an item with `metadata.sourceMemoryCapsuleId` into `type: source_memory`, a direct capsule `exploreLink`, top-level `sourceUrl`, and `links[]`.
- Therefore the coherent repair is a shared RecallEngine fallback: after message-row lookup fails, resolve a Source Memory capsule id from the chunk's path/source, query the capsule row, and return URL/title plus `sourceMemoryCapsuleId`. This fixes all consumers of recall matches without teaching Lens to perform a second fetch or guess a Docs URL.
- Current capture code creates both the linked `messages_raw` row and Source Memory chunk, so new records normally work. The fallback specifically repairs legacy/orphaned chunk provenance such as live chunk `68515`.

## Live `esone.qiu` evidence

- Read-only `GET /api/v1/source-memory/capsules/8121557d-149a-4a80-8f4b-22a2f812350f` returned the saved work-scope webpage capsule with the exact title `Story Points estimation by AI Service - Google Docs`.
- The capsule contains a direct Google Docs URL on `docs.google.com/document/.../edit?tab=t.0`; it is an ordinary HTTPS document URL with no credential/signature query parameter. The URL is therefore eligible for the existing frontend safety gate.
- The capsule is `status: saved`, `captureMode: auto`, and was saved on the same timestamp carried by chunk `68515`. This proves the chunk and capsule are the same memory.
- The capsule detail currently exposes an inconsistent provenance receipt: `writeReceipt.state = saved_without_recall_signal`, while `actionReceipt.detail` says an associated recall signal was written. That is a secondary integrity issue worth tightening after the source-link propagation fix.

## Live impact and consumer inventory

- Read-only remote DB inspection found 625 saved Source Memory capsules, 477 whose `message_id` no longer exists in `messages_raw`, and 2,397 orphan Source Memory chunks across 476 capsule files. All affected capsules predate 2026-06-04 10:51 CST. This is a legacy integrity class, not one malformed card.
- Capsule `8121557d...` still points from chunks `68515-68518` to the missing message id, explaining both the empty recall source fields and the capsule detail `saved_without_recall_signal` state.
- Shared RecallEngine hydration also affects active `/recall`, Ask evidence, Composer Assist, Today/Meeting Pilot, and other context-pack consumers. Fixing the engine restores provenance everywhere; consumer-specific UI should then use its existing safety policy.
- P1 follow-up: URL safety and blocked-reason logic is duplicated between Lens/Meeting helpers and Search/Timeline helpers. A shared `RecallSourceRef -> { internalRoute, externalLinks, blockedLinks }` presentation contract would reduce drift.
- P1 follow-up: Compose Guard carries source fields in evidence but does not surface a safe source-review control. P2: Meeting surfaces open safe links but should expose blocked reasons and button-level no-write boundaries consistently.

## Implemented design contract

- Backend canonicalization now makes an orphan Source Memory chunk a real Source Memory match: capsule id/type/label, capsule detail route, safe original URL/title/link, and `source-memory:<capsuleId>` cluster key. This also sends feedback to the capsule rather than an incidental chunk id.
- Lens safe state: show the existing source link plus `已保存资料来源可复核`; when source and current page share `docs.google.com`, also show `同站 docs.google.com` so provenance and topology are both visible.
- Lens missing state: keep the capsule detail action and show `原始来源缺失`, even when an internal detail route exists. The old condition silently hid this truth whenever any explore route existed.
- Lens blocked state remains `原始来源已隐藏`; raw metadata path/source identifiers are never rendered or guessed into a URL.
- Existing click behavior remains read-only: new tab, `noopener`, post-click `来源打开回执`, no memory write, insert, send, or fact confirmation.

## Deployment and backfill preflight

- The repository `deploy:memory` helper uses `rsync --delete` for the entire local `memory-service/`. The local tree contains many unrelated user changes, and the remote source tree is also a previously synced dirty working tree; running the broad helper would deploy unrelated runtime files and delete a remote `.env.bak-*` file.
- A patch containing only this task's `RecallEngine.ts` and `ContextRecallService.ts` hunks passes `git apply --check` against the current remote tree. The safe deployment shape is therefore: back up the two remote source files, apply the narrow patch, copy only newly owned backfill runtime files, then run the same remote Docker build/restart/health checks.
- Live preflight reconfirmed 625 saved capsules, 477 non-null capsule `message_id` values whose `messages_raw` row is missing, 476 affected capsules with existing matching chunks, and one capsule with no chunks. All 477 still have their Markdown snapshot file.
- Of the missing-signal set, 467 already retain message-level `memory_metadata`; 2,393 of 2,397 existing chunks retain chunk metadata. Backfill must preserve existing scores, insert only missing metadata rows, avoid duplicating the 2,397 chunks, and create chunks only for the one chunkless capsule.
- The remote data volume has about 320 GiB free, enough for a consistent SQLite backup of the 1.4 GiB live database. The running container is healthy; unauthenticated `/health` reports `degraded`/database disconnected by design, so user-scoped post-deploy checks are required.
- Backfill should restore the original message ids rather than generate new ids: existing chunks already point to those ids, so inserting the missing `messages_raw` rows repairs the relationship without rewriting historical chunks.
