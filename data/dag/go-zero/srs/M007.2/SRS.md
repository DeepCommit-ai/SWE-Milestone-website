# Software Requirements Specification: Etcd Discovery Mechanism Reliability

## Overview

This milestone addresses critical reliability issues in the etcd-based service discovery mechanism. The changes focus on fixing memory and goroutine leaks, improving gRPC resolver integration, enabling proper cleanup of watchers, and adding automatic key re-registration when keys are unexpectedly deleted.

### Requirements Summary

1. **FR1**: Fix memory leak in gRPC resolver caused by improper subscriber cleanup
2. **FR2**: Fix goroutine leak in etcd watch mechanism when watchers are not properly cancelled
3. **FR3**: Enable proper integration with gRPC idle connection manager
4. **FR4**: Add automatic re-registration when etcd keys are unexpectedly deleted
5. **FR5**: Add randomized jitter to cooldown intervals to prevent thundering herd
6. **FR6**: Prevent HTML escaping in JSON marshalling for API responses

### Affected Modules

- `core/discov/internal/registry.go` - Registry and cluster management
- `core/discov/subscriber.go` - Subscriber lifecycle management
- `core/discov/publisher.go` - Publisher keep-alive mechanism
- `zrpc/resolver/internal/discovbuilder.go` - gRPC resolver builder
- `zrpc/resolver/internal/kubebuilder.go` - Kubernetes resolver builder
- `core/jsonx/json.go` - JSON marshalling utilities

---

## Functional Requirements

### FR1: Fix Memory Leak in gRPC Resolver

**Problem**: When gRPC connections are closed, the associated etcd subscriber is not properly cleaned up, leading to accumulating memory over time as subscribers and their listeners remain in memory.

**Requirements**:
- The gRPC resolver must properly release etcd subscriber resources when the resolver is closed
- The Subscriber type must provide a Close() method that unregisters from the etcd registry
- The registry must support an Unmonitor operation to remove listeners from watched keys
- When the last listener is removed from a watch key, the associated watch context must be cancelled

**Acceptance**:
- When a gRPC client connection is closed, the corresponding etcd subscriber is properly released
- When Subscriber.Close() is called, the subscriber's container is removed from the registry's listener list
- When all listeners are removed from a watch key, the watch goroutine terminates
- Subscriber must provide a Close() method for cleanup and resource release
- The Subscriber must maintain the key information needed to support unmonitoring
- Registry must provide an Unmonitor operation to remove listeners from watched keys

---

### FR2: Fix Goroutine Leak in etcd Watch Mechanism

**Problem**: Watch goroutines continue running indefinitely even after their associated listeners have been removed or the subscriber has been closed, leading to goroutine accumulation.

**Requirements**:
- Each watch must be associated with a cancellable context
- When a watch key's last listener is removed, the watch context must be cancelled
- The watch stream loop must respond to context cancellation and terminate cleanly
- During cluster reload, all existing watch contexts must be cancelled before starting new watches
- Watch management must track watchers per key with both the key string and exactMatch flag

**Acceptance**:
- When Unmonitor is called and removes the last listener for a key, the watch goroutine terminates
- When the cluster reloads due to connection state changes, existing watch goroutines are properly cancelled
- No orphaned goroutines remain after all subscribers have been closed
- Watch identification must include both the key string and the exactMatch flag for proper tracking
- Each watcher must have a cancellable context that is cancelled when the last listener is removed

---

### FR3: Enable Integration with gRPC Idle Connection Manager

**Problem**: The gRPC idle connection manager may close and recreate connections, but the etcd resolver is not properly integrated to handle resolver Close() calls and cleanup.

**Requirements**:
- The discov resolver builder must return a resolver that implements proper Close() behavior
- The resolver's Close() method must trigger cleanup of etcd subscriber resources
- The resolver must not use a nop (no-operation) close function that ignores cleanup
- The Kubernetes resolver must also implement proper Close() behavior

