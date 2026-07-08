# Software Requirements Specification: Key Storage Toggle for Encryption Settings

## Overview

This specification defines requirements for adding a key storage management feature to the Encryption settings tab. The feature allows users to enable or disable server-side key backup storage (megolm key backup), providing control over whether cryptographic identity and message keys are stored on the server.

### Requirements Summary

1. **FR1**: Key Storage Panel - Display a toggle UI for enabling/disabling server-side key storage
2. **FR2**: Key Storage State Management - Implement ViewModel pattern for managing key backup state with proper async handling
3. **FR3**: Delete Key Storage Confirmation - Show confirmation panel when user attempts to disable key storage
4. **FR4**: Encryption Tab State Management - Update tab state based on key backup status and respond to status changes
5. **FR5**: Cross-Client Compatibility - Set account data flags to maintain compatibility with Element X key backup behavior

### Affected Modules

- Encryption settings tab and related panels
- Key backup and crypto API integration
- Account data management for cross-client compatibility

---

## Functional Requirements

### FR1: Key Storage Panel

**Problem**: Users cannot enable or disable server-side key storage from the Encryption settings. There is no UI to control whether encrypted message keys are backed up to the server.

**Requirements**:
- Display a "Key storage" section in the Encryption settings tab with a toggle control labeled "Allow key storage"
- The toggle should reflect whether this device is actively uploading megolm keys to the backup (based on active session backup version)
- When the toggle is disabled (key storage is off), show a "Recommended" tag on the section header to encourage enabling
- Display a loading spinner while the key storage state is being determined
- Display an inline spinner next to the toggle while a state change is in progress
- When the toggle is turned ON and no existing backup exists, create a new key backup on the server
- When the toggle is turned ON and a backup already exists, enable the device to use the existing backup without resetting it
- When the toggle is turned OFF, navigate to the delete confirmation panel (FR3)
- Provide a link to help documentation about encryption in the section description

**Acceptance**:
- When the Encryption tab loads and key backup is active, the "Allow key storage" toggle is checked
- When the Encryption tab loads and key backup is not active, the "Allow key storage" toggle is unchecked and "Recommended" tag is visible
- When the user enables key storage and no backup exists, a new key backup is created on the server
- When the user enables key storage and a backup already exists, the existing backup is enabled without being reset
- When the user clicks to disable the toggle, they are navigated to the delete confirmation panel

---

### FR2: Key Storage State Management

**Problem**: There is no centralized logic for managing key storage toggle state, checking backup status, and performing enable/disable operations with proper UI feedback.

**Requirements**:
- Provide a ViewModel hook that exposes: current enabled state, loading state, busy state, and a setEnabled function
- The enabled state should be determined by checking if the device has an active session backup version
- While state is loading initially, report loading as true
- When setEnabled is called, immediately update the displayed value to the pending value before the operation completes (optimistic UI)
- While the operation is in progress, report busy as true
- When enabling key storage:
  - Check if a key backup already exists on the server
  - If no backup exists, create a new one using resetKeyBackup and then enable it
  - If a backup exists, enable the existing backup without resetting
- When disabling key storage:
  - Call the crypto module's disableKeyStorage method to delete server-side key storage
- Stop the device listener during enable/disable operations to suppress warning toasts during the multi-step process, then restart it when complete
- Re-check the actual status after enable/disable operations complete

**Acceptance**:
- The ViewModel must be exposed as a React hook named `useKeyStoragePanelViewModel` returning an object with properties:
  - `isEnabled: boolean | undefined` - current enabled state (or undefined while loading)
  - `setEnabled: (enable: boolean) => Promise<void>` - function to enable/disable key storage
  - `loading: boolean` - true while initial state is loading
  - `busy: boolean` - true while a state change operation is in progress
- When `setEnabled(true)` is called, `isEnabled` is immediately set to true (optimistic UI) and `busy` becomes true
- When enabling and no backup exists, a new backup is created
- When enabling and a backup already exists, the existing backup is used without resetting
- When disabling, the key storage is disabled via the crypto API
- When enabling, the account data flag is set to indicate backup is not disabled
<!-- COMMENTED OUT - Implementation detail:
- Create new backup via `crypto.resetKeyBackup()`
- Disable key storage via `crypto.disableKeyStorage()`
-->

