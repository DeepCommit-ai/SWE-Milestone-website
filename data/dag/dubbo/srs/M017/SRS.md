# Software Requirements Specification: Remoting Module Stability and Triple Protocol Enhancements

## Overview

This milestone addresses critical stability issues in the Dubbo remoting module and enhances the Triple protocol with additional capabilities. The changes focus on:

1. **FR1**: Fix NullPointerException caused by uninitialized fields in remoting server and client classes
2. **FR2**: Fix timer task race condition where tasks start before subclass initialization completes
3. **FR3**: Add SSL session propagation for Triple protocol streams
4. **FR4**: Enforce TLS requirements on server connections when authentication policy requires it
5. **FR5**: Support Echo service invocations in Triple protocol
6. **FR6**: Fix ByteBuf memory leak in NettyChannel send operations
7. **FR7**: Handle duplicate invoker URLs from registry notifications
8. **FR8**: Improve Fastjson2 serialization initialization with comprehensive class validation
9. **FR9**: Enhance CertProvider to support remote address context

**Affected Modules**:
- `dubbo-remoting-api`
- `dubbo-remoting-netty`
- `dubbo-remoting-netty4`
- `dubbo-remoting-http3`
- `dubbo-rpc-triple`
- `dubbo-registry-api`
- `dubbo-registry-nacos`
- `dubbo-serialization-fastjson2`
- `dubbo-common`

---

## FR1: Fix NullPointerException in Remoting Server Initialization [EXTENDED]

**Problem**: Server classes experience NullPointerException when fields are accessed before initialization completes, due to final fields being initialized during object construction while super constructor calls virtual methods.

**User Report**:
```
java.lang.NullPointerException
    at NettyPortUnificationServer.getChannels()
    at AbstractServer.connected()
    ...
Fields like dubboChannels, serverShutdownTimeoutMills, supportedUrls, supportedHandlers
are accessed before they are initialized because super() constructor triggers doOpen().
```

**Requirements**:
- Move field initialization from constructors to the `doOpen()` lifecycle method for port unification servers and standard servers
- Ensure channel maps, timeout configurations, and protocol maps are initialized before they can be accessed
- Maintain backward compatibility with existing server lifecycle

**Acceptance**:
- When a server starts, all internal data structures are initialized before any connection handling occurs
- When `getChannels()` or similar methods are called during server startup, they return valid (possibly empty) collections instead of null
- Triple protocol tests that create servers and handle connections complete without NullPointerException
- In `AbstractPortUnificationServer`, the `doOpen()` method must initialize `supportedUrls`, `supportedHandlers` (as `ConcurrentHashMap` instances), and load `protocols` map before calling the new abstract `doOpen0()` method
- Subclasses must implement `doOpen0()` (protected abstract method) instead of overriding `doOpen()` directly
- In `NettyPortUnificationServer` (netty4), the `dubboChannels` map must be initialized in `doOpen0()` before being used

---

## FR2: Fix Timer Task Race Condition in Remoting Module [EXTENDED]

**Problem**: Timer tasks (heartbeat, reconnect, close) start execution in the base class constructor before subclass constructors have initialized their timeout parameters, causing tasks to run with uninitialized values.

**User Report**:
```
HeartbeatTimerTask executes but heartbeat timeout is 0 because the task was
started in AbstractTimerTask constructor before HeartbeatTimerTask could set
its heartbeat field.
```

**Requirements**:
- Defer timer task activation until after subclass initialization completes
- Each concrete timer task class must explicitly start the timer after setting its configuration parameters
- The base class should not auto-start tasks in its constructor

**Acceptance**:
- When a HeartbeatTimerTask is created with a heartbeat interval, the task uses the correct interval value
- When a CloseTimerTask is created with a close timeout, the task uses the correct timeout value
- When a ReconnectTimerTask is created with an idle timeout, the task uses the correct timeout value
- `AbstractTimerTask.start()` must be a `protected` method (not private) that subclasses call after setting their timeout parameters
- Each concrete timer task class (`HeartbeatTimerTask`, `CloseTimerTask`, `ReconnectTimerTask`) must call `start()` at the end of its constructor after initializing its specific timeout field

---

## FR3: SSL Session Propagation for Triple Protocol [EXTENDED]

**Problem**: After successful TLS handshake, the SSL session information is not accessible to Triple protocol streams, preventing applications from accessing certificate details or session information.

**Requirements**:
- Store SSL session information in channel attributes after successful TLS handshake completion
- Make SSL session accessible from Triple client streams via a getter method
- Propagate SSL session through both port unification servers and standard TLS handlers

**Acceptance**:
- When a Triple client connects over TLS, the stream can retrieve the SSLSession via `getSslSession()`
- When TLS handshake completes successfully on the server, the SSL session is stored in channel attributes
- SSL session is available in both Netty4 standard server handler and port unification server handler scenarios
- Add constant `SSL_SESSION_KEY = "ssl-session"` in `org.apache.dubbo.remoting.Constants`
- The `Stream` interface must define `SSLSession getSslSession()` method
- Use `AttributeKey.valueOf(Constants.SSL_SESSION_KEY)` to store/retrieve SSL session in Netty channel attributes
- In `SslClientTlsHandler` and `SslServerTlsHandler`, set the SSL session attribute on successful handshake via `ctx.channel().attr(SSL_SESSION_KEY).set(session)`

---

## FR4: Enforce TLS Requirements on Server Connections [EXTENDED]

