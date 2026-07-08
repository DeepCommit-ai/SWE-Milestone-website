# Software Requirements Specification: Max Matches Printer Simplification

## Overview

This specification defines the requirements for simplifying the `max_matches` configuration in the grep-printer crate following its consolidation into the grep-searcher crate. The primary match limiting logic now resides in the searcher, so the printer's internal implementation can be simplified. For backward compatibility, the printer-level `max_matches()` builder methods on `JSONBuilder` and `SummaryBuilder` are retained.

### Requirements Summary

1. **FR1**: Simplify `max_matches` handling in JSON printer
2. **FR2**: Simplify `max_matches` handling in Summary printer
3. **FR3**: Update CLI integration to prefer searcher-level match limiting

### Affected Modules

- JSON printer module in grep-printer crate
- Summary printer module in grep-printer crate
- CLI flags/arguments integration layer

---

## Functional Requirements

### FR1: Simplify max_matches Handling in JSON Printer

**Problem**: The JSON printer contains a `max_matches` configuration option that duplicates functionality now available in the grep-searcher crate, causing architectural inconsistency and potential confusion about which layer controls match limiting.

**Requirements**:
- Retain the `max_matches()` builder method on `JSONBuilder` for backward compatibility; the method should continue to honor the configured limit
- The internal match-limiting implementation may be simplified since the searcher now handles the primary match limiting logic
- When the searcher is configured with its own match limit, the printer should work correctly regardless of whether its own `max_matches` is also set
- Clean up unused imports if any become redundant after simplification

**Acceptance**:
- When searching with JSON output and match limiting configured on the searcher, the limit is respected
- When the `max_matches()` method is called on `JSONBuilder`, the printer continues to function correctly
- When after-context lines are requested, they are printed correctly

---

### FR2: Simplify max_matches Handling in Summary Printer

**Problem**: The Summary printer contains a `max_matches` configuration option that duplicates functionality now available in the grep-searcher crate, creating architectural inconsistency.

**Requirements**:
- Retain the `max_matches()` builder method on `SummaryBuilder` for backward compatibility; the method should continue to honor the configured limit
- The internal match-limiting implementation may be simplified since the searcher now handles the primary match limiting logic
- When using count or count-matches summary kinds that quit early, that behavior must be preserved independently of any match limit

**Acceptance**:
- When searching with summary output and match limiting configured on the searcher, the limit is respected
- When the `max_matches()` method is called on `SummaryBuilder`, the printer continues to function correctly
- When using count or count-matches summary kinds that quit early, that behavior is preserved independently of any match limit

---

### FR3: Update CLI Integration to Prefer Searcher-Level Match Limiting

**Problem**: The CLI argument handling code passes the `max_count` argument to both JSON and Summary printer builders. Now that match limiting is primarily handled by the searcher, the CLI should prefer the searcher-level configuration.

**Requirements**:
- Ensure that match limiting via the `--max-count` CLI flag works through the searcher configuration
- The CLI may continue to pass `max_count` to printer builders for backward compatibility

**Acceptance**:
- When a user specifies `--max-count=N`, the search respects this limit through the searcher layer
- The CLI builds JSON and Summary printers without errors


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust 1.85.0 installed and set as default (base uses 1.74.0)
- clippy component added
- rustfmt component added

## Environment Variables
- RUSTUP_TOOLCHAIN set to 1.85.0
