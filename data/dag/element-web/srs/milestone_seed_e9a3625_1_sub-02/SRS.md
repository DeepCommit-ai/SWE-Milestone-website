# Software Requirements Specification: Room List V3 UI Components

## Overview

This milestone delivers the core UI components for Room List V3, a redesigned room list experience with improved performance, filtering capabilities, and user interactions.

### Summary of Requirements

1. **FR1: Virtualized Room List Rendering** - Implement a performant virtualized flat list for displaying rooms
2. **FR2: Primary Filter Pills** - Add filter UI components for filtering rooms by type/status
3. **FR3: Room Item Options Menu** - Implement hover menu with room management actions
4. **FR4: Room List Item View Model** - Create view model for individual room list items
5. **FR5: Selection Decoration** - Highlight the currently active/selected room
6. **FR6: Visual Polish - Cursor and Padding** - Improve room list item styling and visual feedback
7. **FR7: Compose Menu in Space Context** - Fix compose menu action behavior when viewing a space
8. **FR8: Meta Space Naming Update** - Change "All rooms" meta space name to "All Chats"

### Affected Modules

- Room List Panel components
- Room List View Models
- Room List CSS styles
- Spaces store

---

## FR1: Virtualized Room List Rendering

**Problem**: The room list panel needs to efficiently render a potentially large number of rooms without performance degradation.

**Requirements**:
- Implement a virtualized list component that renders only visible room items
- Each room item should display the room avatar and room name
- Room items should be clickable to open the corresponding room
- The list should support scrolling through all rooms
- Room names that exceed the available space should be truncated with ellipsis
- The room list should update reactively when rooms are added, removed, or reordered
- The list should have an accessible label for screen readers

**Acceptance**:
- When the room list contains many rooms, only the visible items are rendered in the DOM
- When a room item is clicked, the corresponding room opens in the main view
- When hovering over a truncated room name, the full name is displayed in a tooltip
- When rooms are added or removed from the list, the UI updates accordingly
- The room list is accessible via screen readers with proper ARIA labeling
- The `RoomListView` component must use a `useRoomListViewModel()` hook that returns state conforming to `RoomListViewState`
- `RoomListViewState.rooms` must be of type `Room[]`
- The room list grid must have `role="grid"` and `aria-label="Room list"`

---

## FR2: Primary Filter Pills

**Problem**: Users need a way to quickly filter the room list by common categories such as unread, favourites, people (DMs), and rooms.

**Requirements**:
- Display primary filter options as clickable pill/chip components above the room list
- Provide the following primary filters: Unread, Favourites, People, Rooms
- Only one primary filter can be active at a time
- Clicking an active filter should deactivate it (toggle behavior)
- Clicking a different filter should switch to that filter
- Filter pills should visually indicate their selected/active state
- The filtered room list should update immediately when a filter is toggled
- Primary filters should work in conjunction with secondary filters (activity filters)
- Certain primary filters should be hidden when incompatible secondary filters are active:
  - Hide "Unread" when secondary filter is "Mentions only" or "Invites only"
  - Hide "Favourites" when secondary filter is "Invites only" or "Low priority"
- When an incompatible secondary filter is activated, any active incompatible primary filter should be automatically deactivated

**Acceptance**:
- When "Unread" filter is clicked, only rooms with unread messages are displayed
- When "Favourites" filter is clicked, only favourite rooms are displayed
- When "People" filter is clicked, only direct message rooms are displayed
- When "Rooms" filter is clicked, only non-DM rooms are displayed
- When clicking an already active filter, it becomes deactivated and all rooms are shown
- When switching between filters, the previous filter is deactivated
- When a secondary filter is changed, any active primary filter is removed
- The filter pills are rendered in a list with proper accessibility attributes
- `RoomListViewState.primaryFilters` must be of type `PrimaryFilter[]` with exactly 4 filters in order: "Unread", "Favourites", "People", "Rooms"
- Each `PrimaryFilter` must expose: `name: string`, `active: boolean`, `toggle: () => void`
- `RoomListViewState.activePrimaryFilter` must return the currently active `PrimaryFilter` or `undefined` if none is active
- `RoomListViewState.activeSecondaryFilter` must be of type `SecondaryFilters` enum with default value `SecondaryFilters.AllActivity`
- `RoomListViewState.activateSecondaryFilter` must be of type `(filter: SecondaryFilters) => void`
- The `SecondaryFilters` must be declared as `export const enum SecondaryFilters` with members: `AllActivity`, `MentionsOnly`, `InvitesOnly`, `LowPriority`
- `SecondaryFilters` must be defined and exported from a dedicated `useFilteredRooms` module at `src/components/viewmodels/roomlist/useFilteredRooms.tsx`
- `RoomListViewState.sort` must be of type `(option: SortOption) => void`
- `RoomListViewState.activeSortOption` must be of type `SortOption`
- The `SortOption` must be declared as `export const enum SortOption` with members: `Activity` (mapped to `SortingAlgorithm.Recency`), `AToZ` (mapped to `SortingAlgorithm.Alphabetic`)
- `SortOption` must be defined and exported from a dedicated `useSorter` module at `src/components/viewmodels/roomlist/useSorter.ts`
- `RoomListViewState.shouldShowMessagePreview` must be of type `boolean`
- `RoomListViewState.toggleMessagePreview` must be of type `() => void`
- `RoomListViewState.canCreateRoom` must be of type `boolean`
- `RoomListViewState.createRoom` must be of type `() => void`
- `RoomListViewState.createChatRoom` must be of type `() => void`
<!-- COMMENTED OUT - Implementation detail:
- `createChatRoom` fires `Action.CreateChat`
-->

