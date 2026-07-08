# Software Requirements Specification: UI/UX and Accessibility Improvements

## Overview

This document specifies requirements for a maintenance milestone focused on UI/UX improvements and accessibility enhancements across Element Web. The changes address visual consistency, accessibility compliance, and keyboard navigation.

### Summary of Requirements

1. **FR1**: Add spacing below the leave room button in the room summary card
2. **FR2**: Improve accessibility for integration manager toggle switch
3. **FR3**: Fix button styling in device verification dialog
4. **FR4**: Update keyboard shortcuts for consistency
5. **FR5**: Add flex wrap support to the Flex layout component
6. **FR6**: Add title attribute for user identifier accessibility
7. **FR7**: Update icon style for encryption warning badge

### Affected Modules

- Room Summary Card (right panel)
- Integration Manager Settings
- Device Verification Dialog
- Keyboard Shortcuts Configuration
- Flex Layout Utility Component
- User Menu Component

---

## Functional Requirements

### FR1: Leave Room Button Spacing

**Problem**: The leave room button in the room summary card panel is positioned too close to adjacent content, causing visual crowding.

**Requirements**:
- Add appropriate bottom margin spacing to the leave room menu item in the room summary card
- The spacing should follow the design system spacing tokens
- The change should not affect other menu items in the room summary card

**Acceptance**:
- When viewing the room summary card, the leave room button has visible spacing below it
- The leave room `MenuItem` component must have `className="mx_RoomSummaryCard_leave"` applied
- Snapshot tests for room-related components reflect the updated layout

---

### FR2: Integration Manager Toggle Accessibility

**Problem**: The toggle switch for enabling/disabling the integration manager is not properly associated with its label, causing accessibility issues for screen reader users.

**Requirements**:
- Restructure the integration manager settings section to use proper form controls
- The toggle switch must be programmatically associated with its descriptive label
- The toggle must have a role of "switch" for proper ARIA semantics
- The label text should describe the toggle action (enabling the integration manager)

**Acceptance**:
- When using a screen reader, the toggle switch is announced with its associated label
- The toggle input element must have `role="switch"` attribute
- The toggle input element must have `id="mx_SetIntegrationManager_Toggle"`
- The label element must have `htmlFor="mx_SetIntegrationManager_Toggle"` to associate with the toggle
- The root container must change from `<label>` to `<div>` element (no longer wrapping the entire section)
- Clicking the label activates the toggle
- The settings section renders with proper form structure
<!-- COMMENTED OUT - Implementation detail:
- Use Compound Web form components (`Root`, `InlineField`, `Label`, `ToggleInput`) from `@vector-im/compound-web`
-->

---

### FR3: Verification Dialog Button Styling

**Problem**: The "They do not match" button in the device verification SAS (Short Authentication String) dialog uses an inappropriate button style that does not clearly communicate its secondary nature.

**Requirements**:
- The "They match" button should remain as the primary action with prominent styling
- The "They do not match" button should use secondary/neutral styling instead of danger styling
- The button order should place the primary action ("They match") first

**Acceptance**:
- When viewing the SAS verification dialog, the "They match" button appears first and uses primary styling
- The "They match" button must use `kind="primary"` prop on the AccessibleButton component
- The "They do not match" button must use `kind="secondary"` prop (changed from `kind="danger"`)
- The button order in the DOM must be: "They match" first, then "They do not match"
- The buttons maintain proper visual hierarchy

---

### FR4: Keyboard Shortcuts Consistency

**Problem**: Keyboard shortcuts for "Go to Home" and "Toggle Hidden Event Visibility" actions are inconsistent across platforms and conflict with other system or application shortcuts.

**Requirements**:
- The "Go to Home" keyboard shortcut should use a consistent modifier key combination across all platforms
- The "Toggle Hidden Event Visibility" shortcut should use a consistent control key modifier

**Acceptance**:
- When pressing the configured keyboard shortcut for "Go to Home", the home view is displayed
- When pressing the configured keyboard shortcut for "Toggle Hidden Event Visibility", hidden events toggle their visibility
- The keyboard shortcuts work consistently across supported platforms
- For "Go to Home" (`KeyBindingAction.GoToHome`): Use Ctrl+Alt+H (remove platform-specific Shift modifier for Mac)
- For "Toggle Hidden Event Visibility" (`KeyBindingAction.ToggleHiddenEventVisibility`): Use Ctrl+Shift+H (change from Cmd/Ctrl to always use Ctrl)
<!-- COMMENTED OUT - Implementation detail:
- Go to Home config: `ctrlKey: true, altKey: true, key: Key.H`
- Toggle Hidden Event Visibility config: `ctrlKey: true, shiftKey: true, key: Key.H`
-->

---

### FR5: Flex Component Wrap Support

