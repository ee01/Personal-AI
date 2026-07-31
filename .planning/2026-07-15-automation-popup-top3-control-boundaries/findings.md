# Popup Top 3 Findings

## Repo Findings

- `docs/features/today_pilot.md` already documents `Popup Top 3` as a Top 3 derived snapshot with scope receipt, snapshot basis, `查看全部`, feedback pending/success/failure receipts, degraded empty state, and stale-snapshot behavior.
- `src/popup.tsx` implements the scope receipt and feedback notices, but several actual click targets still expose generic or missing `title` / `aria-label`: card main button only uses `whyNow`, `完成` and `稍后` use short titles, normal `复制` has no title/ARIA, external execution review has only a generic title, `Video Home` has no boundary, and `查看全部` has no `aria-label`.
- `tools/verify-today-pilot-home-e2e.mjs` already loads the built popup and has fixtures for overflow cards, normal copyable cards, feedback pending, and external execution cards. It is the right E2E place to prove the control-level boundaries.

## Reminder Findings

- AppleScript lists local Reminder lists without `Personal AI`.
- EventKit read access is granted and found `Personal AI` with `PERSONAL_AI_TOTAL=4` and `PERSONAL_AI_INCOMPLETE=0`.
- No Reminder feedback applies to `Popup Top 3`.

## External References

- Microsoft 365 Copilot `Plan My Day` template emphasizes a scannable morning briefing, top 3-5 priorities, direct links, and actionable context across work data.
- Gemini Daily Brief exposes actionable daily items from Gmail, Calendar, and Gemini chats, lets users mark complete/dismiss, inspect sources, and give feedback.
- Microsoft Research / arXiv `AI-Powered Reminders for Collaborative Tasks` found users value surfaced reminders, but existing reminder action buttons were not always understood; users wanted clearer interactions like done, remind/schedule, save for later, and acknowledge.

## Improvement Decision

The constructive improvement is not to change ranking or feedback semantics. The UI already has the right surrounding receipts; the remaining risk is that the exact popup buttons still look stronger than they are. Add dynamic per-button `title` / `aria-label` text so hover and screen-reader paths explain whether the click opens the Today Pilot page, starts a local Video Home navigation, writes pending display feedback, copies context to the clipboard, or only navigates to the external-action review path.

