# Software Requirements Specification: Multi-Library Core Service and Scanner

## Overview

This milestone implements the core library service and scanner updates required for multi-library support in Navidrome. The implementation enables users to manage multiple music libraries independently while maintaining data integrity during file relocations across libraries.

### Requirements Summary

1. **FR1**: Library Service with REST Repository Pattern
2. **FR2**: Library Path Validation
3. **FR3**: Database Constraint Handling for Libraries
4. **FR4**: User-Library Association Management
5. **FR5**: Scanner and Watcher Integration for Library Lifecycle
6. **FR6**: Cross-Library Move Detection
7. **FR7**: Album Annotation Reassignment During Cross-Library Moves
8. **FR8**: Multi-Library Scanner State Management
9. **FR9**: File System Watcher Per-Library Management
10. **FR10**: Missing Tracks Phase Finalization
11. **FR11**: Plugin Manager Lifecycle

### Affected Modules

- `core/library.go` - Library service implementation
- `scanner/controller.go` - Scanner controller updates
- `scanner/phase_2_missing_tracks.go` - Missing tracks phase with cross-library support and finalization
- `scanner/watcher.go` - File system watcher with per-library management
- `scanner/scanner.go` - Scanner state management
- `plugins/manager.go` - Plugin manager with lifecycle state management
- `plugins/plugin_lifecycle_manager.go` - Plugin lifecycle state tracking
- `model/tag.go` - Tag model field rename for consistency

---

## Functional Requirements

### FR1: Library Service with REST Repository Pattern

**Problem**: The system lacks a service layer for library management that integrates with the REST API framework and coordinates library lifecycle operations.

**Requirements**:
- Implement a Library service that wraps the library repository with business logic
- Provide a `NewRepository` method that returns a REST-compatible repository for CRUD operations
- The repository wrapper must intercept Save, Update, and Delete operations to perform validation and trigger side effects
- Library creation via Save must return the new library ID as a string
- Library updates must preserve the library ID from the URL path parameter
- Coordinate with scanner and watcher services during library lifecycle events

**Acceptance**:
- The Library service shall be defined as `type Library interface` in `core/library.go`
- The Library service shall expose a `NewRepository(ctx context.Context) rest.Repository` method that returns a REST-compatible repository wrapper
- The repository wrapper shall implement `rest.Persistable` interface with `Save`, `Update`, and `Delete` methods
- When a new library is created through `Save`, the service validates, persists, and returns the new library ID as a string
- When a library is updated through `Update(id string, entity)`, the service validates and persists the changes, using the ID from the URL parameter
- When a library is deleted through `Delete(id string)`, the service removes the library and triggers cleanup operations
- The service shall require a `Scanner` interface with `ScanAll(ctx context.Context, fullScan bool) (warnings []string, err error)` for triggering scans

---

### FR2: Library Path Validation

**Problem**: Library paths must be validated to ensure they represent valid, accessible directories before libraries can be created or updated.

**Requirements**:
- Validate that library paths are absolute (not relative)
- Validate that library paths exist on the filesystem
- Validate that library paths point to directories, not files
- Validate path accessibility using the storage abstraction layer
- Normalize paths by cleaning them (e.g., resolving `..` components)
- Return user-friendly validation error messages suitable for the admin UI
- Support multiple validation errors in a single response (e.g., both name and path invalid)

**Acceptance**:
- Validation errors shall be returned as `rest.ValidationError` with a map of field names to error messages
- When name is empty, the error message shall be `"ra.validation.required"` on the `"name"` field
- When path is empty, the error message shall be `"ra.validation.required"` on the `"path"` field
- When creating a library with a relative path, the error message shall be `"library path must be absolute"` on the `"path"` field
- When creating a library with a non-existent path, the error message shall be `"resources.library.validation.pathInvalid"` on the `"path"` field
- When creating a library with a path pointing to a file, the error message shall be `"resources.library.validation.pathNotDirectory"` on the `"path"` field
- When updating a library path, the same validations apply with the same error messages
- When both name and path are invalid, both validation errors shall be returned together in the same `rest.ValidationError`
- Paths with redundant components (e.g., `/music/../music`) shall be normalized using `filepath.Clean` before storage

