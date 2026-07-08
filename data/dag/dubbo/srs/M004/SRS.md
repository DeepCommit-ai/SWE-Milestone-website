# Software Requirements Specification: REST Stream Parameter Handling, SSE Infrastructure, and RadixTree Enhancements

## Overview

This milestone addresses stream parameter handling in REST argument resolution, establishes Server-Sent Events (SSE) infrastructure, and enhances RadixTree with configurable duplicate value detection. The tested functionalities are stream parameter skipping in REST argument resolvers and RadixTree duplicate handling; SSE infrastructure is also implemented but has no fail-to-pass tests.


**Affected Modules**:
- `dubbo-rpc/dubbo-rpc-triple` - REST argument resolution, SSE channel observers, and RadixTree
- `dubbo-plugin/dubbo-rest-jaxrs` - JAX-RS REST support
- `dubbo-plugin/dubbo-rest-spring` - Spring REST support
- `dubbo-remoting/dubbo-remoting-http12` - SSE data model and encoder

---

## Functional Requirements

### FR1: Stream Parameter Detection and Skipping in REST Argument Resolution

**Problem**: REST endpoints with `StreamObserver` parameters fail when the argument resolver attempts to resolve the stream parameter from the request body. The argument resolver incorrectly tries to deserialize the `StreamObserver` callback parameter as a bean from the request, causing parameter binding failures.

**Requirements**:
- `ParameterMeta` must expose an `isStream()` method that returns true for stream-type parameters (e.g., `StreamObserver`)
- The `isStream()` method should delegate to an existing stream type detection utility (check `ReflectionPackableMethod` for reference)
- All three REST dialects (basic, Spring, JAX-RS) must check `isStream()` in their `FallbackArgumentResolver` implementations
- When a parameter is detected as a stream type, the resolver must return null immediately without attempting request body resolution
- Non-stream bean parameters in the same method signature must still be correctly resolved from the request body

**Acceptance**:
- REST endpoints that accept both bean parameters and `StreamObserver` callback parameters correctly resolve bean arguments from the request body
- Stream-type parameters are skipped during argument resolution and do not cause deserialization errors
- Bean arguments provided in various formats (single object, array, map) are correctly deserialized when stream parameters are present in the method signature

---

### FR2: Server-Sent Event Data Model



**Problem**: The framework lacks a standardized data model for Server-Sent Events according to the HTML SSE specification.

**Requirements**:
- Provide a `ServerSentEvent<T>` class representing an SSE event in the `dubbo-remoting-http12` module
- Support all SSE fields according to the HTML specification: event ID, event type, retry duration (as `Duration`), comment, and generic data payload
- Provide a builder API for constructing events with fluent method chaining
- The class should be immutable with appropriate getters for all fields

---

### FR3: Server-Sent Event Wire Format Encoding

**Problem**: The framework needs to encode `ServerSentEvent` objects to the `text/event-stream` wire format as specified by the HTML SSE standard.

**Requirements**:
- Implement `ServerSentEventEncoder` to convert `ServerSentEvent` objects to SSE wire format
- Handle all SSE field prefixes according to specification: `id:`, `event:`, `retry:`, `data:`, and `:` for comments
- Multi-line data content must be split and each line prefixed with `data:`
- Events must be terminated with double newlines (`\n\n`) as per SSE specification
- Retry duration should be encoded as milliseconds

---

### FR4: Empty Stream Handling for SSE Endpoints

**Problem**: When `onCompleted()` is called without any prior `onNext()` calls on an SSE stream, the HTTP response headers may not be sent, leaving the client without a proper response.

**Requirements**:
- `Http1SseServerChannelObserver` and `Http2SseServerChannelObserver` must check in `doOnCompleted` whether headers have been sent
- If headers have not been sent, they must be sent before completing the response
- SSE endpoints must complete gracefully even when no data is streamed

---

### FR5: JSON Content Support in SSE Streaming

**Problem**: SSE channel observers need to properly handle `HttpResult` return values when streaming JSON content in responses.

**Requirements**:
- SSE channel observers must detect `HttpResult` wrapped responses and extract the actual content
- `ServerStreamServerCallListener` must support `HttpResult` in streaming scenarios
- JSON content must be properly serialized when wrapped in SSE data fields

---

### FR6: RadixTree Configurable Duplicate Value Detection

**Problem**: The RadixTree's `addPath` method needs a more flexible mechanism for handling duplicate paths. Currently, the duplicate detection logic for direct paths uses `value.equals()` to determine if a value already exists, which limits the ability to customize duplicate detection behavior. A predicate-based approach would allow callers to define custom equality semantics.

**Requirements**:

1. **Add predicate-based addPath overload**: Introduce a new `addPath` method that accepts a `BiFunction<T, T, Boolean>` predicate parameter. This predicate receives the existing value and the new value, and returns `true` if they should be considered duplicates (causing the existing value to be returned), or `false` to allow adding the new value.

2. **Modify default addPath behavior**: The existing `addPath(PathExpression, T)` method should delegate to the new predicate-based method with a default predicate that always returns `true`. This means:
   - For **direct paths**: Change from `existingValue.equals(newValue)` to unconditionally treating any existing path as a duplicate
   - For **pattern paths**: When the path expression matches an existing entry, additionally check the predicate before returning the existing value

3. **Return value semantics**:
   - First call to add a path that does not exist: return `null`
   - Subsequent calls to add the same path: return the previously stored value (when predicate returns true)
   - The predicate parameter must not be null (validate with `Objects.requireNonNull`)

**Acceptance**:
- Adding a new path returns `null`
- Adding a path that already exists in the tree returns the first stored value
- The default behavior treats all duplicate paths as matches regardless of value equality

---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
