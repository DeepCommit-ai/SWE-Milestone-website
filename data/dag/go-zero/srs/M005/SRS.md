# Software Requirements Specification
## M005 - SQL Statement-Level Circuit Breaker Support

### Overview

This milestone introduces statement-level circuit breaker support for SQL operations in the `stores/sqlx` package. The implementation addresses the following requirements:

1. **FR1**: Add circuit breaker support to prepared SQL statements
2. **FR2**: Expose a no-operation breaker for transaction statements
3. **FR3**: Add breaker metrics for statement operations
4. **FR4**: Handle context timeout errors correctly in circuit breaker logic
5. **FR5**: Return scanner errors from row iteration

**Affected Modules**:
- `core/stores/sqlx` (statement handling, connection handling, ORM)
- `core/breaker` (no-operation breaker)

---

### FR1: Add Circuit Breaker Support to Prepared SQL Statements

**Problem**: Prepared SQL statements do not have circuit breaker protection, meaning failures in statement execution do not contribute to circuit breaker metrics and the breaker cannot prevent cascading failures at the statement level.

**Requirements**:
- Prepared statements must have access to the parent connection's circuit breaker
- Prepared statements must have access to the parent connection's acceptable error function
- All statement execution methods (Exec, QueryRow, QueryRowPartial, QueryRows, QueryRowsPartial) must execute within the circuit breaker context
- The circuit breaker must distinguish between database failures (which should count toward the breaker threshold) and application-level scan failures (which should not trigger the breaker)
- Scan failures in query operations must not trigger the circuit breaker, as these represent application-level errors (e.g., type mismatches) rather than database connectivity issues

**Acceptance**:
- When a prepared statement is created from a SQL connection, the statement inherits the connection's circuit breaker
- When executing a statement and the circuit breaker is open, the operation returns immediately with a service unavailable error
- When a statement query has scan failures (e.g., type conversion errors), repeated failures do not cause the circuit breaker to open
- When database connectivity failures occur repeatedly through statement execution, the circuit breaker opens and subsequent calls fail fast
- The prepared statement struct must hold references to the circuit breaker and acceptable error function
- Statement query methods must use the breaker's conditional execution mechanism and helper function to distinguish scan failures from database failures

---

### FR2: Expose a No-Operation Breaker for Transaction Statements

**Problem**: Transaction-scoped prepared statements require a breaker instance but should not participate in circuit breaking since transactions have their own atomicity guarantees and the parent connection already handles breaker logic.

**Requirements**:
- A no-operation breaker must be publicly accessible to allow its use with transaction statements
- The no-operation breaker must implement the full Breaker interface but never trigger the circuit
- Transaction-scoped prepared statements must use the no-operation breaker

**Acceptance**:
- When a prepared statement is created within a transaction, it uses a no-operation breaker
- When executing transaction statements, the no-operation breaker does not block requests regardless of error history
- The breaker package must export a public function to obtain a no-operation breaker instance

---

### FR3: Add Breaker Metrics for Statement Operations

**Problem**: When the circuit breaker opens for statement operations, there is no metric tracking to enable observability and monitoring of breaker events at the statement level.

**Requirements**:
- Statement execution operations must emit a metric when the circuit breaker blocks the request
- Statement query operations must emit a metric when the circuit breaker blocks the request
- Metrics must distinguish between execution and query operations

**Acceptance**:
- When a statement Exec operation is blocked by the circuit breaker, a metric is recorded with appropriate operation type identifier
- When a statement query operation is blocked by the circuit breaker, a metric is recorded with appropriate operation type identifier
- Metrics must distinguish between execution and query operations with appropriate operation type identifiers

---

### FR4: Handle Context Timeout Errors Correctly in Circuit Breaker Logic

**Problem**: When a SQL query times out due to context deadline exceeded, this timeout error is incorrectly treated as a scan failure, preventing the proper error from being returned and causing incorrect circuit breaker behavior.

**Requirements**:
- Context deadline exceeded errors must not be classified as scan failures
- Context deadline exceeded errors must be propagated correctly to the caller
- The circuit breaker acceptable check must not treat context timeout as an acceptable scan error

**Acceptance**:
- When a query operation times out with context deadline exceeded, the error is returned to the caller as `context.DeadlineExceeded`
- When a query times out, the circuit breaker treats this as a backend failure (not a scan failure) and may count it toward the breaker threshold based on the acceptable function
- The scan failure detection helper must return false for context timeout errors

---

### FR5: Return Scanner Errors from Row Iteration

**Problem**: When iterating over multiple rows, errors that occur during the iteration (retrieved via `scanner.Err()`) are silently ignored, causing data loss scenarios to go unnoticed.

**Requirements**:
- After completing row iteration, any scanner error must be checked and returned
- The scanner error must take precedence over a successful iteration with no explicit errors

**Acceptance**:
- When row iteration encounters an internal scanner error, that error is returned to the caller after iteration completes
- When row iteration completes successfully with no scanner error, nil is returned


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
