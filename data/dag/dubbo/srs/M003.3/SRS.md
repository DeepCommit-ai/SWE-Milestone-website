# Software Requirements Specification: Mutiny Reactive Streaming Support

## Overview

This milestone implements comprehensive Mutiny reactive streaming support for Apache Dubbo's Triple protocol. The implementation provides client and server call utilities, method handlers for all four gRPC communication patterns, and a code generator for producing Mutiny-based stubs from Protocol Buffer definitions.

### Requirements Summary

1. **FR1**: Implement client-side Mutiny call utilities for all streaming patterns
2. **FR2**: Implement server-side Mutiny call utilities for all streaming patterns
3. **FR3**: Implement Mutiny method handlers for server-side stub invocation
4. **FR4**: Implement Mutiny code generator for Protocol Buffer compilation
5. **FR5**: Fix code generation templates for proto files without package declarations

### Affected Modules

- `dubbo-plugin/dubbo-mutiny` - Mutiny reactive streaming integration
- `dubbo-plugin/dubbo-compiler` - Protocol Buffer code generation

---

## FR1: Mutiny Client Call Utilities

**Problem**: The Mutiny module lacks client-side utilities to convert RPC calls into Mutiny reactive types (Uni and Multi), preventing developers from using Mutiny's reactive programming model on the client side.

**Requirements**:
- Provide a utility class for converting client-side Triple protocol calls to Mutiny reactive types
- Support unary-to-unary calls: accept a `Uni<TRequest>` and return a `Uni<TResponse>`
- Support unary-to-stream calls: accept a `Uni<TRequest>` and return a `Multi<TResponse>` that emits multiple response items
- Support stream-to-unary calls: accept a `Multi<TRequest>` and return a `Uni<TResponse>`
- Support bidirectional streaming calls: accept a `Multi<TRequest>` and return a `Multi<TResponse>`
- Properly propagate errors from the underlying RPC calls to the Mutiny publishers
- Integrate with the existing `StubInvocationUtil` for making actual RPC calls
- Use `ClientTripleMutinyPublisher` and `ClientTripleMutinySubscriber` for stream handling

**Acceptance**:
- Follow the naming and structure pattern established by `dubbo-reactive` module (e.g., `ReactorClientCalls` → corresponding Mutiny utility class)
- The utility class must use the utility class pattern (private constructor, static methods)
- Provide static methods for each of the four gRPC streaming patterns, using Mutiny types:
  - Unary: accepts `Uni<TRequest>`, returns `Uni<TResponse>`
  - Server-streaming: accepts `Uni<TRequest>`, returns `Multi<TResponse>`
  - Client-streaming: accepts `Multi<TRequest>`, returns `Uni<TResponse>`
  - Bidirectional: accepts `Multi<TRequest>`, returns `Multi<TResponse>`
- When a unary client call succeeds, the returned Uni emits the response value
- When a unary client call fails, the returned Uni propagates the error through Mutiny's failure mechanism
- When a server-streaming call is made, the returned Multi emits all items sent by the server
- When a client-streaming call is made, all items from the request Multi are sent to the server

---

## FR2: Mutiny Server Call Utilities

**Problem**: The Mutiny module lacks server-side utilities to adapt incoming RPC requests into Mutiny reactive types and convert Mutiny responses back to stream observers, preventing developers from implementing services using Mutiny's reactive programming model.

**Requirements**:
- Provide a utility class for converting server-side stream observers to Mutiny reactive types
- Support unary-to-unary calls: accept a request and `StreamObserver<R>`, apply a `Function<Uni<T>, Uni<R>>`, and send the result to the observer
- Support unary-to-stream calls: accept a request and `StreamObserver<R>`, apply a `Function<Uni<T>, Multi<R>>`, and send all emitted items to the observer
- Support stream-to-unary calls: return a `StreamObserver<T>` that collects requests into a Multi, apply a `Function<Multi<T>, Uni<R>>`, and send the result to the response observer
- Support bidirectional streaming calls: return a `StreamObserver<T>` for requests, apply a `Function<Multi<T>, Multi<R>>`, and send all response items to the response observer
- Handle null responses by failing with a NOT_FOUND status
- Properly convert exceptions to RPC status exceptions
- Handle cancellation scenarios appropriately
- Use `ServerTripleMutinyPublisher` and `ServerTripleMutinySubscriber` for stream handling

**Acceptance**:
- Follow the naming and structure pattern established by `dubbo-reactive` module (e.g., `ReactorServerCalls` → corresponding Mutiny utility class)
- The utility class must use the utility class pattern (private constructor, static methods)
- Provide static methods for each of the four gRPC streaming patterns:
  - Unary: accepts request, `StreamObserver<R>`, and a `Function<Uni<T>, Uni<R>>`
  - Server-streaming: accepts request, `StreamObserver<R>`, and a `Function<Uni<T>, Multi<R>>`; returns a `CompletableFuture` for tracking completion
  - Client-streaming: accepts `StreamObserver<R>` and a `Function<Multi<T>, Uni<R>>`; returns a `StreamObserver<T>` for receiving client items
  - Bidirectional: accepts `StreamObserver<R>` and a `Function<Multi<T>, Multi<R>>`; returns a `StreamObserver<T>`
- When the service function returns a successful response, the response observer receives onNext followed by onCompleted
- When the service function throws an exception, the response observer receives onError with a proper RPC status exception (convert throwable to status using the existing `TriRpcStatus` utility)
- When handling streaming responses, all emitted items are forwarded to the response observer
- When handling streaming requests, incoming items are properly collected and passed to the service function as a Multi
- When the service function returns null for unary responses, propagate a NOT_FOUND status error to the response observer

---

## FR3: Mutiny Method Handlers

