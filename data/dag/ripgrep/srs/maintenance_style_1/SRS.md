# Software Requirements Specification: Code Style and Refactoring

## Overview

This milestone consolidates code quality improvements across the ripgrep codebase to align with modern Rust idioms and best practices. The changes address:

1. **FR1**: Apply Rust 2024 edition formatting standards across the codebase
2. **FR2**: Modernize string formatting to use inline variable syntax
3. **FR3**: Resolve Clippy lints for iterator usage, write operations, and lifetime annotations
4. **FR4**: Simplify atomic memory ordering to appropriate levels
5. **FR5**: Replace deprecated non-exhaustive enum pattern with the `#[non_exhaustive]` attribute
6. **FR6**: Simplify code patterns in the printer module

**Affected Modules**:
- `crates/cli`
- `crates/core`
- `crates/globset`
- `crates/ignore`
- `crates/printer`
- `crates/regex`
- `crates/searcher`

---

## Requirements

### FR1: Apply Rust 2024 Edition Formatting

**Problem**: Import statements and code formatting do not conform to Rust 2024 edition rustfmt conventions.

**Requirements**:
- Configure rustfmt to use the 2024 edition formatting rules
- Apply consistent import ordering across all modules where types are sorted before functions within import groups
- Apply single-line conditional formatting for simple if-else expressions that fit within line width constraints
- Ensure all source files pass rustfmt validation with the updated configuration

**Acceptance**:
- When rustfmt is run with edition 2024 configuration, no formatting changes are required
- Import statements follow the pattern where type identifiers precede function identifiers within grouped imports
- Simple conditional expressions (e.g., `if condition { a } else { b }`) are formatted on a single line when they fit within the configured line width

---

### FR2: Modernize String Formatting Syntax

**Problem**: String formatting uses positional argument syntax (`format!("{}", var)`) instead of the more readable inline variable syntax.

**Requirements**:
- Replace positional format arguments with inline variable syntax where applicable
- Apply this modernization to `format!`, `panic!`, and similar formatting macros
- Maintain semantic equivalence of all formatted strings

**Acceptance**:
- When a format string contains a simple variable reference, it uses the inline syntax (e.g., `format!("{var}")` instead of `format!("{}", var)`)
- When a format string uses debug formatting with a variable, it uses inline syntax (e.g., `format!("{var:?}")` instead of `format!("{:?}", var)`)
- All formatted output remains functionally identical

---

### FR3: Resolve Clippy Lints

**Problem**: Code contains patterns that trigger Clippy warnings for suboptimal iterator usage, ignored write results, and missing lifetime annotations.

**Requirements**:
- Replace single-iteration `for` loops over reversed iterators with direct iterator access using `next_back()`
- Use `write_all()` instead of `write()` when writing complete byte slices where partial writes are not expected
- Explicitly handle or acknowledge `Result` values from write operations that may return partial write counts
- Add explicit lifetime annotations to function return types where elision rules require disambiguation
- Add semicolons to return statements in match arms for consistency

**Acceptance**:
- When iterating to obtain only the last element of a collection, `next_back()` is used instead of `for` loop with `rev()`
- When writing byte slices that must be written completely, `write_all()` is used
- When using `write()` where the return value indicates bytes written, the result is explicitly handled (e.g., with `let _ =`)
- Function return types include explicit lifetime parameters where the return type contains references (e.g., `Data<'_>` instead of `Data`)
- Return statements in match arms include trailing semicolons

---

### FR4: Simplify Atomic Memory Ordering

**Problem**: Atomic operations use `SeqCst` (sequentially consistent) ordering where `Relaxed` ordering is sufficient.

**Requirements**:
- Review atomic operations on boolean and counter flags that do not require synchronization with other memory operations
- Replace `Ordering::SeqCst` with `Ordering::Relaxed` for atomic loads and stores on independent flags where no happens-before relationship with other operations is required
- Maintain `SeqCst` or stronger ordering for operations that require synchronization guarantees

**Acceptance**:
- Atomic operations on independent boolean flags (message display toggles, error indicators) use `Relaxed` ordering
- Atomic counter increments for ID generation that don't synchronize with other data use `Relaxed` ordering
- Program behavior remains correct under concurrent execution

---

### FR5: Replace Deprecated Non-Exhaustive Enum Pattern

**Problem**: The `ErrorKind` enum in the globset crate uses a hidden `__Nonexhaustive` variant to prevent exhaustive matching, which is a deprecated pattern superseded by the `#[non_exhaustive]` attribute.

**Requirements**:
- Remove the `__Nonexhaustive` hidden variant from the `ErrorKind` enum
- Add the `#[non_exhaustive]` attribute to the enum declaration
- Remove all match arms and code paths handling the `__Nonexhaustive` variant

**Acceptance**:
- The `ErrorKind` enum is annotated with `#[non_exhaustive]`
- No `__Nonexhaustive` variant exists in the enum
- Match expressions on `ErrorKind` no longer require handling of `__Nonexhaustive`
- Downstream code matching on `ErrorKind` must include a wildcard arm (compiler-enforced by `#[non_exhaustive]`)

---

### FR6: Simplify Printer Code Patterns

**Problem**: The standard printer contains a redundant reference conversion when extracting replacement values.

**Requirements**:
- Simplify Option chain operations that perform unnecessary intermediate transformations
- Remove `.map(|r| &*r)` patterns where `.as_ref()` followed by `.unwrap()` achieves the same result

**Acceptance**:
- When extracting a reference from `Option<Arc<T>>` or similar wrapper types, unnecessary intermediate mapping steps are removed
- The simplified code produces identical runtime behavior


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust upgraded to 1.80.0
