# Software Requirements Specification: Circuit Breaker Algorithm Evolution and Recovery Optimization

## Overview

This milestone delivers comprehensive improvements to the circuit breaker implementation, addressing multiple aspects of failure detection, recovery time optimization, and API usability. The work encompasses:

1. **FR1**: Context-aware breaker methods for cancellation and timeout support
2. **FR2**: Adaptive K-factor algorithm for dynamic failure sensitivity
3. **FR3**: Force-pass mechanism for recovery acceleration
4. **FR4**: Failure counting correction in the Allow method
5. **FR5**: Generic RollingWindow infrastructure with custom bucket support
6. **FR6**: Distinct tracking for success, failure, and drop events

**Affected Modules**:
- `core/breaker` - Circuit breaker implementation
- `core/collection` - RollingWindow data structure
- `core/mathx` - Numerical type constraints
- `core/load` - Adaptive shedder (consumer of RollingWindow)

---

## FR1: Context-Aware Breaker Methods

**Problem**: The circuit breaker API does not support Go context for cancellation and timeout, forcing callers to implement their own context checking before breaker calls.

**Requirements**:
- Add context-aware variants for all breaker methods that check context cancellation before executing
- The `Breaker` interface must include context-aware versions of `Allow`, `Do`, `DoWithAcceptable`, `DoWithFallback`, and `DoWithFallbackAcceptable`
- When the context is already done (cancelled or timed out), the context-aware methods must return the context error immediately without invoking the underlying breaker logic
- Context checking must be non-blocking when the context is not yet done
- Package-level convenience functions must be provided for context-aware operations
- The no-op breaker implementation must also implement all context-aware methods

**Acceptance**:
- The `Breaker` interface defines context-aware methods that accept a context as the first parameter
- Package-level convenience functions are provided for context-aware operations
- When calling a context-aware method with an already-cancelled context, the method returns `context.Canceled` without executing the request function
- When calling a context-aware method with a timed-out context, the method returns `context.DeadlineExceeded` without checking breaker state
- When calling any context-aware method with an active context, the method behaves identically to its non-context counterpart

---

## FR2: Adaptive K-Factor Algorithm

**Problem**: The circuit breaker uses a fixed K-factor (multiplier for weighted accepts) which does not adapt to prolonged failure conditions, resulting in suboptimal behavior during extended service degradation.

**Requirements**:
- The K-factor must dynamically decrease as the number of consecutive failing buckets increases
- Define a minimum K value (minK) that serves as the lower bound for the adaptive factor
- The adaptive formula must scale the K-factor linearly based on the ratio of failing buckets to total buckets
- The weighted accepts calculation must use the dynamically computed K-factor
- The history tracking must count consecutive failing buckets (buckets with failures and no successes)

**Acceptance**:
- Define package-level constants:
  - `k = 1.5` (default K-factor)
  - `minK = 1.1` (minimum K-factor lower bound)
- The adaptive K-factor formula: `w = k - (k-minK) * failingBuckets / buckets`
- The weighted accepts formula: `weightedAccepts = max(w, minK) * accepts`
- When service is healthy (no failing buckets), the K-factor remains at the configured default value
- When consecutive failing buckets accumulate, the effective K-factor decreases progressively toward minK
- The drop ratio increases more aggressively during sustained failures due to the reduced K-factor

---

## FR3: Force-Pass Mechanism for Recovery Acceleration

**Problem**: After a service recovers from failure, the circuit breaker remains in a high-rejection state for too long because it lacks a mechanism to periodically allow test requests through.

**Requirements**:
- Track the timestamp of the last successfully passed request
- When the circuit breaker would normally reject a request, check if sufficient time has elapsed since the last pass
- If the configured force-pass duration has elapsed since the last pass, allow the request through regardless of the calculated drop ratio
- The force-pass check must only trigger if there has been at least one previous successful pass (the last-pass timestamp is non-zero)
- Update the last-pass timestamp both when force-passing and when a request passes normally through probabilistic acceptance
- The force-pass check must occur after the initial drop ratio calculation but before the probabilistic rejection decision
- The timestamp tracking must be thread-safe

**Acceptance**:
- Define package-level constant: `forcePassDuration = time.Second`
- The breaker must track the timestamp of the last successfully passed request in a thread-safe manner
- When the breaker is in a rejecting state and more than 1 second has passed since the last successful pass, the next request is allowed through
- In the initial state (no previous successful pass), the force-pass mechanism must not trigger, allowing normal rejection behavior
- After a force-pass occurs, the last-pass timestamp is updated, preventing immediate subsequent force-passes
- The force-pass mechanism enables the breaker to detect service recovery faster than waiting for bucket expiration

---

## FR4: Failure Counting in Allow Method

**Problem**: When the `Allow` method rejects a request (returns `ErrServiceUnavailable`), the rejection is not counted as a failure/drop event, causing the breaker statistics to undercount the actual rejection rate.

**Requirements**:
- When the `Allow` method rejects a request, the rejection must be recorded as a drop event before returning
- When the `Do` method rejects a request due to breaker being open, the rejection must be recorded as a drop event before executing the fallback or returning the error
- Drops must be tracked separately from failures to distinguish between breaker rejections and actual request failures

