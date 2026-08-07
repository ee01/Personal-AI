# Findings

## Repo Context

- Target selected from `docs/index.md`: `今天排序与噪声控制` under Today Pilot.
- `docs/progressing/to-verify.md` says `暂无。`.
- Local Reminders is reachable, but there is no `Personal AI` list, so no Reminder item can be incorporated or completed.
- Current worktree already contains broad Today Pilot and unrelated automation changes; this run must stay scoped.

## External Research

- Microsoft 365 Copilot Plan My Day emphasizes top 3-5 priorities, direct links, actionable context, and a short scannable briefing.
- Gemini Daily Brief pulls from Gmail, Calendar, and Gemini chats, exposes item sources, and is generated as a once-per-day morning snapshot.
- OpenAI ChatGPT Pulse Help Center says Pulse is being retired in favor of scheduled tasks for daily briefings, reinforcing that proactive briefs should be framed as bounded snapshots.
- Notification-interruption research finds reducing notification-caused interruptions can improve performance and reduce strain, while differences like FoMO and telepressure matter.
- Email batching/self-interruption research suggests user agency around when to handle information affects perceived productivity; daily brief UX should preserve control and avoid implying automatic source-state changes.

## UX Direction

The homepage already recalculates visible mission counts after feedback. The missing piece is copy that tells the user the top summary is now a post-feedback visible snapshot. That avoids confusing a reduced count with source task completion, read-state updates, schedule changes, or external sync.
