# Software Requirements Specification: Parse-time Pipeline Type Checking for Multiple Output Types

## Overview

This specification addresses defects in the Nushell parser's pipeline type checking system that prevent valid code from executing when commands declare multiple possible output types for the same input type.

### Requirements Summary

1. **FR1**: Support multiple output types for the same input type during parse-time pipeline type checking
2. **FR2**: Propagate multiple possible types through pipeline chains during type inference
3. **FR3**: Update error messages to display multiple potential input types when reporting type mismatches

### Affected Areas

- Parser type checking logic
- Pipeline type inference
- Parse error reporting
- Command signature declarations (removal of workarounds)

---

## Requirements

### FR1: Support Multiple Output Types for Same Input Type

**Problem**: When a command declares multiple output types for the same input type (e.g., `[int -> int, int -> string]`), the parser incorrectly rejects valid pipelines because it only considers the first matching input-output type pair.

**User Report**:
```
When running `{year: 2019} | into datetime | date humanize`, I get:
  Error: command doesn't support record input

This happens even though `into datetime` explicitly supports record -> date conversion.
The issue is that `into datetime` declares multiple record outputs (record -> record,
record -> date) and the parser only checks the first match.
```

**Requirements**:
- The parse-time type checker must track all possible output types when an input type matches multiple input-output pairs in a command's signature
- When a command declares signatures like `[int -> int, int -> string]`, piping an `int` value must result in tracking both `int` and `string` as potential output types
- The type checker must not prematurely select a single output type when multiple valid output types exist for the matched input

**Acceptance**:
- Custom command case: When a command is defined with multiple input-output type pairs for the same input type (e.g., `[T -> T, T -> U]`), piping a value of type `T` to it and then to a subsequent command that accepts type `U` succeeds without parse errors
- Built-in command case: Commands that declare multiple output types for the same input type (such as `into datetime` with `record -> record` and `record -> date`) allow valid pipelines that depend on any of those output types to execute without type mismatch errors

---

### FR2: Propagate Multiple Types Through Pipeline Chains

**Problem**: When a pipeline element produces multiple possible types, subsequent pipeline elements do not correctly filter and propagate compatible types, causing valid pipelines to fail.

**Requirements**:
- The type checker must maintain a set of possible types at each pipeline stage rather than a single type
- When checking a subsequent command in the pipeline, each possible current type that matches any of the command's input types must contribute its corresponding output type to the new set of possible types
- Type propagation must support arbitrarily long pipeline chains where each stage may have multiple possible types
- If any possible type at the current stage matches any input type of the next command, the pipeline must be considered valid

**Acceptance**:
- Multi-stage propagation: When chaining multiple commands where each has multiple input-output type pairs, the type checker correctly identifies all valid type paths through the pipeline chain
  - i.e., if command A can output types `{T, U}` and command B accepts `{U, V} -> {W, X}`, then `A | B` should track the valid output types based on the intersection of A's outputs and B's inputs
- Error detection: When none of the possible types at the current pipeline stage match any input type of the next command, a parse error is raised indicating the type mismatch

---

### FR3: Update Type Mismatch Error Messages for Multiple Types

**Problem**: Error messages for pipeline type mismatches display only a single type even when multiple types were possible at that pipeline stage, making error messages confusing or incorrect.

**Requirements**:
- Parse errors for input type mismatches must display all possible types that were considered, joined with "or" (e.g., "int or string")
- Parse errors for output type mismatches must display all possible output types that were computed, joined with "or"
- When there are more than two types, they must be formatted as a comma-separated list with the final element preceded by the join word (e.g., "int, string, or filesize")
- Single types must display without any join word

**Acceptance**:
- Two types case: When a type mismatch occurs and there are exactly two possible types at that pipeline stage, the error message displays them joined with "or" (e.g., `<type1> or <type2>`)
- Multiple types case: When there are more than two possible types, the error message displays them as a comma-separated list with the final element preceded by "or" (e.g., `<type1>, <type2>, or <type3>`)
- Single type case: When there is only one possible type, the error message displays it without any join word
- Completeness: Error messages accurately reflect all possible types that were tracked at the point of failure, not just a single arbitrarily chosen type

---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
