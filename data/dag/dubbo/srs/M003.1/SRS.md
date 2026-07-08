# Software Requirements Specification: Mutiny Module Configuration and Code Generation Templates

## Overview

This milestone establishes the module configuration and code generation templates for SmallRye Mutiny reactive programming support in Apache Dubbo's Triple protocol. The implementation configures the `dubbo-mutiny` module and provides Mustache templates for generating Mutiny-based service stubs.

**Requirements Summary:**

1. **FR1**: Configure the `dubbo-mutiny` module with proper Maven dependencies
2. **FR2**: Provide Mustache templates for Mutiny-based Triple protocol code generation

**Affected Modules:**
- `dubbo-plugin/dubbo-mutiny`
- `dubbo-plugin/dubbo-compiler`

---

## Requirements

### FR1: Configure dubbo-mutiny Module

**Problem**: The `dubbo-mutiny` module requires proper Maven configuration to enable SmallRye Mutiny integration for Dubbo's Triple protocol.

**Requirements**:
- Configure the module with appropriate parent POM reference
- Declare dependencies on `dubbo-rpc-triple` and SmallRye Mutiny
- Configure Java 17 as the minimum required version for compilation
- Enable Maven deployment for the module artifact

**Acceptance**:
- When building the project with JDK 17+, the `dubbo-mutiny` module compiles successfully
- The module produces a deployable JAR artifact
- The module depends on `dubbo-rpc-triple` for Triple protocol integration

---

### FR2: Mutiny Code Generation Templates

**Problem**: The protobuf compiler plugin lacks templates for generating Mutiny-based service stubs, preventing automatic generation of Mutiny-compatible Triple protocol service interfaces and implementations.

**Requirements**:
- Create Mustache templates for generating Mutiny-based Triple protocol stubs
- Use SmallRye Mutiny reactive types: `Uni<T>` for single-value responses, `Multi<T>` for streaming responses
- Follow the existing Reactor template pattern in `dubbo-compiler` module as reference

**Acceptance**:
- When a Triple service class is loaded, its schema descriptor is registered and can be retrieved via `SchemaDescriptorRegistry.getSchemaDescriptor(serviceName)`
- The retrieved schema descriptor preserves the original proto file name (e.g., `schemaDescriptor.getName()` returns `"message.proto"` for a service defined in `message.proto`)

---

## Test Acceptance Criteria

### Testing Approach

The Mustache templates and pom.xml configuration are indirectly verified through the code generation test:

#### Code Generation Test
- `testMessageGenerator` - Tests the protobuf code generation pipeline which uses the Mustache templates

**Note**: Direct unit tests for Mustache template syntax or pom.xml structure are not provided. Validation is performed through:
1. Successful Maven build (pom.xml correctness)
2. Code generation producing valid Java code (template correctness)

---

# Environment Dependency Changes (relative to Base Env)

## Java/Maven Dependencies
- io.smallrye.reactive:mutiny 2.9.0 added
