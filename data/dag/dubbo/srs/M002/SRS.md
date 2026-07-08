# Software Requirements Specification
## M002 - HTTP/2 Connection Preface Protocol Implementation

---

## Overview

This milestone addresses HTTP/2 connection preface protocol compliance issues in the Dubbo triple protocol implementation. The requirements ensure proper handshaking between HTTP/2 clients and servers according to RFC 7540, preventing connection failures caused by premature data transmission.

### Requirements Summary

1. **FR1**: Client-side connection preface handling - Client must wait for server SETTINGS frame before sending request headers
2. **FR2**: Client-side channel initialization synchronization - Connection must wait for channel initialization to complete before awaiting connection preface
3. **FR3**: Server-side connection preface handling - Server must cache outbound messages until client connection preface arrives

### Affected Modules

- `dubbo-remoting-netty4` (Netty connection client)
- `dubbo-remoting-http12` (HTTP/2 frame codec)
- `dubbo-rpc-triple` (Triple protocol HTTP/2 handlers)

---

## Functional Requirements

### FR1: Client-Side HTTP/2 Connection Preface Handling

**Problem**: HTTP/2 clients may receive GO_AWAY frames and immediate disconnection when sending headers before receiving the server's SETTINGS frame, particularly when client header list size exceeds the server's MAX_HEADER_LIST_SIZE setting.

**User Report**:
```
HTTP/2 connection failures observed in production when clients send large headers
immediately after connection establishment. Server responds with GO_AWAY frame
before client can complete request. Issue appears intermittently under high load
when header sizes approach server limits.
```

**Requirements**:
- HTTP/2 clients must wait for the server connection preface (SETTINGS frame) before sending any request headers
- The wait operation must respect the existing connection timeout configuration
- If the server SETTINGS frame is not received within the timeout, the connection attempt must fail with an appropriate error
- The implementation must only apply to HTTP/2 connections, not affecting other protocols
- The first inbound SETTINGS frame from the server signals successful connection preface receipt

**Acceptance**:
- When an HTTP/2 client connects to a server, headers are not transmitted until the server's SETTINGS frame is received
- When the server SETTINGS frame does not arrive within the connection timeout, the connection fails with a timeout error indicating connection preface timeout
- When using non-HTTP/2 protocols, connection behavior remains unchanged and no additional waiting occurs
- Triple protocol REST endpoint invocations complete successfully without GO_AWAY disconnections

---

### FR2: Client-Side Channel Initialization Synchronization

**Problem**: Race condition exists where the connection preface promise may not be created before the client attempts to wait on it, due to channel initialization occurring on a separate Netty worker thread.

**Requirements**:
- The client connection process must wait for channel initialization to complete before waiting for the connection preface
- Channel initialization completion must be signaled via a dedicated synchronization mechanism
- If channel initialization does not complete within the connection timeout, the connection must fail with an appropriate error
- The channel initialization promise must be properly cleaned up after use to prevent memory leaks on reconnection

**Acceptance**:
- When connecting to an HTTP/2 server, the client waits for channel initialization before checking for connection preface
- When channel initialization times out, a clear error is reported indicating channel initialization timeout
- When reconnecting after a disconnection, new promises are properly created without interference from previous connection state

---

### FR3: Server-Side HTTP/2 Connection Preface Handling

**Problem**: HTTP/2 servers may send response headers to clients before the client has completed its connection preface, leading to protocol errors or dropped responses.

**User Report**:
```
Intermittent response failures where server-sent headers appear to be lost.
Client receives no response despite server processing completing successfully.
Issue correlates with high-latency network conditions.
```

**Requirements**:
- HTTP/2 servers must cache all outbound messages until the client connection preface (SETTINGS frame) is received
- A timeout mechanism must exist to prevent indefinite waiting for slow or misbehaving clients
- The timeout duration must be 3 seconds for client connection preface arrival
- If the client connection preface does not arrive within the timeout, the connection must be closed
- Upon receiving the client SETTINGS frame, all cached messages must be written in order
- The caching mechanism must handle multiple HTTP/2 stream channels sharing the same connection
- After the client connection preface arrives, subsequent writes must proceed without caching

**Acceptance**:
- When a client connects to an HTTP/2 server, server responses are held until the client SETTINGS frame is received
- When the client SETTINGS frame arrives, all cached responses are sent to the client in order
- When a client does not send its connection preface within 3 seconds, the server closes the connection
- When multiple streams are active on a connection, all streams receive proper connection preface notification
- Triple protocol REST endpoints respond correctly to client requests without dropped messages

---

## Test Acceptance Criteria

### Testing Limitations

The core HTTP/2 Connection Preface functionality operates at the Netty network layer.
The existing test framework uses `TestProtocol` (a mock protocol) that does not establish
real TCP/HTTP/2 connections, therefore cannot directly exercise the modified code paths:

- `NettyConnectionClient.java` - Requires real Netty client connection
- `Http2ClientSettingsHandler.java` - Requires real HTTP/2 SETTINGS frame exchange
- `NettyHttp2FrameCodec.java` - Requires real HTTP/2 stream processing
- `NettyHttp2SettingsHandler.java` - Requires real HTTP/2 SETTINGS frame reception
- `TripleHttp2Protocol.java` - Requires real Triple protocol initialization

### Available Indirect Verification Tests

The following tests verify that the changes do not break existing functionality:

#### REST Protocol Integration Tests (via TestProtocol mock)
- Bean argument POST requests with map-style body parameters complete successfully
- Bean argument requests with array-style body parameters complete successfully
- Bean argument requests with direct object body complete successfully

#### Radix Tree Mapping Tests (unit tests)
- Repeat path addition without predicate function handles duplicates correctly
- Repeat path addition with predicate function and Registration handles duplicates correctly
- Repeat path addition with predicate function handles duplicates correctly

#### OAuth2 Security Deserialization Tests (unit tests)
- OAuth2 client authentication token serialization/deserialization works correctly
- Bearer token authentication serialization/deserialization works correctly
- Registered client serialization/deserialization works correctly

**Note**: Full verification of HTTP/2 Connection Preface functionality requires integration
tests with real network connections, which are beyond the scope of the current test suite.

---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
