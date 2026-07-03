# Memory Capture API sensitive source URL gate

## Target

- Feature index row: `Memory Capture API`
- Source doc: `docs/features/memory_capture.md`
- Scope: source-memory candidate scoring and capsule save API

## External signal

- Web clippers and readers preserve source provenance so users can re-find why a page mattered.
- PIM research frames keeping as mapping encountered information to later need.
- For Personal AI, provenance is useful only when the source URL itself is safe to store.

## Improvement plan

1. Keep normal source-memory save, duplicate, distillation, dismiss, and detail behavior unchanged.
2. Block source URLs that carry userinfo, token/session/passcode/password parameters, OAuth code parameters, or signed-access signatures before candidate or save flow proceeds.
3. Add focused API coverage proving blocked candidate scoring and rejected capsule creation do not write capsules or `web` memory signals.
4. Update the Memory Capture doc with the new gate and its boundary with existing safe-link hiding for historical/recall data.

## Verification

- Run the targeted source-memory API test.
- Run `npm start` until the first successful compile, then stop it.
- Run the source-memory capsule E2E against the rebuilt extension.
- Run scoped `git diff --check` for touched files.
