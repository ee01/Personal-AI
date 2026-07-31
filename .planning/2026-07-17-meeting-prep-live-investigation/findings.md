# Meeting Prep Live Investigation Findings

## Initial Evidence

- The requested capability was previously implemented as: Today Pilot creates planned outcome slots, Meeting Pilot binds live/post-meeting evidence, and Ask reads binders without mutation.
- The supplied screenshot cannot show the failure because the file is a 2x2 RGBA PNG.
- Real Chrome inspection is required because this path depends on the installed extension, authenticated RingCentral page, current calendar/meeting DOM, and reachable memory-service state.
- webpage-mcp is installed, but its first browser call could not find `/Users/Esone/.webpage-mcp/native-503.sock` or the temporary fallback socket; the browser extension/native host connection must be repaired before it can inspect tabs.
- Canary has Webpage MCP extension `iehgbogeakiedihodennfcnigojnncag` v0.9.0 enabled and its popup reports `Running / Connected` with background mode on.
- Process inspection found native host PID 6816 running since July 14 and holding `/Users/Esone/.webpage-mcp/native-503.sock` as an open Unix socket even though the filesystem path is gone. This stale unlinked socket explains the false-connected popup and `ENOENT` from new MCP clients.
- After restarting only the stale native host and reconnecting from the Canary popup, webpage-mcp tab discovery works through fresh native-host PID 50628.
- Authenticated tabs currently available to webpage-mcp include the RingCentral group `Nova CA - Brandy`, internal Google Docs, RingCentral Wiki, Jira, GitLab, and AI Native Knowledge pages. The previously observed Video Home URL is no longer in the accessible tab list, so it will be reopened in a background tab.
- webpage-mcp opened the real authenticated `RingCentral - Meetings - Upcoming` Video Home page and extracted its actual meeting list.
- The page contains many eligible meetings, including `Nova Brandy Daily`, `26.3.20 Planning`, `Nova brandy investigation result sync with PM & story time`, `RCVSDK Daily Sync`, and future recurring meetings.
- The real page text contains no `本场要闭环`, Today Pilot, or Meeting Outcome Binder UI at all. This is an injection/request/render failure, not an empty-calendar condition.
- Current source and `dist/manifest.json` both register `contentScriptRingCentralVideoHome.js` for `https://app.ringcentral.com/*`; the real URL starts with `/video/home`, so host/route matching should be eligible.
- The content script removes `#pai-meeting-prep-host` when it cannot select an event. Absence of the host can therefore mean either an outdated/missing installed script or a real calendar-sync/selection failure, not only a CSS/render issue.
- Canary Default profile has the unpacked development extension `hkmimegiefnbeadjoonnlogikcdddcho` registered at `/Users/Esone/git/personal-ai/dist`; its active/scriptable permissions include `https://app.ringcentral.com/*` and the required extension APIs.
- The Chrome Web Store `Personal AI` v8.6.0 entry is disabled. The real page should therefore be served by the unpacked development extension, not the store build.
- The development extension popup opens successfully and displays a freshly generated Today Pilot snapshot from the real memory service, so the extension background and service connectivity are alive.
- On the real Video Home page, `#pai-meeting-prep-host` exists with a normal 704x245 layout at y=577, but computed `visibility` is `hidden`. It is mounted inside RingCentral class `MuiBox-root jss47`, indicating `findInjectionTarget()` selected a hidden SPA copy of the meeting UI.
- This is primarily a real-DOM target-selection bug. The absence of visible UI is not caused by a missing content script, disabled feature flag, missing meetings, or an unavailable memory service.
- Reading specific shadow-DOM fields exposed a second failure: the selected real event is `Nova brandy investigation result sync with PM & story time`, but the card contains `MemoryService 400: Bad Request`, `Today Pilot 暂未为这场会议生成提前准备`, and `本地日历读取失败`; no prep receipt or outcome binder is present.
- `findMeetingDetailRoot()` validates explicit detail roots with `isDisplayedElement`, but its description-box fallback returns the first right-side ancestor solely by width/position. That unchecked fallback is the direct code path that can mount under hidden `jss47`.
- A first screenshot attempt through webpage-mcp failed with `image readback failed`, and OS `screencapture` returned a black image due capture restrictions. DOM and accessibility evidence remain available; visual proof must be retried after the rebuilt extension is loaded.
- Real RingCentral IndexedDB contains 84 events in the current read window. `PM & UX Session with OpenAI/RingCentral` has 400 attendees; the next largest observed meeting has 73.
- The deployed `/calendar-events/sync` schema rejects any event above 120 attendees. A synthetic invalid request against `10.32.56.212` reproduced the exact response: `body/events/0/attendees must NOT have more than 120 items`.
- `normalizeCalendarEventForSync()` currently forwards every normalized attendee without a cap. One large meeting therefore rejects the entire 84-event batch and prevents every otherwise valid meeting from receiving Today Pilot prep.
- The fix now caps sync attendees at 120 and preserves `attendeeCount` plus `attendeesTruncated` in metadata; the selected event itself is not dropped.
- The DOM fix ignores hidden description boxes/ancestors and hidden generic candidates, then mounts before a visible description when available so the card appears higher in the meeting detail.
- Regression coverage includes a 400-attendee unit case and an E2E fixture with a hidden stale RingCentral detail copy before the visible meeting detail.
- The first successful 96-hour prepare returned eight items, but real Pluto detail still showed `prep_not_found`. The batch job used the request date for every prep while resolve uses the event's actual local date; this made all future-day rows unreachable.
- Batch prepare now computes `localDate` per event. A new API regression prepares a meeting 48 hours ahead from today's backfill and proves detail lookup returns the cached prep without a second LLM call.
- Real generated data revealed that calendar invite meeting IDs/passcodes could flow into prep evidence and deterministic binder slots. A shared redactor now covers calendar-derived evidence, LLM prompts and outputs, cue cards, context packs, binder evidence, and fallback slot candidates.
- Cleanup removed only derived meeting prep/binder rows: 71 rows containing unredacted credential fields and 83 rows with old incorrect date keys. Original calendar and long-term memory data were not mutated.
- After regeneration, the remote database scan reported 123 prep rows / 9 binders with zero unredacted credential rows before the date fix; after final cleanup and regeneration, all newly generated rows use their meeting-local date.
- Real webpage-mcp proof succeeded on visible Video Home DOM: Pluto daily showed rule fallback, four evidence sources, four planned outcome slots, and handoff/writeback boundaries; RCVSDK Daily Sync showed the target version, four high-confidence sources, three outcome slots, and Nova Brandy ownership context.
- The authenticated `Nova CA - Brandy` group page contains current handoff, approval-link, requirement-clarification, and reply context. The authenticated MTR-148115 page contains the AI Notes long-polling background and target behavior used by the Sharing scenario.
- Webpage MCP background mode was temporarily disabled for foreground proof and restored to `On` after verification.
