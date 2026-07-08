# Software Requirements Specification
## Nushell Core Features Development - Milestone 4

---

## 1. Overview

This milestone encompasses several key enhancements to Nushell's core functionality:

1. **FR1**: Implement `--ignore-case` flag for `get`, `select`, and `reject` commands
2. **FR2**: Add `--flatten` flag for `each` command to stream closure results
3. **FR3**: Make `each` a no-op on single `null` input
4. **FR4**: Support static list completions for command parameters
5. **FR5**: Allow saving custom values to disk via `save` command
6. **FR6**: Pass optional and casing parameters to custom value cell-path methods
7. **FR7**: Use default terminal color for unspecified theme colors
8. **FR8**: Reset content type for commands returning partial input
9. **FR9**: Propagate errors from nested `each` through full chain
10. **FR10**: Proper error handler cleanup when loop control statements are used within `try` blocks

**Affected Modules**:
- `nu-command`: filter commands (`get`, `select`, `reject`, `each`, `first`, `skip`, `take`), byte commands (`bytes at`), string commands (`str substring`)
- `nu-cli`: completion system
- `nu-protocol`: signature, custom value trait, pipeline data
- `nu-color-config`: style computation
- `nu-engine`: IR compilation (loop control, error handler cleanup)
- Plugin custom values

---

## 2. Functional Requirements

---

### FR1: Case-Insensitive Cell-Path Access Flag

**Problem**: Users must append `!` to each cell-path member to enable case-insensitive access, which is verbose when accessing multiple columns.

**Requirements**:
- Add `--ignore-case` flag to the `get` command that makes all cell-path members case-insensitive
- Add `--ignore-case` flag to the `select` command with the same behavior
- Add `--ignore-case` flag to the `reject` command with the same behavior
- The flag should apply to all cell-path members in the command, equivalent to appending `!` to each one
- The flag must work in combination with the `--optional` flag

**Acceptance**:
- Basic case: `get --ignore-case <cell-path>` on a table with differently-cased column names succeeds when the column exists with different casing
- Nested path case: `get --ignore-case <nested.cell.path>` applies case-insensitive matching to each path member in the chain
- Select case: `select --ignore-case <column>` selects the column regardless of case differences between the specified name and actual column name
- Reject case: `reject --ignore-case <key>` removes the key from a record regardless of case differences
- Combined flags: `--ignore-case` works correctly in combination with `--optional` flag

---

### FR2: Flatten Streams from `each` Closure

**Problem**: When the closure passed to `each` returns a stream, the stream is fully collected before being returned as a single item in the output. This blocks processing of subsequent items and prevents true streaming behavior.

**Requirements**:
- Add `--flatten` flag to the `each` command
- When `--flatten` is used, items from closure streams should be yielded immediately as they are received rather than waiting for the entire stream to be collected
- The output should be a flat stream rather than a list of collected values
- This effectively flattens output that would otherwise be `list<list<T>>` into `list<T>`
- The default behavior (without `--flatten`) should remain unchanged: streams are collected into values

**Acceptance**:
- The `each` command must accept a `--flatten` flag (short form `-f`)
- When `each --flatten` is used with a closure that returns a range, items are streamed immediately to downstream commands without waiting for all iterations
- When processing `[0 3] | each --flatten {|e| $e..<($e + 3) | round } | square`, items from the first iteration are passed to `square` before the second iteration completes (output order demonstrates interleaving: first iteration items alternate with second iteration items as they complete)
- Without `--flatten`, the same pipeline collects all items from each iteration before passing to the next command

---

### FR3: `each` No-Op on Single Null Input

**Problem**: When `each` receives a single `null` value, it currently processes it through the closure. This is inconsistent with the intended behavior where `each` should iterate over elements.

**Requirements**:
- When `each` receives a single `null` value as input, it should return `null` without executing the closure
- When `each` receives an empty pipeline, it should return empty
- This enables graceful handling of missing or optional values in pipelines

**Acceptance**:
- When `each` receives a single `null` value as input, it returns `null` without executing the closure

---

### FR4: Static List Completions for Command Parameters

**Problem**: Currently, command parameters can only specify completions via a custom completion command. There is no simple syntax for providing a static list of valid values for tab completion.

**Requirements**:
- Support specifying a static list of valid values for parameter completions inline in the parameter declaration
- Support referencing a constant list for parameter completions
- Support completion records that can provide additional metadata for each completion value
- Both `def` and `extern` commands should support static list completions
- Built-in commands should be able to specify static completion lists in their signatures
- When a record is provided instead of a list, produce a `ParseError::OperatorUnsupportedType` error

