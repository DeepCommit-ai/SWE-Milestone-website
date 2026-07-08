# Software Requirements Specification: Plugin System Core Improvements

## Overview

This milestone delivers comprehensive improvements to the Navidrome plugin system core infrastructure. The changes address several interconnected issues:

1. **FR1**: Metrics collection limited to MetadataAgent plugins only
2. **FR2**: Callback methods (WebSocket, Scheduler) missing metrics and proper error handling
3. **FR3**: Plugin initialization errors not properly handled, leading to partially registered plugins
4. **FR4**: Error mapping in checkErr function fails to properly handle API error constants
5. **FR5**: Race condition in plugin manager during plugin registration and initialization
6. **FR6**: Base capability architecture requires refactoring for consistency across plugin types

**Affected Modules**:
- `plugins/base_capability.go` (new file)
- `plugins/wasm_base_plugin.go` (**DELETE this file**)
- `plugins/adapter_media_agent.go`
- `plugins/adapter_scrobbler.go`
- `plugins/adapter_scheduler_callback.go`
- `plugins/adapter_websocket_callback.go`
- `plugins/manager.go`
- `plugins/plugin_lifecycle_manager.go`
- `plugins/host_scheduler.go`
- `plugins/host_websocket.go`
- `plugins/api/errors.go`

---

## Requirements

### FR1: Enable Metrics Collection for All Plugin Types

**Problem**: Metrics are only being recorded for MetadataAgent plugins; other plugin types such as Scrobbler, SchedulerCallback, and WebSocketCallback do not have their method calls tracked.

**Requirements**:
- Record metrics for all plugin method invocations regardless of plugin type
- Metrics should capture plugin ID, method name, success/failure status, and elapsed time
- Exclude metrics recording for methods that return `ErrNotImplemented` (as these indicate the method is not supported by the plugin)
- Ensure metrics are passed through the capability infrastructure to all plugin adapters

**Acceptance**:
- When a Scrobbler plugin method is invoked, metrics are recorded for that call
- When a SchedulerCallback method is invoked, metrics are recorded for that call
- When a WebSocketCallback method is invoked, metrics are recorded for that call
- When a plugin method returns `ErrNotImplemented`, no metrics are recorded for that call
- The `metrics.Metrics` interface shall provide a `RecordPluginRequest(ctx, pluginID, methodName, isOk, elapsedMs)` method
- Tests verify that `RecordPluginRequest` is called with correct parameters for all plugin types

---

### FR2: Implement Callback Metrics with Proper Method Invocation Pattern

**Problem**: WebSocket and Scheduler callback execution bypasses the standard plugin method invocation pattern, resulting in missing metrics collection and inconsistent error handling.

**Requirements**:
- WebSocket callback methods (OnTextMessage, OnBinaryMessage, OnError, OnClose) must use the standard `callMethod` pattern for method invocation
- Scheduler callback execution must use the standard `callMethod` pattern with proper metrics recording
- Callback responses must be processed through the `checkErr` function for proper error handling
- The scheduler callback adapter must implement an `OnSchedulerCallback` method that wraps the callback invocation

**Acceptance**:
- When a WebSocket text message is received, the callback invocation is properly tracked with metrics
- When a scheduler callback fires, the callback invocation is properly tracked with metrics
- When a callback returns an error in its response, the error is properly mapped and handled
- The `schedulerService` shall provide methods for scheduling:
  - `scheduleOneTime(ctx, pluginName, req)` for one-time delayed jobs with `DelaySeconds`, `Payload`, and `ScheduleId` fields in the request
  - `scheduleRecurring(ctx, pluginName, req)` for recurring cron jobs with `CronExpression`, `Payload`, and `ScheduleId` fields in the request
  - `cancelSchedule(ctx, pluginName, req)` for canceling schedules with `ScheduleId` field in the request
  - `timeNow(ctx, req)` returning `Rfc3339Nano`, `UnixMilli`, and `LocalTimeZone` fields in the response
- The scheduler service shall auto-generate a `ScheduleId` if not provided in the request
- Replacing an existing schedule with the same ID shall succeed without increasing the schedule count
- The `websocketService` shall provide methods for WebSocket operations:
  - `connect(ctx, pluginName, req, callback)` returning `ConnectionId` in response
  - `sendText(ctx, pluginName, req)` with `ConnectionId` and `Message` fields
  - `close(ctx, pluginName, req)` with `ConnectionId`, `Code`, and `Reason` fields