**Problem**: When a server is configured with an authentication policy that requires TLS, clients connecting without TLS are not properly rejected, allowing insecure connections to proceed.

**Requirements**:
- Detect when incoming connections do not use TLS but the server requires it
- Close connections that violate the TLS requirement with appropriate logging
- Ensure detection occurs early in the connection lifecycle before any request processing

**Acceptance**:
- When a server requires TLS (AuthPolicy is not NONE) and a client connects without TLS, the connection is closed
- When an insecure connection is rejected, an error is logged indicating the downstream address and the violation
- When a server allows plaintext connections (AuthPolicy is NONE), connections proceed normally
- Use `ProviderCert.getAuthPolicy()` to check if TLS is required; compare against `AuthPolicy.NONE`
- In `NettyPortUnificationServerHandler.decode()`, after SSL detection with at least 5 bytes available, if not SSL but `authPolicy != AuthPolicy.NONE`, close the connection and clear the input buffer

---

## FR5: Echo Service Support in Triple Protocol

**Problem**: Triple protocol invoker does not resolve method descriptors for the built-in Echo service, causing `$echo` invocations to fail with method not found errors.

**Requirements**:
- When the method descriptor lookup returns null and the invocation is an echo call, resolve using the echo service descriptor cache
- Support the `$echo(Object)` method signature that returns the same object back

**Acceptance**:
- When calling `$echo("test")` through Triple protocol, the response is `"test"`
- When calling `$echo(1234)` through Triple protocol, the response is `1234`
- Echo service works alongside regular service methods and generic calls
- When Triple protocol invokes the `$echo` method, it should return the same object that was passed in

---

## FR6: Fix ByteBuf Memory Leak in NettyChannel [EXTENDED]

**Problem**: When an exception occurs during message encoding or sending in NettyChannel, the allocated ByteBuf is not released, causing memory leaks under error conditions.

**Requirements**:
- Release the ByteBuf when an exception occurs after allocation but before successful write
- Use safe release mechanism to avoid exceptions during cleanup
- Only release when encoding is done in the calling thread (not IO thread)

**Acceptance**:
- When encoding fails with an exception, the ByteBuf is properly released
- When channel write fails with an exception, the ByteBuf is properly released
- No memory leak detectors report unreleased ByteBuf instances during exception scenarios
- In `NettyChannel.send()`, when `!encodeInIOThread`, keep reference to allocated ByteBuf; in catch block, call `ReferenceCountUtil.safeRelease(buf)` if buf is not null

---

## FR7: Handle Duplicate Invoker URLs from Registry [EXTENDED]

**Problem**: Registry may send duplicate invoker URLs in notifications, causing unnecessary invoker creation and potential resource waste.

**Requirements**:
- Deduplicate invoker URLs received from registry notifications before processing
- Log informational message when duplicates are detected, including original and distinct counts
- Apply deduplication in both interface-level and service discovery registry directories

**Acceptance**:
- When registry sends notification with duplicate URLs, only distinct URLs are processed
- When duplicates are detected, a log message indicates the service key and the count difference
- Invoker map only contains unique entries after processing notifications

---

## FR8: Improve Fastjson2 Serialization Initialization [EXTENDED]

**Problem**: Fastjson2 serialization initialization may succeed partially when only some required classes are available, leading to runtime failures during actual serialization operations.

**Requirements**:
- Validate presence of all required Fastjson2 classes before registering serialization beans
- Check for core classes, ASM reader/writer creators, validator, factory, and type utilities
- Only proceed with initialization if all required classes are present

**Acceptance**:
- When all Fastjson2 classes are available, serialization beans are registered
- When any required Fastjson2 class is missing, serialization beans are not registered
- No ClassNotFoundException during runtime serialization operations if initialization succeeded
- In `Fastjson2ScopeModelInitializer.initializeFrameworkModel()`, check presence of all these classes before registering beans: `com.alibaba.fastjson2.JSONB`, `com.alibaba.fastjson2.reader.ObjectReaderCreatorASM`, `com.alibaba.fastjson2.writer.ObjectWriterCreatorASM`, `com.alibaba.fastjson2.JSONValidator`, `com.alibaba.fastjson2.JSONFactory`, `com.alibaba.fastjson2.JSONWriter`, `com.alibaba.fastjson2.util.TypeUtils`, `com.alibaba.fastjson2.filter.ContextAutoTypeBeforeHandler`
- Use `ClassUtils.forName(className, Thread.currentThread().getContextClassLoader())` to check each class

---

## FR9: Enhance CertProvider for Remote Address Context [EXTENDED]

**Problem**: Certificate provider cannot distinguish connections based on remote address, limiting the ability to apply different certificates for different clients.

**Requirements**:
- Add overloaded methods to CertProvider interface that accept remote SocketAddress
- Maintain backward compatibility with default implementations that ignore remote address
- Propagate remote address through cert manager to provider implementations

**Acceptance**:
- When CertProvider receives a request, it can access the remote address for decision making
- When a provider only implements the original methods, the new methods delegate to them
- Existing CertProvider implementations continue to work without modification
- Add to `CertProvider` interface: `default boolean isSupport(URL address, SocketAddress remoteAddress)` that delegates to `isSupport(address)` by default
- Add to `CertProvider` interface: `default ProviderCert getProviderConnectionConfig(URL localAddress, SocketAddress remoteAddress)` that delegates to `getProviderConnectionConfig(localAddress)` by default
- In `CertManager.getProviderConnectionConfig()`, call the new overloaded methods passing the `remoteAddress` parameter


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
