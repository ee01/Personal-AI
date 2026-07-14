# Findings

- Dream cards already compute `isPriorityReviewDream`, `isDreamReviewReady`, and `needsGroundingReview`; the missing piece is a user-facing control that maps those computed states to the visible list.
- The current E2E fixture has two loaded dreams: `Project Orbit` is priority + evidence-ready, while `Newer Focus` lacks grounding. This is enough to prove all new filter paths without adding backend mocks.
- The top-level review link and per-card handoff are already present, so this run should not add another review queue or mutate Reflection state.
