# Software Requirements Specification: Tracing and Metrics Infrastructure Improvements

## Overview

This milestone addresses multiple issues in Dubbo's tracing and metrics infrastructure to improve reliability, integration flexibility, and error handling. The changes focus on:

1. **FR1**: Decouple micrometer-core from mandatory tracing dependencies
2. **FR2**: Add missing Zipkin dependencies for tracing integration
3. **FR3**: Fix BytesEncoder type resolution for Zipkin reporter
4. **FR4**: Fix baggage propagation error on provider side
5. **FR5**: Fix ClassCastException in observation handlers with Spring WebFlux
6. **FR6**: Handle NaN values gracefully in metrics digest
7. **FR7**: Improve MetricsEventBus null safety and type checking

**Affected Modules**:
- `dubbo-metrics/dubbo-metrics-api`
- `dubbo-metrics/dubbo-metrics-event`
- `dubbo-metrics/dubbo-tracing`
- `dubbo-spring-boot-project/dubbo-spring-boot-autoconfigure`
- `dubbo-spring-boot-project/dubbo-spring-boot-starters/dubbo-tracing-brave-zipkin-spring-boot-starter`
- `dubbo-dependencies-bom`

---

## Requirements

### FR1: Decouple Micrometer Core from Tracing Dependencies

**Problem**: The dubbo-tracing module has a hard compile-time dependency on micrometer-core, requiring users to include micrometer metrics dependencies even when they only want distributed tracing functionality.

**User Report**:
```
When using Dubbo tracing with only Brave/Zipkin for distributed tracing,
the application fails at runtime because micrometer-core classes are required
but not intended to be used. Users who want tracing without metrics collection
should be able to do so without micrometer-core on the classpath.
```

**Requirements**:
- Introduce an abstraction layer that isolates micrometer-core meter registry usage from the core tracing initialization
- Allow the tracing module to function without micrometer-core on the classpath
- When metrics support is detected at runtime, integrate the meter registry with the observation registry
- Maintain backward compatibility for users who have both tracing and metrics enabled

**Acceptance**:
- When tracing is configured without micrometer-core on classpath, the application starts successfully
- When both tracing and metrics are enabled, observation events are reported to the meter registry
- Existing tracing functionality remains unchanged for users with full dependencies
- Create a new utility class `ObservationMeter` in package `org.apache.dubbo.tracing.metrics` with a static method `addMeterRegistry(ObservationRegistry registry, ApplicationModel applicationModel)` that isolates micrometer-core usage
- The `DubboObservationRegistry.initObservationRegistry()` method must use `ObservationMeter.addMeterRegistry()` instead of directly referencing `io.micrometer.core.instrument.observation.DefaultMeterObservationHandler`

---

### FR2: Add Missing Zipkin Dependencies

**Problem**: The Zipkin tracing starter is missing required transitive dependencies, causing ClassNotFoundException at runtime when configuring Zipkin-based tracing.

**User Report**:
```
After configuring dubbo-tracing-brave-zipkin-spring-boot-starter, the application
fails with ClassNotFoundException for Zipkin classes. The starter does not pull
in the required zipkin core library or sender dependencies.
```

**Requirements**:
- Add the zipkin core library (`io.zipkin.zipkin2:zipkin`) as a managed dependency
- Include the zipkin sender dependency for URL connection-based reporting
- Ensure all required Zipkin classes are available when using the Brave-Zipkin starter

**Acceptance**:
- When using dubbo-tracing-brave-zipkin-spring-boot-starter, all Zipkin classes are available
- Zipkin span reporting works without manual dependency additions
- No ClassNotFoundException for Zipkin-related classes during startup

---

### FR3: Fix BytesEncoder Type Resolution for Zipkin Reporter

**Problem**: ClassCastException occurs when creating the Zipkin AsyncReporter due to incompatible BytesEncoder types.

**User Report**:
```
java.lang.ClassCastException: class zipkin2.codec.SpanBytesEncoder cannot be cast
to class zipkin2.reporter.BytesEncoder

When Zipkin tracing is configured, the application fails to start because the
auto-configured SpanBytesEncoder bean is not compatible with the AsyncReporter
builder which expects zipkin2.reporter.BytesEncoder.
```

**Requirements**:
- Provide a BytesEncoder bean of the correct type (`zipkin2.reporter.BytesEncoder`) for the AsyncReporter
- The AsyncReporter configuration should receive the properly typed encoder
- Maintain backward compatibility with existing SpanBytesEncoder for other consumers

**Acceptance**:
- When Zipkin endpoint is configured, AsyncReporter is created successfully without ClassCastException
- Span encoding and reporting to Zipkin works correctly
- Both encoder types are available for their respective consumers

---

### FR4: Fix Baggage Propagation Error on Provider Side

