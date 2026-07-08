# Software Requirements Specification: Configuration System Improvements

## Overview

This milestone addresses improvements to the go-zero configuration system and provides an optional build mechanism for reducing binary size. The requirements include:

1. **FR1**: Fix multi-layer map handling in configuration parsing
2. **FR2**: Add build tag support to exclude Kubernetes resolver for smaller binaries

**Affected Modules**:
- Configuration loading and field mapping (`core/conf`)
- gRPC resolver registration (`zrpc/resolver/internal`)

---

## Requirements

### FR1: Fix Multi-Layer Map Configuration Parsing

**Problem**: Configuration files containing nested maps (e.g., `map[string]map[string]Value`) fail to parse correctly when the keys are processed through case normalization.

**User Report**:
```
When loading TOML configuration with nested map structures like:
[Value.first.User1.User]
Name = "foo"
[Value.second.User2.User]
Name = "bar"

The configuration fails to parse correctly into a struct with field:
Value map[string]map[string]Value

The nested map keys are not properly handled during case normalization,
causing the values to be lost or incorrectly mapped.
```

**Requirements**:
- Multi-layer map configurations must be parsed correctly
- When a configuration field is typed as `map[string]map[string]T` (nested maps), all levels of map keys must be preserved during parsing
- Case normalization for configuration keys must properly traverse through all nested map layers
- The field info building process must recognize map element types and recursively build field information for them

**Acceptance**:
- When loading a TOML configuration with a nested map structure `map[string]map[string]Value`, the outer map contains the expected number of entries
- When configuration keys at any nesting level do not match known struct fields, they are preserved and passed through for map-typed fields
- When a struct contains map fields whose values are also maps, the entire hierarchy is correctly populated from the configuration source

---

### FR2: Kubernetes Build Tag for Binary Size Reduction

**Problem**: Applications that do not use Kubernetes for service discovery still include the Kubernetes resolver code and its dependencies, resulting in unnecessarily large binary sizes.

**User Report**:
```
The go-zero binary includes Kubernetes client libraries even when we only use
etcd or direct service discovery. This significantly increases our binary size.
We need a way to build without Kubernetes support to reduce the final binary.
```

**Requirements**:
- Provide a build tag mechanism to exclude Kubernetes resolver support from the compiled binary
- When the exclusion build tag is used, the Kubernetes resolver and its dependencies should not be compiled into the binary
- The default build (without the tag) must continue to include full Kubernetes support for backward compatibility
- Other resolver types (direct, discov, etcd) must remain available regardless of the build tag setting

**Acceptance**:
- The implementation must split `zrpc/resolver/internal/resolver.go` into three files:
  - `resolver.go` — core resolver types, constants, and an unexported `register()` function that registers direct, discov, and etcd schemes. Must NOT contain `k8sResolverBuilder` or `RegisterResolver`
  - `register.go` — with build tag `//go:build no_k8s`, exports `RegisterResolver()` that calls `register()` without k8s
  - `register_k8s.go` — with build tag `//go:build !no_k8s`, declares `k8sResolverBuilder` variable and exports `RegisterResolver()` that calls `register()` plus registers the k8s resolver
- When building with the `no_k8s` build tag, the Kubernetes resolver is not registered and k8s-related dependencies are not included
- When building without any special build tags, all resolvers including Kubernetes are registered (default behavior unchanged)
- When using direct, discov, or etcd resolver schemes, they function correctly regardless of whether the Kubernetes exclusion tag is used


---

# Environment Dependency Changes (relative to Base Env)

## Go Runtime
- Go upgraded to 1.21.13 (from 1.19.13)

## Environment Variables
- GOMODCACHE set to /go/pkg/mod
- PATH updated to prioritize /usr/local/go/bin
- EXCLUDE_TEST_FILES set (list of test files to exclude with build tag)
