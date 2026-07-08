# Software Requirements Specification: Etcd Config Center Infrastructure

## Overview

This milestone delivers a configuration center infrastructure with etcd backend for the go-zero framework. The implementation provides:

1. **FR1**: Generic Configurator interface for type-safe configuration management
2. **FR2**: Subscriber pattern for dynamic configuration updates
3. **FR3**: etcd subscriber implementation for backend storage
4. **FR4**: Pluggable unmarshaler registry supporting multiple configuration formats
5. **FR5**: Exact key matching mode for etcd operations
6. **FR6**: Etcd watch stream recovery from compaction errors
7. **FR7**: Optimized locking mechanisms in etcd registry
8. **FR8**: Improved error logging with key context
9. **FR9**: Kubernetes resolver lifecycle management

**Affected Modules**:
- `core/configcenter/` - New configuration center package (NOTE: uses `package configurator`, not `package configcenter`)
- `core/configcenter/subscriber/` - New subscriber interface and etcd implementation
- `core/discov/internal/` - Registry modifications for exact match support
- `core/discov/` - Subscriber options for exact key matching
- `zrpc/resolver/internal/` - Kubernetes resolver improvements

---

## Requirements

### FR1: Generic Configurator Interface

**Problem**: Applications need a type-safe mechanism to retrieve and manage configuration from a centralized configuration store with automatic deserialization into Go structs.

**Requirements**:
- Implement a generic Configurator interface that supports any configuration type
- Provide a method to retrieve the current configuration as a typed value
- Provide a method to register callbacks for configuration change notifications
- Support struct types, array/slice types, and string types as configuration value types
- Return appropriate errors when configuration is empty or the type cannot be unmarshaled
- Provide constructors that initialize configuration before returning (with error and must variants)
- Load and validate configuration on initialization before returning the configurator
- Execute registered listeners asynchronously in goroutines when configuration changes
- Abort listener notification if configuration reload fails during a change event

**Acceptance**:
- A generic configurator constructor must accept a configuration object and a Subscriber interface
- Both standard and must-variant constructors must be provided
- The Config struct must include:
  - A `Type` string field with default value `"yaml"` and valid options `[yaml, json, toml]`
  - A `Log` bool field with default value `true`
- When GetConfig() is called with an empty configuration value, an error is returned
- When a listener is registered and configuration changes, the listener callback is invoked
- When configuration is a valid string matching the type parameter, it is correctly deserialized
- When the configuration center is created with an invalid format type, an error is returned
- When configuration reload fails during a change event, listeners are not notified
- When type parameter T is `any` or `interface{}` (resulting in nil reflect.Type), an error must be returned
- When type parameter is an unsupported kind (not struct, array, slice, or string), an error is returned

---

### FR2: Subscriber Interface

**Problem**: The configuration center needs an abstraction layer for different backend storage systems to enable pluggable configuration sources.

**Requirements**:
- Define a Subscriber interface with methods for adding listeners and retrieving values
- The interface should be backend-agnostic to support multiple storage implementations
- Listeners should be notified when the underlying configuration value changes
- The value retrieval method returns the current configuration as a raw string

**Acceptance**:
- The Subscriber interface must be defined in package `core/configcenter/subscriber`
- The interface must declare methods for adding listeners (with error return) and retrieving values (as string with error return)
- When a custom subscriber implementation is provided to the configurator, it correctly receives listener registrations
- When the subscriber's value changes, registered listeners are invoked

---

### FR3: Etcd Subscriber Implementation

**Problem**: Applications using etcd as their configuration store need a subscriber implementation that integrates with the existing etcd discovery infrastructure.

**Requirements**:
- Implement an etcd-based subscriber that wraps the existing discovery Subscriber
- Support etcd connection configuration including hosts, key, user/password authentication, and TLS certificates
- Use exact key matching (not prefix-based) for configuration lookup
- Provide both standard and must-variant constructors
- When multiple values exist for a key, return the last value
- Re-export EtcdConf type from the discov package for configuration convenience

**Acceptance**:
- An etcd subscriber constructor must be provided in package `core/configcenter/subscriber`
- A must-variant constructor must call appropriate error handling on error
- EtcdConf must be re-exported as a type alias
- The etcd subscriber must automatically apply exact match mode when creating the underlying subscriber
- When etcd subscriber is created with valid configuration, it successfully connects and retrieves values
- When authentication credentials are provided, they are passed to the underlying etcd client
- When TLS configuration is provided, secure connections are established
- When the key has a value in etcd, Value() returns the last value from the underlying values collection

---

### FR4: Pluggable Unmarshaler Registry

**Problem**: Different applications use different configuration formats (JSON, YAML, TOML), and the system needs to support multiple formats with the ability to register custom unmarshalers.

**Requirements**:
- Implement an unmarshaler registry that maps format names to loader functions
- Pre-register unmarshalers for "json", "yaml", and "toml" formats using the framework's existing loaders
- Provide a function for custom format registration
- Provide a function to retrieve unmarshalers by name
- Support case-insensitive format name lookup
- Use thread-safe operations for registry access
- The loader function type signature should be `func([]byte, any) error`

