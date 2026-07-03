# User Profile Item Evidence Receipt Findings

## Repo Findings

- Target selected: `用户画像条目` in `docs/features/user_profile_system.md`.
- Main UI: `src/modals/components/UserProfilePage.vue`.
- Main view-model helper: `src/services/userProfileViewModel.ts`.
- Existing E2E: `tools/verify-user-profile-export-e2e.mjs`.
- Existing targeted verifier: `tools/verify-user-profile-system.ts`.
- The current User Profile page already provides mutation receipts for add, confirm, influence change, retract, restore, and export. Evidence expansion is the narrower UX gap: the user sees evidence snippets and safe-link hiding, but not a direct read-only boundary for opening the panel.

## External References

- OpenAI ChatGPT Memory FAQ: manage/delete/prioritize/deprioritize memory controls and memory history.
- Anthropic Claude memory docs: view/edit memory summary, past-chat citations, toggles, data export/import.
- Google Gemini Privacy Hub: manage saved info, activity, connected app access, exports, and retained external-service data separately.
- Response-Aware User Memory Selection (arXiv 2604.14473): memory selection should account for response utility, not only similarity.
- Mem0 (arXiv 2504.19413): production memory systems need selective extraction, consolidation, retrieval, and practical cost/latency control.

## Decision

Implement a presentation-only evidence-inspection receipt. It will not change profile item storage, confirmation, evidence URL sanitization, export, recall, or backend API behavior.
