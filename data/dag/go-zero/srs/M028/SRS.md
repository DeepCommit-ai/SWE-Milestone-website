# Software Requirements Specification: Miscellaneous Fixes and Improvements

## Overview

This milestone addresses various fixes, improvements, and enhancements across multiple modules of the go-zero framework:

1. **FR1**: Fix retry mechanism to support ignoring specified errors
2. **FR2**: Fix validator storage to prevent panic with different concrete types
3. **FR3**: Fix file reading operations for empty files and edge cases
4. **FR4**: Fix Windows platform compatibility for shutdown handling
5. **FR5**: Fix log middleware application for not-found handlers
6. **FR6**: Fix SlowThreshold configuration not taking effect in gRPC stat interceptor
7. **FR7**: Fix gateway event handler to properly forward gRPC metadata headers
8. **FR8**: Optimize Md5Hex encoding performance
9. **FR9**: Fix MySQL DSN parsing condition in SQL manager
10. **FR10**: Add backward-compatible deprecated functions for migration
11. **FR11**: Standardize time format usage with Go standard library constants
12. **FR12**: Initialize slice variables with proper capacity for performance
13. **FR13**: Update mock library from golang/mock to uber-go/mock
14. **FR14**: Move dbtest package to public API location
15. **FR15**: Fix typos and grammar in comments and documentation
16. **FR16**: Fix unmarshaler type assertion panic for Duration and Unmarshaler fields

**Affected Modules**:
- `core/fx` (retry functionality)
- `rest/httpx` (request validation)
- `core/filex` (file operations)
- `core/proc` (process shutdown)
- `rest/engine` (HTTP engine)
- `zrpc/internal/serverinterceptors` (gRPC interceptors)
- `gateway/internal` (gRPC-HTTP gateway)
- `core/hash` (hashing utilities)
- `core/stores/sqlx` (SQL database)
- `core/stringx`, `core/syncx` (utility packages)
- `core/breaker`, `core/logx`, `core/stat` (time formatting)
- `core/mapping` (unmarshaler type handling)
- Various packages (slice initialization, mock updates)

---

## Requirements

### FR1: Retry Mechanism Error Ignore Support

**Problem**: The retry mechanism does not support ignoring specific errors. When certain expected errors occur (e.g., "already exists" or "no rows affected"), the retry loop continues unnecessarily, wasting resources and time.

**Requirements**:
- Add capability to specify a list of errors that should be treated as successful outcomes
- When a retry operation returns an error matching any ignored error, the retry should stop and return nil (success)
- The ignored errors should be checked using Go's `errors.Is()` for proper error chain matching
- Provide an option function to configure the list of errors to ignore

**Acceptance**:
- When `DoWithRetry` is called with `WithIgnoreErrors` option containing a list of errors, and the function returns one of those errors, the retry returns nil instead of the error
- When the function returns an error not in the ignore list, the retry continues as normal
- Error matching uses `errors.Is()` to support wrapped errors

---

### FR2: Validator Storage Panic Fix

**Problem**: The HTTP request validator storage causes a panic when setting validators of different concrete types. The panic message is: `sync/atomic: store of inconsistently typed value into Value`.

**Requirements**:
- Fix the validator storage mechanism to allow different concrete types implementing the `Validator` interface to be set without panicking
- The fix should maintain thread-safety for concurrent access to the validator

**Acceptance**:
- When `SetValidator` is called multiple times with different concrete types implementing `Validator`, no panic occurs
- Concurrent calls to `SetValidator` and `Parse` (which reads the validator) remain thread-safe

---

### FR3: File Reading Edge Case Handling

**Problem**: The file reading utilities (`FirstLine` and `LastLine`) do not handle edge cases properly, causing issues when:
- Reading empty files (potential infinite loop or incorrect return)
- Reading files without newline characters
- Reading files where the content is shorter than the internal buffer size

**Requirements**:
- `FirstLine` should return an empty string for empty files without errors
- `FirstLine` should return the entire content when the file has no newline character
- `LastLine` should return an empty string for empty files without errors
- `LastLine` should properly handle files where content is shorter than buffer size
- Both functions should properly handle EOF conditions

**Acceptance**:
- When `FirstLine` is called on an empty file, it returns `""` with no error
- When `FirstLine` is called on a file with no newline, it returns the entire content
- When `LastLine` is called on an empty file, it returns `""` with no error
- When `LastLine` is called on a file with content shorter than buffer size, it returns correct content

---

### FR4: Windows Platform Shutdown Compatibility

