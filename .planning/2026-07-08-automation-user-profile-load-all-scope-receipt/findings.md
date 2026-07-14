# Findings

## Repo State

- `docs/progressing/to-verify.md` is empty.
- EventKit found the local `Personal AI` Reminder list with 4 total items and 0 incomplete items.
- The worktree is broadly dirty from prior automation runs; current ownership is limited to the planning directory, `UserProfilePage.vue`, `verify-user-profile-export-e2e.mjs`, and concise docs/index wording for this feature.

## Product / Research Scan

- OpenAI ChatGPT memory controls expose manage/delete semantics and distinguish deleting a memory from deleting a chat. User profile UIs should keep memory state changes explicit.
- Claude memory export/import docs emphasize viewing memory as the assistant sees it before exporting or moving it. Personal AI should similarly distinguish "loaded for review" from "eligible for personalization".
- Gemini Saved info and import-memory surfaces keep saved memory/settings under user-controlled pages, reinforcing that profile edits and imports need clear user-controlled scope.
- RUMS / response-aware memory selection argues memory injection should be utility-selected, not simply all similar memories. Loading all profile rows for review must therefore not imply all rows will enter prompts.

## Code Findings

- The profile item list already has a `检索范围` receipt when only a loaded slice is available.
- The `加载全部` button only changes label to `加载中...` and then sets a generic top-level status. There is no in-list pending/success/failure receipt explaining that the action is a read-only pagination refresh.
- After loading completes with no active filters, `profileItemsSearchScopeReceipt` disappears, so users lose the explicit "full fetched set" basis near the list.

