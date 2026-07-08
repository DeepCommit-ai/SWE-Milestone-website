# Software Requirements Specification
## Multi-Library Database and Persistence Foundation

### Overview

This milestone establishes the database schema and persistence layer for multi-library support, enabling users to have selective access to different music libraries. The implementation involves:

1. **FR1**: Database schema for user-library associations
2. **FR2**: Library filtering for album repository
3. **FR3**: Library filtering for artist repository with per-library statistics
4. **FR4**: Library filtering for media file repository
5. **FR5**: Library filtering for folder repository
6. **FR6**: Library filtering for tag/genre repositories
7. **FR7**: User-library association management
8. **FR8**: Admin user auto-assignment to libraries
9. **FR9**: Library management operations
10. **FR10**: Artist sorting performance improvement
11. **FR11**: Tag statistics foreign key constraint fix
12. **FR12**: User library access check
13. **FR13**: Library ID filter in smart playlist criteria

**Affected Modules**:
- Database schema migrations
- User, Library, and related model definitions
- Smart playlist filter criteria fields
- Album, Artist, MediaFile, Folder, Tag, User, Library repositories
- `model/searchable.go` - SearchableRepository interface extension for library filtering
- `model/playlist.go` - Playlist track management method naming
- `model/tag.go` - Tag model field rename and repository interface update
- `model/metadata/persistent_ids.go` - Library-aware persistent ID generation

---

### FR1: Database Schema for User-Library Associations

**Problem**: The system lacks a mechanism to associate users with specific libraries, preventing per-user library access control.

**Requirements**:
- Create a junction table to associate users with libraries
- Define foreign key relationships to user and library tables with cascading deletes
- Populate initial data by granting all existing users access to the default library (ID 1)
- Library should track total playback duration
- Library should have a flag to indicate auto-assignment to new regular users
- Set the default library (ID 1) as the default for new users

**Acceptance**:
- When a user is deleted, their associated library access records are automatically removed (via CASCADE)
- When a library is deleted, associated user access records are automatically removed (via CASCADE)
- The `Library` struct shall track total playback duration
- The `Library` struct shall indicate whether to auto-assign to new users
- The default library (ID 1) shall be marked for auto-assignment to new users after migration

---

### FR2: Library Filtering for Album Repository

**Problem**: Album queries return all albums regardless of the requesting user's library access permissions.

**Requirements**:
- Modify album select queries to join with library information and apply user-based library filtering
- Extend the generic `SearchableRepository[T]` interface's `Search` method to accept variadic query options: `Search(q string, offset, size int, includeMissing bool, options ...QueryOptions) (T, error)`. This enables callers to pass library filtering options at query time. This interface change applies to all searchable repositories (Album, Artist, MediaFile)
- Apply library filtering to `CountAll`, `Get`, `GetAll`, and `Search` operations
- Admin users should bypass library filtering and see all albums
- Regular users should only see albums from libraries they have access to
- Users without any library access should receive empty results
- Add `library_id` as a supported filter parameter for the album repository
- Include library metadata (`LibraryPath`, `LibraryName`) in album query results for API responses

**Acceptance**:
- When a regular user queries albums, only albums from their accessible libraries are returned
- When an admin user queries albums, all albums are returned regardless of library associations
- When a user without library access queries albums, an empty result set is returned
- When filtering by `library_id`, only albums matching the specified library are returned
- Headless processes (no user context) shall bypass library filtering and see all albums
- The `Album` struct shall include `LibraryPath` and `LibraryName` fields

---

### FR3: Library Filtering for Artist Repository with Per-Library Statistics

**Problem**: Artist queries return all artists regardless of the requesting user's library access permissions, and artist statistics are stored globally rather than per-library.

**Requirements**:
- Create a junction table for library-artist associations with per-library statistics
- Migrate existing global artist statistics to per-library storage
- Remove global statistics from the artist table after migration
- Modify artist select queries to aggregate statistics across accessible libraries
- Apply library filtering through the library-artist junction
- Update `RefreshStats` to calculate and store per-library statistics
- Admin users should bypass library filtering and see all artists
- Regular users should only see artists from libraries they have access to
- Users without any library access should receive empty results
- The `GetIndex` method signature must accept library IDs as a required parameter: `GetIndex(includeMissing bool, libraryIds []int, roles ...Role) (ArtistIndexes, error)`. When called with an empty library ID slice, return an empty result
- Add `library_id` as a supported filter parameter for the artist repository

