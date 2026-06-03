# Compose Style Memory Judge

Heuristic pass criteria:

- Repeated redacted Compose Assist traces are accepted without raw sent text.
- A stable writing style memory is promoted into `USER_CORE`.
- The promoted profile entry keeps scope in the key, such as `writing_style.ringcentral.peer.casual_reply.zh`.
- The next compose prompt includes the style rules that make the reply less AI-flavored.
- The report should fail if raw final text appears in `USER_CORE` or prompt diagnostics.
