# Markdown Git Mirror

**Readiness review (2026-10-16): not ready for production acceptance.**
The original fixture suite still passes 12/12, but twelve additional safety and
delivery assertions fail. See [the review](./readiness-review-2026-10-16.md)
for reproduction evidence, uncovered requirements, and the future live test procedure.

From the repository root, run `node tools/verify-memory-mirror-readiness.mjs`.
It uses the existing in-memory fixtures and fake GitHub, writes
`test-results/markdown-git-mirror-readiness.json`, and removes its temporary test
source in `finally`. Exit 1 currently means the requirements are violated;
these are real failing assertions, not tests marked as expected failures.
The probes live in `readiness-probes.ts.txt` so the explicit audit command can
run them without changing the default test selection.

`npm run eval:markdown-git-mirror` runs the deterministic projection + GitHub
Git Data API assertions (no live network, no model calls). Tests live at
`memory-service/src/__tests__/markdownGitMirror.test.ts`.

Six groups mirror plan §7:

The six groups below describe the assertions in that particular fixture, not
proof that all possible source rows satisfy the contract:

1. **redaction** — the fixture projection excludes raw message text, tokens,
   secrets, `config.json`, or `restricted` / `local_only` units (including
   through the daily timeline unit links).
2. **self_only** — the `self_only` scope excludes other people's entities and
   observed-origin units while keeping the owner's confirmed content.
3. **increment** — five consecutive nights with unchanged truth produce zero
   re-uploads (0 blobs created) and zero commits; only the changed file is
   re-uploaded.
4. **conflict** — a remote hand-edit is preserved at its path, copied into
   `conflict-<date>/`, and never force-pushed.
5. **rebuild** — re-rendering the same truth yields byte-identical files, so a
   deleted local projection is rebuildable and the manifest stays stable.
6. **interop** — `interop/openclaw/USER.md` exposes confirmed preferences with
   `<!-- pai:unit:<id> -->` echo markers and excludes unconfirmed, other-person,
   and observed content.

A fake in-memory GitHub server implements the Git Data API
(`blobs → trees → commits → refs`) so the suite exercises the real provider
code path without a network or credentials. `MIRROR.md` is rendered in every
projection and declares what is and is not included.

Boundary: the offline suite cannot prove "7 consecutive nights against a real
test repository" or the human inspection of a real `esone.qiu` snapshot. Those
remain environment-dependent acceptance steps; run
`POST /api/v1/backup/mirror/preview` on a populated account and inspect the
returned file list. That endpoint returns paths, sizes, and hashes only, so
checking the actual rendered content requires a separate local snapshot render.
Do not enable a real-data mirror until the readiness findings have been fixed.
