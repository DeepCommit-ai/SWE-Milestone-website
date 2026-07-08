# Software Requirements Specification: Feature Enhancements

## Overview

This milestone implements three feature enhancements to Element Web:

1. **FR1**: Remove unintentional mentions in replies (MSC4142 compliance)
2. **FR2**: Add room reporting functionality via dialog
3. **FR3**: Improve room notification state API with clearer methods and documentation

### Affected Modules

- Message composer components (mention attachment logic)
- Room summary card (right panel UI)
- Report room dialog (new component)
- Room notification state stores
- Room notification determination logic

---

## FR1: Remove Unintentional Mentions in Replies

**Problem**: When users reply to a message, the reply unintentionally forwards all user mentions from the original message to the new reply, causing unwanted notifications to users who were mentioned in the original message but not explicitly mentioned in the reply.

**Requirements**:
- When composing a reply, the `m.mentions` field must only include the sender of the message being replied to
- User IDs mentioned in the original message's `m.mentions.user_ids` array must not be automatically propagated to the reply
- The composer must not copy mentions from the replied-to event's content
- Only explicit mentions added by the user in the reply text should be included

**Acceptance**:
- When replying to a message sent by @bob that mentions @charlie, the reply's `m.mentions.user_ids` contains only `["@bob"]`
- When replying to a message with no explicit mentions in the reply text, only the original sender is mentioned
- Existing behavior for explicit @-mentions typed by the user in the reply body remains unchanged
- Room mentions (`@room`) from the original message are not propagated to replies

---

## FR2: Add Room Reporting Dialog

**Problem**: Users have no way to report problematic rooms to their homeserver administrator from within the application.

**Requirements**:

### Room Summary Card Changes
- Add a "Report room" option in the room summary card (right panel)
  - The "Report room" menu item must be placed **after** the existing "Leave room" button
  - Both "Leave room" and "Report room" buttons must be wrapped together in a container element with className `mx_RoomSummaryCard_bottomOptions`
  - The "Report room" button must use `kind="critical"` styling (consistent with "Leave room")
  - The "Report room" button must **NOT** have any additional className (do not add `mx_RoomSummaryCard_report` or similar)
  - Use the i18n key `action|report_room` for the button label

### ReportRoomDialog Component Structure
- Create a new `ReportRoomDialog` component (`src/components/views/dialogs/ReportRoomDialog.tsx`)
- Export as named export: `export const ReportRoomDialog`
- Component interface: `{ roomId: string; onFinished(complete: boolean): void }`

### Dialog Container (BaseDialog)
- Use `BaseDialog` as the dialog wrapper with these props:
  - `className="mx_ReportRoomDialog"`
  - `title={_t("report_room|title")}`
  - `contentId="mx_ReportEventDialog"`
  - `onFinished` should call `onFinished(sent)` where `sent` is the submission state

### Form Structure (using @vector-im/compound-web)
- Use `Root` component from compound-web as the form container with:
  - `id="mx_ReportEventDialog"`
  - `onSubmit` handler for form submission
- Inside `Root`, the content order must be:
  1. Description paragraph: `<p>{_t("report_room|description")}</p>`
  2. Admin message (if configured)
  3. Field component with textarea
  4. InlineSpinner (if busy)
  5. DialogButtons
- Use `Field` component with `name="reason"` containing:
  - `Label` with `htmlFor="mx_ReportRoomDialog_reason"` and text from i18n key `room_settings|permissions|ban_reason`
  - `textarea` element with:
    - `id="mx_ReportRoomDialog_reason"`
    - `placeholder={_t("report_room|reason_placeholder")}`
    - `rows={5}`
  - `ErrorMessage` component for displaying errors (render conditionally: `{error ? <ErrorMessage>{error}</ErrorMessage> : null}`)
- Use `InlineSpinner` for loading state (render conditionally: `{busy ? <InlineSpinner /> : null}`)
- Use `DialogButtons` component (from `../elements/DialogButtons`) for action buttons with:
  - `primaryButton={_t("action|send_report")}`
  - `onPrimaryButtonClick` for submit handler
  - `focus={true}`
  - `onCancel` handler
  - `disabled={busy}`

