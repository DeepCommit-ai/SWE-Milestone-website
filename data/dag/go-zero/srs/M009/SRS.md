# Software Requirements Specification: HTTP-to-HTTP Gateway Support

## Overview

This milestone extends the go-zero gateway to support HTTP-to-HTTP proxying in addition to the existing gRPC-to-HTTP translation functionality. The implementation includes:

1. **FR1**: HTTP upstream configuration and routing support
2. **FR2**: Service group graceful shutdown improvements
3. **FR3**: HTTP gateway context propagation
4. **FR4**: Custom middleware support for gateway handlers
5. **FR5**: Trace header forwarding for distributed tracing
6. **FR6**: Unknown fields handling in gateway request parsing
7. **FR7**: Empty body handling in request parsing

**Affected Modules**:
- `gateway/` - Gateway server, configuration, and internal request handling
- `core/service/` - Service group management
- `gateway/internal/` - Header processing and request parsing

---

## FR1: HTTP Upstream Configuration and Routing Support

**Problem**: The gateway currently only supports gRPC upstreams for proxying HTTP requests to gRPC services. Users need the ability to proxy HTTP requests to HTTP backend services through the gateway.

**Requirements**:
- Introduce an HTTP client configuration structure that specifies a target host, optional URL path prefix, and configurable timeout (with a default value)
- Modify the upstream configuration to support either gRPC or HTTP targets as mutually exclusive options
- Make the `RpcPath` field in route mappings optional since HTTP-to-HTTP proxying does not require gRPC method paths
- Build HTTP request handlers that:
  - Forward the incoming request to the configured HTTP target
  - Support URL path prefix prepending for target routing
  - Apply configurable request timeouts
  - Preserve and forward HTTP headers to the upstream
  - Copy response headers and status codes back to the client
  - Stream the response body back to the client
- Default to HTTP scheme when constructing the upstream URL if no scheme is specified
- Derive upstream names from the HTTP target when no explicit name is provided
- Properly manage gateway server shutdown to close gRPC connections after the HTTP server stops

**Acceptance**:
- When an HTTP upstream is configured with a target and route mappings, incoming requests matching those routes are proxied to the HTTP backend
- When a URL prefix is configured, the gateway prepends it to the request path before forwarding
- When a timeout is configured, requests to the upstream are subject to that timeout
- When the gateway stops, the HTTP server stops first, then gRPC connections are closed concurrently
- When only HTTP upstreams are configured (no gRPC), the gateway functions correctly without requiring gRPC configuration

---

## FR2: Service Group Graceful Shutdown Improvements

**Problem**: When a service group contains multiple services with stop callbacks that take a long time to complete, stopping services sequentially causes unnecessary delays during shutdown.

**Requirements**:
- Modify the service group's stop behavior to stop all services concurrently rather than sequentially
- Ensure all service stop operations complete before the stop method returns

**Acceptance**:
- When a service group with multiple services is stopped, all services stop concurrently
- When all services have completed their stop callbacks, the service group stop method returns

---

## FR3: HTTP Gateway Context Propagation

**Problem**: When the gateway proxies HTTP requests to HTTP upstreams, the request context from the original request is not properly propagated to the outgoing request. This breaks context-dependent features such as request cancellation, deadline propagation, and tracing.

**Requirements**:
- Ensure the original request's context is always propagated to the new outgoing HTTP request
- When constructing the new request for the upstream, attach the original context regardless of whether a custom timeout is configured

**Acceptance**:
- When a request is proxied to an HTTP upstream, the context from the original request is available in the new request
- When the original request is cancelled, the proxied request is also cancelled
- When tracing is enabled, trace information from the context is preserved across the proxy

---

## FR4: Custom Middleware Support for Gateway Handlers

**Problem**: Users need the ability to add custom middleware to gateway request handlers for cross-cutting concerns such as authentication, logging, rate limiting, or request modification.

**Requirements**:
- Add middleware support to the gateway server that applies to all route handlers (both gRPC and HTTP)
- Support multiple middlewares that execute in order following an onion model (first middleware wraps outermost, executes first on request and last on response)
- Provide a server option to configure one or more middlewares
- Middlewares should be chainable and can be added in a single call or multiple calls