---

### FR3: Delete Key Storage Confirmation

**Problem**: Disabling key storage is a destructive action that deletes server-side encryption data. Users need to understand the consequences before proceeding.

**Requirements**:
- Display a confirmation panel when the user attempts to turn off key storage
- Show a breadcrumb navigation with "Encryption" and "Delete key storage" pages
- Display a destructive-styled card with an error icon
- The title should ask if the user really wants to turn off and delete key storage
- Show a description explaining that this will remove cryptographic identity and message keys from the server
- Display a visual list of consequences:
  - User will not have encrypted message history on new devices
  - User will lose access to encrypted messages if signed out everywhere
- Provide a destructive "Delete key storage" confirmation button
- Provide a "Cancel" button to go back
- While the deletion is in progress, disable the confirmation button
- After deletion completes successfully, call the onFinish callback
- When cancel is pressed, call the onFinish callback without making changes

**Acceptance**:
- The component must be named `DeleteKeyStoragePanel` and accept an `onFinish: () => void` prop
- The component must use the `useKeyStoragePanelViewModel` hook to access key storage state management
- When the user clicks cancel, the `onFinish` callback is called without disabling key storage
- When the user clicks the delete confirmation button, key storage is disabled via the ViewModel's `setEnabled(false)`
- While the `setEnabled` promise is pending, the delete button must be disabled to prevent duplicate actions
- After `setEnabled` completes, the `onFinish` callback is called

---

### FR4: Encryption Tab State Management

**Problem**: The Encryption settings tab does not account for key storage status when determining what panels to show, and does not update when key backup status changes on another device.

**Requirements**:
- Add new states to the encryption tab state machine:
  - "key_storage_disabled": When key storage is off, show reduced UI (no Recovery panel)
  - "key_storage_delete": When user is confirming key storage deletion
- Update the state determination logic:
  - If cross-signing is ready, key backup is enabled, and secrets are cached: show "main" state
  - If cross-signing is not ready: show "set_up_encryption" state
  - If key backup is not enabled: show "key_storage_disabled" state
  - If secrets are not cached: show "secrets_not_cached" state
- In "main" state, show: Key Storage panel, separator, Recovery panel, separator, Advanced panel
- In "key_storage_disabled" state, show: Key Storage panel, separator, Advanced panel (hide Recovery panel since it requires key backup)
- Listen for CryptoEvent.KeyBackupStatus events and re-check encryption state when fired
- When navigating to "key_storage_delete" state, show the DeleteKeyStoragePanel
- When DeleteKeyStoragePanel finishes (either by completing deletion or canceling), re-check encryption state to determine the correct panel to show

**Acceptance**:
- When key backup status changes (CryptoEvent.KeyBackupStatus fired), the tab rechecks and updates its displayed state
- When key storage is disabled, the Recovery panel is not shown
- When key storage is enabled, the Recovery panel is shown
- When the user enters the delete key storage flow and completes or cancels, the tab returns to the appropriate state

---

### FR5: Cross-Client Compatibility

**Problem**: Element X uses an account data flag to determine whether to automatically set up key backup. Without setting this flag appropriately, Element X may automatically re-enable key backup after the user disables it.

**Requirements**:
- When enabling key storage, set account data "m.org.matrix.custom.backup_disabled" with content { disabled: false }
- When disabling key storage, set account data "m.org.matrix.custom.backup_disabled" with content { disabled: true }
- Export the account data key constant `BACKUP_DISABLED_ACCOUNT_DATA_KEY` from the DeviceListener module for use across modules

**Acceptance**:
- The constant `BACKUP_DISABLED_ACCOUNT_DATA_KEY` must be exported from `src/DeviceListener.ts` with value `"m.org.matrix.custom.backup_disabled"`
- When enabling key storage, account data is set with `{ disabled: false }`
- When disabling key storage, account data is set with `{ disabled: true }`
<!-- COMMENTED OUT - Implementation detail:
- Call `matrixClient.setAccountData(BACKUP_DISABLED_ACCOUNT_DATA_KEY, { disabled: false/true })`
-->

---

## Non-Functional Requirements

### Analytics Integration

- The Encryption settings tab should have an analytics screen name identifier for tracking user interactions


