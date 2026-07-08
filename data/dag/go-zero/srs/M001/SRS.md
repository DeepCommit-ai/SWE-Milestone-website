# Software Requirements Specification: go-redis v9 Upgrade with API Modernization

## Overview

This milestone addresses the upgrade of the go-redis dependency from v8 to v9, which requires significant API changes throughout the Redis module. The upgrade involves:

1. Migrate from the deprecated `github.com/go-redis/redis/v8` package to the new `github.com/redis/go-redis/v9` package
2. Refactor hook implementations from the callback-based API (BeforeProcess/AfterProcess) to the middleware-based API (ProcessHook/ProcessPipelineHook)
3. Update error handling throughout the codebase to use `errors.Is()` and `errors.As()` for better error wrapping support
4. Adapt to API signature changes for sorted set operations where pointer parameters changed to value parameters

**Affected Modules**:
- `core/stores/redis` (hook, redis, redisblockingnode, redisclientmanager, redisclustermanager, redislock, metrics)
- `core/iox` (textlinescanner)
- `zrpc/internal/clientinterceptors` (tracinginterceptor)

---

## Requirements

### FR1: Migrate go-redis Import Path

**Problem**: The Redis client library import path has changed from `github.com/go-redis/redis/v8` to `github.com/redis/go-redis/v9`, causing compilation failures.

**Requirements**:
- Update all import statements referencing the old go-redis v8 package to use the new v9 package path
- Ensure all Redis-related source files compile with the new import path
- Maintain the `red` alias convention for the imported package

**Acceptance**:
- When building the project, no import errors occur for the Redis package
- All files in the redis module successfully import from the v9 package location

---

### FR2: Implement New Hook Interface Pattern

**Problem**: The go-redis v9 library replaced the callback-based hook interface (`BeforeProcess`/`AfterProcess` methods) with a middleware-style hook interface (`ProcessHook`/`ProcessPipelineHook` functions that wrap the next handler). Existing hook implementations fail to compile.

**Requirements**:
- Implement the `DialHook(next red.DialHook) red.DialHook` method that passes through to the next handler
- Replace `BeforeProcess`/`AfterProcess` methods with a single `ProcessHook(next red.ProcessHook) red.ProcessHook` method that:
  - Captures the start time before calling the next handler
  - Starts the tracing span before calling next
  - Calls the next handler to execute the Redis command
  - Ends the span after the command completes
  - Records metrics and slow query logs after execution
  - Returns the error from the command execution
- Replace `BeforeProcessPipeline`/`AfterProcessPipeline` methods with a single `ProcessPipelineHook(next red.ProcessPipelineHook) red.ProcessPipelineHook` method with equivalent behavior for pipeline operations
- Remove the context-based start time storage mechanism (using context values to pass timing between before/after hooks)
- Update the `startSpan` helper to return both the context and an `endSpan` closure function

**Acceptance**:
- When a Redis command is executed, the tracing span is properly created and completed with correct status
- When a Redis command exceeds the slow threshold, the slow query is logged
- When a Redis command fails, the error is properly recorded in the span and metrics
- When a pipeline of commands is executed, the combined duration is measured and logged appropriately

---

### FR3: Modernize Error Comparison with errors.Is()

**Problem**: Direct error equality comparisons (e.g., `err == io.EOF`, `err == red.Nil`) do not work correctly with wrapped errors. The codebase uses direct equality which breaks error detection when errors are wrapped.

**Requirements**:
- Replace direct equality comparisons for sentinel errors with `errors.Is()` function calls:
  - `err == red.Nil` should become `errors.Is(err, red.Nil)`
  - `err == io.EOF` should become `errors.Is(err, io.EOF)`
  - `err == context.DeadlineExceeded` should become `errors.Is(err, context.DeadlineExceeded)`
  - `err == breaker.ErrServiceUnavailable` should become `errors.Is(err, breaker.ErrServiceUnavailable)`
- Replace type assertions for error types with `errors.As()` function calls:
  - `err.(*net.OpError)` type assertion should use `errors.As(err, &opErr)` pattern
- Apply these changes consistently across all affected modules

**Acceptance**:
- When a wrapped `io.EOF` error is returned, it is correctly identified as EOF
- When a wrapped `redis.Nil` error is returned, it is correctly identified as Nil (not an error condition)
- When a wrapped `context.DeadlineExceeded` error is returned, it is correctly classified as a deadline error
- When a wrapped `net.OpError` timeout is returned, it is correctly identified as a timeout

---

### FR4: Update Sorted Set API Signatures

**Problem**: The go-redis v9 library changed the `ZAdd` method signature to accept value types (`red.Z`) instead of pointer types (`*red.Z`). Code using pointer parameters fails to compile.

