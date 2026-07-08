# Software Requirements Specification: Service Infrastructure Improvements

## Overview

This milestone addresses several service infrastructure improvements in the go-zero framework:

1. **FR1**: ServiceGroup shutdown logging should use structured logging
2. **FR2**: DevServer should properly handle disabled configuration
3. **FR3**: Health check response configuration field naming improvement
4. **FR4**: Automatic config validation support
5. **FR5**: ImmutableResource concurrent access race condition fix
6. **FR6**: Machine performance data reading optimization

**Affected Modules**:
- `core/service` - Service group management
- `core/conf` - Configuration loading
- `core/syncx` - Synchronization utilities
- `core/stat` - Statistics and usage reporting
- `core/prof` - Profiling and runtime statistics
- `internal/devserver` - Development server
- `internal/health` - Health check management

**Scope Constraint**: Only modify files within the affected modules listed above. Do not modify files in other packages. Preserve existing API signatures and error message formats for backward compatibility.

---

## Functional Requirements

### FR1: ServiceGroup Shutdown Logging

**Problem**: ServiceGroup shutdown messages are written using the standard library `log` package instead of the framework's structured logging system, resulting in inconsistent log output formatting.

**Requirements**:
- Shutdown messages in ServiceGroup must use the framework's structured logging system (`logx`)
- The shutdown log message should clearly indicate that a service in the group is shutting down

**Acceptance**:
- When a ServiceGroup receives a shutdown signal, the shutdown message appears in the structured log output
- Log output format is consistent with other framework logging

---

### FR2: DevServer Enabled Check Placement

**Problem**: The DevServer's `StartAgent` function checks the `Enabled` configuration flag inside `sync.Once.Do()`. This causes a permanent skip of server initialization if `StartAgent` is called first with `Enabled=false`, even when subsequently called with `Enabled=true`.

**Requirements**:
- The check for whether the DevServer is enabled must occur before the `sync.Once.Do()` call
- If DevServer is disabled, the function should return early without consuming the `sync.Once`
- The `sync.Once` should only be triggered when DevServer is actually being started

**Acceptance**:
- When `StartAgent` is called with `Enabled=false`, no server initialization occurs and the `sync.Once` is not consumed
- When `StartAgent` is called with `Enabled=true` after a previous call with `Enabled=false`, the server starts successfully
- When `StartAgent` is called multiple times with `Enabled=true`, only the first call initializes the server

---

### FR3: Health Response Configuration Field Naming

**Problem**: The health check response configuration field is named `HealthRespInfo`, which does not follow consistent naming conventions used elsewhere in the codebase.

**Requirements**:
- Rename the health check response configuration field to use a clearer, more consistent name
- Update all references to this field across the DevServer configuration and health handler

**Acceptance**:
- The configuration field for customizing health check response text uses consistent naming
- Health check endpoints continue to return the configured response text when the service is ready

---

### FR4: Automatic Config Validation

**Problem**: Configuration structs that implement custom validation logic are not automatically validated when loaded via `conf.Load()` or `conf.LoadFromJsonBytes()`. Users must manually call validation after loading configuration, which is error-prone and often forgotten.

**Requirements**:
- Configuration loading functions (`Load` and `LoadFromJsonBytes`) must automatically invoke validation if the loaded configuration implements the `validation.Validator` interface
- If validation fails, the loading function must return the validation error
- Configurations that do not implement the Validator interface should load successfully without validation
- The Validator interface requires a `Validate() error` method

**Acceptance**:
- When loading a configuration struct that implements `Validate() error`, validation is automatically called after loading
- When validation returns an error, the config loading function returns that error
- When validation succeeds, the config loading function returns nil
- When loading a configuration struct without a `Validate` method, loading proceeds without validation errors

---

### FR5: ImmutableResource Concurrent Access Fix

**Problem**: Concurrent calls to `ImmutableResource.Get()` can return empty results. The race condition occurs when multiple goroutines simultaneously attempt to fetch the resource: while one goroutine is executing the fetch function, another goroutine may read the uninitialized resource before the first goroutine has stored the result.

**Requirements**:
- Concurrent calls to `ImmutableResource.Get()` must never return an empty/nil result when the fetch function succeeds
- Only one fetch should execute even when multiple goroutines call `Get()` simultaneously
- All concurrent callers must receive the same result once the fetch completes
- Properly implement concurrent-safe resource initialization to prevent race conditions

**Acceptance**:
- When 100+ goroutines concurrently call `Get()` on a new ImmutableResource, the fetch function executes exactly once
- All goroutines receive the same non-nil result when the fetch succeeds
- No goroutine receives an empty/nil result due to the race condition

---

### FR6: Machine Performance Data Reading Optimization

**Problem**: Reading machine performance data using `runtime.ReadMemStats()` causes stop-the-world pauses that can impact application performance. This affects both the profiling runtime stats display and the CPU/memory usage statistics reporting.

**Requirements**:
- Replace `runtime.ReadMemStats()` with newer, more efficient APIs for reading memory statistics that avoid stop-the-world pauses
- Use appropriate GC statistics API for reading garbage collection statistics
- Apply this optimization to both the runtime stats display function and the usage statistics printing function

**Acceptance**:
- Runtime statistics display shows the same metrics (Goroutines, Alloc, TotalAlloc, Sys, NumGC) without using `runtime.ReadMemStats()`
- Usage statistics logging reports CPU usage and memory metrics (Alloc, TotalAlloc, Sys, NumGC) without using `runtime.ReadMemStats()`
- The output format remains compatible with existing log parsing and monitoring systems


---

# Environment Dependency Changes (relative to Base Env)

## Go Runtime
- Go upgraded to 1.21.13 (from 1.19)

## Go Packages
- github.com/go-redis/redis/v8@latest added
- github.com/golang/mock/gomock@v1.6.0 added
- github.com/olekukonko/tablewriter@v0.0.5 added
- go.mongodb.org/mongo-driver/mongo@v1.17.2 added

## Environment Variables
- GOROOT set to /usr/local/go