---

## FR3: Room Item Options Menu

**Problem**: Users need quick access to common room actions (favourite, invite, leave, etc.) directly from the room list without opening the room first.

**Requirements**:
- Display a "More Options" button when hovering over a room list item (for users with menu access rights)
- The menu button should open a dropdown menu with the following actions:
  - Mark as read (when room has unread content)
  - Mark as unread (when room has no unread content and is not archived)
  - Toggle Favourite status (checkbox-style toggle)
  - Mark as Low Priority
  - Invite users (when user has invite permissions and room is not a DM)
  - Copy room link (when room is not a DM)
  - Leave room / Forget room (for archived rooms)
- Each action should dispatch the appropriate application action when clicked
- The menu should not be shown for users without menu access rights
- The menu should remain visible while interacting with it
- Menu visibility state should be communicated to the parent component

**Acceptance**:
- When hovering over a room item, the "More Options" button appears (if user has access)
- When clicking "More Options", a dropdown menu opens with available actions
- When clicking "Mark as read", the room's notifications are cleared
- When clicking "Mark as unread", the room is marked as unread
- When clicking "Favourited", the room's favourite status is toggled
- When clicking "Low priority", the room is tagged as low priority
- When clicking "Invite", the invite dialog opens
- When clicking "Copy room link", the room link is copied to clipboard
- When clicking "Leave room", the leave room dialog is triggered
- For archived rooms, "Forget room" action is shown instead of "Leave room"
- The menu is not rendered when the user lacks access to the options menu
- Create `useRoomListItemMenuViewModel(room: Room)` hook returning `RoomListItemMenuViewState`
- `RoomListItemMenuViewState` must expose these properties:
  - `showMoreOptionsMenu: boolean`
  - `isFavourite: boolean`
  - `canInvite: boolean`
  - `canCopyRoomLink: boolean`
  - `canMarkAsRead: boolean`
  - `canMarkAsUnread: boolean`
- `RoomListItemMenuViewState` must expose these action methods:
  - `markAsRead: (evt: Event) => void`
  - `markAsUnread: (evt: Event) => void`
  - `toggleFavorite: (evt: Event) => void`
  - `toggleLowPriority: () => void`
  - `invite: (evt: Event) => void`
  - `copyRoomLink: (evt: Event) => void`
  - `leaveRoom: (evt: Event) => void`
- `RoomListItemMenuView` component must accept props: `room: Room`, `setMenuOpen: (isOpen: boolean) => void`

---

## FR4: Room List Item View Model

**Problem**: Individual room list items need a dedicated view model to manage their state and actions.

**Requirements**:
- Create a view model hook for room list items
- The view model should provide:
  - `showHoverMenu`: Boolean indicating if the hover menu should be shown based on user permissions
  - `openRoom`: Function to open/view the selected room
- Access to the options menu should be determined by:
  - User's membership status (allowed for invites, not allowed for knock or knock-denied)
  - UI component visibility settings

**Acceptance**:
- When a room item's openRoom function is called, the room is opened in the main view
- When the user has access to the options menu, showHoverMenu returns true
- When the user does not have access to the options menu, showHoverMenu returns false
- Create `useRoomListItemViewModel(room: Room)` hook returning `RoomListItemViewState`
- `RoomListItemViewState` must expose: `showHoverMenu: boolean`, `openRoom: () => void`, `a11yLabel: string`, `notificationState: RoomNotificationState`
<!-- COMMENTED OUT - Implementation detail:
- The `openRoom` action must dispatch `Action.ViewRoom` with `room_id` and `metricsTrigger: "RoomList"`
-->
- Create utility function `hasAccessToOptionsMenu(room: Room): boolean` in `utils.ts`
- Create utility function `hasCreateRoomRights(matrixClient: MatrixClient, space?: Room | null): boolean` in `utils.ts` - checks if user can create rooms in the given context, using the MatrixClient to verify space permissions
- Create async utility function `createRoom(space?: Room | null): Promise<void>` in `utils.ts` - fires room creation action or shows space-specific dialog
- `RoomListItemView` component must accept props: `room: Room`, `isSelected: boolean`

