# Today Pilot Visible Snapshot Receipt Plan

## Goal

Improve `今天排序与噪声控制` so the Today Pilot home summary clearly says when the top filter counts are a post-feedback visible snapshot, not the original generated brief or proof that source systems changed.

## Plan

1. Inspect Today Pilot docs, homepage code, verifier, E2E, automation memory, and Reminders.
   - Status: complete.
2. Research comparable daily-brief / attention-management products and papers.
   - Status: complete.
3. Implement a small UX receipt in the top `筛选口径` note after successful Today Pilot feedback.
   - Status: complete.
4. Update docs and automated checks.
   - Status: complete.
5. Run targeted verification, `npm start` first compile, E2E, whitespace checks, and update automation memory.
   - Status: complete.

## Implementation Notes

- Keep the ranking algorithm unchanged.
- Do not overwrite unrelated dirty Today Pilot changes already present in the worktree.
- The receipt should mention that visible counts reflect Today Pilot feedback only and do not complete source tasks, mark messages read, change schedules, or sync external systems.