### State Management
- When form is not yet submitted (`!sent`): show the form inside `Root`
- When form is submitted (`sent`): show only confirmation message `{_t("report_room|sent")}` as a `<p>` element

### Admin Message Configuration
- Get admin message via `SdkConfig.getObject("report_event")?.get("admin_message_md", "adminMessageMD")` (note: two parameters required)
- If configured, render as HTML via `new Markdown(adminMessageMD).toHTML({ externalLinks: true })`
- Display in a `<p>` element with `dangerouslySetInnerHTML`

**Acceptance**:
- When clicking the "Report room" menu item in the room summary card, a modal dialog opens
- When a user enters a reason and clicks submit, the report is sent via `MatrixClient.reportRoom(roomId, reason)`
- When the report is successfully submitted, a confirmation message is displayed
- When an admin message is configured, it is rendered as HTML via Markdown conversion
- The room summary card renders with the new "Report room" option visible

---

## FR3: Improve Room Notification State API

**Problem**: The room notification state API has confusing method names and lacks clear documentation. The `hasMentions` property is misleading because it returns true for invitations, knocks, and unsent messages, not just actual mentions.

**Requirements**:
- Add an `invited` property (getter) to `NotificationState` base class (`src/stores/notifications/NotificationState.ts`) with backing field `_invited`
- Add new getter properties to `RoomNotificationState` (`src/stores/notifications/RoomNotificationState.ts`):
  - `isMention: boolean` - Returns true only for actual mention notifications (excludes invitations, knocks, and unsent messages)
  - `isUnsetMessage: boolean` - Returns true when notification level equals `NotificationLevel.Unsent`
  - `isActivityNotification: boolean` - Returns true when notification level equals `NotificationLevel.Activity`
  - `isNotification: boolean` - Returns true when notification level equals `NotificationLevel.Notification`
  - `hasAnyNotificationOrActivity: boolean` - Returns true for any notification or activity (considering `feature_hidebold` setting)
- Deprecate the confusing `hasMentions` property with JSDoc `@deprecated` tag explaining the replacement
- Add JSDoc documentation to existing getters (`isUnread`, `hasUnreadCount`) explaining their behavior
- The `determineUnreadState` function in `src/RoomNotifs.ts` must return an `invited: boolean` field in its result object
- `INotificationStateSnapshotParams` interface must include `invited: boolean` for change detection

**Acceptance**:
- `RoomNotificationState.invited` getter returns true when room membership is `Invite`
- `RoomNotificationState.isUnsetMessage` getter returns true when the notification level is Unsent
- `RoomNotificationState.isMention` getter returns true only for actual mention notifications (excludes invitations, knocks, and unsent messages)
- `RoomNotificationState.isNotification` getter returns true when notification level is Notification
- `RoomNotificationState.isActivityNotification` getter returns true when notification level is Activity
- `RoomNotificationState.hasAnyNotificationOrActivity` getter returns true for any notification, activity, or knock
<!-- COMMENTED OUT - Implementation detail:
- `isMention` returns `false` if `this.invited` or `this.knocked` is true, otherwise returns `this.level === NotificationLevel.Highlight`
- `hasAnyNotificationOrActivity` returns true if: knocked is true, OR (`feature_hidebold` is false AND level is Activity), OR level >= Notification
-->


---

# Environment Dependency Changes (relative to Base Env)

## Node.js Global Packages
- serve@14.2.5 added

## System Packages (APT)
- Playwright browser dependencies added (via `npx playwright install chromium --with-deps`):
  - xvfb added
  - libnss3 added
  - libnspr4 added
  - libasound2 added
  - libatk1.0-0 added
  - libatk-bridge2.0-0 added
  - libatspi2.0-0 added
  - libcups2 added
  - libdbus-1-3 added
  - libdrm2 added
  - libgbm1 added
  - libxcomposite1 added
  - libxdamage1 added
  - libxfixes3 added
  - libxkbcommon0 added
  - libxrandr2 added
  - fonts-liberation added
  - fonts-noto-color-emoji added
  - fonts-freefont-ttf added
  - fonts-ipafont-gothic added
  - fonts-tlwg-loma-otf added
  - fonts-unifont added
  - fonts-wqy-zenhei added

## Base Image
- Base image: element-hq_element-web_v1.11.95_v1.11.97/base:latest (derived from node:22-bookworm)