- WebSocket operations on non-existent connections shall return a response with an `Error` field containing "connection not found"
- Scheduler callback tests verify that recurring and one-time jobs execute successfully

---

### FR3: Correct Plugin Initialization Error Handling

**Problem**: When a plugin's `OnInit` method fails (either by returning a Go error or an error string in the response), the plugin remains registered in the manager, leaving the system in an inconsistent state.

**Requirements**:
- When `OnInit` returns a Go error, the plugin must be automatically unregistered from the manager
- When `OnInit` returns an error string in the response, the plugin must be automatically unregistered from the manager
- The plugin lifecycle manager must record metrics for `OnInit` calls. Metrics are provided through its constructor: `newPluginLifecycleManager(metrics.Metrics)`.
- The lifecycle manager must provide a method to clear initialization state when a plugin is unregistered
- Unregistering a plugin must remove it from the plugins map, remove all its adapters, and clear its lifecycle state

**Acceptance**:
- When a plugin's `OnInit` method returns an error response, the plugin is not present in the manager's plugin list
- When a plugin's `OnInit` method returns a Go error, the plugin is not present in the manager's plugin list
- When a plugin is successfully initialized, it remains registered and its initialization state is tracked
- When a plugin is unregistered, its lifecycle initialization state is cleared
- The `pluginLifecycleManager` shall provide the following methods:
  - `isInitialized(plugin *plugin) bool` - checks if a plugin has been initialized
  - `markInitialized(plugin *plugin)` - marks a plugin as initialized
  - `clearInitialized(plugin *plugin)` - removes initialization state for a plugin
- The plugin key for lifecycle tracking shall be constructed as `plugin.ID + consts.Zwsp + plugin.Manifest.Version` to allow different versions of the same plugin to have independent initialization states
- Plugins with the same ID but different versions shall be tracked independently
- The manager's `unregisterPlugin(pluginID string)` method shall clear the lifecycle state as part of unregistration
- Only plugins that implement the `LifecycleManagement` capability shall be tracked by the lifecycle manager
- Tests verify successful initialization marks plugin as initialized, and failed initialization causes unregistration

---

### FR4: Enhance Error Mapping in checkErr Function

**Problem**: The `checkErr` function does not properly map API error constants (such as `ErrNotImplemented` and `ErrNotFound`) when errors are returned from plugins. Because errors from plugins may arrive as strings due to serialization/deserialization, they need to be mapped back to their proper API error constants.

**Requirements**:
- Implement a `mapAPIError` function that maps error strings to their corresponding `api.Err*` constants
- When a response's `GetError()` method returns a string matching an API error constant (e.g., "plugin:not_implemented"), it must be mapped to the proper constant
- When the original error matches an API error string, it must be mapped to the proper constant
- API errors in the response should take precedence and be returned directly (not wrapped with original error)
- Non-API errors should be joined with the original error when both exist
- Handle edge cases: nil responses, typed nil responses, value types that implement errorResponse, and empty error strings

**Acceptance**:
- The `checkErr` function shall have the generic signature `checkErr[T any](resp T, err error) (T, error)`
- The `errorResponse` interface shall define a single method `GetError() string`
- The `mapAPIError(err error) error` function shall map error strings to API constants:
  - Error string `"plugin:not_implemented"` maps to `api.ErrNotImplemented`
  - Error string `"plugin:not_found"` maps to `api.ErrNotFound`
  - Non-matching errors are returned unchanged
- API error constants shall be defined in `plugins/api/errors.go`:
  - `api.ErrNotImplemented = errors.New("plugin:not_implemented")`
  - `api.ErrNotFound = errors.New("plugin:not_found")`
- When the response is nil (including typed nil), `checkErr` shall return the response unchanged and apply `mapAPIError` to the original error
- When a typed nil response is passed (a nil pointer with a concrete type), the function shall not panic and return the original error unchanged
- When the response implements `errorResponse` and `GetError()` returns a non-empty string:
  - If the error string maps to an API error constant, return that constant (taking precedence)
  - Otherwise, join the response error with the original error using `errors.Join`
- When the response implements `errorResponse` and `GetError()` returns an empty string, apply `mapAPIError` to the original error
- When the response does not implement `errorResponse`, return the response unchanged and apply `mapAPIError` to the original error
- Value types (non-pointer) that implement `errorResponse` shall be handled correctly
- When both response error and original error are nil/empty, return nil error

---

### FR5: Resolve Race Condition in Plugin Manager Registration

