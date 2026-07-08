# Software Requirements Specification: HTTP Request/Response Improvements

## Overview

This milestone addresses several enhancements and fixes for HTTP request parsing, response handling, CORS configuration, streaming support, and memory usage optimization in the go-zero framework's REST module.

### Summary of Requirements

1. **FR1**: Support array fields in HTTP form data parsing
2. **FR2**: Support JSON array request bodies
3. **FR3**: Add HTTP streaming response capability
4. **FR4**: Support customizable CORS headers
5. **FR5**: Fix HTML character escaping in JSON responses
6. **FR6**: Reduce memory usage in detailed request logging
7. **FR7**: Support anonymous fields in HTTP client marshaling
8. **FR8**: Bypass timeout handling for Server-Sent Events (SSE)
9. **FR9**: Fix duplicate text in slow call log messages

### Affected Modules

- `rest/httpx` (request parsing and response handling)
- `rest/internal/cors` (CORS configuration)
- `rest/handler` (log and timeout handlers)
- `rest/server` (server configuration options)
- `core/mapping` (marshaler/unmarshaler utilities)

**Scope Constraint**: Only modify files within the affected modules listed above. Do not modify files in other packages such as `core/logx`, `core/stores`, `core/collection`, etc. Preserve existing API signatures and error message formats for backward compatibility.

---

## Requirements

### FR1: Support Array Fields in HTTP Form Data Parsing

**Problem**: Form data parameters with multiple values (e.g., `?status=active&status=pending`) cannot be parsed into slice fields in request DTOs.

**Requirements**:
- When parsing form data, collect all values for parameters that appear multiple times in the query string
- Support mapping multi-value form parameters to slice fields (e.g., `[]string`, `[]int`)
- When a form parameter has a single value and the target field is not a slice, extract the single value for assignment
- Filter out empty string values from the collected array before mapping
- Provide a function to collect all form parameter values as multi-value maps
- Configure the unmarshaler to automatically extract single values when target is not a slice

**Acceptance**:
- When a request contains `?name=hello&name=world`, parsing into a struct with field `Name []string` results in `[]string{"hello", "world"}`
- When a request contains `?age=18`, parsing into a struct with field `Age int` correctly assigns the integer value 18
- When a request contains `?name=&name=valid`, only non-empty values are collected

---

### FR2: Support JSON Array Request Bodies

**Problem**: When the request body contains a JSON array (e.g., `[{"name":"item1"}, {"name":"item2"}]`), the parser fails because it attempts to parse path, form, and header parameters before the JSON body.

**Requirements**:
- Detect when the target type for request parsing is a slice or array
- When the target is a slice/array type, skip parsing path parameters, form parameters, and headers
- Proceed directly to JSON body parsing for array-type targets

**Acceptance**:
- When a POST request with body `[{"name":"kevin", "age": 18}]` is parsed into a `[]struct{Name string; Age int}`, parsing succeeds and populates the slice
- When a POST request with query params and an array body targets a slice type, query params are ignored and the body is parsed correctly

---

### FR3: Add HTTP Streaming Response Capability

**Problem**: There is no built-in support for streaming HTTP responses where data is sent incrementally to the client.

**Requirements**:
- Provide a streaming function that repeatedly calls a user-provided writer function until it signals completion
- Support context cancellation to allow graceful termination of streaming
- Flush the response buffer after each write operation if the ResponseWriter supports flushing
- Continue the streaming loop until either the context is cancelled or the writer function returns false

**Acceptance**:
- When streaming data via the new function, each chunk is flushed immediately to the client
- When the context is cancelled, the streaming loop exits promptly
- When the writer function returns false, the streaming loop terminates

---

### FR4: Support Customizable CORS Headers

**Problem**: The existing CORS configuration only allows specifying allowed origins but not additional allowed headers.

**Requirements**:
- Add a server option to enable CORS with custom allowed headers
- The option should add specified headers to the `Access-Control-Allow-Headers` response header
- Support specifying multiple custom headers in a single call

