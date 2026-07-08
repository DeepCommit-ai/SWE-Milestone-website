# Software Requirements Specification: Environment Variable Key Resolution Enhancement

## Overview

This specification defines requirements for enhancing Dubbo's environment variable configuration resolution to support multiple naming conventions commonly used in containerized and Spring Boot environments.

### Requirements Summary

1. **FR1**: Support environment variable keys containing hyphens when resolving configuration properties
2. **FR2**: Support multiple environment variable naming conventions with defined priority order
3. **FR3**: Maintain backward compatibility with existing environment variable configurations

### Affected Module

- dubbo-common: Environment configuration resolution

### Implementation Location

- **Class**: `org.apache.dubbo.common.config.EnvironmentConfiguration`
- **Method**: `getInternalProperty(String key)` - this is the method that must implement the enhanced resolution logic
- **Environment Access**: Implementation must use the protected `getenv()` method (returning `Map<String, String>`) for all environment variable lookups, enabling test mocking

---

## Requirements

### FR1: Support Hyphenated Environment Variable Key Resolution

**Problem**: Configuration properties containing hyphens (e.g., `dubbo.abc-def.ghi`) cannot be resolved from environment variables in Kubernetes and container deployments where environment variable names may use different hyphen-handling conventions.

**Requirements**:
- Environment variable resolution must handle configuration keys that contain hyphens (the `-` character)
- When a dotted configuration key like `dubbo.abc-def.ghi` is requested, the system must be able to find matching environment variables regardless of how hyphens are encoded
- Support environment variables where hyphens are converted to underscores (e.g., `DUBBO_ABC_DEF_GHI`)
- Support environment variables where hyphens are simply removed (e.g., `DUBBO_ABCDEF_GHI`)
- Support environment variables where hyphens are preserved (e.g., `DUBBO_ABC-DEF_GHI`)

**Acceptance**:
- When requesting property `dubbo.abc-def.ghi` and environment variable `DUBBO_ABC_DEF_GHI` is set, the value is returned
- When requesting property `dubbo.abc-def.ghi` and environment variable `DUBBO_ABCDEF_GHI` is set (hyphens removed), the value is returned
- When requesting property `dubbo.abc-def.ghi` and environment variable `DUBBO_ABC-DEF_GHI` is set (hyphens preserved), the value is returned

---

### FR2: Environment Variable Resolution Priority Order

**Problem**: When multiple environment variables could match a single configuration key (using different naming conventions), there is no defined precedence for which value should be returned.

**Requirements**:
- Define a clear priority order for candidate environment variable key formats
- When multiple matching environment variables exist, return the value from the highest-priority match
- The priority order must prefer the most normalized/standard format first:
  1. Exact key match (highest priority)
  2. Fully normalized uppercase format (dots and hyphens converted to underscores)
  3. Spring Boot relaxed binding format (dots to underscores, hyphens removed)
  4. Dots-to-underscores uppercase format (hyphens preserved)
  5. Fully normalized lowercase format
  6. Legacy OS-style key format (lowest priority)

**Acceptance**:
- When both `DUBBO_ABC_DEF_GHI` and `DUBBO_ABCDEF_GHI` are set, requesting `dubbo.abc-def.ghi` returns the value from `DUBBO_ABC_DEF_GHI`
- When only `DUBBO_ABCDEF_GHI` and `DUBBO_ABC-DEF_GHI` are set, requesting `dubbo.abc-def.ghi` returns the value from `DUBBO_ABCDEF_GHI`
- When only `DUBBO_ABC-DEF_GHI` and `dubbo_abc_def_ghi` are set, requesting `dubbo.abc-def.ghi` returns the value from `DUBBO_ABC-DEF_GHI`
- When only `dubbo_abc_def_ghi` is set, requesting `dubbo.abc-def.ghi` returns the value from `dubbo_abc_def_ghi`
- When no matching environment variable exists, return null

---

### FR3: Backward Compatibility with Existing Configurations

**Problem**: Existing deployments rely on the current environment variable resolution behavior, and changes must not break working configurations.

**Requirements**:
- All previously working environment variable configurations must continue to work
- Support for legacy OS-style keys (uppercase, dots to underscores, DUBBO_ prefix) must be preserved
- Resolution of simple keys without hyphens must behave identically to before
- Empty or null key lookups must return null without errors

**Acceptance**:
- When environment variable `DUBBO_KEY` is set, requesting property `dubbo.key` returns the value
- When environment variable `DUBBO_KEY` is set, requesting property `key` returns the value
- When environment variable `DUBBO_KEY` is set, requesting property `dubbo_key` returns the value
- When environment variable `DUBBO_KEY` is set, requesting property `DUBBO_KEY` (exact match) returns the value
- When requesting a property with an empty or null key, null is returned


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
