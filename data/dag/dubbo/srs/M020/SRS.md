# Software Requirements Specification: Test Infrastructure Cleanup

## Overview

This milestone addresses test infrastructure dependency management issues across multiple Dubbo modules. The changes involve restructuring test-scoped dependencies to eliminate unnecessary inheritance from parent POM modules and ensure dependencies are declared only where actually required.

### Requirements Summary

1. **FR1**: Remove `dubbo-test-check` dependency from `dubbo-metrics` parent module
2. **FR2**: Remove `dubbo-test-check` dependency from `dubbo-registry` parent module
3. **FR3**: Remove `dubbo-test-check` dependency from `dubbo-remoting` parent module and add it to specific submodules that require it
4. **FR4**: Remove `dubbo-test-check` dependency from `dubbo-serialization` parent module
5. **FR5**: Remove `dubbo-test-common` dependency from `dubbo-remoting-zookeeper-curator5` submodule

### Affected Modules

- `dubbo-metrics/pom.xml`
- `dubbo-registry/pom.xml`
- `dubbo-remoting/pom.xml`
- `dubbo-remoting/dubbo-remoting-api/pom.xml`
- `dubbo-remoting/dubbo-remoting-http12/pom.xml`
- `dubbo-remoting/dubbo-remoting-http3/pom.xml`
- `dubbo-remoting/dubbo-remoting-netty/pom.xml`
- `dubbo-remoting/dubbo-remoting-netty4/pom.xml`
- `dubbo-remoting/dubbo-remoting-websocket/pom.xml`
- `dubbo-remoting/dubbo-remoting-zookeeper-curator5/pom.xml`
- `dubbo-serialization/pom.xml`

---

## Functional Requirements

### FR1: Remove Test Dependency from dubbo-metrics Parent Module

**Problem**: The `dubbo-metrics` parent module declares a test-scoped dependency on `dubbo-test-check` that is inherited by all submodules, even those that do not require it.

**Requirements**:
- Remove the `dubbo-test-check` dependency declaration from the `dubbo-metrics` parent POM
- Ensure submodules that require test infrastructure dependencies declare them explicitly

**Acceptance**:
- When building the `dubbo-metrics` module, no test dependencies are inherited from the parent POM
- All existing tests in `dubbo-metrics` submodules continue to compile and execute successfully

---

### FR2: Remove Test Dependency from dubbo-registry Parent Module

**Problem**: The `dubbo-registry` parent module declares a test-scoped dependency on `dubbo-test-check` that is unnecessarily inherited by all registry implementation submodules.

**Requirements**:
- Remove the `dubbo-test-check` dependency declaration from the `dubbo-registry` parent POM
- Registry submodules that need test infrastructure should declare dependencies explicitly at the submodule level

**Acceptance**:
- When building the `dubbo-registry` module, no blanket test dependencies are inherited from the parent POM
- All registry-related tests continue to compile and execute successfully

---

### FR3: Restructure Test Dependencies in dubbo-remoting Module

**Problem**: The `dubbo-remoting` parent module declares a test-scoped dependency on `dubbo-test-check` that is inherited by all remoting submodules. However, only specific submodules actually require this dependency, while others do not use it at all.

**Requirements**:
- Remove the `dubbo-test-check` dependency declaration from the `dubbo-remoting` parent POM
- Add the `dubbo-test-check` dependency with test scope to the following submodules that require it:
  - `dubbo-remoting-api`
  - `dubbo-remoting-http12`
  - `dubbo-remoting-http3`
  - `dubbo-remoting-netty`
  - `dubbo-remoting-netty4`
  - `dubbo-remoting-websocket`
- Submodules not listed above should not have this dependency

**Acceptance**:
- When building individual remoting submodules, only those that explicitly declare the dependency have access to `dubbo-test-check`
- All remoting-related tests continue to compile and execute successfully
- The REST protocol tests in `dubbo-rpc/dubbo-rpc-triple` module pass, including bean argument handling tests for:
  - `DemoService.buy(Book book)` mapped to POST `/buy`
  - `DemoService.buy(Book book, int count)` mapped to POST `/buy2` via `@Mapping("/buy2")`

---

### FR4: Remove Test Dependency from dubbo-serialization Parent Module

**Problem**: The `dubbo-serialization` parent module declares a test-scoped dependency on `dubbo-test-check` that is inherited by all serialization submodules without necessity.

**Requirements**:
- Remove the `dubbo-test-check` dependency declaration from the `dubbo-serialization` parent POM
- Serialization submodules that require test infrastructure should declare dependencies explicitly

**Acceptance**:
- When building the `dubbo-serialization` module, no test dependencies are inherited from the parent POM
- All serialization-related tests continue to compile and execute successfully

---

### FR5: Remove Unused Test Dependency from dubbo-remoting-zookeeper-curator5

**Problem**: The `dubbo-remoting-zookeeper-curator5` submodule declares a test-scoped dependency on `dubbo-test-common` that is no longer required by the module's tests.

**Requirements**:
- Remove the `dubbo-test-common` dependency declaration from `dubbo-remoting-zookeeper-curator5`
- The module's tests should function without this dependency

**Acceptance**:
- When building `dubbo-remoting-zookeeper-curator5`, the `dubbo-test-common` dependency is not present
- All Curator5-based Zookeeper client tests continue to compile and execute successfully

---

## Acceptance Criteria

### Build Verification
- All affected modules build successfully with `mvn compile`
- All affected modules' tests compile successfully with `mvn test-compile`
- All affected modules' tests execute successfully with `mvn test`

### Dependency Verification
- Parent POMs (`dubbo-metrics`, `dubbo-registry`, `dubbo-remoting`, `dubbo-serialization`) do not declare `dubbo-test-check` as a dependency
- Only explicitly listed `dubbo-remoting` submodules contain `dubbo-test-check` dependency
- `dubbo-remoting-zookeeper-curator5` does not contain `dubbo-test-common` dependency

### Test Verification
- REST protocol tests in `dubbo-rpc/dubbo-rpc-triple` pass (test class: `org.apache.dubbo.rpc.protocol.tri.rest.support.basic.RestProtocolTest`), specifically:
  - Bean argument tests with POST requests to `/buy` and `/buy2` endpoints
  - Tests handling both array-style (`[Book]`, `[Book, count]`) and map-style (`{book: Book, count: int}`) request bodies
  - Response deserialization to `Book` bean with correctly populated `name` attribute


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
