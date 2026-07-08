# Software Requirements Specification: SSO Pickle Key Generation and Session Handling

## Overview

This milestone addresses authentication handling improvements across three functional areas:

1. **FR1**: Pickle key generation for SSO (Single Sign-On) sessions - SSO login flows do not generate or persist pickle keys, causing encryption inconsistencies
2. **FR2**: Device ID retrieval for access token login - The `mxLoginWithAccessToken` utility does not retrieve device ID from the homeserver, resulting in incomplete session credentials
3. **FR3**: Token expiry race condition handling - When a session token expires during session loading, misleading error dialogs are displayed to users

**Affected Modules**:
- Session lifecycle management (`Lifecycle`)
- Main application component (`MatrixChat`)

---

## FR1: Pickle Key Generation for SSO Sessions

**Problem**: Users logging in via SSO (token login or OIDC authorization) do not have a pickle key generated or loaded for their session, unlike users who log in through the standard login flow.

**User Report**:
```
After logging in via SSO, the session does not have a pickle key associated with it.
This causes issues with encrypted credential storage since the pickle key is
required for securely encrypting sensitive tokens in IndexedDB.
```

**Requirements**:
- When a user authenticates via delegated authentication (SSO token login or OIDC flow), a pickle key must be loaded or created for the session
- The pickle key loading/creation logic should first attempt to load an existing pickle key for the user/device combination
- If no existing pickle key is found, a new one should be created (provided both userId and deviceId are available)
- The pickle key must be associated with the credentials before they are persisted to storage
- The existing pickle key creation logic in the standard login flow should be consolidated to avoid code duplication

**Acceptance**:
- When a user logs in via SSO, their session credentials include a valid pickle key
- When a user logs in via OIDC native flow, their session credentials include a valid pickle key
- When a pickle key already exists for a user/device combination, it is loaded rather than recreated
- When a pickle key is successfully created, the system logs the creation with user and device identifiers

---

## FR2: Device ID Retrieval for Access Token Login

**Problem**: The `mxLoginWithAccessToken` developer utility function does not retrieve the device ID when logging in with an existing access token, resulting in incomplete session credentials.

**Requirements**:
- When logging in with an access token via the developer utility, the device ID must be retrieved from the homeserver's `/whoami` endpoint
- The device ID must be included in the credentials passed to the login flow

**Acceptance**:
- When `mxLoginWithAccessToken` is called, the resulting session includes both the user ID and device ID from the `/whoami` response
- The device ID is available for subsequent operations that require it (e.g., pickle key generation)

---

## FR3: Token Expiry Race Condition Handling

**Problem**: When a user's access token expires while the application is loading a session (e.g., due to the homeserver or identity provider terminating the session), an error dialog is incorrectly shown to the user instead of gracefully handling the logout.

**User Report**:
```
When MAS (Matrix Authentication Service) kills my session while Element is loading,
I see a confusing "Unable to load session" error dialog instead of the expected
"session has been signed out" message. The error appears because the session
loading process throws an exception that is not properly handled when a logout
is already in progress.
```

**Requirements**:
- The session loading process must accept an abort signal to allow external cancellation
- When a session is invalidated (token expiry, server-side logout), the session loading operation should be aborted
- When session loading is aborted due to external cancellation, no error dialog should be displayed
- The abort signal must be passed through the entire session loading call chain, including retry attempts after failures
- When the `SessionLoggedOut` event fires, any in-progress session loading must be cancelled before processing the logout
- The logout dispatch must complete before showing the "session signed out" dialog to ensure proper cleanup

**Acceptance**:
- `loadSession(opts)` must accept an optional `abortSignal` parameter of type `AbortSignal` in its options object
- When session loading throws an exception but the abort signal has been triggered, no error dialog is displayed and the function returns `false`
- When the server invalidates a session during application startup, the user sees only the session expiry message (not a session restore error)
- When session loading fails and the user chooses to retry, the abort signal is preserved for the retry attempt
<!-- COMMENTED OUT - Implementation detail:
- Check for abort via `opts.abortSignal?.aborted` before displaying error dialog
- The same `opts` including `abortSignal` must be passed to the retry call
-->


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