---

### FR3: Database Constraint Handling for Libraries

**Problem**: Database uniqueness constraints on library name and path must be properly handled and translated into user-friendly validation errors.

**Requirements**:
- Detect UNIQUE constraint violations on the `library.name` column
- Detect UNIQUE constraint violations on the `library.path` column
- Map database constraint errors to REST validation errors with appropriate field names
- Handle constraint violations consistently for both create and update operations
- Return validation errors compatible with the react-admin UI framework

**Acceptance**:
- When a database error contains `"UNIQUE constraint failed: library.name"`, return a `rest.ValidationError` with `"ra.validation.unique"` on the `"name"` field
- When a database error contains `"UNIQUE constraint failed: library.path"`, return a `rest.ValidationError` with `"ra.validation.unique"` on the `"path"` field
- When creating a library with a name that already exists, the operation fails with the name uniqueness error
- When creating a library with a path that already exists, the operation fails with the path uniqueness error
- When updating a library to have the same name as another library, the operation fails with the name uniqueness error
- When updating a library to have the same path as another library, the operation fails with the path uniqueness error
- Updating a library with its own current name or path succeeds (no false positive constraint violation)

---

### FR4: User-Library Association Management

**Problem**: Non-admin users need to be assigned specific library access, and the system must validate library access during operations.

**Requirements**:
- Implement `GetUserLibraries` to retrieve the list of libraries a user has access to
- Implement `SetUserLibraries` to assign library access to a user
- Implement `ValidateLibraryAccess` to verify a user has permission to access a specific library
- Admin users must have automatic access to all libraries without explicit assignment
- Non-admin users must have at least one library assigned
- Prevent manual library assignment for admin users (they get all libraries automatically)
- Validate that library IDs exist before assigning them to users
- Send refresh events to clients when user-library associations change

**Acceptance**:
- The service shall expose `GetUserLibraries(ctx context.Context, userID string) (model.Libraries, error)` to retrieve user's libraries
- The service shall expose `SetUserLibraries(ctx context.Context, userID string, libraryIDs []int) error` to assign libraries
- The service shall expose `ValidateLibraryAccess(ctx context.Context, userID string, libraryID int) error` to check access
- When retrieving libraries for a non-existent user, return `model.ErrNotFound`
- When retrieving libraries for a valid user, the correct assigned libraries are returned
- When setting libraries for a regular user with valid library IDs, the assignment succeeds
- When attempting to set libraries for an admin user, return an error indicating that admin users cannot have libraries manually assigned (they automatically have access to all)
- When setting an empty library list for a regular user, return an error indicating that non-admin users must have at least one library assigned
- When setting libraries that include non-existent IDs, return an error indicating that one or more library IDs are invalid
- When setting libraries for a non-existent user, return `model.ErrNotFound`
- When validating access for an admin user, access is always granted regardless of library assignments
- When validating access for a regular user to their assigned library, access is granted
- When validating access for a regular user to an unassigned library, return an error indicating the user does not have access to that library
- When no user is found in the request context during access validation, return an error indicating the user context is missing

---

### FR5: Scanner and Watcher Integration for Library Lifecycle

**Problem**: When libraries are created, updated, or deleted, the scanner and file system watcher must be coordinated to immediately begin monitoring and scanning the new content.

**Requirements**:
- Trigger a scan after successfully creating a new library
- Trigger a scan after successfully updating a library's path (not when only the name changes)
- Trigger a scan after successfully deleting a library to clean up orphaned data
- Start the file system watcher for a newly created library
- Restart the file system watcher when a library's path is updated
- Stop the file system watcher when a library is deleted
- Scans triggered by library lifecycle events should be quick scans (not full scans)
- Side effects (scan, watcher) must only occur after the database operation succeeds
- Log appropriate messages for watcher start/stop/restart operations
- Send refresh events to all clients after library modifications

