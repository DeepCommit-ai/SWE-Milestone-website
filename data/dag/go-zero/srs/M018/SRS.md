# Software Requirements Specification: Logging System Enhancements

## Overview

This milestone enhances the logging system (`logx` package) with the following requirements:

1. **FR1**: Customizable log field keys - Allow users to customize JSON field keys in log output
2. **FR2**: Sensitive data masking - Provide an interface for masking sensitive data in logs
3. **FR3**: Multiple writer support - Enable logging to multiple destinations simultaneously
4. **FR4**: Lazy evaluation logging functions - Add function-based logging to defer expensive computations
5. **FR5**: Custom log file timestamp format - Allow customization of timestamps in log file names
6. **FR6**: Performance optimization for disabled logging - Improve performance when logging is disabled
7. **FR7**: Fix duplicate fields in plain text encoding - Eliminate duplicate field output in plain mode
8. **FR8**: Fix panic on nil error or stringer values - Handle nil pointer types implementing error/Stringer gracefully
9. **FR9**: Fix panic when Error() or String() methods panic - Recover from panics in user-defined methods
10. **FR10**: Fix concurrency issues in WithXXX methods - Ensure thread safety when using logger builder methods
11. **FR11**: Apply global fields to all logging paths - Ensure global fields appear in third-party log modules
12. **FR12**: Fix SetSlowThreshold not effective in HTTP log handler - Use dynamically configured slow threshold
13. **FR13**: Prefer json.Marshaler over fmt.Stringer for JSON output - Preserve structured JSON for types implementing both interfaces

**Affected Modules**: `core/logx`, `core/logc`, `rest/handler`

**Scope Constraint**: Only modify files within the affected modules listed above. Do not modify files in other packages. Preserve existing API signatures and error message formats for backward compatibility.

---

## Requirements

### FR1: Customizable Log Field Keys

**Problem**: Log output uses hardcoded JSON field keys (e.g., `@timestamp`, `level`, `content`, `caller`), preventing integration with log aggregation systems that expect different key names.

**Requirements**:
- Provide configuration to customize the following log field keys:
  - Timestamp key (default: `@timestamp`)
  - Level key (default: `level`)
  - Content key (default: `content`)
  - Caller key (default: `caller`)
  - Duration key (default: `duration`)
  - Trace key (default: `trace`)
  - Span key (default: `span`)
  - Truncated key (default: `truncated`)
- Configuration should be applied during log setup
- Default values must remain unchanged for backward compatibility

**Acceptance**:
- `LogConf` must include a `FieldKeys` field for configuration
- The configuration struct must define the following fields (all `string` type with appropriate JSON tags):
  - `CallerKey` (default: `"caller"`)
  - `ContentKey` (default: `"content"`)
  - `DurationKey` (default: `"duration"`)
  - `LevelKey` (default: `"level"`)
  - `SpanKey` (default: `"span"`)
  - `TimestampKey` (default: `"@timestamp"`)
  - `TraceKey` (default: `"trace"`)
  - `TruncatedKey` (default: `"truncated"`)
- Package-level variables for each key must be initialized to default constants and updated during `SetUp()` based on configuration
- When custom field keys are configured, log entries use the configured key names
- When no custom keys are configured, default key names are used

---

### FR2: Sensitive Data Masking

**Problem**: Logging sensitive data such as passwords, tokens, or personal information poses security and compliance risks. There is no mechanism to automatically mask sensitive values in log output.

**Requirements**:
- Define an interface named `Sensitive` with a single method `MaskSensitive() any` that returns the masked representation of the value
- Types implementing this interface should have their values automatically masked when logged
- Masking should apply to:
  - Direct log content (values passed to `Infov`, `Errorv`, `Debugv`, `Slowv`)
  - Log field values
- Sensitive masking should be processed before type conversion (e.g., before calling `String()` on a value that implements both the sensitive interface and `fmt.Stringer`)

**Acceptance**:
- The `Sensitive` interface must be defined in a new file `core/logx/sensitive.go` with signature: `type Sensitive interface { MaskSensitive() any }`
- A helper function must check if a value implements the `Sensitive` interface and return the result of calling `MaskSensitive()`
- Sensitive masking must be applied to field values before type conversion
- When a type implementing the `Sensitive` interface is logged, the masked value appears in the log instead of the original value
- When a log field value implements the `Sensitive` interface, the masked value appears in the log
- Non-sensitive types are logged unchanged

---

### FR3: Multiple Writer Support