**Acceptance**:
- An exported function `AddAllowHeaders(header http.Header, headers ...string)` must be added to `rest/internal/cors/handlers.go` that appends the given header names to the `Access-Control-Allow-Headers` response header
- When configuring a server with custom CORS headers like `["X-Custom-Header", "Authorization"]`, those headers appear in the `Access-Control-Allow-Headers` response
- When an OPTIONS preflight request is made, the response includes the configured custom headers

---

### FR5: Fix HTML Character Escaping in JSON Responses

**Problem**: JSON responses escape HTML-sensitive characters (`&`, `<`, `>`) as Unicode escape sequences (`\u0026`, `\u003c`, `\u003e`), which is undesirable for API responses containing URLs or HTML content.

**Requirements**:
- Extract the JSON marshaling logic into an internal helper function `doMarshalJson(v any) ([]byte, error)` that uses `json.NewEncoder` with `SetEscapeHTML(false)` and trims the trailing newline
- Use `doMarshalJson` in the existing response-writing functions to disable HTML escaping
- Maintain standard JSON encoding behavior for all other aspects

**Acceptance**:
- When a response contains a URL like `https://example.com?a=1&b=2`, the JSON output preserves the `&` character literally instead of encoding it as `\u0026`
- When a response contains HTML characters like `<div>`, they are preserved literally in the JSON output

---

### FR6: Reduce Memory Usage in Detailed Request Logging

**Problem**: The detailed log handler duplicates the entire request body for logging purposes, causing excessive memory usage for large POST requests.

**Requirements**:
- Define a constant `limitDetailedBodyBytes = 4096` for the body size cap
- Limit the amount of request body data duplicated for detailed logging to `limitDetailedBodyBytes` bytes
- Ensure the request handler still processes the complete request body normally

**Acceptance**:
- When a request with a body larger than 4KB is processed with detailed logging enabled, the log output is limited in size
- When a large request body is received, memory usage for logging remains bounded regardless of body size

---

### FR7: Support Anonymous Fields in HTTP Client Marshaling

**Problem**: When using the HTTP client to make requests with structs containing anonymous (embedded) fields, the fields from anonymous structs are not properly marshaled into their respective tag categories (headers, JSON body, etc.).

**Requirements**:
- When marshaling a struct for HTTP client requests, recursively process anonymous (embedded) fields
- Collect tagged fields from anonymous structs and merge them with the parent struct's fields by tag category
- Preserve the tag-based organization (e.g., `header`, `json`, `path`) for fields from anonymous structs
- The marshaler function must return a nested map grouped by tag categories
- Anonymous fields must be recursively processed and merged into the parent result

**Acceptance**:
- When marshaling a struct that embeds a `BaseHeader` struct with a `Token` field tagged `header:"token"`, the token is correctly placed in the header category
- When marshaling a struct with multiple anonymous fields containing different tag types, all fields are correctly categorized

---

### FR8: Bypass Timeout Handling for Server-Sent Events (SSE)

**Problem**: Server-Sent Events (SSE) connections are subject to request timeout handling, causing them to be terminated prematurely.

**Requirements**:
- Detect SSE requests by checking for the `Accept: text/event-stream` header
- Bypass the timeout handler for SSE requests, similar to WebSocket connections
- Allow SSE handlers to run without timeout constraints

**Acceptance**:
- When a request with header `Accept: text/event-stream` is received, it is not subject to timeout handling
- SSE connections remain open beyond the configured request timeout duration

---

### FR9: Fix Duplicate Text in Slow Call Log Messages

**Problem**: Slow call log messages contain duplicated text `slowcall(slowcall(...))` due to redundant formatting.

**Requirements**:
- Remove the redundant nested `slowcall()` wrapper in slow call log messages
- The log format should show `slowcall(duration)` only once

**Acceptance**:
- When a slow HTTP request is logged, the message contains `slowcall(500ms)` rather than `slowcall(slowcall(500ms))`

---

# Environment Dependency Changes (relative to Base Env)

## Go Runtime
- Go upgraded to 1.21.13

## Go Packages
- github.com/go-redis/redis/v8 added
- github.com/olekukonko/tablewriter v0.0.5 added

## Environment Variables
- PATH prepended with /usr/local/go/bin
