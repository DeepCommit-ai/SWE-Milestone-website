# Software Requirements Specification: Compound Design System Checkbox Migration

## Overview

This specification describes the migration of checkbox components across the Element web application from custom implementations to the Compound Design System's `CheckboxInput` component. The migration affects multiple UI components including dialogs, settings panels, space hierarchy views, and device management interfaces.

**Requirements Summary:**

1. **FR1**: Replace StyledCheckbox class-based component with Compound Design System CheckboxInput
2. **FR2**: Add proper accessibility labels to all checkbox components
3. **FR3**: Update LabelledCheckbox to use the new checkbox implementation with description support
4. **FR4**: Migrate sidebar settings checkboxes to use Compound checkbox with inline descriptions
5. **FR5**: Update device selection checkboxes in session management interfaces
6. **FR6**: Migrate space hierarchy room selection checkboxes with proper labeling
7. **FR7**: Update dialog checkboxes across AddExistingToSpace, ManageRestrictedJoinRule, BulkRedact, Export, SpacePreferences, and WidgetCapabilitiesPrompt dialogs
8. **FR8**: Update QuickSettingsButton checkboxes for favorites and people metaspace toggles
9. **FR9**: Remove legacy StyledCheckbox CSS and related checkbox styling

**Affected Modules:**

- Core checkbox element components
- Settings tab components (sidebar, notifications, session manager)
- Dialog components (AddExistingToSpace, ManageRestrictedJoinRule, BulkRedact, Export, SpacePreferences, WidgetCapabilitiesPrompt, GenericFeatureFeedback)
- Space hierarchy components
- Device management components
- Quick settings components
- Associated CSS/PCSS style files

---

## Requirements

### FR1: Replace StyledCheckbox with Compound Design System CheckboxInput

**Problem**: The current StyledCheckbox component is a custom class-based implementation with manually styled checkboxes that do not conform to the Compound Design System standards.

**Requirements**:
- Convert StyledCheckbox from a class-based component to a functional component
- Replace the custom checkbox implementation with the Compound Design System checkbox components
- Support a `description` prop that renders as help text below the checkbox label
- Maintain the existing API for `checked`, `onChange`, `disabled`, `id`, `className`, and `inputRef` props
- Remove the `CheckboxStyle` enum entirely (including `CheckboxStyle.Solid` and `CheckboxStyle.Outline` variants) and the `kind` prop as they are no longer needed with Compound
- Ensure the checkbox generates a unique ID when none is provided
- Support `aria-describedby` linking to the description element when description is provided
<!-- COMMENTED OUT - Implementation detail:
- Use Compound components: `CheckboxInput`, `InlineField`, `Label`, `HelpMessage`, and `Form.Root`
-->

**Acceptance**:
- When a StyledCheckbox is rendered with children, the children appear as the label text
- When a StyledCheckbox is rendered with a description prop, the description text appears below the label
- When clicking the checkbox, the onChange handler fires with the new checked state
- When the checkbox is disabled, user interaction is prevented
- Snapshot tests for components using StyledCheckbox pass with updated markup
- `StyledCheckbox` must be a functional component accepting the following props:
  - `description?: ReactNode` - optional help text rendered below the label
  - `id?: string` - optional checkbox ID; if not provided, auto-generate a unique ID
  - `inputRef?: Ref<HTMLInputElement>` - ref forwarded to the underlying checkbox input
  - `className?: string` - applied to the wrapper component
  - Standard `React.InputHTMLAttributes<HTMLInputElement>` props (e.g., `checked`, `onChange`, `disabled`, `tabIndex`, `role`, `aria-label`, `aria-labelledby`, `data-testid`)
- When `description` is provided, the checkbox input must have `aria-describedby` referencing the description element's ID
<!-- COMMENTED OUT - Implementation detail:
- Auto-generated ID format: `"checkbox_" + secureRandomString(10)`
- Description rendered via Compound's `HelpMessage` component
- inputRef passed through to `CheckboxInput` component
- className applied to `InlineField` wrapper component
- Render using Compound components: `Form.Root`, `InlineField`, `CheckboxInput`, `Label`, `HelpMessage`
-->

---

### FR2: Add Proper Accessibility Labels to Checkbox Components

**Problem**: Several checkbox components lack proper accessibility labels, making them inaccessible to screen readers and assistive technologies.

