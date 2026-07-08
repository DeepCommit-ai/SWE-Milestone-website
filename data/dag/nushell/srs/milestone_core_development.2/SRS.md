# Software Requirements Specification
## Nushell Foundation Infrastructure Part B

### Document Version: 1.0

---

## 1. Overview

This milestone covers enhancements to Nushell's core infrastructure including new comparison operators, improved variable completions, compile-time loop validation, row condition type checking, and REPL command execution improvements.

### Requirements Summary

1. **FR1**: New string comparison operators `not-starts-with` and `not-ends-with`
2. **FR2**: Local variable completion support in shell completions
3. **FR3**: Compile-time validation for `break` and `continue` statements
4. **FR4**: Type checking for row conditions at parse-time
5. **FR5**: Immediate command execution via `commandline edit --accept`
6. **FR6**: Case-insensitive filesystem support for `path relative-to`
7. **FR7**: Add `--chars` flag to `str length` command
8. **NFR3**: `PipelineData` associated constructor functions refactoring

### Affected Modules

- nu-protocol (AST operators, value operations, PipelineData constructors)
- nu-parser (operator parsing, type checking, row conditions)
- nu-cli (completions, commandline command)
- nu-engine (IR evaluation, compilation)
- nu-command (help operators, PipelineData usage updates)

---

## 2. Functional Requirements

### FR1: New String Comparison Operators

**Problem**: Users cannot easily filter strings that do NOT start or end with a specific substring using operators, requiring verbose negation logic.

**Requirements**:
- Add `not-starts-with` operator that returns true if a string does not start with another string
- Add `not-ends-with` operator that returns true if a string does not end with another string
- Both operators should work on string values only
- Operators should be available in completions when working with string types
- Operators should be documented in `help operators` output

**API Contracts**:
- Add `Comparison::NotStartsWith` and `Comparison::NotEndsWith` variants to the `Comparison` enum in `nu-protocol/src/ast/operator.rs`
- The `Comparison::as_str()` method must return `"not-starts-with"` and `"not-ends-with"` respectively
- Add `Value::not_starts_with()` and `Value::not_ends_with()` methods to `nu-protocol/src/value/mod.rs`
- Update operator completions to include both new operators for string-typed values

**Acceptance**:
- `not-starts-with` returns `true` when the string does NOT begin with the given prefix, `false` otherwise
- `not-ends-with` returns `true` when the string does NOT end with the given suffix, `false` otherwise
- Both operators work correctly with `where` for filtering lists of strings
- When typing a string followed by a space, the new operators appear in completion suggestions

---

### FR2: Local Variable Completion Support

**Problem**: Variable completions fail to suggest local variables **while the user is still typing inside an unclosed block**. The completion system behaves as if the scope has already ended, even though the user is actively typing within it. This affects function parameters, loop iteration variables, let bindings, and match pattern variables.

**User Report**:
```
When typing inside an unclosed block, tab completion does not suggest local variables:

  Broken (cursor before closing brace):
    def test [foo] { $foo<TAB>     → No completion for $foo
    for foo in [1] { $foo<TAB>    → No completion for $foo
    if true { let x = 1; $x<TAB>  → No completion for $x

  Expected: Variables should complete while typing inside the block.
```

**Requirements**:
- Variable completion should include function parameters (regular, optional, rest, and flag parameters)
- Variable completion should include loop iteration variables in `for` loops
- Variable completion should include variables declared with `let` in the current scope
- Variable completion should include pattern-matched variables in `match` expressions
- Variable completion should NOT include variables from sibling or parent scopes that have already ended
- Built-in variables (`$nu`, `$in`, `$env`) should retain their type information in completions

**API Contracts**:
- Variables must remain visible for completion while the user is typing inside an unclosed block, even if the block is syntactically incomplete
- Variable completion behavior must be consistent across both CLI (nu-cli) and LSP (nu-lsp) contexts

**Acceptance**:
- Variables in the current scope are included in completions
- Variables from ended scopes are NOT included in completions
- All variable types (parameters, let bindings, loop variables, match bindings) are included in completions

---

### FR3: Compile-Time Loop Control Statement Validation

**Problem**: Using `break` or `continue` outside of a loop context results in a runtime error, making it difficult to catch mistakes early during development.

**User Report**:
```
Running `break` outside a loop produces an unclear runtime error.
It would be better to detect this at parse/compile time.
```

**Requirements**:
- Using `break` outside of a loop (such as `loop`, `while`, or `for`) should produce a compile-time error
- Using `continue` outside of a loop should produce a compile-time error
- The error message should clearly indicate that the statement can only be used inside a loop
- This validation should occur during IR compilation, not at runtime
- Using `break`/`continue` inside a `do` block that is not inside a loop should still produce an error

