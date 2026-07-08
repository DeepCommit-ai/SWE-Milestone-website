# Software Requirements Specification: Consistent Hash Balancer for zRPC

## Overview

This specification defines requirements for implementing consistent hash load balancing support in the zRPC client framework. The feature enables session affinity and stateful service routing by implementing a custom gRPC balancer that routes requests to backend servers based on consistent hashing of a context-provided hash key.

### Requirements Summary

1. **FR1**: Implement a consistent hash gRPC balancer that routes requests based on a hash key
2. **FR2**: Provide API for setting hash keys in request context
3. **FR3**: Add configurable load balancer selection in RPC client configuration
4. **FR4**: Maintain backward compatibility with existing P2C EWMA balancer as default

### Affected Modules

- zRPC client configuration and initialization
- gRPC balancer subsystem
- Context-based request routing

---

## Functional Requirements

### FR1: Consistent Hash gRPC Balancer

**Problem**: zRPC clients currently only support P2C (power of two choices) load balancing, which distributes requests based on server load metrics. Users with stateful services or session affinity requirements cannot route requests from the same logical entity (e.g., user, session) to the same backend server consistently.

**Requirements**:
- Implement a gRPC balancer that uses consistent hashing to select backend connections
- The balancer must be registered with gRPC's balancer registry on package initialization
- When picking a connection, the balancer must extract a hash key from the request context
- Requests with the same hash key must be routed to the same backend server (assuming stable server topology)
- The consistent hash ring must use virtual nodes (replicas) to ensure even distribution across backends
- When no ready sub-connections are available, return an appropriate unavailable error
- When the hash key is missing from the context, return an invalid argument error with a descriptive message
- Health checking must be enabled for the balancer to exclude unhealthy backends

**Acceptance**:
- When a request is made with a hash key set in context, the balancer selects a backend based on the hash of that key
- When multiple requests are made with the same hash key, they are routed to the same backend server
- When a request is made without a hash key in context, an error is returned indicating the missing hash key
- When no backends are available, the standard gRPC `ErrNoSubConnAvailable` error is returned
- The balancer implementation in `zrpc/internal/balancer/consistenthash/` must use unexported type `pickerBuilder` (implementing `base.PickerBuilder`) and `picker` (implementing `balancer.Picker`), with the consistent hash ring stored in a field named `hashRing` of type `*hash.ConsistentHash` (from `core/hash` package), a `conns` field of type `map[string]balancer.SubConn` mapping addresses to sub-connections, and a package-level constant `defaultReplicaCount` defining the number of virtual nodes per real node
- Error messages from the picker must use the prefix `[consistent_hash]` (e.g., `[consistent_hash] missing hash key`)

---

### FR2: Hash Key Context API

**Problem**: Users need a way to specify the hash key for consistent hashing before making RPC calls. The hash key should be passed through the gRPC context mechanism to reach the balancer's picker.

**Requirements**:
- Provide a public function to set a hash key value into a context
- Provide a function to retrieve the hash key from a context (for internal balancer use)
- The hash key must be stored as a string value
- The context functions must be safe for concurrent use
- The public API must be accessible from the top-level zrpc package for ease of use

**Acceptance**:
- When `SetHashKey(ctx, "user123")` is called, the returned context contains the hash key "user123"
- When `GetHashKey(ctx)` is called on a context with a hash key set, it returns the stored key
- When `GetHashKey(ctx)` is called on a context without a hash key, it returns an empty string

---

### FR3: Configurable Load Balancer Selection

**Problem**: Users need to be able to choose between different load balancing strategies (P2C EWMA vs consistent hash) based on their service requirements. The load balancer selection should be configurable through the RPC client configuration.

**Requirements**:
- Add a configuration field to specify the load balancer name in RPC client configuration
- The configuration field must default to the existing P2C EWMA balancer name for backward compatibility
- The balancer name must be applied to the gRPC connection via the service config
- The configuration must support any registered gRPC balancer name to allow for future extensibility
- When an empty balancer name is provided, fall back to the default P2C EWMA balancer

**Acceptance**:
- When a client is created with default configuration, it uses the P2C EWMA load balancer
- When a client is configured with `BalancerName: "consistent_hash"`, it uses the consistent hash balancer
- When a client is configured with an empty `BalancerName`, it defaults to P2C EWMA
- The balancer selection must be applied via an unexported helper function `makeLBServiceConfig(name string) string` that generates the gRPC service config JSON string for the specified balancer name

---

### FR4: Backward Compatibility

**Problem**: Existing applications using zRPC clients must continue to function without modification. The default behavior must remain unchanged.

