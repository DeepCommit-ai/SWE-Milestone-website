# Software Requirements Specification: Image and Video Hiding Privacy Feature

## Overview

This milestone adds the ability to hide images and videos after a user has clicked "show image" or "show video" in the timeline. Currently, when a user has the "show images" setting disabled, they can reveal individual media items by clicking them. However, there is no way to reverse this action and hide the media again. This feature introduces a "Hide" action button in the message action bar for media events, allowing users to toggle media visibility on a per-event basis.

### Requirements Summary

1. **FR1**: Add a Hide action button for visible media events
2. **FR2**: Create a centralized media visibility state management hook
3. **FR3**: Modify image body components to support toggled visibility
4. **FR4**: Modify video body components to support toggled visibility
5. **FR5**: Add persistent per-event visibility setting storage
6. **FR6**: Migrate existing shown images from localStorage to settings store

### Affected Modules

- Message body components (MImageBody, MVideoBody, MStickerBody)
- Message action bar
- Settings storage and state management
- UI components for hidden media placeholders

### Design Guidelines

This project uses the **Compound Design System**. For any new UI components that require icons:
- Use icons from `@vector-im/compound-design-tokens/assets/web/icons`
- Do not create or import local SVG files from `res/img/` for new features

---

## Requirements

### FR1: Hide Action Button for Visible Media Events

**Problem**: Users who have clicked "show image" or "show video" to reveal media cannot hide it again without refreshing the page.

**Requirements**:
- Add a "Hide" button to the message action bar for image and video events
- The Hide button should only appear when the media is currently visible
- The Hide button should not appear when the media is already hidden
- Clicking the Hide button should immediately hide the media and replace it with a placeholder
- The Hide button should only be available for image (m.image) and video (m.video) message types
- Redacted events should not show the Hide button

**Acceptance**:
- When a user hovers over a visible image message, a "Hide" button appears in the message action bar
- When a user hovers over a visible video message, a "Hide" button appears in the message action bar
- When the "Hide" button is clicked, the media is hidden and replaced with a "Show image/video" placeholder
- When a media event is already hidden, the "Hide" button is not visible in the action bar
- When the default "showImages" setting is true and no per-event override exists, the Hide button is visible
- When the default "showImages" setting is false and a per-event override shows the image, the Hide button is visible
- When the default "showImages" setting is false and no per-event override exists, the Hide button is not visible

**API Contract**:
- Create component `HideActionButton` in `src/components/views/messages/HideActionButton.tsx`
- Component must accept prop `mxEvent: MatrixEvent`
- Component must use `useMediaVisible` hook with `mxEvent.getId()!` to determine visibility
- When `mediaIsVisible` is false, the component must return nothing (not render)
- When clicked, the component must call the visibility setter with `false`
<!-- COMMENTED OUT - Implementation detail:
- Clicking must set `showMediaEventIds` setting via `SettingsStore.setValue("showMediaEventIds", null, SettingLevel.DEVICE, { [eventId]: false })`
-->

---

### FR2: Media Visibility State Management Hook

**Problem**: Media visibility state is managed inconsistently, using localStorage for "shown" images but lacking the ability to track "hidden" images that were previously shown.

**Requirements**:
- Create a React hook that manages media visibility state per event
- The hook should return the current visibility state and a function to set visibility
- Visibility should be determined by: (1) per-event user preference if set, or (2) the default "showImages" setting
- Setting visibility should persist the preference for that specific event
- The hook should integrate with the existing settings infrastructure for reactivity

**Acceptance**:
- When the "showImages" setting is true and no per-event preference exists, media is displayed by default
- When the "showImages" setting is false and no per-event preference exists, media is hidden by default
- When a per-event preference is set to show, the media is visible regardless of the default setting
- When a per-event preference is set to hide, the media is hidden regardless of the default setting
- When the visibility setter is called with false, the event is stored as hidden
- When the visibility setter is called with true, the event is stored as visible

**API Contract**:
- Create hook `useMediaVisible(eventId: string): [boolean, (visible: boolean) => void]` in `src/hooks/useMediaVisible.ts`
- The hook must read `showImages` and `showMediaEventIds` settings using `useSettingValue()` with `SettingLevel.DEVICE`
<!-- COMMENTED OUT - Implementation detail:
- The setter function must call `SettingsStore.setValue("showMediaEventIds", null, SettingLevel.DEVICE, { ...currentValue, [eventId]: visible })`
-->

---

### FR3: Image Body Component Visibility Toggle

**Problem**: The MImageBody component can only transition from hidden to shown state, not from shown to hidden state.

**Requirements**:
- Image body components should accept visibility state as a prop
- Image body components should not download image data when hidden
- When visibility changes from hidden to shown, the image should be downloaded and displayed
- When visibility changes from shown to hidden, the image should be replaced with a placeholder
- The hidden state should display a clickable "Show image" placeholder
- Clicking the placeholder should reveal the image
- This behavior should apply to MImageBody, MImageReplyBody, and MStickerBody components

