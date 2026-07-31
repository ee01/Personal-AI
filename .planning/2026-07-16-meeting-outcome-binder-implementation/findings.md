# Meeting Outcome Binder Findings

## Initial Context

- The approved product split is explicit: Today Pilot owns pre-meeting preparation, Meeting Pilot owns in-meeting and post-meeting behavior, and Ask is read-only.
- Canonical docs already define `会前准备` under `docs/features/today_pilot.md` and `会后 Panorama` under `docs/features/meeting_pilot.md`.
- The existing concept plan already contains the desired P0 surfaces and a draft `MeetingOutcomeBinder` contract, but its product framing needs to become an enhancement across existing surfaces rather than a standalone feature.
- The worktree is heavily dirty. Several likely integration files already contain unrelated changes, including `DayPilotService.ts`, `ask.ts`, `server.ts`, Today Pilot UI/docs, and eval infrastructure.
- Repository policy requires Tier 2 verification for Meeting Pilot UI changes and an eval suite for LLM/ranking-dependent behavior.

## Known Existing Flow

- Today Pilot pre-generates or backfills meeting prep from calendar plus memory evidence.
- RingCentral Video Home consumes meeting prep and writes a local Meeting Pilot handoff.
- Meeting Pilot reads the handoff, captures transcript/events, derives actions/decisions, archives the meeting, and renders Panorama.
- Ask already retrieves meeting memories; the binder should be an additional structured source, not a replacement for transcript evidence.

## Investigation Queue

- Locate meeting-prep persistence/types/API and Video Home rendering.
- Locate handoff type/storage and side-panel rendering.
- Locate meeting session/archive types and stop-capture persistence path.
- Locate Panorama data loading and current action/decision models.
- Locate Ask evidence/source-card assembly.
- Locate migration/repository conventions and eval registry/report conventions.

## First Code Map

- Meeting prep types and API client are centralized in `src/services/MemoryServiceClient.ts`; the Video Home host lives in `src/contentScriptRingCentralVideoHome.ts`.
- Video Home already writes both `meetingPrepHandoff` and `meetingPrepHandoffs`; extending that payload is the lowest-risk way to carry planned outcome slots into Meeting Pilot.
- Meeting Pilot side-panel handoff normalization and rendering are concentrated in `src/meeting-shell/meetingSidePanel.tsx`.
- Capture archive happens in `src/meeting-shell/background.ts` through `archiveMeetingSession()` / `ingestMeetingSession()`; this is the likely post-meeting binding hook.
- Persisted meeting records are exposed through `memory-service/src/routes/meetings.ts` and typed in `memory-service/src/types/index.ts`.
- Existing meeting-prep persistence has its own migration, repository, service, route, and API tests: migration `023`, `TodayPilotMeetingPrepRepository`, `TodayPilotMeetingPrepService`, day-pilot routes, and `api-today-pilot-meeting-prep.test.ts`.
- The next free migration number in the current dirty worktree is `056` because untracked migrations already occupy `051` through `055`.
- Ask currently carries generic evidence references and meeting recall, so binder support should be added as a structured read-only hint/source near response assembly rather than by replacing recall.

## Meeting Prep Contract Findings

- `TodayPilotMeetingPrepRecord` currently persists summary, cue cards, questions, evidence, context pack, Storyline metadata, hashes, freshness, and status. It has no agenda/outcome contract today.
- Existing meeting prep uses `today_meeting_preps` as a rebuildable derived cache. A binder should not be squeezed into Storyline or cue-card JSON because it has a longer post-meeting lifecycle and must remain queryable after prep expiry.
- The clean contract is therefore a separate binder table keyed by user plus calendar event/meeting identity, with an optional `outcomeBinder` projection attached to meeting-prep responses.
- Video Home and the client API can consume the projection without another round trip; the same binder id and planned slots can travel in the existing local handoff payload.
- Existing day-pilot routes already have a dedicated `/today-pilot/meeting-prep/*` namespace, while persisted meeting records have `/meetings`; binder-specific read/bind endpoints should live with `/meeting-outcomes` and be called from existing lifecycle code.

## Meeting Session And Archive Findings

- `MeetingPilotSessionSnapshot` is the shared extension session contract. It currently has transcript, decisions, action items, timeline, memory refs, capture/digest state, but no meeting-prep or outcome fields.
- Adding an optional `outcomeBinder` projection to the session is backward-compatible with stored sessions and makes live Panorama and export naturally inherit the same result.
- Meeting Pilot already prepares the archive title, ingests the session into Memory Service, and exposes the archived detail through `/meetings/:meetingId`.
- The post-meeting bind call should happen as part of `archiveMeetingSession()` after the session is prepared and before/alongside ingestion; failures must be non-fatal and leave a visible `binding_failed`/partial receipt rather than block meeting archival.
- Panorama has two modes: live/current session and archived-history detail hydrated from `MemoryServiceClient.getMeetingDetail()`. The binder projection must be supported in both contracts.
- Migration loading is filename-ordered and automatically applied. A new `056_meeting_outcome_binders.sql` migration fits the current working tree without modifying existing migrations.

## Concrete P0 Integration Shape

- Extend the existing meeting-prep LLM response with `outcomeSlots`, then normalize/fallback those slots and persist them through a dedicated binder service. This reuses the prep call rather than adding another model request before every meeting.
- Attach the resulting binder projection to `TodayPilotMeetingPrepRecord`; Video Home renders it and includes it in the existing handoff.
- Add the optional binder projection to `MeetingPilotSessionSnapshot`. At archive time, background resolves the matching handoff, calls `MemoryServiceClient.bindMeetingOutcome()`, stores the returned binder on the session, then ingests the enriched session.
- Binder binding should use an LLM when available and a deterministic evidence matcher as fallback. Decisions and completed actions can resolve a slot; pending actions can only partially resolve it; transcript mention alone remains unresolved/mentioned.
- Archived `/meetings/:meetingId` should join the binder by meeting id. Panorama then renders the same component for live and archived sessions.
- Existing `getMemoryServiceClient()` is already used by Meeting Pilot background, so no new fetch/auth stack is needed.

## First Backend Validation Findings

- Raw-database test apps deliberately use `request.userId = "test"`; repository fixtures must use that identity or route reads correctly fail closed with 404.
- The current Storyline normalizer requires at least three actual evidence refs for an available opportunity. The long-standing positive meeting-prep fixture only seeded two memory chunks, so it was strengthened without weakening production thresholds or negative tests.
- Binder LLM output needs a second local guard: a cited evidence id is accepted only when its text overlaps the planned slot. Unsupported `resolved`, `carried_over`, and `discarded_agenda` claims are downgraded, and their prose summary is replaced with a conservative deterministic receipt.
