# Software Requirements Specification: Multi-Library Server APIs

## Overview

This milestone implements comprehensive multi-library support for Navidrome's server APIs, enabling users to work with multiple music libraries while respecting access permissions. The implementation spans both the native REST API and the Subsonic API protocol.

### Requirements Summary

1. **FR1**: Library Management Endpoints - Add native API endpoints for managing libraries and user-library associations
2. **FR2**: Multi-Library Filtering for Subsonic API - Apply library-based filtering to all relevant Subsonic API endpoints
3. **FR3**: Headless Library Access - Enable library-aware access for shares and external providers without user context
4. **FR4**: Search Performance Optimization - Optimize search3 endpoint performance when operating with multi-library filtering
5. **FR5**: Artist Search Library Filtering - Fix artist search to correctly filter by library through the artist-library junction table

### Affected Components

- Native API: Library management endpoints, user-library association endpoints, admin middleware
- Subsonic API: Browsing, album lists, starred items, random songs, genre songs, search endpoints
- Persistence layer: Repository library filtering, search functions, share repository, scrobble buffer
- Filter utilities: Library-aware query option builders

---

## Functional Requirements

### FR1: Library Management Endpoints

**Problem**: Administrators cannot manage libraries or user-library associations through the API. There is no programmatic way to view available libraries, assign libraries to users, or retrieve a user's library assignments.

**Requirements**:
- Provide a read-write REST endpoint for library resources accessible only to administrators
- Provide an endpoint to retrieve the list of libraries associated with a specific user
- Provide an endpoint to update the list of libraries associated with a specific user
- Return appropriate error responses for invalid user IDs, non-existent users, and validation failures
- Consolidate admin-only access control into a reusable middleware pattern
- All library management endpoints must require admin privileges and return HTTP 403 for non-admin users

**Acceptance**:
- When an admin user sends a GET request to the library endpoint, the response contains the list of all libraries
- When an admin user sends a GET request to `/api/user/{id}/library`, the response contains the user's associated libraries
- When an admin user sends a PUT request to `/api/user/{id}/library` with a JSON body in the format `{"libraryIds": [1, 2, 3]}`, the user's library associations are updated and the response contains the updated libraries
- When a non-admin user attempts to access library management endpoints, an HTTP 403 Forbidden response is returned
- When a request targets a non-existent user, an HTTP 404 Not Found response is returned
- When a request contains invalid library IDs, an HTTP 400 Bad Request response is returned
- The `UserRepository` must implement `GetUserLibraries(userID string) (model.Libraries, error)` to return the list of libraries associated with a user
- The `UserRepository` must implement `SetUserLibraries(userID string, libraryIDs []int) error` to replace all library associations for a user
- When an admin user is created or updated to admin status, the user is automatically assigned access to all existing libraries
- When a regular (non-admin) user is created, the user is assigned access to the default library (where `default_new_users` is true)
- When `SetUserLibraries` is called with an empty slice, all library associations for the user are removed
- The `User` model must include a `Libraries` field of type `model.Libraries` that is populated when retrieving user data

---

### FR2: Multi-Library Filtering for Subsonic API

**Problem**: Subsonic API endpoints return data from all libraries regardless of user permissions or the optional `musicFolderId` parameter. Users see content from libraries they should not have access to, and filtering by specific music folders does not work correctly.

**Requirements**:
- The `getMusicFolders` endpoint must return only libraries the authenticated user has access to
- The `getIndexes` and `getArtists` endpoints must support filtering artists by one or more `musicFolderId` parameters
- The `getAlbumList` and `getAlbumList2` endpoints must filter albums by the optional `musicFolderId` parameter
- The `getStarred` and `getStarred2` endpoints must filter starred artists, albums, and songs by the optional `musicFolderId` parameter
- The `getRandomSongs` endpoint must filter songs by the optional `musicFolderId` parameter
- The `getSongsByGenre` endpoint must filter songs by the optional `musicFolderId` parameter
- The `search2` and `search3` endpoints must filter results by the optional `musicFolderId` parameter
- When no `musicFolderId` is provided, endpoints must return results from all libraries the user has access to
- When a `musicFolderId` is provided that the user does not have access to, return an appropriate error response
- Validate all provided library IDs against the user's accessible libraries before processing