**Problem**: Users cannot write logs to multiple destinations simultaneously (e.g., file and console) without implementing custom writers.

**Requirements**:
- Provide an `AddWriter` function to add additional log writers
- When multiple writers are configured, all writers receive the same log entries
- Closing the combined writer should close all underlying writers
- Errors from closing individual writers should be aggregated

**Acceptance**:
- `AddWriter(w Writer)` function must be exported from `core/logx`
- Implementation must combine multiple writers to apply all of them to log entries
- `AddWriter` must retrieve the current writer, then create a combined writer if one already exists
- The combined writer must implement all `Writer` interface methods by delegating to each underlying writer
- Error aggregation must be performed when closing multiple writers
- When `AddWriter` is called with a new writer, subsequent log entries are written to both the existing and new writers
- When multiple writers are added, all writers receive all log entries

---

### FR4: Lazy Evaluation Logging Functions

**Problem**: When log level filtering is enabled, expensive operations to construct log messages are still executed even when the message won't be logged, causing unnecessary performance overhead.

**User Report**:
```
When using structured logging with debug level disabled, expensive operations
in log message construction still execute. For example:
  logx.Debug(expensiveOperation())
The expensiveOperation() runs even when debug logging is disabled.
```

**Requirements**:
- Add function-based logging methods that accept a function returning the log value:
  - `Debugfn(fn func() any)`
  - `Infofn(fn func() any)`
  - `Errorfn(fn func() any)`
  - `Slowfn(fn func() any)`
- The function should only be invoked if the corresponding log level is enabled
- These methods should be available in both `logx` and `logc` packages
- The `Logger` interface should include these new methods

**Acceptance**:
- The `Logger` interface must include function-based logging methods
- Package-level functions in `core/logx` must be added for function-based logging
- Context-aware functions in `core/logc` must be added with context parameter support
- The logger implementation must provide all function-based logging methods
- When a function-based logging method is called with debug level disabled, the provided function is not invoked
- When a function-based logging method is called with the corresponding level enabled, the provided function is invoked and its result is logged

---

### FR5: Custom Log File Timestamp Format

**Problem**: Log file names use a hardcoded timestamp format (RFC3339), which may not match organizational naming conventions or filesystem requirements.

**Requirements**:
- Add a configuration option for customizing the timestamp format used in log file names
- The default format should remain RFC3339 for backward compatibility
- The custom format should follow Go's time format conventions

**Acceptance**:
- `LogConf` must include a `FileTimeFormat` field of type `string` with JSON tag `json:",optional"`
- A package-level variable `fileTimeFormat` must store the configured format
- During `SetUp()`, if `c.FileTimeFormat` is non-empty, update the `fileTimeFormat` variable
- When a custom file time format is configured, rotated log files use the configured format in their names
- When no custom format is configured, the default RFC3339 format is used

---

### FR6: Performance Optimization for Disabled Logging

**Problem**: When logging is completely disabled, the system still performs unnecessary checks and operations.

**Requirements**:
- Use a dedicated log level constant to represent the disabled state
- When logging is disabled, the log writer should be set to a no-op implementation
- The disabled state should be efficiently checkable via atomic operations

**Acceptance**:
- A dedicated constant must represent the disabled log level
- `Disable()` must set the log level to the disabled level using atomic operations, then set the writer to a no-op implementation
- `SetWriter()` must check if logging is disabled before updating the writer
- When `Disable()` is called, subsequent logging operations have minimal overhead
- When logging is disabled, setting a new writer has no effect
- The disabled state persists across writer changes

---

### FR7: Fix Duplicate Fields in Plain Text Encoding

**Problem**: When using plain text encoding mode, duplicate field keys result in both values appearing in the output instead of the later value overwriting the earlier one.

**Requirements**:
- In plain text encoding mode, when duplicate field keys exist, only the final value for each key should appear in the output
- Field processing should use a map-based approach to deduplicate keys before formatting

**Acceptance**:
- Field processing must use a map-based structure to deduplicate keys
- The map must be populated from the field list, with later values overwriting earlier ones
- In plain encoding mode, fields are first added to the map, then formatted
- When logging with duplicate field keys in plain mode, only the last value for each key appears in the output
- JSON encoding mode is unaffected by this change

---

### FR8: Fix Panic on Nil Error or Stringer Values

**Problem**: Passing a nil pointer of a type that implements `error` or `fmt.Stringer` to the logging `Field` function causes a panic when the method is called on the nil receiver.

