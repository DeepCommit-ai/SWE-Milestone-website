# Software Requirements Specification: Plugin API Extensions

## Overview

This milestone extends the Navidrome plugin API with new functionality and addresses issues with plugin system behavior. The requirements encompass:

1. **FR1**: Add a TimeNow RPC method to the SchedulerService for timezone-aware plugin operations
2. **FR2**: Eliminate unnecessary log messages when plugins use the Subsonic API with internal authentication
3. **FR3**: Improve plugin system behavior when plugins are disabled in configuration
4. **FR4**: Correct plugin configuration documentation for Discord Rich Presence example

**Affected Modules**:
- Plugin scheduler service and protobuf definitions
- Subsonic API authentication middleware
- Plugin manager initialization and configuration handling
- Plugin example documentation

---

## Requirements

### FR1: SchedulerService TimeNow RPC Method

**Problem**: Plugins requiring time-based operations have no standardized way to retrieve the server's current time with timezone information, making it difficult to implement timezone-aware scheduling and logging.

**Requirements**:
- Add a `TimeNow` RPC method to the SchedulerService that plugins can call
- The response must include the current timestamp in RFC3339Nano format (e.g., `"2024-01-15T10:30:45.123456789Z"`) providing nanosecond precision
- The response must include the current Unix timestamp in milliseconds as an integer value
- The response must include the server's local timezone name (e.g., `"UTC"`, `"America/New_York"`, `"Local"`)
- The method should take no input parameters
- The method must be accessible through both the host service interface and the named scheduler service wrapper used by plugins

**Acceptance**:
- When a plugin calls `TimeNow`, it receives a response containing all three time formats
- The RFC3339Nano timestamp can be parsed successfully using standard RFC3339Nano parsing
- The Unix milliseconds value matches the timestamp represented by the RFC3339Nano field
- The local timezone string matches the server's current timezone location name (using `time.Now().Location().String()`)
- The scheduler service protobuf definition includes the `TimeNow` method and corresponding request/response message types
- The `TimeNowRequest` message has no fields (empty request)
- The `TimeNowResponse` message has exactly three fields:
  - `rfc3339_nano` (string, proto field 1): Current time formatted as RFC3339Nano
  - `unix_milli` (int64, proto field 2): Current time as Unix milliseconds
  - `local_time_zone` (string, proto field 3): Local timezone name
- In Go code, the response struct fields are named `Rfc3339Nano`, `UnixMilli`, and `LocalTimeZone`
- The `timeNow` method implementation shall use `time.Now()` to get the current time
- **Important**: Unlike other `schedulerService` methods (e.g., `scheduleOneTime`, `scheduleRecurring`, `cancelSchedule`) which require a `pluginID` parameter to isolate plugin-specific data, the internal `timeNow` method does **not** require a `pluginID` parameter because it is a stateless operation that simply returns the server's current time
- The internal method signature shall be: `func (s *schedulerService) timeNow(ctx context.Context, req *scheduler.TimeNowRequest) (*scheduler.TimeNowResponse, error)`
- The `SchedulerHostFunctions.TimeNow` wrapper method shall call the internal method as `s.ss.timeNow(ctx, req)` without passing `s.pluginID`

---

### FR2: Fix Log Spam During Plugin Subsonic API Calls

**Problem**: When plugins make calls to the Subsonic API using internal authentication, the system attempts reverse proxy authentication even though the request originates internally. This results in repeated "no proxy IP found" warning messages in the logs since internal requests do not have a reverse proxy IP address.

**User Report**:
```
When running plugins that use the Subsonic API internally, the logs are
filled with "no proxy IP found" warnings for each API call. These warnings
are spurious since internal plugin requests don't go through a reverse proxy.
```

**Requirements**:
- When authenticating Subsonic API requests, determine the authentication source (internal vs. reverse proxy) before attempting to extract proxy information
- If a request is authenticated using internal authentication, skip the reverse proxy authentication logic entirely
- The authentication type logging should correctly reflect whether authentication came from internal or reverse proxy sources
- This change should not affect requests that are legitimately authenticated via reverse proxy