**Problem**: Baggage values are corrupted when retrieved on the provider side due to incorrect string conversion.

**User Report**:
```
Baggage headers propagated from consumer to provider contain unexpected "null"
string values. When the consumer sets a baggage value and the provider retrieves
it, the value is either "null" or wrapped incorrectly, breaking cross-service
context propagation.
```

**Requirements**:
- The server-side context extraction should retrieve baggage attachment values directly without additional string conversion
- When an attachment value is null, it should remain null rather than being converted to the string "null"
- Baggage propagation between consumer and provider should preserve original values

**Acceptance**:
- When consumer sets baggage header `X-Custom-Header=value`, provider receives `value`
- When consumer does not set a baggage header, provider receives null (not string "null")
- Trace context and baggage propagate correctly across service boundaries
- In `DubboServerContext` constructor, the getter function passed to `ReceiverContext` superclass must return `carrier.getAttachment(s)` directly (not wrapped in `String.valueOf()`)

---

### FR5: Fix ClassCastException in Observation Handlers

**Problem**: ClassCastException occurs in Dubbo tracing observation handlers when used alongside Spring WebFlux or other frameworks that also use Micrometer observation contexts.

**User Report**:
```
java.lang.ClassCastException when integrating Dubbo tracing with Spring WebFlux.
The Dubbo observation handlers match too broadly, accepting any SenderContext
or ReceiverContext rather than only Dubbo-specific contexts. This causes the
handlers to receive incompatible context types from WebFlux observations.
```

**Requirements**:
- The Dubbo client tracing observation handler should only match Dubbo-specific client contexts
- The Dubbo server tracing observation handler should only match Dubbo-specific server contexts
- Observation handlers from other frameworks (Spring WebFlux, etc.) should not interfere with Dubbo handlers

**Acceptance**:
- When Dubbo tracing is used with Spring WebFlux, no ClassCastException occurs
- Dubbo client observations are handled only by Dubbo client handlers
- Dubbo server observations are handled only by Dubbo server handlers
- WebFlux and other framework observations pass through to their respective handlers
- `DubboClientTracingObservationHandler.supportsContext(Observation.Context context)` must check `context instanceof DubboClientContext` (not `SenderContext`)
- `DubboServerTracingObservationHandler.supportsContext(Observation.Context context)` must check `context instanceof DubboServerContext` (not `ReceiverContext`)

---

### FR6: Handle NaN Values in Metrics Digest

**Problem**: IllegalArgumentException is thrown when NaN values are added to the metrics t-digest, causing metrics collection to fail.

**User Report**:
```
java.lang.IllegalArgumentException: Cannot add NaN to t-digest

Under certain conditions (e.g., division by zero in latency calculations),
NaN values are passed to the metrics digest. This crashes the metrics
collection and potentially affects application stability.
```

**Requirements**:
- NaN values passed to the metrics digest should be silently ignored rather than throwing an exception
- The digest should continue to function normally after receiving NaN values
- Valid numeric values should still be processed correctly

**Acceptance**:
- When NaN is added to the digest, no exception is thrown
- Metrics collection continues to function after receiving NaN values
- Quantile calculations remain accurate using only valid numeric data
- Application stability is not affected by occasional NaN inputs

---

### FR7: Improve MetricsEventBus Null Safety and Type Checking

**Problem**: NullPointerException and ClassCastException can occur in MetricsEventBus under edge cases.

**User Report**:
```
NullPointerException in MetricsEventBus.publish() when null event is passed.
ClassCastException in MetricsEventBus.after() when the event is not a
TimeCounterEvent but is cast unconditionally. These errors occur during
rapid service startup/shutdown or error conditions.
```

**Requirements**:
- The publish method should handle null event parameter gracefully
- The tryInvoke method should handle null runnable parameter gracefully
- The after and error methods should verify the event type before casting to TimeCounterEvent
- All methods should fail safely without propagating exceptions

**Acceptance**:
- When null event is passed to publish(), the method returns silently without exception
- When null runnable is passed to tryInvoke(), the method returns silently without exception
- When non-TimeCounterEvent is passed to after() or error(), the method handles it gracefully
- MetricsEventBus operations do not cause application failures under edge conditions
- Existing metrics event publishing functionality works correctly for valid inputs
- `MetricsEventBus.publish(MetricsEvent event)` must check `if (event == null || event.getSource() == null)` and return early
- `MetricsEventBus.tryInvoke(Runnable runnable)` must check `if (runnable == null)` and return early
- `MetricsEventBus.after(MetricsEvent event, Object result)` must check `if (event instanceof TimeCounterEvent)` before casting to `TimeCounterEvent`
- `MetricsEventBus.error(MetricsEvent event)` must check `if (event instanceof TimeCounterEvent)` before casting to `TimeCounterEvent`


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