---

# Environment Dependency Changes (relative to Base Env)

## Node.js Packages
- @babel/runtime upgraded to 7.26.10
- @element-hq/element-web-playwright-common 1.1.5 added
- @fontsource/inconsolata upgraded to 5.2.5
- @fontsource/inter upgraded to 5.2.5
- @keyv/serialize upgraded to 1.0.3
- @matrix-org/analytics-events upgraded to 0.29.2
- @playwright/test upgraded to 1.51.0
- @sentry/babel-plugin-component-annotate upgraded to 3.2.1
- @sentry/browser upgraded to 9.3.0
- @sentry/bundler-plugin-core upgraded to 3.2.1
- @sentry/cli upgraded to 2.42.2
- @sentry/cli-darwin upgraded to 2.42.2
- @sentry/cli-linux-arm upgraded to 2.42.2
- @sentry/cli-linux-arm64 upgraded to 2.42.2
- @sentry/cli-linux-i686 upgraded to 2.42.2
- @sentry/cli-linux-x64 upgraded to 2.42.2
- @sentry/cli-win32-i686 upgraded to 2.42.2
- @sentry/cli-win32-x64 upgraded to 2.42.2
- @sentry/core upgraded to 9.3.0
- @sentry/webpack-plugin upgraded to 3.2.1
- @sentry-internal/browser-utils upgraded to 9.3.0
- @sentry-internal/feedback upgraded to 9.3.0
- @sentry-internal/replay upgraded to 9.3.0
- @sentry-internal/replay-canvas upgraded to 9.3.0
- @testcontainers/postgresql upgraded to 10.19.0
- @types/dockerode upgraded to 3.3.35
- @types/lodash upgraded to 4.17.16
- @types/node upgraded to 18.19.79
- @types/prop-types upgraded to 15.7.14
- @types/react-virtualized upgraded to 9.22.2
- @typescript-eslint/eslint-plugin upgraded to 8.26.0
- @typescript-eslint/parser upgraded to 8.26.0
- @typescript-eslint/scope-manager upgraded to 8.26.0
- @typescript-eslint/type-utils upgraded to 8.26.0
- @typescript-eslint/types upgraded to 8.26.0
- @typescript-eslint/typescript-estree upgraded to 8.26.0
- @typescript-eslint/utils upgraded to 8.26.0
- @typescript-eslint/visitor-keys upgraded to 8.26.0
- @vector-im/compound-web upgraded to 7.7.2
- @vector-im/matrix-wysiwyg upgraded to 2.38.2
- axios upgraded to 1.8.1
- babel-loader upgraded to 10.0.0
- bare-os upgraded to 3.6.0
- cacheable upgraded to 1.8.9
- caniuse-lite upgraded to 1.0.30001701
- common-path-prefix removed
- copy-webpack-plugin upgraded to 13.0.0
- cronstrue upgraded to 2.56.0
- electron-to-chromium upgraded to 1.5.112
- eslint-config-prettier upgraded to 10.0.2
- eslint-visitor-keys upgraded to 4.2.0
- fastq upgraded to 1.19.1
- file-entry-cache upgraded to 10.0.7
- find-cache-dir removed
- foreground-child upgraded to 3.3.1
- form-data upgraded to 4.0.2
- hookified upgraded to 1.7.1
- knip upgraded to 5.45.0
- lodash-es 4.17.21 added
- mailpit-api upgraded to 1.2.0
- maplibre-gl upgraded to 5.2.0
- nan upgraded to 2.22.2
- playwright upgraded to 1.51.0
- playwright-core upgraded to 1.51.0
- prettier upgraded to 3.5.2
- re-resizable upgraded to 6.11.2
- reusify upgraded to 1.1.0
- @sindresorhus/merge-streams removed
- strip-ansi downgraded to 6.0.1
- stylelint upgraded to 16.15.0
- stylelint-scss upgraded to 6.11.1
- terser-webpack-plugin upgraded to 5.3.12
- testcontainers upgraded to 10.20.0
- tinyglobby upgraded to 0.2.12
- typescript upgraded to 5.8.2
- unicorn-magic removed
- update-browserslist-db upgraded to 1.1.3
- uuid upgraded to 11.1.0