**Problem**: The Flex layout utility component does not support the CSS flex-wrap property, limiting its ability to handle wrapping layouts.

**Requirements**:
- Add a `wrap` prop to the Flex component
- The prop should accept standard CSS flex-wrap values: "wrap", "nowrap", "wrap-reverse"
- The default value should be "nowrap" to maintain backward compatibility
- The wrap value should be applied via CSS custom property

**Acceptance**:
- When using the Flex component with `wrap="wrap"`, child elements wrap to new lines
- When using the Flex component with `wrap="wrap-reverse"`, child elements wrap in reverse order
- When no wrap prop is specified, the default "nowrap" behavior is maintained
- The `wrap` prop must be included in the `useMemo` dependency array for style computation
- The CSS custom property `--mx-flex-wrap` must be set in the inline style object
- The PCSS file must include `flex-wrap: var(--mx-flex-wrap, unset);` rule

---

### FR6: User Identifier Title Attribute

**Problem**: The user identifier displayed in the user menu lacks a title attribute, preventing users from seeing the full identifier when it is truncated.

**Requirements**:
- Add a title attribute to the user identifier element in the user menu context menu
- The title should contain the complete user identifier string
- The title should include the display name when available

**Acceptance**:
- When hovering over the user identifier in the user menu, a tooltip shows the full identifier
- The `title` attribute must be added to the `<span className="mx_UserMenu_contextMenu_userId">` element
- The title value must display the full user identifier with display name
- The user identifier string should be computed once and reused for both the title and content
<!-- COMMENTED OUT - Implementation detail:
- Call `UserIdentifierCustomisations.getDisplayUserIdentifier()` with `withDisplayName: true`
-->

---

### FR7: Encryption Warning Badge Icon

**Problem**: The encryption warning badge uses an inconsistent icon style compared to other status badges.

**Requirements**:
- Use the appropriate error icon variant for the encryption warning badge
- Maintain visual consistency with other error/warning indicators in the application
- The solid error icon should be used for the "not trusted" encryption warning badge

**Acceptance**:
- When viewing a room with encryption warnings, the badge displays the correct error icon style
- The icon rendering is consistent with the design system
- Use the solid error icon variant for the "not trusted" encryption warning badge
<!-- COMMENTED OUT - Implementation detail:
- Import `ErrorSolidIcon` from `@vector-im/compound-design-tokens/assets/web/icons/error-solid`
- Import `ErrorIcon` from `@vector-im/compound-design-tokens/assets/web/icons/error` (non-solid variant)
- Use `ErrorSolidIcon` in the E2EStatus.Warning badge rendering
-->

---

## Test Requirements

The following test scenarios must pass after implementation:

### Room Summary and Layout Tests
- Room view snapshots for local rooms in various states (NEW, CREATING, ERROR)
- Room header rendering in DM and non-DM contexts
- Pinned messages card empty state
- File panel empty state
- Room list panel header and search components

### Settings Tests
- Integration manager settings section renders correctly
- Integration manager toggle has proper switch role and accessibility

### User Interface Tests
- User info header renders verification states correctly
- Third-party member info renders invites correctly
- Member tile view renders correctly
- Extensions card empty state
- Auth entry components render correctly
- Unsupported browser view renders correctly

### Accessibility Tests
- All interactive elements have proper ARIA attributes
- Toggle switches have role="switch"
- Focusable elements are keyboard accessible


---

# Environment Dependency Changes (relative to Base Env)

## Node.js Packages (Global)
- serve@14.2.5 added

## Playwright Browsers
- chromium-1161 added
- chromium_headless_shell-1161 added
- ffmpeg-1011 added

## System Packages
- xvfb added (virtual framebuffer for headless browser testing)
- libnss3 added (network security services for Chromium)
- libnspr4 added (Netscape portable runtime)
- libatk1.0-0 added (accessibility toolkit)
- libatk-bridge2.0-0 added (AT-SPI accessibility bridge)
- libatspi2.0-0 added (assistive technology service provider)
- libcups2 added (printing support)
- libdrm2 added (direct rendering manager)
- libgbm1 added (graphics buffer manager)
- libgl1-mesa-dri added (OpenGL DRI driver)
- libxcomposite1 added (X11 composite extension)
- libxdamage1 added (X11 damage extension)
- libxfixes3 added (X11 fixes extension)
- libxrandr2 added (X11 RandR extension)
- libxkbcommon0 added (XKB keyboard handling)
- libasound2 added (ALSA sound support)
- fonts-liberation added (Liberation fonts)
- fonts-noto-color-emoji added (Noto color emoji fonts)
- fonts-freefont-ttf added (FreeFont TTF)
- fonts-ipafont-gothic added (IPA Gothic fonts)
- fonts-wqy-zenhei added (Chinese fonts)
