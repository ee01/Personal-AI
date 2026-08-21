# Findings

- 待确认 created by `createEscalationConfirmRequest` lands in Memory Exploring → 决策中心 (`#/decisions`), category `outreach_followup`. Answering continue/pause/close does not actually resume the outreach session.
- Bot「主动询问结果」only fired from `markTerminal` when `status === 'resolved'`.
- Follow-up posts are recorded as `followup_sent` with `chatId`/`postId`; Glip URL is `https://app.ringcentral.com/messages/{chatId}/{postId}`.
- Chrome-extension exploring URLs are not clickable from Glip; continue entry must be a marker parsed by the RingCentral content script, plus session-detail query `continueFollowup=1`.
- Continue must keep `replyPostId` so `waiting_guard` precheck does not immediately re-resolve from the old reply.
