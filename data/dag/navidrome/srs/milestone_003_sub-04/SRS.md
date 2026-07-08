# Software Requirements Specification: Multi-Library UI Components

## Overview

This specification defines the requirements for implementing multi-library user interface components in a React-based music streaming application. The system must provide administrators with the ability to manage multiple music libraries, assign users to specific libraries, and allow users to filter content by their accessible libraries through a global selector interface.

**Implementation Notes**:
- Use `@material-ui/core` and `@material-ui/icons` (Material-UI v4) for UI components
- Use react-admin hooks (`useDataProvider`, `useTranslate`, `useRefresh`, `useGetList`) for data fetching and i18n
- Redux actions must use structure `{ type: 'ACTION_TYPE', data: payload }`

### Requirements Summary

1. **FR1**: Global Library Selector Component - Implement a sidebar component for filtering content by selected libraries
2. **FR2**: Library Selection Input Component - Implement a reusable input component for selecting libraries in forms
3. **FR3**: Library Management Pages - Implement list, create, and edit pages for library administration
4. **FR4**: User-Library Assignment in User Forms - Integrate library selection into user creation and editing workflows
5. **FR5**: Library Filtering in Data Provider - Apply library-based filtering to content resource queries
6. **FR6**: Library State Management - Implement Redux state management for library selection persistence
7. **FR7**: User Form Validation - Validate that non-admin users have at least one library assigned
8. **FR8**: Duration and Number Formatting Utilities - Implement utility functions for displaying library statistics
9. **FR9**: Library Edit Form Input Fix - Use appropriate input types for read-only statistic fields

### Affected Modules

- `ui/src/common/` - Shared components and hooks
- `ui/src/library/` - Library management pages
- `ui/src/user/` - User form components and validation
- `ui/src/layout/` - Menu and navigation components
- `ui/src/dataProvider/` - Data fetching and filtering layer
- `ui/src/reducers/` - Redux state management
- `ui/src/actions/` - Redux action creators
- `ui/src/utils/` - Utility functions

---

## Functional Requirements

### FR1: Global Library Selector Component

**Problem**: Users with access to multiple libraries have no way to filter the content displayed throughout the application to show only items from specific libraries.

**Requirements**:
- Implement a `LibrarySelector` component that displays in the sidebar menu when the menu is expanded
- The selector must only render when the current user has access to more than one library
- Display a chip UI element showing the current selection state:
  - "All Libraries (N)" when all N libraries are selected
  - "X of N Libraries" when X libraries out of N are selected
  - "None (0 of N)" when no libraries are selected
- Clicking the chip must open a dropdown panel with:
  - A master checkbox for selecting/deselecting all libraries
  - Individual checkboxes for each library showing only the library name (not the path)
- The master checkbox must show an indeterminate state when some (but not all) libraries are selected
- Clicking the master checkbox when no libraries are selected must select all libraries
- Clicking the master checkbox when all libraries are selected must deselect all libraries
- Clicking the master checkbox when some libraries are selected must select all libraries
- Individual library checkboxes must toggle their respective library's selection state
- The dropdown must close when clicking outside of it, and trigger a data refresh
- Load the user's accessible libraries from the backend when the component mounts using the current user's ID from localStorage
- Handle API errors gracefully with console warnings
- Do not attempt to load libraries if no userId is available in localStorage

**Acceptance**:
- When a user with multiple libraries opens the sidebar, a library selector chip appears
- When a user with only one library views the sidebar, no library selector appears (component returns null)
- When a user with no libraries views the sidebar, no library selector appears (component returns null)
- When the chip is clicked, a dropdown with library checkboxes appears
- When clicking away from the dropdown, it closes and data refreshes
- When the master checkbox is clicked, the selection state toggles appropriately for all libraries
- When an individual library checkbox is clicked, that library's selection toggles
- Redux actions dispatched must use action types `SET_SELECTED_LIBRARIES` and `SET_USER_LIBRARIES` with action creators `setSelectedLibraries(libraryIds)` and `setUserLibraries(libraries)` from the actions module

---

### FR2: Library Selection Input Component

**Problem**: There is no reusable form input component for selecting multiple libraries when creating or editing users.