**Acceptance**:
- The service shall require a `Watcher` interface with `Watch(ctx context.Context, lib *model.Library) error` to start watching a library
- The service shall require a `Watcher` interface with `StopWatching(ctx context.Context, libraryID int) error` to stop watching a library
- When a new library is successfully created, `Watch` is called to start the watcher, and a scan is triggered
- When a library path is successfully updated, `Watch` is called to restart the watcher (automatically stops old watcher), and a scan is triggered
- When only the library name is updated (path unchanged), neither scan nor watcher restart occurs
- When a library is successfully deleted, `StopWatching` is called with the library ID, and a scan is triggered
- When library creation fails validation, no scan or watcher operations occur
- When library update fails validation, no scan or watcher operations occur
- When library deletion fails (e.g., library not found returning `model.ErrNotFound`), no scan or watcher stop occurs

---

### FR6: Cross-Library Move Detection

**Problem**: When files are moved between libraries (e.g., reorganizing music from one collection to another), the scanner must detect these moves and preserve track metadata and annotations.

**Requirements**:
- Add a cross-library move detection phase after within-library move processing
- Only process files that were not matched within their original library
- Search for moved files in other libraries using a two-tier matching strategy
- First tier: Match by MusicBrainz Track ID when available
- Second tier: Fall back to intrinsic properties (title, size, suffix, disc/track number, album) when MBZ ID is empty
- Apply the same matching logic as within-library matching (exact match, equivalent match, single match)
- Do not match files within the same library (those are handled by within-library processing)
- Prioritize MusicBrainz Track ID matches over intrinsic property matches
- Skip matching when multiple potential matches exist and none are exact
- Gracefully handle errors during cross-library move processing without failing the entire scan

**Acceptance**:
- The cross-library move processing stage shall implement a `processCrossLibraryMoves` function that receives `*missingTracks` input
- When the input is nil (meaning within-library matching already found matches), the function shall return nil without processing
- The media file repository shall provide `FindRecentFilesByMBZTrackID(missing MediaFile, since time.Time) (MediaFiles, error)` to search by MusicBrainz Track ID
- The media file repository shall provide `FindRecentFilesByProperties(missing MediaFile, since time.Time) (MediaFiles, error)` to search by intrinsic properties (title, size, suffix, disc/track number, album)
- Matching shall use `MediaFile.Equals(other)` for exact matches and `MediaFile.IsEquivalent(other)` for equivalent matches (same filename, different directory)
- When a file with MusicBrainz Track ID (`MbzReleaseTrackID` field) is moved to another library, it is detected using MBZ ID matching first
- When a file without MusicBrainz Track ID is moved to another library, it falls back to intrinsic property matching
- When a potential match has the same `LibraryID` as the missing file, it is excluded from cross-library matching
- When multiple potential matches exist in other libraries but none are exact (via `Equals`), no match is made
- When both MBZ ID and intrinsic property matches exist, the MBZ ID match is preferred (searched first)
- When equivalent matches are found across libraries (via `IsEquivalent`), they are accepted as valid matches
- When errors occur during cross-library matching for a file, the error is logged and processing continues with other files

---

### FR7: Album Annotation Reassignment During Cross-Library Moves

**Problem**: When a track is moved to a different library and its album ID changes, user annotations (stars, ratings) on the original album should be transferred to the new album.

**Requirements**:
- Detect when a cross-library move results in an album ID change
- Call the album repository's ReassignAnnotation method to transfer annotations from the old album to the new album
- Prevent duplicate annotation reassignment for the same target album (using tracking map)
- Use thread-safe operations when tracking processed album annotations
- Handle annotation reassignment errors gracefully without failing the move operation
- Log annotation reassignment operations for debugging

**Acceptance**:
- The album repository shall provide `ReassignAnnotation(oldAlbumID string, newAlbumID string) error` to transfer annotations between albums
- When a track is moved and its `AlbumID` field changes from old to new, call `ReassignAnnotation(oldAlbumID, newAlbumID)` to transfer album annotations
- When a track is moved but `AlbumID` remains unchanged, no annotation reassignment occurs
- The phase shall maintain a `processedAlbumAnnotations` map (keyed by target album ID) to track which album reassignments have been performed
- When multiple tracks from the same source album move to the same target album, annotation reassignment is performed only once (checked via the tracking map)
- Thread safety shall be maintained using a mutex (`annotationMutex`) when accessing the `processedAlbumAnnotations` map
- When `ReassignAnnotation` fails, the track move still succeeds and the error is logged as a warning (graceful degradation)