**Acceptance**:
- When a user calls `getMusicFolders`, only libraries assigned to that user are returned
- When a user calls `getIndexes` or `getArtists` with a `musicFolderId`, only artists from that library are returned
- When a user calls `getAlbumList2` with `musicFolderId=2`, only albums from library 2 are returned
- When a user calls `getStarred2` with `musicFolderId=1`, only starred items from library 1 are returned
- When a user calls `getRandomSongs` with `musicFolderId=3`, only songs from library 3 are returned
- When a user calls `getSongsByGenre` with `musicFolderId=2`, only songs from library 2 matching the genre are returned
- When a user calls `search3` with `musicFolderId=1`, only matching results from library 1 are returned
- When a user requests a `musicFolderId` they do not have access to, a data not found error is returned
- When no `musicFolderId` is specified, results from all user-accessible libraries are returned

---

### FR3: Headless Library Access

**Problem**: Shares and external data providers (scrobble services, external metadata agents) fail to access media data because they operate without a user context. The multi-library filtering logic blocks access when no user is present in the request context, causing SQL queries to return empty results or errors.

**User Report**:
```
When accessing shared content or when scrobble services process playback data,
the system fails to retrieve album and artist information. SQL ambiguity errors
occur when querying albums by ID, and participant data cannot be retrieved for
scrobble entries.
```

**Requirements**:
- Repository queries must work correctly when no user context is present (headless mode)
- When operating in headless mode, library filtering must be bypassed to allow access to all libraries
- Admin users must bypass library filtering to access all libraries
- SQL queries must use fully qualified column names to avoid ambiguity when joining with library tables
- The scrobble buffer repository must retrieve participant information without requiring user context manipulation
- Share repository must load album media without SQL ambiguity errors
- The `Tag` struct's `MediaFileCount` field must be renamed to `SongCount` (retaining the JSON tag `"songCount"`) for consistency with the naming convention used by other domain models (e.g., `Artist.SongCount`, `Playlist.SongCount`). Per-library tag statistics (`AlbumCount`, `SongCount`) must be aggregated from the `library_tag` junction table when querying across multiple libraries

**Acceptance**:
- When a share accesses album content, the albums are retrieved correctly without SQL errors
- When a scrobble service processes playback data, participant information is retrieved correctly, with the `MediaFile.Participants` field populated including artist role data
- When a headless process queries artists, all artists from all libraries are accessible, and individual artist retrieval via `Get(id)` works correctly
- When a headless process queries genres, all genres from all libraries are accessible and properly counted, with aggregated statistics from all libraries
- When a headless process queries tags, all tags from all libraries are accessible with properly aggregated `AlbumCount` and `SongCount` statistics (the `Tag.SongCount` field aggregates `media_file_count` values from `library_tag` across all accessible libraries)
- When an admin user queries any endpoint, results from all libraries are returned regardless of user-library assignments
- Repository operations with no user context do not produce SQL ambiguity errors
- The `applyLibraryFilter` method must accept an optional table name parameter to specify which table's `library_id` column to filter
- When `applyLibraryFilter` is called with no user context (headless mode), no library filtering is applied and all content is accessible
- When `applyLibraryFilter` is called for an admin user, no library filtering is applied
- When `applyLibraryFilter` is called for a regular user, library filtering is applied to restrict results to libraries the user has access to (as defined in the user_library table)
- Headless processes can apply explicit `library_id` filters in query options to restrict results to specific libraries
- The `ShareRepository` can be created with a `context.Background()` (no user context) and must function correctly for share operations
- When albums are queried with library table joins, the `id` column must be fully qualified as `album.id` to avoid SQL ambiguity

---

### FR4: Search Performance Optimization

**Problem**: The `search3` endpoint performs slowly when handling empty or short search queries in a multi-library environment. The search function uses inefficient ordering and includes unnecessary missing-item filtering parameters that complicate the query execution path.

