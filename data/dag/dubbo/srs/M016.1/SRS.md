# Software Requirements Specification: M016.1 - REST Bean Argument Resolution and Protocol Fixes

## Overview

This milestone addresses REST protocol bean argument binding issues and various protocol-level fixes. The primary functionality ensures proper framework component registration for REST argument resolution.

**Affected Modules**:
- `dubbo-plugin/dubbo-rest-spring` - ScopeModelInitializer for REST Spring module
- `dubbo-common` - UrlUtils and ReflectionMethodDescriptor
- `dubbo-rpc/dubbo-rpc-triple` - ReflectionPackableMethod

---

## Functional Requirements

### FR1: REST Spring Module Bean Registration for Argument Resolution

**Problem**: In REST protocol endpoints, bean argument binding fails when the required framework-level components are not properly registered at startup. This causes REST service methods that accept complex bean parameters to fail during argument resolution.

**Root Cause Analysis**:
- `BeanArgumentBinder` depends on `CompositeArgumentResolver` for resolving nested bean properties and converting argument types
- `RestRequestHandlerMapping` depends on `GeneralTypeConverter` and `CompositeArgumentResolver` for proper request handling
- While `getOrRegisterBean()` provides lazy initialization, the `dubbo-rest-spring` module requires explicit SPI-based registration to ensure these beans are available when the Spring REST integration initializes
- Without a dedicated `ScopeModelInitializer`, the module lacks a proper initialization hook in the Dubbo framework lifecycle

**Requirements**:

1. **Create `RestSpringScopeModelInitializer` class**:
   - Package: `org.apache.dubbo.rpc.protocol.tri.rest.support.spring`
   - Implement `org.apache.dubbo.rpc.model.ScopeModelInitializer` interface
   - Override `initializeFrameworkModel(FrameworkModel frameworkModel)` method
   - Register the following beans to `frameworkModel.getBeanFactory()`:
     - `org.apache.dubbo.rpc.protocol.tri.rest.argument.GeneralTypeConverter`
     - `org.apache.dubbo.common.utils.DefaultParameterNameReader`
     - `org.apache.dubbo.rpc.protocol.tri.rest.argument.CompositeArgumentResolver`

2. **Register via Dubbo SPI**:
   - Create file: `META-INF/dubbo/internal/org.apache.dubbo.rpc.model.ScopeModelInitializer`
   - Content: `rest-spring=org.apache.dubbo.rpc.protocol.tri.rest.support.spring.RestSpringScopeModelInitializer`

**Acceptance**:
- REST endpoints can properly bind bean arguments from request body
- Service methods with bean parameters correctly receive deserialized objects
- Methods with mixed bean and primitive parameters work correctly

---

### FR2: URL Service Model Null Safety

**Problem**: URL operations cause NullPointerException when the service model, its metadata, or attribute map is not available. This affects registry operations, metadata reporting, and multi-registry scenarios where URLs may not have fully initialized service models.

**Root Cause Analysis**:
- `UrlUtils.computeServiceAttribute()` directly chains method calls: `url.getServiceModel().getServiceMetadata().getAttributeMap().computeIfAbsent(...)`
- When any component in this chain is null, NPE is thrown
- This occurs during registry subscription/unsubscription and metadata report operations

**Requirements**:
- `UrlUtils.computeServiceAttribute()` must safely handle null at each level of the chain
- Use Optional chaining or null checks to traverse: ServiceModel -> ServiceMetadata -> AttributeMap
- Return null when any component in the chain is null (do not throw exception)
- The method signature and return type must remain unchanged for backward compatibility

**Acceptance**:
- Registry operations complete without NPE when service model is null
- Metadata report operations handle missing service metadata gracefully
- Multi-registry scenarios work correctly when URLs have partial initialization

---

### FR3: Server-Streaming Method Type Resolution

**Problem**: Server-streaming RPC methods may fail during REST endpoint invocation due to incomplete type initialization in method descriptors.

