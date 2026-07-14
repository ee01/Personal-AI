# Findings

- Selected feature: `记忆摄入、去重、显著性评估` under Memory Service.
- Recent automation memory showed very recent work on Agent Thinking, Topic Messages, Meeting Pilot, Notification Center, Doubao, User Profile, Outreach, Reflection, Relationship Radar, Message Analysis, and Topic mute, so this run avoided those exact surfaces.
- `docs/progressing/to-verify.md` is empty.
- EventKit found the local `Personal AI` Reminders list with 4 total items and 0 incomplete items. No live Reminder feedback was related to memory ingest, dedupe, salience, or behavior affinity.
- External scan:
  - Mem0 and graph-memory work emphasize extracting, consolidating, and retrieving salient compact memories rather than replaying full history.
  - Generative Agents uses recency, importance, and relevance as memory retrieval signals.
  - OpenAI ChatGPT Memory distinguishes stable saved memories from adaptive chat-history references, reinforcing that memory systems must be selective and user-controllable.
  - Recent agent-memory surveys and experience-following studies warn against naive memory growth and stale/irrelevant replay.
  - Trustworthy memory-search work treats memory retrieval/admission as a trust boundary, supporting explicit gates and diagnostics.
- Code finding: `docs/features/memory_system.md` and the `SalienceScorer` comment both say ingest affinity matches entity name/alias, but `computeEntityAffinityBoost()` only matched `entities.name`. Alias-only project codes or people aliases therefore lost positive behavior affinity during ingest scoring.

