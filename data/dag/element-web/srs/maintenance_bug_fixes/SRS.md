# Software Requirements Specification: Bug Fixes and Stability Improvements

## Overview

This specification defines requirements for a maintenance milestone addressing various stability and usability issues across the Element web application. The fixes target multiple subsystems including session management, notification handling, UI components, and message rendering.

### Requirements Summary

1. **FR1**: Fix application startup hang when system clock has been wound back
2. **FR2**: Hide desktop notifications for redacted (deleted) events
3. **FR3**: Fix spoiler click handling to prevent premature content reveal
4. **FR4**: Fix file attachment filename resolution
5. **FR5**: Remove problematic auto-popup tooltip from avatar uploader
6. **FR6**: Improve member list scrolling performance

### Affected Modules

- Session lock management utilities
- Desktop notification platform layer
- Message body rendering components (spoilers, file attachments)
- Avatar uploader component
- Member list virtualized display

---

## Functional Requirements

### FR1: Fix Application Startup Hang When Clock Was Wound Back

**Problem**: The application hangs indefinitely on startup when the system clock has been adjusted backward since a previous session that terminated abnormally.

**User Report**:
```
I put my laptop to sleep with Element running, then traveled across time zones
and adjusted my system clock backward. When I woke the laptop, Element was
unresponsive. Opening a new tab also hung. Had to clear browser storage to
recover.
```

**Requirements**:
- The session lock mechanism must handle cases where the recorded ping timestamp is in the future relative to the current system time
- When a previous session's ping appears to be in the future, the lock acquisition must not wait for an unreasonably long duration
- The lock expiry timeout should be recalculated to treat future timestamps as if they occurred just now
- When waiting for a stale lock to expire and no storage events occur during the wait period, the lock acquisition should proceed without redundantly re-checking the lock state
- The lock expiry timeout should be set to a reasonable duration that balances between quick recovery and avoiding false lock acquisition

**Acceptance**:
- When a previous session terminated uncleanly and the system clock has been wound back, a new session starts up within a reasonable timeout period
- When a previous session terminated uncleanly (without clock adjustment), a new session eventually acquires the lock after the expiry timeout
- When calculating time since last ping and the timestamp appears to be in the future, the system should handle this gracefully without waiting for an unreasonable duration
- When the sleep timer expires without any storage events, the lock acquisition must proceed with startup
<!-- COMMENTED OUT - Implementation detail:
- `SESSION_LOCK_CONSTANTS.LOCK_EXPIRY_TIME_MS` value: `15000` (15 seconds)
- Negative time values (future timestamps due to clock adjustment) clipped to 0 using `Math.max(timeAgo, 0)`
- Break out of the wait loop when sleep timer expires
-->
- Existing behavior for clean session shutdown and multi-instance coordination remains unchanged

---

### FR2: Hide Desktop Notifications for Redacted Events

**Problem**: Desktop notifications remain visible even after the corresponding message event has been redacted (deleted) by the sender.

**User Report**:
```
Someone sent me an inappropriate message and then deleted it, but the notification
stayed on my screen showing the content. I had to manually dismiss it.
```

**Requirements**:
- When a message event is redacted, any associated desktop notification must be automatically closed
- The notification cleanup must occur immediately upon redaction, before the event disappears from the timeline
- Event listener cleanup must occur when notifications are closed to prevent memory leaks

**Acceptance**:
- When a message triggers a desktop notification and is subsequently redacted, the notification is automatically dismissed
- When a notification is closed by the user before redaction, no errors occur when the event is later redacted

---

### FR3: Fix Spoiler Click Handling

**Problem**: Clicking on interactive content (such as user pills or links) hidden within a spoiler reveals the spoiler on the first click, but the click event also propagates to the hidden content, potentially triggering unintended navigation.

**User Report**:
```
I clicked on a spoilered message to reveal it, but it contained a user mention.
The click both uncovered the spoiler AND opened the user profile panel. I expected
it to only reveal the spoiler on the first click.
```

**Requirements**:
- When a spoiler is in its hidden (blurred) state, click events must not reach the content inside the spoiler
- When a spoiler has been revealed (visible state), click events must pass through normally to interactive elements
- The spoiler reveal/hide toggle behavior must remain functional

**Acceptance**:
- When clicking a hidden spoiler containing a user pill, the first click reveals the spoiler without opening the user profile
- When clicking the revealed user pill, the user profile panel opens as expected

---

