# Software Requirements Specification: SQL Read/Write Separation with Replica Routing

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements for implementing SQL read/write separation functionality in the go-zero framework. The feature enables automatic routing of database queries to primary or replica instances based on the operation type specified in the context.

### 1.2 Scope
The implementation covers:
- A new configuration structure (`SqlConf`) for database connection settings
- Context-based read/write mode management
- Automatic connection routing based on operation type
- Support for multiple load balancing policies

## 2. Functional Requirements

### 2.1 Configuration Structure

#### 2.1.1 SqlConf Type
A new configuration structure shall be defined in `core/stores/sqlx/config.go`:

```go
type SqlConf struct {
    DataSource string
    DriverName string   `json:",default=mysql"`
    Replicas   []string `json:",optional"`
    Policy     string   `json:",default=round-robin,options=round-robin|random"`
}
```

**Field Specifications**:
- `DataSource`: Primary database connection string (required)
- `DriverName`: Database driver name, defaults to `"mysql"`
- `Replicas`: List of replica connection strings (optional)
- `Policy`: Load balancing policy, defaults to `"round-robin"`, allowed values are `"round-robin"` and `"random"`

#### 2.1.2 Configuration Validation
The `SqlConf` type shall implement a `Validate()` method:
- Returns error with message `"empty datasource"` if `DataSource` is empty
- Returns error with message `"empty driver name"` if `DriverName` is empty
- Returns `nil` if configuration is valid

### 2.2 Read/Write Mode Management

#### 2.2.1 Mode Constants
The following read/write mode values shall be defined:
- `"read-primary"`: Read operations that must be executed on the primary database
- `"read-replica"`: Read operations that can be executed on replica databases
- `"write"`: Write operations (always executed on primary)
- `""` (empty string): No mode specified (defaults to primary)

#### 2.2.2 Context Key Type
A private struct type `readWriteModeKey struct{}` shall be used as the context key for storing the read/write mode.

#### 2.2.3 Mode Type
A string-based type `readWriteMode string` shall be defined to represent mode values.

#### 2.2.4 Public Context Functions
The following public functions shall be provided for setting the read/write mode in context:

```go
func WithReadPrimary(ctx context.Context) context.Context
func WithReadReplica(ctx context.Context) context.Context
func WithWrite(ctx context.Context) context.Context
```

Each function stores the corresponding mode value in the context using `readWriteModeKey{}` as the key.

### 2.3 Connection Provider Functions

#### 2.3.1 NewConn Function
```go
func NewConn(c SqlConf, opts ...SqlOption) (SqlConn, error)
```
- Validates configuration using `c.Validate()`
- Returns error if validation fails
- Creates a new `SqlConn` with context-aware connection routing

#### 2.3.2 MustNewConn Function
```go
func MustNewConn(c SqlConf, opts ...SqlOption) SqlConn
```
- Wraps `NewConn` and panics on error using `logx.Must(err)`

### 2.4 Connection Routing Logic

#### 2.4.1 Primary Database Usage
The primary database shall be used when:
- No replicas are configured
- Mode is not specified (empty string)
- Mode is `"read-primary"`
- Mode is `"write"`
- Mode value is invalid

#### 2.4.2 Replica Database Usage
Replica databases shall be used when:
- Replicas are configured AND
- Mode is `"read-replica"`

#### 2.4.3 Load Balancing Policies
When using replicas:

**Round-Robin Policy** (`"round-robin"`):
- Default policy when policy string is empty
- Distributes requests evenly across replicas in order
- Uses a thread-safe counter for selection

**Random Policy** (`"random"`):
- Randomly selects a replica for each request

**Unknown Policy**:
- Returns an error if an unsupported policy is specified

### 2.5 Internal Type Changes

#### 2.5.1 connProvider Signature
The internal `connProvider` type signature shall be changed from:
```go
type connProvider func() (*sql.DB, error)
```
to:
```go
type connProvider func(ctx context.Context) (*sql.DB, error)
```

This change enables context-aware connection selection.

#### 2.5.2 commonSqlConn Changes
The `commonSqlConn` struct shall include an `index uint32` field for round-robin tracking.

### 2.6 Logx Fields Context Key Change

As a side-effect of this milestone, the context key for logx fields shall be changed:
- From: `var fieldsContextKey contextKey` with `type contextKey struct{}`
- To: Using `fieldsKey{}` with `type fieldsKey struct{}`

The key change ensures uniqueness when multiple context keys are used.

## 3. Non-Functional Requirements

### 3.1 Thread Safety
- Round-robin counter must use atomic operations for thread safety
- Connection pool access must remain thread-safe

### 3.2 Backward Compatibility
- Existing `NewSqlConn` and `NewSqlConnFromDB` functions must continue to work
- Their `connProvider` implementations must be updated to accept context but can ignore it

## 4. Test Verification Points

### 4.1 Configuration Tests
- `TestValidate`: Verifies default values and validation errors
- `TestConfigSqlConn`: Verifies basic connection creation with `SqlConf`
- `TestConfigSqlConnErr`: Verifies error handling for invalid configurations

### 4.2 Mode Tests
- `TestIsValid`: Verifies mode validation logic
- `TestWithReadMode`: Verifies `WithReadPrimary` and `WithReadReplica` functions
- `TestWithWriteMode`: Verifies `WithWrite` function
- `TestGetReadWriteMode`: Verifies mode retrieval from context
- `TestUsePrimary`: Verifies primary selection logic
- `TestWithModeTwice`: Verifies mode override behavior

### 4.3 Provider Tests
- `TestProvider`: Verifies connection routing based on mode and policy

## 5. Files to Modify/Create

| File | Action |
|------|--------|
| `core/stores/sqlx/config.go` | Create new file |
| `core/stores/sqlx/rwstrategy.go` | Create new file |
| `core/stores/sqlx/sqlconn.go` | Modify |
| `core/stores/sqlx/tx.go` | Modify |
| `core/logx/fields.go` | Modify |
| `core/logx/richlogger.go` | Modify |

---
*Document Version: 1.0*
*Created for M006 milestone verification*
