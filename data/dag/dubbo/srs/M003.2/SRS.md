# Software Requirements Specification: Mutiny Core Abstractions and Publisher/Subscriber

## Overview

This specification defines the requirements for implementing core reactive abstractions to enable Mutiny integration with Dubbo's Triple protocol. The implementation provides a bridge between Dubbo's `CallStreamObserver` infrastructure and the Java Flow API (Publisher/Subscriber patterns), enabling reactive streaming capabilities for both client-side and server-side RPC communication.

### Requirements Summary

1. **FR1**: Implement abstract Publisher base class for Mutiny integration
2. **FR2**: Implement abstract Subscriber base class for Mutiny integration
3. **FR3**: Implement client-side Publisher for streaming responses
4. **FR4**: Implement client-side Subscriber for streaming requests
5. **FR5**: Implement server-side Publisher for streaming requests
6. **FR6**: Implement server-side Subscriber for streaming responses

### Affected Modules

- `dubbo-plugin/dubbo-mutiny`

---

## Functional Requirements

### FR1: Abstract Publisher Base Class for Mutiny Integration

**Problem**: There is no abstraction layer to bridge Dubbo's `CallStreamObserver` with the Java Flow Publisher API, preventing reactive stream consumption using Mutiny.

**Requirements**:
- Provide an abstract base class that implements both `Flow.Publisher<T>` and `Flow.Subscription` interfaces
- Extend `CancelableStreamObserver<T>` to integrate with Dubbo's existing stream observer infrastructure
- Support a single subscription model where only one subscriber can subscribe at a time
- Implement backpressure handling by accumulating requests before the subscription is ready (i.e., before `onSubscribe` binds the underlying stream observer), then forwarding accumulated requests via `CallStreamObserver.request(n)` once the subscription is established
- Disable automatic flow control on the underlying subscription to enable manual backpressure management
- Forward data items from `CallStreamObserver` callbacks to the downstream `Flow.Subscriber`
- Propagate error and completion signals to the downstream subscriber
- Support optional shutdown hooks that execute exactly once on cancel, error, or completion
- Support optional subscribe callbacks to notify when the underlying stream observer is bound
- Track cancellation and completion states to prevent duplicate signal propagation

**Acceptance**:
- When a `Flow.Subscriber` subscribes to the publisher, it receives `onSubscribe` with the publisher as the subscription
- When `request(n)` is called before the stream is ready, requests are accumulated
- When the stream becomes ready, accumulated requests are forwarded to the underlying observer
- When `onNext` is called on the stream observer, the item is forwarded to the downstream subscriber
- When `onError` or `onCompleted` is called, the corresponding signal is forwarded and the shutdown hook executes
- When `cancel` is called, the shutdown hook executes
- When attempting to subscribe a second subscriber, only the first subscription succeeds (subsequent subscribe attempts are silently ignored, following the existing Reactor implementation pattern)

### FR2: Abstract Subscriber Base Class for Mutiny Integration

**Problem**: There is no abstraction layer to bridge the Java Flow Subscriber API with Dubbo's `CallStreamObserver`, preventing reactive stream production using Mutiny.

**Requirements**:
- Provide an abstract base class that implements `Flow.Subscriber<T>` interface
- Support binding to a downstream `CallStreamObserver<T>` for data forwarding
- Implement a single subscription model that cancels duplicate upstream subscriptions
- Forward data items from the upstream `Flow.Publisher` to the downstream `CallStreamObserver`
- Request one additional item from upstream after each successful `onNext` delivery via `subscription.request(1)` to implement item-by-item flow control (reactive streams backpressure pattern)
- Propagate error and completion signals to the downstream observer
- Support cancellation that propagates to the upstream subscription
- Track cancellation and completion states to prevent operations after termination

**Acceptance**:
- When `subscribe(CallStreamObserver)` is called, the downstream is bound
- When `onSubscribe` is called with a subscription, subsequent duplicate subscriptions are cancelled
- When `onNext` is called with an item, it is forwarded to the downstream and one more item is requested
- When `onError` is called, the error is forwarded to the downstream observer
- When `onComplete` is called, the completion signal is forwarded to the downstream observer
- When `cancel` is called, the upstream subscription is cancelled

