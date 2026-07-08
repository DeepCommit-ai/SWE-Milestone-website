# Software Requirements Specification: Foundation Infrastructure Part A

## Overview

This milestone addresses core shell language features, table rendering configuration, type inference improvements, parser enhancements, HTTP client upgrades, type conversions, database functionality, and numeric comparison fixes. The requirements span multiple subsystems:

1. **FR1**: Null value spreading - Allow `null` values to be spread as empty lists or records
2. **FR2**: Table literal column variables - Support variable expressions in table literal column headers
3. **FR3**: Table streaming configuration - Add configurable batch duration and page size for streaming table output
4. **FR4**: Example result span validity - Ensure command example results have valid spans for metadata introspection
5. **FR5**: Collection type inference improvements - Improve type widening for list and table literals
6. **FR6**: IR evaluation for block redirection - Fix IR evaluation when branched block calls redirect output
7. **FR7**: HTTP client library upgrade - Upgrade ureq to version 3.x with improved redirect handling and error management
8. **FR8**: CellPath to string conversion - Support converting cell-path values to string representation
9. **FR9**: SQLite JSON column support - Enable storage and retrieval of complex data types in JSON/JSONB columns
10. **FR10**: Symmetric float equality comparison - Fix asymmetric float comparison for large magnitude values

**Affected Modules**: nu-parser, nu-protocol, nu-engine, nu-command (viewers/table, network/http, conversions, stor, database)

---

## Requirements

### FR1: Null Value Spreading

**Problem**: Spreading a `null` value in lists, records, or as command arguments produces a runtime error, preventing conditional spreading patterns where a value may be absent.

**Requirements**:
- `null` values must be spreadable in list literals, behaving as an empty list contribution
- `null` values must be spreadable in record literals, behaving as an empty record contribution
- `null` values must be spreadable in rest arguments to both built-in and custom commands
- `null` values must be spreadable as arguments to external commands
- Spreading `null` must not add any elements to the resulting collection or argument list

**Acceptance**:
- Spreading `null` is semantically equivalent to spreading an empty collection (empty list or empty record depending on context)
- The `...(null)` expression contributes zero elements in all contexts where spread syntax is valid

---

### FR2: Table Literal Column Variables

**Problem**: Table literal syntax does not allow variable expressions in column header positions, requiring all column names to be string literals.

**Requirements**:
- Variables containing string values must be usable as column names in table literal headers
- Variables that cannot be converted to strings must produce a parse or runtime error with a descriptive message
- The column name must be evaluated at runtime from the variable's current value
- Type information should reflect the dynamic nature of such columns appropriately

**Acceptance**:
- Variables with string-compatible types can be used as column names in table literal headers, and the resulting table uses the variable's value as the column name
- When a variable's compile-time type is not string-compatible, a parse error mentioning "must be a string" is produced
- When a variable produces a non-string value at runtime, an error mentioning "can't convert" is produced
- Variable-based column names are excluded from static type inference

---

### FR3: Table Streaming Configuration

**Problem**: Streaming pipeline output is displayed in fixed batches with a hardcoded 1-second duration and 1000-item page size, with no user control over these parameters.

**Requirements**:
- A configuration option `$env.config.table.batch_duration` must control the maximum time to wait before displaying a streaming batch
- A configuration option `$env.config.table.stream_page_size` must control the maximum number of items per batch
- Both options must have sensible defaults (1 second for batch duration, 1000 for page size)
- The batch duration must accept duration values (e.g., `2sec`)
- The stream page size must accept positive integer values
- When either threshold is reached, the current batch should be displayed
- The `TableConfig` struct in `crates/nu-protocol/src/config/table.rs` must have a field `batch_duration` of type `Duration` (from `std::time::Duration`). Default value for `batch_duration` is `Duration::from_secs(1)`
- The `TableConfig` struct in `crates/nu-protocol/src/config/table.rs` must have a field `stream_page_size` of type `NonZeroU16` (from `std::num::NonZeroU16`). Default value for `stream_page_size` is `NonZeroU16::new(1000)`

**Acceptance**:
- Setting `$env.config.table.batch_duration` controls the time interval for batching streaming output
- Setting `$env.config.table.stream_page_size` controls the maximum items per batch
- Increasing batch_duration results in more items per batch when items arrive incrementally
- Decreasing stream_page_size limits the maximum items displayed before starting a new batch

---

### FR4: Example Result Span Validity

**Problem**: Command example results retrieved via `scope commands` have invalid or missing spans, preventing proper metadata introspection with commands like `view span`.

**Requirements**:
- Example result values returned from `scope commands` must have valid spans
- The span must allow the result to be introspected using `metadata` and displayed with `view span`
- The span should reference a meaningful location in the source

