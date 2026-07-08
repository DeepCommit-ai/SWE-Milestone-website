# Software Requirements Specification: Dependency Version Updates - Third Party Libraries

## Overview

This milestone consolidates third-party dependency version updates across multiple Dubbo modules to incorporate security patches, bug fixes, and compatibility improvements from upstream dependencies. All updates follow semantic versioning principles and maintain backward compatibility within their respective modules.

### Requirements Summary

1. **FR1**: Update OpenAPI documentation dependencies (Swagger UI, Swagger Annotations, Redoc)
2. **FR2**: Update Apache Curator library for ZooKeeper remoting
3. **FR3**: Update Apollo MockServer for configuration center testing
4. **FR4**: Update TestContainers for integration testing infrastructure
5. **FR5**: Update AspectJ Weaver for AOP testing support

### Affected Modules

- `dubbo-plugin/dubbo-rest-openapi` - REST API documentation support
- `dubbo-remoting/dubbo-remoting-zookeeper-curator5` - ZooKeeper client integration
- `dubbo-configcenter/dubbo-configcenter-apollo` - Apollo configuration center
- `dubbo-config/dubbo-config-api` - Core configuration API
- `dubbo-config/dubbo-config-spring` - Spring integration configuration

---

## Functional Requirements

### FR1: Update OpenAPI Documentation Dependencies

**Problem**: The REST OpenAPI plugin uses outdated versions of Swagger UI, Swagger Annotations, and Redoc libraries that lack recent security patches and feature improvements.

**Requirements**:
- Update Swagger Annotations library from version 2.2.27 to version 2.2.32
- Update Swagger UI WebJar from version 5.18.2 to version 5.22.0
- Update Redoc WebJar from version 2.1.5 to version 2.3.0
- Ensure all OpenAPI annotation processing continues to function correctly
- Maintain compatibility with existing REST service documentation generation

**Acceptance**:
- When building the dubbo-rest-openapi module, compilation succeeds without dependency resolution errors
- When REST services are annotated with OpenAPI annotations, documentation is generated correctly
- When accessing Swagger UI through the exposed endpoints, the updated UI renders properly
- When accessing Redoc documentation, the updated interface displays API specifications correctly

---

### FR2: Update Apache Curator Library

**Problem**: The ZooKeeper remoting module uses an outdated version of Apache Curator that may lack recent bug fixes and performance improvements for distributed coordination.

**Requirements**:
- Update Apache Curator library from version 5.7.1 to version 5.8.0
- Maintain compatibility with ZooKeeper version 3.7.2
- Ensure all ZooKeeper-based service discovery and configuration operations continue to function correctly

**Acceptance**:
- When building the dubbo-remoting-zookeeper-curator5 module, compilation succeeds without dependency conflicts
- When using ZooKeeper for service registration, registry operations complete successfully
- When using ZooKeeper for service discovery, service lookup operations function correctly
- Existing ZooKeeper integration tests pass without modification

---

### FR3: Update Apollo MockServer

**Problem**: The Apollo configuration center module uses an outdated version of the Apollo MockServer testing library.

**Requirements**:
- Update Apollo MockServer from version 2.3.0 to version 2.4.0
- Ensure test infrastructure for Apollo configuration center integration continues to function

**Acceptance**:
- When building the dubbo-configcenter-apollo module, compilation succeeds without dependency issues
- When running Apollo configuration center tests, the mock server initializes and responds correctly
- Existing Apollo integration tests pass without modification

---

### FR4: Update TestContainers Library

**Problem**: The configuration API module uses an outdated version of TestContainers that may lack recent container runtime improvements and bug fixes.

**Requirements**:
- Update TestContainers from version 1.20.4 to version 1.21.0
- Ensure container-based integration tests continue to function with the updated library

**Acceptance**:
- When building the dubbo-config-api module, test dependencies resolve correctly
- When running integration tests that use containers, containers start and stop properly
- Existing container-based tests pass without modification

---

### FR5: Update AspectJ Weaver

**Problem**: The Spring configuration module uses an outdated version of AspectJ Weaver for AOP testing support.

**Requirements**:
- Update AspectJ Weaver from version 1.9.22.1 to version 1.9.24
- Ensure AOP-based tests continue to function correctly with the updated weaver

**Acceptance**:
- When building the dubbo-config-spring module, test dependencies resolve correctly
- When running tests that use AspectJ weaving, aspect application works correctly
- Existing Spring integration tests that rely on AOP pass without modification

---

## General Acceptance Criteria

- All dependency updates must not introduce breaking changes to public APIs
- All existing module tests must continue to pass after updates
- Build process must complete successfully across all affected modules
- No new dependency conflicts or version incompatibilities are introduced
- All transitive dependency resolutions must complete without errors


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