**Requirements**:
- All checkboxes must have either visible label text or an `aria-label` / `aria-labelledby` attribute
- Remove the separate `label` prop from `StyledMenuItemCheckbox` since labels should be provided through the checkbox's native labeling mechanism
- Checkboxes used for row selection should reference the row's name element via `aria-labelledby`

**Acceptance**:
- When a checkbox is rendered, assistive technologies can identify its purpose
- When navigating with a screen reader, checkbox labels are announced correctly

---

### FR3: Update LabelledCheckbox Component

**Problem**: LabelledCheckbox uses a manual layout with separate label and byline span elements instead of leveraging the Compound checkbox's built-in description support.

**Requirements**:
- Refactor LabelledCheckbox to pass the `byline` prop as the `description` prop to StyledCheckbox
- Place the label text as children of StyledCheckbox rather than in a separate labels container
- Simplify the CSS to use minimal styling since Compound handles the layout
- Maintain the existing props API: `value`, `label`, `byline`, `disabled`, `onChange`, `className`

**Acceptance**:
- When rendering LabelledCheckbox with a byline, the byline appears as descriptive text below the label
- When rendering LabelledCheckbox without a byline, no extra description element is present
- Checkbox state changes work correctly when clicking the checkbox
- The component supports custom className styling
- `LabelledCheckbox` must pass the `byline` prop to `StyledCheckbox` as the `description` prop
- The label text must be placed as children of `StyledCheckbox` wrapped in `<span className="mx_LabelledCheckbox_label">`
- The wrapper element must be a `<div>` with class `mx_LabelledCheckbox` (not a `<label>` element)

---

### FR4: Migrate Sidebar Settings Checkboxes

**Problem**: The SidebarUserSettingsTab uses checkboxes with complex nested content including icons and multi-line descriptions wrapped in SettingsSubsectionText elements.

**Requirements**:
- Update checkboxes in SidebarUserSettingsTab to use the `description` prop for descriptive text
- Move icons (Home, Favourites, People, Video, etc.) to be direct children with appropriate styling classes
- Ensure checkbox labels display the option name with the icon aligned inline
- Support disabled state for checkboxes based on dependent settings (e.g., "all rooms in home" checkbox disabled when home space is disabled)

**Acceptance**:
- When viewing the Sidebar settings tab, all metaspace checkboxes render with icons and descriptions
- When toggling a checkbox, the appropriate setting value changes
- When a dependent setting is disabled, the checkbox shows as disabled
- Snapshot tests for SidebarUserSettingsTab pass with updated markup
- Metaspace checkboxes must use the `description` prop for descriptive text instead of wrapping in `SettingsSubsectionText` elements
- Icons (HomeSolidIcon, FavouriteSolidIcon, UserProfileSolidIcon, VideoCallSolidIcon) must be direct children of StyledCheckbox with `className="mx_SidebarUserSettingsTab_icon"`
- The label text must be placed as direct children alongside the icon (e.g., `<HomeSolidIcon className="mx_SidebarUserSettingsTab_icon" /> Home`)
- The "Show all rooms in home" checkbox must have `data-testid="mx_SidebarUserSettingsTab_homeAllRoomsCheckbox"`

---

### FR5: Update Device Selection Checkboxes

**Problem**: Device selection components (SelectableDeviceTile, FilteredDeviceListHeader) use the custom StyledCheckbox with CheckboxStyle enum values.

**Requirements**:
- Remove usage of `CheckboxStyle.Solid` from SelectableDeviceTile and FilteredDeviceListHeader
- Update styling to work with Compound checkbox layout
- Ensure device tile checkboxes have proper vertical alignment

**Acceptance**:
- When viewing the session manager, device tiles display with selectable checkboxes
- When selecting a device, the checkbox state updates correctly
- When clicking "select all", all devices become selected
- When filtering devices and going to filtered list from security recommendations, the header displays correctly
- Snapshot tests for device selection components pass
- `SelectableDeviceTile` checkbox must use `id` and `data-testid` attributes with the pattern `device-tile-checkbox-${device.device_id}`
- `FilteredDeviceListHeader` checkbox must use `id="device-select-all-checkbox"` and `data-testid="device-select-all-checkbox"`
- `FilteredDeviceListHeader` checkbox must have an `aria-label` attribute indicating "Select all" or "Deselect all" based on selection state
- Remove usage of `CheckboxStyle.Solid` from both components - use StyledCheckbox without `kind` prop

---

### FR6: Migrate Space Hierarchy Checkboxes

