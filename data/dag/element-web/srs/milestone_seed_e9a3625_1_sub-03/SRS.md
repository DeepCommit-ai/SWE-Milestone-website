# Software Requirements Specification: Room List V3 Room Behavior and Display

## Overview

This specification defines the requirements for completing the Room List V3 feature with room behavior and display enhancements. The implementation covers five functional areas:

1. **FR1**: Empty state display showing contextual messages when the room list is empty
2. **FR2**: Active room index tracking within the room list
3. **FR3**: Sticky room behavior keeping the active room visible during list updates
4. **FR4**: Notification badge decoration showing unread counts and status indicators
5. **FR5**: Visual polish improvements for spacing and padding in room list items

**Affected Modules**:
- Room List view model and view components
- Room List Item view model and view components
- Notification decoration component
- Primary filter system
- Utility functions for room creation rights

---

## Requirements

### FR1: Empty Room List State Display

**Problem**: When the room list is empty (no rooms matching current filters), users see a blank area with no guidance on what actions they can take or why the list is empty.

**Requirements**:
- Display a contextual empty state placeholder when the room list contains zero rooms
- Show different placeholder content based on the currently active primary filter:
  - **No active filter (default)**: Display title "No chats yet" with description offering to message someone or create a room, and provide action buttons for "New message" and "New room" (if user has room creation rights)
  - **Unread filter active**: Display "Congrats! You don't have any unread messages" with a button to "Show all chats" that clears the filter
  - **Favourites filter active**: Display "You don't have favourite chat yet" with description about adding chats to favourites via chat settings
  - **People filter active**: Display "You don't have direct chats with anyone yet" with description about deselecting filters
  - **Rooms filter active**: Display "You're not in any room yet" with description about deselecting filters
- The "New room" button in the default empty state should only appear if the user has room creation rights in the current context (global or within a space)
- The empty state description should adapt based on room creation rights (mentioning "creating a room" only if permitted)
- The RoomListViewModel must expose `activePrimaryFilter` to enable filter-aware empty state rendering
- The PrimaryFilter interface must include the filter `key` property for identifying which filter is active

**Acceptance**:
- When the room list is empty and no filter is active, the empty state displays with "New message" and "New room" buttons (if permitted)
- When the "Unread" filter results in an empty list, clicking "Show all chats" clears the unread filter
- When user lacks room creation rights, the "New room" button is hidden and the description omits room creation guidance
- When a primary filter is active, the empty state shows filter-specific messaging
- `RoomListViewState.activePrimaryFilter` must be of type `PrimaryFilter | undefined`
- The `PrimaryFilter` interface must include a `key: FilterKey` property

---

### FR2: Active Room Index Tracking

**Problem**: The room list view model does not track which room in the list is currently active (being viewed), making it impossible to implement features that depend on knowing the active room's position.

**Requirements**:
- Track the index of the currently active (viewed) room within the room list array
- Update the active index when the active room changes (via `Action.ActiveRoomChanged` dispatch)
- Update the active index when the room list changes (rooms added, removed, or reordered)
- Return `undefined` for the active index when no room is currently active or when the active room is not in the visible list
- The RoomListViewModel must expose `activeIndex` as part of its state

**Acceptance**:
- When a room at index N is opened, the view model reports `activeIndex` as N
- When the active room changes to a different room, `activeIndex` updates to reflect the new room's position
- When there is no active room, `activeIndex` is `undefined`
- When the active room is removed from the list, `activeIndex` becomes `undefined`
- `RoomListViewState.activeIndex` must be of type `number | undefined`

---

### FR3: Sticky Room Behavior

**Problem**: When viewing a room, changes to the room list order (due to new messages, activity, etc.) cause the currently viewed room to move to a different position, which can be disorienting for users as the visual context shifts unexpectedly.

**Requirements**:
- Implement "sticky room" behavior that keeps the active room at its current visual index position even when the underlying list order changes
- When the room list updates but the user is still viewing the same room, maintain the room at its previous index position by reordering the list
- When the user explicitly opens a different room, allow the active index to change naturally to the new room's position
- When rooms are deleted such that the previous index position is no longer valid (index exceeds array bounds), allow the active room to shift to a valid position
- When rooms appearing after the active room are deleted, maintain the active room at its current index
- The sticky behavior should only apply to order changes, not to explicit room navigation

