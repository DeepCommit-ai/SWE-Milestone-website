# Software Requirements Specification: Triple Protocol Improvements

## Overview

This milestone addresses reliability and stability improvements in the Dubbo Triple protocol and underlying network utilities. The changes target three areas:

1. **FR1**: Port availability checking fails intermittently under rapid sequential calls due to TCP TIME_WAIT state interference
2. **FR2**: HTTP/3 client ping frames may not be fully sent before stream shutdown, causing protocol errors
3. **FR3**: Incorrect logger class reference in Triple path resolver causes misleading log output

**Affected Modules**:
- dubbo-common (network utilities)
- dubbo-remoting-netty (server socket options)
- dubbo-rpc-triple (HTTP/3 codec and path resolver)

---

## Requirements

### FR1: Port Availability Detection Under Rapid Sequential Checks

**Problem**: Port availability checks return false positives (reporting ports as "in use") when the same port is checked multiple times in rapid succession, even though the port is actually available.

**User Report**:
```
Running tests that repeatedly check port availability causes intermittent failures.
When checking if a port is in use 10,000 times in sequence, some checks incorrectly
report the port as occupied. This is due to the TCP TIME_WAIT state not being
handled properly during port binding checks.
```

**Requirements**:
- Port availability detection must correctly report available ports even when checked thousands of times in rapid succession
- The socket option SO_REUSEADDR must be enabled before binding when the system supports it, to allow reuse of ports in TIME_WAIT state
- The system must detect at startup whether SO_REUSEADDR is supported by the platform
- Provide a public static method `NetUtils.isReuseAddressSupported()` returning `boolean` to query whether SO_REUSEADDR is supported by the platform
- The `getAvailablePort()` method must use proper socket binding with reuse address enabled
- The `isPortInUsed()` method must use proper socket binding with reuse address enabled
- Netty-based servers must enable the `reuseAddress` socket option during bootstrap configuration

**Acceptance**:
- When a port availability check is performed 10,000 times consecutively on an available port, all checks must correctly report the port as not in use
- When a Netty server binds to a port, the port availability check must correctly detect the port as unavailable
- Server restart on the same port must succeed without "address already in use" errors due to TIME_WAIT state
- `NettyServer` and `NettyPortUnificationServer` must set `bootstrap.setOption("reuseAddress", true)` during server bootstrap configuration
- `NetUtils.getAvailablePort()` and `NetUtils.isPortInUsed()` must create a `ServerSocket`, call `setReuseAddress(true)` if supported, then call `bind()` with the target port

---

### FR2: HTTP/3 Client Ping Frame Transmission Sequencing

**Problem**: HTTP/3 client ping frames may fail to be transmitted because the stream output is shut down before the frame write operation completes.

**User Report**:
```
HTTP/3 connections experience intermittent ping failures. The ping frame write
operation is asynchronous but the stream shutdown is called immediately without
waiting for the write to complete. This causes a race condition where the output
may be closed before the data is actually sent.
```

**Requirements**:
- When sending a ping frame over HTTP/3, the stream output shutdown must only occur after the ping frame write operation has completed
- If the write operation completes synchronously (already done), shutdown may proceed immediately
- If the write operation is asynchronous, a completion listener must be used to trigger the shutdown after the write completes
- The ping mechanism must reliably send the ping headers before closing the stream

**Acceptance**:
- When an HTTP/3 ping is sent, the ping headers frame must be fully written before the stream output is shut down
- HTTP/3 connection health checks using ping must complete successfully without protocol errors caused by premature stream closure

---

### FR3: Logger Class Reference Correction in Triple Path Resolver

**Problem**: Log messages from the Triple path resolver are attributed to the wrong class, causing confusion when debugging path resolution issues.

**Requirements**:
- The logger in TriplePathResolver must use the correct class reference for logging
- Log messages from the path resolver must be attributed to the TriplePathResolver class

**Acceptance**:
- When log statements are executed in TriplePathResolver, the logger name reflects TriplePathResolver, not any other class


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
