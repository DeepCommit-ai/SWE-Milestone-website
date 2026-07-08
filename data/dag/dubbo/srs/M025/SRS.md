# Software Requirements Specification: Miscellaneous Fixes and Improvements

## Overview

This milestone contains a collection of miscellaneous bug fixes, improvements, and code quality enhancements that span multiple modules of the Dubbo framework. These changes address various edge cases, improve performance, ensure compatibility with newer Java versions, and fix runtime exceptions.

### Requirements Summary

1. **FR1**: Handle `RejectedExecutionException` gracefully when executor is shutdown during task submission
2. **FR2**: Remove deprecated `ThreadGroup` usage from thread factory implementations
3. **FR3**: Fix HTTP authority pseudo-header resolution in triple-servlet protocol
4. **FR4**: Prefer local site network interfaces during network interface selection
5. **FR5**: Fix type inconsistency causing `NullPointerException` in RPC service context
6. **FR6**: Optimize consistent hash load balancer selector lookup performance
7. **FR7**: Remove unused test dependency from plugin modules

### Affected Modules

- dubbo-common (thread pool, thread factory, network utilities)
- dubbo-cluster (load balancing)
- dubbo-rpc-api (RPC context)
- dubbo-plugin/dubbo-triple-servlet (HTTP metadata)
- dubbo-plugin/* (multiple plugin modules - dependency management)

---

## Requirements

### FR1: Graceful Handling of Executor Shutdown During Task Submission

**Problem**: When a `SerializingExecutor` attempts to submit a task to an underlying executor that has been shut down, a `RejectedExecutionException` is thrown even though the executor shutdown is an expected condition during application termination.

**User Report**:
```
During application shutdown, we observe RejectedExecutionException being thrown
when SerializingExecutor tries to schedule tasks. This pollutes logs with
misleading error messages even though the shutdown is intentional and expected.
```

**Requirements**:
- When submitting a task to the underlying executor fails with `RejectedExecutionException`, check if the executor has been shut down
- If the executor is confirmed to be in shutdown state, suppress the exception silently
- If the executor is not in shutdown state, propagate the exception as before to indicate a legitimate capacity issue
- Ensure task cleanup logic still executes properly in the finally block

**Acceptance**:
- When an executor is shut down and task submission fails, no `RejectedExecutionException` should be thrown
- When an executor rejects execution due to capacity limits (not shutdown), the exception should still be thrown
- Task queue cleanup should occur regardless of the exception handling path

---

### FR2: Remove Deprecated ThreadGroup from Thread Factory

**Problem**: The `NamedThreadFactory` and `NamedInternalThreadFactory` classes use the deprecated `ThreadGroup` API and `SecurityManager` to obtain thread groups. This causes compatibility warnings with Java 21+ where `ThreadGroup` and `SecurityManager` are deprecated for removal.

**User Report**:
```
When running Dubbo on Java 21, we see deprecation warnings related to
ThreadGroup usage in NamedThreadFactory. The mGroup field and getThreadGroup()
method trigger these warnings during compilation.
```

**Requirements**:
- Remove the `mGroup` field from `NamedThreadFactory`
- Remove the `SecurityManager`-based thread group resolution logic from the constructor
- Update thread creation to use the simpler `Thread(Runnable, String)` constructor instead of `Thread(ThreadGroup, Runnable, String, long)`
- Remove the `getThreadGroup()` public method from `NamedThreadFactory`
- Update `NamedInternalThreadFactory` to use the corresponding simpler `InternalThread` constructor

**Acceptance**:
- When creating threads via `NamedThreadFactory.newThread()`, threads should be created without explicit thread group assignment
- When creating threads via `NamedInternalThreadFactory.newThread()`, internal threads should be created without explicit thread group assignment
- Thread naming functionality should remain unchanged
- Daemon thread configuration should remain unchanged

---

### FR3: HTTP Authority Pseudo-Header Resolution in Triple-Servlet

**Problem**: The HTTP/2 authority pseudo-header in the triple-servlet protocol adapter is resolved by reading the `Host` HTTP header directly. This approach may fail in certain proxy or servlet container configurations where the Host header is not set but the server name is available through the servlet API.

**Requirements**:
- Use the servlet API method `HttpServletRequest.getServerName()` to obtain the server authority instead of reading the `Host` header directly
- Ensure the authority pseudo-header is correctly populated regardless of whether the Host header is present

**Acceptance**:
- When processing HTTP/2 requests through the servlet adapter, the authority pseudo-header should be populated using the servlet container's server name
- When a request arrives without a Host header but the servlet container knows the server name, the authority should still be correctly resolved

---

### FR4: Prefer Local Site Network Interface During Selection

**Problem**: When selecting a valid network interface, the current implementation returns the first reachable interface found without considering whether it's a local site address. This can result in public or non-preferred interfaces being selected over private/local site addresses.

**Requirements**:
- When a network interface with a reachable address is found, check if the address is a local site address (private network address)
- If the address is a local site address, immediately return that interface as the preferred choice
- If the address is reachable but not a local site address, store it as a fallback candidate and continue searching
- Only return a non-local-site interface if no local site interface is found

**Acceptance**:
- When both local site (e.g., 192.168.x.x, 10.x.x.x, 172.16-31.x.x) and public IP interfaces are available and reachable, the local site interface should be selected
- When only public IP interfaces are available and reachable, those should still be selected as fallback
- Interface reachability validation should remain unchanged

---

### FR5: Type Consistency in RpcServiceContext LocalInvoke Field

**Problem**: The `setLocalInvoke()` method in `RpcServiceContext` accepts a primitive `boolean` parameter, but the field `localInvoke` is declared as `Boolean` (wrapper type). This type inconsistency causes a `NullPointerException` when the method is called through reflection-based mechanisms that pass `null` values.

**User Report**:
```
NullPointerException occurs in RpcServiceContext when setLocalInvoke is invoked
via reflection with a null value. The setter parameter type is boolean (primitive)
but the field is Boolean (wrapper), causing auto-unboxing issues.
```

**Requirements**:
- Change the `setLocalInvoke()` method parameter type from primitive `boolean` to wrapper `Boolean` to match the field type
- Ensure null values can be passed to the setter without causing exceptions

**Acceptance**:
- When `setLocalInvoke(null)` is called (via reflection or directly), no `NullPointerException` should be thrown
- When `setLocalInvoke(true)` or `setLocalInvoke(false)` is called, the behavior should remain unchanged
- The field should correctly store null, true, or false values

---

### FR6: ConsistentHashLoadBalance Selector Lookup Optimization

**Problem**: The `ConsistentHashLoadBalance.doSelect()` method always executes a `ConcurrentHashMap.compute()` operation even when the existing selector is still valid. This atomic operation has synchronization overhead that impacts performance under high concurrency.

**Requirements**:
- Add an early check before the `compute()` operation to verify if the existing selector is still valid
- If a valid selector exists (matching the current invokers hash code), return the selection result immediately without executing the compute operation
- Preserve the existing compute-based logic as a fallback for cases where the selector needs to be created or updated

**Acceptance**:
- When the same set of invokers is used repeatedly, subsequent calls should bypass the compute operation and use the cached selector directly
- When the invoker list changes (different hash code), the selector should be recreated as before
- Load balancing results should remain consistent with the previous implementation

---

### FR7: Remove Unused Test Dependency from Plugin Modules

**Problem**: Multiple plugin modules declare a dependency on `dubbo-test-check` in test scope, but this dependency is not actually used by any tests in these modules. This creates unnecessary build complexity and potential OutOfMemoryError issues during Maven builds due to transitive dependencies.

**User Report**:
```
OutOfMemoryError occurs during maven install due to excessive dependency resolution.
Investigation shows dubbo-test-check is declared but unused in many plugin modules.
```

**Requirements**:
- Remove the `dubbo-test-check` dependency from the following plugin modules:
  - dubbo-auth
  - dubbo-compiler
  - dubbo-filter-cache
  - dubbo-filter-validation
  - dubbo-native
  - dubbo-qos-api
  - dubbo-qos
  - dubbo-reactive
  - dubbo-rest-jaxrs
  - dubbo-rest-spring
  - dubbo-security
  - dubbo-spring-security
  - dubbo-triple-servlet

**Acceptance**:
- Plugin modules should compile and test successfully without the `dubbo-test-check` dependency
- Maven build memory consumption should be reduced
- No test functionality should be affected by the dependency removal


---

# Environment Dependency Changes (relative to Base Env)

## Environment Variables
- MAVEN_OPTS set to `-XX:+UseG1GC -XX:InitiatingHeapOccupancyPercent=45 -XX:+UseStringDeduplication -XX:-TieredCompilation -XX:TieredStopAtLevel=1 -Dmaven.javadoc.skip=true -Dspotless.check.skip=true`