**Problem**: Server stubs require method handlers that can invoke service implementations using Mutiny reactive types, but no such handlers exist for the Mutiny module.

**Requirements**:
- Implement `OneToOneMethodHandler` for unary-to-unary method invocations
  - Accept a `Function<Uni<T>, Uni<R>>` as the service implementation
  - Return a `CompletableFuture<R>` from the invoke method
  - Extract the request from arguments and wrap in a Uni
  - Use an observer adaptor to bridge between the Uni result and the CompletableFuture
- Implement `OneToManyMethodHandler` for unary-to-stream method invocations
  - Accept a `Function<Uni<T>, Multi<R>>` as the service implementation
  - Return a `CompletableFuture` from the invoke method
  - Extract request and response observer from arguments
  - Delegate to MutinyServerCalls.oneToMany
- Implement `ManyToOneMethodHandler` for stream-to-unary method invocations
  - Accept a `Function<Multi<T>, Uni<R>>` as the service implementation
  - Return a `CompletableFuture<StreamObserver<T>>` from the invoke method
  - Extract response observer from arguments
  - Delegate to MutinyServerCalls.manyToOne
- Implement `ManyToManyMethodHandler` for bidirectional streaming method invocations
  - Accept a `Function<Multi<T>, Multi<R>>` as the service implementation
  - Return a `CompletableFuture<StreamObserver<T>>` from the invoke method
  - Extract response observer from arguments
  - Delegate to MutinyServerCalls.manyToMany
- All handlers must implement the `StubMethodHandler<T, R>` interface

**Acceptance**:
- Follow the naming, structure, and package pattern established by `dubbo-reactive/handler/` module
- Each handler must implement the `StubMethodHandler` interface
- Each handler accepts a service function in its constructor (using Mutiny types Uni/Multi instead of Reactor types Mono/Flux)
- The `invoke(Object[] arguments)` method extracts request/observer from arguments following the same convention as the Reactor handlers
- Handler behavior for each pattern:
  - Unary handler: extracts request from arguments, applies the function, returns `CompletableFuture` with the response
  - Server-streaming handler: extracts request and response observer, delegates to the server calls utility
  - Client-streaming handler: extracts response observer, returns `CompletableFuture<StreamObserver<T>>` for receiving client items
  - Bidirectional handler: extracts response observer, returns `CompletableFuture<StreamObserver<T>>` for bidirectional communication
- When an error occurs in any handler, it is properly propagated to the response observer

---

## FR4: Mutiny Code Generator

**Problem**: Developers cannot automatically generate Mutiny-based stub code from Protocol Buffer service definitions, requiring manual implementation of Mutiny service interfaces.

**Requirements**:
- Implement `MutinyDubbo3TripleGenerator` that extends `AbstractGenerator`
- Use "Dubbo" as the class name prefix
- Use "Triple" as the class name suffix
- Use "MutinyDubbo3TripleStub.mustache" as the template file name for stub generation
- Use "MutinyDubbo3TripleInterfaceStub.mustache" as the template file name for interface generation
- Always use multiple template mode (interface + implementation separate)
- Do not support single template mode (throw exception if requested)
- Provide a main method entry point that invokes `DubboGeneratorPlugin.generate`

**Acceptance**:
- Follow the naming and structure pattern established by `ReactorDubbo3TripleGenerator` in `dubbo-compiler` module
- The generator must extend `AbstractGenerator` and override the template configuration methods
- Use the same class prefix/suffix pattern as other Triple generators ("Dubbo" prefix, "Triple" suffix)
- Provide Mustache template files following the naming pattern of existing templates (interface template and stub template)
- The generator must use multiple template mode (separate interface and implementation files)
- Provide a main method entry point following the pattern of other generators
- When the generator processes a proto file with service definitions, it produces Mutiny-based stub code using Uni/Multi types

---

## FR5: Proto File Package Name Handling

**Problem**: Code generation fails or produces incorrect service names when processing proto files that do not have a package declaration (e.g., a proto file named "message.proto" without a package statement).

**Requirements**:
- Modify stub templates to handle the case when `packageName` is not present
- When `packageName` is present, generate `JAVA_SERVICE_NAME` as `"packageName.serviceName"`
- When `packageName` is absent, generate `JAVA_SERVICE_NAME` as just `"serviceName"`
- When `commonPackageName` is present, generate `SERVICE_NAME` as `"commonPackageName.serviceName"`
- When `commonPackageName` is absent, generate `SERVICE_NAME` as just `"serviceName"` (not as an empty prefix followed by the service name)
- Apply these fixes to all Triple stub generation templates (both interface and implementation templates for each generator type: standard, Reactor, and Mutiny)
- Replace short `Message` import with fully qualified `com.google.protobuf.Message` references in templates to avoid import conflicts

**Acceptance**:
- Generated interface must define `String JAVA_SERVICE_NAME` constant
- Generated interface must define `String SERVICE_NAME` constant
- When `packageName` is present, `JAVA_SERVICE_NAME` must equal `"<packageName>.<serviceName>"`
- When `packageName` is absent, `JAVA_SERVICE_NAME` must equal `"<serviceName>"` (no leading dot)
- When `commonPackageName` is present, `SERVICE_NAME` must equal `"<commonPackageName>.<serviceName>"`
- When `commonPackageName` is absent, `SERVICE_NAME` must equal `"<serviceName>"` (no leading dot or empty prefix)
- Templates must cast objects to `com.google.protobuf.Message` using fully qualified class name (not importing `Message`) to avoid name conflicts with proto-generated message classes named `Message`
- When generating code from a proto file without a package declaration, the generated stub must compile successfully
- When the generated stub class is loaded, the schema descriptor must be retrievable via `SchemaDescriptorRegistry.getSchemaDescriptor(SERVICE_NAME)`

---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
