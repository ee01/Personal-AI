# Task Plan: Roadmap gantt/resource-view UX improvements

## Goal
Implement the 7 items in docs/progressing/roadmap-gantt-ux-improvements-plan.md
in real roadmap-service code, matching the demo's design and animations exactly.

## Current Phase
Phase 5 (complete)

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints
- [x] Document in findings.md
- **Status:** done

### Phase 2: Planning & Structure
- [x] Define approach
- [x] Create project structure
- **Status:** done

### Phase 3: Implementation
- [x] Execute the plan
- [x] Write to files before executing
- **Status:** done

### Phase 4: Testing & Verification
- [x] Verify requirements met
- [x] Document test results
- **Status:** done — 143 vitest cases green, full manual + scripted browser verification

### Phase 5: Delivery
- [x] Review outputs
- [x] Deliver to user
- **Status:** done

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Item #3 (clear alias) needed no code change | End-to-end trace + live test showed the pipeline already worked; premise was wrong |
| `defer_subs` drops `baseVersions` optimistic-concurrency param | Low-risk batch reorder of future tasks; not worth partial-409 complexity |
| `defer_subs` doesn't gate on "already past" | That's a client-side concept (`isDeferCandidate`); server only clamps to Epic span |
| Resource-view header/strip panning use one `inset:0` + percentage coordinate convention | A 3x-width/negative-margin header vs a 0-100%-window strip silently drift px apart |

## Errors Encountered
| Error | Resolution |
|-------|------------|
| better-sqlite3 native module version mismatch on dev server start | `npm rebuild better-sqlite3` |
| Transient Vue SFC parse error mid-edit (unbalanced div while editing ResourceView.vue) | Self-resolved by the next edit completing the tag; confirmed via clean reload |
| False "misalignment"/"selection cleared" readings during browser-script testing | Artifacts of reading DOM synchronously before Vue's microtask-batched re-render, or of repeated toggle-clicks across debug calls — not real bugs; confirmed via clean re-tests |
