# Findings

- The real RingCentral Memory Lens card opens in a read-only state and has no attribution chip or correction control for its ordinary evidence. This matches the low-noise contract.
- The fixture extension E2E reaches the Ask receipt correction click but never observes the success receipt.
- The rendered failure state was `未更新：MemoryService 404: Memory claim "claim-ai-suggestion-1" not found` and the fixture recorded no correction request.
- The extension service worker had initialized the Memory Service client against a configured remote base URL before the fixture seeded storage. The localhost-only fixture route covered Ask but not correction. The route now matches any host's `/api/v1/` path, so all fixture requests remain local.
