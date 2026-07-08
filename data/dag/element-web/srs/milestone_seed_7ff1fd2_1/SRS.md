# Software Requirements Specification: RoomListStoreV3 Filter Infrastructure

## Overview

This document specifies the requirements for implementing a comprehensive filter infrastructure for RoomListStoreV3, a room list store that provides fast retrieval of rooms in a sorted and filtered manner. The implementation includes:

1. **FR1**: Filter abstraction with skip-list integration and FavouriteFilter reference implementation
2. **FR2**: Primary filters (UnreadFilter, PeopleFilter, RoomsFilter)
3. **FR3**: Secondary filters (InvitesFilter, MentionsFilter, LowPriorityFilter)
4. **FR4**: SpaceStore integration for room list initialization
5. **FR5**: Sorting preference persistence across sessions
6. **FR6**: UnreadFilter refinement to match only rooms with unread counts
7. **FR7**: UnreadFilter support for manually marked unread rooms
8. **FR8**: Setting to hide avatars of rooms the user has been invited to
9. **FR9**: Remove rooms from the list when user leaves

**Affected Modules**:
- Room list store (RoomListStoreV3)
- Skip-list data structure and iterators
- Room node filtering mechanism
- Sorter interface and implementations
- Room avatar component
- User preferences settings

---

## Requirements

### FR1: Filter Abstraction and FavouriteFilter Implementation

**Problem**: The room list store currently lacks a mechanism to filter rooms based on various criteria such as favourites, unread status, or room type.

**Requirements**:
- Implement a filter abstraction that allows rooms to be filtered based on specific criteria
- Each filter must have a unique identifier (key) and a method to determine if a room matches the filter condition
- The skip-list data structure must support applying filters to room nodes during seeding and insertion
- Room nodes must track which filters they match and provide a method to check if they match a given set of filter keys
- Implement a FavouriteFilter that matches rooms tagged as favourites
- The `getSortedRoomsInActiveSpace` method must accept an optional array of filter keys to filter the returned rooms
- When multiple filter keys are provided, only rooms matching ALL specified filters should be returned

**Acceptance**:
- Create a `FilterKey` const enum exported from `src/stores/room-list-v3/skip-list/filters/index.ts` with members: `FavouriteFilter`, `UnreadFilter`, `PeopleFilter`, `RoomsFilter`, `LowPriorityFilter`, `MentionsFilter`, `InvitesFilter`
- Create a `Filter` interface exported from the same module with: `matches(room: Room): boolean` method and `key: FilterKey` property
- `RoomListStoreV3Class.getSortedRoomsInActiveSpace(filterKeys?: FilterKey[]): Room[]` accepts an optional array of filter keys
- When `getSortedRoomsInActiveSpace` is called with `FilterKey.FavouriteFilter`, only rooms tagged as favourites within the active space are returned
- When a room's favourite tag is added or removed and the store is updated, the filter results reflect the change
- When multiple filter keys are provided, rooms must match all specified filters to be included in results

---

### FR2: Primary Filters (UnreadFilter, PeopleFilter, RoomsFilter)

**Problem**: Users need additional filters beyond favourites to organize their room list by unread status and room type (DMs vs. regular rooms).

**Requirements**:
- Implement an UnreadFilter that matches rooms with unread notifications
- Implement a PeopleFilter that matches rooms that are direct messages (DMs)
- Implement a RoomsFilter that matches rooms that are NOT direct messages
- All filters must integrate with the existing filter infrastructure
- The store must register these filters so they are applied to all rooms

**Acceptance**:
- `UnreadFilter` class must implement `Filter` interface: `matches(room: Room): boolean` returns true if the room has unread message counts
<!-- COMMENTED OUT - Implementation detail:
- `matches()` returns true if `RoomNotificationStateStore.instance.getRoomState(room).hasUnreadCount` is true
-->
- `PeopleFilter` class must implement `Filter` interface with `key` returning `FilterKey.PeopleFilter`
- `RoomsFilter` class must implement `Filter` interface with `key` returning `FilterKey.RoomsFilter`
- When `getSortedRoomsInActiveSpace` is called with `FilterKey.UnreadFilter`, only rooms with unread notifications are returned
- When `getSortedRoomsInActiveSpace` is called with `FilterKey.PeopleFilter`, only DM rooms are returned
- When `getSortedRoomsInActiveSpace` is called with `FilterKey.RoomsFilter`, only non-DM rooms are returned
- PeopleFilter and RoomsFilter are mutually exclusive (a room matches one or the other, never both)