### FR3: Client-Side Publisher for Streaming Responses

**Problem**: Client applications using Mutiny cannot consume streaming responses from Triple protocol servers as reactive streams.

**Requirements**:
- Extend the abstract publisher base class for client-side usage
- Override the `beforeStart` callback to bind the client call observer adapter as the subscription source
- Support construction with optional subscribe callback and shutdown hook for lifecycle management
- Enable streaming patterns: One-to-Many, Many-to-One, and Many-to-Many from the client perspective

**Acceptance**:
- When the client call starts, the publisher binds to the `ClientCallToObserverAdapter`
- When streaming responses arrive, they are published to the Mutiny subscriber
- When the server completes the stream, the completion signal propagates to the subscriber
- When the server sends an error, the error signal propagates to the subscriber

### FR4: Client-Side Subscriber for Streaming Requests

**Problem**: Client applications using Mutiny cannot send streaming requests to Triple protocol servers as reactive streams.

**Requirements**:
- Extend the abstract subscriber base class for client-side usage
- Override the `cancel` method to also cancel the underlying client call by invoking `ClientCallToObserverAdapter.cancel(Exception)` with a cancellation exception
- Enable the client to cancel the entire RPC call when the reactive stream is cancelled

**Acceptance**:
- When items are published upstream, they are forwarded to the server via the client call observer
- When `cancel` is called, both the upstream subscription and the client call are cancelled
- When the upstream completes, the client call is half-closed signaling end of request stream

### FR5: Server-Side Publisher for Streaming Requests

**Problem**: Server implementations using Mutiny cannot consume streaming requests from clients as reactive streams.

**Requirements**:
- Extend the abstract publisher base class for server-side usage
- Accept a `CallStreamObserver` in the constructor and immediately bind it as the subscription source
- Enable streaming patterns: Many-to-One and Many-to-Many from the server perspective

**Acceptance**:
- When constructed with a `CallStreamObserver`, the publisher is immediately ready to publish
- When streaming requests arrive from the client, they are published to the Mutiny subscriber
- When the client completes the request stream, the completion signal propagates to the subscriber
- When the client sends an error, the error signal propagates to the subscriber

### FR6: Server-Side Subscriber for Streaming Responses

**Problem**: Server implementations using Mutiny cannot send streaming responses to clients as reactive streams.

**Requirements**:
- Extend the abstract subscriber base class for server-side usage
- Collect all items received from the upstream publisher for result aggregation
- Provide a `CompletableFuture` that completes with the collected items on stream completion or exceptionally on error
- When subscribing to a `CancelableStreamObserver` downstream, register a cancellation listener to propagate cancellation
- Manage cancellation context by creating one if not present on the downstream observer

**Acceptance**:
- When items are published upstream, they are both forwarded to the client and collected internally
- When `getExecutionFuture` is called, it returns a future representing the stream completion
- When the upstream completes normally, the future completes with the list of collected items
- When the upstream errors, the future completes exceptionally with the error
- When the downstream cancellation context fires, the upstream subscription is cancelled

---

## Test Acceptance Criteria

### Testing Limitations

The Publisher/Subscriber classes in this milestone operate at the reactive stream abstraction layer.
The available test suite (`f2p_tests_list`) contains tests that do not directly exercise these classes:

**Available tests (not directly related)**:
- `RestProtocolTest::bean argument post test` - Tests REST parameter binding
- `RestProtocolTest::bean argument test` - Tests REST parameter binding

These tests verify REST protocol functionality and do not test the Mutiny Publisher/Subscriber abstractions.

### Verification Approach

The Publisher/Subscriber classes are verified through:
1. **Integration Testing** (M003.3): The downstream milestone M003.3 contains tests (`MutinyServerCallsTest`, `MutinyClientCallsTest`) that exercise these abstractions through the `MutinyClientCalls` and `MutinyServerCalls` utilities.
2. **Build Verification**: Successful compilation confirms API contract correctness.

**Note**: Direct unit tests for Publisher/Subscriber classes are not included in the current test suite. Full verification requires running M003.3 tests which depend on this milestone.

---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