**Acceptance**:
- When an image is hidden, no network request is made to download the image
- When an image is hidden, a "Show image" placeholder is displayed
- When a user clicks "Show image", the image is downloaded and displayed
- When an image's visibility is toggled from visible to hidden, the image is replaced with the placeholder
- When a sticker is hidden, the same placeholder behavior applies
- When generating a thumbnail for animated media, the component respects visibility state

**API Contract**:
- `MImageBody` default export must be a functional component wrapper that uses `useMediaVisible(props.mxEvent.getId()!)` hook
- The wrapper passes `mediaVisible: boolean` and `setMediaVisible: (visible: boolean) => void` props to an inner class component
- The hidden placeholder must render with text content "Show image" (i18n key: `timeline|m.image|show_image`)
- Use `HiddenMediaPlaceholder` component for the hidden state placeholder

---

### FR4: Video Body Component Visibility Toggle

**Problem**: The MVideoBody component does not support hiding videos that have already been shown to the user.

**Requirements**:
- Video body components should accept visibility state as a prop
- Video body components should not download video data or poster images when hidden
- When visibility changes from hidden to shown, the video poster/content should be downloaded
- When visibility changes from shown to hidden, the video should be replaced with a placeholder
- The hidden state should display a clickable "Show video" placeholder
- Clicking the placeholder should reveal the video

**Acceptance**:
- When a video is hidden, no network request is made to download the video or its poster
- When a video is hidden, a "Show video" placeholder is displayed
- When a user clicks "Show video", the video poster is fetched and the video becomes playable
- When a video's visibility is toggled from visible to hidden, the video player is replaced with the placeholder
- When media previews are disabled globally and a user clicks "Show video", the video poster is then rendered

**API Contract**:
- `MVideoBody` default export must be a functional component wrapper that uses `useMediaVisible(props.mxEvent.getId()!)` hook
- The wrapper passes `mediaVisible: boolean` and `setMediaVisible: (visible: boolean) => void` props to an inner class component
- The hidden placeholder must render with text content "Show video" (i18n key: `timeline|m.video|show_video`)
- Use `HiddenMediaPlaceholder` component for the hidden state placeholder

---

### FR5: Persistent Per-Event Visibility Setting Storage

**Problem**: Previously, shown images were stored in localStorage using individual keys per event, which is inconsistent with the settings storage pattern and does not support hiding previously-shown images.

**Requirements**:
- Add a device-level setting to store per-event media visibility preferences
- The setting should be a map of event IDs to boolean visibility values
- The setting should be stored at the device level (not synced to account)
- When a user shows or hides a media event, the preference should be persisted
- The setting should integrate with the settings store for change notifications

**Acceptance**:
- When a user hides an image, the event ID is stored in the settings with value false
- When a user shows a hidden image, the event ID is stored in the settings with value true
- When the application restarts, previously hidden images remain hidden
- When the application restarts, previously shown images remain shown

**API Contract**:
- Add setting `showMediaEventIds` to `Settings` interface with type `IBaseSetting<{ [eventId: string]: boolean }>`
- Register setting in `SETTINGS` with `supportedLevels: [SettingLevel.DEVICE]` and `default: {}`

---

### FR6: Migration from localStorage to Settings Store

**Problem**: Existing users may have shown images stored in localStorage using the legacy `mx_ShowImage_<eventId>` format.

**Requirements**:
- On application startup, migrate existing shown image records from localStorage to the settings store
- The migration should only run once
- After migration, the legacy localStorage keys should not be read for visibility decisions
- If migration fails or is missed, the system should fail safely (previously shown images may be hidden again)

**Acceptance**:
- When a user has previously clicked "show image" on events using the old storage format, those images remain visible after upgrading
- The migration runs only once and sets a flag to prevent re-running
- If the migration flag is already set, no migration logic executes


---

# Environment Dependency Changes (relative to Base Env)

## Node.js Packages

- @babel/code-frame upgraded to 7.26.2
- @babel/core upgraded to 7.26.10
- @babel/eslint-parser upgraded to 7.26.10
- @babel/eslint-plugin upgraded to 7.26.10
- @babel/generator upgraded to 7.26.10
- @babel/helpers upgraded to 7.26.10
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
- stylelint upgraded to 16.16.0
- stylelint-scss upgraded to 6.11.1
- terser-webpack-plugin upgraded to 5.3.14
- testcontainers upgraded to 10.21.0
- tinyglobby upgraded to 0.2.12
- typescript upgraded to 5.8.2
- update-browserslist-db upgraded to 1.1.3
- uuid upgraded to 11.1.0
- @babel/plugin-proposal-private-methods@7.18.6 added
- common-path-prefix removed
- find-cache-dir removed
- @sindresorhus/merge-streams removed
- unicorn-magic removed
