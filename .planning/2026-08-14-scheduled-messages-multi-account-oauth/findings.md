# Findings

## Live diagnosis carried into implementation

- The current consent request contains only the Sheets scope.
- Google account-side access for Personal AI still exists on the second/work Google account and includes Sheets access.
- The first/default Google web account is a different personal account.
- `chrome.identity.getAuthToken` calls omit `TokenDetails.account`, so Chrome may resolve against the wrong account.
- Current initialization treats every silent auth failure as reauthorization, and 401 recovery removes a cached token using broad string matching.
- The OAuth project is in production, and current/past consent flows use the development OAuth client; testing-mode expiry and dev/prod client switching were ruled out for this incident.

