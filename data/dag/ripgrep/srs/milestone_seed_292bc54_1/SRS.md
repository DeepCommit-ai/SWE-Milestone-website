# Software Requirements Specification: JSON Output Replacement Support

## Overview

This specification defines the requirements for adding `-r/--replace` flag support to ripgrep's JSON output mode. Currently, the `-r/--replace` flag only works with standard text output, leaving JSON consumers unable to access computed replacement text without implementing the substitution logic themselves.

### Requirements Summary

1. **FR1**: Add replacement text field to JSON submatch objects when `-r/--replace` is specified

### Affected Modules

- JSON printer output formatting
- JSON builder configuration
- Command-line argument processing for JSON output

---

## Functional Requirements

### FR1: Replacement Text in JSON Submatch Objects

**Problem**: When using `--json` output mode with `-r/--replace`, the JSON output does not include any information about the replacement text, forcing consumers to re-implement pattern substitution logic to determine what text would replace each match.

**User Report**:
```
When using ripgrep with --json output, I'd like to also use -r/--replace to specify
replacement text. Currently JSON mode ignores the replacement flag entirely. JSON
consumers have to perform the substitution themselves even though ripgrep already
knows what the replacement text would be.
```

**Requirements**:
- When `-r/--replace` is specified alongside `--json`, include the computed replacement text in the JSON output
- The replacement text must appear as a new optional field within each `submatch` object
- The replacement field must use the same arbitrary data object format as the existing `match` field (supporting both UTF-8 text and base64-encoded bytes for non-UTF-8 content)
- The replacement field must only be present when a replacement pattern is configured; omit the field entirely when no replacement is specified
- Support replacement patterns that reference capturing groups (both indexed like `$2` and named like `$foo`)
- The replacement must be computed for submatches in both `match` type messages and `context` type messages (when inverted match mode produces submatches in context lines)
- The original match text must remain unchanged in the `match` field; the replacement text is additive information
- The `lines` field must continue to show the original line content, not the replaced content

**Acceptance**:
- When running with `--json -r "replacement_text" "pattern" file`, each submatch object in the JSON output contains a `replacement` field with the computed replacement text
- When running with `--json` without `-r/--replace`, submatch objects do not contain a `replacement` field (the field must be completely omitted from the JSON, not set to `null`)
- The `replacement` field must use the arbitrary data object format: `{"text": "..."}` for valid UTF-8 content or `{"bytes": "..."}` for base64-encoded non-UTF-8 content (same structure as the existing `match` field in submatch objects)
- Replacement patterns with capturing group references produce correctly interpolated replacement text in the JSON output
- Non-UTF-8 replacement results are base64 encoded in the `bytes` variant of the data object, consistent with existing JSON encoding behavior


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- rustc upgraded to 1.88.0
- cargo upgraded to 1.88.0