**API Contracts**:
- The `compile_break()` and `compile_continue()` functions in `nu-engine/src/compile/keyword.rs` must return `CompileError::NotInALoop` when not inside a loop
- The error type is `CompileError::NotInALoop` with diagnostic code `nu::compile::not_in_a_loop`
- The error message must contain `"not_in_a_loop"` (the diagnostic code) in stderr output

**Acceptance**:
- Using `break` or `continue` outside any loop construct produces a compile-time error
- Using `break` or `continue` inside a closure/block that is not within a loop also produces a compile-time error
- Using `break` or `continue` inside valid loop constructs (`loop`, `while`, `for`) works correctly

---

### FR4: Row Condition Type Checking at Parse-Time

**Problem**: Using non-boolean expressions in row conditions (such as `where` clauses) results in confusing runtime behavior instead of a clear error message.

**Requirements**:
- Row condition expressions in commands like `where` must evaluate to a boolean type
- If the expression type is not compatible with boolean, a parse-time type mismatch error should be raised
- The error message should indicate that a boolean type was expected

**API Contracts**:
- The `parse_row_condition()` function in `nu-parser/src/parser.rs` must use `type_compatible(&Type::Bool, &expression.ty)` to check expression type
- When type check fails, emit `ParseError::TypeMismatch(Type::Bool, expression.ty, expression.span)`
- The error message must contain `"expected bool"` string for test validation

**Acceptance**:
- Row conditions with non-boolean expressions (e.g., literal integers, strings) produce a parse-time type mismatch error
- Row conditions with valid boolean expressions execute successfully

---

### FR5: Immediate Command Execution via Commandline Edit

**Problem**: Users cannot programmatically execute a command immediately after editing the commandline buffer. Currently, editing the buffer requires the user to manually press Enter.

**Requirements**:
- Add an `--accept` (or `-A`) flag to the `commandline edit` command
- When `--accept` is specified, the command should be executed immediately after the buffer is updated
- The flag should work with `--replace`, `--insert`, and `--append` modes
- The REPL state should properly track the accept flag and reset it after use

**API Contracts**:
- Add `accept: bool` field to the `ReplState` struct in `nu-protocol/src/engine/engine_state.rs`
- The `commandline edit` command in `nu-cli/src/commands/commandline/edit.rs` must add a switch `"accept"` with short flag `'A'`
- When `--accept` flag is present, set `repl.accept = true` before returning

**Acceptance**:
- The `--accept` flag causes the REPL to immediately execute the command after updating the buffer
- The `--accept` flag is documented in `commandline edit --help`

---

### FR6: Case-Insensitive Filesystem Support for `path relative-to`

**Problem**: The `path relative-to` command uses strict prefix matching via `Path::strip_prefix`, which fails on case-insensitive filesystems (Windows, macOS) when paths differ only in casing (e.g., `/etc` vs `/Etc`).

**Requirements**:
- When `path relative-to` fails to strip prefix with exact matching, on case-insensitive filesystems (Windows, macOS), fall back to case-insensitive component-by-component comparison
- Add a helper function `is_case_insensitive_filesystem()` that returns `true` on Windows and macOS using `cfg!(any(target_os = "windows", target_os = "macos"))`
- Add a helper function `try_case_insensitive_strip_prefix(lhs: &Path, rhs: &Path) -> Option<PathBuf>` that compares path components case-insensitively and returns the remaining relative path if the prefix matches
- `Component::Normal` parts are compared via `to_string_lossy().to_lowercase()`; non-Normal components (root, prefix, etc.) must match exactly
- On case-sensitive filesystems (Linux, FreeBSD), behavior remains unchanged — mismatched casing still produces an error

**API Contracts**:
- `is_case_insensitive_filesystem()` defined as a private function in `crates/nu-command/src/path/relative_to.rs`
- `try_case_insensitive_strip_prefix(lhs: &Path, rhs: &Path) -> Option<std::path::PathBuf>` defined in the same file
- The `relative_to()` function must call `is_case_insensitive_filesystem()` in the `Err` branch of `lhs.strip_prefix(&rhs)`, and if true, attempt `try_case_insensitive_strip_prefix` before returning an error

**Acceptance**:
- On case-insensitive filesystems (Windows, macOS), `path relative-to` succeeds when paths differ only in casing, returning the correct relative path
- On case-sensitive filesystems (Linux, FreeBSD), paths with different casing are treated as different paths and produce an error
- Paths that are truly different (not just casing differences) produce an error on all platforms

---

### FR7: Add `--chars` Flag to `str length` Command

**Problem**: The `str length` command supports counting by UTF-8 bytes (default) or grapheme clusters (`-g`), but has no option to count Unicode scalar values — the intuitive "character count" for most users.

**Requirements**:
- Add a `--chars` (`-c`) switch to the `str length` command that counts length using Unicode scalar values (`val.chars().count()`)
- The three counting modes are mutually exclusive: default (UTF-8 bytes), `--grapheme-clusters` (`-g`), and `--chars` (`-c`)
- When `--chars` is combined with `--grapheme-clusters`, produce an `IncompatibleParametersSingle` error
- Update existing switch descriptions from "count length using ..." to "count length in ..."

