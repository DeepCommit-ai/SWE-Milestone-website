# Software Requirements Specification: Simplified Sliding Sync Architecture

## Overview

This milestone refactors the sliding sync implementation to adopt a simplified architecture that relies on native server support for sliding sync (MSC3575). The changes involve:

1. Deprecating the legacy sliding sync feature flag and proxy-based implementation
2. Introducing a new `feature_simplified_sliding_sync` labs flag for native server sliding sync
3. Removing the legacy `SlidingRoomListStore` and proxy lookup mechanisms
4. Simplifying the `SlidingSyncManager` to work directly with server-supported sliding sync
5. Updating all dependent components to use the new simplified sliding sync feature flag
6. Implementing improved room spidering with multiple simultaneous lists for better performance

**Affected Modules**:
- SlidingSyncManager
- MatrixClientPeg
- RoomListStore
- RoomViewStore
- MemberListStore
- RoomSublist component
- Settings configuration
- SlidingSyncController

---

## Requirements

### FR1: Deprecate Legacy Sliding Sync Feature Flag

**Problem**: The legacy `feature_sliding_sync` setting uses a proxy-based approach that is no longer required now that servers natively support sliding sync. Users still configured with this legacy flag need to be informed that it is no longer supported.

**Requirements**:
- When the legacy `feature_sliding_sync` setting is enabled at startup, the application must throw a user-friendly error indicating the feature is no longer supported
- The legacy `feature_sliding_sync` setting must be retained in settings but no longer function as a feature toggle
- The associated `feature_sliding_sync_proxy_url` setting must be removed entirely

**Acceptance**:
- When a user has `feature_sliding_sync` enabled, the application displays an error message indicating legacy sliding sync is no longer supported
- The `feature_sliding_sync_proxy_url` configuration option no longer exists in settings

---

### FR2: Introduce Simplified Sliding Sync Feature Flag

**Problem**: Users need a way to opt into the new simplified sliding sync implementation that works with native server support.

**Requirements**:
- A new `feature_simplified_sliding_sync` labs feature flag must be introduced
- The flag must be available in the Developer labs group
- Enabling the flag must require a page reload and cannot be disabled once enabled
- The flag must only be enableable when the server advertises support for simplified sliding sync (org.matrix.simplified_msc3575)

**Acceptance**:
- When `feature_simplified_sliding_sync` is enabled, the SlidingSyncManager is configured to use native sliding sync
- When simplified sliding sync is enabled and then user attempts to disable it, a notice is displayed indicating logout is required
- When the server does not support sliding sync, the setting shows as disabled with an explanatory message

---

### FR3: Remove Proxy-Based Sliding Sync Discovery

**Problem**: The sliding sync implementation currently looks up proxy URLs from well-known configuration and client settings, adding complexity that is no longer needed with native server support.

**Requirements**:
- Remove the `getProxyFromWellKnown` method from SlidingSyncManager
- Configure sliding sync to use the server's base URL directly instead of a proxy
- The `setup` method must directly use `client.baseUrl` as the sliding sync endpoint

**Acceptance**:
- When simplified sliding sync is enabled, it connects directly to the server's base URL without proxy lookup
- The sliding sync manager no longer fetches or uses well-known proxy configuration

---

### FR4: Remove Legacy SlidingRoomListStore

**Problem**: The `SlidingRoomListStore` class was a specialized room list store for the legacy sliding sync implementation. With the simplified architecture, the standard `RoomListStoreClass` handles room list management.

**Requirements**:
- Remove the `SlidingRoomListStore` class entirely
- The `RoomListStore` singleton must always use `RoomListStoreClass` regardless of sliding sync mode
- After changing tag sorting in the room list store, an update must be triggered immediately

**Acceptance**:
- Room list operations work correctly with simplified sliding sync using the standard RoomListStoreClass
- When tag sorting is changed, the room list updates immediately

---

### FR5: Simplify setRoomVisible API

**Problem**: The current `setRoomVisible` method takes both a room ID and a visibility boolean, and manages room subscription/unsubscription. The simplified implementation only needs to handle making rooms visible.

**Requirements**:
- The `setRoomVisible` method must take only a room ID parameter
- When called for a room not yet known to the client, the method must wait until the room is received before resolving
- For rooms already known, the method must resolve immediately
- For unencrypted rooms, lazy loading subscriptions must be used
- For encrypted rooms, full member state must be requested

**Acceptance**:
- `SlidingSyncManager.setRoomVisible(roomId: string)` must return `Promise<void>` (no second visibility parameter)
- When viewing a known room, `setRoomVisible` resolves immediately without waiting
- When viewing an unknown room, `setRoomVisible` waits for `ClientEvent.Room` to fire with the matching roomId before resolving
- Unencrypted rooms use lazy loading subscriptions
- Encrypted rooms receive full member state (no custom subscription)
<!-- COMMENTED OUT - Implementation detail:
- Lazy loading via `slidingSync.useCustomSubscription(roomId, subscriptionName)`
-->

---

### FR6: Implement Multi-List Room Spidering

**Problem**: The previous spidering implementation used a single list to fetch all rooms. This could result in slow population of important room categories (invites, favorites, DMs) if the user has many older rooms.

**Requirements**:
- Room spidering must use multiple simultaneous lists: spaces, invites, favourites, dms, and untagged
- Each list must start with an initial range and expand as needed based on total room counts
- Spidering must listen for lifecycle events and expand list ranges progressively
- There must be a configurable delay between spider requests
- Spidering must complete when all lists have fetched all their rooms

