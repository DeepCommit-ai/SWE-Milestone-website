# Software Requirements Specification: Foundation Infrastructure Part C

## Overview

This milestone addresses multiple core infrastructure improvements and bug fixes across the Nushell shell:

1. **FR1**: Prevent `detect columns` from creating invalid records with duplicate column keys
2. **FR2**: Enable `which` command to list all available commands when no application parameter is provided
3. **FR3**: Add dummy namespace commands for multiword command orphans to maintain command hierarchy consistency
4. **FR4**: Improve `to md` output formatting to produce valid markdown tables and add character escaping options
5. **FR5**: Fix power operator (`**`) associativity to be right-associative per mathematical convention
6. **FR6**: Fix bare string interpolation regression when subexpressions appear at both start and end
7. **FR7**: Quote strings containing `=` character in NUON serialization
8. **FR8**: Improve script file not found error to reference the command line rather than internal source
9. **FR9**: Add endianness control to `into binary` command
10. **FR10**: Refactor command context initialization to support incremental engine state building

### Affected Components
- String processing commands (`detect columns`, `to md`)
- System commands (`which`)
- Core command registration and namespace handling
- Parser (operator associativity, string interpolation)
- NUON format conversion (quoting logic)
- Script file evaluation (error handling)
- Type conversion commands (`into binary`)
- Command context initialization (`src/command_context.rs`)

---

## Functional Requirements

### FR1: Detect Columns Duplicate Key Handling

**Problem**: The `detect columns` command can produce records with duplicate column keys when processing certain input data, which creates invalid record structures.

**Requirements**:
- The `detect columns` command must detect when column detection would result in duplicate column keys
- When duplicate keys would be created, the command must return an error instead of creating an invalid record
- The error must be catchable using standard error handling mechanisms (e.g., `try`/`catch`)

**Acceptance**:
- When `detect columns` encounters input that would produce duplicate column names, it returns an error rather than an invalid record
- The error can be caught using standard error handling mechanisms (e.g., `try`/`catch`)

---

### FR2: Which Command Listing Without Arguments

**Problem**: The `which` command requires an application parameter, but users need a way to discover all available commands and executables without knowing their names in advance.

**Requirements**:
- When `which` is invoked without an application parameter, it must list all available internal and external commands
- Without the `-a` flag, results must be deduplicated by command name (first occurrence wins)
- With the `-a` flag, all commands including duplicates across different paths must be shown
- The command description must be updated to document this behavior

**Acceptance**:
- `which` without arguments returns a list of all available commands (built-in and external)
- `which -a` returns all commands including duplicates from different locations
- The count of results from `which` is less than or equal to the count from `which -a`

---

### FR3: Dummy Namespace Commands for Multiword Orphans

**Problem**: Some multiword commands (e.g., `error make`, `attr example`, `detect columns`) exist without their parent namespace command being registered, causing inconsistency in the command hierarchy.

**Requirements**:
- For each multiword built-in command, its parent namespace command must exist
- Parent namespace commands must display help text explaining they require a subcommand
- The following namespace commands must be added: `attr`, `error`, `detect`, `query`, and `registry` (Windows only)

**Acceptance**:
- Every multiword built-in command (commands containing a space in their name) has a corresponding parent namespace command registered as either a built-in or keyword type
- Running a namespace command (e.g., `detect`, `attr`, `error`) without a subcommand displays usage help instead of an error

---

### FR4: Markdown Table Output Formatting and Escaping

**Problem**: The `to md` command produces markdown tables that may not render correctly in all markdown parsers, and provides no way to escape special characters that could break table rendering.

**Requirements**:
- Table output must include proper spacing around cell contents and separators (e.g., `| foo | bar |` instead of `|foo|bar|`)
- Separator rows must use at least three dashes (e.g., `| --- |` instead of `|-|`)
- Centered columns (with `--center`) must use `:---:` format in the separator row
- Add `--escape-md` (`-m`) flag to escape markdown special characters in cell content
- Add `--escape-html` (`-t`) flag to escape HTML special characters in cell content
- Add `--escape-all` (`-a`) flag to escape both markdown and HTML special characters
- Pipe characters (`|`) in table cells must always be escaped with backslash
- When using `--per-element`, separate table groups with a blank line

**Acceptance**:
- Table formatting requirements:
  - Each cell wrapped with space-pipe-space (` | `) as delimiter
  - Separator row using exactly three dashes per column (`| --- |`)
  - Centered columns use `:---:` in separator row (e.g., `| --- |:---:|` for second column centered)
  - Empty cell values preserved with proper spacing
  - Empty column headers preserved with proper spacing