**Acceptance**:
- When viewing a room at index 5 and the list reorders due to activity, the room remains at index 5
- When new rooms are added at the beginning of the list, the active room stays at its previous index position
- When explicitly opening a different room, the active index updates to the new room's actual position
- When too many rooms before the active room are deleted (making the old index invalid), the room shifts to a valid index
- When rooms after the active room are deleted, the active room's index remains unchanged
- Sticky room behavior must be implemented via a `useStickyRoomList` hook that takes the rooms array and returns the reordered rooms with the active index
<!-- COMMENTED OUT - Implementation detail:
- Hook signature: `useStickyRoomList(rooms: Room[]): { rooms: Room[], activeIndex: number | undefined }`
-->

---

### FR4: Notification Badge Decoration

**Problem**: Room list items do not display notification badges or status indicators, so users cannot see at a glance which rooms have unread messages, mentions, invitations, or are muted.

**Requirements**:
- Create a NotificationDecoration component that displays appropriate visual indicators based on room notification state
- Support the following notification states with appropriate visual indicators:
  - **Unsent message**: Error icon (critical/red color)
  - **Invitation**: Unread counter badge showing "1"
  - **Mention**: Mention icon (accent color) plus unread counter with count
  - **Notification (unread)**: Unread counter badge with message count
  - **Activity only**: Small unread dot indicator
  - **Muted**: Notifications-off icon (tertiary color)
- Do not render the decoration if there is no notification activity and the room is not muted
- Display the notification decoration in room list items when not hovering (hover shows the options menu instead)
- Provide accessibility labels that describe the notification state (e.g., "Open room X with N unread messages", "Open room X invitation", "Open room X with N unread messages including mentions")
- The RoomListItemViewModel must expose `notificationState` and `a11yLabel` properties

**Acceptance**:
- When a room has unread messages, the notification decoration shows the count
- When a room has mentions, the decoration shows a mention icon plus the count
- When a room has a pending invitation, the decoration shows a badge with "1"
- When a room is muted, the decoration shows a muted/silent icon
- When a room has activity but notifications are set to activity-only, a dot indicator appears
- When hovering over a room item, the notification decoration is replaced by the hover menu
- The aria-label correctly describes the room's notification state for screen readers
- `NotificationDecoration` component must accept `notificationState: RoomNotificationState` prop
- `NotificationDecoration` must return `null` when `notificationState.hasAnyNotificationOrActivity` is `false` and room is not muted
- `RoomListItemViewState.a11yLabel` must be of type `string`
- `RoomListItemViewState.notificationState` must be of type `RoomNotificationState`

---

### FR5: Visual Polish for Room List Items

**Problem**: Room list item spacing and padding is inconsistent across different states (normal, hover, menu open, with notification decoration).

**Requirements**:
- Adjust right-side padding for room list item content area based on state:
  - **Empty state** (no notification, no hover): Full padding for visual balance
  - **Notification decoration visible**: Reduced padding to accommodate the decoration
  - **Hover or menu open state**: Minimal padding to accommodate the options menu
- Reduce the gap between menu items in the hover options menu
- Reduce the size of the "More Options" button in the hover menu to improve visual density
- Update CSS classes to apply appropriate padding based on component state:
  - `mx_RoomListItemView_empty` for items without notification decoration
  - `mx_RoomListItemView_notification_decoration` for items showing notification badges
  - `mx_RoomListItemView_menu_open` for items with hover menu visible

**Acceptance**:
- Room list items with no notification and no hover have consistent right padding
- Room list items showing notification decoration have appropriate padding for the badge
- Room list items in hover state have reduced padding to fit the menu button
- The options menu button appears smaller and gaps between elements are reduced
- Visual appearance matches the expected design with proper alignment and spacing

---

### FR6: Refactored Room Creation Rights Utility

**Problem**: Room creation rights checking logic is duplicated across multiple view models and needs to be centralized and reusable.

