# Software Requirements Specification: Continuous Profiling Support

## Overview

This milestone introduces continuous profiling capabilities integrated with Pyroscope for production observability. The feature enables automatic CPU, memory, goroutine, mutex, and block profiling with configurable thresholds and adaptive activation based on CPU usage.

**Requirements Summary:**

1. **FR1**: Implement continuous profiling integration with Pyroscope server
2. **FR2**: Support configurable CPU threshold-based activation for adaptive profiling
3. **FR3**: Provide configurable profile types (CPU, memory, goroutine, mutex, block)
4. **FR4**: Add configurable shutdown timing for graceful process termination
5. **FR5**: Implement automatic profiling timeout for signal-triggered profiling
6. **FR6**: Optimize profile center to remove external dependencies

**Affected Modules:**
- `internal/profiling` - New profiling subsystem
- `core/service` - Service configuration integration
- `core/proc` - Shutdown configuration and signal handling
- `core/prof` - Profile center optimization

---

## FR1: Continuous Profiling Integration with Pyroscope

**Problem**: Services lack continuous profiling capabilities for production observability, making it difficult to diagnose performance issues in production environments.

**Requirements**:
- Implement a continuous profiling subsystem that integrates with Pyroscope profiling server
- Support configuration of Pyroscope server address for profiling data upload
- Support optional HTTP basic authentication with username and password
- Configure upload rate for profiling data transmission to the server
- Configure check interval to periodically evaluate whether profiling should start
- Configure profiling duration to control how long each profiling session runs
- Integrate profiling startup with the service configuration setup process
- Ensure profiling stops gracefully when the service receives shutdown signals
- Enable the profiling feature only when a server address is configured

**Acceptance**:
- When a service starts with a Pyroscope server address configured, continuous profiling is initialized
- When no server address is provided, profiling remains disabled without errors
- When profiling is active, data is uploaded to the configured server at the specified upload rate
- When the service shuts down, the profiling goroutine terminates cleanly

---

## FR2: CPU Threshold-Based Adaptive Profiling Activation

**Problem**: Continuous profiling can add overhead to services; profiling should activate adaptively based on system load to capture meaningful data during high-CPU scenarios.

**Requirements**:
- Implement CPU threshold checking to determine when to start profiling
- Profiling should activate when current CPU usage exceeds the configured threshold
- Support configurable CPU threshold value (default 700 out of 1000, i.e., 70%)
- Check CPU usage at configurable intervals (default 10 seconds)
- Profile for a configurable duration once activated (default 2 minutes)
- Automatically stop profiling after the configured duration elapses
- Allow profiling to restart if CPU threshold is exceeded again after previous session ends

**Acceptance**:
- When CPU usage exceeds the threshold, profiling starts automatically
- When CPU usage remains below the threshold, profiling does not start
- When profiling duration elapses, the profiler stops and can be restarted on next threshold breach
- When configured with threshold 0, profiling activates on any CPU activity

---

## FR3: Configurable Profile Types

**Problem**: Different performance issues require different types of profiling data; users need control over which profile types are collected.

**Requirements**:
- Support CPU profiling (enabled by default)
- Support goroutine profiling (enabled by default)
- Support memory profiling including allocation objects, allocation space, in-use objects, and in-use space (enabled by default)
- Support mutex profiling including mutex count and mutex duration (disabled by default)
- Support block profiling including block count and block duration (disabled by default)
- Configure appropriate runtime settings for mutex profiling (mutex profile fraction)
- Configure appropriate runtime settings for block profiling (block profile rate)
- Reset runtime profiling settings when profiler stops
- Support optional logging of profiler operations

**Acceptance**:
- When CPU profiling is enabled, CPU profile data is collected and uploaded
- When memory profiling is enabled, allocation and in-use memory metrics are collected
- When goroutine profiling is enabled, goroutine profile data is collected
- When mutex profiling is enabled, runtime mutex profile fraction is set appropriately
- When block profiling is enabled, runtime block profile rate is set appropriately
- When profiling stops, runtime profiling settings are reset to zero

---

## FR4: Configurable Shutdown Timing

**Problem**: The shutdown timing configuration is hardcoded, preventing services from customizing the graceful shutdown behavior based on their requirements.

**Requirements**:
- Introduce a shutdown configuration structure with configurable timing parameters
- Support configurable wrap-up time (default 1 second) for initial shutdown phase
- Support configurable wait time (default 5.5 seconds) for the total shutdown duration before force kill
- Ensure thread-safe access to shutdown timing configuration
- Apply configuration only when positive duration values are provided
- Preserve default values when zero or negative values are configured
- Integrate shutdown configuration into the service configuration structure

**Acceptance**:
- When shutdown configuration specifies custom wrap-up time, the wrap-up phase uses that duration
- When shutdown configuration specifies custom wait time, the total shutdown wait uses that duration
- When zero or negative values are provided, default values are preserved
- When the service shuts down, the configured timing is respected for graceful termination

---

## FR5: Automatic Profiling Timeout for Signal-Triggered Profiling

**Problem**: When profiling is triggered via SIGUSR2 signal, there is no automatic timeout, requiring manual intervention to stop profiling.

**Requirements**:
- Implement automatic profiling stop after a fixed duration when triggered by SIGUSR2
- Set the automatic profiling duration to one minute
- Start profiling in a non-blocking manner when signal is received
- Each SIGUSR2 signal should start a new profiling session that auto-stops after the timeout

**Acceptance**:
- When SIGUSR2 is received, profiling starts immediately
- When one minute elapses after SIGUSR2, profiling stops automatically
- When another SIGUSR2 is received, a new profiling session starts with its own timeout

---

## FR6: Profile Center Optimization

**Problem**: The profile center uses external table formatting dependencies and has suboptimal locking patterns.

**Requirements**:
- Remove dependency on external table writer library for report generation
- Use standard library string building for CSV-style report output
- Implement double-check locking pattern for slot creation to reduce lock contention
- Use atomic operations for resetting last-cycle statistics
- Initialize the flush loop on package initialization rather than on first report

**Acceptance**:
- When generating profile reports, output is in CSV format without external dependencies
- When creating new profile slots, double-check locking prevents duplicate slot creation
- When resetting last-cycle stats, atomic operations ensure thread safety


---

# Environment Dependency Changes (relative to Base Env)

## Go Runtime
- Go upgraded to 1.21.13

## Go Packages
- github.com/grafana/pyroscope-go v1.2.2 added
- github.com/grafana/pyroscope-go/godeltaprof v0.1.8 added

## Environment Variables
- GO_VERSION set to 1.21.13
- GOROOT set to /usr/local/go
