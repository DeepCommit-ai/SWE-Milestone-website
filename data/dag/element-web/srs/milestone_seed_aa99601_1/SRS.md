# Software Requirements Specification: Group Call Error Screen Display

## Overview

This specification addresses improvements to group call error handling UX in Element Web. The following requirements ensure that group calls properly display error screens to users rather than failing silently, with architectural changes to how call lifecycle is managed.

**Requirements Summary:**
1. FR1: Display error screens when group calls encounter errors or disconnect
2. FR2: Relocate call creation and destruction responsibility to RoomViewStore
3. FR3: Implement widget close action handling for Element Call
4. FR4: Simplify call connection state machine

**Affected Modules:**
- Call model layer (Call.ts)
- Room view components (RoomView.tsx, CallView.tsx)
- RoomViewStore
- Widget messaging and actions
- Related UI components (CallEvent.tsx, RoomTileCallSummary.tsx)

---

## FR1: Display Error Screens in Group Calls

**Problem**: When a group call disconnects due to errors or connection issues, the call widget disappears immediately without showing users any error information or recovery options.

**Requirements**:
- Calls must remain visible in the UI after disconnection to allow error screens to display
- A call object must persist as long as it is being presented to the user, even when no participants remain in the session
- The call widget must be able to signal when it is ready to close (after showing errors or recovery UI)
- When the widget sends a close action, the UI should stop displaying the call view

**Acceptance**:
- When a group call disconnects due to an error, the call widget remains visible until the user dismisses it or the widget signals completion
- When the widget sends a close action, the call view disappears from the room
- When navigating away from a room with an active call view, the call is marked as no longer presented
- The `Call` class must expose a `presented: boolean` property (getter and setter) to track whether the call is being shown in the UI
- When `presented` is set to `false` on an `ElementCall` with no remaining participants (and not in a video call room), the call should be destroyed

---

## FR2: Relocate Call Lifecycle Management to RoomViewStore

**Problem**: Call creation and destruction is managed within React component lifecycle hooks (CallView), causing issues with React strict mode and making the call lifecycle difficult to reason about.

**Requirements**:
- RoomViewStore must be responsible for creating calls when a user views a call or enters a video room
- RoomViewStore must track which call is currently being presented in the UI
- When a call is no longer being presented and has no participants, it should be destroyed
- Call creation must be synchronous to avoid race conditions
- The CallView component must not create or destroy calls; it should only render existing calls

**Acceptance**:
- When entering a video room, a call is automatically created and started if one does not exist
- When viewing a call via the view_call action, a call is created and started if one does not exist
- When switching rooms, the previous room's call is marked as not presented (by setting `call.presented = false`)
- When a call has no participants and is not being presented, it is destroyed (except for video call rooms)
- `RoomViewStore` must handle `Action.ViewRoom` to create calls and mark them as presented
- `RoomViewStore` must start the call when the connection state is `Disconnected`
<!-- COMMENTED OUT - Implementation detail:
- Create calls via `ElementCall.create()` and set `call.presented = true`
- Start the call by invoking `call.start()` when `connectionState === ConnectionState.Disconnected`
-->

---

## FR3: Implement Widget Close Action for Element Call

**Problem**: There is no mechanism for the Element Call widget to signal that it has finished displaying error screens or recovery UI and is ready to be hidden from the user.

**Requirements**:
- A new widget action must be supported for the widget to signal it wants to close
- The Close action is distinct from HangupCall; hangup means the user left the call, while close means the widget is done and ready to be hidden
- When a Close action is received, the call must emit an event that the UI can respond to
- The CallView must listen for this close event and trigger the room view to stop displaying the call

**Acceptance**:
- When the widget sends a close action, the call emits a Close event
- When a Close event is received, the RoomView dispatches an action to stop viewing the call
- The call view disappears immediately when close is triggered
- `ElementWidgetActions` enum must include a `Close` member
- `CallEvent` enum must include a `Close` member
<!-- COMMENTED OUT - Implementation detail:
- `ElementWidgetActions.Close` value: `"io.element.close"`
- `CallEvent.Close` value: `"close"`
-->
- The `Call` class must have a protected `close()` method that emits `CallEvent.Close`
<!-- COMMENTED OUT - Implementation detail:
- The `close()` method must set `this.messaging = null` before emitting
-->
- `CallView` component must accept an `onClose: () => void` prop and register it as a handler for `CallEvent.Close`

---

## FR4: Simplify Call Connection State Machine

**Problem**: The connection state machine includes intermediate states (WidgetLoading, Lobby, Connecting) that complicate the codebase and are not needed for the current UX requirements.

**Requirements**:
- The ConnectionState enum must be simplified to only include essential states: Disconnected, Connected, and Disconnecting
- Removed states (WidgetLoading, Lobby, Connecting) must not be referenced anywhere in the codebase
- UI components that previously displayed different text for intermediate states must be updated to handle only the essential states
- The connection state transitions must go directly from Disconnected to Connected after successful connection

**Acceptance**:
- When a call starts and successfully connects, the connection state changes directly from Disconnected to Connected
- When a call disconnects, the connection state changes through Disconnecting to Disconnected
- When viewing the room tile for a video room, only "Video", "Joined", or disconnecting states are shown (no "Loading", "Lobby", or "Joining" states)
- When viewing a call event in the timeline, only connected/disconnected states are shown in the action button
- The `ConnectionState` enum must contain exactly three members: `Disconnected`, `Connected`, `Disconnecting`
- States `Lobby`, `WidgetLoading`, and `Connecting` must be removed from `ConnectionState` enum
<!-- COMMENTED OUT - Implementation detail:
- Enum values: `Disconnected = "disconnected"`, `Connected = "connected"`, `Disconnecting = "disconnecting"`
-->
- When `CallEvent.ConnectionState` is emitted, it must include both the new state and previous state as arguments: `(newState: ConnectionState, prevState: ConnectionState)`

---

## FR5: Handle Remote Disconnection and Reconnection

**Problem**: When a call is remotely disconnected (widget dies or hangup received), the call may need to reconnect automatically in video rooms.

**Requirements**:
- When the widget messaging stops unexpectedly while connected, treat it as a disconnection and emit a Close event
- In video rooms, after a hangup, the call should restart automatically to show the lobby again
- The call must properly clean up event listeners when disconnecting
- The StopMessaging event handler must only trigger disconnection if the call was actually connected

**Acceptance**:
- When a connected call's widget dies unexpectedly, the call disconnects and closes properly
- When hanging up in a video room, the call restarts and can be rejoined
- When a call disconnects and reconnects in a video room, the connection state events are emitted correctly
- The `Call` class must handle widget death by listening for appropriate store events
- The disconnection handler must only trigger when the call was actually connected
- In video rooms, after hangup and close, the call must be ready to be reconnected
<!-- COMMENTED OUT - Implementation detail:
- Register listener for `WidgetMessagingStoreEvent.StopMessaging` in constructor
- `onStopMessaging` handler must only call `setDisconnected()` and `close()` when `this.connected === true`
- Reconnect via `call.start()` after receiving `ElementWidgetActions.HangupCall` and `ElementWidgetActions.Close`
-->


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