---

## FR5: Selection Decoration

**Problem**: Users need visual feedback to identify which room is currently active/selected in the room list.

**Requirements**:
- Apply distinct visual styling to the currently selected room item
- The selected room should have a different background color than non-selected items
- Set appropriate ARIA attributes to indicate selection state
- Auto-scroll the list to keep the selected room visible when the list changes
- Track the active room index and update it when:
  - A different room is opened
  - Rooms are reordered in the list
  - Rooms are added or removed from the list
- Maintain the selected room's position (sticky room behavior) when possible

**Acceptance**:
- When a room is selected, it has a visually distinct background color (pressed state)
- When the selected room changes, the previous selection styling is removed
- The selected room item has `aria-selected="true"` attribute
- When filters change and the selected room becomes hidden then visible again, the list scrolls to show it
- The active room index is initially undefined when no room is open
- `RoomListViewState.activeIndex` must be of type `number | undefined`
- The `activeIndex` must be `undefined` when no room is currently open/selected

---

## FR6: Visual Polish - Cursor and Padding

**Problem**: Room list items need improved visual feedback and spacing for better usability.

**Requirements**:
- Room list items should display a pointer cursor on hover to indicate clickability
- Reduce the padding between the room avatar and the left border of the list
- Room list items should have a hover background color change

**Acceptance**:
- When hovering over a room list item, the cursor changes to a pointer
- When hovering over a room list item, the background color changes to indicate hover state
- Room list items have reduced left padding (8px instead of 12px) for better visual density

---

## FR7: Compose Menu in Space Context

**Problem**: When viewing a space, the compose menu button behavior needs to respect the user's permissions within that space.

**Requirements**:
- Check if the user has permission to create rooms in the current space
- Display the compose menu when the user can create rooms OR can create video rooms
- When the compose menu is not shown (user lacks room creation rights), show a simplified "New message" button that only allows creating DMs
- In a space context, verify permissions by checking if the user can send state events (specifically room avatar events)

**Acceptance**:
- When in a space where the user can create rooms, the full compose menu is displayed
- When in a space where the user cannot create rooms but can create video rooms, the compose menu is displayed
- When in a space where the user cannot create rooms or video rooms, only a "New message" button is shown
- When clicking the "New message" button, a new direct message can be started
- Create `useRoomListHeaderViewModel()` hook returning `RoomListHeaderViewState`
- `RoomListHeaderViewState` must expose these properties:
  - `title: string`
  - `displayComposeMenu: boolean`
  - `displaySpaceMenu: boolean`
  - `canCreateRoom: boolean`
  - `canCreateVideoRoom: boolean`
  - `canInviteInSpace: boolean`
  - `canAccessSpaceSettings: boolean`
- `RoomListHeaderViewState` must expose these action methods:
  - `createChatRoom: (e: Event) => void`
  - `createRoom: (e: Event) => void`
  - `createVideoRoom: () => void`
  - `openSpaceHome: () => void`
  - `inviteInSpace: () => void`
  - `openSpacePreferences: () => void`
  - `openSpaceSettings: () => void`
<!-- COMMENTED OUT - Implementation detail:
  - `createChatRoom` fires `Action.CreateChat`
  - `createRoom` fires `Action.CreateRoom` or calls `showCreateNewRoom(space)` in space context
  - `createVideoRoom` fires `Action.CreateRoom` with `RoomType.UnstableCall` or `RoomType.ElementVideo`
  - `openSpaceHome` fires `Action.ViewRoom` with `room_id` of active space
  - `inviteInSpace` calls `showSpaceInvite(space)`
  - `openSpacePreferences` calls `showSpacePreferences(space)`
  - `openSpaceSettings` calls `showSpaceSettings(space)`
-->
- `displayComposeMenu` must be `true` if `canCreateRoom || canCreateVideoRoom`
- `canCreateVideoRoom` must be `true` when `feature_video_rooms` setting is enabled

---

## FR8: Meta Space Naming Update

**Problem**: The "All rooms" meta space name should be updated to better reflect its purpose.

**Requirements**:
- Change the display name of the meta space from "All rooms" to "All Chats" when the user has the "all rooms in home" setting enabled
- Maintain "Home" as the display name when the setting is disabled

**Acceptance**:
- When the "all rooms in home" setting is enabled, the space title displays "All Chats"
- When the "all rooms in home" setting is disabled, the space title displays "Home"
- `RoomListHeaderViewState.title` must return the active space's name when in a space, or "Home" (or "All Chats") when not in a space


---

# Environment Dependency Changes (relative to Base Env)

## Node Packages
- axios@1.7.9 added
- domutils@2.8.0 added
- strip-ansi@7.1.0 removed