**API Contracts**:
- Add `chars: bool` field to the `Arguments` struct in `crates/nu-command/src/strings/str_/length.rs`
- Add a `"chars"` switch with short flag `Some('c')` to the command signature
- In the `run()` and `run_const()` functions, read the flag via `call.has_flag(engine_state, stack, "chars")?` / `call.has_flag_const(working_set, "chars")?` and pass it to `Arguments`
- In the `action()` function, add an `else if arg.chars { val.chars().count() }` branch between the `graphemes` and default (bytes) branches
- In `crates/nu-command/src/strings/mod.rs` `grapheme_flags()`, add a check that `--grapheme-clusters` and `--chars` are not used together, returning `ShellError::IncompatibleParametersSingle` if both are set

**Acceptance**:
- `'hällo' | str length --chars` returns `5`
- `'hello' | str length --chars` returns `5`
- `'hello' | str length` (default, bytes) still returns `5`
- `'hällo' | str length` (default, bytes) returns `6`
- Combining `--grapheme-clusters` and `--chars` produces an error

---

## 3. Non-Functional Requirements

### NFR1: Backward Compatibility
- Existing code using `starts-with` and `ends-with` operators must continue to work unchanged
- Existing completion behavior for global variables must remain unchanged
- Existing loop and control flow behavior must remain unchanged for valid use cases

### NFR2: Performance
- Variable completion should not introduce noticeable latency, even for scopes with many variables
- Compile-time loop validation should not significantly impact parse performance

### NFR3: `PipelineData` Constructor Refactoring (Code Quality)

Replace direct `PipelineData` enum variant construction with associated constructor functions throughout the codebase to improve consistency and reduce verbosity.

**Required Changes**:
- Add four associated constructor functions to the `PipelineData` impl block in `crates/nu-protocol/src/pipeline/pipeline_data.rs`:
  - `PipelineData::empty()` — a `const fn` that returns `PipelineData::Empty`
  - `PipelineData::value(val: Value, metadata)` — wraps `PipelineData::Value` variant
  - `PipelineData::list_stream(stream: ListStream, metadata)` — wraps `PipelineData::ListStream` variant
  - `PipelineData::byte_stream(stream: ByteStream, metadata)` — wraps `PipelineData::ByteStream` variant
- The `metadata` parameter for `value()`, `list_stream()`, and `byte_stream()` must accept `impl Into<Option<PipelineMetadata>>`, so callers can pass either `None` or a `PipelineMetadata` value directly
- Replace direct enum variant construction in expression positions across the codebase:
  - `PipelineData::Empty` → `PipelineData::empty()`
  - `PipelineData::Value(val, None)` → `PipelineData::value(val, None)`
  - `PipelineData::Value(val, Some(meta))` → `PipelineData::value(val, meta)`
  - `PipelineData::ListStream(stream, meta)` → `PipelineData::list_stream(stream, meta)`
  - `PipelineData::ByteStream(stream, meta)` → `PipelineData::byte_stream(stream, meta)`
  - Do NOT replace occurrences inside `match`, `if let`, or `matches!` patterns — those are destructuring, not construction, and must keep the enum variant names

**Scope**: This is a cross-cutting refactoring spanning most crates (nu-command, nu-engine, nu-cli, nu-plugin-core, nu-plugin-engine, nu-plugin-test-support, etc.).

---

## Accompanying Changes

### Windows Device Path Handling (`is_windows_device_path`)

Add a helper function `is_windows_device_path` to `crates/nu-path/src/helpers.rs` that detects Windows special device paths (e.g., `CON`, `NUL`, `COM1`, `\\.\CON`). On non-Windows platforms, this function always returns `false`.

The function must be publicly exported via `pub use helpers::{..., is_windows_device_path, ...}` in `crates/nu-path/src/lib.rs`.

Several file I/O commands must use this function to correctly handle Windows device paths:

- **`open.rs`**: Skip glob expansion for device paths (return the path directly instead of globbing)
- **`save.rs`**: Treat device paths as "existing" when deciding whether to open in append mode (`path.exists() || is_windows_device_path(path)`)
- **`source.rs`**: Skip path canonicalization for device paths (return the path as-is)
- **`parse_keywords.rs`**: In `find_in_dirs`, return device paths directly without searching directories

**Note**: This is a Windows-only behavioral change. On Linux, all code paths guarded by `is_windows_device_path` are unreachable.

---

## 4. Glossary

- **Row Condition**: An expression used in filtering commands like `where` that is evaluated for each row/element
- **IR Compilation**: The intermediate representation compilation phase that converts parsed code to executable bytecode
- **REPL**: Read-Eval-Print Loop, the interactive shell interface


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
