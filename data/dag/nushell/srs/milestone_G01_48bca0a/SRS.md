# Software Requirements Specification: Custom Completion Refactoring

## Overview

This milestone fixes incorrect custom completion behavior when completing flag names versus flag values. Currently, when a user types a partial flag name (e.g., `spam --f`) for a command whose flag has a custom completer, the system incorrectly invokes the custom completer instead of suggesting the flag name. The completion system needs to be refactored so that custom completers are only invoked when completing parameter **values**, not when completing parameter **names**.

### Requirements Summary

1. **FR1**: Fix flag name completion to not invoke custom completers
2. **FR2**: Preserve custom completer syntax validation in type annotations

### Affected Modules

- Completion engine (`crates/nu-cli/src/completions/completer.rs`)
- Parser (signature parsing, shape specs)

---

## Functional Requirements

### FR1: Fix Flag Name Completion Behavior

**Problem**: When a command defines flags or positional arguments with custom completers (using the `type@completer` syntax in signatures), the completion system incorrectly invokes the custom completer when the user is typing a flag **name**. For example, given:

```nushell
extern spam [
    animal: string@animals
    --foo (-f): string@animals
    -b: string@animals
]
```

Typing `spam --f` should suggest `--foo` (flag name completion), but instead it invokes the `animals` completer and suggests `["cat", "dog", "eel"]`.

**Requirements**:
- When the cursor is within a partial flag name (long or short form), the system must provide flag name completions
- When listing available flags (e.g., after typing a single dash), all available flags must be shown
- Custom completers must still work correctly when completing flag values and positional argument values

**Acceptance**:
- Partial flag name input produces flag name suggestions
- Typing a single dash lists all available flags
- Flag value and positional argument value completion continues to work correctly

---

### FR2: Preserve Custom Completer Syntax Validation

**Problem**: The `type@completer` syntax is only valid in command signature argument positions. It must remain invalid in variable type annotations.

**Requirements**:
- The `@completer` syntax must continue to be rejected in variable type annotations (e.g., `let x: int@completer`)
- The parse error message must contain "Unexpected custom completer"
- The `@completer` syntax must continue to work in command signatures and extern declarations

**Acceptance**:
- Using `@completer` in variable type annotations produces a parse error containing "Unexpected custom completer"
- The `@completer` syntax continues to work in command signatures and extern declarations

---

## Non-Functional Requirements

### NFR1: Signature Struct Field Changes

**API Changes**:
- `Expression` (in `crates/nu-protocol/src/ast/expression.rs`): remove the `custom_completion: Option<DeclId>` field
- `PositionalArg` and `Flag` (in `crates/nu-protocol/src/signature.rs`): add `custom_completion: Option<DeclId>` field

**Acceptance**: The structs compile with the updated field layout, and all existing tests pass.

---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
