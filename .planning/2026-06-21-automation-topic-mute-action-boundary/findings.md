# Findings

## Current Behavior

- Topic detail page mute dropdown already shows `静音边界`: local attention filtering, unread retained, no Memory Service or original-platform writeback.
- Topic list card mute dropdown exposes reason and duration controls without the same adjacent boundary receipt.
- Existing queue-level receipt says later/mute only changes local unread flow, but it is global and easy to miss when acting on a specific card.

## External Scan

- Zulip topic mute hides muted topics from main feeds/unread counts unless explicitly included, while keeping search/recovery routes.
- Slack channel/DM mute focuses on notifications and hiding, with separate unread/mention behavior.
- Email triage research frames unread handling as deciding what to do with unhandled messages, not only clearing unread counts.
- Notification snooze research supports user-defined deferral, but warns redelivery can create another interruption; recovery and clear timing matter.

## Decision

Add a per-card list mute boundary plus a stronger action toast. Do not add backend sync in this run because current docs explicitly treat topic mute as local browser state and cross-device sync is a future improvement.
