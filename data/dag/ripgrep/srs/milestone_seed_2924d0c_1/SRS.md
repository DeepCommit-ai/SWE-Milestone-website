# Software Requirements Specification: Minimum Depth Option for WalkBuilder

## Overview

This specification defines the requirements for adding a minimum depth filtering option to the directory traversal functionality. The feature allows users to exclude directory entries that are above a specified depth threshold, complementing the existing maximum depth restriction capability.

### Requirements Summary

1. **FR1**: Add a minimum depth configuration option to the directory walker builder
2. **FR2**: Filter directory entries based on minimum depth during both serial and parallel traversal
3. **FR3**: Handle interaction between minimum and maximum depth when both are configured

### Affected Modules

- Directory traversal/walk module
- Parallel walk worker implementation

---

## Functional Requirements

### FR1: Minimum Depth Configuration Option

**Problem**: Users cannot filter out shallow directory entries during traversal. While maximum depth limiting exists, there is no way to skip entries that are too close to the root of the traversal.

**Requirements**:
- Provide a configuration method on the walker builder to set a minimum depth threshold
- Accept an optional depth value where `None` indicates no minimum depth restriction
- The minimum depth value represents the minimum entry depth that will be yielded during traversal
- Default behavior (when not configured) must yield all entries regardless of depth
- The configuration method should support method chaining with other builder methods

**Acceptance**:

*Observable Behavior:*
- When minimum depth is not set, all directory entries are yielded during traversal
- When minimum depth is set to 0, all directory entries are yielded (depth 0 is the root)
- When minimum depth is set to 1, only entries at depth 1 and deeper are yielded
- When minimum depth is set to N where N > 1, only entries at depth N and deeper are yielded
- When minimum depth exceeds the actual tree depth, no entries are yielded
- The configuration can be combined with other walker options (e.g., `builder.min_depth(...).max_depth(...)`)

---

### FR2: Depth-Based Entry Filtering

**Problem**: Directory entries below the minimum depth threshold should not be passed to the visitor callback during traversal.

**Requirements**:
- Filter entries based on comparing the entry's depth against the configured minimum depth
- The filtering must apply to both files and directories
- The filtering must work correctly in both serial (single-threaded) and parallel (multi-threaded) traversal modes
- Directories below the minimum depth threshold must still be traversed (descended into) even if they are not yielded
- The traversal must continue into subdirectories to find entries that meet the minimum depth requirement

**Acceptance**:

*Observable Behavior:*
- Entries whose depth is less than the configured minimum depth are not yielded to the caller
- Entries whose depth is greater than or equal to the configured minimum depth are yielded
- Example: Given a nested directory structure, setting a minimum depth of N will exclude all entries at depths 0 through N-1
- Filtering behavior is consistent between serial and parallel traversal

---

### FR3: Minimum and Maximum Depth Interaction

**Problem**: When both minimum depth and maximum depth are configured, conflicting values (where minimum exceeds maximum) could lead to undefined or confusing behavior.

**Requirements**:
- When both minimum and maximum depth are configured, compute effective bounds before traversal
- The normalization rule must be deterministic and independent of configuration order (setting min then max vs max then min yields the same effective bounds)
- The normalization must not cause errors or panics

**Normalization Rule**:
- If `min_depth > max_depth`, raise the effective maximum depth to equal the minimum depth
- Formally: `effective_max_depth = max(configured_min_depth, configured_max_depth)` while `effective_min_depth` remains `configured_min_depth`
- This results in a single-point range `[min_depth, min_depth]` when bounds conflict

**Acceptance**:

*Observable Behavior:*
- When both minimum and maximum depth are set without conflict (`min_depth <= max_depth`), traversal yields entries whose depth is within `[min_depth, max_depth]`
- When bounds conflict (`min_depth > max_depth`), the effective range becomes `[min_depth, min_depth]`, yielding only entries at exactly the minimum depth
- Configuring conflicting depth values does not cause errors or panics
- The walker can be built and executed successfully with any combination of minimum and maximum depth values


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust upgraded to 1.85.0 (from 1.74.0 in base) to support edition 2024
