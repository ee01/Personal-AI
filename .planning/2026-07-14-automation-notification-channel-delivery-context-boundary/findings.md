# Findings

- `buildBackendNotificationContextMessage()` already receives both the current delivery reason and cross-channel receipts, so the ambiguity can be fixed without changing backend delivery records or feed behavior.
- The safest trigger is the conjunction of `deliveryContext.reason === 'new'` and a non-empty other-channel summary. This keeps ordinary first-time Chrome notifications concise while distinguishing Chrome-first from globally-new when another channel already has history.
- `effectiveStatus: delivered` proves channel delivery, not user completion. The Chrome failure boundary now says `曾已送达，不等于已处理` while preserving clicked and dismissed wording.
- The existing extension E2E can capture `chrome.notifications.create()` context labels directly, so it proves the user-visible system-notification string rather than only testing a formatter in isolation.
