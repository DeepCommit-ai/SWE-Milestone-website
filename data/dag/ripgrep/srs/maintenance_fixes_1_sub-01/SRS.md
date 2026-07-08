# Software Requirements Specification

## Milestone: maintenance_fixes_1_sub-01 - Critical Bug Fixes

### Overview

This milestone addresses critical bug fixes and enhancements across the ripgrep codebase:

1. **FR1**: Fix exit code inversion when using `--files-without-match` with `-q` (quiet mode)
2. **FR2**: Optimize search worker initialization by deferring decompression reader construction
3. **FR3**: Implement compact Debug output for Glob type in the globset crate
4. **FR4**: Add `Candidate::from_bytes` constructor for byte-based path matching

**Affected Modules**:
- `crates/core/flags/hiargs.rs` - High-level argument processing
- `crates/core/search.rs` - Search worker implementation
- `crates/printer/src/summary.rs` - Summary printer implementation
- `crates/globset/src/glob.rs` - Glob pattern type
- `crates/globset/src/lib.rs` - Globset library API

---

### FR1: Fix Quiet Mode Exit Code with `--files-without-match`

**Problem**: When running ripgrep with both `--files-without-match` and `-q` (quiet) flags, the exit code is inverted - the command returns exit code 0 when it should return 1, and vice versa.

**User Report**:
```
Using `rg --files-without-match -q <pattern> <file>` returns the wrong exit code.
When searching a file that does NOT contain the pattern, it returns exit code 1 (failure).
When searching a file that DOES contain the pattern, it returns exit code 0 (success).
This behavior is the opposite of what is expected based on the flag semantics.
```

**Requirements**:
- The `has_match` determination in quiet mode must account for the semantic difference between "files with matches" and "files without matches" search modes
- When using `--files-without-match`, a "match" means the file does NOT contain the pattern (i.e., a file without matches is considered a successful result)
- When using `--files-with-matches` or standard search modes with `-q`, a "match" means the file DOES contain the pattern
- The quiet mode should correctly suppress output while maintaining proper exit code semantics
- Add a new `SummaryKind::QuietWithMatch` variant to the `SummaryKind` enum in `crates/printer/src/summary.rs` to represent quiet mode that reports a match when at least one match is found (as opposed to `Quiet` which reports a match when no matches are found, for `--files-without-match` semantics)

**Acceptance**:

*Observable Behavior:*
- When running `rg -q <pattern> <file>` on a file containing the pattern, exit code is 0
- When running `rg -q <pattern> <file>` on a file NOT containing the pattern, exit code is 1
- When running `rg --files-with-matches -q <pattern> <file>` on a file containing the pattern, exit code is 0
- When running `rg --files-with-matches -q <pattern> <file>` on a file NOT containing the pattern, exit code is 1
- When running `rg --files-without-match <pattern> <file>` on a file NOT containing the pattern, output includes the file path terminated by a newline
- When running `rg --files-without-match <pattern> <file>` on a file containing the pattern, output is empty
- When running `rg --files-without-match -q <pattern> <file>` on a file NOT containing the pattern, exit code is 0
- When running `rg --files-without-match -q <pattern> <file>` on a file containing the pattern, exit code is 1
- When running `rg --files-without-match -q <pattern> <file>` on a file NOT containing the pattern, no output is produced
- The quiet mode behavior with statistics enabled (`--stats`) must continue to search the entire file to compute statistics

---

### FR2: Optimize Decompression Reader Initialization

**Problem**: The search worker initializes the decompression reader builder during construction even when compressed file searching is not enabled, causing unnecessary work especially on Windows where resolving decompression binary paths involves non-trivial operations.

**Requirements**:
- The decompression reader builder should only be constructed when compressed file searching (`--search-zip` / `-z`) is enabled
- When compressed file searching is disabled, no decompression-related initialization should occur
- The search functionality must remain unchanged when compressed file searching IS enabled
- All existing search behaviors must be preserved

**Acceptance**:

*Observable Behavior:*
- When running ripgrep without `--search-zip`, startup time is not affected by decompression binary resolution
- When running ripgrep with `--search-zip`, compressed files are searched correctly as before
- All existing search functionality continues to work correctly
- No regression in search results or behavior

---

### FR3: Compact Debug Implementation for Glob Type

**Problem**: The default derived Debug implementation for the `Glob` type in the globset crate produces verbose output including all internal fields (glob pattern, compiled regex, options, tokens), making debug output difficult to read when multiple globs are involved.

**Requirements**:
- The default Debug output for `Glob` should show only the glob pattern string in a compact format
- Full Debug information including all internal fields should remain accessible via alternate formatting (`{:#?}`)
- The Debug output format for `GlobSetBuilder` containing multiple globs should be readable and concise

**Acceptance**:

*Observable Behavior:*
- When formatting a `Glob` with `{:?}`, output is in the format `Glob("<pattern>")` (where `<pattern>` is the original glob pattern, formatted using Rust string debug escaping)
- When formatting a `Glob` with `{:#?}`, output includes the full internal structure with all fields
- When formatting a `GlobSetBuilder` with `{:?}`, output is in the format `GlobSetBuilder { pats: [Glob("<pattern1>"), Glob("<pattern2>"), ...] }` (using `Glob`'s standard `{:?}` formatting for each element and a comma+space separator)

---

### FR4: Add Byte-Based Candidate Constructor

**Problem**: The `Candidate` type in the globset crate can only be constructed from types implementing `AsRef<Path>`, requiring a valid path representation. There is no way to construct a `Candidate` directly from raw bytes, which limits flexibility when working with byte sequences that may not be valid UTF-8 or when the caller already has bytes available.

**Requirements**:
- Add a public constructor that creates a `Candidate` from a byte slice
- The constructor should accept any type implementing `AsRef<[u8]>`
- The byte sequence is expected to be conventionally UTF-8 but may contain invalid UTF-8 sequences
- Matching behavior with non-ASCII-compatible encodings (e.g., UTF-16) is unspecified
- The existing `Candidate::new` constructor must continue to work unchanged

**Acceptance**:

*Observable Behavior:*
- A `Candidate` can be created directly from a byte slice (e.g., `b"some/path"`)
- Byte sequences containing invalid UTF-8 are accepted and can be used for matching
- The existing `Candidate::new` API remains unchanged and functional
- Glob matching against candidates created from bytes produces correct results

*API Contract (for test compatibility):*
- The new constructor should be named `from_bytes` and accept types implementing `AsRef<[u8]>`

---

### FR5: Add Arbitrary Trait Support for Fuzz Testing (Optional Feature)

**Problem**: The globset crate lacks support for fuzz testing infrastructure, making it difficult to systematically test glob pattern parsing and matching against arbitrary inputs.

**Requirements**:
- Add an optional `arbitrary` feature to the globset crate
- When the feature is enabled, implement the `Arbitrary` trait from the `arbitrary` crate for the `Glob` type
- The feature should be disabled by default
- Internal types required for `Glob`'s `Arbitrary` implementation should also derive `Arbitrary` when the feature is enabled

**Acceptance**:

*Observable Behavior:*
- The `arbitrary` feature can be enabled in `Cargo.toml`
- When enabled, `Glob` implements `arbitrary::Arbitrary`
- When disabled, there is no dependency on the `arbitrary` crate
- Fuzz testing targets can use the `Glob` type with libfuzzer or similar tools


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust upgraded to 1.92.0 (stable) to support edition 2024
