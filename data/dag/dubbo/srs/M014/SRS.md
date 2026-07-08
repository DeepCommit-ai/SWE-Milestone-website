# Software Requirements Specification: Java 21 Virtual Thread Pool Auto-configuration

## Overview

This specification defines the requirements for enabling automatic configuration of Dubbo's virtual thread pool when Spring Boot's virtual threads feature is enabled. The enhancement provides seamless integration between Spring Boot's virtual thread configuration and Dubbo's thread pool management for Spring Boot applications running on Java 21+.

### Requirements Summary

1. **FR1**: Auto-configure Dubbo protocol thread pool to use virtual threads when Spring Boot's virtual thread support is enabled

### Affected Components

- Dubbo Spring Boot environment post-processor
- Dubbo protocol thread pool configuration

---

## Functional Requirements

### FR1: Virtual Thread Pool Auto-configuration for Spring Boot Integration

**Problem**: When users enable Spring Boot's virtual thread support (`spring.threads.virtual.enabled=true`) in Java 21+ applications, Dubbo does not automatically configure its protocol thread pool to use virtual threads, requiring manual configuration of `dubbo.protocol.threadpool=virtual` separately.

**Requirements**:
- Detect when Spring Boot's virtual thread property (`spring.threads.virtual.enabled`) is set to `true`
- Automatically configure Dubbo's protocol thread pool to use virtual threads when Spring's virtual thread support is enabled
- Apply this configuration as a default property during Spring Boot's environment post-processing phase, ensuring it can still be overridden by explicit user configuration
- The auto-configuration should only activate when the Spring virtual threads property is explicitly set to `true`

**Acceptance**:
- When `spring.threads.virtual.enabled=true` is set in the Spring environment (as a string value `"true"`), the Dubbo protocol thread pool configuration (`dubbo.protocol.threadpool`) should automatically be set to `"virtual"` in the default properties
- When `spring.threads.virtual.enabled` is not set or set to a value other than `"true"`, no automatic thread pool configuration should be applied
- The auto-configured property must be added to the `MapPropertySource` named `"defaultProperties"` (accessible via `propertySources.get("defaultProperties")`), not just to the environment, allowing it to be overridden by user-specified properties with higher precedence


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