**Acceptance**:
- Example result values from `scope commands` have valid spans that can be introspected via `metadata`
- The span references meaningful source location rather than invalid/synthetic spans
- Using `view span` on an example result's span displays valid source text

---

### FR5: Collection Type Inference Improvements

**Problem**: Type inference for list and table literals produces overly broad `Type::Any` when combining compatible subtypes, losing precision that could enable better error messages and editor support.

**Requirements**:
- List type inference must use type widening to find the most specific common supertype
- Table type inference must use type widening for column types
- Table columns with variable expressions in headers should not cause parse errors for valid string variables
- Column headers that are not statically known strings should be omitted from the inferred type rather than using a placeholder

**Acceptance**:
- When list literal types are inferred, compatible subtypes widen to their common supertype rather than immediately becoming `Any`
- When table literal column headers include variables, the type inference handles them without spurious errors

---

### FR6: IR Evaluation for Block Redirection

**Problem**: When a pipeline element involves a block call with redirected output, the IR evaluator may incorrectly handle the redirection cleanup, causing evaluation errors.

**Requirements**:
- Redirection cleanup in compiled pipelines must account for block calls with nested evaluation
- The redirection cleanup logic must only run when the current element does not itself handle cleanup
- Both subexpressions and block calls must be recognized as expressions that handle their own redirection cleanup

**Acceptance**:
- When a block is called with output redirection in an IR-evaluated pipeline, no spurious evaluation errors occur
- Complex pipeline constructs with block arguments and redirections evaluate correctly

---

### FR7: HTTP Client Library Upgrade (ureq 3.x)

**Problem**: The HTTP commands use an outdated version of the ureq HTTP client library that lacks modern features such as redirect history tracking and improved error handling.

**Requirements**:
- The HTTP client must be upgraded to use ureq version 3.0.12 (use exact version `"=3.0.12"` in Cargo.toml)
- Redirect history must be preserved and accessible after following redirects
- HTTP error status codes must not be treated as library errors by default, allowing application-level handling
- The request builder API must use the updated method signatures for headers, timeouts, and body sending
- TLS configuration must be set through the new configuration builder pattern
- When HTTP status code errors are handled at the application level (i.e., when `--allow-errors` is NOT set and a non-2xx response triggers `handle_response_error`), the error messages must preserve their per-code format for backward compatibility:
  - 301: `"Resource moved permanently (301): {url}"`
  - 400: `"Bad request (400) to {url}"`
  - 403: `"Access forbidden (403) to {url}"`
  - 404: `"Requested file not found (404): {url}"`
  - 408: `"Request timeout (408): {url}"`
  - Other codes: `"Cannot make request to {url}. Error is {code}"`

**Acceptance**:
- When `http post` sends JSON data to a valid endpoint, the request succeeds without errors
- When `http post` sends a JSON list, the request serializes the list correctly and succeeds
- When `http post` sends a JSON string value, the request succeeds with proper content handling
- When following redirects, the redirect history is available for inspection
- HTTP status codes (4xx, 5xx) are returned as response objects rather than throwing library-level errors
- When a server returns HTTP 403, the error message contains `"Access forbidden (403)"`
- When a server returns HTTP 404, the error message contains `"Requested file not found (404)"`
- Regardless of whether timeout occurs at the request stage or during response body reading, the resulting error code must be `nu::shell::io::timed_out` and the message must contain `"Timed out"`

**Implementation Hints**:
- ureq 3.0.12 surfaces response body read timeouts as `std::io::ErrorKind::Other` (wrapping `ureq::Error::Timeout`) instead of `std::io::ErrorKind::TimedOut`. This must be handled so that body read timeouts are correctly propagated as `ErrorKind::TimedOut`.

---

### FR8: CellPath to String Conversion

**Problem**: The `into string` command does not support converting cell-path values to their string representation, limiting the ability to manipulate and display cell-path expressions.

**Requirements**:
- The `into string` command must accept cell-path values as input
- Cell-path values must be converted to their canonical string representation (e.g., `$.name` format)
- The type signature must include the cell-path to string conversion mapping

**Acceptance**:
- The `into string` command accepts cell-path values and converts them to their canonical string representation (preserving the `$.<path>` syntax)

---

### FR9: SQLite JSON Column Support

**Problem**: The `stor` commands and database operations cannot store or retrieve complex Nushell data types (records, lists, tables) in SQLite databases, requiring manual JSON serialization.

