# Memory Capture Whole-Page Pre-Review Receipt

## Target

Feature: `整页资料保存` under Memory Capture.

## External Scan

- Notion Web Clipper, Readwise Reader, and Obsidian Web Clipper all make save intent explicit before or during capture: destination, saved content, metadata, and later review are visible product promises.
- PIM / KFTF research frames web saving as a re-finding task: users need to know what was kept and why it can be found later.
- For Personal AI, the highest-risk confusion is not the backend save path; it is the small right-edge `+` looking like a save confirmation before the review panel opens.

## Plan

1. Add a compact whole-page chip receipt: `未写入 · 先复核`.
2. Put the same boundary into the chip `aria-label` and `title`: the current page has not been saved yet; click opens review first and does not send or sync.
3. Keep scoring, manual save, auto-save, duplicate, and dismiss behavior unchanged.
4. Extend existing static and Playwright checks.
5. Update the canonical Memory Capture doc and automation memory.

## Reminder Branch

Local Reminders were readable, but no list named `Personal AI` exists. No Reminder items were linked, completed, or annotated.