**Root Cause Analysis**:
- When `ReflectionMethodDescriptor` identifies a SERVER_STREAM method, it sets the RPC type but may not initialize `actualResponseType`
- `ReflectionPackableMethod` locally computed types instead of using the method descriptor
- For parameterless server-streaming methods, serialization fails when `actualRequestTypes` is null or empty

**Requirements**:

1. **ReflectionMethodDescriptor Changes**:
   - For SERVER_STREAM methods (void return, single StreamObserver parameter): initialize `actualRequestTypes` as empty array and extract `actualResponseType` from the StreamObserver generic parameter
   - For SERVER_STREAM methods (void return, request param + StreamObserver): initialize both `actualRequestTypes` and `actualResponseType`
   - Expose `getActualRequestTypes()` and `getActualResponseType()` through the MethodDescriptor interface

2. **ReflectionPackableMethod Changes**:
   - For CLIENT_STREAM, BI_STREAM, and SERVER_STREAM types: obtain types from method descriptor instead of computing locally
   - Before serializing request arguments, check if `actualRequestTypes` is null or empty; if so, skip serialization and return builder result directly

---

### FR4: grpc-timeout Header Specification Compliance

**Problem**: The grpc-timeout header value format does not comply with the gRPC specification.

**Requirements**:
- Implement proper grpc-timeout header parsing and formatting in `GrpcUtils`
- The timeout format must follow gRPC specification (numeric value + time unit suffix)

---

### FR5: Triple Protocol Native Image Compatibility

**Problem**: Triple protocol fails when running in GraalVM native image environment due to MetadataServiceV2 initialization issues.

**Requirements**:
- In `MetadataUtils`, check for native image mode before enabling MetadataServiceV2
- MetadataServiceV2 must be disabled when running in native image environment

---

### FR6: Channel Handler Context Lifecycle Management

**Problem**: Channel handler context is closed prematurely before write operations complete, causing connection issues.

**Requirements**:
- In `ExchangeCodec` and `GracefulShutdown`, ensure channel context is only closed after write operation futures complete
- Add future listeners to handle proper cleanup timing

---

### FR7: Connection Reconnect Interval Restoration

**Problem**: The reconnect interval configuration is not being applied in `AbstractNettyConnectionClient`.

**Requirements**:
- Reconnection scheduling must use the configured reconnect duration
- The reconnect task should respect the configured interval from connection handler

---

### FR8: TriRpcStatus Error Description Enhancement

**Problem**: Error descriptions in TriRpcStatus lack HTTP status information for invalid content-type responses.

**Requirements**:
- Include HTTP status code in error descriptions when content-type validation fails

---

### FR9: Content-Type Charset Parsing Accuracy

**Problem**: Charset extraction from Content-Type header fails when the charset parameter is followed by additional parameters.

**Requirements**:
- Add `HttpUtils.getCharsetFromContentType()` method to properly parse charset value
- Charset extraction must stop at the first semicolon after the charset value
- `DefaultHttpRequest.charset()` and `DefaultHttpResponse.charset()` must use this utility method

---

### FR10: Resource Leak Prevention

**Problem**: `JarScanner` does not properly close `JarFile` resources, causing potential resource leaks.

**Requirements**:
- Wrap `JarFile` resources in try-with-resources blocks in `JarScanner`

---

### FR11: ConsistentHashSelector Concurrency Optimization

**Problem**: High CPU load occurs under high concurrency due to race conditions creating multiple ConsistentHashSelector instances for the same key.

**Requirements**:
- Replace `put()`/`get()` pattern with atomic `compute()` operation in `ConsistentHashLoadBalance.doSelect()`
- The selector creation must be atomic to prevent redundant instance creation under concurrent access

---

### FR12: Triple Protocol Stream Flow Control

**Problem**: HTTP/2 and HTTP/3 stream flow control needs improvements for better performance.

**Requirements**:
- Enhance `TriHttp2RemoteFlowController` for better flow control handling
- Improve `Http3ClientFrameCodec` frame handling

---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
