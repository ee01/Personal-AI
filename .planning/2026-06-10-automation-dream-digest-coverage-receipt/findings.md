# Dream Digest Coverage Receipt Findings

## Existing Behavior

- Dream markdown already writes `Grounding Receipt` and `Grounding Snippets`.
- Dream Insights already handles missing files, missing receipts, low-confidence copy, and reflection-thread handoff.
- Dream Digest already limits weekly content to the current digest period and deep-links to the latest included dream.

## Gap

The pushed digest body says only `N dream(s) generated this period`. The detailed digest text lists dream excerpts, but it does not say what `this period` means, nor that older or undated dream files were intentionally excluded from the current push. This is easy to misread as the whole Dream Replay archive.

## Proposed Fix

Add a compact digest coverage receipt:

- coverage period start/end
- included dream count
- included dream paths
- excluded older / undated dream counts
- boundary that this push summarizes the current digest period only; older/undated files remain available on the Dream Replay page

## Reminder Check

AppleScript listed local Reminders lists: `We`, `Next actions`, `Moives`, `Shopping List`, `家庭`, `人名记忆`, `宝宝需要办理`, `吃吃看`, `出门前检查`, `装修待办`, `Reading`, `菜头`, `Tasks`. No `Personal AI` list exists.