**Requirements**:
- Implement a `SelectLibraryInput` component that displays a scrollable list of checkboxes for library selection
- Accept `onChange`, `value`, and `isNewUser` props
- Fetch the list of all available libraries from the backend
- Display "No libraries available" message when no libraries exist
- Display a master checkbox with label from translation key "resources.user.message.selectAllLibraries" when more than one library exists
- The master checkbox must not appear when only one library exists
- The master checkbox must show an indeterminate state when some (but not all) libraries are selected
- Support `value` prop as either an array of library IDs or an array of library objects with `id` properties
- For new users (`isNewUser=true`):
  - Pre-select libraries that have the `defaultNewUsers` flag set to true
  - Only pre-select default libraries when the value is an empty array and the `isLoading` state from `useGetList` is false (data has finished loading)
  - Do not override pre-selection if the user has already made selections
  - Do not call onChange if no default libraries exist (no libraries have `defaultNewUsers: true`)
  - Reset the initialization state when the `isNewUser` prop changes to allow re-triggering default selection
- For existing users:
  - Sync the checkbox states from the value prop
- Handle libraries with missing `defaultNewUsers` property gracefully
- Call the `onChange` callback with the updated array of selected library IDs whenever selection changes

**Acceptance**:
- When rendered with no available libraries, an empty message displays
- When rendered with multiple libraries, a master checkbox and individual checkboxes appear
- When rendered with a single library, only the individual checkbox appears (no master checkbox)
- When a library is clicked, its selection toggles and onChange is called
- When the master checkbox is clicked, all libraries are selected or deselected
- When rendered for a new user, default libraries are pre-selected
- When rendered for an existing user with empty values, no libraries are pre-selected

---

### FR3: Library Management Pages

**Problem**: Administrators have no user interface for viewing, creating, or editing library configurations.

**Requirements**:
- Implement a `LibraryList` component that displays libraries in a data grid with columns:
  - Name, Path, Default for New Users (boolean), Songs count, Albums count, Missing Files count, Last Scan date
- The list must support searching/filtering by name
- The list must be responsive, showing a simplified view on mobile devices
- The list must refresh when library-related events occur via SSE
- Implement a `LibraryCreate` component with a form containing:
  - Name field (required)
  - Path field (required, full width)
  - Default for New Users toggle
- Handle creation errors including unique constraint violations for name and path
- Implement a `LibraryEdit` component with:
  - Basic Information section: Name (required), Path (required), Default for New Users toggle
  - Statistics section displaying: Total Songs, Total Albums, Total Artists, Total Size (formatted as bytes), Total Duration (formatted as human-readable duration), Total Missing Files
  - Timestamp displays: Last Scan, Updated At, Created At
  - A toolbar with Save and Delete buttons
- The primary library (ID "1") must not be deletable
- The path field for the primary library (ID "1") must be read-only
- Statistics fields must be read-only
- Handle update errors appropriately
- Add the library resource to the admin menu under the settings submenu
- Implement a `DeleteLibraryButton` that shows a confirmation dialog before deletion

**Acceptance**:
- When navigating to the library list, all libraries display in a table
- When creating a library with valid data, the library is created and the user is redirected to the list
- When creating a library with a duplicate name or path, an appropriate error displays
- When editing a library, all statistics and timestamps display correctly
- When editing the primary library, the path field is read-only and delete button is hidden
- When deleting a library, a confirmation dialog appears before deletion proceeds

---

### FR4: User-Library Assignment in User Forms

**Problem**: There is no way to assign specific libraries to users during user creation or editing.

**Requirements**:
- Implement a `LibrarySelectionField` component that wraps `SelectLibraryInput` for use in react-admin forms
- The field must use the form field name `libraryIds` via react-admin's `useInput` hook
- The field must display a label from translations: "resources.user.fields.libraries"
- The field must display helper text from translations: "resources.user.helperTexts.libraries"
- Display validation errors when the field's `meta.touched` is true and `meta.error` exists
- Do not display validation errors when the field has not been touched, even if an error exists
- Use `useRecordContext` to access the current record when editing a user
- Extract library IDs from the record's `libraries` array when editing an existing user (when input value is undefined)
- Prefer the input's `value` (libraryIds) when it exists, over extracting from record's `libraries` array
- Handle null input value by initializing with an empty array
- Integrate `LibrarySelectionField` into the `UserCreate` form:
  - Show the library selection field only for non-admin users
  - For admin users, display a message that they automatically have access to all libraries
  - Use `FormDataConsumer` to conditionally render based on the `isAdmin` checkbox state