**Problem**: The shutdown handling code fails to compile on Windows due to missing type definitions and function signature mismatches in the polyfill file.

**Requirements**:
- Define `ShutdownConf` struct type in the Windows polyfill file
- Ensure `Setup` function signature matches between Unix and Windows implementations
- Maintain API compatibility so code using shutdown functionality compiles on both platforms

**Acceptance**:
- When compiling go-zero on Windows, no compilation errors occur related to shutdown handling
- The `ShutdownConf` type and `Setup` function are available on Windows (as no-ops)

---

### FR5: Log Middleware Conditional Application

**Problem**: The not-found handler always applies the log middleware regardless of the server's log middleware configuration setting.

**Requirements**:
- The log middleware should only be added to the not-found handler when logging is enabled in the server configuration
- When `Middlewares.Log` is set to false, the not-found handler should not include logging

**Acceptance**:
- When a server is configured with `Middlewares.Log: false`, requests to non-existent endpoints do not produce log entries from the log middleware
- When a server is configured with `Middlewares.Log: true` (default), requests to non-existent endpoints are logged

---

### FR6: gRPC SlowThreshold Configuration Fix

**Problem**: The `SlowThreshold` configuration in the gRPC stat interceptor is not taking effect. The slow call detection uses a global threshold variable instead of the configured per-service threshold.

**Requirements**:
- Fix the slow call detection to use the configured `SlowThreshold` value when specified
- When no threshold is configured (zero value), no slow call warnings should be generated based on the global default
- The `isSlow` function should only consider a call slow when a threshold is explicitly configured and exceeded

**Acceptance**:
- When `StatConf.SlowThreshold` is set to a specific duration, calls exceeding that duration are logged as slow
- When `StatConf.SlowThreshold` is not set (zero), no calls are flagged as slow based on the global default threshold

---

### FR7: Gateway gRPC Metadata Header Forwarding

**Problem**: The gRPC-HTTP gateway does not properly forward gRPC metadata as HTTP headers. Headers from gRPC metadata are forwarded without the standard prefix, which may conflict with regular HTTP headers and doesn't follow gRPC-Web conventions.

**Requirements**:
- Define prefix constants for mapping gRPC metadata to HTTP headers
- Implement event handler methods for receiving headers and trailers from gRPC and forwarding them as HTTP headers

**Acceptance**:
- Define constants: `MetadataHeaderPrefix = "Grpc-Metadata-"` and `MetadataTrailerPrefix = "Grpc-Trailer-"`
- `OnReceiveHeaders` must check if writer is `http.ResponseWriter` before adding headers
- Use `Header().Add()` (not `Set()`) to support multiple values for same metadata key
- Apply same pattern for `OnReceiveTrailers` with trailer prefix
- Multiple values for the same metadata key are all added to the response

---

### FR8: Md5Hex Performance Optimization

**Problem**: The `Md5Hex` function uses `fmt.Sprintf("%x", ...)` for hex encoding, which is slower than specialized hex encoding functions.

**Requirements**:
- Optimize the `Md5Hex` function to use a more performant hex encoding method
- Maintain the same output format (lowercase hexadecimal string)

**Acceptance**:
- When `Md5Hex` is called, it returns the same result as before (lowercase hex string of MD5 hash)
- The implementation uses a more performant encoding method than `fmt.Sprintf`

---

### FR9: MySQL DSN Parsing Condition Fix

**Problem**: The SQL connection manager has an inverted condition that causes MySQL DSN parsing to execute for non-MySQL drivers instead of MySQL drivers.

**Requirements**:
- Fix the condition to correctly identify MySQL connections
- MySQL-specific DSN parsing and metrics collection should only occur for MySQL connections

**Acceptance**:
- When using a MySQL driver, the DSN is parsed for metrics collection
- When using a non-MySQL driver (e.g., PostgreSQL), MySQL-specific DSN parsing is not attempted

---

### FR10: Backward-Compatible Deprecated Functions

**Problem**: Users migrating from older versions may depend on functions that have been removed or replaced with standard library equivalents.

**Requirements**:
- Add `Contains` function to `stringx` package that wraps `slices.Contains`, marked as deprecated
- Add `Once` function to `syncx` package that wraps `sync.OnceFunc`, marked as deprecated
- Include deprecation notices directing users to use standard library functions

**Acceptance**:
- When calling `stringx.Contains(slice, str)`, it returns the same result as `slices.Contains(slice, str)`
- When calling `syncx.Once(fn)`, it returns a function that behaves like `sync.OnceFunc(fn)`
- Both functions have deprecation comments recommending the standard library alternatives

