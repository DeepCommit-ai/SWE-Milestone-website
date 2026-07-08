# Software Requirements Specification: RadixTree Multi-Method REST Path Routing Fix

## Overview

This SRS addresses two critical issues in the Dubbo Triple REST protocol:

1. **Multi-Method Path Registration Failure**: The RadixTree-based request mapping registry incorrectly rejects registrations when different HTTP methods are mapped to the same URL path
2. **Proto Service StreamObserver Parameter Mismatch**: Method descriptor lookup fails for proto-based services when the service interface has StreamObserver parameters that differ from the generated stub descriptors

### Affected Modules
- REST request mapping registry (Triple protocol)
- RadixTree path registration
- Proto/gRPC service method resolution

### Requirements Summary
- FR1: Enable registration of multiple HTTP methods to the same path in RadixTree
- FR2: Support StreamObserver parameter matching for proto service methods

---

## Functional Requirements

### FR1: Multi-Method Path Registration in RadixTree

**Problem**: When registering REST endpoints, attempting to register different HTTP methods (e.g., GET and POST) to the same URL path fails. The second registration is incorrectly rejected because the RadixTree treats the path as a duplicate, preventing valid REST API patterns where the same path handles multiple HTTP methods.

**User Report**:
```
When defining REST services with overloaded methods mapped to the same path but
different HTTP methods (e.g., GET /resource vs POST /resource), only the first
method is registered. Subsequent method registrations to the same path are
silently ignored, causing requests to fail or route incorrectly.
```

**Requirements**:
- The RadixTree must support adding multiple values to the same path when those values represent non-overlapping request mappings
- Path registration must use a custom equality predicate to determine whether two registrations are truly duplicates
- Two request mappings to the same path should be considered overlapping only if they share at least one HTTP method in common (or if either has no method restriction)
- Mappings with different HTTP methods but the same path must both be registered successfully
- The overlap check must also consider other request conditions (params, headers, consumes, produces, custom conditions, method signature) for complete equality determination

**Acceptance**:
- When a GET mapping is registered to a path followed by a POST mapping to the same path, both mappings are successfully registered
- When two identical GET mappings are registered to the same path, the second registration returns the existing registration (duplicate detected)
- When a mapping with no method restriction is registered to a path that already has a GET mapping, overlap is detected
- When calling the basic `addPath(path, value)` method (without a custom predicate) twice with the same path but different values, the second call must return the first value (existing value), treating all entries at the same path as duplicates by default

**Required API Contracts**:
- RadixTree must support adding paths with a custom equality predicate that determines whether two values at the same path should be considered duplicates
- The request mapping registration must be able to check whether two registrations overlap (considering HTTP methods, parameters, headers, content types, and other conditions)
- Request mapping must expose custom condition information for use in overlap comparison

---

### FR2: Proto Service StreamObserver Parameter Resolution [EXTENDED]

**Problem**: When registering REST endpoints for proto/gRPC services with server-streaming methods, method descriptor lookup fails. The service interface method includes a StreamObserver parameter for streaming responses, but the generated stub's method descriptor does not include this parameter, causing a null method descriptor during registration.

**User Report**:
```
REST endpoints for proto services with server streaming methods fail to register.
The service implementation has methods like:
  void sayHelloStream(HelloRequest request, StreamObserver<HelloReply> responseObserver)
But the method descriptor lookup cannot find a match because the stub descriptor
only has the request parameter types.
```

**Requirements**:
- When resolving method descriptors for stub-based service descriptors, if the initial lookup fails, perform a secondary lookup
- The secondary lookup should exclude the trailing StreamObserver parameter from the parameter type array
- This fallback only applies to StubServiceDescriptor instances (proto-generated services)
- The fallback should only trigger when the last parameter is assignable to StreamObserver
- Normal reflection-based services must continue to work unchanged

**Acceptance**:
- When a proto service with a server-streaming method (having StreamObserver parameter) is registered, the method descriptor is successfully resolved
- REST requests to streaming endpoints of proto services are correctly routed to the handler
- Non-streaming proto service methods continue to resolve correctly
- Standard Java services without proto definitions remain unaffected

---

## Non-Functional Requirements

- Backward compatibility: Existing RadixTree API signatures must be preserved; callers using `addPath(path, value)` should continue to work, though the duplicate detection behavior is intentionally changed to prevent same-path collisions
- Performance: The predicate check should not significantly impact path registration performance
- The fix must not alter the routing behavior for paths that have only a single registration


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
