# Memory Exploring Signed Source URL Boundary

## Target

- Random feature: `时间轴/搜索安全跳转`
- Source of truth: `docs/features/memory_system.md`
- Primary code: `src/modals/searchResultPresentation.ts`, `src/modals/components/TimelinePage.vue`, `src/modals/components/SearchResultPage.vue`

## Current State

Search results and timeline cards already share a link safety helper. It allows safe Memory Exploring hash routes, allows `http/https` source URLs, blocks unsupported schemes, blocks username/password URLs, and blocks several token-like query parameters. The gap is that signed source URLs can look like ordinary `https` links while query parameters such as `X-Amz-Signature`, `X-Goog-Signature`, `Signature`, `sig`, and access key identifiers still carry temporary access authority.

## External Scan

- Microsoft Recall and Google My Activity both frame personal history as review/manage/refind surfaces with visible filtering and privacy controls.
- OWASP documents query-string exposure as a real information disclosure risk because URL query values can leak through logs, history, referrers, and sharing.
- AWS S3 and Google Cloud signed URL docs treat signature/credential query parameters as temporary access capabilities.
- PIM/refinding research points to source and time cues as important for recovery, but the recovery path should not turn credential-bearing evidence URLs into casual one-click opens.

## Plan

1. Keep the existing route allowlist and `http/https` protocol boundary.
2. Normalize source query parameter names across case, hyphen, dot, and underscore variants.
3. Block signed URL / credential query names, including AWS/GCS/CDN signatures and common access-key identifiers.
4. Show a specific blocked reason: `来源链接已隐藏：包含签名或访问凭据参数`.
5. Update the feature doc and index at high level.
6. Prove the contract with targeted search-result presentation checks, timeline E2E, dev compile, and scoped diff checks.

## Non-Goals

- Do not loosen link opening rules.
- Do not add a new external-link confirmation flow.
- Do not change Memory Service recall, timeline data shape, or feedback write behavior.