**Acceptance**:
- When middlewares are configured, they wrap both gRPC and HTTP route handlers
- When multiple middlewares are configured, they execute in the correct onion order: first middleware's pre-handler runs first, then second middleware's pre-handler, then the actual handler, then second middleware's post-handler, then first middleware's post-handler
- When middlewares modify request or response data, those modifications are visible to subsequent handlers
- The gateway must export a server option function `WithMiddleware(m rest.Middleware) Option` for adding custom middlewares

---

## FR5: Trace Header Forwarding for Distributed Tracing

**Problem**: OpenTelemetry trace propagation headers (traceparent, tracestate, baggage) from incoming HTTP requests are not forwarded to gRPC metadata when the gateway proxies requests. This breaks distributed tracing across the gateway boundary.

**Requirements**:
- Forward W3C Trace Context headers (traceparent, tracestate, baggage) from HTTP requests to gRPC metadata
- Handle trace headers case-insensitively on input but normalize to lowercase in gRPC metadata per gRPC conventions
- Preserve existing behavior for custom metadata headers with the Grpc-Metadata- prefix
- Normalize custom metadata header keys to lowercase when forwarding to gRPC metadata

**Acceptance**:
- The `ProcessHeaders` function in `gateway/internal/headerprocessor.go` must recognize the three W3C Trace Context headers: `traceparent`, `tracestate`, and `baggage` (case-insensitive matching)
- When an HTTP request contains traceparent header (any case), it is forwarded to gRPC metadata as lowercase "traceparent:value"
- When an HTTP request contains tracestate header (any case), it is forwarded to gRPC metadata as lowercase "tracestate:value"
- When an HTTP request contains baggage header (any case), it is forwarded to gRPC metadata as lowercase "baggage:value"
- When custom Grpc-Metadata-* headers are present, they are forwarded with the gateway- prefix and the key portion (suffix after Grpc-Metadata-) normalized to lowercase (e.g., `Grpc-Metadata-Custom` becomes `gateway-custom:value`)

---

## FR6: Unknown Fields Handling in Gateway Request Parsing

**Problem**: When parsing HTTP requests for gRPC proxy calls, extra query parameters or JSON fields that don't exist in the target gRPC message definition cause parsing errors. This is overly strict for gateway use cases where clients may send additional fields.

**Requirements**:
- Configure the gateway's JSON request parser to always ignore unknown fields during proto unmarshaling
- Apply this behavior consistently for all request parsing paths: body-only, path variables only, form parameters, and combined scenarios

**Acceptance**:
- When an HTTP request contains JSON fields not defined in the gRPC message, the request is still processed successfully
- When an HTTP request contains query parameters not defined in the gRPC message, the request is still processed successfully
- When valid fields are present alongside unknown fields, the valid fields are correctly parsed into the gRPC message
- The internal request parser must provide unexported helper functions `buildJsonRequestParserFromMap` (for parsing from a map) and `buildJsonRequestParserFromReader` (for parsing from an io.Reader) in `gateway/internal/requestparser.go`

---

## FR7: Empty Body Handling in Request Parsing

**Problem**: When parsing HTTP requests that have path variables or query parameters but an empty request body, the JSON decoder returns an EOF error that is incorrectly treated as a parsing failure.

**Requirements**:
- Handle EOF errors from JSON body decoding gracefully when path variables or form parameters are present
- Treat an empty body as valid input when other request parameters provide data

**Acceptance**:
- When a request has path variables and an empty body, parsing succeeds using the path variables
- When a request has query parameters and an empty body, parsing succeeds using the query parameters
- When a request has both path variables and a non-empty JSON body, both are merged correctly


---

# Environment Dependency Changes (relative to Base Env)

## Go Version
- Go upgraded to 1.21.13 (from 1.19.13)

## Environment Variables
- GOCACHE set to /go/cache
- GOMODCACHE set to /go/pkg/mod
- GOROOT set to /usr/local/go
