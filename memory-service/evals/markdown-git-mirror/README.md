# Markdown Git Mirror

`npm run eval:markdown-git-mirror` runs the deterministic projection + GitHub
Git Data API assertions (no live network, no model calls). Tests live at
`memory-service/src/__tests__/markdownGitMirror.test.ts`.

Six groups mirror plan §7:

1. **redaction** — the projection never contains raw message text, tokens,
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
returned file list.
