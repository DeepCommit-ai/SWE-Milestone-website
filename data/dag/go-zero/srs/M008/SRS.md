# Software Requirements Specification: REST File Server Support

## Overview

This specification defines requirements for adding file server functionality to the REST framework, enabling applications to serve static files directly through the REST server. The feature must support multiple file system types and handle various path configurations correctly.

**Requirements Summary:**
1. FR1: File Server Run Option
2. FR2: http.FileSystem Interface Support
3. FR3: Path Normalization and Trailing Slash Handling
4. FR4: File Existence Checking
5. FR5: Root Path Serving
6. FR6: embed.FS Path Normalization

**Affected Modules:**
- `rest` package (server configuration)
- `rest/internal/fileserver` package (file serving middleware)

---

## Requirements

### FR1: File Server Run Option

**Problem**: The REST framework does not provide a built-in mechanism for serving static files, requiring developers to implement custom handlers or use external middleware for common use cases like serving web assets.

**Requirements**:
- Provide a server run option that enables file serving for a specified URL path
- The option must accept a URL path prefix and a file system source
- File serving must integrate with the existing router middleware chain
- When a request matches a file in the configured path, serve the file; otherwise, pass the request to the next handler

**Acceptance**:
- The `rest` package must export a function `WithFileServer(path string, fs http.FileSystem) RunOption` that enables file serving for the specified path
- The file server middleware must be implemented in package `rest/internal/fileserver` with function `Middleware(upath string, fs http.FileSystem) func(http.HandlerFunc) http.HandlerFunc`
- The middleware implementation must be placed in source file `rest/internal/fileserver/filehandler.go`
- When a REST server is configured with the file server option at path "/assets" and a valid file system, GET requests to "/assets/example.txt" return the file contents
- When a request path does not match the configured prefix, the request is passed to the router for normal handling
- When a file does not exist at the requested path, the request is passed to the next handler

---

### FR2: http.FileSystem Interface Support

**Problem**: Serving files only from filesystem directories limits deployment flexibility—applications cannot serve embedded files or use other file system abstractions.

**Requirements**:
- Accept the standard `http.FileSystem` interface for file sources
- Support `http.Dir` for serving files from filesystem directories
- Support `http.FS` for serving files from `embed.FS` and other `fs.FS` implementations

**Acceptance**:
- When configured with `http.Dir("./static")`, files from the `./static` directory are served correctly
- When configured with `http.FS(embeddedFS)` where `embeddedFS` is an `embed.FS`, embedded files are served correctly
- When configured with `http.FS(fs.Sub(embeddedFS, "subdir"))`, files from the subdirectory are served correctly

---

### FR3: Path Normalization and Trailing Slash Handling

**Problem**: URL path configuration inconsistencies cause unexpected behavior—paths with and without trailing slashes should behave equivalently.

**Requirements**:
- Normalize configured paths to handle both trailing slash and non-trailing slash variants
- A configured path of "/assets" must serve requests to "/assets/file.txt"
- A configured path of "/assets/" must also serve requests to "/assets/file.txt"
- Path matching must use prefix matching with proper boundary handling

**Acceptance**:
- The middleware must implement helper functions `ensureTrailingSlash(upath string) string` and `ensureNoTrailingSlash(upath string) string` to normalize paths
- When the file server is configured with path "/static", requests to "/static/file.txt" are served
- When the file server is configured with path "/static/", requests to "/static/file.txt" are served
- When the file server is configured with path "/static", requests to "/staticother/file.txt" are NOT matched (proper boundary handling)

---

### FR4: File Existence Checking

**Problem**: When serving files from a path that may also have API routes, non-existent file requests should fall through to API handlers rather than returning file server 404 errors.

**Requirements**:
- Before serving a file, verify that the requested file exists in the file system
- If the file does not exist, pass the request to the next handler in the chain
- Cache file existence results to avoid repeated file system checks for the same paths
- Ensure thread-safe access to the cache for concurrent request handling

**Acceptance**:
- File existence verification must be performed before serving files
- File existence caching must be implemented with proper concurrency controls
- When requesting a file that exists, the file is served
- When requesting a path that does not exist as a file (e.g., "/assets/api/endpoint"), the request passes to the next handler
- When the file server is configured at root path "/", requests for non-existent files (e.g., "/ws" for websocket endpoints) pass to the next handler

---

### FR5: Root Path Serving

**Problem**: Configuring the file server at the root path "/" requires special handling to avoid interfering with other routes.

**Requirements**:
- Support configuring the file server at the root path "/"
- When configured at root, serve files that exist and pass through requests for non-existent paths
- Properly handle the URL path stripping when the prefix is root

**Acceptance**:
- When the file server is configured with path "/" and the file system contains "example.txt", a GET request to "/example.txt" returns the file
- When the file server is configured with path "/" and "ws" does not exist as a file, a GET request to "/ws" passes to the next handler

---

### FR6: embed.FS Path Normalization

**Problem**: The `embed.FS` type does not perform the same path normalization as `http.Dir`, causing inconsistent behavior when serving index files or handling paths ending with slashes.

**Requirements**:
- Normalize request paths to match `http.Dir.Open` behavior before checking file existence
- When calling `fs.Open()` on `fs.FS` implementations (including `embed.FS`), paths must not start with "/" - strip the leading slash after applying `path.Clean`
- Handle empty paths by using "." to represent the current directory (required by `fs.FS` interface)
- Handle paths ending with "/" correctly (for directory index serving)
- Apply standard path normalization to ensure consistent path handling

**Acceptance**:
- Path normalization in the file checker must emulate `http.Dir.Open` behavior
- Empty paths after normalization must be properly handled to represent the current directory
- When an `embed.FS` contains "index.html" at root and the file server is configured, a request to "/" serves the index.html content
- When an `embed.FS` contains "subdir/index.html" and the file server is configured, a request to "/subdir/" serves the index.html content
- When requesting "/index.html" directly, the server returns a redirect to "/" (standard http.FileServer behavior)
- When requesting "/subdir/index.html" directly, the server returns a redirect to "/subdir/" (standard http.FileServer behavior)

---

# Environment Dependency Changes (relative to Base Env)

## Go Runtime
- Go upgraded from 1.19.13 to 1.21.13

## Go Packages
- github.com/go-redis/redis/v8 added

## Environment Variables
- GOMODCACHE set to /go/pkg/mod
