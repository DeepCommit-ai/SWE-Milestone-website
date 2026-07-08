# Software Requirements Specification: Trace and Observability Improvements

## Overview

This milestone addresses critical issues and enhancements in the go-zero tracing and observability subsystem. The requirements focus on improving stability, security, and correctness of the OpenTelemetry-based tracing infrastructure.

**Summary of Requirements:**

1. **FR1**: Fix panic when calling `StopAgent()` with tracing disabled
2. **FR2**: Add secure HTTPS option for OTLP HTTP trace exporter
3. **FR3**: Prevent multiple trace agent initializations in multi-server processes
4. **FR4**: Include tracing context in max connections handler logs

**Affected Modules:**

- `core/trace` - Trace agent initialization and configuration
- `rest/handler` - HTTP handler middleware

---

## Requirements

### FR1: Fix StopAgent Panic When Trace Agent is Disabled

**Problem**: Calling `StopAgent()` causes a panic when the trace agent was never initialized because tracing was disabled in configuration.

**User Report**:
```
When running an application with trace disabled (Config.Disabled = true), calling
StopAgent() during shutdown causes a nil pointer dereference panic because the
TracerProvider was never initialized.
```

**Requirements**:
- The `StopAgent()` function must be safe to call regardless of whether the trace agent was started
- When the TracerProvider is nil (tracing disabled), `StopAgent()` should return gracefully without error
- Multiple calls to `StopAgent()` should be idempotent and not cause errors or panics

**Acceptance**:
- When tracing is disabled via configuration and `StopAgent()` is called, no panic occurs
- When `StopAgent()` is called multiple times consecutively, no panic or error occurs
- Existing behavior for properly initialized trace agents remains unchanged

---

### FR2: Add Secure HTTPS Option for OTLP HTTP Transport

**Problem**: The OTLP HTTP trace exporter only supports insecure HTTP connections, preventing traces from being sent to collectors that require HTTPS/TLS.

**User Report**:
```
We need to send traces to a cloud-hosted collector endpoint that requires HTTPS.
Currently the otlphttp batcher always uses WithInsecure() which forces HTTP.
Please add an option to enable secure HTTPS connections.
```

**Requirements**:
- Add a configuration option to enable secure (HTTPS) transport for the OTLP HTTP exporter
- The default behavior should remain insecure (HTTP) for backward compatibility
- When secure mode is enabled, the exporter should use HTTPS/TLS for the connection
- The configuration option should be optional and integrate with existing trace configuration

**Acceptance**:
- When the secure option is disabled or not specified, OTLP HTTP exporter uses HTTP (existing behavior)
- When the secure option is enabled, OTLP HTTP exporter uses HTTPS/TLS
- The configuration can be specified via the standard trace configuration structure

---

### FR3: Prevent Multiple Trace Initialization in Multi-Server Processes

**Problem**: When running multiple servers (e.g., REST API and RPC) in the same process, each server's `ServiceConf.SetUp()` call attempts to reinitialize the global tracer provider, causing configuration conflicts and potential issues.

**User Report**:
```
Running both a REST server and RPC server in the same application causes issues
with trace initialization. Each server calls StartAgent with potentially different
configurations. The current map-based deduplication by endpoint is insufficient -
we need true once-only initialization like other global components (prometheus, logx).
```

**Requirements**:
- The trace agent must be initialized exactly once per process, regardless of how many times `StartAgent()` is called
- The first valid (non-disabled) configuration passed to `StartAgent()` should be used
- Subsequent calls to `StartAgent()` should be no-ops, consistent with similar global initialization patterns
- Error handling should log initialization failures rather than silently swallowing them

**Acceptance**:
- When `StartAgent()` is called multiple times with different configurations, only the first call initializes the tracer
- When multiple servers start in the same process, trace initialization occurs exactly once
- Initialization errors are logged for visibility

---

### FR4: Include Tracing Context in Max Connections Handler Logs

**Problem**: Error logs from the max connections handler do not include tracing information, making it difficult to correlate connection limit errors with specific requests in distributed tracing systems.

**User Report**:
```
When debugging connection limit issues, it's impossible to correlate the error
logs with the specific request trace. The logx.Error() call in MaxConnsHandler
should include request context for trace correlation.
```

**Requirements**:
- Error logs in the max connections handler should include the request's tracing context
- Use context-aware logging to preserve trace and span IDs in log entries
- Maintain compatibility with existing log output format

**Acceptance**:
- When a connection limit error occurs, the log entry contains trace context from the request
- Log entries can be correlated with distributed traces via trace ID
- Existing log message content remains unchanged
