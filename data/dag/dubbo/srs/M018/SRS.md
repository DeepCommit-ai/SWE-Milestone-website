# Software Requirements Specification: Performance Optimizations

## Overview

This milestone addresses performance inefficiencies in three critical hot code paths within the Dubbo framework:

1. **FR1 (EXTENDED)**: Wrapper class retrieval performs redundant checks on every call
2. **FR2 (EXTENDED)**: Charset parsing from content-type headers uses inefficient string splitting
3. **FR3 (EXTENDED)**: Serialization security interface registration performs redundant type checking

### Affected Modules
- `dubbo-common` (bytecode wrapper, serialization security)
- `dubbo-remoting-http12` (HTTP utilities, request/response handling)

---

## Requirements

### FR1 (EXTENDED): Wrapper Class Retrieval Redundant Check Elimination

**Problem**: The `Wrapper.getWrapper()` method performs dynamic class detection and Object.class comparison on every invocation, including for classes that already have cached wrapper instances.

**Requirements**:
- Eliminate redundant dynamic class hierarchy traversal for classes that are already cached in the wrapper map
- Eliminate redundant Object.class comparison for cached classes
- Ensure that dynamic class detection (proxy classes generated at runtime) still correctly resolves to their superclass wrappers
- Ensure that Object.class still returns the specialized OBJECT_WRAPPER instance
- Maintain thread-safety and cache consistency for concurrent access

**Acceptance**:
- When `getWrapper()` is called repeatedly for the same class, the dynamic class check and Object.class comparison should only execute once during initial wrapper creation
- When `getWrapper()` is called for a dynamically-generated proxy class, it correctly traverses to the first non-dynamic superclass before caching
- When `getWrapper()` is called for `Object.class`, it returns the predefined OBJECT_WRAPPER
- Existing wrapper retrieval functionality remains unchanged from a behavioral perspective

---

### FR2 (EXTENDED): Charset Parsing Method Optimization

**Problem**: The HTTP utilities method for extracting charset from Content-Type headers uses `String.split(";")` which creates a regex pattern and allocates an array, even when only the first segment is needed.

**Requirements**:
- Replace the string split operation with a more efficient substring-based approach for extracting charset values
- Handle Content-Type headers with multiple parameters (e.g., charset combined with boundary parameters)
- Preserve trimming behavior for charset values with leading/trailing whitespace
- Return empty string when charset is not specified in the Content-Type
- Consider renaming the method to follow clearer naming conventions

**Acceptance**:
- The charset parsing method should use efficient string operations instead of regex-based splitting
- HTTP request and response charset retrieval continues to work correctly with the optimized parsing
- Content-Type headers with various formats (with or without charset, with multiple parameters) are parsed correctly

---

### FR3 (EXTENDED): Serialization Security Type Registration Caching

**Problem**: The `SerializeSecurityConfigurator.registerInterface()` method creates a new `HashSet` for tracking marked types on each invocation, causing redundant type graph traversal when the same types are encountered across multiple interface registrations.

**Requirements**:
- Introduce instance-level caching of already-processed types to avoid redundant type graph traversal
- Cache both Class types and generic Type instances (ParameterizedType, GenericArrayType, TypeVariable, WildcardType)
- Skip processing for types that have already been registered in a previous `registerInterface()` call
- Maintain correct behavior for all type categories: simple types, primitives, arrays, JDK types, interfaces, superclasses, and fields
- Preserve the allow-list registration for serialization security

**Acceptance**:
- When `registerInterface()` is called multiple times with interfaces sharing common parameter/return types, the shared types are only processed once
- When registering an interface that uses generic types, both the raw type and the type arguments are cached
- When registering interfaces with complex type hierarchies (superclasses, interfaces, generic bounds), all types in the graph are cached for reuse
- Serialization allow-list entries are correctly generated for all types in the interface method signatures
- The first call to `registerInterface()` for a given type returns true (indicating processing occurred), subsequent calls with the same type can short-circuit

---

## Verification

The following REST protocol bean argument handling tests verify that the optimizations maintain correct functionality for bean argument binding:

- Bean argument POST requests at `/buy` and `/buy2` with various body formats (single beans, positional arrays, and named parameters)
- Bean argument POST requests at `/beanArgTest` with named parameters
- Complex bean property binding including nested objects, collections, and maps

**Note**: FR1, FR2, and FR3 are marked as EXTENDED because the available tests focus on REST protocol bean argument handling, which exercises the code paths indirectly but does not directly validate the specific performance optimizations described above


---

# Environment Dependency Changes (relative to Base Env)

## System Packages
- python3 added