---

### FR8: Multi-Library Scanner State Management

**Problem**: The scanner must maintain consistent state across multiple libraries during scan operations and properly track which libraries were processed.

**Requirements**:
- Store the list of libraries being scanned in the scan state
- Update the scan state with libraries that have successfully started scanning
- Use the stored library list consistently across all scan phases
- Calculate scan elapsed time using the most recent scan time across all libraries
- Update scan status to use multi-library aware time calculations
- Pass libraries from scan state to the library update phase
- Filter out libraries that failed to start scanning from subsequent phases
- The `Tag` struct's `MediaFileCount` field must be renamed to `SongCount` (retaining the JSON tag `"songCount"`) for consistency with the naming convention used by other domain models (e.g., `Artist.SongCount`, `Playlist.SongCount`). Per-library tag statistics (`AlbumCount`, `SongCount`) must be aggregated from the `library_tag` junction table when querying across multiple libraries

**Acceptance**:
- When scanning multiple libraries, the scan state contains all successfully started libraries in a `libraries` field
- Scanner properties shall be persisted using keys: `consts.LastScanErrorKey`, `consts.LastScanTypeKey`, and `consts.LastScanStartTimeKey`
- When a database error occurs during scanning, the error message shall be stored in the `LastScanErrorKey` property
- When a scan completes successfully (even with warnings), the `LastScanErrorKey` property shall be empty
- When calculating elapsed time for a completed scan, the most recent library's scan time is used
- When getting scan status, it correctly reflects multi-library operation (scan type: "full" or "incremental"/"quick")
- When a library fails to start scanning (e.g., storage unavailable), it is excluded from subsequent phases
- When updating library timestamps after scan completion, only successfully scanned libraries are updated
- Filesystem errors affecting individual files shall produce warnings but not set the error property (warnings vs errors distinction)

---

### FR9: File System Watcher Per-Library Management

**Problem**: The file system watcher must support dynamic library management, allowing watchers to be started, stopped, and restarted for individual libraries at runtime.

**Requirements**:
- Convert watcher to a singleton to enable runtime library management
- Implement `Watch` method to start watching a specific library
- Implement `StopWatching` method to stop watching a specific library by ID
- Track active watchers per library with their contexts and cancel functions
- Automatically stop existing watcher before starting a new one for the same library
- Support cancellation of individual library watchers without affecting others
- Clean up library watcher state when the main context is cancelled
- Notify the main scan trigger loop when changes are detected in any library

**Acceptance**:
- When starting a watcher for a new library, changes in that library trigger scans
- When starting a watcher for a library that already has one, the old watcher is stopped first
- When stopping a watcher for a library, it no longer triggers scans for that library's changes
- When the main context is cancelled, all library watchers are stopped
- When a library watcher detects changes, the scan trigger mechanism is notified with the library information

---

### FR10: Missing Tracks Phase Finalization

**Problem**: After processing missing tracks and cross-library moves, the scanner must decide whether to purge remaining missing files from the database based on configuration settings.

**Requirements**:
- Implement a `finalize` method in the missing tracks phase that handles cleanup
- Support configurable purge behavior through `PurgeMissing` configuration
- Purge missing files when configuration requires it based on scan type
- Return errors from finalize if an error was passed from earlier phases
- Set `changesDetected` flag when files are purged to trigger garbage collection

**Acceptance**:
- The `finalize` function shall accept an error parameter and return it unchanged if non-nil
- When `finalize` receives nil error, it shall return nil
- When `PurgeMissing` is set to `consts.PurgeMissingAlways`, missing files shall be purged regardless of scan type
- When `PurgeMissing` is set to `consts.PurgeMissingFull`, missing files shall only be purged during full scans (when `state.fullScan` is true)
- When `PurgeMissing` is set to `consts.PurgeMissingFull` and it's not a full scan, missing files shall NOT be purged
- When `PurgeMissing` is set to `consts.PurgeMissingNever`, missing files shall never be purged
- When files are purged, `state.changesDetected` shall be set to true to trigger subsequent garbage collection