**Acceptance**:
- The LoaderFn type and registry functions must be in the main configurator package
- Pre-registered unmarshalers must use the framework's standard loaders for json, toml, and yaml
- When requesting the "json" unmarshaler, a valid loader function is returned
- When requesting the "yaml" unmarshaler, a valid loader function is returned
- When requesting the "toml" unmarshaler, a valid loader function is returned
- When a custom unmarshaler is registered, it can be retrieved by name
- When requesting an unknown unmarshaler name, false is returned as the second value

---

### FR5: Exact Key Matching for Etcd Operations

**Problem**: The existing etcd subscriber uses prefix-based key matching, which is unsuitable for configuration center use cases where exact key matching is required.

**Requirements**:
- Add support for exact key matching mode in the etcd registry monitor
- Implement a subscriber option that enables exact key matching mode (disabling prefix-based querying)
- When exact match is enabled, etcd Get operations should not use prefix options
- When exact match is enabled, etcd Watch operations should not use prefix options
- The exact match mode should be propagated through the registry and cluster chain

**Acceptance**:
- A WithExactMatch() option must be defined in `core/discov` package
- The Subscriber must have internal state to track exact match mode
- Registry Monitor method must accept exact match parameters
- The cluster must apply exact match mode to control Get/Watch behavior
- When exact match option is used, only the exact key is watched and retrieved
- When exact match is not enabled, prefix-based queries continue to work as before

---

### FR6: Etcd Watch Stream Compaction Recovery

**Problem**: When etcd compacts its history, watch streams using old revisions fail with compaction errors, causing the watch to stop receiving updates permanently.

**Requirements**:
- Detect compaction errors from the etcd watch stream
- When compaction error is detected and a revision was being tracked, reload the current state from etcd
- Update the revision to the new value after reload to continue watching from the correct point
- The watch stream method should return errors instead of boolean to enable error type inspection
- Log a message indicating compaction recovery is being attempted

**Acceptance**:
- The watch stream method signature must change from returning boolean to returning error
- Compaction errors must be detected using `errors.Is()` with `rpctypes.ErrCompacted` from package `go.etcd.io/etcd/api/v3/v3rpc/rpctypes`
- When compaction error is detected, the watcher reloads state and continues watching
- Closed watch channels must be distinguishable from canceled watches via error types
- When the watch is canceled, return an error wrapping the underlying error
- When the watch channel closes normally, nil is returned

---

### FR7: Optimized Locking in Etcd Registry

**Problem**: The etcd registry uses mutex locks for all operations, causing unnecessary contention for read-only operations.

**Requirements**:
- Change the Registry and cluster locks from exclusive to read-write locks
- Use read locks for read-only operations such as getting current values and handling watch events
- Use write locks for operations that modify state
- Implement double-check locking pattern to avoid creating duplicate clusters

**Acceptance**:
- The Registry must have read-write lock support
- The cluster must have read-write lock support
- Read-only operations must use read locks to allow concurrent access
- Write operations must use write locks
- Double-check locking must be implemented: first check with read lock, then re-check after acquiring write lock
- When multiple goroutines read cluster data concurrently, they do not block each other
- When a cluster is created, double-check locking prevents duplicate cluster creation

---

### FR8: Improved Error Logging with Key Context

**Problem**: Error logs during etcd key loading do not include the key being accessed, making debugging difficult.

**Requirements**:
- Include the key name in error log messages when etcd Get operations fail during key loading
- Use structured logging format that includes both the error message and the key

**Acceptance**:
- Error logging must include key information when etcd Get operations fail
- When an etcd Get operation fails, the error log message includes the key being accessed

---

### FR9: Kubernetes Resolver Lifecycle Management

**Problem**: The Kubernetes resolver uses a global process done channel for the informer factory, preventing proper cleanup when the resolver is closed.

**Requirements**:
- Implement a proper resolver struct that manages its own lifecycle
- Create a dedicated stop channel per resolver instance
- Implement a Close() method to properly stop the informer by closing the stop channel
- Start the informer in a safe goroutine using the resolver's own stop channel
- Implement the required ResolveNow method (can be a no-op as the informer handles updates automatically)

**Acceptance**:
- The resolver must have internal state for managing its lifecycle including client connection, stop channel, and informer factory
- Close() method must close the stop channel to stop the informer
- ResolveNow method is implemented (can be a no-op since informer pattern handles updates automatically)
- The informer is started in a safe goroutine with proper cleanup on resolver close
- Build method must return a resolver supporting the Close() method
- When Close() is called on the resolver, the informer factory stops receiving updates
- When multiple resolvers are created, each has an independent lifecycle

---

# Environment Dependency Changes (relative to Base Env)

## Go Runtime
- Go upgraded to 1.20.14

## Environment Variables
- GOROOT set to /usr/local/go