- Integrate `LibrarySelectionField` into the `UserEdit` form:
  - Show the library selection field only for non-admin users (when edited by an admin)
  - Only visible when the editing user has admin permissions
- Modify the data provider to handle user-library associations:
  - When creating a user, create the user first, then set library associations via a separate API endpoint
  - When updating a user, update the user first, then update library associations
  - Transform user data responses to include `libraryIds` derived from the `libraries` array

**Acceptance**:
- When creating a non-admin user, the library selection field appears
- When creating an admin user, a message indicates they have access to all libraries
- When editing a non-admin user as an admin, the library selection field appears
- When editing an admin user, a message indicates they have access to all libraries
- When saving a user with library selections, the associations are persisted

---

### FR5: Library Filtering in Data Provider

**Problem**: Content queries (albums, songs, artists, etc.) do not respect the user's library selection, showing items from all libraries.

**Requirements**:
- Modify the data provider's `getList` and other query methods to apply library filtering
- Define content resources that should be filtered by library: `album`, `song`, `artist`, `playlistTrack`, `tag`
- Read the selected libraries from localStorage (persisted Redux state)
- Add a `library_id` filter parameter to queries for content resources when libraries are selected
- The filter must apply the array of selected library IDs
- Do not apply library filtering to non-content resources (e.g., `user`, `library`, `transcoding`)

**Acceptance**:
- When libraries are selected, queries for albums, songs, artists, playlist tracks, and tags include the library filter
- When no libraries are selected, queries proceed without library filtering
- When querying non-content resources, no library filter is applied

---

### FR6: Library State Management

**Problem**: Library selection state is not persisted across page refreshes or component remounts.

**Requirements**:
- Implement a `libraryReducer` for Redux state management with initial state:
  - `userLibraries`: empty array of library objects the user can access
  - `selectedLibraries`: empty array of library IDs (empty means "all accessible libraries")
- The reducer must be registered under the key `library` in the Redux store, resulting in state accessible via `state.library.userLibraries` and `state.library.selectedLibraries`
- Implement action types and creators:
  - `SET_USER_LIBRARIES`: Set the list of libraries the user can access
  - `SET_SELECTED_LIBRARIES`: Set the list of currently selected library IDs
- When user libraries are set for the first time, default the selection to all library IDs
- Register the library reducer in the admin store
- Persist the library state to localStorage along with other persisted state (theme, player)
- Implement hooks for consuming library state:
  - `useSelectedLibraries`: Return selected library IDs, defaulting to all user library IDs when no explicit selection exists
  - `useLibraryFilter`: Return filter parameters for data queries:
    - Return empty object `{}` when user has only one library or no libraries
    - Return `{ libraryIds: selectedLibraryIds }` when user has multiple libraries (includes default selection when no explicit selection)
  - `useIsLibrarySelected(libraryId)`: Return whether a specific library ID is currently selected
    - Return `true` when the library is explicitly selected, or when no explicit selection exists and the library is in the user's accessible libraries
    - Return `false` for null, undefined, or non-existent library IDs

**Acceptance**:
- When the application loads, library state is restored from localStorage
- When libraries are selected, the state updates and persists
- When using hooks, correct selection state is returned based on current Redux state

---

### FR7: User Form Validation

**Problem**: Non-admin users can be saved without any library assignments, leaving them with no access to content.

**Requirements**:
- Implement a `validateUserForm` function for user form validation, exported from `userValidation.js`
- The function signature must be: `validateUserForm(values, translate)` where `values` is the form data object and `translate` is the translation function
- Return an errors object with `errors.libraryIds` set to the error message for validation failures
- Return an empty object `{}` when validation passes
- Validation logic for the `libraryIds` field:
  - Check if `values.isAdmin` is true - if so, return no errors (admin users have access to all libraries)
  - For non-admin users, require either a non-empty `values.libraryIds` array OR a non-empty `values.libraries` array
  - When `values.libraryIds` is undefined or an empty array, AND `values.libraries` is undefined or an empty array, return an error