**User Report**:
```
var e *myError  // nil pointer
logx.Infow("test", logx.Field("error", e))  // panics

var s *myStringer  // nil pointer
logx.Infow("test", logx.Field("val", s))  // panics
```

**Requirements**:
- When a nil pointer implementing `error` is passed to `Field`, it should be represented as a nil marker string instead of panicking
- When a nil pointer implementing `fmt.Stringer` is passed to `Field`, it should be represented as a nil marker string instead of panicking
- The check should specifically handle nil pointer types

**Acceptance**:
- A constant string must be defined to represent nil values
- Field value processing must check for nil pointers via reflection before calling interface methods
- Helper functions must safely handle calls to `Error()` and `String()` methods, returning the nil marker for nil pointers
- When a nil error pointer is logged as a field, the output contains the nil marker and no panic occurs
- When a nil stringer pointer is logged as a field, the output contains the nil marker and no panic occurs

---

### FR9: Fix Panic When Error() or String() Methods Panic

**Problem**: If a user-defined type's `Error()` or `String()` method panics, the entire logging operation fails, potentially crashing the application.

**Requirements**:
- Recover from panics that occur when calling `Error()` on error types
- Recover from panics that occur when calling `String()` on fmt.Stringer types
- When a panic is recovered, the log field value should indicate the panic occurred (e.g., `panic: <panic message>`)

**Acceptance**:
- Helper functions must use `defer/recover` to catch panics when calling user-defined methods
- Panic recovery logic must differentiate between nil pointer cases and actual panics
- For nil pointers, the recovery should return the nil marker string
- For other panics, the recovery should return an indication that a panic occurred
- When an error type's `Error()` method panics, the log field contains a panic indicator and no application crash occurs
- When a stringer type's `String()` method panics, the log field contains a panic indicator and no application crash occurs
- Normal error and stringer values continue to work correctly

---

### FR10: Fix Concurrency Issues in WithXXX Methods

**Problem**: The `WithContext`, `WithFields`, `WithDuration`, and `WithCallerSkip` methods on the logger modify the receiver in place and return it, causing race conditions when the same logger instance is used from multiple goroutines.

**User Report**:
```
logger := logx.WithContext(ctx)
// In goroutine 1:
logger.WithFields(field1).Info("msg1")
// In goroutine 2:
logger.WithFields(field2).Info("msg2")
// Race condition: fields may be corrupted
```

**Requirements**:
- The `WithContext`, `WithFields`, `WithDuration`, and `WithCallerSkip` methods must return a new logger instance instead of modifying the receiver
- The original logger instance must remain unchanged after calling any WithXXX method
- All fields from the original logger must be copied to the new instance

**Acceptance**:
- Each `WithXXX` method must create and return a new logger instance
- The new instance must copy all fields from the original
- For `WithFields()`: if no fields are passed, return the original logger unchanged; otherwise copy existing fields to a new instance before appending
- When `WithFields` is called, the original logger's fields remain unchanged
- When `WithContext` is called, the original logger's context remains unchanged
- When `WithDuration` is called, the original logger's fields remain unchanged
- When `WithCallerSkip` is called, the original logger's caller skip value remains unchanged
- Concurrent use of logger instances derived from a common parent does not cause race conditions

---

### FR11: Apply Global Fields to All Logging Paths

**Problem**: Global fields set via `AddGlobalFields` are not applied when using context-aware logging or third-party log modules that use the logger.

**Requirements**:
- Global fields must be merged into log entries for all logging paths:
  - Direct logging functions (`logx.Info`, `logx.Error`, etc.)
  - Context-aware logging (`logx.WithContext(ctx).Info()`)
  - Third-party integrations using the `Writer` interface
- Global fields should be merged after local fields to maintain precedence

**Acceptance**:
- A helper function must merge global fields with local fields
- Global fields must be appended after local fields (local fields take precedence due to overwrite semantics)
- All logging paths (direct functions, context-aware methods, and third-party integrations) must apply global field merging
- When global fields are set and logging via context-aware methods, global fields appear in the log entry
- When global fields are set and logging via direct functions, global fields appear in the log entry
- Local fields with the same key as global fields take precedence

---

### FR12: Fix SetSlowThreshold Not Effective in HTTP Log Handler

**Problem**: The HTTP request log handler uses a hardcoded default slow threshold instead of the dynamically configured value set via `SetSlowThreshold`.

**Requirements**:
- The HTTP log handler must use the current slow threshold value when determining whether to log a request as slow
- Changes to the slow threshold via `SetSlowThreshold` must be reflected in subsequent HTTP request logging

