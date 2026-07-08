# Software Requirements Specification: UI Quality Improvements

## Overview

This milestone addresses multiple user interface quality issues in the Navidrome web application:

1. **FR1**: Prevent disabled context menu items from triggering parent click handlers
2. **FR2**: Add ReplayGain support for Artist Radio and Top Songs playback
3. **FR3**: Hide year "0" display in album date fields
4. **FR4**: Reset activity panel error icon after user acknowledgment
5. **FR5**: Replace translation key with direct character for playlist chip removal

**Affected Modules**:
- Song context menu component
- Artist actions (Radio, Top Songs)
- Album date display field
- Activity panel (server status indicator)
- Playlist selection input component

---

## Functional Requirements

### FR1: Prevent Disabled Context Menu Items from Triggering Actions

**Problem**: Clicking on a disabled "Show in Playlist" menu item in the song context menu propagates the click event to parent elements, causing unintended behavior.

**User Report**:
```
When I click on the "Show in Playlist" option while it's greyed out (no playlists exist),
the click still bubbles up and triggers parent container actions. The menu item appears
disabled but still causes side effects when clicked.
```

**Requirements**:
- Disabled menu items must not propagate click events to parent elements
- The disabled visual state must remain unchanged
- The menu item must remain interactive enough to not close the menu unexpectedly when clicked

**Acceptance**:
- When a user clicks on the disabled "Show in Playlist" menu item, no parent onClick handler is triggered
- The menu item continues to appear visually disabled
- The context menu remains open after clicking a disabled item

---

### FR2: ReplayGain Support for Artist Radio and Top Songs

**Problem**: When playing songs via Artist Radio or Top Songs features, ReplayGain metadata is not applied, resulting in inconsistent volume levels during playback.

**User Report**:
```
Playing Artist Radio or Top Songs does not respect ReplayGain tags. The volume jumps
between tracks because the replaygain information from the API response is not being
used during playback.
```

**Requirements**:
- When fetching similar songs (Artist Radio), map ReplayGain data to the playback format
- When fetching top songs, map ReplayGain data to the playback format
- ReplayGain properties include: album gain, album peak, track gain, and track peak
- Songs without ReplayGain data should pass through unchanged

**Acceptance**:
- When playing Artist Radio, songs with ReplayGain metadata have the gain values mapped to the expected playback format (rgAlbumGain, rgAlbumPeak, rgTrackGain, rgTrackPeak)
- When playing Top Songs, songs with ReplayGain metadata have the gain values mapped correctly
- Songs without ReplayGain data play without errors

---

### FR3: Hide Year "0" Display in Album Date Fields

**Problem**: Albums with unknown or missing year information display "0" in the user interface, which is confusing and looks like a data error.

**User Report**:
```
Some of my albums show "0" as the year, which looks strange. If the year is unknown
or not set, it should just not display anything rather than showing "0".
```

**Requirements**:
- When the year range value is "0", the album date field component should return null
- When the release year starts with "0" (e.g., "0-01-01"), the album date field component should return null
- Valid year values should continue to display normally

**Acceptance**:
- When an album has yearRange equal to "0", the AlbumDatesField component returns null
- When an album has releaseYear starting with "0", the AlbumDatesField component returns null
- Albums with valid year data (e.g., "2020") continue to display correctly

---

### FR4: Reset Activity Panel Error Icon After Acknowledgment

**Problem**: The activity panel error icon persists indefinitely after a scan error occurs, even after the user has viewed the error details, providing no way to dismiss the error state visually.

**User Report**:
```
After a library scan fails, the error icon in the activity panel stays red forever.
I've already seen the error message but the icon keeps showing an error state.
I'd like to acknowledge the error and have the icon return to normal.
```

**Requirements**:
- When the activity panel is opened (clicked) while an error is displayed, the error should be marked as acknowledged
- After acknowledgment, the activity panel icon should return to its normal state
- The error message should still be visible in the panel content after acknowledgment
- If a new different error occurs, the error icon should reappear

**Acceptance**:
- When the activity panel shows an error icon and the user clicks to open it, the icon changes from error state to normal state
- The error icon element shall have `data-testid="activity-error-icon"` and the normal state icon shall have `data-testid="activity-ok-icon"`
- The error message text remains visible in the panel content
- The error state is tracked per error, so a new error will show the error icon again

---

### FR5: Direct Character for Playlist Chip Remove Button

**Problem**: The remove button on selected playlist chips uses a translation key lookup for the multiplication sign character, adding unnecessary complexity for a simple UI symbol.

**Requirements**:
- The playlist chip remove button should display the multiplication sign character directly
- The button should remain functional for removing selected playlists

**Acceptance**:
- When a playlist is selected and displayed as a chip, clicking the remove button (showing "×") removes the playlist from the selection
- The remove action triggers the onChange callback with the updated selection

---

## Test Coverage

The following test scenarios verify the requirements:

| Requirement | Test Scenario |
|-------------|--------------|
| FR1 | Clicking disabled "Show in Playlist" menu item does not trigger parent onClick |
| FR2 | Artist Radio action maps replaygain info correctly |
| FR2 | Top Songs action maps replaygain info for top songs |
| FR3 | AlbumDatesField returns null when yearRange is "0" |
| FR3 | AlbumDatesField returns null when releaseYear is "0" |
| FR4 | Activity panel clears the error icon after opening the panel |
| FR5 | Selected playlists can be removed via chip remove button |


---

# Environment Dependency Changes (relative to Base Env)

## Go Packages
- github.com/onsi/ginkgo/v2/ginkgo v2.23.4 added (Ginkgo CLI)
