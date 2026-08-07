# Findings & Decisions

## Requirements
- User requested a recurring random feature sweep from `docs/index.md`: inspect current docs/code, research comparable products and papers, identify constructive improvements, implement bounded unfinished/low-decision work, optimize UX, test as fully as practical, and close completed Reminder ideas.
- Selected feature: `会前准备` under Today Pilot, documented in `docs/features/today_pilot.md`.
- Reminder state: EventKit found `Personal AI` with 4 total items and 0 incomplete items, so no local feedback is available to incorporate or mark done.

## Research Findings
- `docs/progressing/to-verify.md` is empty.
- Automation memory shows the latest exact run was `AR 数据网页叠加`; recent runs covered many trust-boundary surfaces. This run scopes to RingCentral Video Home meeting prep rather than broader Today Pilot homepage work.
- Canonical docs already describe meeting prep as pre-generated/cache-first, RingCentral `/video/home` only, high-confidence vs basic background evidence, and local Meeting Pilot handoff boundaries.
- Runtime entry is `src/contentScriptRingCentralVideoHome.ts`. It renders the Video Home shadow card, reads cached Today Pilot prep, writes `meetingPrepHandoff` / `meetingPrepHandoffs` to `chrome.storage.local`, and refreshes by first backfilling then resolving cache.
- Focused checks are `tools/verify-today-pilot-video-home.ts` for static/source contracts and `tools/verify-context-assist-meeting-prep.mjs` for rebuilt E2E against `dist/contentScriptRingCentralVideoHome.js`.
- UX gap: visible receipts are strong, but the actual refresh icon currently has only `title="刷新会前准备"`, and evidence source links render without pre-click title/ARIA copy. These are the controls users touch before consequences happen.
- External scan: Microsoft Copilot meeting prep embeds context/tasks/resources in the meeting event; Microsoft Sales Copilot meeting cards expose timing, sources, detail view, and compliance/geo-boundary notes; Google Meet Gemini notes require consent/host controls and warn summaries can be incomplete; Zoom AI Companion summaries are host/co-host controlled and can create email/chat artifacts; trust-in-AI research supports transparency to avoid overtrust. Together this points to compact control-level boundaries, not backend redesign.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add pre-click boundary copy to Video Home refresh and evidence source links | The backend/cache behavior is already documented and implemented; the remaining UX risk is ambiguity at the actual click target. |
| Keep this presentation/accessibility-only | Avoids changing meeting prep generation, resolve/backfill semantics, handoff storage, or external system behavior. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Planning skill path under `.codex/skills` was missing | Read the installed skill from `/Users/Esone/.agents/skills/planning-with-files/SKILL.md` instead. |

## Resources
- `docs/features/today_pilot.md`
- `src/contentScriptRingCentralVideoHome.ts`
- `tools/verify-today-pilot-video-home.ts`
- `tools/verify-context-assist-meeting-prep.mjs`
- Microsoft Support: `https://support.microsoft.com/en-us/outlook/prepare-for-your-meeting-with-copilot`
- Microsoft Learn Sales Copilot: `https://learn.microsoft.com/en-us/microsoft-sales-copilot/meeting-prep`
- Google Meet Help: `https://support.google.com/meet/answer/14754931`
- Zoom Support: `https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0058013`
- Nature HSS Communications trust-in-AI review: `https://www.nature.com/articles/s41599-024-04044-8`