**Acceptance**:
- The slow threshold comparison in HTTP logging must use the dynamically configured value
- The slow threshold must be stored as an atomic value that can be updated via `SetSlowThreshold()`
- When `SetSlowThreshold` is called with a new value, HTTP requests exceeding that threshold are logged as slow
- When `SetSlowThreshold` is not called, the default slow threshold is used

---

### FR13: Prefer json.Marshaler Over fmt.Stringer for JSON Output

**Problem**: When a type implements both `json.Marshaler` and `fmt.Stringer`, the logging system uses `String()` output which loses JSON structure. Users expect types with custom JSON marshaling to preserve their structure in JSON log output.

**Requirements**:
- When processing field values for JSON output, check for `json.Marshaler` implementation before `fmt.Stringer`
- If a type implements `json.Marshaler`, use its JSON representation directly
- If a type implements only `fmt.Stringer`, convert to string as before

**Acceptance**:
- In field processing logic, the type check must prioritize `json.Marshaler` before `fmt.Stringer`
- If a value implements `json.Marshaler`, return it directly without conversion (the JSON encoder will call `MarshalJSON()`)
- If a value implements only `fmt.Stringer`, convert to string representation
- When a type implementing both `json.Marshaler` and `fmt.Stringer` is logged as a field, the JSON structure is preserved in the log output
- When a type implementing only `fmt.Stringer` is logged, the string representation is used
- Plain structs without custom marshaling continue to work correctly

---

# Environment Dependency Changes (relative to Base Env)

## Base Image
- Changed from golang:1.19-bookworm to golang:1.21-bookworm

## Go Version
- Go upgraded to 1.21.13

## Environment Variables
- GOPROXY changed to https://proxy.golang.org,direct

## Go Packages (Added)
- cel.dev/expr v0.15.0 added
- filippo.io/edwards25519 v1.1.0 added
- github.com/bsm/ginkgo/v2 v2.12.0 added
- github.com/bsm/gomega v1.27.10 added
- github.com/go-redis/redis/v8 v8.11.5 added
- github.com/golang/mock v1.6.0 added
- github.com/gorilla/websocket v1.5.0 added
- github.com/grafana/pyroscope-go v1.2.7 added
- github.com/grafana/pyroscope-go/godeltaprof v0.1.9 added
- github.com/iancoleman/strcase v0.3.0 added
- github.com/kisielk/sqlstruct v0.0.0-20201105191214-5f3e10d3ab46 added
- github.com/kylelemons/godebug v1.1.0 added
- github.com/lyft/protoc-gen-star/v2 v2.0.3 added
- github.com/olekukonko/tablewriter v0.0.5 added
- github.com/redis/go-redis/v9 v9.12.1 added
- github.com/spf13/afero v1.10.0 added
- go.mongodb.org/mongo-driver/v2 v2.3.0 added
- go.uber.org/mock v0.4.0 added