---

### FR11: Standardized Time Format Constants

**Problem**: The codebase uses custom time format constants like `"2006-01-02"` and `"15:04:05"` instead of the standard library constants `time.DateOnly` and `time.TimeOnly`.

**Requirements**:
- Replace custom time format strings with Go standard library constants where applicable
- Use `time.DateOnly` for date-only formats
- Use `time.TimeOnly` for time-only formats
- Use `time.DateTime` for datetime formats
- Remove redundant custom format constant declarations

**Acceptance**:
- When log rotation calculates outdated files, it uses `time.DateOnly` for date formatting
- When circuit breaker logs error reasons, it uses `time.TimeOnly` for time formatting
- When alert reports are generated, the timestamp uses `time.DateTime` formatting

---

### FR12: Slice Initialization with Capacity

**Problem**: Several slice variables are initialized without specifying capacity, causing unnecessary memory reallocations when items are appended.

**Requirements**:
- Initialize slices with known or estimable capacity using `make([]T, 0, capacity)`
- Apply this optimization where the slice size can be determined or estimated beforehand
- Affected areas include: error reason collection, stats collection, address building, route collection

**Acceptance**:
- When building a list of error reasons, the slice is pre-allocated with appropriate capacity
- When building resolver addresses, the slice is pre-allocated based on endpoint count
- When collecting routes, the slice is pre-allocated based on expected route count

---

### FR13: Mock Library Migration

**Problem**: The codebase uses the deprecated `github.com/golang/mock` library. This library has been moved to `go.uber.org/mock`.

**Requirements**:
- Update mock file imports from `github.com/golang/mock/gomock` to `go.uber.org/mock/gomock`
- Regenerate mock files using the new mockgen tool
- Update go.mod dependencies accordingly

**Acceptance**:
- When running tests that use mock interfaces, no import errors occur
- Mock files import from `go.uber.org/mock/gomock`

---

### FR14: Database Test Utilities Location

**Problem**: The `dbtest` package is located in the `internal` directory, making it inaccessible to external packages that may need database testing utilities.

**Requirements**:
- Move the `dbtest` package from `internal/dbtest` to `core/stores/dbtest`
- Update all internal import references to use the new location
- The package becomes part of the public API

**Acceptance**:
- When importing `github.com/zeromicro/go-zero/core/stores/dbtest`, the package is accessible
- Existing internal tests continue to work with the updated import path

---

### FR15: Documentation and Comment Corrections

**Problem**: Various typos and grammatical errors exist in comments and documentation throughout the codebase.

**Requirements**:
- Fix "opton" to "option" in builder comments
- Fix "formated" to "formatted" in bulk inserter comments
- Fix "base" to "based" in various function comments (Distinct, Walk, Get, SizeLimitRotateRule, Unstable, CreateHttpHandler)
- Fix "create" to "creates" in New function comment
- Fix "TimoutHandler" to "TimeoutHandler" in timeout handler comment
- Fix "underline" to "underlying" in Header method comment
- Fix "cancelation" to "cancellation" in context handling comment
- Fix "queue" to "queues" in shutdown comment

**Acceptance**:
- When viewing the documentation for affected functions, comments are grammatically correct
- No typos remain in the corrected comment areas

---

### FR16: Unmarshaler Type Assertion Error Handling

**Problem**: The unmarshaler in `core/mapping` performs unsafe type assertions when handling Duration fields and fields implementing `json.Unmarshaler`. When the input map contains a non-string value (e.g., `json.Number`) for these fields, the code panics instead of returning a proper error.

**Requirements**:
- Use a safe type conversion helper for non-string values that returns descriptive errors instead of panicking
- When a Duration field receives a non-string value, return an error instead of panicking
- When a field implementing `json.Unmarshaler` receives a non-string value, return an error instead of panicking

**Acceptance**:
- `Unmarshaler.processFieldNotFromString()` must use a safe type conversion helper for Duration and Unmarshaler fields
- When a Duration field receives `json.Number` or other non-string type, the error message must contain `"expect string"`
- When a field implementing `json.Unmarshaler` receives `json.Number` or other non-string type, an error is returned (not panic)

---

# Environment Dependency Changes (relative to Base Env)

## Go Version
- Go upgraded to 1.21.13 (from 1.19.13 in base)

## Environment Variables
- GOROOT set to /usr/local/go
- PATH prepended with /usr/local/go/bin
