# Software Requirements Specification: Threading and Concurrency Utilities

## Overview

This milestone enhances the threading utilities in the `core/threading` package with new concurrency control features:

1. **FR1**: Non-blocking task scheduling with immediate feedback in TaskRunner
2. **FR2**: Wait mechanism for TaskRunner completion tracking
3. **FR3**: Concurrent runner with ordered message delivery (StableRunner)

**Affected Module**: `core/threading`

---

## Requirements

### FR1: Non-Blocking Task Scheduling in TaskRunner

**Problem**: The existing `Schedule` method in TaskRunner blocks when the concurrency limit is reached. Users need a way to schedule tasks that returns immediately with an error when the runner is at capacity, enabling responsive handling of backpressure situations.

**Requirements**:
- Provide a non-blocking alternative to `Schedule()` that attempts to schedule a task immediately
- Return an error when the runner cannot accept the task because it has reached its concurrency limit
- The error should be a sentinel error that callers can check programmatically
- Maintain the same concurrency control guarantees as `Schedule()` (task runs within the concurrency limit)
- Ensure proper panic recovery for scheduled tasks

**Acceptance**:
- `TaskRunner` must provide a method named `ScheduleImmediately(task func()) error` that returns an error when capacity is full
- A package-level sentinel error `ErrTaskRunnerBusy` must be exported for programmatic checking
- When a task is scheduled with the non-blocking method and the runner has available capacity, the task is accepted and runs
- When a task is scheduled with the non-blocking method and the runner is at capacity, `ErrTaskRunnerBusy` is returned immediately without blocking
- When scheduling `N` tasks to a runner with concurrency `C` where `N > C`, and each task sleeps long enough to prevent completion before all scheduling attempts, tasks beyond the capacity receive `ErrTaskRunnerBusy`
- Only the successfully scheduled tasks execute

---

### FR2: Wait Mechanism for TaskRunner

**Problem**: TaskRunner provides no mechanism to wait for all scheduled tasks to complete. Callers must implement their own synchronization (e.g., using separate WaitGroups) to know when all tasks have finished, which is error-prone and leads to duplicated boilerplate code.

**Requirements**:
- Provide a method to block until all currently scheduled tasks have completed execution
- The wait mechanism must correctly account for tasks scheduled via both the blocking `Schedule` method and any non-blocking scheduling methods
- The implementation must avoid race conditions where a task scheduled just before calling wait might be missed

**Acceptance**:
- `TaskRunner` must provide method `Wait()` that blocks until all scheduled tasks complete
- When multiple tasks are scheduled and then `Wait()` is called, it blocks until all tasks complete
- When `Wait()` returns, all previously scheduled tasks have finished their execution
- When tasks panic during execution, they are recovered and `Wait()` still completes correctly
- Scheduling a task and immediately calling `Wait()` correctly waits for that task to complete

---

### FR3: Concurrent Runner with Ordered Message Delivery

**Problem**: Applications processing streams of messages (such as Kafka consumers) need to process messages in parallel for throughput while preserving the original message order when retrieving results. Standard concurrent processing loses ordering guarantees.

**Requirements**:
- Implement a concurrent runner that accepts messages for parallel processing
- Messages pushed to the runner must be processed concurrently using available CPU cores
- Results must be retrievable in the exact order that messages were pushed, regardless of processing completion order
- The runner must support generic input and output types
- Provide a method to push messages for processing
- Provide a method to retrieve the next processed result in push order (blocks if not ready)
- Provide a method to signal completion and wait for all messages to be processed and consumed
- After the runner is closed, pushing new messages must return an error
- After the runner is closed and all results are consumed, retrieval must return an error
- The runner should handle scenarios where processing times vary significantly between messages (e.g., first message takes 100ms, others take 1-10ms) while still maintaining order