## Go Packages (Upgraded)
- github.com/alecthomas/kingpin/v2 upgraded to v2.4.0
- github.com/alicebob/miniredis/v2 upgraded to v2.35.0
- github.com/bufbuild/protocompile upgraded to v0.14.1
- github.com/cenkalti/backoff/v4 upgraded to v4.3.0
- github.com/cespare/xxhash/v2 upgraded to v2.3.0
- github.com/cncf/xds/go upgraded to v0.0.0-20240423153145-555b57ec207b
- github.com/DATA-DOG/go-sqlmock upgraded to v1.5.2
- github.com/eapache/go-resiliency upgraded to v1.6.0
- github.com/eapache/go-xerial-snappy upgraded to v0.0.0-20230731223053-c322873962e3
- github.com/emicklei/go-restful/v3 upgraded to v3.11.0
- github.com/envoyproxy/go-control-plane upgraded to v0.12.0
- github.com/envoyproxy/protoc-gen-validate upgraded to v1.0.4
- github.com/fatih/color upgraded to v1.18.0
- github.com/fullstorydev/grpcurl upgraded to v1.9.3
- github.com/golang/glog upgraded to v1.2.1
- github.com/golang-jwt/jwt/v4 upgraded to v4.5.2
- github.com/golang/protobuf upgraded to v1.5.4
- github.com/golang/snappy upgraded to v1.0.0
- github.com/go-logr/logr upgraded to v1.4.2
- github.com/google/go-cmp upgraded to v0.6.0
- github.com/google/uuid upgraded to v1.6.0
- github.com/go-sql-driver/mysql upgraded to v1.9.0
- github.com/grpc-ecosystem/grpc-gateway/v2 upgraded to v2.20.0
- github.com/IBM/sarama upgraded to v1.43.1
- github.com/jackc/pgservicefile upgraded to v0.0.0-20240606120523-5a60cdf6a761
- github.com/jackc/pgx/v5 upgraded to v5.7.4
- github.com/jackc/puddle/v2 upgraded to v2.2.2
- github.com/jcmturner/gokrb5/v8 upgraded to v8.4.4
- github.com/jhump/protoreflect upgraded to v1.17.0
- github.com/klauspost/compress upgraded to v1.17.11
- github.com/montanaflynn/stats upgraded to v0.7.1
- github.com/onsi/ginkgo/v2 upgraded to v2.13.0
- github.com/onsi/gomega upgraded to v1.29.0
- github.com/openzipkin/zipkin-go upgraded to v0.4.3
- github.com/pelletier/go-toml/v2 upgraded to v2.2.2
- github.com/pierrec/lz4/v4 upgraded to v4.1.21
- github.com/prometheus/client_golang upgraded to v1.21.1
- github.com/prometheus/client_model upgraded to v0.6.1
- github.com/prometheus/common upgraded to v0.62.0
- github.com/prometheus/procfs upgraded to v0.15.1
- github.com/rabbitmq/amqp091-go upgraded to v1.9.0
- github.com/stretchr/objx upgraded to v0.5.2
- github.com/stretchr/testify upgraded to v1.11.1
- github.com/youmark/pkcs8 upgraded to v0.0.0-20240726163527-a2c0da244d78
- github.com/yuin/gopher-lua upgraded to v1.1.1
- go.etcd.io/etcd/api/v3 upgraded to v3.5.15
- go.etcd.io/etcd/client/pkg/v3 upgraded to v3.5.15
- go.etcd.io/etcd/client/v3 upgraded to v3.5.15
- go.mongodb.org/mongo-driver upgraded to v1.17.4
- go.opentelemetry.io/otel upgraded to v1.24.0
- go.opentelemetry.io/otel/exporters/otlp/otlptrace upgraded to v1.24.0
- go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc upgraded to v1.24.0
- go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp upgraded to v1.24.0
- go.opentelemetry.io/otel/exporters/stdout/stdouttrace upgraded to v1.24.0
- go.opentelemetry.io/otel/exporters/zipkin upgraded to v1.24.0
- go.opentelemetry.io/otel/metric upgraded to v1.24.0
- go.opentelemetry.io/otel/sdk upgraded to v1.24.0
- go.opentelemetry.io/otel/trace upgraded to v1.24.0
- go.opentelemetry.io/proto/otlp upgraded to v1.3.1
- go.uber.org/automaxprocs upgraded to v1.6.0
- go.uber.org/goleak upgraded to v1.3.0
- golang.org/x/crypto upgraded to v0.33.0
- golang.org/x/mod upgraded to v0.17.0
- golang.org/x/net upgraded to v0.35.0
- golang.org/x/oauth2 upgraded to v0.24.0
- golang.org/x/sync upgraded to v0.11.0
- golang.org/x/sys upgraded to v0.30.0
- golang.org/x/term upgraded to v0.29.0
- golang.org/x/text upgraded to v0.22.0
- golang.org/x/time upgraded to v0.10.0
- golang.org/x/tools upgraded to v0.21.1-0.20240508182429-e35e4ccd0d2d
- google.golang.org/genproto/googleapis/api upgraded to v0.0.0-20240711142825-46eb208f015d
- google.golang.org/genproto/googleapis/rpc upgraded to v0.0.0-20240701130421-f6361c86f094
- google.golang.org/grpc upgraded to v1.65.0
- google.golang.org/protobuf upgraded to v1.36.5
- k8s.io/api upgraded to v0.29.3
- k8s.io/apimachinery upgraded to v0.29.4
- k8s.io/client-go upgraded to v0.29.3
- k8s.io/klog/v2 upgraded to v2.110.1
- k8s.io/utils upgraded to v0.0.0-20240711033017-18e509b52bc8
- sigs.k8s.io/structured-merge-diff/v4 upgraded to v4.4.1

## Go Packages (Removed)
- cloud.google.com/* (100+ Google Cloud SDK packages) removed
- github.com/alicebob/gopher-json removed
- github.com/DmitriyVTitov/size removed
- github.com/go-kit/log removed
- github.com/go-logfmt/logfmt removed
