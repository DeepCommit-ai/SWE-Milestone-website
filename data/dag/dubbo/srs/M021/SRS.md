# Software Requirements Specification: Code Cleanup and Refactoring

## Overview

This milestone focuses on code quality improvements through cleanup and refactoring efforts across multiple modules. The changes address:

1. Removal of unused test dependencies from remoting modules
2. Elimination of redundant conditional checks in URL parameter handling
3. Correction of version property inconsistencies in OpenAPI plugin configuration

**Affected Modules:**
- dubbo-remoting (api, http12, http3, netty, netty4, websocket)
- dubbo-common (URL component)
- dubbo-plugin (rest-openapi)

These are non-functional changes that improve maintainability, reduce build complexity, and ensure configuration consistency without altering runtime behavior.

---

## Requirements

### FR1: Remove Unused Test Dependencies from Remoting Modules

**Problem**: Multiple remoting modules declare a test-scoped dependency that is not actually used, adding unnecessary entries to the dependency tree and increasing build complexity.

**Requirements**:
- Remove unused `dubbo-test-check` test dependency declarations from all remoting submodules where this dependency is not utilized
- Ensure the build continues to compile and all tests pass after removal
- Maintain all functional test coverage that currently exists

**Acceptance**:
- When building the dubbo-remoting modules, no reference to the removed dependency should appear in the effective POM for modules that did not use it
- All existing unit and integration tests in the remoting modules continue to pass
- The project compiles successfully with `mvn compile` and `mvn test`

---

### FR2: Eliminate Redundant Conditional Check in URLParam

**Problem**: The `getRawParam()` method in the URL parameter component contains a redundant conditional check that duplicates logic already present in the `toString()` method it calls.

**Requirements**:
- Simplify the `getRawParam()` method to eliminate the duplicate null/empty check
- The method should delegate to `toString()` which already handles the case where `rawParam` is available
- Maintain identical functional behavior - the returned value must be the same as before for all input scenarios

**Acceptance**:
- When `rawParam` is set, `getRawParam()` returns the same value as before
- When `rawParam` is null or empty, `getRawParam()` returns the computed parameter string as before
- Existing unit tests for URLParam continue to pass without modification

---

### FR3: Fix Version Property Inconsistency in OpenAPI Plugin

**Problem**: The dubbo-rest-openapi plugin has a version inconsistency where a dependency uses a hardcoded version that differs from the version declared in the properties section, leading to confusion about which version is actually in use.

**Requirements**:
- Ensure the redoc dependency version is managed through the Maven properties mechanism
- The declared property value and the actual dependency version must be consistent
- The dependency declaration should reference the property rather than hardcoding a version

**Acceptance**:
- When inspecting the effective POM, the redoc dependency version should match the value defined in the `<properties>` section
- The redoc dependency declaration uses the `${redoc.version}` property reference instead of a hardcoded version string
- The plugin builds and functions correctly with the corrected version configuration


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