**Acceptance**:
- When `Allow()` rejects a request, the drop counter increments
- When `Do()` or its variants reject a request, the drop counter increments before the fallback executes or error is returned
- The breaker statistics accurately reflect both actual failures and breaker-initiated rejections

---

## FR5: Generic RollingWindow Infrastructure

**Problem**: The `RollingWindow` implementation uses a fixed bucket type which is insufficient for circuit breaker's need to track distinct event types (success, failure, drop).

**Requirements**:
- Convert `RollingWindow` to a generic type parameterized by both value type and bucket type
- Define a bucket interface constraint requiring core operations for managing bucket state
- Define a numerical type constraint for numeric types (integer and floating-point variants)
- The `NewRollingWindow` function must accept a bucket factory function to create custom bucket instances
- The existing bucket type must become generic and implement the bucket interface
- Export the numerical type constraint for use by other packages
- Update all consumers of `RollingWindow` to use the new generic API

**Acceptance**:
- Export a `Numerical` type constraint from `core/mathx` that supports all integer types (signed and unsigned) and floating-point types
- Define a `BucketInterface[T Numerical]` with `Add(v T)` and `Reset()` methods
- `RollingWindow` must be generic: `RollingWindow[T Numerical, B BucketInterface[T]]`
- `NewRollingWindow` must accept a bucket factory function as the first parameter
- The generic `Bucket[T Numerical]` type must implement `BucketInterface` with exported `Add` and `Reset` methods
- A custom bucket type with additional fields can be used with RollingWindow
- The RollingWindow correctly calls bucket operations when values are added or buckets are recycled
- All consumers of `RollingWindow` (including `adaptiveShedder`) must use `int64` as the value type parameter, matching the int64 event type values used by the circuit breaker bucket

---

## FR6: Distinct Event Type Tracking

**Problem**: The circuit breaker tracks only total requests and accepts, without distinguishing between different types of events (successful requests, failed requests, and dropped requests).

**Requirements**:
- Create a specialized bucket type for the circuit breaker that tracks four metrics: total count, success count, failure count, and drop count
- Define event type constants for distinguishing success, failure, and drop events
- The bucket's add operation must dispatch to the appropriate counter based on the event type
- The marking methods must record the corresponding event type to the rolling window
- The history calculation must use the distinct counters to compute accepts, total, workingBuckets, and failingBuckets

**Acceptance**:
- Define event type constants using iota in this order: `success = iota`, `fail`, `drop`
  - This means: success=0, fail=1, drop=2
- Create a bucket struct with fields: `Sum`, `Success`, `Failure`, `Drop` (all int64)
- The bucket's `Add(v int64)` method must:
  - When v == fail: increment Failure and Sum
  - When v == drop: increment Drop and Sum
  - Otherwise (default, including v == success or v == 0): increment Success and Sum
- The bucket's `Reset()` method must reset all four fields to 0
- Methods must exist to record success, failure, and drop events:
  - `markSuccess()` calls `stat.Add(success)`
  - `markFailure()` calls `stat.Add(fail)`
  - `markDrop()` calls `stat.Add(drop)`
- The history calculation must return:
  - `accepts`: sum of Success from all buckets
  - `total`: sum of Sum from all buckets
  - `workingBuckets`: count of consecutive buckets (from most recent) with Success > 0 and Failure == 0
  - `failingBuckets`: count of consecutive buckets (from most recent) with Failure > 0 and Success == 0
- Empty buckets (with no events) are not counted as working or failing buckets

---

## FR7: Recovery Time Optimization via Working Buckets

**Problem**: The circuit breaker recovers slowly after a service returns to healthy state because the drop ratio calculation does not account for recent successful operation.

**Requirements**:
- Track the number of consecutive working buckets (buckets with successes and no failures) in the history
- Reduce the effective drop ratio proportionally when working buckets are detected
- The drop ratio reduction formula must scale based on the ratio of working buckets to total buckets
- This adjustment must apply after the initial drop ratio calculation and before the probabilistic check

**Acceptance**:
- The drop ratio reduction formula: `dropRatio *= (buckets - workingBuckets) / buckets`
- This adjustment is applied after the force-pass check and before the probabilistic rejection decision
- When recent buckets show successful requests, the effective drop ratio is reduced
- As more consecutive working buckets accumulate, the breaker allows more requests through

---

## FR8: Fallback Type Definition

**Problem**: The fallback parameter in breaker methods uses an inline function type, making the API verbose and less self-documenting.

**Requirements**:
- Define a named type `Fallback` representing the fallback handler function signature
- Update all method signatures in the `Breaker` interface to use the `Fallback` type
- Update all implementations to use the `Fallback` type
- Update package-level convenience functions to use the `Fallback` type

**Acceptance**:
- Define and export the type: `type Fallback func(err error) error`
- The `Breaker` interface methods must use the `Fallback` type
- Package-level functions must use the `Fallback` type
- Existing code using inline function literals continues to work due to Go's type compatibility

---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