- Use the translation key "resources.user.validation.librariesRequired" for the error message
- Integrate the validation into the UserEdit form

**Acceptance**:
- When saving a non-admin user with no libraries selected, a validation error displays
- When saving a non-admin user with libraries selected, no validation error displays
- When saving an admin user with no libraries selected, no validation error displays

---

### FR8: Duration and Number Formatting Utilities

**Problem**: Library statistics (duration, counts) need human-readable formatting for display in the library edit form.

**Requirements**:
- Implement a `formatDuration2` function that formats seconds into a human-readable duration:
  - Return "0s" for null, undefined, or negative values
  - Format with appropriate units: seconds (s), minutes (m), hours (h), days (d)
  - Show at most 3 levels of detail (e.g., "2d 1h 1m" but not "2d 1h 1m 1s")
  - When days are present, omit seconds from the output
  - Only include non-zero units in the output
  - Floor decimal values before formatting
  - Separate units with spaces (e.g., "1h 30m 45s")
- Implement a `formatNumber` function that formats numbers with locale-appropriate separators:
  - Return "0" for null or undefined values
  - Use `toLocaleString()` for formatting with thousand separators
  - Support integers, decimals, and negative numbers

**Acceptance**:
- When `formatDuration2` is called with a valid number of seconds, it returns a human-readable string following the formatting rules above (units separated by spaces, non-zero units only, max 3 levels when days present)
- When `formatDuration2` is called with null, undefined, or negative values, it returns the zero duration string
- When `formatNumber` is called with a valid number, it returns a string with locale-appropriate thousand separators
- When `formatNumber` is called with null or undefined, it returns the zero string

---

### FR9: Library Edit Form Input Fix

**Problem**: Read-only numeric fields in the library edit form use `NumberInput` which may cause issues with formatting and display.

**Requirements**:
- Replace `NumberInput` with `TextInput` for read-only statistic fields in the library edit form
- Affected fields: Total Songs, Total Albums, Total Artists
- Maintain the `readOnly` input property
- This change ensures consistent display behavior for formatted read-only values

**Acceptance**:
- When viewing the library edit form, statistic fields display correctly as read-only text
- When viewing the library edit form, statistics with custom formatters (size, duration) display formatted values

---

## Additional Requirements

### Event-Based Refresh Hook

**Requirements**:
- Implement a `useRefreshOnEvents` hook for triggering custom refresh logic when SSE events occur
- Accept a configuration object with `events` array and `onRefresh` callback: `useRefreshOnEvents({ events, onRefresh })`
- The `events` array specifies which event types to listen for
- The `onRefresh` callback executes when matching events occur
- Support wildcard `"*"` in the events array to listen to all event types
- Support global refresh events where the Redux SSE state contains `resources: { '*': '*' }`
- Handle empty events array gracefully (no refresh triggered)
- Handle missing or undefined `onRefresh` function gracefully without throwing
- Handle errors in `onRefresh` callbacks gracefully with console.warn message: "Error in useRefreshOnEvents onRefresh callback:"
- Track `lastReceived` timestamp to avoid redundant processing when the timestamp hasn't changed
- Use Redux selector to access SSE state with `lastReceived` and `resources` properties

### Display Enhancements

**Requirements**:
- Display `libraryName` field in album info displays
- Display `libraryName` field in song info displays
- Add library filter dropdown to the missing files list for filtering by library
- Display `libraryName` column in the missing files list

### Internationalization

**Requirements**:
- Add translation keys for all new UI elements including:
  - Library selector labels ("All Libraries", "None", "Select Libraries")
  - Library resource field labels and section headers
  - User library selection labels and helper text
  - Validation error messages
  - Library management notifications (created, updated, deleted)


---

# Environment Dependency Changes (relative to Base Env)

## Go Packages
- github.com/onsi/ginkgo/v2/ginkgo v2.23.4 added
