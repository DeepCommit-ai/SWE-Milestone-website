# Software Requirements Specification: GlobSet API Enhancements

## Overview

This specification defines requirements for extending the `GlobSet` public API in the `globset` crate with two complementary enhancements:

1. **FR1**: Add a `matches_all` method to check if all globs in a set match a given path
2. **FR2**: Make `GlobSet::new` public and generalize its signature to accept any iterator of Glob references

**Affected Module**: `crates/globset`

---

## FR1: Add `matches_all` Method to GlobSet

**Problem**: Users cannot determine whether ALL globs in a GlobSet match a given path; the existing `is_match` method returns true if ANY glob matches, but there is no method to verify that every glob in the set matches simultaneously.

**Requirements**:
- Provide a method that returns `true` only when every glob pattern in the GlobSet matches the given path
- The method should return `true` for an empty GlobSet (vacuous truth: all zero globs match)
- Provide both a convenience method that accepts any path-like type and a performance-optimized variant that accepts a pre-computed `Candidate`
- The implementation should short-circuit and return `false` as soon as any glob fails to match

**Acceptance**:
- When a GlobSet contains globs `src/*` and `**/*.rs`, calling `matches_all("src/foo.rs")` returns `true`
- When a GlobSet contains globs `src/*` and `**/*.rs`, calling `matches_all("src/bar.c")` returns `false` (fails the `**/*.rs` pattern)
- When a GlobSet contains globs `src/*` and `**/*.rs`, calling `matches_all("test.rs")` returns `false` (fails the `src/*` pattern)
- When a GlobSet is empty, calling `matches_all` on any path returns `true`

---

## FR2: Make `GlobSet::new` Public and Generalize Its Signature

**Problem**: Users who already have a collection of `Glob` patterns (e.g., a `Vec<Glob>`) must use `GlobSetBuilder` to construct a `GlobSet`, which requires iterating through their collection and adding each glob individually. A direct construction method would improve ergonomics.

**Requirements**:
- Make the `GlobSet::new` constructor publicly accessible
- Generalize the constructor to accept any iterator whose items can be converted to `Glob` references (i.e., items implementing `AsRef<Glob>`)
- Ensure `Glob` itself implements `AsRef<Glob>` so that iterators over owned `Glob` values work seamlessly
- The existing `GlobSetBuilder::build` method should continue to function correctly
- An empty iterator should produce an empty `GlobSet`

**Acceptance**:
- When calling `GlobSet::new` with an iterator over `&Glob` references, a valid `GlobSet` is constructed
- When calling `GlobSet::new` with an iterator over owned `Glob` values, a valid `GlobSet` is constructed
- When calling `GlobSet::new` with an empty iterator, an empty `GlobSet` is returned
- The `GlobSetBuilder::build` method continues to produce correct results after this change


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust 1.88.0 added and set as default (base uses 1.74.0)