**Requirements**:
- Update `ZAdd` calls to pass `red.Z` structs by value instead of by pointer
- Update slice types from `[]*red.Z` to `[]red.Z` where sorted set members are collected
- Maintain existing functionality for adding members to sorted sets

**Acceptance**:
- When calling `ZaddFloat` to add a member with a float score, the member is successfully added
- When calling `Zadds` to add multiple members, all members are successfully added to the sorted set

---

### FR5: Extend RedisNode Interface for BitMap Commands

**Problem**: The go-redis v9 library separates bitmap commands into a distinct interface. The `RedisNode` interface needs to include bitmap command support for full compatibility.

**Requirements**:
- Extend the `RedisNode` interface to include `red.BitMapCmdable` in addition to `red.Cmdable`
- Ensure all bitmap operations remain accessible through the Redis client

**Acceptance**:
- When using the RedisNode interface, bitmap commands are available and functional

---

### FR6: Update Error Message for Circuit Breaker

**Problem**: The error classification message for circuit breaker errors should be more descriptive to indicate the breaker state.

**Requirements**:
- Change the error classification message from "breaker" to "breaker open" when `breaker.ErrServiceUnavailable` is detected

**Acceptance**:
- When a circuit breaker error occurs, the metric label shows "breaker open" instead of "breaker"

---

### FR7: Remove Deprecated Hook Pattern Dependencies

**Problem**: The old hook pattern relied on storing the start time in context values, which is no longer needed with the middleware pattern.

**Requirements**:
- Remove the `startTimeKey` context key and associated `contextKey` type
- Remove the `endSpan` helper method (functionality merged into the closure returned by `startSpan`)
- Remove dependency on `errorx.BatchError` for pipeline error aggregation (use direct error from pipeline execution)

**Acceptance**:
- When executing hooks, no context value storage is used for timing
- The span is correctly ended through the closure mechanism returned by `startSpan`


---

# Environment Dependency Changes (relative to Base Env)

## Go Packages

- github.com/DATA-DOG/go-sqlmock upgraded to v1.5.2
- github.com/alicebob/miniredis/v2 upgraded to v2.31.1
- github.com/bufbuild/protocompile upgraded to v0.8.0
- github.com/emicklei/go-restful/v3 upgraded to v3.11.0
- github.com/fatih/color upgraded to v1.16.0
- github.com/go-logr/logr upgraded to v1.3.0
- github.com/go-redis/redis/v8 removed
- github.com/golang/protobuf upgraded to v1.5.4
- github.com/google/go-cmp upgraded to v0.6.0
- github.com/google/uuid upgraded to v1.6.0
- github.com/jackc/pgx/v5 upgraded to v5.5.4
- github.com/jackc/puddle/v2 v2.2.1 added
- github.com/jhump/protoreflect upgraded to v1.15.6
- github.com/matttproud/golang_protobuf_extensions replaced by github.com/matttproud/golang_protobuf_extensions/v2 v2.0.0
- github.com/pelletier/go-toml/v2 upgraded to v2.1.1
- github.com/prometheus/client_golang upgraded to v1.18.0
- github.com/prometheus/client_model upgraded to v0.5.0
- github.com/prometheus/common upgraded to v0.45.0
- github.com/prometheus/procfs upgraded to v0.12.0
- github.com/redis/go-redis/v9 v9.4.0 added
- github.com/stretchr/testify upgraded to v1.9.0
- go.etcd.io/etcd/api/v3 upgraded to v3.5.12
- go.etcd.io/etcd/client/pkg/v3 upgraded to v3.5.12
- go.etcd.io/etcd/client/v3 upgraded to v3.5.12
- go.mongodb.org/mongo-driver upgraded to v1.13.1
- golang.org/x/crypto upgraded to v0.21.0
- golang.org/x/net upgraded to v0.22.0
- golang.org/x/oauth2 upgraded to v0.16.0
- golang.org/x/sync upgraded to v0.6.0
- golang.org/x/sys upgraded to v0.18.0
- golang.org/x/term upgraded to v0.18.0
- golang.org/x/text upgraded to v0.14.0
- golang.org/x/time upgraded to v0.5.0
- google.golang.org/genproto upgraded to v0.0.0-20240123012728-ef4313101c80
- google.golang.org/genproto/googleapis/api upgraded to v0.0.0-20240123012728-ef4313101c80
- google.golang.org/genproto/googleapis/rpc upgraded to v0.0.0-20240123012728-ef4313101c80
- google.golang.org/grpc upgraded to v1.62.1
- google.golang.org/protobuf upgraded to v1.33.0
- k8s.io/api upgraded to v0.29.2
- k8s.io/apimachinery upgraded to v0.29.2
- k8s.io/client-go upgraded to v0.29.2
- k8s.io/klog/v2 upgraded to v2.110.1
- sigs.k8s.io/structured-merge-diff/v4 upgraded to v4.4.1
