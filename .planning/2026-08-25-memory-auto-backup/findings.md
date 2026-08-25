# Findings

## Product
- Manual export used in-memory zip + sync HTTP; GB libraries timed out.
- Layer B markdown cannot be regenerated from SQLite; vectors/FTS can (slim).
- Users have no server shell, so local-dir provider stays test-only.
- Desktop pull is outbound HTTPS; no inbound ports on the Mac.

## Implementation
- Format: PABK1 + scrypt + AES-256-GCM, tag at EOF.
- Jobs TTL 1h; per-user export lock returns 409.
- Sensitive config keys return `xxxConfigured` only.
- Deferred: GFS retention, yauzl import, remote restore UI, re-embed backfill.

## Tests
- backupCrypto / backupSchedule / api-backup pass after clearing API_KEY.