**Acceptance**:
- When a regular user queries artists, only artists from their accessible libraries are returned
- When an admin user queries artists, all artists are returned with aggregated statistics
- When a user without library access queries artists, an empty result set is returned
- When `Exists` is called for an artist, it respects library access (returns false if user cannot access the artist's library)
- When `GetIndex` is called with valid library IDs, artists are grouped by index key from those libraries
- When `GetIndex` is called with an empty library ID slice, an empty result is returned
- When `Search` is called, only artists from accessible libraries are included in results
- When statistics are refreshed, per-library counts are stored
- Headless processes (no user context) shall bypass library filtering and see all artists

---

### FR4: Library Filtering for Media File Repository

**Problem**: Media file queries return all files regardless of the requesting user's library access permissions.

**Requirements**:
- Modify media file select queries to join with library information and apply user-based library filtering
- Apply library filtering to `CountAll`, `Get`, `GetAll`, and `Search` operations
- Admin users should bypass library filtering and see all media files
- Regular users should only see media files from libraries they have access to
- Users without any library access should receive empty results
- Add `library_id` as a supported filter parameter for the media file repository
- Include library metadata (`LibraryName`) in media file query results for API responses

**Acceptance**:
- When a regular user queries media files, only files from their accessible libraries are returned
- When an admin user queries media files, all files are returned regardless of library associations
- When a user without library access queries media files, an empty result set is returned
- When filtering by `library_id`, only media files matching the specified library are returned
- Headless processes (no user context) shall bypass library filtering and see all media files
- The `MediaFile` struct shall include `LibraryName` field

---

### FR5: Library Filtering for Folder Repository

**Problem**: Folder queries return all folders regardless of the requesting user's library access permissions.

**Requirements**:
- Modify folder select queries to apply user-based library filtering through the existing library join
- Apply library filtering to `GetAll` and `CountAll` operations
- Admin users should bypass library filtering and see all folders
- Regular users should only see folders from libraries they have access to
- Users without any library access should receive empty results
- Provide functionality to create folders with proper attributes including library association
- Provide functionality to generate unique folder IDs based on library and path

**Acceptance**:
- When a regular user queries folders, only folders from their accessible libraries are returned
- When an admin user queries folders, all folders are returned regardless of library associations
- When a user without library access queries folders, an empty result set is returned
- When creating a new folder, it shall have: unique ID, library association, path, name, parent folder reference, and timestamps
- When creating the root folder (path = "."), `ParentID` shall be empty string

---

### FR6: Library Filtering for Tag/Genre Repositories

**Problem**: Tag and genre queries return global counts regardless of the requesting user's library access, and per-library statistics are not tracked.

**Requirements**:
- Create a junction table to associate tags with libraries, tracking per-library counts
- Define foreign key relationships with cascading deletes
- Migrate existing global tag statistics to per-library storage for the default library
- Remove global count columns from the tag table
- Rename the `Tag` struct's `MediaFileCount` field to `SongCount` (retaining the JSON tag `"songCount"`) for consistency with the naming convention used by other domain models (e.g., `Artist.SongCount`, `Playlist.SongCount`). Per-library tag statistics (`AlbumCount`, `SongCount`) must be aggregated from the `library_tag` junction table when querying across multiple libraries
- Update the `TagRepository.Add` method signature to require a library ID parameter: `Add(libraryID int, tags ...Tag) error`. This enables per-library tag association at insertion time
- Modify tag/genre queries to aggregate counts across accessible libraries
- Apply library filtering through the library-tag junction
- Add `library_id` as a supported filter parameter for tag repositories

**Acceptance**:
- When a regular user queries genres/tags, only aggregated counts from their accessible libraries are shown
- When an admin user queries genres/tags, aggregated counts from all libraries are shown
- When a user without library access queries genres/tags, counts are zero or results are empty
- When `UpdateCounts` is called, per-library statistics are updated

---

### FR7: User-Library Association Management

**Problem**: There is no mechanism to programmatically manage which libraries a user can access.

**Requirements**:
- Add `Libraries` field to the User model to hold associated library information
- Provide capability to retrieve libraries accessible by a user
- Provide capability to set a user's library associations
- When setting library associations, remove all existing associations and insert new ones
- Populate the `Libraries` field when retrieving users via `Get`, `GetAll`, and `FindByUsername`
- Provide capability to query users with access to a specific library

**Acceptance**:
- When retrieving user libraries, all accessible libraries are returned with full library details (empty list if none)
- When setting user libraries with library IDs, only those libraries are associated with the user
- When setting user libraries with an empty list, all library associations are removed
- When a user is retrieved via `Get`, the `Libraries` field is populated with associated libraries (with full `Library` details including `ID`, `Name`, `Path`)
- When users are retrieved via `GetAll`, each user's `Libraries` field is populated
- When a user is found via `FindByUsername`, the `Libraries` field is populated

---

### FR8: Admin User Auto-Assignment to Libraries

**Problem**: When new libraries are created or users are promoted to admin, they need manual library assignment.

**Requirements**:
- When a new admin user is created, automatically assign all existing libraries to them
- When an existing user is promoted to admin, automatically assign all existing libraries to them
- When a new library is created, automatically assign it to all existing admin users
- When a new regular user is created, automatically assign libraries marked as `default_new_users=true`

**Acceptance**:
- When an admin user is created, they have access to all existing libraries without manual assignment
- When a regular user is promoted to admin, they gain access to all libraries
- When a library is created, all admin users automatically gain access to it
- When a regular user is created, they are assigned to libraries where `default_new_users=true`

---

### FR9: Library Management Operations

**Problem**: Libraries need proper CRUD operations with validation and auto-assignment behavior.

**Requirements**:
- Provide library create/update functionality with upsert behavior
- Provide library delete functionality
- Prevent deletion of the default library (ID 1) with a validation error
- Only admin users should be able to delete libraries
- When a library is deleted, clear the cached path for that library
- Define a validation error type for library operations that violate business rules

**Acceptance**:
- When saving a library with `ID = 0`, a new library is inserted with an auto-assigned ID and the struct is updated with the assigned ID
- When saving a library with a non-zero ID and the record exists, the existing record is updated
- When saving a library with a non-zero ID and the record does not exist, a new record is inserted with the specified ID
- When a library is created or updated, the `CreatedAt` and `UpdatedAt` timestamps are properly set
- When refreshing library statistics, the library's statistics are recalculated from the database and `UpdatedAt` is updated
- When attempting to delete library ID 1, a validation error is returned (distinct from authorization errors)
- When a non-admin user attempts to delete a library, an authorization error is returned
- When a library is successfully deleted, its cache entry is removed

---

### FR10: Artist Sorting Performance Improvement

**Problem**: When searching for artists with an empty query string, sorting by `rowid` causes performance issues with certain sync clients.

**Requirements**:
- Change the default sort order for empty search queries from `rowid` to `id`

**Acceptance**:
- When performing an empty search query for artists, results are sorted by `id` instead of `rowid`
- Sync clients experience improved performance when fetching artist lists with empty queries

---

### FR11: Tag Statistics Foreign Key Constraint Fix

**Problem**: When updating tag counts, a foreign key constraint error occurs if albums or media files contain tag IDs in their JSON that do not exist in the tag table.

**Requirements**:
- Modify the `UpdateCounts` SQL query to join with the tag table to ensure only valid tag IDs are processed
- Handle cases where albums or media files have tag IDs in their JSON that don't have corresponding records in the tag table

**Acceptance**:
- When `UpdateCounts` is called with albums containing non-existent tag IDs in JSON, no foreign key error occurs
- When `UpdateCounts` is called with media files containing non-existent tag IDs in JSON, no foreign key error occurs
- Only tags that exist in the tag table have their counts updated

---

### FR12: User Library Access Check

**Problem**: There is no utility method to check if a user has access to a specific library.

**Requirements**:
- Add `HasLibraryAccess(libraryID int) bool` method to the User model
- Admin users should always return true regardless of their library associations
- Regular users should return true only if the library ID is in their `Libraries` list
- Users with no libraries assigned should return false for any library ID

**Acceptance**:
- When an admin user calls `HasLibraryAccess`, `true` is returned for any library ID (including negative or zero values)
- When an admin user with no libraries assigned calls `HasLibraryAccess`, `true` is still returned
- When a regular user with library access calls `HasLibraryAccess` for an accessible library, `true` is returned
- When a regular user calls `HasLibraryAccess` for an inaccessible library, `false` is returned
- When a regular user with no libraries (nil or empty) calls `HasLibraryAccess`, `false` is returned for any library ID
- The method shall handle duplicate library IDs in the `Libraries` field correctly

---

### FR13: Library ID Filter in Smart Playlist Criteria

**Problem**: Smart playlists and search queries cannot filter content by library.

**Requirements**:
- Smart playlist criteria shall support `library_id` as a numeric filter field
- This field shall filter media files by their `library_id` database column (consistent with the repository filter parameter added in FR4)

**Acceptance**:
- When filtering by `library_id` in smart playlists, numeric operators (`is`, `isNot`) generate correct SQL conditions
- When filtering by `library_id` list, list operators generate correct SQL conditions
- The generated SQL shall reference the media file table's `library_id` column

---

### FR14: Playlist Model Improvements

**Problem**: The Playlist model's method for adding tracks by their media file IDs has a generic name (`AddTracks`) that does not clearly convey it accepts media file IDs rather than full track objects. With multi-library support, method naming needs to be more precise about what identifiers are being used.

**Requirements**:
- Rename the existing `AddTracks` method to `AddMediaFilesByID` to clarify that it accepts a slice of media file ID strings
- The method signature remains `AddMediaFilesByID(mediaFileIds []string)` and the behavior is unchanged (appends tracks with sequential positions)

**Acceptance**:
- The `Playlist` struct shall have a method `AddMediaFilesByID(mediaFileIds []string)` that adds tracks by their media file IDs
- All callers that previously used `AddTracks` shall use `AddMediaFilesByID` instead

---

### FR15: Library-Aware Persistent ID Generation

**Problem**: When multiple libraries exist, the same media file path could exist in different libraries. Persistent IDs must incorporate library identity for non-default libraries to ensure uniqueness across libraries.

**Requirements**:
- The persistent ID generation function shall accept a `prependLibId bool` parameter controlling whether the library ID is incorporated into the hash input
- Define a named type alias for the function signature: `type getPIDFunc = func(mf model.MediaFile, md Metadata, spec string, prependLibId bool) string`
- When `prependLibId` is true and the media file belongs to a non-default library (ID != 1), the library ID shall be prepended to the hash input in the format `{libraryID}\{hashInput}`
- Legacy ID functions (`legacyTrackID`, `legacyAlbumID`) shall also accept the `prependLibId` parameter with the same prepend behavior for non-default libraries

**Acceptance**:
- The `getPIDFunc` type alias is defined and used as the return type of `createGetPID`
- IDs for the default library (ID 1) remain unchanged regardless of the `prependLibId` value
- IDs for non-default libraries with `prependLibId=true` differ from default library IDs due to the library ID prefix

---

## Interface Contracts (Required Names & Signatures)

This milestone's acceptance tests reference the following names/signatures; the
implementation must match them exactly (the prose requirements above leave the
exact interface shape unstated, so it is pinned here):

- **Validation sentinel**: `model` package must define
  `ErrValidation = errors.New("validation error")` (alongside the existing
  sentinels in `model/errors.go`).
- **User–library associations live on `model.UserRepository`** (called directly
  by graded tests such as `persistence/artist_repository_test.go`), and take
  **no `context` parameter** at this milestone:
  - `GetUserLibraries(userID string) (Libraries, error)`
  - `SetUserLibraries(userID string, libraryIDs []int) error`

  `model.LibraryRepository` does **not** carry these methods here — it exposes
  only `GetUsersWithLibraryAccess(libraryID int) (Users, error)`.
- **Library-scoped query filtering** helper on the shared SQL repository base:
  `func (r sqlRepository) applyLibraryFilter(sq SelectBuilder, tableName ...string) SelectBuilder`.
- **Per-library artist stats** are serialized as JSON in the `library_artist`
  table (`stats` column); the persistence mapping struct `dbArtist` carries it
  as a `LibraryStatsJSON string` field.
- **Database migration**: add the multi-library schema as a new goose migration.
  Give it a version (timestamp prefix) **after** every migration already in the
  tree, and **uniquely-named** up/down functions (e.g. suffixed with the feature
  name), so it never redeclares the goose-registered functions of an existing
  migration. (Naming guidance only — the exact timestamp is not graded; the
  collision that must be avoided is a duplicate `up*/down*` function name.)

# Environment Dependency Changes (relative to Base Env)

## Go Packages
- ginkgo v2.23.4 added (Ginkgo CLI for spec-level test reporting)

## Environment Variables
- GOFLAGS set to "-tags=netgo"