**Problem**: A race condition exists between plugin registration and the background goroutines that handle plugin compilation and initialization. When initialization fails and triggers unregistration, it can race with concurrent registration operations.

**Requirements**:
- Plugin registration must complete (adding to plugins map and creating adapters) before any background processing begins
- Background compilation and initialization goroutines must only start after all plugins are registered
- The `ScanPlugins` method must collect all registered plugins and then start background processing in a separate phase
- Plugin unregistration must be safe to call even if background processing is in progress

**Acceptance**:
- When scanning plugins, all plugins are registered before any compilation goroutines start
- When a plugin fails initialization and is unregistered, no panic or race condition occurs
- Multiple plugins with different initialization results (success, error response, Go error) are handled correctly
- The `Manager` interface shall provide an `EnsureCompiled(name string) error` method that blocks until the plugin is compiled
- When `EnsureCompiled` is called for a non-existent plugin, it shall return an error with message "plugin not found: <name>"
- The `plugin` struct shall have a `compilationReady` channel and `compilationErr` field for compilation status tracking
- The `plugin` struct shall provide a `waitForCompilation() error` method that blocks on the `compilationReady` channel
- Compilation timeout shall be controlled by `conf.Server.DevPluginCompilationTimeout` via the `pluginCompilationTimeout()` function, defaulting to 1 minute if unset
- Tests verify that plugin registration and compilation can handle concurrent operations

---

### FR6: Refactor Base Capability Architecture

**Problem**: The `wasmBasePlugin` structure and naming do not accurately reflect its role in the plugin capability system, and the architecture needs consolidation for consistency.

**Requirements**:
- **DELETE** the file `plugins/wasm_base_plugin.go`
- **CREATE** a new file `plugins/base_capability.go` as its replacement
- Rename `wasmBasePlugin` to `baseCapability` to better reflect its purpose in the capability architecture
- Rename `newWasmBasePlugin` to `newBaseCapability`
- Move the `callMethod` function to the base capability module
- Update all plugin adapters (MediaAgent, Scrobbler, SchedulerCallback, WebSocketCallback) to use the new `baseCapability` type
- Remove the `Instantiate` method from the public `WasmPlugin` interface as it is no longer needed externally
- The `callMethod` function must integrate with `checkErr` for proper error handling
- Ensure the generic type constraints work correctly for all capability types

**Critical File Changes**:
| Action | File |
|--------|------|
| DELETE | `plugins/wasm_base_plugin.go` |
| CREATE | `plugins/base_capability.go` |

**Acceptance**:
- The file `plugins/wasm_base_plugin.go` is deleted
- The file `plugins/base_capability.go` is created with the refactored code
- All plugin adapters use `baseCapability` instead of `wasmBasePlugin`
- The `baseCapability` shall be a generic struct `baseCapability[S any, P any]` where `S` is the capability interface type and `P` is the plugin loader type
- The `baseCapability` shall have the following fields:
  - `wasmPath string` - path to the WASM file
  - `id string` - plugin identifier
  - `capability string` - capability name
  - `loader P` - the plugin loader instance
  - `loadFunc loaderFunc[S, P]` - function to load plugin instances
  - `metrics metrics.Metrics` - metrics collector
- The `baseCapability` shall provide the following methods:
  - `PluginID() string` - returns the plugin ID
  - `getInstance(ctx context.Context, methodName string) (S, func(), error)` - loads an instance using `loadFunc` and returns a cleanup function
  - `getMetrics() metrics.Metrics` - returns the metrics instance
- The `callMethod` function shall have the generic signature `callMethod[S any, R any](ctx context.Context, wp WasmPlugin, methodName string, fn func(inst S) (R, error)) (R, error)`
- The `callMethod` function shall handle errors via `checkErr` and record metrics, skipping metrics for `api.ErrNotImplemented`
- The `WasmPlugin` interface only requires `PluginID() string` method
- Tests verify that `baseCapability` correctly loads instances using the provided loader function

---

## Test Coverage

The following test categories verify these requirements:

**Base Capability Tests**:
- `baseCapability > should load instance using loadFunc`
- `checkErr > when resp is nil > *` (multiple scenarios)
- `checkErr > when resp implements errorResponse > *` (multiple scenarios)
- `checkErr > when resp does not implement errorResponse > *` (multiple scenarios)
- `checkErr > when resp is a value type > *` (multiple scenarios)
- `checkErr > when resp is a typed nil > *` (multiple scenarios)

