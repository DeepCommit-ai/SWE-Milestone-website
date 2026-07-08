# Software Requirements Specification: SSE Routes Support with Timeout Handling

## Overview

This specification defines requirements for adding Server-Sent Events (SSE) support to the go-zero REST framework. The feature introduces a route option for declaring SSE endpoints, automatic header configuration, and proper handling of write timeout conflicts that occur when SSE connections require indefinite keep-alive behavior.

### Requirements Summary

1. **FR1**: Provide a route option to mark SSE endpoints
2. **FR2**: Automatically set SSE-appropriate HTTP headers for SSE routes
3. **FR3**: Clear write deadlines on SSE connections to prevent timeout conflicts
4. **FR4**: Support response writer unwrapping for deadline control
5. **FR5**: Handle timeout configuration properly when routes specify zero timeout
6. **FR6**: Provide configurable slow request threshold for SSE endpoints

### Affected Modules

- REST server route configuration
- HTTP response writer handling
- Timeout middleware and network timeout configuration
- Request logging handler

---

## Requirements

### FR1: SSE Route Option

**Problem**: Developers have no convenient way to declare routes as Server-Sent Events endpoints in the REST framework.

**Requirements**:
- Provide a route option function that marks routes as SSE endpoints
- The option should be usable when adding routes to the server
- SSE routes should be identifiable within the routing configuration

**Acceptance Criteria**:
- A route option function must be provided to mark routes as SSE endpoints
- When a route is registered with the SSE option, it is recognized as an SSE endpoint
- Routing configuration must distinguish SSE endpoints from normal HTTP endpoints
- Routes registered without the SSE option continue to behave as standard HTTP endpoints

---

### FR2: SSE HTTP Headers

**Problem**: SSE endpoints require specific HTTP headers to establish proper event stream connections, but developers must manually set these headers.

**Requirements**:
- SSE routes must automatically have the `Content-Type` header set to `text/event-stream`
- SSE routes must automatically have the `Cache-Control` header set to `no-cache`
- SSE routes must automatically have the `Connection` header set to `keep-alive`
- Headers should be set before the handler executes

**Acceptance Criteria**:
- When a request is handled by an SSE route, the response includes `Content-Type: text/event-stream`
- When a request is handled by an SSE route, the response includes `Cache-Control: no-cache`
- When a request is handled by an SSE route, the response includes `Connection: keep-alive`
- The required header values must be available and correctly applied to SSE responses

---

### FR3: SSE Write Deadline Handling

**Problem**: SSE connections fail prematurely because the HTTP server's `WriteTimeout` causes write deadlines to close long-running SSE connections before the application finishes streaming events.

**User Report**:
```
SSE routes are affected by http.Server's WriteTimeout. When WriteTimeout is set,
the server automatically sets a write deadline on connections. SSE connections
need to stay open indefinitely for streaming, but the write deadline causes
them to be terminated.
```

**Requirements**:
- SSE route handlers must clear the connection's write deadline before processing
- The write deadline should be cleared using the Go 1.20+ ResponseController mechanism
- If clearing the write deadline fails due to an unsupported response writer implementation, the failure should be logged at debug level (not error level) since some response writers legitimately do not support deadline control

**Acceptance Criteria**:
- When an SSE route handles a request, the write deadline is cleared before the handler executes
- Clear write deadline using Go 1.20+ ResponseController mechanism
- SSE connections remain open beyond the server's configured `WriteTimeout`
- Failure to clear the deadline must be logged at debug level
- Failure to clear the deadline on unsupported response writers does not cause error-level log noise

---

### FR4: Response Writer Unwrapping

**Problem**: Custom response writer wrappers used in the framework do not expose the underlying response writer, preventing the response controller from accessing deadline control methods.

**Requirements**:
- Response writer wrappers must implement an unwrap pattern that returns the underlying `http.ResponseWriter`
- The unwrap functionality must work with nested response writer wrappers

**Acceptance Criteria**:
- Framework's custom ResponseWriter wrappers must support the Unwrap pattern for nested unwrapping
- The unwrap method must return the underlying ResponseWriter
- When `http.ResponseController` is used with a wrapped response writer, it can access the underlying connection's deadline control methods through unwrapping
- Unwrapping must work correctly with nested wrapper instances

---

### FR5: Timeout Configuration with Zero Value

**Problem**: Setting a route group timeout to `0s` does not work as expected. Users expect zero timeout to disable the timeout middleware, but the framework does not properly distinguish between "timeout not set" and "timeout explicitly set to zero."

**User Report**:
```
When setting timeout: 0s in route configuration, the timeout is not working as expected.
Setting timeout to 0 should disable the timeout for that route group.
```

**Requirements**:
- Route timeout configuration must distinguish between "not set" (use global default) and "explicitly set to zero" (disable timeout)
- When a route timeout is explicitly set to zero, the timeout middleware should not apply to that route
- When any route has timeout explicitly disabled (set to zero), the server's network-level read/write timeouts must not be set (to avoid conflicts)
- The engine must track the maximum timeout across all routes, treating zero-timeout routes specially

**Acceptance Criteria**:
- Route timeout configuration must distinguish between "not set" and "explicitly set to zero"
- When a route is configured with timeout value zero, the timeout middleware does not apply to requests on that route
- The timeout determination logic correctly identifies when timeout middleware should be applied
- When timeout middleware should not be applied, `http.Server.ReadTimeout` and `http.Server.WriteTimeout` must remain unset (zero)
- When all routes have positive timeouts, server network timeouts are derived from the maximum route timeout:
  - Server read timeout = 80% (4/5) of the maximum route timeout
  - Server write timeout = 110% (11/10) of the maximum route timeout
  - Rationale: Read timeout less than handler timeout prevents 503 Service Unavailable responses that trigger circuit breakers; Write timeout greater than handler timeout ensures servers have enough time to write responses

---

### FR6: SSE Slow Request Threshold

**Problem**: SSE requests are long-lived by nature, but the slow request logging threshold is the same as for regular HTTP requests. This causes SSE requests to be incorrectly flagged as slow.

**Requirements**:
- Provide a separate slow request threshold for SSE endpoints
- SSE requests should be identified by the `Accept: text/event-stream` header
- The default SSE slow threshold should be significantly higher than regular requests (3 minutes default vs 500ms for regular requests)
- Provide a function to configure the SSE slow threshold
- Use uppercase "SSE" in identifiers (e.g., `SetSSESlowThreshold`, `defaultSSESlowThreshold`)

**Acceptance Criteria**:
- A configuration function must be provided to set SSE slow request threshold
- The default SSE slow threshold must be 3 minutes (significantly higher than the regular 500ms threshold)
- SSE requests must be identified by checking the Accept header for event stream content type
- Thread-safe threshold access must be ensured for configuration updates
- When an SSE request (identified by Accept header) takes longer than the regular threshold but less than the SSE threshold, it is not logged as slow
- When an SSE request exceeds the SSE slow threshold, it is logged as slow

---

# Environment Dependency Changes (relative to Base Env)

## Go Runtime
- Go upgraded to 1.21.13

## Go Packages
- github.com/olekukonko/tablewriter v0.0.5 added

## Environment Variables
- GOPATH set to /go
- GOMODCACHE set to /go/pkg/mod
