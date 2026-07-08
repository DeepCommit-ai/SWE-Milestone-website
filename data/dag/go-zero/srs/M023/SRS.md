# Software Requirements Specification: SQL and ORM Improvements

## Overview

This milestone addresses multiple improvements and bug fixes in the SQL/ORM functionality of go-zero:

1. **FR1**: Rename sqlx metrics namespace for database-agnostic consistency
2. **FR2**: Restrict connection pool metrics collection to MySQL connections only
3. **FR3**: Fix `WithAcceptable` option override bug in MySQL connections
4. **FR4**: Add field tag skip logic (`db:"-"`) in ORM field unwrapping
5. **FR5**: Fix zero value scanning for pointer destination fields in ORM
6. **FR6**: Add partial query methods to cached SQL layer

**Affected Modules**:
- `core/stores/sqlx` (SQL connection, ORM, metrics)
- `core/stores/sqlc` (cached SQL layer)

---

## Requirements

### FR1: Rename SQL Metrics Namespace

**Problem**: The sqlx metrics namespace is currently named `mysql_client`, which is inaccurate as the sqlx package supports multiple database drivers, not just MySQL.

**Requirements**:
- Rename the Prometheus metrics namespace from `mysql_client` to `sql_client`
- All existing metric names (request duration, error totals, slow query totals, connection pool statistics) must be updated to use the new `sql_client` prefix

**Acceptance**:
- When querying the metrics endpoint, all SQL client metrics use the `sql_client` namespace prefix
- Existing dashboards and alerting rules targeting the old metric names will need to be updated

---

### FR2: MySQL-Only Connection Pool Metrics Collection

**Problem**: Connection pool metrics are collected for all SQL connections regardless of driver type, but the DSN parsing logic relies on the MySQL driver's `ParseDSN` function. This causes errors when non-MySQL connections are used since their connection strings cannot be parsed by the MySQL parser.

**Requirements**:
- Connection pool metrics (open connections, idle connections, wait counts, etc.) should only be collected for MySQL connections
- For non-MySQL drivers, the system should skip metrics collection rather than attempting to parse the DSN
- When MySQL DSN parsing fails, an error should be logged and metrics collection skipped for that connection

**Acceptance**:
- When using a MySQL connection with a valid DSN, connection pool metrics are collected and reported
- When using a non-MySQL driver (e.g., PostgreSQL, SQLite), no DSN parsing errors are logged and metrics collection is skipped
- When using a MySQL connection with an invalid/malformed DSN, an error is logged but the connection still functions

---

### FR3: Fix WithAcceptable Option Override Bug

**Problem**: When creating a MySQL connection with custom `WithAcceptable` options, the user-provided acceptable function is overwritten by the default MySQL acceptable function instead of being combined with it. This occurs because options are appended in the wrong order.

**User Report**:
```
When I use NewMysql with a custom WithAcceptable option to handle specific
error codes as acceptable, my custom function is ignored. The connection
only uses the default MySQL acceptable function.

conn := sqlx.NewMysql(dsn, sqlx.WithAcceptable(myCustomAcceptable))
// myCustomAcceptable is never called
```

**Requirements**:
- User-provided `WithAcceptable` options must not be overwritten by default acceptable functions
- When multiple `WithAcceptable` options are provided, they should be combined such that an error is acceptable if any of the provided functions considers it acceptable
- The default MySQL acceptable function should be applied first, with user options applied afterward

**Acceptance**:
- When creating a MySQL connection with custom `WithAcceptable` options, both the default MySQL acceptable logic and custom acceptable logic are applied
- When an error matches any of the acceptable conditions, it is treated as acceptable
- When multiple `WithAcceptable` options are chained, all of them contribute to the final acceptable check

---

### FR4: Add Field Tag Skip Logic in ORM

**Problem**: The ORM's field unwrapping logic does not honor the `db:"-"` tag convention for skipping fields during row scanning. Struct fields marked with `db:"-"` are still included in the field list, causing column count mismatches when the database returns fewer columns than struct fields.

**User Report**:
```
I have a struct with computed fields that I don't want to scan from the database:

type User struct {
    ID       int64  `db:"id"`
    Name     string `db:"name"`
    FullName string `db:"-"` // computed, not in DB
}

When querying "SELECT id, name FROM users", I get ErrNotMatchDestination
because the ORM tries to scan into 3 fields but only 2 columns are returned.
```

**Requirements**:
- Struct fields tagged with `db:"-"` must be excluded from ORM field scanning
- The skip logic should apply during the field unwrapping phase, before column-to-field matching
- The behavior should be consistent for both single row and multiple row queries

**Acceptance**:
- When a struct has fields marked with `db:"-"`, those fields are not included in the scan destination list
- When querying into a struct with ignored fields, the column count matches only the non-ignored fields
- Both `QueryRow` and `QueryRows` operations correctly handle ignored fields

---

### FR5: Fix Zero Value Scanning for Pointer Destinations

**Problem**: When scanning database NULL values or zero values into pointer-type struct fields, the ORM incorrectly handles the value interface extraction. The check for interface capability and the returned interface do not properly account for pointer indirection, causing incorrect scan results.

**User Report**:
```
When scanning rows with NULL values into pointer fields like *int64 or *string,
the values don't scan correctly. Zero values (0, empty string) returned from
the database end up as nil pointers or cause scan errors.

type Record struct {
    Value    *int64 `db:"value"`
    NullVal  *int64 `db:"null_val"`
}
// Row with value=0 and null_val=NULL
// Expected: Value points to 0, NullVal is nil
// Actual: Incorrect behavior
```

**Requirements**:
- Pointer destination fields must correctly receive scanned values including zero values
- NULL database values should result in nil pointers
- Non-NULL zero values (0 for integers, empty string for strings, false for booleans) should result in valid pointers to those zero values
- The fix should properly check addressability and interface capability for pointer types

**Acceptance**:
- When scanning a NULL database value into a `*int64` field, the result is a nil pointer
- When scanning a zero value (0) from the database into a `*int64` field, the result is a pointer to 0
- When scanning an empty string from the database into a `*string` field, the result is a pointer to an empty string
- Mixed rows with NULL and non-NULL values in the same column scan correctly

---

### FR6: Add Partial Query Methods to Cached SQL Layer

**Problem**: The cached SQL layer (`CachedConn`) provides `QueryRowNoCache` and `QueryRowsNoCache` methods but lacks their partial counterparts. Users who need to query partial columns without caching must work around this limitation.

**Requirements**:
- Add `QueryRowPartialNoCache` method to `CachedConn` for single-row partial queries without caching
- Add `QueryRowPartialNoCacheCtx` method with context support
- Add `QueryRowsPartialNoCache` method to `CachedConn` for multi-row partial queries without caching
- Add `QueryRowsPartialNoCacheCtx` method with context support
- All new methods should delegate to the underlying database connection's corresponding partial query methods

**Acceptance**:
- When calling `QueryRowPartialNoCache` on a cached connection, the query executes against the database without cache interaction
- When calling `QueryRowsPartialNoCache` on a cached connection, multiple rows can be retrieved without caching
- Context-aware versions properly propagate the context to the underlying database calls
- Partial queries correctly handle structs with a subset of fields mapped to database columns