**Requirements**:
- Create a `hasCreateRoomRights` utility function that determines if the user can create rooms
- The function should check:
  - Whether the `UIComponent.CreateRooms` customization is enabled
  - If within a space, whether the user has permission to send state events (specifically room avatar) in that space
- Create a `createRoom` utility function that dispatches the appropriate action:
  - If within a space, show the "create new room in space" dialog
  - Otherwise, fire the generic `Action.CreateRoom` action
- Both the RoomListHeaderViewModel and RoomListViewModel should use these shared utilities
- The RoomListViewModel must expose `canCreateRoom`, `createRoom`, and `createChatRoom` functions

**Acceptance**:
- When `UIComponent.CreateRooms` is disabled, `hasCreateRoomRights` returns `false`
- When not in a space and `UIComponent.CreateRooms` is enabled, `hasCreateRoomRights` returns `true`
- When in a space, `hasCreateRoomRights` additionally checks space permissions
- Calling `createRoom` without a space triggers room creation
- Calling `createRoom` with a space opens the space-specific room creation dialog
- The view models correctly report room creation capability based on current context
<!-- COMMENTED OUT - Implementation detail:
- `createRoom` without a space fires `Action.CreateRoom`
- `createRoom` with a space calls `showCreateNewRoom(space)`
-->
- Utility functions `hasCreateRoomRights` and `createRoom` must be exported from `src/components/viewmodels/roomlist/utils`
<!-- COMMENTED OUT - Implementation detail:
- `hasCreateRoomRights(matrixClient: MatrixClient, space?: Room | null): boolean`
- `createRoom(space?: Room | null): Promise<void>`
-->
- `RoomListViewState` must include:
  - `canCreateRoom: boolean`
  - `createRoom: () => void`
  - `createChatRoom: () => void`
- `RoomListHeaderViewState` must include:
  - `canCreateRoom: boolean`
  - `displayComposeMenu: boolean`
  - `createRoom: (e: Event) => void`


---

# Environment Dependency Changes (relative to Base Env)

## Node.js Packages