**Requirements**:
- The default load balancing behavior must remain P2C EWMA when no balancer is explicitly configured
- Existing client initialization code must work without changes
- The balancer configuration must be moved from the internal client to the public client configuration layer
- All existing client configuration options must continue to function as before

**Acceptance**:
- When an existing application upgrades to the new version without configuration changes, it continues to use P2C EWMA balancing
- When `RpcClientConf` is initialized with default values, `BalancerName` equals `"p2c_ewma"`
- When clients are created using existing APIs (`NewClient`, `MustNewClient`, `NewClientWithTarget`), they function correctly with the new balancer configuration system


---

# Environment Dependency Changes (relative to Base Env)

## Go Version
- Go upgraded to 1.21.13 (from 1.19.13)

## Go Packages (New)
- cel.dev/expr v0.15.0 added
- filippo.io/edwards25519 v1.1.0 added
- github.com/bsm/ginkgo/v2 v2.12.0 added
- github.com/bsm/gomega v1.27.10 added
- github.com/gorilla/websocket v1.5.0 added
- github.com/grafana/pyroscope-go added
- github.com/grafana/pyroscope-go/godeltaprof v0.1.9 added
- github.com/iancoleman/strcase added
- github.com/kisielk/sqlstruct added
- github.com/kylelemons/godebug added
- github.com/lyft/protoc-gen-star/v2 added
- github.com/redis/go-redis/v9 added
- github.com/spf13/afero added
- go.mongodb.org/mongo-driver/v2 added
- go.uber.org/mock added

## Go Packages (Upgraded)
- cloud.google.com/go/compute upgraded to v1.23.3
- cloud.google.com/go/compute/metadata upgraded to v0.3.0
- github.com/alecthomas/kingpin/v2 upgraded to v2.4.0
- github.com/alicebob/miniredis/v2 upgraded to v2.35.0
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
- github.com/go-logr/logr upgraded to v1.4.2
- github.com/go-sql-driver/mysql upgraded to v1.9.0
- github.com/golang/glog upgraded to v1.2.1
- github.com/golang-jwt/jwt/v4 upgraded to v4.5.2
- github.com/golang/protobuf upgraded to v1.5.4
- github.com/golang/snappy upgraded to v1.0.0
- github.com/google/go-cmp upgraded to v0.6.0
- github.com/google/uuid upgraded to v1.6.0
- github.com/grpc-ecosystem/grpc-gateway/v2 upgraded to v2.20.0
- github.com/IBM/sarama upgraded to v1.43.1
- github.com/jackc/pgservicefile upgraded to v0.0.0-20240606120523-5a60cdf6a761
- github.com/jackc/pgx/v5 upgraded to v5.7.4
- github.com/jackc/puddle/v2 upgraded to v2.2.2
- github.com/jcmturner/gokrb5/v8 upgraded to v8.4.4
- github.com/jhump/protoreflect upgraded to v1.17.0
- github.com/klauspost/compress upgraded to v1.17.11
- github.com/montanaflynn/stats upgraded to v0.7.1
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
- github.com/stretchr/objx upgraded to v0.5.2
- github.com/stretchr/testify upgraded to v1.11.1
- github.com/youmark/pkcs8 upgraded to v0.0.0-20240726163527-a2c0da244d78
- github.com/yuin/gopher-lua upgraded to v1.1.1
- go.etcd.io/etcd/api/v3 upgraded to v3.5.15
- go.etcd.io/etcd/client/pkg/v3 upgraded to v3.5.15
- go.etcd.io/etcd/client/v3 upgraded to v3.5.15
- go.mongodb.org/mongo-driver upgraded to v1.17.1
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
- golang.org/x/tools upgraded to v0.21.1-0.20240508182429-e35e4ccd0d2d
- google.golang.org/genproto upgraded to v0.0.0-20231106174013-bbf56f31fb17
- google.golang.org/genproto/googleapis/api upgraded to v0.0.0-20240711142825-46eb208f015d
- google.golang.org/genproto/googleapis/rpc upgraded to v0.0.0-20240701130421-f6361c86f094
- google.golang.org/grpc upgraded to v1.65.0
- google.golang.org/protobuf upgraded to v1.36.5
- k8s.io/api upgraded to v0.29.3
- k8s.io/apimachinery upgraded to v0.29.4
- k8s.io/client-go upgraded to v0.29.3
- k8s.io/klog/v2 upgraded to v2.110.1
- k8s.io/utils upgraded to v0.0.0-20240711033017-18e509b52bc8
- sigs.k8s.io/structured-merge-diff/v4 upgraded to v4.4.1

## Environment Variables
- PATH updated to include /usr/local/go/bin at the beginning
- GOPATH set to /go
