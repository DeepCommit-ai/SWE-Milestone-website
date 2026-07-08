# Software Requirements Specification: Room List V3 ViewModel Foundation

## Overview

This specification defines the requirements for establishing the ViewModel foundation for Room List V3 in the Element web client. The ViewModel layer provides the bridge between the room list data stores and the UI components, enabling reactive room list updates, filtering, sorting, and message preview functionality.

### Requirements Summary

1. **FR1**: Reactive Room List Updates and Room Opening - The ViewModel must provide a reactive list of rooms and the ability to open rooms
2. **FR2**: Primary Filter Support - Expose primary filter state and toggle functionality to the UI
3. **FR3**: Secondary Filter Support - Provide secondary filter activation and state tracking
4. **FR4**: Room List Sorting - Enable room list resorting and track the active sort method
5. **FR5**: Filter Reset Behavior - Reset primary filters when secondary filters change
6. **FR6**: Message Preview Toggle - Allow toggling message preview visibility as a device-level setting
7. **FR7**: Message Preview ViewModel - Provide per-room message preview data with reactive updates

### Affected Modules

- Room List ViewModel layer (`src/components/viewmodels/roomlist/`)
- Settings configuration (`src/settings/Settings.tsx`)

---

## Requirements

### FR1: Reactive Room List Updates and Room Opening

**Problem**: The room list UI needs a ViewModel that provides a reactive list of rooms that updates automatically when the underlying store changes, and the ability to open rooms from the list.

**Requirements**:
- The ViewModel must expose a `rooms` array containing Room objects to be displayed in the left panel
- The room list must automatically update when the room list store emits update events
- The ViewModel must provide an `openRoom(roomId: string)` function that dispatches the appropriate action to view a room
<!-- COMMENTED OUT - Implementation detail:
- When `openRoom` is called, it must dispatch a ViewRoom action with the room ID and "RoomList" as the metrics trigger
-->

**Acceptance**:
- When the room list store emits a list update event, the ViewModel's room list reflects the updated data
- When `openRoom` is called with a room ID, a ViewRoom action is dispatched with the correct room ID and metrics trigger

---

### FR2: Primary Filter Support

**Problem**: The room list needs to support primary filters (commonly used filters rendered prominently in the UI, such as Unread, Favourites, People, and Rooms) that can be toggled on and off.

**Requirements**:
- The ViewModel must expose a `primaryFilters` array containing filter objects
- Each primary filter must have:
  - A `toggle()` function to turn the filter on and off
  - An `active` boolean indicating whether the filter is currently applied
  - A `name` string for UI display (localized text)
- The available primary filters are: Unread, Favourites, People, and Rooms
- Only one primary filter can be active at a time; toggling a different primary filter deactivates the previous one
- The room list must update to reflect the applied filter when a primary filter is toggled

**Acceptance**:
- When a primary filter is toggled on, the room list updates to show only rooms matching that filter
- When a primary filter is toggled off, the room list returns to showing all rooms (subject to any secondary filter)
- When a different primary filter is toggled, the previously active primary filter becomes inactive
- The `active` property correctly reflects which filter is currently applied

---

### FR3: Secondary Filter Support

**Problem**: The room list needs secondary filters (filters hidden in a menu) including All Activity, Mentions Only, Invites Only, and Low Priority.

**Requirements**:
- The ViewModel must expose an `activateSecondaryFilter(filter)` function to activate a secondary filter
- The ViewModel must expose an `activeSecondaryFilter` property indicating the currently active secondary filter
- Available secondary filters are: All Activity (default), Mentions Only, Invites Only, and Low Priority
- The default secondary filter is All Activity
- Primary filters must be hidden when incompatible with the active secondary filter:
  - Mentions Only: Hide Unread filter
  - Invites Only: Hide Unread and Favourites filters
  - Low Priority: Hide Favourites filter
- Primary and secondary filters are combined when applied to the room list

**Acceptance**:
- When a secondary filter is activated, the room list updates to reflect that filter
- When both primary and secondary filters are active, rooms must match both filter criteria
- Incompatible primary filters are not included in the `primaryFilters` array when certain secondary filters are active

---

### FR4: Room List Sorting

**Problem**: Users need the ability to change how the room list is sorted and have their preference persisted.

**Requirements**:
- The ViewModel must expose a `sort(option)` function to change the sort order
- The ViewModel must expose an `activeSortOption` property indicating the current sort method
- Available sort options are: Activity (recency-based) and A-Z (alphabetic)
- The active sort option must be initialized from the user's stored preference
- When the sort option is changed, the room list store must be instructed to resort

**Acceptance**:
- When `sort` is called with a different option, the room list reorders according to the new sort method
- The `activeSortOption` reflects the user's stored sorting preference on initialization
- When the sort option changes, the underlying store is notified to resort the rooms

---

### FR5: Filter Reset Behavior

**Problem**: When a secondary filter is changed, any active primary filter should be reset to avoid confusing filter state combinations.

**Requirements**:
- When a secondary filter is activated, any currently active primary filter must be automatically deactivated
- The room list must update to show rooms matching only the new secondary filter (no primary filter applied)

**Acceptance**:
- When a primary filter is active and a secondary filter is changed, the primary filter's `active` property becomes false
- When a secondary filter is activated, the room list query includes only the secondary filter (not any previously active primary filter)

---

### FR6: Message Preview Toggle

**Problem**: Users need the ability to enable or disable message previews in the room list, with the preference persisted at the device level.

**Requirements**:
- The ViewModel must expose a `shouldShowMessagePreview` boolean indicating whether message previews should be displayed
- The ViewModel must expose a `toggleMessagePreview()` function to toggle the setting
- The message preview setting must be stored at the device level
- The setting must default to false (message previews disabled by default)
- A new device-level setting `RoomList.showMessagePreview` must be defined

**Acceptance**:
- When `toggleMessagePreview` is called, the `shouldShowMessagePreview` value toggles and the setting is persisted
- The `shouldShowMessagePreview` value reflects the stored device-level setting on initialization

---

### FR7: Message Preview ViewModel

**Problem**: Individual room list items need access to message preview data that updates reactively when new messages arrive.

**Requirements**:
- A dedicated ViewModel hook named `useMessagePreviewViewModel` must be provided for rendering message previews for a given room
- The hook must accept a `Room` parameter and return an object with a `message?: string` property containing the text of the message preview (or undefined if unavailable)
- The ViewModel must perform an initial fetch of the message preview when the hook is mounted using `MessagePreviewStore.instance.getPreviewForRoom()`
- The ViewModel must listen for preview change events using the event name from `MessagePreviewStore.getPreviewChangedEventName(room)` and update accordingly

**Acceptance**:
- `useMessagePreviewViewModel(room: Room)` returns a state object with `message?: string`
- When the hook is mounted, it fetches the message preview for the room and returns the preview text as `message`
- When the message preview changes for the room, the ViewModel updates `message` reactively
<!-- COMMENTED OUT - Implementation detail:
- Initial fetch via `MessagePreviewStore.instance.getPreviewForRoom()` returning the preview's `text` property
- Listen for preview changes via `MessagePreviewStore.instance` event from `MessagePreviewStore.getPreviewChangedEventName(room)`
-->


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