**Problem**: Space hierarchy room tiles use checkboxes for multi-select operations but lack proper accessibility labeling for the checkbox-row relationship.

**Requirements**:
- Add a unique ID to the room name element for accessibility labeling
- Set `aria-labelledby` on the checkbox referencing the room name element
- Set `role="presentation"` on the checkbox to indicate it's controlled by the parent row
- Set `tabIndex={-1}` on the checkbox since the row itself is the interactive element
- Add `aria-labelledby` to the parent `li` element to establish proper ARIA tree item labeling
- Ensure the checkbox click handler is properly connected through the row's onClick when user has permissions
<!-- COMMENTED OUT - Implementation detail:
- Generate unique ID using React's `useId()` hook
-->

**Acceptance**:
- When rendering a space hierarchy with selectable rooms, checkboxes display correctly
- When a room is selected, visual feedback shows the selection state
- When navigating with a screen reader, the room tile and its selection state are properly announced
- Snapshot tests for SpaceHierarchy pass with updated markup
- The room name element must be wrapped in a span with a unique ID for labeling
- Checkboxes must have `role="presentation"` and `aria-labelledby` referencing the room name span
- Checkboxes must have `tabIndex={-1}` since the parent row is the interactive element
- The parent `<li>` element must have `aria-labelledby` for proper ARIA tree item labeling
- When user has permissions, the checkbox selection is managed through the row's click handler
<!-- COMMENTED OUT - Implementation detail:
- Generate checkboxLabelId using React's `useId()` hook
- The row's `onClick` handler manages selection via the `onToggleClick` callback
-->

---

### FR7: Update Dialog Checkboxes

**Problem**: Multiple dialogs use checkboxes with various custom implementations and styling that need migration to Compound.

**Requirements**:

**AddExistingToSpaceDialog**:
- Update Entry component to render as a list item (`li`) with proper `aria-label`
- Add `aria-labelledby` to the checkbox referencing the entry's ID
- Update the LazyRenderList to use `ul` as the element type for the list

**ManageRestrictedJoinRuleDialog**:
- Refactor Entry component to place space avatar and name as children of StyledCheckbox
- Use the `description` prop for entry descriptions (e.g., member count text like "0 members")
- Update layout from label-wrapper structure to checkbox-first structure
- The Entry wrapper element must be a `<div className="mx_ManageRestrictedJoinRuleDialog_entry">` (not a `<label>`)
- Space avatar component must have `role="none"` when it's a local room

**BulkRedactDialog**:
- Move the explainer text from a separate div into the checkbox's `description` prop
- Remove the custom `.mx_BulkRedactDialog_checkboxMicrocopy` element

**ExportDialog**:
- Remove custom checkbox background color override CSS rules
- Let Compound handle checkbox styling
- The attachments checkbox must use `id="include-attachments"` and `className="mx_ExportDialog_attachments-checkbox"`
- Checkbox children text must be "Include Attachments" as the label

**SpacePreferencesDialog**:
- Use the `description` prop for the "show people in space" explanation text
- Remove the separate SettingsSubsectionText element for the description

**WidgetCapabilitiesPromptDialog**:
- Pass capability byline text as the `description` prop to the checkbox
- Remove the custom byline span rendering

**GenericFeatureFeedbackDialog**:
- Minor formatting cleanup for checkbox usage

**Acceptance**:
- When opening each dialog containing checkboxes, the checkboxes render with proper styling
- When interacting with dialog checkboxes, state changes work correctly
- Snapshot tests for ExportDialog pass with updated markup

---

### FR8: Update QuickSettingsButton Checkboxes

**Problem**: QuickSettingsButton has custom-styled checkboxes for favorites and people metaspace toggles with manual icon positioning.

**Requirements**:
- Replace custom `PinUprightIcon` with `PinSolidIcon` from Compound design tokens
- Update checkbox className from `mx_QuickSettingsButton_favouritesCheckbox`/`mx_QuickSettingsButton_peopleCheckbox` to `mx_QuickSettingsButton_option`
- Update CSS to use Compound spacing variables and flexbox-based icon alignment
- Simplify heading structure by removing the `mx_QuickSettingsButton_pinToSidebarHeading` class
<!-- COMMENTED OUT - Implementation detail:
- Import `PinSolidIcon` from `@vector-im/compound-design-tokens/assets/web/icons`
-->

**Acceptance**:
- When opening quick settings, the pin to sidebar section displays with proper icons and checkboxes
- When toggling favorites or people checkboxes, the settings update correctly