**Requirements**:
- Search functions must use an efficient natural ordering when no search filter is applied
- The `search3` endpoint with an empty query must return results ordered by a performant column (rowid for tables, ID for grouped queries)
- The `SearchableRepository[T]` interface's `Search` method signature must be simplified to remove the `includeMissing` parameter, resulting in: `Search(q string, offset, size int, options ...QueryOptions) (T, error)`. Missing items should never be returned in search results
- Missing items must always be excluded from search results as a hardcoded behavior
- Artist search must use artist ID for natural ordering due to the GROUP BY clause in the query

**Acceptance**:
- When `search3` is called with an empty query, results are returned efficiently without full table scans
- When `search3` is called with library filtering, artists, albums, and songs are filtered correctly by the specified libraries
- Search results never include items marked as missing, as a hardcoded behavior in the search implementation
- The search response time for empty queries is acceptable for OpenSubsonic clients
- The `Search` method signature in searchable repositories shall be `Search(q string, offset, size int, options ...QueryOptions) (T, error)` — the `includeMissing` parameter is removed and missing items exclusion is hardcoded
- Artist search returns empty results when no matches are found
- Media file search returns empty results when no matches are found
- MBID search for media files returns empty results when the MBID is not found
- Text search operations are case-insensitive

---

### FR5: Artist Search Library Filtering

**Problem**: Artist search in the `search3` endpoint does not correctly filter results by library. The library filtering uses the wrong column reference, causing artists to be returned regardless of which library they belong to.

**Requirements**:
- Artist search must filter by library using the `library_artist` junction table
- The library filter for artist queries must reference `library_artist.library_id` rather than the base `library_id` column
- Artist role filtering must use the joined library_artist table for statistics lookup
- Search queries for albums and media files must continue to use direct `library_id` filtering

**Acceptance**:
- When a user searches for artists with a `musicFolderId` filter, only artists from that library are returned
- When a restricted user searches for an artist that exists only in an inaccessible library, no results are returned
- When an admin user searches for artists, results from all libraries are returned
- When searching by artist name or MBID, library restrictions are correctly applied
- The `roleFilter` function must validate roles against the list of valid roles (artist, albumartist, composer, conductor, lyricist, arranger, producer, director, engineer, mixer, remixer, djmixer, performer, maincredit) and return an invalid SQL expression for unrecognized roles
- Role filtering must verify that an artist has media file contributions in the specified role by checking the artist's per-library statistics in the `library_artist` junction table
- The `ArtistRepository.GetIndex` method must accept an optional variadic roles parameter to filter artists by one or more roles
- When `GetIndex` is called with role filters, only artists having any of the specified roles are returned
- When `GetIndex` is called with an empty library IDs slice, it returns nil (no results)
- The artist library filter must reference `library_artist.library_id` instead of the base `library_id` column when joining with the `library_artist` table
- Regular users without library access should receive empty results for artist GetAll, GetIndex, Search, and Exists operations
- After a user gains library access, artist operations should reflect the newly accessible artists
- Artists with a library association can be found by MBID search only if the user has access to that library

---

## Non-Functional Requirements

### Performance
- Search operations with empty queries must use indexed columns for ordering to avoid full table scans
- Parallel execution should be used for starred items retrieval (artists, albums, and songs fetched concurrently)

### Security
- Library management endpoints must be restricted to admin users only
- Users must not be able to access content from libraries they are not assigned to
- Library ID validation must prevent unauthorized access through parameter manipulation

### Compatibility
- All changes must maintain backward compatibility with existing Subsonic API clients
- The `musicFolderId` parameter must remain optional on all endpoints where it is currently optional


---

## Interface Contracts (Required Names & Signatures)

This milestone's acceptance tests reference the following names/signatures; the
implementation must match them exactly (the prose requirements above leave the
exact interface shape unstated, so it is pinned here):

- **Native API router constructor** gains the library service dependency:
  `func New(ds model.DataStore, share core.Share, playlists core.Playlists, insights metrics.Insights, libraryService core.Library) *Router`
  (in `server/nativeapi`).
- **Subsonic music-folder selection helper** (in `server/subsonic`):
  `func selectedMusicFolderIds(r *http.Request, required bool) ([]int, error)` —
  resolves the library/music-folder selection for the current request.

# Environment Dependency Changes (relative to Base Env)

## Go Packages
- ginkgo v2.23.4 added (CLI tool for Ginkgo test framework)
