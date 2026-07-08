# Software Requirements Specification: Bouncy Castle JDK18 Security Upgrade

## Overview

This specification defines the requirements for upgrading the Bouncy Castle cryptographic library dependencies in Dubbo's security plugin to ensure compatibility with modern Java runtimes (JDK 18+) and incorporate the latest security patches.

### Requirements Summary

1. **FR1**: Migrate Bouncy Castle artifacts from legacy JDK15on variants to modern JDK18on variants
2. **FR2**: Upgrade Bouncy Castle library version to 1.81
3. **FR3**: Remove deprecated extended provider dependency

### Affected Modules

- `dubbo-plugin/dubbo-security` - Security plugin module
- `dubbo-dependencies-bom` - Bill of Materials (BOM) for dependency version management

---

## Functional Requirements

### FR1: Migrate Bouncy Castle Artifacts to JDK18on Variants

**Problem**: The current Bouncy Castle dependencies use legacy `jdk15on` artifact variants that are incompatible with JDK 18+ runtimes and no longer receive updates.

**Requirements**:
- Replace the Bouncy Castle provider artifact with its JDK 18+ compatible variant
- Replace the Bouncy Castle PKIX artifact with its JDK 18+ compatible variant
- Ensure all cryptographic functionality (certificate handling, TLS operations) continues to work correctly after migration
- Maintain backward compatibility with existing security configurations

**Acceptance**:
- When building the dubbo-security module with JDK 18 or later, the build completes successfully without dependency resolution errors
- When TLS/SSL security operations are performed, the cryptographic provider initializes and operates correctly
- When certificate operations are executed, PKIX functionality works as expected

---

### FR2: Upgrade Bouncy Castle Version to 1.81

**Problem**: The current Bouncy Castle version is outdated and lacks security patches and improvements included in recent releases.

**Requirements**:
- Update the Bouncy Castle version property in the dependency BOM to version 1.81
- Ensure all Bouncy Castle artifacts use the same consistent version
- The version upgrade must include security fixes released in Bouncy Castle 1.81

**Acceptance**:
- When inspecting the resolved dependencies, all Bouncy Castle artifacts resolve to version 1.81
- When running security-related functionality, no version mismatch or compatibility errors occur
- When the project builds, dependency resolution completes without conflicts

---

### FR3: Remove Deprecated Extended Provider Dependency

**Problem**: The extended provider artifact (`bcprov-ext-jdk15on`) is deprecated and no longer necessary for Dubbo's security requirements. It adds unnecessary dependency bloat and potential security surface area.

**Requirements**:
- Remove the deprecated extended provider dependency from the security module
- Remove the corresponding declaration from the BOM if present
- Verify that no functionality depends on the extended provider's additional algorithms

**Acceptance**:
- When building the dubbo-security module, compilation succeeds without the extended provider dependency
- When all existing security tests pass, the removal does not break any functionality
- When inspecting the dependency tree, the extended provider artifact is not present

---

## Non-Functional Requirements

### Security

- The upgrade addresses known vulnerabilities fixed in Bouncy Castle versions between the current version and 1.81
- The JDK18on artifacts are the officially recommended variants for modern Java deployments

### Compatibility

- The security plugin must remain functional with JDK 17 LTS (minimum supported version)
- The security plugin must work correctly with JDK 18, 19, 20, 21, and later versions
- Existing applications using Dubbo's security features should not require code changes

### Maintainability

- Version management must be centralized in the BOM for consistency
- Individual modules should inherit versions from the BOM without explicit version declarations


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