---

### FR3: Secondary Filters (InvitesFilter, MentionsFilter, LowPriorityFilter)

**Problem**: Users need additional filtering options to view invited rooms, rooms with mentions, and low-priority rooms.

**Requirements**:
- Implement an InvitesFilter that matches rooms where the user has an invite membership status
- Implement a MentionsFilter that matches rooms containing unread mentions
- Implement a LowPriorityFilter that matches rooms tagged as low priority
- All filters must integrate with the existing filter infrastructure

**Acceptance**:
- `InvitesFilter` class must implement `Filter` interface with `key` returning `FilterKey.InvitesFilter`
- `MentionsFilter` class must implement `Filter` interface: `matches(room: Room): boolean` returns true if the room has unread mentions
<!-- COMMENTED OUT - Implementation detail:
- `matches()` returns true if `RoomNotificationStateStore.instance.getRoomState(room).hasMentions` is true
-->
- `LowPriorityFilter` class must implement `Filter` interface with `key` returning `FilterKey.LowPriorityFilter`
- When `getSortedRoomsInActiveSpace` is called with `FilterKey.InvitesFilter`, only rooms where the user is invited are returned
- When `getSortedRoomsInActiveSpace` is called with `FilterKey.MentionsFilter`, only rooms with unread mentions are returned
- When `getSortedRoomsInActiveSpace` is called with `FilterKey.LowPriorityFilter`, only rooms tagged as low priority are returned

---

### FR4: SpaceStore Integration for Room List Initialization

**Problem**: The room list store initializes before SpaceStore is ready, causing rooms to not be properly filtered by space membership.

**Requirements**:
- The room list store must wait for SpaceStore to be ready before seeding the room list
- The store must be accessible globally for debugging and development purposes

**Acceptance**:
- When the application starts, the room list is seeded only after SpaceStore reports it is ready
- When filtering by spaces, rooms correctly reflect their space membership based on SpaceStore data
- The store instance must be accessible globally for debugging
<!-- COMMENTED OUT - Implementation detail:
- Wait for SpaceStore via `SpaceStore.instance.storeReadyPromise`
- Assign to `window.mxRoomListStoreV3` with type declaration in `src/@types/global.d.ts`
-->

---

### FR5: Sorting Preference Persistence

**Problem**: When users change the room list sorting algorithm, their preference is lost on application restart.

**Requirements**:
- The room list store must persist the user's preferred sorting algorithm to device-level settings
- On startup, the store must use the persisted sorting preference instead of defaulting to recency
- The store must expose a single `resort` method that accepts a sorting algorithm enum value
- The store must expose the currently active sorting algorithm via a property
- The sorter interface must include a type property to identify the sorting algorithm

**Acceptance**:
- Create a `SortingAlgorithm` const enum exported from `src/stores/room-list-v3/skip-list/sorters/index.ts` with members: `Recency = "Recency"` and `Alphabetic = "Alphabetic"`
- The `Sorter` interface must include `type: SortingAlgorithm` property
- `RoomListStoreV3Class.resort(algorithm: SortingAlgorithm): void` method accepts the enum value
- `RoomListStoreV3Class.activeSortAlgorithm: SortingAlgorithm | undefined` getter property returns the current algorithm
- Setting key `RoomList.preferredSorting` stores a `SortingAlgorithm` value at device level with default `SortingAlgorithm.Recency`
- When the user changes the sorting algorithm, the preference is persisted
- When the application restarts, the room list uses the previously selected sorting algorithm
- When calling `resort` with the currently active algorithm, no re-sort operation occurs

---

### FR6: UnreadFilter Refinement for Unread Counts

**Problem**: The UnreadFilter matches rooms based on the generic "isUnread" property, which includes rooms that have activity but no actual unread count (e.g., rooms configured to only notify on mentions).

