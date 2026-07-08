# Software Requirements Specification: Well-Optimized String Types Infrastructure

## Overview

This milestone establishes a foundational infrastructure for optimized string and utility types in the `nu-utils` crate. The requirements focus on:

1. **FR1**: Add optimized string types (`SharedString` and `UniqueString`) with different performance characteristics for shared vs. unique string scenarios
2. **FR2**: Create a reusable `SplitRead` iterator for splitting byte streams by arbitrary multi-byte delimiters
3. **FR3**: Implement a `Cow`-like type (`NuCow`) with looser requirements that supports `Serialize`/`Deserialize`
4. **FR4**: Extract and relocate the `MultiLife` helper type for broader reuse

**Affected Modules**:
- `nu-utils` crate (primary)
- `nu-protocol` crate (consumer)

---

## Requirements

### FR1: Optimized String Types Module

**Problem**: The pipeline-based functional programming model requires frequent string operations involving immutability and copying, but standard `String` and `&str` types do not provide optimal performance characteristics for all use cases.

**Requirements**:
- Provide a `SharedString` type optimized for strings that are frequently cloned and shared
  - Cloning must be inexpensive (pointer copy and atomic reference count increment, avoiding deep copies)
  - Must support Small String Optimization (SSO) for shorter strings
  - Must support static string re-use without allocation
  - Must support niche optimization (`Option<SharedString>` same size as `SharedString`)
  - Must be 16 bytes on 64-bit systems
  - Must implement standard traits: `Clone`, `Debug`, `Default`, `Display`, `Deref`, `Eq`, `Hash`, `Ord`, `PartialEq`, `PartialOrd`, `AsRef<str>`, `Borrow<str>`
  - Must implement `Serialize` and `Deserialize`
  - Must provide `from_string()`, `from_static_str()`, and `from_fmt()` constructors
  - Must provide a `sformat!` macro for creating `SharedString` from format arguments

- Provide a `UniqueString` type optimized for strings that are primarily unique or rarely cloned
  - Must avoid atomic reference counting overhead
  - Must support Small String Optimization (SSO) for shorter strings
  - Must support static string re-use without allocation
  - Must support niche optimization (`Option<UniqueString>` same size as `UniqueString`)
  - Must be 16 bytes on 64-bit systems
  - Must implement standard traits: `Clone`, `Debug`, `Default`, `Display`, `Deref`, `Eq`, `Hash`, `Ord`, `PartialEq`, `PartialOrd`, `AsRef<str>`, `Borrow<str>`
  - Must implement `Serialize` and `Deserialize`
  - Must provide `from_string()`, `from_static_str()`, and `from_fmt()` constructors
  - Must provide a `uformat!` macro for creating `UniqueString` from format arguments

- Both types must be exported from a `strings` submodule in `nu-utils`, implemented as a directory module (`crates/nu-utils/src/strings/mod.rs`), not a single file

**Acceptance**:
- When `SharedString` is created from a static string literal, no allocation occurs
- When `SharedString` is cloned, no deep copy of string data occurs
- When `UniqueString` is created from a static string literal, no allocation occurs
- When `Option<SharedString>` is created, it has the same memory size as `SharedString`
- When `Option<UniqueString>` is created, it has the same memory size as `UniqueString`

---

### FR2: Generic SplitRead Iterator

**Problem**: Splitting byte streams by arbitrary multi-byte delimiters requires a reusable iterator that handles buffered reading, delimiter detection across read boundaries, and proper I/O error handling.

**Requirements**:
- Provide a generic `SplitRead<R>` struct that works with any `BufRead` reader
- Must provide a `new(reader: R, delim: impl AsRef<[u8]>) -> Self` constructor
- Must support arbitrary byte sequences as delimiters (not limited to single-byte delimiters)
- Must correctly split streams where the delimiter spans across multiple read operations
- Must yield empty fields when delimiters appear consecutively or at stream boundaries
- Must propagate I/O errors from the underlying reader
- Must reject empty delimiters with a debug assertion
- Must implement `Iterator` yielding `Result<Vec<u8>, std::io::Error>`
- Must be exported from the `nu-utils` crate root

**Acceptance**:
- Basic case: Splitting a string by a single-character delimiter yields the corresponding segments
- Empty field case: When delimiters appear consecutively, empty fields are included in the output
- Multi-byte delimiter case: Splitting works correctly with arbitrary multi-byte delimiter patterns
- Boundary case: When the delimiter pattern spans across multiple read buffer boundaries, splitting works correctly
- Error case: When an empty delimiter is provided, a panic occurs with "delimiter can't be empty"
- All-empty case: When a string consists entirely of consecutive delimiters, the result is a sequence of empty fields

---

### FR3: Cow-like Type with Serialize/Deserialize Support

**Problem**: The standard `Cow` type has lifetime requirements that make it incompatible with `Serialize`/`Deserialize` in scenarios where borrowed and owned variants have different concrete types.

**Requirements**:
- Provide a `NuCow<B, O>` enum with `Borrowed(B)` and `Owned(O)` variants
- The borrowed and owned types can be different concrete types (unlike `std::borrow::Cow`)
- Must implement `Serialize` that serializes both variants transparently (untagged)
- Must implement `Deserialize` that always deserializes into the `Owned` variant
- Must implement `PartialEq` when the owned and borrowed types are comparable
- Must implement `Debug` with alternate format showing variant names
- Must implement `Clone` when both types are `Clone`
- Must be exported from the `nu-utils` crate root

**Acceptance**:
- Serialization case: Both `Borrowed` and `Owned` variants serialize transparently to JSON without variant tags (untagged format)
- Deserialization case: JSON data always deserializes into the `Owned` variant, regardless of the original variant
- Equality case: Cross-variant comparison (`Borrowed` vs `Owned`) determines equality based on the contained values

---

### FR4: MultiLife Helper Type Extraction

**Problem**: A helper enum for holding references with different lifetimes exists inline in the protocol crate but should be available for broader reuse.

**Requirements**:
- Provide a `MultiLife<'out, 'local, T>` enum with `Out(&'out T)` and `Local(&'local T)` variants
- Must require the lifetime constraint `'out: 'local` (outer lifetime outlives local)
- Must support unsized types (`T: ?Sized`)
- Must implement `Deref` returning `&T`
- Must be exported from `nu-utils` and re-exported from `nu-protocol::value`

**Acceptance**:
- When dereferencing a `MultiLife::Out(x)`, the inner reference `x` is returned
- When dereferencing a `MultiLife::Local(x)`, the inner reference `x` is returned
- When `MultiLife` is used with different lifetime references, the compiler accepts it due to the `'out: 'local` constraint


---

# Environment Dependency Changes (relative to Base Env)

## crates/nu-utils/Cargo.toml

The following dependencies must be added or modified in `crates/nu-utils/Cargo.toml`:

| Dependency | Change Type | Configuration | Purpose |
|------------|-------------|---------------|---------|
| `byteyarn` | Add | `byteyarn.workspace = true` | Provides `byteyarn::Yarn` as the underlying implementation for `UniqueString` |
| `lean_string` | Add | `lean_string.workspace = true` | Provides `lean_string::LeanString` as the underlying implementation for `SharedString` |
| `memchr` | Add | `memchr = { workspace = true }` | Provides `memchr::memmem::Finder` for efficient byte pattern searching in `SplitRead` |
| `serde` | Modify | `serde = { workspace = true, features = ["derive"] }` | Add `derive` feature to enable `#[derive(Serialize, Deserialize)]` macros |
