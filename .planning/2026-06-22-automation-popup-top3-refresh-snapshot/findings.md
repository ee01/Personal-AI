# Popup Top 3 Refresh Snapshot Findings

## Repo Findings

- `docs/progressing/to-verify.md` says there are no pending carry-over items.
- Recent automation memory does not show `Popup Top 3` as a recent exact target.
- `Popup Top 3` is documented in `docs/features/today_pilot.md` and implemented in `src/popup.tsx`.
- Current popup already displays `你要做`, `为什么出现`, compact evidence/confidence metadata, Top 3 scope receipt, context-pack copy receipt, and external-execution guardrails.
- Current refresh failure path in `loadTodayPilotCards()` clears existing cards and receipt. This is correct for first load with no data, but weak after a successful snapshot is already visible because the user loses the last known Top 3 and cannot tell whether this is "no missions" or "refresh failed".

## Reminder Findings

- Reminders list names returned: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`.
- There is no visible local Reminders list named `Personal AI`.

## External Reference Findings

- OpenAI's ChatGPT Pulse pattern used memory, chat history, and feedback to produce a finite personalized daily update, while current Help Center material says Pulse is being retired and daily updates should move to scheduled tasks.
- Gemini Daily Brief summarizes connected Gmail, Calendar, and Gemini chat context and exposes item sources, supporting a finite, source-aware morning snapshot rather than an infinite feed.
- Proactive-agent research emphasizes user-centered proactivity and avoiding overpromising; a popup snapshot should distinguish helpful stale context from confirmed current state.
- Notification batching research supports finite, low-interruption batches over continuously interruptive alerts.
