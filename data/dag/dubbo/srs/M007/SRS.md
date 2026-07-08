# Software Requirements Specification: Method-Level TPS Rate Limiting

## Overview

This specification defines the requirements for extending the TPS (Transactions Per Second) rate limiting capability in the Dubbo RPC framework from service-level granularity to method-level granularity.

### Requirements Summary

1. **FR1**: Method-Level TPS Rate Limiting - Enable per-method rate limit counters when method-specific TPS configuration is detected
2. **FR2**: Service-Level Fallback Behavior - Maintain service-level rate limiting for methods without explicit method-level TPS configuration
3. **FR3**: Rate Limit Counter Isolation - Ensure method-level and service-level rate limit counters are maintained separately

### Affected Components

- TPS Limiter implementation in the RPC filter layer

---

## Requirements

### FR1: Method-Level TPS Rate Limiting

**Problem**: When a method-specific TPS limit is configured (e.g., `echo.tps=3`), all methods of the service still share the same rate limit counter, causing the method-level configuration to be ineffective for traffic isolation.

**User Report**:
```
I configured method-level TPS for specific high-cost methods in my service,
but the rate limiting doesn't work as expected. When I set echo.tps=3 and
tps=1, my echo method should allow 3 requests per interval, but it seems
to share the counter with other methods.
```

**Requirements**:
- When a method has explicit TPS configuration (e.g., `{methodName}.tps`), the rate limiter shall maintain a separate rate limit counter for that method
- The method-level TPS value shall take precedence over the service-level TPS value for that specific method
- Method-level rate limit counters shall be keyed distinctly from service-level counters to prevent collision

**Acceptance**:
- When `echo.tps=3` and `tps=1` are both configured, invoking the `echo` method should allow 3 requests per interval before being rate limited, not 1
- When a method has explicit TPS configuration, its rate limit counter shall be independent from the service-level counter

---

### FR2: Service-Level Fallback Behavior

**Problem**: When method-level TPS is configured for some methods but not others, methods without explicit configuration should use the service-level TPS limit rather than being affected by other methods' configurations.

**Requirements**:
- Methods without explicit method-level TPS configuration shall use the service-level rate limit counter
- The presence of method-level TPS configuration for other methods in the same service shall not affect methods that rely on service-level configuration
- Service-level TPS configuration shall continue to function as the default rate limiting mechanism

**Acceptance**:
- When `tps=3` (service-level) and `otherMethod.tps=1` are configured, a method without explicit TPS configuration should allow 3 requests per interval
- The service-level rate limit counter shall remain unaffected by method-level configurations on other methods

---

### FR3: Rate Limit Counter Isolation

**Problem**: Rate limit counters for different methods with method-level TPS configuration interfere with each other when they should be isolated.

**Requirements**:
- Each method with explicit TPS configuration shall maintain its own isolated rate limit counter
- Multiple methods with distinct TPS configurations shall not share rate limit state
- Rate limit counter cleanup shall correctly identify and remove the appropriate counter when TPS configuration is disabled

**Acceptance**:
- When `echo.tps=3` and `otherMethod.tps=2` are both configured, the `echo` method shall allow 3 requests per interval regardless of how many requests were made to `otherMethod`
- Disabling TPS for a specific method shall only affect that method's counter, not other methods' counters


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