**Requirements**:
- The UnreadFilter must match only rooms that have an actual unread count, not just any unread activity
- Rooms configured to only notify on mentions/keywords should not appear in the unread filter if they only have regular messages

**Acceptance**:
- `UnreadFilter.matches()` must check for actual unread counts (not just any unread activity)
- When a room is configured to only notify on mentions/keywords and receives a regular message, it does not appear in the unread filter results
- When a room has actual unread message counts (based on notification settings), it appears in the unread filter results
<!-- COMMENTED OUT - Implementation detail:
- Must check `RoomNotificationStateStore.instance.getRoomState(room).hasUnreadCount` (not `isUnread`)
-->

---

### FR7: UnreadFilter Support for Marked Unread Rooms

**Problem**: Users can manually mark rooms as unread, but the UnreadFilter does not consider this manual marking.

**Requirements**:
- The UnreadFilter must also match rooms that have been manually marked as unread by the user
- The room list must update when the room's "marked unread" account data changes

**Acceptance**:
- `UnreadFilter.matches()` must also return true if the room has been manually marked as unread
- The store must listen for room account data changes related to marked-unread status and update the room
- When a room is manually marked as unread via account data, it appears in the unread filter results
- When the marked-as-unread status changes, the room list updates to reflect the change
<!-- COMMENTED OUT - Implementation detail:
- Check `getMarkedUnreadState(room)` from `src/utils/notifications`
- Listen for `MatrixActions.Room.accountData` dispatch actions with event type `MARKED_UNREAD_TYPE_STABLE` or `MARKED_UNREAD_TYPE_UNSTABLE`
-->

---

### FR8: Setting to Hide Invite Room Avatars

**Problem**: Some users may want to hide avatars for rooms they have been invited to, either for privacy reasons or to avoid potentially offensive content.

**Requirements**:
- Add a new boolean setting `showAvatarsOnInvites` that controls whether avatars are displayed for rooms the user is invited to
- The setting must default to `true` (show avatars)
- The setting must be configurable at the account level
- The setting must appear in the Preferences settings tab under the Room List section
- The RoomAvatar component must respect this setting and not render avatar images when the setting is disabled and the user has invite membership

**Acceptance**:
- Setting key `showAvatarsOnInvites` must be defined in `src/settings/Settings.tsx` with `supportedLevels: LEVELS_ACCOUNT_SETTINGS`, `default: true`
- Add `showAvatarsOnInvites` to `PreferencesUserSettingsTab.ROOM_LIST_SETTINGS` array (as a `BooleanSettingKey`)
- `RoomAvatar.getImageUrls()` must respect the `showAvatarsOnInvites` setting when membership is `KnownMembership.Invite`
<!-- COMMENTED OUT - Implementation detail:
- When `SettingsStore.getValue("showAvatarsOnInvites")` returns false and membership is invite, return empty array to show fallback avatar
-->
- When the setting is enabled (default), room avatars are displayed for invited rooms
- When the setting is disabled, room avatars for invited rooms show a fallback avatar (initials) instead of the actual avatar image
- The setting appears in the Preferences settings tab (the label is defined via i18n key `settings|invite_avatars`)

---

### FR9: Remove Left Rooms from Room List

**Problem**: When a user leaves a room, the room continues to appear in the room list until the next full refresh.

**Requirements**:
- When the user's membership changes from "join" to "leave" for a room, the room must be immediately removed from the room list
- The room list must emit an update event after removing the room

**Acceptance**:
- The store must handle `MatrixActions.Room.myMembership` dispatch action: when `oldMembership` is `KnownMembership.Join` and `membership` is `KnownMembership.Leave`, remove the room from the list and emit an update event
<!-- COMMENTED OUT - Implementation detail:
- Call `roomSkipList.removeRoom(room)` and emit `LISTS_UPDATE_EVENT`
-->
- When the user leaves a room, the room is immediately removed from the sorted room list
- When the user leaves a room, a list update event is emitted
- The left room no longer appears in any filter results


---

# Environment Dependency Changes (relative to Base Env)

## Node.js Packages