- acorn upgraded to 8.14.1
- at-least-node 1.0.0 added
- axios upgraded to 1.8.4
- @babel/code-frame upgraded to 7.26.2
- @babel/core upgraded to 7.26.10
- @babel/eslint-parser upgraded to 7.26.10
- @babel/eslint-plugin upgraded to 7.26.10
- @babel/generator upgraded to 7.26.10
- @babel/helpers upgraded to 7.26.10
- @babel/plugin-proposal-private-methods 7.18.6 added
- @babel/plugin-transform-runtime upgraded to 7.26.10
- @babel/runtime upgraded to 7.26.10
- @babel/traverse upgraded to 7.26.10
- @babel/types upgraded to 7.26.10
- babel-loader upgraded to 10.0.0
- babel-plugin-polyfill-corejs3 upgraded to 0.11.1
- bare-os upgraded to 3.6.0
- cacheable upgraded to 1.8.9
- caniuse-lite upgraded to 1.0.30001704
- copy-webpack-plugin upgraded to 13.0.0
- core-js upgraded to 3.41.0
- core-js-compat upgraded to 3.41.0
- cronstrue upgraded to 2.56.0
- css-minimizer-webpack-plugin upgraded to 7.0.2
- domhandler upgraded to 5.0.3
- dom-serializer upgraded to 2.0.0
- domutils upgraded to 3.2.2
- electron-to-chromium upgraded to 1.5.120
- @element-hq/element-web-playwright-common 1.1.5 added
- @eslint-community/eslint-utils upgraded to 4.5.1
- eslint-config-prettier upgraded to 10.1.1
- eslint-plugin-react-compiler upgraded to 19.0.0-beta-e552027-20250112
- eslint-plugin-react-hooks upgraded to 5.2.0
- eslint-visitor-keys upgraded to 4.2.0
- fastq upgraded to 1.19.1
- file-entry-cache upgraded to 10.0.7
- find-yarn-workspace-root 2.0.0 added
- @fontsource/inconsolata upgraded to 5.2.5
- @fontsource/inter upgraded to 5.2.5
- foreground-child upgraded to 3.3.1
- form-data upgraded to 4.0.2
- fs-extra 9.1.0 added
- hookified upgraded to 1.8.1
- html-dom-parser 5.0.13 added
- html-react-parser 5.2.2 added
- inline-style-parser 0.2.4 added
- is-docker downgraded to 2.2.1
- is-wsl downgraded to 2.2.0
- jsonfile 6.1.0 added
- jsonify 0.0.1 added
- json-stable-stringify 1.2.1 added
- @keyv/serialize upgraded to 1.0.3
- klaw-sync 6.0.0 added
- knip upgraded to 5.46.0
- lint-staged upgraded to 15.5.0
- lodash-es 4.17.21 added
- mailpit-api upgraded to 1.2.0
- maplibre-gl upgraded to 5.2.0
- matrix-js-sdk upgraded to 37.2.0
- @matrix-org/analytics-events upgraded to 0.29.2
- nan upgraded to 2.22.2
- oidc-client-ts upgraded to 3.2.0
- os-tmpdir 1.0.2 added
- patch-package 8.0.0 added
- playwright upgraded to 1.51.1
- playwright-core upgraded to 1.51.1
- @playwright/test upgraded to 1.51.1
- postcss-calc upgraded to 10.1.1
- prettier upgraded to 3.5.3
- react-property 2.0.2 added
- react-string-replace 1.1.1 added
- re-resizable upgraded to 6.11.2
- reusify upgraded to 1.1.0
- @sentry/babel-plugin-component-annotate upgraded to 3.2.2
- @sentry/browser upgraded to 9.6.0
- @sentry/bundler-plugin-core upgraded to 3.2.2
- @sentry/cli upgraded to 2.42.2
- @sentry/cli-darwin upgraded to 2.42.2
- @sentry/cli-linux-arm upgraded to 2.42.2
- @sentry/cli-linux-arm64 upgraded to 2.42.2
- @sentry/cli-linux-i686 upgraded to 2.42.2
- @sentry/cli-linux-x64 upgraded to 2.42.2
- @sentry/cli-win32-i686 upgraded to 2.42.2
- @sentry/cli-win32-x64 upgraded to 2.42.2
- @sentry/core upgraded to 9.6.0
- @sentry-internal/browser-utils upgraded to 9.6.0
- @sentry-internal/feedback upgraded to 9.6.0
- @sentry-internal/replay upgraded to 9.6.0
- @sentry-internal/replay-canvas upgraded to 9.6.0
- @sentry/webpack-plugin upgraded to 3.2.2
- strip-ansi downgraded to 6.0.1
- stylelint upgraded to 16.16.0
- stylelint-scss upgraded to 6.11.1
- style-to-js 1.1.16 added
- style-to-object 1.0.8 added
- terser-webpack-plugin upgraded to 5.3.14
- testcontainers upgraded to 10.21.0
- @testcontainers/postgresql upgraded to 10.19.0
- tinyglobby upgraded to 0.2.12
- tmp downgraded to 0.0.33
- typescript upgraded to 5.8.2
- @typescript-eslint/eslint-plugin upgraded to 8.26.1
- @typescript-eslint/parser upgraded to 8.26.1
- @typescript-eslint/scope-manager upgraded to 8.26.1
- @typescript-eslint/types upgraded to 8.26.1
- @typescript-eslint/typescript-estree upgraded to 8.26.1
- @typescript-eslint/type-utils upgraded to 8.26.1
- @typescript-eslint/utils upgraded to 8.26.1
- @typescript-eslint/visitor-keys upgraded to 8.26.1
- @types/dockerode upgraded to 3.3.35
- @types/lodash upgraded to 4.17.16
- @types/node upgraded to 18.19.80
- @types/prop-types upgraded to 15.7.14
- @types/react-virtualized upgraded to 9.22.2
- universalify upgraded to 2.0.1
- update-browserslist-db upgraded to 1.1.3
- uuid upgraded to 11.1.0
- @vector-im/compound-design-tokens upgraded to 4.0.1
- @vector-im/compound-web upgraded to 7.9.0
- @vector-im/matrix-wysiwyg upgraded to 2.38.2
- @yarnpkg/lockfile 1.1.0 added
- common-path-prefix removed
- find-cache-dir removed
- linkify-element removed
- @sindresorhus/merge-streams removed
- unicorn-magic removed
