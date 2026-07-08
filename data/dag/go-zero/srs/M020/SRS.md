# Software Requirements Specification: Code Quality and Modernization

## Overview

This milestone modernizes the go-zero framework codebase to leverage Go standard library improvements and enhance code quality. The requirements focus on adopting modern Go idioms, improving type safety, ensuring thread safety, and enhancing debugging capabilities.

### Summary of Requirements

1. **FR1**: Refactor the Set collection to use Go generics for type-safe operations
2. **FR2**: Make BatchError thread-safe and simplify with errors.Join
3. **FR3**: Prevent Ring buffer index overflow for long-running operations
4. **FR4**: Enhance MapReduce panic messages with full stack traces
5. **FR5**: Add parallel execution function that aggregates errors
6. **FR6**: Adopt standard library slice operations (slices.Contains, slices.Reverse)
7. **FR7**: Replace custom Once wrapper with sync.OnceFunc
8. **FR8**: Adopt builtin min/max and cmp.Compare functions

### Affected Modules

- `core/collection` - Set and Ring data structures
- `core/errorx` - Error handling utilities
- `core/mr` - MapReduce implementation
- `core/fx` - Functional programming utilities
- `core/stringx` - String utilities
- `core/syncx` - Synchronization utilities
- `core/mathx` - Math utilities
- `core/utils` - General utilities
- `core/mapping` - Data mapping utilities
- `core/breaker` - Circuit breaker
- `core/service` - Service management
- `rest/handler` - REST handlers
- `zrpc/internal/serverinterceptors` - gRPC interceptors

**Scope Constraint**: Only modify files within the affected modules listed above. Do not modify files in other packages. Preserve existing API signatures and error message formats for backward compatibility. Each requirement specifies which files need modification - only modify those specific files.

---

## Requirements

### FR1: Generic Set Collection

**Problem**: The existing Set collection uses runtime type checking with `any` types, requiring type-specific methods (AddInt, AddStr, KeysInt, KeysStr, etc.) and causing runtime overhead for type validation.

**Requirements**:
- Implement a generic Set collection that provides compile-time type safety
- The generic Set should use Go type parameters with a `comparable` constraint
- Provide a unified `Add` method that accepts variadic items of the parameterized type
- Provide a `Contains` method that returns boolean for membership checks
- Provide a `Keys` method that returns a typed slice of all elements
- Provide a `Remove` method to delete elements from the set
- Provide a `Count` method to return the number of elements
- Provide a `Clear` method to remove all elements using the builtin `clear` function
- Update all framework usages of Set to use the new generic implementation
- The implementation should not be thread-safe (callers handle synchronization)

**Acceptance**:
- When creating a Set[string] and adding string elements, the Keys() method returns []string directly without type casting
- When attempting to add an element of a different type to a typed Set, compilation fails
- When using the generic Set, operations complete without runtime type assertion overhead
- When calling Clear() on a Set, all elements are removed and Count() returns 0

---

### FR2: Thread-Safe BatchError with errors.Join

**Problem**: The BatchError type is not thread-safe when Add() is called concurrently from multiple goroutines, leading to potential data races. Additionally, the error aggregation implementation uses custom string concatenation.

**Requirements**:
- Add `sync.RWMutex` to BatchError struct to ensure thread-safe concurrent Add() and Err() operations
- Refactor the Err() method to directly return `errors.Join(be.errs...)` for combining multiple errors
- Ensure NotNil() is also protected with RLock for concurrent access
- Remove the custom `errorArray` type - store errors directly as `[]error`
- The combined error returned by `errors.Join` automatically supports `Unwrap() []error`

**Acceptance**:
- When multiple goroutines concurrently call Add() on the same BatchError, no data race occurs
- When Err() is called on a BatchError with multiple errors, the result can be unwrapped using errors.As or errors.Is on each constituent error
- When calling Err() on an empty BatchError, nil is returned (errors.Join returns nil for empty/all-nil input)
- When NotNil() is called concurrently with Add(), no data race occurs

---

### FR3: Ring Buffer Index Overflow Prevention