- Character escaping behavior:
  - Pipe characters (`|`) in table cells are always backslash-escaped to prevent table corruption
  - With `--escape-md`: Markdown special characters (`*`, `_`, `[`, `]`, `<`, `>`, `(`, `)`, `#`, `\`) are backslash-escaped
  - With `--escape-html`: HTML special characters (`<`, `>`, `&`, `"`, `/`) are entity-encoded (e.g., `<` becomes `&lt;`)
- Multiple table groups (with `--per-element`) are separated by blank lines

**Technical Note**:
- The internal `fragment` function should accept `escape_md` and `escape_html` as separate boolean parameters (not combined into a single enum)

---

### FR5: Power Operator Right Associativity

**Problem**: The power operator (`**`) is parsed as left-associative, producing mathematically incorrect results for chained power expressions.

**User Report**:
```
Expression `2 ** 1 ** 2` evaluates to 4 instead of the expected 2.
Mathematically, 2^(1^2) = 2^1 = 2, but left-associative parsing gives (2^1)^2 = 2^2 = 4.
```

**Requirements**:
- The power operator (`**`) must be right-associative when parsing expressions
- Chained power expressions must evaluate from right to left

**Acceptance**:
- Chained power expressions evaluate from right to left, i.e., `a ** b ** c` equals `a ** (b ** c)`

---

### FR6: Bare String Interpolation with Subexpressions at Both Ends

**Problem**: Bare word string interpolation fails when the expression starts and ends with parenthesized subexpressions, causing parse errors.

**User Report**:
```
Expressions like `(100 + 20 + 3)/bar/(300 + 20 + 1)` fail to parse as string interpolation.
This worked in previous versions and is a regression.
```

**Requirements**:
- Bare word string interpolation must work when parenthesized subexpressions appear at both the start and end of the expression
- The parser must correctly identify `Unbalanced` parentheses errors (not just `Unclosed`) as triggers for string interpolation fallback

**Acceptance**:
- Expressions with parenthesized subexpressions at both start and end parse successfully as string interpolation
- The parsed AST contains a `StringInterpolation` expression with subexpressions and string literals

---

### FR7: Quote Strings Containing Equals Sign in NUON

**Problem**: Strings containing the `=` character are not quoted when serialized to NUON format, causing parse errors when the NUON is read back.

**Requirements**:
- Strings containing `=` characters must be quoted when serialized with `to nuon`
- This applies to both record keys and values
- The quoting logic must handle strings like `=`, `a=`, and `=a`

**Acceptance**:
- Strings containing `=` character are properly quoted when serialized to NUON format
- Record keys and values containing `=` can be round-tripped through `to nuon | from nuon` without data loss

---

### FR8: Script File Not Found Error Pointing to Command Line

**Problem**: When a script file is not found, the error message references internal Rust source code locations instead of the command line where the user typed the command.

**User Report**:
```
Running `nu non-existent-script.nu` shows an error with file references like `.rs`
instead of indicating that the error occurred on the command line input.
```

**Requirements**:
- When a script file specified on the command line is not found, the error must reference the command line as the source location
- The error must not expose internal Rust source file paths (`.rs` files)
- The script file name must be included in the error message

**Acceptance**:
- When running `nu non-existent-script.nu foo bar`, the error:
  - Does not contain `.rs` (no internal Rust source references)
  - Contains the script name `non-existent-script.nu`
  - References `commandline` as the error source

**Technical Context**:
- Error handling in nushell uses `IoError` types from `nu_protocol::shell_error::io`
- To reference custom source locations (like "commandline") in error messages, nushell supports adding virtual file entries to the working set
- Similar file-not-found handling patterns exist in the codebase (e.g., `source_env` command)

---

### FR9: Endianness Control for `into binary` Command

**Problem**: The `into binary` command converts values to binary using native endianness, but users need control over byte order for interoperability with systems using different endianness.

**Requirements**:
- Add `--endian` (`-e`) flag to `into binary` command accepting values: `native` (default), `little`, `big`
- When converting numeric types (int, float, filesize, bool, duration), use the specified endianness
- String, date, and binary values are not affected by endianness setting
- The `--compact` flag should respect the endianness setting when trimming zeros

**Technical Note**:
- Add `little_endian: bool` field to the `Arguments` struct
- Default to native endianness (`cfg!(target_endian = "little")`) when `--endian` is not specified

**Acceptance**:
- `258 | into binary --endian big` produces big-endian bytes
- `258 | into binary --endian little` produces little-endian bytes
- Invalid endian values produce a `TypeMismatch` error

---

### FR10: Refactor Command Context Initialization API

**Problem**: The command context initialization function in `src/command_context.rs` needs to support incremental engine state building.

**Requirements**:
- In `src/command_context.rs`, rename `get_engine_state()` to `add_command_context(engine_state: EngineState) -> EngineState`
- Update all call sites (tests and `src/main.rs`) to use the new function signature

**Acceptance**:
- Function `add_command_context` exists with signature `pub(crate) fn add_command_context(engine_state: EngineState) -> EngineState`
- All call sites updated to pass an `EngineState` parameter

---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
