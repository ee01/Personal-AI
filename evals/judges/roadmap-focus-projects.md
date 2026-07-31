# Roadmap Focus Projects Judge

## Pass criteria

- Alias / displayName appears as the primary human label in row/paragraph contexts
- Long raw Jira titles are absent from row context when displayName exists
- Per-team overwrite never deletes or archives another team's focus rows
- date_change receipts include a concrete toValue when the source message names a new date
- Project watch rules never set notifyMethod

## Fail criteria

- Context dumps full Jira titles for every project despite aliases
- One large team crowds out all other teams in a small budget
- Sync appends duplicates instead of overwriting within a team
- Date slips only become generic risk/info without actionable toValue