**Problem**: The Ring buffer data structure uses an incrementing index that can overflow after prolonged use, potentially causing incorrect element positioning or panics.

**Requirements**:
- Implement index reset logic to prevent the ring index from overflowing
- The reset should occur transparently without affecting the correctness of element storage or retrieval
- The Take() operation should continue returning elements in correct insertion order after index resets

**Acceptance**:
- When Add() is called many times on a Ring buffer, the index remains within safe bounds
- When Take() is called after many Add() operations, elements are returned in correct circular order
- When the ring buffer operates continuously for extended periods, no overflow-related panics occur

---

### FR4: MapReduce Panic Stack Trace Enhancement

**Problem**: When panics occur in MapReduce operations (generate, mapper, or reducer functions), the panic message lacks sufficient context for debugging because stack trace information is not included.

**Requirements**:
- Capture full stack trace information when panics occur in MapReduce operations
- Include stack traces for panics in generate functions, mapper functions, and reducer functions
- Format panic information to include both the panic value and the formatted stack trace
- Capture full goroutine stack trace using standard library mechanism
- The enhanced panic information should be propagated when the panic is re-raised

**Acceptance**:
- When a mapper function panics, the propagated panic message contains the original panic value and a stack trace showing goroutine information
- When a generate function panics, the propagated panic includes stack trace with function call hierarchy
- When a reducer function panics, the stack trace shows the location where the panic originated
- The panic information must be built using `runtime/debug.Stack()` to capture the stack trace. When formatted with `%v`, the panic value must contain: the original panic value, the string "goroutine", and "runtime/debug.Stack" (indicating the stack capture mechanism)

---

### FR5: Parallel Execution with Error Aggregation

**Problem**: The existing Parallel function executes functions concurrently but does not support error-returning functions or aggregate errors from parallel executions.

**Requirements**:
- Add a new function for parallel execution of error-returning functions
- The function should accept variadic functions with signature `func() error`
- All functions should execute concurrently
- Errors from all functions should be collected and aggregated
- If no errors occur, nil should be returned
- If any errors occur, a combined error containing all errors should be returned
- The implementation should use safe goroutine execution to handle panics

**Acceptance**:
- When all parallel functions succeed, nil is returned
- When some parallel functions return errors, all functions still complete execution
- When multiple parallel functions return errors, the returned error contains all error messages
- When a function panics during parallel execution, other functions continue to execute

---

### FR6: Standard Library Slice Operations Adoption

**Problem**: The codebase contains custom implementations of common slice operations that are now available in the Go standard library `slices` package.

**Requirements**:
- Replace custom Contains implementations with slices.Contains from the standard library
- Replace custom slice reversal implementations with slices.Reverse
- Remove redundant custom helper functions that duplicate standard library functionality
- Update all call sites to use the standard library equivalents

**Acceptance**:
- When checking if a string exists in a slice of options during unmarshaling, slices.Contains is used
- When reversing a string's runes, slices.Reverse is used
- When validating field options in marshaling, slices.Contains is used
- Custom string Contains function is no longer used in the codebase

---

### FR7: Standard Library sync.OnceFunc Adoption

**Problem**: The codebase contains a custom Once wrapper function that duplicates functionality now available in the Go standard library as sync.OnceFunc.

**Requirements**:
- Replace usages of custom Once wrapper with sync.OnceFunc from the standard library
- Remove the custom Once implementation from the syncx package
- Update all call sites to use sync.OnceFunc directly

**Acceptance**:
- When creating a one-time execution wrapper for service stop functions, sync.OnceFunc is used
- The custom syncx.Once function is no longer present in the codebase
- Service shutdown functions execute exactly once when triggered multiple times

---

### FR8: Builtin min/max and cmp.Compare Adoption

**Problem**: The codebase contains custom MinInt/MaxInt helper functions and manual comparison logic that can be replaced with Go builtin min/max functions and the cmp package.

**Requirements**:
- Replace custom MinInt function calls with the builtin min function
- Replace custom MaxInt function calls with the builtin max function
- Replace manual three-way comparison logic with cmp.Compare from the standard library
- Mark the custom MinInt/MaxInt functions as deprecated with guidance to use builtins
- Update version comparison logic to use cmp.Compare for cleaner code

