# Memory Service Default URL Findings

- With no stored `envConfig`, Options loads `defaultEnvConfig`, which uses the webpack/build environment URL.
- The development build therefore displays `http://10.32.56.212:3210/api/v1` from `.env.development`.
- Options does not persist that displayed default until the user saves.
- `MemoryServiceClient` independently initialized itself to `http://localhost:3210/api/v1`; missing stored config left that value unchanged.
- `CREATE_OUTREACH_FROM_MESSAGE` uses the singleton client directly, producing the observed localhost request.
- Existing Message Reaction checks do not cover the missing-`envConfig` default URL contract.