---

### FR9: Remove Legacy Checkbox CSS

**Problem**: Legacy CSS files and rules for the custom checkbox implementation need removal.

**Requirements**:
- Delete the `_StyledCheckbox.pcss` file entirely
- Delete the `_BulkRedactDialog.pcss` file as it only contained checkbox-related styles
- Remove imports of `_StyledCheckbox.pcss` and `_BulkRedactDialog.pcss` from `_components.pcss`
- Update other PCSS files to remove `.mx_Checkbox` class selectors and related rules:
  - `_SelectableDeviceTile.pcss`: Update child selector syntax
  - `_QuickSettingsButton.pcss`: Remove checkbox-specific rules, update heading and option styles
  - `_SpaceHierarchy.pcss`: Remove `.mx_Checkbox` display rules
  - `_AddExistingToSpaceDialog.pcss`: Add list styling for `ul`, add form alignment, remove `.mx_Checkbox` alignment
  - `_ExportDialog.pcss`: Remove checkbox background color overrides
  - `_ManageRestrictedJoinRuleDialog.pcss`: Remove `.mx_Checkbox` alignment rule
  - `_WidgetCapabilitiesPromptDialog.pcss`: Remove `.mx_WidgetCapabilitiesPromptDialog_byline` styles
  - `_LabelledCheckbox.pcss`: Simplify to minimal margin styling
  - `_SidebarUserSettingsTab.pcss`: Update checkbox and icon styling classes
  - `_RoomSublist.pcss`: Remove `.mx_Checkbox` from margin rule selector

**Acceptance**:
- When building the application, no compilation errors occur from missing CSS imports
- When rendering components, no visual regressions occur from missing styles
- All existing functionality remains intact

---

## Acceptance Criteria Summary

The implementation must satisfy all fail-to-pass tests including:

- LabelledCheckbox snapshot tests with various byline configurations
- SelectableDeviceTile rendering tests for selected and unselected states
- FilteredDeviceListHeader rendering tests for all-selected and none-selected states
- ExportDialog rendering test
- ManageRestrictedJoinRuleDialog rendering test showing spaces list
- SpaceHierarchy rendering test
- SidebarUserSettingsTab snapshot tests with and without guest spa url
- SessionManagerTab test for navigating to filtered list from security recommendations
- Notifications settings tests for loading/disabled state, snapshot matching, and form element toggling (mentions/keywords)


---

# Environment Dependency Changes (relative to Base Env)

## Node Packages
- axios@1.7.9 added (extraneous)

## System Packages
- at-spi2-common added
- fonts-freefont-ttf added
- fonts-ipafont-gothic added
- fonts-liberation added
- fonts-noto-color-emoji added
- fonts-tlwg-loma-otf added
- fonts-unifont added
- fonts-wqy-zenhei added
- libasound2 added
- libasound2-data added
- libatk1.0-0 added
- libatk-bridge2.0-0 added
- libatspi2.0-0 added
- libavahi-client3 added
- libavahi-common3 added
- libavahi-common-data added
- libcups2 added
- libdbus-1-3 added
- libdrm2 added
- libdrm-amdgpu1 added
- libdrm-common added
- libdrm-intel1 added
- libdrm-nouveau2 added
- libdrm-radeon1 added
- libfontenc1 added
- libgbm1 added
- libgl1 added
- libgl1-mesa-dri added
- libglapi-mesa added
- libglvnd0 added
- libglx0 added
- libglx-mesa0 added
- libllvm15 added
- libnspr4 added
- libnss3 added
- libpciaccess0 added
- libsensors5 added
- libsensors-config added
- libunwind8 added
- libwayland-server0 added
- libx11-xcb1 added
- libxaw7 added
- libxcb-dri2-0 added
- libxcb-dri3-0 added
- libxcb-glx0 added
- libxcb-present0 added
- libxcb-randr0 added
- libxcb-sync1 added
- libxcb-xfixes0 added
- libxcomposite1 added
- libxdamage1 added
- libxfixes3 added
- libxfont2 added
- libxi6 added
- libxkbcommon0 added
- libxkbfile1 added
- libxmu6 added
- libxpm4 added
- libxrandr2 added
- libxshmfence1 added
- libxxf86vm1 added
- libz3-4 added
- x11-xkb-utils added
- xfonts-encodings added
- xfonts-scalable added
- xfonts-utils added
- xkb-data added
- xserver-common added
- xvfb added