**Acceptance**:
- When gRPC calls resolver.Close(), the underlying subscriber is properly cleaned up
- The discov resolver's Close() method ensures subscriber cleanup is triggered
- Resources are released when connections are managed by gRPC's idle manager
- The discov resolver must hold references to both the ClientConn and the Subscriber
- The resolver's Close() method must trigger subscriber cleanup operations

---

### FR4: Add Automatic Re-registration When etcd Keys Are Deleted

**Problem**: If an etcd key is unexpectedly deleted (e.g., due to etcd compaction, operator error, or etcd cluster issues), the service registration disappears and is not automatically restored.

**Requirements**:
- The publisher must watch its registered key for deletion events
- When a DELETE event is detected on the publisher's key, it must automatically re-PUT the key with the same value and lease
- Watch errors must trigger a full re-registration via the keep-alive mechanism
- The watch must filter to observe only deletion events (not PUT events)

**Acceptance**:
- When a publisher's key is deleted from etcd, the key is automatically re-registered with the existing lease
- When the watch encounters an error, the publisher attempts to re-establish registration
- The re-registration uses the same key, value, and lease as the original registration
- The keep-alive mechanism must include watching for key deletion events while filtering PUT events
- The watch monitoring must run within the keep-alive response handling goroutine, selecting on both keep-alive and watch channels
- When a DELETE event is detected, the key must be re-registered with the original value and lease
- Watch errors must trigger a restart of the complete keep-alive and registration process

---

### FR5: Add Randomized Jitter to Cooldown Intervals

**Problem**: When multiple instances experience the same error condition (e.g., etcd unavailable), they all retry at exactly the same interval, causing a "thundering herd" effect that can overwhelm the recovering etcd cluster.

**Requirements**:
- The cooldown interval used during retry loops must include randomized jitter
- The jitter should introduce variation of approximately 5% around the base interval
- This applies to the load retry loop in the registry

**Acceptance**:
- When etcd operations fail and retry, the retry intervals vary slightly between instances
- The variation is within a reasonable range (approximately 5%) of the base cooldown interval
- A jitter generator mechanism must be created with approximately 5% deviation
- The randomized jitter must be applied when calculating actual sleep durations during retry loops

---

### FR6: Prevent HTML Escaping in JSON Marshalling

**Problem**: The standard JSON marshalling function escapes HTML characters (`&`, `<`, `>`) to their Unicode escape sequences (e.g., `&` becomes `\u0026`). This is problematic for API responses that contain URLs with query parameters, as ampersands in URLs get escaped unnecessarily.

**Requirements**:
- The Marshal function in `core/jsonx/json.go` must not escape HTML characters
- URLs with query parameters (containing `&`) must be serialized without escaping
- The output must not include a trailing newline

**Acceptance**:
- JSON marshalling must not escape HTML characters such as ampersand, less-than, and greater-than symbols
- When marshalling a string containing URL query parameters with ampersands, the ampersands must be preserved in the output without escape sequences
- The returned byte slice must not have a trailing newline character

---

## Implementation Notes

### Data Structure Changes

The registry's internal data structures should be reorganized to support per-key watch management:
- Watch keys should be composite structures including both the key string and the exactMatch flag
- Watch values should include listeners, cached values, and a cancel function for the associated context
- The cluster structure should map watch keys to watch values rather than maintaining separate maps

### Thread Safety

- The `UpdateListener` interface implementations must be thread-safe and idempotent
- Registry operations must properly handle concurrent access through appropriate locking
- Watch event handling must safely copy listener lists before invoking callbacks

### Context Management

- Watch contexts should be derived from the etcd client context
- Context cancellation should propagate through the watch stream loop
- The setup of watches should store the cancel function for later cleanup

---

# Environment Dependency Changes (relative to Base Env)

## Go Version
- Go upgraded to 1.21.13

## Environment Variables
- GOROOT set to /usr/local/go
- PATH prepended with /usr/local/go/bin