**Plugin Manager Tests**:
- `Plugin Manager > should load all MetadataAgent plugins`
- `Plugin Manager > ScanPlugins > should register and compile discovered plugins`
- `Plugin Manager > Plugin Initialization Lifecycle > *` (initialization success/failure scenarios)
- `Plugin Manager > EnsureCompiled > *` (compilation waiting scenarios)

**Adapter Tests**:
- `Adapter Media Agent > *` (all album/artist method tests)
- `Adapter Media Agent > Error mapping > *` (error mapping scenarios)
- `Adapter Media Agent > Helper functions > convertExternalImages > *` (image conversion scenarios)
- `Adapter Media Agent > AgentName and PluginName > *` (name accessor methods)

**Callback Tests**:
- `SchedulerService > *` (scheduling, cancellation, replacement tests)
- `WebSocket Host Service > *` (connection, messaging, error handling tests)

**Lifecycle Manager Tests**:
- `LifecycleManagement > Plugin Lifecycle Manager > *` (initialization tracking, state clearing)

**Permission and Runtime Tests**:
- `Plugin Permissions > *` (permission enforcement, runtime creation)
- `CachingRuntime > reuses module instances across calls`
- `Runtime > pluginCompilationTimeout > *`
- `purgeCacheBySize > *` (cache purging behavior)

---

## Additional API Specifications

The following additional APIs are required for test compatibility:

**Media Agent Adapter APIs**:
- The `wasmMediaAgent` struct shall embed `*baseCapability[api.MetadataAgent, *api.MetadataAgentPlugin]`
- The `wasmMediaAgent` shall implement `AgentName() string` returning `w.id`
- The `wasmMediaAgent` shall implement `mapError(err error) error` that maps `api.ErrNotFound` and `api.ErrNotImplemented` to `agents.ErrNotFound`
- The `convertExternalImages(images []*api.ExternalImage) []agents.ExternalImage` helper function shall:
  - Return an empty slice when input is nil or empty
  - Convert each `api.ExternalImage` (with `Url` and `Size` fields) to `agents.ExternalImage` (with `URL` and `Size` fields)

**Cache Management APIs**:
- The `purgeCacheBySize(dir, sizeLimit string)` function shall:
  - Remove oldest entries when cache is above the size limit
  - Do nothing when cache is below the size limit
  - Size limit is specified as a string (e.g., "3" for bytes or "10MB" for megabytes)

**Caching Runtime APIs**:
- The `cachingRuntime` struct shall have a `pool` field for module instance pooling
- The runtime pool shall reuse module instances across calls
- The `runtimePool` shall be a global `sync.Map` keyed by plugin ID

**Plugin Discovery APIs**:
- The `Manager` shall implement `PluginNames(capability string) []string` to return folder names of plugins with the specified capability
- The `Manager` shall implement `LoadMediaAgent(name string) (agents.Interface, bool)` to load a MetadataAgent plugin
- The `ScanPlugins()` method shall discover plugins from `conf.Server.Plugins.Folder`
- Multiple plugins with the same manifest name but different folder IDs shall be registered independently using their folder names as IDs

**Plugin Permissions APIs**:
- The `LoadManifest(pluginDir string) (*schema.PluginManifest, error)` function shall load and validate a plugin manifest
- Manifests without a `permissions` field shall return an error containing "field permissions in PluginManifest: required"
- Unknown permission keys in the manifest shall be allowed (forward compatibility)
- The `createRuntime(pluginID string, permissions schema.PluginManifestPermissions)` method shall create a runtime with only the services specified in permissions
- Empty permissions shall result in a runtime with no host services (secure-by-default behavior)
- Different permission sets shall result in different runtime instances


---

### Agent Registry Internal API (Required Signatures)

The `Agents` composite in `core/agents` must expose the following unexported
helpers with these exact names and signatures (they are exercised by
package-internal consumers and acceptance tooling):

- `func (a *Agents) getEnabledAgentNames() []string` — returns the ordered list
  of enabled agent names: agents listed in `conf.Server.Agents` (configured
  order, invalid names filtered out), always including `LocalAgentName`
  (appended last when not explicitly configured); when the config value is
  empty it returns only `LocalAgentName`. Plugin agent names are discovered
  via the plugin loader's `PluginNames("MetadataAgent")`.
- `func (a *Agents) getAgent(name string) Interface` — instantiates the named
  agent, returning `nil` when the agent is disabled or unavailable.

# Environment Dependency Changes (relative to Base Env)

## Go Packages
- ginkgo v2.23.4 added

## Environment Variables
- GOTOOLCHAIN set to auto (base uses local)
