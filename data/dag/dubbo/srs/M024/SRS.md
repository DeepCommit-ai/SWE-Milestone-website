# Software Requirements Specification: Configuration Improvements

## Overview

This milestone addresses configuration handling issues in Apache Dubbo, focusing on service registration timing and thread-safe reference bean management in Spring integration.

**Summary of Requirements**:
1. FR1: Service Instance Registration Timing - Ensure service instance registration occurs immediately after service export
2. FR2: Thread-Safe Reference Bean Name Registration - Fix concurrent modification issues in Spring reference bean management

**Affected Modules**:
- `dubbo-common` (deployer interfaces)
- `dubbo-config/dubbo-config-api` (ServiceConfig, DefaultApplicationDeployer, DefaultModuleDeployer)
- `dubbo-config/dubbo-config-spring` (ReferenceBeanManager)

---

## FR1: Service Instance Registration Timing

**Problem**: Service instance registration does not occur immediately after service export, which can cause service discovery issues when services are exported dynamically or outside the normal application startup sequence.

**Requirements**:
- Service instance registration should be triggered immediately after a service is successfully exported
- The registration mechanism must be idempotent to prevent duplicate registrations when multiple services are exported
- The registration operation must be thread-safe to handle concurrent service exports
- The deployer interfaces must expose the registration capability for use by service configuration components

**Acceptance**:
- When a service is exported via ServiceConfig, the service instance is registered with the registry immediately after export completion
- When multiple services are exported concurrently, registration occurs only once
- When a service is exported after the application has already registered, no duplicate registration occurs

**API Contracts**:
- `ApplicationDeployer` interface (`dubbo-common`) must declare method: `void registerServiceInstance()`
- `ModuleDeployer` interface (`dubbo-common`) must declare method: `void registerServiceInstance()`
- `DefaultModuleDeployer.registerServiceInstance()` must delegate to `applicationDeployer.registerServiceInstance()`
- `DefaultApplicationDeployer.registerServiceInstance()` must be:
  - `public` access modifier (changed from `private`)
  - `synchronized` for thread-safety
  - Idempotent: check `registered` flag before performing registration, set flag at start of method
- `ServiceConfig.doExportUrl()` (or equivalent export completion point) must call `getScopeModel().getDeployer().registerServiceInstance()` after successful URL export

---

## FR2: Thread-Safe Reference Bean Name Registration

**Problem**: Concurrent modification exceptions occur when registering reference bean names in the Spring integration layer due to non-thread-safe collection operations.

**Requirements**:
- The reference key to bean name mapping must support concurrent read and write operations without data corruption
- Adding bean names to an existing reference key must be atomic and thread-safe
- Duplicate bean names should not be added to the same reference key
- The implementation must maintain consistency when multiple threads register references simultaneously

**Acceptance**:
- When multiple threads concurrently register reference beans with the same reference key, no ConcurrentModificationException is thrown
- When the same bean name is registered multiple times for the same reference key, it appears only once in the list
- When retrieving bean names by key, the returned list accurately reflects all registered bean names

**API Contracts**:
- `ReferenceBeanManager.referenceKeyMap` field must use `ConcurrentMap<String, CopyOnWriteArrayList<String>>` type (value type changed from `List<String>` to `CopyOnWriteArrayList<String>`)
- `ReferenceBeanManager.registerReferenceKeyAndBeanName()` must use `CopyOnWriteArrayList.addIfAbsent()` for atomic duplicate-prevention (instead of manual `contains()` + `add()` sequence)
- `ReferenceBeanManager.getBeanNamesByKey()` must return `new CopyOnWriteArrayList<>()` as default when key not found (instead of `Collections.EMPTY_LIST`)


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