---

### FR11: Plugin Manager Lifecycle

**Problem**: The plugin manager must properly handle plugin discovery, loading, and lifecycle state management, including cleanup when plugins are unregistered.

**Requirements**:
- Scan and discover plugins from the configured plugins folder
- Register plugins with their capabilities (e.g., MetadataAgent, LifecycleManagement)
- Track plugin initialization state through a lifecycle manager
- Clean up lifecycle state when plugins are unregistered

**Acceptance**:
- The manager shall provide a `ScanPlugins()` method to discover and register plugins from the folder
- The manager shall provide a `PluginList() map[string]schema.PluginManifest` method returning all registered plugins keyed by plugin ID
- The manager shall protect the internal plugins map with a `sync.RWMutex` field named `pluginsMu`
- The manager shall track plugin initialization state via `lifecycle.markInitialized(plugin)` and `lifecycle.isInitialized(plugin)`
- When `unregisterPlugin(id string)` is called, the plugin shall be removed from the manager's plugin map
- When a plugin is unregistered, its lifecycle state shall be cleared (i.e., `isInitialized` returns false after unregister)
- When `LoadPlugin(name, capability)` or `LoadMediaAgent(name)` is called, return the loaded plugin instance

---

## Test Coverage

The following test scenarios validate the requirements:

### Library Service Tests
- Library CRUD operations (create, update, delete)
- Path validation (absolute path, path exists, path is directory, multiple errors)
- Database constraint handling (name uniqueness, path uniqueness)
- User-library association operations (get, set, validate access)
- Scan triggering on library lifecycle events
- Watcher integration on library lifecycle events
- Event broadcasting after library modifications

### Missing Tracks Phase Tests
- Within-library move detection (exact match, equivalent match, single match)
- Cross-library move detection using MusicBrainz Track ID
- Cross-library move detection using intrinsic properties
- Prioritization of MBZ ID over intrinsic properties
- Same-library file exclusion from cross-library processing
- Multiple match handling (skip when no exact match)
- Error handling during cross-library processing
- Album annotation reassignment when album ID changes
- Finalize behavior with nil vs error input
- PurgeMissing configuration modes (always, full, never)

### Multi-Library Scanner Tests
- Library isolation (separate content per library)
- Correct library_id assignment for media files, albums, folders
- Library-artist associations
- Library statistics updates
- Incremental scan behavior across libraries
- Missing file handling per library
- Error handling (filesystem errors, database errors)
- Error recovery across multiple scans
- Scanner property persistence

### Plugin Manager Tests
- Plugin discovery from folder (should load all plugins from folder)
- Plugin lifecycle state management (should clear lifecycle state when unregistering a plugin)


---

## Interface Contracts (Required Names & Signatures)

This milestone's acceptance tests reference the following names/signatures; the
implementation must match them exactly (the prose requirements above leave the
exact interface shape unstated, so it is pinned here):

- **Library service constructor** (core):
  `func NewLibrary(ds model.DataStore, scanner Scanner, watcher Watcher, broker events.Broker) Library`
  (`events.Broker` from `server/events`).
- **Scanner state** must track the libraries list for consistency across
  phases: the `scanState` struct carries a `libraries model.Libraries` field.
- **Missing-tracks phase** exposes the cross-library move handler:
  `func (p *phaseMissingTracks) processCrossLibraryMoves(in *missingTracks) (*missingTracks, error)`.
- **Album refresh phase constructor**:
  `func createPhaseRefreshAlbums(ctx context.Context, state *scanState, ds model.DataStore, libs model.Libraries) *phaseRefreshAlbums`.

# Environment Dependency Changes (relative to Base Env)

## Go Packages
- ginkgo v2.23.4 added (test framework CLI)
- wire (latest) added (dependency injection code generator)

## Go Runtime
- Go upgraded to 1.24.5 (from 1.24.4, due to GOTOOLCHAIN=auto)

## Environment Variables
- GOTOOLCHAIN set to auto (was: local)
