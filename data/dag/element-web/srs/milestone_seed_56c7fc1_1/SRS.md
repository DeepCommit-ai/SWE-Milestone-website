# Software Requirements Specification: Identity Reset Protection UX Enhancement

## Overview

This SRS describes security and UX enhancements for identity management flows in the Element web client. The requirements address three areas:

1. **FR1**: Prevent accidental multiple identity reset operations with proper loading state feedback
2. **FR2**: Enforce device verification requirements in force-verify mode without bypass opportunities
3. **FR3**: Improve action button text clarity for pinned identity change notifications

**Affected Modules**:
- Reset Identity Panel (encryption settings)
- MatrixChat (main application component, login/verification flow)
- UserIdentityWarning (room-level identity change notifications)

---

## Requirements

### FR1: Identity Reset Loading State Protection

**Problem**: Users can click the identity reset "Continue" button multiple times while the reset operation is in progress, potentially triggering concurrent reset operations that could corrupt cryptographic state or cause key loss.

**Requirements**:
- When the user initiates an identity reset operation, the action button must become disabled immediately upon click
- While the reset operation is in progress, visual feedback must clearly indicate that the operation is ongoing
- A spinner or loading indicator must be displayed in place of or alongside the button text
- The button text must change to indicate the operation is in progress (e.g., "Reset in progress...")
- A warning message must be displayed advising the user not to close the browser window while the operation is in progress
- The cancel button must be hidden during the reset operation to prevent user confusion
- The warning message about not closing the window must be styled prominently (using critical/warning coloring)

**Acceptance**:
- When a user clicks the identity reset "Continue" button, the button becomes disabled and shows a loading spinner with progress text
- When the reset operation is in progress, a prominent warning message is displayed telling the user not to close the window
- When the reset operation is in progress, the cancel button is replaced with the warning message
- The reset operation cannot be triggered multiple times by repeated button clicks

---

### FR2: Force-Verify Mode Bypass Prevention

**Problem**: When the application is configured with mandatory device verification (`force_verification` setting enabled), users can bypass the verification requirement by initiating device verification with another device and then canceling the verification dialog without completing it, allowing access to the application without proper verification.

**Requirements**:
- When force verification is enabled and the user has not yet verified their device, dismissing or canceling an in-progress device verification dialog must not grant access to the application
- After the e2e/security setup flow completes or is dismissed, the application must check whether cross-signing is ready before allowing the user to proceed
- If force verification is required and the device remains unverified after the security setup flow concludes, the user must remain on the verification prompt screen
- The verification check must be enforced at two distinct entry points to the post-login screen:
  1. The initial post-login navigation that occurs after session setup completes
  2. The callback invoked when security/e2e setup dialogs are closed or dismissed

**Acceptance**:
- When force verification is enabled and a user cancels device verification after clicking "Verify with another device", the application continues to display the "Verify this device" prompt
- When force verification is enabled and cross-signing is not ready, the application does not show the post-login screen
- When force verification is enabled and the user successfully completes verification (cross-signing becomes ready), the application proceeds normally to the post-login screen
- After the security setup flow completes or is dismissed, the application must check if cross-signing is ready before proceeding to the post-login screen when force verification is active
- The application must not proceed to the post-login screen if cross-signing is not ready while force verification is required
<!-- COMMENTED OUT - Implementation detail:
- Check via `MatrixClientPeg.safeGet().getCrypto()?.isCrossSigningReady()` before calling `onShowPostLoginScreen()`
-->

---

### FR3: Pinned Identity Change Dismissal Button Text

**Problem**: When a user's pinned cryptographic identity changes (as opposed to a verification violation), the notification banner displays "Ok" as the action button text. This is confusing because "Ok" typically implies agreement or confirmation, whereas the user is simply acknowledging and dismissing the notification.

**Requirements**:
- For pinned identity change notifications (non-verification violations), the action button must display "Dismiss" instead of "Ok"
- For verification violation notifications, the existing "Withdraw verification" action text must remain unchanged

**Acceptance**:
- When a pinned identity change notification is displayed, the action button shows "Dismiss"
- When a verification violation notification is displayed, the action button shows "Withdraw verification"


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
