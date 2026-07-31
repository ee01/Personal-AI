# Meeting Prep Live Investigation

Goal: determine why the real RingCentral meeting list does not show Today Pilot pre-meeting outcome information, repair the actual runtime path, and prove the result against real user memory and real Chrome pages.

## Product Boundary

- Today Pilot / Video Home owns pre-meeting `本场要闭环` information.
- Meeting Pilot owns live tracking and post-meeting binding.
- Ask remains a read-only consumer.
- Do not fabricate evidence or expose private memory beyond the user's own authenticated pages.

## Phases

| Phase | Status | Scope |
| --- | --- | --- |
| 1 | completed | Inspect the user's Chrome/Canary meeting-list page with webpage-mcp and capture DOM, console, extension, and network state |
| 2 | completed | Trace the content-script eligibility, meeting extraction, memory-service request, and response rendering path |
| 3 | completed | Query real `esone.qiu` memory data and relevant authenticated group/history pages for meetings with useful evidence |
| 4 | completed | Implement the narrow root-cause fix and add regression coverage |
| 5 | completed | Rebuild, run targeted API/E2E checks, deploy/reload where required, and verify in real Chrome with webpage-mcp |
| 6 | completed | Produce a list of real scenario URLs with what can be seen on each page |

## Known Constraints

- The supplied clipboard PNG is only 2x2 pixels and contains no diagnosable UI detail.
- The repository has a broad pre-existing dirty worktree; only task-owned files may be edited.
- Real-browser validation must reuse the user's authenticated Chrome/Canary tabs where possible and run in the background by default.

## Errors Encountered

| Error | Attempt | Resolution |
| --- | --- | --- |
| Supplied screenshot is blank 2x2 PNG | Initial visual inspection | Use webpage-mcp against the real browser page as the source of truth |
| webpage-mcp could not connect to either native socket | First `get_windows_and_tabs` call | Run webpage-mcp doctor and repair/reconnect the Chrome Canary native host before live-page validation |
| Canary popup reported connected while MCP calls still failed | Bridge recovery | Stopped stale July 14 native-host PID 6816 holding an unlinked socket, used the popup reconnect control, and confirmed fresh PID 50628 owns the live socket |
| Real page had meetings but no visible Today Pilot UI | Live DOM inspection | Proved `#pai-meeting-prep-host` exists but is mounted under a `visibility:hidden` RingCentral DOM branch; investigate and fix target selection |
| Real calendar sync failed with MemoryService 400 | Real IndexedDB and API reproduction | Found one event with 400 attendees while server schema caps each event at 120; cap the client payload and preserve truncation metadata so one large meeting cannot reject the full batch |
| Initial combined implementation patch did not apply | First edit attempt | Import order differed from expected context; split the change into small patches and applied each cleanly |
| Generated future meetings still resolved as `prep_not_found` | First real Pluto page check | Found batch prepare stored every item under the request date; store each item under its actual meeting date and add a 48-hour cross-day regression test |
| Derived prep exposed invite credential fields | Real generated binder inspection | Added shared credential redaction across evidence, prompt, model output, fallback, and binder; removed affected derived caches and rescanned to zero unsafe rows |
| Remote BuildKit returned EOF after compiling | First scoped deploy | Confirmed old image remained, rebuilt the same scoped source with classic Docker builder, recreated the service, and verified the new dist code in-container |