**Acceptance**:
- Implement a generic concurrent runner supporting arbitrary input/output types in `core/threading` package
- Provide constructor accepting a processing function
- Provide methods to push input, get output, and wait for completion
- A package-level sentinel error `ErrRunnerClosed` must be exported for programmatic checking
- When messages 0, 1, 2, ... N are pushed and message 0 has the longest processing time, retrieval calls still return results in order 0, 1, 2, ... N
- When multiple messages are pushed with random processing delays, the sequence of values returned is sorted in the original push order
- When the wait method is called after pushing messages, it blocks until all messages have been both processed and retrieved
- When push is called after the runner is closed, it returns `ErrRunnerClosed`
- When get is called after the runner is closed with no remaining messages, it returns `ErrRunnerClosed`
- The StableRunner implementation must use an unexported package-level constant `bufSize` to define the internal channel buffer capacity
- The runner supports concurrent push and get operations from different goroutines
- The wait loop in the runner must use efficient polling to reduce CPU overhead when waiting for results to be consumed

---

# Environment Dependency Changes (relative to Base Env)

## Go Runtime
- Go upgraded to 1.21.13

## Environment Variables
- GOMODCACHE set to /go/pkg/mod

## Go Packages (Version Upgrades)
- github.com/alicebob/miniredis/v2 upgraded to v2.34.0
- github.com/bufbuild/protocompile upgraded to v0.14.1
- github.com/cenkalti/backoff/v4 upgraded to v4.3.0
- github.com/cespare/xxhash/v2 upgraded to v2.3.0
- github.com/DATA-DOG/go-sqlmock upgraded to v1.5.2
- github.com/eapache/go-resiliency upgraded to v1.6.0
- github.com/fatih/color upgraded to v1.18.0
- github.com/fullstorydev/grpcurl upgraded to v1.9.2
- github.com/golang-jwt/jwt/v4 upgraded to v4.5.1
- github.com/golang/protobuf upgraded to v1.5.4
- github.com/go-logr/logr upgraded to v1.4.2
- github.com/google/go-cmp upgraded to v0.6.0
- github.com/google/uuid upgraded to v1.6.0
- github.com/go-sql-driver/mysql upgraded to v1.9.0
- github.com/grpc-ecosystem/grpc-gateway/v2 upgraded to v2.20.0
- github.com/IBM/sarama upgraded to v1.43.1
- github.com/jackc/pgx/v5 upgraded to v5.7.2
- github.com/jhump/protoreflect upgraded to v1.17.0
- github.com/klauspost/compress upgraded to v1.17.11
- github.com/montanaflynn/stats upgraded to v0.7.1
- github.com/openzipkin/zipkin-go upgraded to v0.4.3
- github.com/pelletier/go-toml/v2 upgraded to v2.2.2
- github.com/pierrec/lz4/v4 upgraded to v4.1.21
- github.com/prometheus/client_golang upgraded to v1.21.0
- github.com/prometheus/client_model upgraded to v0.6.1
- github.com/prometheus/common upgraded to v0.62.0
- github.com/prometheus/procfs upgraded to v0.15.1
- github.com/rabbitmq/amqp091-go upgraded to v1.9.0
- github.com/redis/go-redis/v9 upgraded to v9.7.1
- github.com/stretchr/testify upgraded to v1.10.0
- github.com/yuin/gopher-lua upgraded to v1.1.1
- go.etcd.io/etcd/api/v3 upgraded to v3.5.15
- go.etcd.io/etcd/client/pkg/v3 upgraded to v3.5.15
- go.etcd.io/etcd/client/v3 upgraded to v3.5.15
- go.mongodb.org/mongo-driver upgraded to v1.17.3
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
- google.golang.org/genproto/googleapis/api upgraded to v0.0.0-20240711142825-46eb208f015d
- google.golang.org/genproto/googleapis/rpc upgraded to v0.0.0-20240701130421-f6361c86f094
- google.golang.org/grpc upgraded to v1.65.0
- google.golang.org/protobuf upgraded to v1.36.5
- k8s.io/api upgraded to v0.29.3
- k8s.io/apimachinery upgraded to v0.29.4
- k8s.io/client-go upgraded to v0.29.3
- k8s.io/klog/v2 upgraded to v2.110.1
- sigs.k8s.io/structured-merge-diff/v4 upgraded to v4.4.1