**Acceptance**:
- When a plugin makes a Subsonic API call using internal authentication, no "no proxy IP found" message appears in logs
- Requests authenticated via internal mechanism are logged with auth type "internal"
- Requests authenticated via reverse proxy are still logged with auth type "reverse-proxy"
- Both internal and reverse proxy authentication paths continue to work correctly for user lookup
- The authentication middleware shall check for internal auth first via a helper function that returns both the username and a boolean indicating if it came from internal auth
- If internal auth is present (username non-empty from internal auth), the middleware must skip reverse proxy authentication entirely
- The SubsonicAPI Host Service sets internal authentication in the request context using `request.WithInternalAuth(ctx, username)` where username comes from the `u` query parameter
- The `request.InternalAuthFrom(ctx)` function returns the username and a boolean indicating if internal auth was found in the context

---

### FR3: Plugin Manager Behavior When Plugins Disabled

**Problem**: Even when the plugin system is disabled in configuration (`Plugins.Enabled = false`), the application still attempts to create the plugins directory and logs warnings about plugin operations that are not applicable.

**User Report**:
```
With plugins disabled in configuration, the server still tries to create
the plugins folder on startup and logs warnings about missing plugin
infrastructure. This is confusing and creates unnecessary directories.
```

**Requirements**:
- When plugins are disabled in configuration, do not create the plugins folder during startup
- When plugins are disabled, provide a no-operation implementation of the plugin manager interface that silently ignores all plugin operations
- Extract a Manager interface from the concrete manager implementation to allow for substitution
- The no-op manager must implement all manager interface methods as no-ops (returning nil, empty slices, or false as appropriate)
- Internal manager methods should work with the implementation type while external interfaces use the interface type

**Acceptance**:
- When `Plugins.Enabled` is `false`, no plugins directory is created during configuration loading
- When `Plugins.Enabled` is `false`, `GetManager` returns a no-op manager implementation
- The no-op manager's `PluginNames` returns nil
- The no-op manager's `LoadPlugin` and similar loading methods return nil or false
- The no-op manager's `ScanPlugins` performs no operations
- Existing behavior is preserved when `Plugins.Enabled` is `true`
- The `Manager` interface must define the following methods:
  - `SetSubsonicRouter(router SubsonicRouter)`
  - `EnsureCompiled(name string) error`
  - `PluginList() map[string]schema.PluginManifest`
  - `PluginNames(capability string) []string`
  - `LoadPlugin(name string, capability string) WasmPlugin`
  - `LoadMediaAgent(name string) (agents.Interface, bool)`
  - `LoadScrobbler(name string) (scrobbler.Scrobbler, bool)`
  - `ScanPlugins()`
- The concrete implementation type shall be renamed from `Manager` to `managerImpl`
- The `noopManager` type shall implement all `Manager` interface methods as no-ops
- The plugin lifecycle manager tracks initialization state using a key constructed as `pluginID + consts.Zwsp + manifest.Version` to differentiate plugins with same name but different versions
- The `pluginLifecycleManager` type shall provide methods `isInitialized(plugin *plugin) bool` and `markInitialized(plugin *plugin)` for tracking plugin initialization state
- The `CapabilityLifecycleManagement` constant identifies plugins that implement lifecycle management

---

### FR4: Correct Discord Rich Presence Plugin Configuration Documentation

**Problem**: The Discord Rich Presence example plugin documentation contains an incorrect configuration key name, causing users who follow the documentation to have non-functional plugin configuration.

**Requirements**:
- The plugin configuration example in the Discord Rich Presence README must use the correct TOML section name for plugin configuration
- The configuration section should use `PluginConfig` as the section name prefix, not `PluginSettings`

**Acceptance**:
- When following the Discord Rich Presence plugin README configuration instructions, the plugin configuration section uses `[PluginConfig.discord-rich-presence]`
- The documented configuration format matches the actual configuration parsing behavior of the plugin system

---

# Environment Dependency Changes (relative to Base Env)

## Go Packages
- github.com/onsi/ginkgo/v2/ginkgo v2.23.4 added

## Environment Variables
- GOTOOLCHAIN set to auto (changed from local)
