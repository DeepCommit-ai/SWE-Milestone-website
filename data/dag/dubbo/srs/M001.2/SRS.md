# Software Requirements Specification: Spring 6 Security Module Split and UTF-8 Standardization

## Overview

This milestone addresses two related concerns in the Apache Dubbo framework:

1. **FR1**: Create a dedicated `dubbo-spring6-security` module to support Spring 6 and Spring Boot 3 users, separating OAuth2 functionality that requires JDK 17+ from the base Spring Security integration module
2. **FR2**: Standardize character encoding to UTF-8 across security-related codecs and other system components for consistent character handling

**Affected Modules**:
- `dubbo-plugin/dubbo-spring-security`
- `dubbo-plugin/dubbo-spring6-security` (new)
- `dubbo-common`
- `dubbo-plugin/dubbo-auth`
- `dubbo-plugin/dubbo-qos`
- `dubbo-plugin/dubbo-triple-websocket`
- `dubbo-registry/dubbo-registry-multicast`
- `dubbo-registry/dubbo-registry-zookeeper`
- `dubbo-remoting/dubbo-remoting-api`
- `dubbo-remoting/dubbo-remoting-zookeeper-curator5`
- `dubbo-rpc/dubbo-rpc-api`

---

## FR1: Spring 6 Security Module for Modern Spring Framework Support

**Problem**: Users running Spring Boot 3 and Spring 6 cannot use OAuth2 security features from `dubbo-spring-security` because the OAuth2-related classes (such as `ClientSettings` and `TokenSettings` from Spring Authorization Server) require JDK 17+, while the base module must maintain compatibility with older JDK versions.

**Requirements**:

- Create a new Maven module `dubbo-spring6-security` under `dubbo-plugin` that provides OAuth2 security integration for Spring 6 and Spring Boot 3 environments
- The new module must depend on Spring 6 and Spring Security 6 libraries
- The new module must require JDK 17 as the minimum compilation target
- The new module should depend on `dubbo-spring-security` to reuse common serialization infrastructure
- All OAuth2-related code (the `oauth2` package) must be moved from `dubbo-spring-security` to the new module
- The base `dubbo-spring-security` module must remove OAuth2 dependencies and must continue working for users on older Spring versions without OAuth2 features
- The new module must register its OAuth2 serialization support through Dubbo's SPI extension mechanism, allowing dynamic registration when the module is present on the classpath
- The new module must be properly integrated into the project build system:
  - Added to the BOM for dependency management
  - Listed in the project artifacts registry
  - Included in the test dependency aggregation module
  - Proper SPI configuration files under `META-INF/dubbo/internal/`

**Acceptance**:

- When a user includes `dubbo-spring6-security` in a Spring Boot 3 application, OAuth2 security context serialization and deserialization works correctly
- OAuth2 authentication tokens and client registration objects can be serialized and deserialized without data loss
- When running on JDK 8 or JDK 11 with only `dubbo-spring-security`, the application compiles and runs without errors related to missing JDK 17 classes
- The new module passes all project structure validation checks

---

## FR2: UTF-8 Character Encoding Standardization (Code Quality Improvement)

**Note**: This is a code quality improvement with no dedicated behavioral tests. The changes ensure consistent UTF-8 encoding across security-related codecs and network communication components.

**Problem**: Multiple components use `String.getBytes()` without specifying a charset, which relies on the JVM's platform default encoding and may cause inconsistent behavior across different operating systems.

**Scope**: All `String.getBytes()` calls in security-sensitive and network communication code are updated to explicitly specify UTF-8 charset.

---

## Acceptance Test Reference

### FR1 Tests
- OAuth2 serialization tests in `dubbo-spring6-security` module
- Project structure validation tests

### FR2 Tests
- No dedicated behavioral tests (code quality improvement only)

---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