**Acceptance**:
- When comparing integers for minimum/maximum in circuit breaker error window, builtin min/max are used
- When comparing version lengths in version comparison, cmp.Compare returns -1, 0, or 1 appropriately
- When the deprecated MinInt/MaxInt functions are used, they delegate to the builtin functions
- Custom comparison logic with if-else chains is replaced by cmp.Compare where applicable


---

# Environment Dependency Changes (relative to Base Env)

## Go Runtime
- Go upgraded to 1.21.13

## Environment Variables
- GOTOOLCHAIN set to auto
- GOROOT set to /usr/local/go

## Go Packages
- cel.dev/expr v0.15.0 added
- filippo.io/edwards25519 v1.1.0 added
- github.com/alecthomas/kingpin/v2 upgraded to v2.4.0
- github.com/alicebob/miniredis/v2 upgraded to v2.35.0
- github.com/bsm/ginkgo/v2 v2.12.0 added
- github.com/bsm/gomega v1.27.10 added
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
- github.com/gorilla/websocket v1.5.0 added
- github.com/go-sql-driver/mysql upgraded to v1.9.0
- github.com/grafana/pyroscope-go v1.2.7 added
- github.com/grafana/pyroscope-go/godeltaprof v0.1.9 added
- github.com/grpc-ecosystem/grpc-gateway/v2 upgraded to v2.20.0
- github.com/iancoleman/strcase v0.3.0 added
- github.com/IBM/sarama upgraded to v1.43.1
- github.com/jackc/pgservicefile upgraded to v0.0.0-20240606120523-5a60cdf6a761
- github.com/jackc/pgx/v5 upgraded to v5.7.4
- github.com/jackc/puddle/v2 upgraded to v2.2.2
- github.com/jcmturner/gokrb5/v8 upgraded to v8.4.4
- github.com/jhump/protoreflect upgraded to v1.17.0
- github.com/kisielk/sqlstruct v0.0.0-20201105191214-5f3e10d3ab46 added
- github.com/klauspost/compress upgraded to v1.17.11
- github.com/kylelemons/godebug v1.1.0 added
- github.com/lyft/protoc-gen-star/v2 v2.0.3 added
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
- github.com/redis/go-redis/v9 v9.14.0 added
- github.com/spf13/afero v1.10.0 added
- github.com/stretchr/objx upgraded to v0.5.2
- github.com/stretchr/testify upgraded to v1.11.1
- github.com/youmark/pkcs8 upgraded to v0.0.0-20240726163527-a2c0da244d78
- github.com/yuin/gopher-lua upgraded to v1.1.1
- go.etcd.io/etcd/api/v3 upgraded to v3.5.15
- go.etcd.io/etcd/client/pkg/v3 upgraded to v3.5.15
- go.etcd.io/etcd/client/v3 upgraded to v3.5.15
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
- go.mongodb.org/mongo-driver/v2 v2.3.0 added
- google.golang.org/genproto/googleapis/api upgraded to v0.0.0-20240711142825-46eb208f015d
- google.golang.org/genproto/googleapis/rpc upgraded to v0.0.0-20240701130421-f6361c86f094
- google.golang.org/grpc upgraded to v1.65.0
- google.golang.org/protobuf upgraded to v1.36.5
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
- go.uber.org/mock v0.4.0 added
- k8s.io/api upgraded to v0.29.3
- k8s.io/apimachinery upgraded to v0.29.4
- k8s.io/client-go upgraded to v0.29.3
- k8s.io/klog/v2 upgraded to v2.110.1
- k8s.io/utils upgraded to v0.0.0-20240711033017-18e509b52bc8
- sigs.k8s.io/structured-merge-diff/v4 upgraded to v4.4.1
- github.com/DmitriyVTitov/size removed
- github.com/go-kit/log removed
- github.com/go-logfmt/logfmt removed
- github.com/alicebob/gopher-json removed
- cloud.google.com/go (110+ packages) removed
