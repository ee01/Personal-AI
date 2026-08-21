# Task Plan: Outreach timeout notify + continue follow-up

## Goal
Timeout/escalated outreach also pushes a Bot receipt; the receipt shows whether a follow-up happened (with a Glip jump link) and offers an entry to continue follow-up with next interval and count.

## Current Phase
Phase 3

## Phases

### Phase 1: Notice contract + timeout delivery
- [x] Locate 待确认 (Decision Center `/decisions`, category `outreach_followup`; answering it does not resume outreach)
- [x] Notify `resolved` / `no_reply` / `escalated`
- [x] Receipt includes follow-up happened + Glip link + continue marker
- **Status:** complete

### Phase 2: Continue-followup API
- [x] `POST /outreach/sessions/:id/continue-followup`
- [x] Reset wait window without re-dispatching the original question
- **Status:** complete

### Phase 3: UI entry + validation
- [x] Session detail continue form (`?continueFollowup=1`)
- [x] Glip bot-receipt bar + overlay
- [x] Tests, docs, webpack compile, memory-service deploy
- **Status:** complete