**Acceptance**:
- Commands defined with inline list completions should show those items as tab completion options
- Commands defined with constant list completions should show those items as tab completion options
- Records with a `value` field in the completion list should extract the value correctly
- When a record (instead of a list) is provided for completions, a parse error should be raised
- Built-in commands with static completion lists should show their completion options

---

### FR5: Save Custom Values to Disk

**Problem**: The `save` command cannot write custom values to files. Plugin-defined custom values have no way to implement custom serialization for file output.

**Requirements**:
- Add a `save` method to the `CustomValue` trait that allows custom values to define how they are written to files
- The `save` method signature: `fn save(&self, path: Spanned<&Path>, value_span: Span, save_span: Span) -> Result<(), ShellError>`
- The `save` command should check if the input is a custom value and call its `save` method
- The default implementation should return an error indicating the custom value does not implement saving
- The error message must contain the string `"Custom value does not implement \`save\`"` and suggest checking the plugin's documentation
- Plugin authors can implement the `save` method to support file output

**Acceptance**:
- When attempting to save a custom value that does not support saving, an appropriate error should be raised indicating the operation is not supported
- When saving a custom value that implements the save functionality, the file should be written using the custom serialization

---

### FR6: Optional and Casing in Custom Value Cell-Path Methods

**Problem**: Custom value implementations cannot honor the optional (`?`) and case-insensitive (`!`) cell-path modifiers. When users access custom values with these modifiers, the behavior is incorrect.

**Requirements**:
- Add `optional: bool` parameter to `CustomValue::follow_path_int` method signature: `fn follow_path_int(&self, self_span: Span, index: usize, path_span: Span, optional: bool) -> Result<Value, ShellError>`
- Add `optional: bool` and `casing: Casing` parameters to `CustomValue::follow_path_string` method signature: `fn follow_path_string(&self, self_span: Span, column_name: String, path_span: Span, optional: bool, casing: Casing) -> Result<Value, ShellError>`
- The `Casing` enum from `nu_protocol::casing` has variants `Casing::Sensitive` and `Casing::Insensitive`
- When `optional` is true and the path member does not exist, return `Value::nothing(span)` instead of an error
- When `casing` is `Casing::Insensitive`, perform case-insensitive matching for string keys
- Update all custom value implementations to handle these new parameters

**Acceptance**:
- Accessing an existing key on a custom value returns the value correctly
- Accessing a non-existent key on a custom value raises an appropriate error
- Using optional access syntax on a non-existent key returns null instead of an error
- Using case-insensitive access syntax matches keys regardless of case differences

---

### FR7: Default Terminal Color in Theme

**Problem**: The default color theme uses explicit white color (`Color::White`) for many element types. On terminals with light backgrounds, white text is nearly invisible.

**Requirements**:
- Change the default theme to use `Color::Default` instead of `Color::White` for element types that should inherit the terminal's default foreground color
- This affects: separator, int, duration, range, float, string, nothing, binary, cell-path, record, list, block, and search_result colors
- Preserve explicit colors for elements that should have distinct coloring (header, empty, bool, filesize, datetime, row_index, hints)
- `Color::Default` must render as ANSI SGR code 39 (escape sequence `\u{1b}[39m`) for default foreground color

**Acceptance**:
- When `{a: 1, b: 2}` is displayed with ANSI coloring enabled, integer values and table borders use the default terminal color ANSI escape code `\u{1b}[39m` (not white `\u{1b}[37m`)
- When `find` command highlights matches, the highlight style uses `\u{1b}[41;39m` (red background code 41 combined with default foreground code 39)
- When displaying an empty list `[]` with ANSI coloring, the table borders use default color code `\u{1b}[39m`
- The `search_result` theme element uses `Color::Default.normal().on(Color::Red)` (default foreground on red background)

---

### FR8: Reset Content Type for Partial Input Commands

**Problem**: Commands like `first` and `str substring` that return a subset of the input incorrectly preserve the original content type metadata. A substring of JSON text is not necessarily valid JSON.

**Requirements**:
- The `first` command should clear the `content_type` metadata when extracting bytes from a stream
- The `str substring` command should clear the `content_type` metadata
- The `skip` command should clear the `content_type` metadata when skipping bytes
- The `take` command should clear the `content_type` metadata when taking bytes
- The `bytes at` command should clear the `content_type` metadata when extracting byte ranges

**Acceptance**:
- When partial content is extracted from input that has content type metadata, the result's metadata should not contain the original content type
- This can be verified by checking `metadata | get content_type?` on the output, which should return null

---