- @babel/code-frame upgraded to 7.26.2
- @babel/core upgraded to 7.26.10
- @babel/eslint-parser upgraded to 7.26.10
- @babel/eslint-plugin upgraded to 7.26.10
- @babel/generator upgraded to 7.26.10
- @babel/helpers upgraded to 7.26.10
- @babel/plugin-proposal-private-methods@7.18.6 added
- @babel/plugin-transform-runtime upgraded to 7.26.10
- @babel/runtime upgraded to 7.26.10
- @babel/traverse upgraded to 7.26.10
- @babel/types upgraded to 7.26.10
- @element-hq/element-web-playwright-common@1.1.5 added
- @eslint-community/eslint-utils upgraded to 4.5.1
- @fontsource/inconsolata upgraded to 5.2.5
- @fontsource/inter upgraded to 5.2.5
- @keyv/serialize upgraded to 1.0.3
- @matrix-org/analytics-events upgraded to 0.29.2
- @playwright/test upgraded to 1.51.1
- @sentry/babel-plugin-component-annotate upgraded to 3.2.2
- @sentry/browser upgraded to 9.6.0
- @sentry/bundler-plugin-core upgraded to 3.2.2
- @sentry/cli upgraded to 2.42.2
- @sentry/core upgraded to 9.6.0
- @sentry/webpack-plugin upgraded to 3.2.2
- @sentry-internal/browser-utils upgraded to 9.6.0
- @sentry-internal/feedback upgraded to 9.6.0
- @sentry-internal/replay upgraded to 9.6.0
- @sentry-internal/replay-canvas upgraded to 9.6.0
- @testcontainers/postgresql upgraded to 10.19.0
- @types/dockerode upgraded to 3.3.35
- @types/lodash upgraded to 4.17.16
- @types/node upgraded to 18.19.80
- @types/prop-types upgraded to 15.7.14
- @types/react-virtualized upgraded to 9.22.2
- @typescript-eslint/eslint-plugin upgraded to 8.26.1
- @typescript-eslint/parser upgraded to 8.26.1
- @typescript-eslint/scope-manager upgraded to 8.26.1
- @typescript-eslint/type-utils upgraded to 8.26.1
- @typescript-eslint/types upgraded to 8.26.1
- @typescript-eslint/typescript-estree upgraded to 8.26.1
- @typescript-eslint/utils upgraded to 8.26.1
- @typescript-eslint/visitor-keys upgraded to 8.26.1
- @vector-im/compound-design-tokens upgraded to 4.0.1
- @vector-im/compound-web upgraded to 7.7.2
- @vector-im/matrix-wysiwyg upgraded to 2.38.2
- acorn upgraded to 8.14.1
- axios upgraded to 1.8.1
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
- electron-to-chromium upgraded to 1.5.120
- eslint-config-prettier upgraded to 10.1.1
- eslint-plugin-react-compiler upgraded to 19.0.0-beta-e552027-20250112
- eslint-plugin-react-hooks upgraded to 5.2.0
- eslint-visitor-keys upgraded to 4.2.0
- fastq upgraded to 1.19.1
- file-entry-cache upgraded to 10.0.7
- foreground-child upgraded to 3.3.1
- form-data upgraded to 4.0.2
- hookified upgraded to 1.8.1
- knip upgraded to 5.46.0
- lint-staged upgraded to 15.5.0
- lodash-es@4.17.21 added
- mailpit-api upgraded to 1.2.0
- maplibre-gl upgraded to 5.2.0
- nan upgraded to 2.22.2
- oidc-client-ts upgraded to 3.2.0
- playwright upgraded to 1.51.1
- playwright-core upgraded to 1.51.1
- postcss-calc upgraded to 10.1.1
- prettier upgraded to 3.5.3
- re-resizable upgraded to 6.11.2
- reusify upgraded to 1.1.0
- strip-ansi upgraded to 6.0.1
- stylelint upgraded to 16.16.0
- stylelint-scss upgraded to 6.11.1
- terser-webpack-plugin upgraded to 5.3.14
- testcontainers upgraded to 10.21.0
- tinyglobby upgraded to 0.2.12
- typescript upgraded to 5.8.2
- update-browserslist-db upgraded to 1.1.3
- uuid upgraded to 11.1.0
- common-path-prefix removed
- find-cache-dir removed
- @sindresorhus/merge-streams removed
- unicorn-magic removed