**Acceptance**:
- Spidering must use exactly 5 lists with keys: `"spaces"`, `"invites"`, `"favourites"`, `"dms"`, `"untagged"`
- Spidering listens to `SlidingSyncEvent.Lifecycle` for `SlidingSyncState.Complete` events
- When a list's joined room count exceeds current range, expand the range to cover all rooms
- When all 5 lists have ranges covering their joinedCount, spidering stops (removes lifecycle listener)
<!-- COMMENTED OUT - Implementation detail:
- Call `slidingSync.setListRanges(listName, [[0, newUpperBound]])` to expand range
- Get count via `slidingSync.getListData(listName).joinedCount`
-->
- When an account has zero rooms (`joinedCount: 0`), spidering completes without calling `setListRanges`

**API Contract**:
- Method signature: `startSpidering(slidingSync: SlidingSync, batchSize: number, gapBetweenRequestsMs: number): Promise<void>`
- The method receives the `SlidingSync` instance as the first parameter
- `batchSize` controls how many rooms to request per batch
- `gapBetweenRequestsMs` is the delay in milliseconds between spider requests

---

### FR7: Update Native Sliding Sync Support Detection

**Problem**: The native sliding sync support check needs to verify the simplified sliding sync feature (org.matrix.simplified_msc3575) rather than the original unstable feature.

**Requirements**:
- Server support detection must check for the `org.matrix.simplified_msc3575` unstable feature
- The static flag indicating server support must be moved from `SlidingSyncController` to `SlidingSyncManager`
- When checking support, if native support is not found, the flag must be set to false

**Acceptance**:
- `SlidingSyncManager.serverSupportsSlidingSync` must be a static boolean property on the `SlidingSyncManager` class
- `nativeSlidingSyncSupport(client: MatrixClient)` must check for the simplified sliding sync unstable feature
- `checkSupport(client: MatrixClient)` must set the static flag appropriately based on server support
<!-- COMMENTED OUT - Implementation detail:
- Call `client.doesServerSupportUnstableFeature("org.matrix.simplified_msc3575")` in `nativeSlidingSyncSupport`
- Set `SlidingSyncManager.serverSupportsSlidingSync = true/false` in `checkSupport`
-->

---

### FR8: Remove Sliding Sync Specific Logic from UI Components

**Problem**: The RoomSublist component contains special-case logic for sliding sync mode that is no longer needed with the simplified architecture.

**Requirements**:
- Remove sliding sync-specific tile visibility calculations from RoomSublist
- Remove sliding sync-specific "show more" range expansion logic
- Use standard sorting parameters from RoomListStore instead of reading from SlidingSyncManager directly

**Acceptance**:
- The RoomSublist component uses standard room list store methods for all sorting and counting operations
- The "show more" button behavior is consistent regardless of sliding sync mode

---

### FR9: Enable Unread Indicators with Sliding Sync

**Problem**: The `doesRoomHaveUnreadMessages` function previously short-circuited to return false when sliding sync was enabled due to incomplete implementation.

**Requirements**:
- Remove the sliding sync check that disables unread message detection
- Allow unread indicators to function normally with simplified sliding sync

**Acceptance**:
- When using simplified sliding sync, rooms with unread messages display unread indicators correctly

---

### FR10: Update MemberListStore for Simplified Sliding Sync

**Problem**: The MemberListStore needs to use the new feature flag name to determine lazy loading behavior.

**Requirements**:
- Lazy loading detection must check `feature_simplified_sliding_sync` instead of `feature_sliding_sync`
- For encrypted rooms in sliding sync mode, lazy loading must be disabled
- For unencrypted rooms in sliding sync mode, the /members endpoint must be called

**Acceptance**:
- MemberListStore must check the `feature_simplified_sliding_sync` setting to detect sliding sync mode
- When simplified sliding sync is enabled and the room is unencrypted, the /members endpoint is called for lazy loading
- When simplified sliding sync is enabled and the room is encrypted, lazy loading is disabled
<!-- COMMENTED OUT - Implementation detail:
- Check via `SettingsStore.getValue("feature_simplified_sliding_sync")`
- Call `client.members(roomId, ...)` for lazy loading
-->

---

### FR11: Update RoomViewStore for Simplified Sliding Sync

**Problem**: The RoomViewStore needs to use the new feature flag and simplified room subscription logic.

**Requirements**:
- Room subscription must check `feature_simplified_sliding_sync` instead of `feature_sliding_sync`
- Remove logic that unsubscribes from previous rooms when switching rooms
- Remove logic that aborts room view if subscription racing occurs

**Acceptance**:
- RoomViewStore must check the `feature_simplified_sliding_sync` setting to determine if sliding sync is enabled
- When viewing a room with simplified sliding sync enabled, make the room visible using the SlidingSyncManager
- Room navigation works correctly even when rapidly switching between rooms (sequential visibility calls without unsubscribe)
<!-- COMMENTED OUT - Implementation detail:
- Check via `SettingsStore.getValue("feature_simplified_sliding_sync")`
- Call `slidingSyncManager.setRoomVisible(roomId)` with only the roomId parameter
-->

---

### FR12: Use Bump Stamp for Room Recency Sorting

**Problem**: Simplified Sliding Sync (MSC4186) provides a bump stamp timestamp that should be used for sorting rooms by recency.

**Requirements**:
- The recency sorting algorithm must check for and use the room's bump stamp if available
- If a bump stamp is present, it should be used as the timestamp for sorting

**Acceptance**:
- When a room has a bump stamp set, it is used for recency-based sorting
- Rooms without bump stamps fall back to existing timeline-based sorting

---

### FR13: Remove Sliding Sync Room Search Hook

**Problem**: The `useSlidingSyncRoomSearch` hook was used for room searching with the legacy sliding sync implementation and is no longer needed.

**Requirements**:
- Remove the `useSlidingSyncRoomSearch` hook entirely

**Acceptance**:
- The useSlidingSyncRoomSearch hook no longer exists in the codebase


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