### FR9: Propagate Errors Through Nested `each` Chain

**Problem**: When errors occur in nested `each` closures, the full error chain showing the call stack is not properly preserved, making debugging difficult.

**Requirements**:
- Errors in nested `each` closures should propagate with the full call chain information
- Each level of nesting should be represented in the error output
- The error message should show `eval_block_with_input` for each level of the `each` call stack

**Acceptance**:
- When an error occurs in nested `each` closures, the error output should show the call stack for each nesting level
- The error chain should contain `eval_block_with_input` entries corresponding to each nesting level

---

### FR10: Error Handler Cleanup on Loop Control in Try Blocks

**Problem**: When using `break` or `continue` inside a `try` block within a loop, error handlers are not properly cleaned up, causing subsequent errors to be incorrectly caught or the error propagation to fail.

**User Report**:
```
When breaking out of a try block inside a loop, subsequent error make
commands are incorrectly caught or the error doesn't propagate correctly.
```

**Requirements**:
- When `break` is used inside a `try` block within a loop, error handling state must be properly cleaned up
- When `continue` is used inside a `try` block within a loop, error handling state must be properly cleaned up
- Nested `try` blocks should also properly clean up their error handling state when a loop control statement is encountered
- Errors raised after the loop should propagate correctly and not be caught by handlers from within the loop

**Acceptance**:
- When executing a loop with `try { break } catch { ... }` followed by `error make`, the error is NOT caught by the catch block and propagates correctly
- When executing a loop with nested `try` blocks containing `break`, both inner and outer catch blocks are bypassed correctly
- When executing a loop with `try { continue } catch { ... }`, errors after the loop propagate correctly

---

## 3. Non-Functional Requirements

- All changes must maintain backward compatibility with existing scripts
- Performance of `each` should not regress for non-streaming use cases
- The completion system should remain responsive with static list completions

### NFR1: Reedline Library Upgrade Adaptation (reedline 0.41.0 → 0.42.0)

**Scope**: Adapt `crates/nu-cli/src/reedline_config.rs` to the reedline 0.42.0 API. The reedline library introduced a new text object system that replaces the previous `CutInside`/`YankInside` edit commands.

**API Changes**:
- `EditCommand::CutInside { left, right }` → `EditCommand::CutInsidePair { left: char, right: char }` (renamed)
- `EditCommand::YankInside { left, right }` → `EditCommand::CopyInsidePair { left: char, right: char }` (renamed, Yank→Copy)

**Acceptance**: The keybinding configuration parsing in `reedline_config.rs` compiles and works correctly with reedline 0.42.0.

### NFR2: Rusqlite Library Upgrade Adaptation (rusqlite 0.31 → 0.37)

**API Changes**:
- `DatabaseName` enum (variants `Main`, `Temp`, `Attached(&str)`) → replaced by the `Name` trait; methods now accept generic `impl Name` parameters
- `DatabaseName::Main` → use `rusqlite::MAIN_DB` constant (type `&CStr`, value `c"main"`) or a `&str` literal `"main"`
- `DatabaseName::Temp` → use `rusqlite::TEMP_DB` constant or `"temp"`
- `DatabaseName::Attached(name)` → pass the `name: &str` directly (since `&str` implements `Name`)

**Acceptance**: The database commands in `sqlite.rs` compile and work correctly with rusqlite 0.37.

### NFR3: Signature Struct Field Changes

**API Changes**:
- `PositionalArg` and `Flag` (in `crates/nu-protocol/src/signature.rs`): replace the existing `custom_completion: Option<DeclId>` field with `completion: Option<Completion>`, where `Completion` is a new enum supporting both custom completion commands (`DeclId`) and static value lists

**Acceptance**: The structs compile with the updated field layout, and all existing tests pass.

### NFR4: Test Support for Experimental Options

**Scope**: Add experimental options support to the test helper infrastructure (`crates/nu-test-support/src/macros.rs`), enabling integration tests to pass `--experimental-options` to the `nu` binary.

**API Changes**:
- `NuOpts` struct: add field `pub experimental: Option<Vec<String>>`
- `nu_run_test()` function: when `experimental` is `Some(opts)`, append `--experimental-options=[opt1,opt2,...]` to the `nu` command invocation

**Acceptance**: Integration tests can use `nu!(experimental: vec!["option_name".to_string()], "command")` to run commands with experimental options enabled.

---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust toolchain upgraded to 1.88.0 (via rust-toolchain.toml)

## Workspace Dependency Upgrades
- `reedline`: `0.41.0` → `0.42.0`
- `rusqlite`: `0.31` → `0.37`
