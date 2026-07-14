# Findings

- The result cards were mouse-clickable but did not expose a dedicated keyboard-first open action.
- Existing child buttons already covered source/detail/diagnostic actions, so treating the whole card as a nested button would risk worse accessibility.
- The safest fix is a first action button that reuses `handleResultClick(entity)` and therefore keeps existing safety receipts and side-effect boundaries.