### FR4: Fix File Attachment Filename Resolution

**Problem**: File attachment messages display incorrect filenames when the event content includes a `filename` field that differs from the `body` field.

**Requirements**:
- File attachment display must prefer the explicit `filename` property from the media event content when available
- The `body` field should only be used as a fallback when `filename` is not present
- A generic fallback label must be used when neither field provides a valid filename

**Acceptance**:
- When a file attachment event has both `filename` and `body` fields with different values, the `filename` value is displayed
- When only `body` is present, it is used as the filename
- When neither field is present or valid, a localized "Attachment" label is displayed

---

### FR5: Remove Problematic Auto-Popup Tooltip from Avatar Uploader

**Problem**: The avatar uploader component on the room introduction and homepage displays a tooltip that automatically appears after 3 seconds and disappears after 10 seconds. This timed popup behavior is disruptive and creates accessibility issues.

**Requirements**:
- Remove the auto-popup tooltip behavior from the avatar uploader component
- The upload action button must remain accessible with appropriate labeling for screen readers
- The core upload functionality must remain unchanged

**Acceptance**:
- When the room introduction or homepage loads, no tooltip automatically appears after a delay
- The avatar upload button remains functional and accessible with an ARIA label

---

### FR6: Improve Member List Scrolling Performance

**Problem**: The virtualized member list in room panels exhibits visual artifacts (blank areas, flickering) when scrolling quickly through large member lists.

**Requirements**:
- Increase the number of pre-rendered rows in the virtualized member list to provide better buffer during scrolling
- The overscan count should be sufficient to prevent blank areas during normal scrolling speeds

**Acceptance**:
- When scrolling through a large member list, fewer blank areas are visible during scroll operations
- Scrolling performance remains acceptable without excessive memory usage


---

# Environment Dependency Changes (relative to Base Env)

## Node.js Packages

- @babel/core upgraded to 7.26.10
- @babel/eslint-parser upgraded to 7.26.10
- @babel/eslint-plugin upgraded to 7.26.10
- @babel/plugin-transform-runtime upgraded to 7.26.10
- @babel/runtime upgraded to 7.26.10
- @element-hq/element-call-embedded@0.9.0 added
- @element-hq/element-web-playwright-common@1.1.5 added
- @fontsource/inconsolata upgraded to 5.2.5
- @fontsource/inter upgraded to 5.2.5
- @matrix-org/analytics-events upgraded to 0.29.2
- @playwright/test upgraded to 1.51.1
- @sentry/browser upgraded to 9.6.0
- @sentry/webpack-plugin upgraded to 3.2.2
- @types/lodash upgraded to 4.17.16
- @types/node upgraded to 18.19.80
- @types/react-virtualized upgraded to 9.22.2
- @typescript-eslint/eslint-plugin upgraded to 8.26.1
- @typescript-eslint/parser upgraded to 8.26.1
- @vector-im/compound-design-tokens upgraded to 4.0.1
- @vector-im/compound-web upgraded to 7.9.0
- @vector-im/matrix-wysiwyg upgraded to 2.38.2
- babel-loader upgraded to 10.0.0
- copy-webpack-plugin upgraded to 13.0.0
- core-js upgraded to 3.41.0
- cronstrue upgraded to 2.56.0
- css-minimizer-webpack-plugin upgraded to 7.0.2
- domutils@3.2.2 added
- eslint-config-prettier upgraded to 10.1.1
- eslint-plugin-react-compiler upgraded to 19.0.0-beta-e552027-20250112
- eslint-plugin-react-hooks upgraded to 5.2.0
- html-react-parser@5.2.2 added
- knip upgraded to 5.46.0
- lint-staged upgraded to 15.5.0
- maplibre-gl upgraded to 5.2.0
- matrix-js-sdk upgraded to 37.2.0
- oidc-client-ts upgraded to 3.2.0
- patch-package@8.0.0 added
- playwright-core upgraded to 1.51.1
- prettier upgraded to 3.5.3
- re-resizable upgraded to 6.11.2
- react-string-replace@1.1.1 added
- stylelint-scss upgraded to 6.11.1
- stylelint upgraded to 16.16.0
- terser-webpack-plugin upgraded to 5.3.14
- testcontainers upgraded to 10.21.0
- typescript upgraded to 5.8.2
- uuid upgraded to 11.1.0
- @axe-core/playwright removed
- @testcontainers/postgresql removed
- mailpit-api removed
- strip-ansi removed