**Requirements**:
- The `stor create` command must support `json` and `jsonb` column type declarations
- The `stor insert` command must automatically serialize record, list, and table values to JSON when inserting into JSON/JSONB columns
- The `query db` command must automatically deserialize JSON/JSONB columns back to Nushell values when the column's declared type is JSON or JSONB
- Column type declarations must be case-insensitive
- The internal `process()` function in `crates/nu-command/src/stor/insert.rs` must be updated to accept an `engine_state: &EngineState` parameter as its first argument (before the existing `table_name` parameter). This is needed because JSON serialization of Nushell values (via `values_to_sql()`) requires access to the `EngineState`. The call site in the `run()` method must pass `engine_state` through to `process()`. Signature change:
  ```rust
  // Old signature
  fn process(table_name: Option<String>, span: Span, db: &SQLiteDatabase, record: Record) -> Result<(), ShellError>
  // New signature
  fn process(engine_state: &EngineState, table_name: Option<String>, span: Span, db: &SQLiteDatabase, record: Record) -> Result<(), ShellError>
  ```

**Acceptance**:
- The `stor create` command accepts `json` and `jsonb` as valid column type declarations
- When inserting a record into a JSON/JSONB column via `stor insert`, the record is serialized to JSON format
- When querying a table with declared JSON/JSONB columns, the values are automatically parsed back into Nushell records/lists
- When a column contains nested structures (records with lists, etc.), round-trip storage and retrieval preserves the data structure

---

### FR10: Symmetric Float Equality Comparison

**Problem**: Float equality comparison using relative epsilon tolerance is asymmetric, producing inconsistent results when comparing the same pair of values in different order for large magnitude floats.

**Requirements**:
- Float comparison must use symmetric tolerance based on the maximum absolute value of both operands
- The equality check must use less-than-or-equal comparison against the tolerance threshold
- The comparison algorithm should follow established practices similar to Python's `math.isclose()` function

**Acceptance**:
- Float equality comparison uses symmetric tolerance, producing consistent results regardless of operand order
- Floats within relative epsilon tolerance of each other are considered equal
- The comparison handles edge cases at various magnitudes (small decimals, large integers near precision limits)
- Comparisons are symmetric: `a == b` produces the same result as `b == a` for all float pairs

---

## Non-Functional Requirements

### NFR1: Coreutils Library Upgrade (uutils v0.0.30 → v0.2.2)

**Scope**: Upgrade all uutils coreutils workspace dependencies and adapt source code to the new API. User-visible behavior remains unchanged.

**Dependency Changes** (root `Cargo.toml`):
- `uu_cp`: `0.0.30` → `0.2.2`
- `uu_mkdir`: `0.0.30` → `0.2.2`
- `uu_mktemp`: `0.0.30` → `0.2.2`
- `uu_mv`: `0.0.30` → `0.2.2`
- `uu_touch`: `0.0.30` → `0.2.2`
- `uu_whoami`: `0.0.30` → `0.2.2`
- `uu_uname`: `0.0.30` → `0.2.2`

**API Adaptation**:
- Enum variant renames (both `uu_cp` and `uu_mv`):
  - `UpdateMode::ReplaceIfOlder` → `UpdateMode::IfOlder`
  - `UpdateMode::ReplaceAll` → `UpdateMode::All`
  - `BackupMode::NoBackup` → `BackupMode::None`
- Error type rename: `uu_cp::Error` → `uu_cp::CpError`
- `uu_mkdir::mkdir()` signature changed from `mkdir(&path, is_recursive, mode, is_verbose)` to struct-based `mkdir(&path, &uu_mkdir::Config { recursive, mode, verbose, set_selinux_context, context })`
- New required struct fields in `uu_cp::Options`: `set_selinux_context: false`, `context: None`
- New required struct field in `uu_mv::Options`: `context: None`
- Error translation: import `uucore::{localized_help_template, translate}`, call `localized_help_template("<cmd>")` at the start of `run()`, use `translate!(&error.to_string())` in error message formatting

**Affected Files**: `ucp.rs`, `umv.rs`, `umkdir.rs`, `mktemp.rs`, `utouch.rs`, `whoami.rs`, `uname.rs` (all under `crates/nu-command/src/`)

**Acceptance**: All existing filesystem and platform command tests pass with no regressions.

---

# Environment Dependency Changes (relative to Base Env)

## Environment Variables
- CARGO_BUILD_JOBS set to 4

## Workspace Dependency Upgrades
- `ureq`: `2.12` → `=3.0.12`
- `uu_cp`: `0.0.30` → `0.2.2`
- `uu_mkdir`: `0.0.30` → `0.2.2`
- `uu_mktemp`: `0.0.30` → `0.2.2`
- `uu_mv`: `0.0.30` → `0.2.2`
- `uu_touch`: `0.0.30` → `0.2.2`
- `uu_whoami`: `0.0.30` → `0.2.2`
- `uu_uname`: `0.0.30` → `0.2.2`
