# Findings
Issue E-30 asks to verify memory-wide RCV Mobile demo evidence and three inputs (Slides, RC chat, calendar). No prior comment threads at initial scan. Current date 2026-09-21 Asia/Shanghai. Real service documented at 10.32.56.212:3210, user esone.qiu. Existing working tree has unrelated roadmap and issue-description changes.

- Google Drive fetch confirms target presentation contains “Demo / Mobile: Edit notes in AI notes - Sandy Pan”; metadata modified_time 2026-09-21T08:48:48.757Z. Full returned text retained in tool store, not repo.
- RC browser target currently shows Sandy Pan DM (not necessarily a group), with Today and reply thread collapsed; generic page extraction missed message body. Need targeted DOM or database.
- Unauthenticated /health has degraded, DB false by design when no user context (health.ts 63-71); NOT evidence of DB outage. SSH works; docker is /usr/local/bin or /opt/homebrew/bin, absent in nonlogin PATH initially.

- Live DB read-only successfully via SSH + better-sqlite3 readonly/query_only; raw timestamps use SECONDS (first attempt divided by 1000 incorrectly; corrected, never report 1970 as actual evidence).
- Exact calendar exists in calendar_events/messages_raw/chunks. Current pre demo of eidt notes 2026-09-21 15:30–16:00 +08, first ingested 08:56:58, synced/chunk refreshed 09:11:58; old 15:00 event is cancelled.
- DM 1350236299266 = esone.qiu+sandy.pan; owner message Sep20 21:59:56 “明天要demo Edit notes么，后天 weekly” ingested 22:21:31. Sandy Sep21 08:53:16 re-schedule reply ingested 09:57:37 with context messages.
- RCV Mobile VT3 Sandy Sep21 15:30:49 pre demo post ingested16:22:37 (51m48s). Need exact Ask time to decide before/after ingestion.
- Active watched_projects16 have no RCV Mobile alias, so potential hard-filter bug is NOT demonstrated root cause here.
- Target deck capsules=0, link references exist in calendar/glip; distinguish link memory from body memory.
- Current answer_memory_observations contains no original question match; delegated local Desktop history audit.
- webpage JS repeatedly serialization error; fallback AppleScript read worked, confirms DM parent text and last reply, no page interaction performed.

- Current exact work-scope FTS rank774 (all-scope911), raw rank626 for calendar; DM raw641; Sep1 recording144; all exceed respective default45 and120 first-stage windows. Calendar vec0 rows absent. Current raw corpus filtered created_at<=13:55:05 yields calendar621/DM635/recording143; approximation not historical replay.
- Desktop resume exact original answer located at13:58:54.454, matching local13:54:52.724–13:58:54.220 HTTP stream (4m01.5); log lacks query so strong correlation not direct body trace. Only first5 clipped evidence refs persisted; no full recall diagnostics.
- V3 contains provisional open_question “明天是否要demo Edit notes” from yesterday; not proof v3 serves Ask.
- TargetRC VT3 pre-demo15:30 message was sent AFTER original Ask, thus cannot explain13:58 answer.
- Broad intermediate DB dumps were minimized to evidence-summary.json and deleted to avoid retaining unrelated calendar credentials.

## 2026-09-23 follow-up evidence
- Current HEAD d3d6592. Live read-only check again confirms owner DM c760... content and created_at; glip/work, entities null; chunk331815 exists; matching provisional open_question exists. Target Slides capsules still0. These checks confirm retention, not a replay of original Ask.
- Five refs is Desktop resume persistence; current public recall10/15, Desktop evidence disclosure8; agent tracing prompt1200 estimated-token recall section plus other context.
- User requests plan only; original candidate ranks remain dated09-21 baseline and not relabeled current.

- Current code budgets clarified: public10/15, deep15/23, subquery45/69 not global channel total; main evidence1200 char-estimated tokens plus untrusted600 and other extra contexts; first4 body500chars/rest160; Desktopdisplay8+expand; resume5 refs is persistence only.
- Revisit path absent: repeatVisit/openedFromMemory scoring types not fed by current production client, update_existing does not update same-source version, only existing general capture.
- Sources checked09-23: GoogleSlides get updated08-31; Drivefiles updated07-14; Lost in the Middle TACL2024 supports testing selection/placement, not assuming today's models share published results.
