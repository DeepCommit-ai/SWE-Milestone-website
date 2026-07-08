# Software Requirements Specification: zRPC and Balancer Improvements

## Overview

This milestone delivers improvements to the zRPC framework including server-side interceptor architecture refactoring, circuit breaker timeout handling enhancements, P2C load balancer documentation improvements, a typo fix in the Stream API, and a default configuration change for non-blocking client connections.

### Requirements Summary

1. **FR1**: Refactor zRPC server interceptor builder to move middleware configuration from internal server to the public server setup layer
2. **FR2**: Enhance circuit breaker to trigger on server-side request timeouts in addition to existing error conditions
3. **FR3**: Add documentation comments to the P2C (Power of Two Choices) load balancer explaining its EWMA algorithm and key constants
4. **FR4**: Fix typo in Stream API method names (`AllMach` → `AllMatch`, `AnyMach` → `AnyMatch`)
5. **FR5**: Change the default value of `NonBlock` configuration to `true` for zRPC clients following gRPC best practices

### Affected Modules

- `zrpc/server.go` - RPC server configuration and interceptor setup
- `zrpc/internal/rpcserver.go` - Internal RPC server implementation
- `zrpc/internal/rpcpubserver.go` - RPC server with etcd registration
- `zrpc/internal/server.go` - Base RPC server
- `zrpc/internal/serverinterceptors/breakerinterceptor.go` - Circuit breaker interceptor
- `zrpc/internal/balancer/p2c/p2c.go` - P2C load balancer
- `zrpc/client.go` - RPC client
- `zrpc/config.go` - RPC configuration
- `zrpc/internal/client.go` - Internal client implementation
- `core/fx/stream.go` - Stream utility functions

---

## FR1: Refactor zRPC Server Interceptor Builder

**Problem**: The server interceptor construction is embedded within the internal RPC server implementation, mixing infrastructure concerns with middleware configuration.

**Requirements**:
- Move interceptor setup logic from internal RPC server implementation to the public server layer
- Move all middleware configuration from internal methods to dedicated setup functions
- Create separate setup functions to handle middleware registration for both unary and stream interceptors
- Ensure auth configuration is checked before attempting Redis connection
- Ensure metrics are created and configured at the public server layer before being passed to interceptors

**Acceptance**:
- When creating an RPC server, interceptors are registered through the public APIs rather than internal methods
- When auth is disabled in configuration, no Redis connection attempt is made
- When middleware configuration specifies enabled interceptors, they are added in the correct order: trace, recover, stat, prometheus, breaker, then CPU shedding, then timeout

---

## FR2: Trigger Circuit Breaker on Server-Side Timeout

**Problem**: The server-side circuit breaker only considers standard gRPC error codes when determining whether to mark a request as acceptable. Requests that exceed the server's timeout (`context.DeadlineExceeded`) are not tracked as failures, allowing degraded services to continue receiving traffic.

**Requirements**:
- Modify the server-side breaker interceptor to treat `context.DeadlineExceeded` as an unacceptable error that contributes to circuit breaker state
- Implement a server-side specific acceptability function that checks for both `context.DeadlineExceeded` and `breaker.ErrServiceUnavailable` in addition to the standard acceptable error codes
- The acceptability function must check for `context.DeadlineExceeded` using Go's error comparison semantics
- Ensure the circuit breaker opens when repeated timeout errors occur, protecting the service from cascading failures
- Preserve the existing behavior where `breaker.ErrServiceUnavailable` is converted to a gRPC `Unavailable` status code

**Acceptance**:
- `UnaryBreakerInterceptor` and `StreamBreakerInterceptor` must use a server-side specific acceptability function instead of generic error code checking
- The acceptability function must return false (unacceptable) when the raw error is `context.DeadlineExceeded` or `breaker.ErrServiceUnavailable`
- The acceptability function must delegate to existing gRPC error code acceptability check for all other errors
- When a server-side handler returns `context.DeadlineExceeded` repeatedly, the circuit breaker eventually opens and returns `Unavailable` status
- When the circuit breaker is triggered by timeouts, subsequent requests are rejected until the breaker recovers
- When the handler succeeds or returns acceptable errors, the circuit breaker remains closed

---

## FR3: Document P2C Balancer Algorithm

**Problem**: The P2C (Power of Two Choices with EWMA) load balancer implementation lacks documentation explaining its algorithm constants and key computations.

**Requirements**:
- Add comments explaining each constant in the P2C balancer:
  - `decayTime`: Default value from Finagle for EWMA calculation
  - `forcePick`: Threshold for forcing selection of an idle node
  - `initSuccess`: Initial success count for new connections
  - `throttleSuccess`: Success threshold for health checking
  - `penalty`: Penalty value used in load calculation
  - `pickTimes`: Number of random selection attempts
  - `logInterval`: Interval for statistics logging
- Add comments explaining the EWMA weight calculation formula and its relationship to response latency
- Add comments explaining the `lag` and `inflight` fields in the `subConn` struct
- Pre-allocate the `conns` slice in the picker builder with proper capacity

**Acceptance**:
- When reading the P2C balancer code, developers can understand the purpose of each constant without external documentation
- When examining the EWMA calculation, the mathematical relationship between time decay and historical data weighting is documented

---

## FR4: Fix Stream API Method Name Typos

**Problem**: The Stream API contains method names with typos: `AllMach` and `AnyMach` should be `AllMatch` and `AnyMatch`.

**Requirements**:
- Rename the `AllMach` method to `AllMatch`
- Rename the `AnyMach` method to `AnyMatch`
- Retain the old method names `AllMach` and `AnyMach` as deprecated aliases that delegate to the corrected methods, to maintain backward compatibility for existing callers
- Update the corresponding documentation comments to reflect the corrected names

**Acceptance**:
- When calling stream predicate methods, `AllMatch` and `AnyMatch` are available with correct spelling
- When calling the old names `AllMach` and `AnyMach`, they still work and delegate to `AllMatch` and `AnyMatch` respectively
- When viewing API documentation, method names correctly reflect their "match" functionality

---

## FR5: Change NonBlock Default to True for zRPC Clients

**Problem**: The zRPC client configuration defaults to blocking dial behavior (`NonBlock: false`), which contradicts gRPC best practices. The gRPC documentation explicitly lists blocking dials as an anti-pattern that can cause application startup issues.

**Requirements**:
- Change the default value of `NonBlock` in `RpcClientConf` from `false` to `true`
- Add a new `WithBlock` client option in `zrpc/internal/client.go` (as a `ClientOption`) for users who need the deprecated blocking behavior
- Mark `WithBlock` as deprecated with a reference to gRPC best practices documentation
- Ensure that when `NonBlock` is explicitly set to `false` in configuration, the blocking dial option is properly applied for backward compatibility

**Acceptance**:
- When creating a new RPC client without specifying `NonBlock`, non-blocking dial behavior is used by default
- When users explicitly set `NonBlock: false` in their configuration, blocking behavior is used with the deprecated dial option
- When viewing the `WithBlock` function, its deprecation status and reason are documented


---

# Environment Dependency Changes (relative to Base Env)

## Go Runtime
- Go upgraded to 1.21.13 (from 1.19.13)

## Go Module Dependencies
- github.com/go-redis/redis/v8 v8.11.5 added
- github.com/golang/mock/gomock v1.6.0 added
- github.com/olekukonko/tablewriter v0.0.5 added
- go.mongodb.org/mongo-driver v1.12.1 added

## Environment Variables
- GOMODCACHE set to /go/pkg/mod
- PATH reordered to /usr/local/go/bin:/go/bin:/usr/local/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
