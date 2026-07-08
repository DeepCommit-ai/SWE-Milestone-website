# Software Requirements Specification: Hyperlink Alias System Restructuring

## Overview

This specification defines requirements for restructuring the hyperlink alias system in the grep-printer crate to provide a more modular architecture with enhanced metadata and improved shell completion support.

### Summary of Requirements

1. **FR1**: Modular hyperlink alias architecture with separated concerns
2. **FR2**: Public `HyperlinkAlias` type with structured metadata
3. **FR3**: Display priority support for alias ordering in documentation
4. **FR4**: Human-readable description field for each hyperlink alias
5. **FR5**: Public API for retrieving available hyperlink aliases
6. **FR6**: Dynamic alias list generation in flag documentation
7. **FR7**: Enhanced zsh shell completions for `--hyperlink-format` flag

### Affected Modules

- `crates/printer/src/hyperlink` (hyperlink formatting and alias resolution)
- `crates/printer/src/lib.rs` (public API exports)
- `crates/core/flags/defs.rs` (flag documentation)
- `crates/core/flags/complete/zsh.rs` (zsh completion generation)
- `crates/core/flags/complete/rg.zsh` (zsh completion template)

---

## Functional Requirements

### FR1: Modular Hyperlink Alias Architecture

**Problem**: The hyperlink alias definitions are tightly coupled with hyperlink format parsing logic, making it difficult to expose alias metadata externally and maintain the code.

**Requirements**:
- Reorganize the hyperlink module into a directory structure with separate submodules. When creating the `hyperlink/` directory with `mod.rs`, you must delete the existing `hyperlink.rs` file to avoid Rust module ambiguity error
- Move hyperlink alias constant definitions into a dedicated submodule named `aliases.rs` (inside the `hyperlink/` directory)
- Ensure alias data remains sorted lexicographically by name for binary search lookup
- Maintain backward compatibility with existing `HyperlinkFormat::from_str` behavior

**Acceptance**:
- When parsing a hyperlink format string using `FromStr`, alias resolution continues to work correctly for all supported aliases (default, none, file, grep+, kitty, macvim, textmate, vscode, vscode-insiders, vscodium)
- When adding new aliases, they can be defined in the dedicated aliases submodule without modifying the core hyperlink parsing logic

---

### FR2: Public HyperlinkAlias Type

**Problem**: There is no structured type representing a hyperlink alias that can be exposed in the public API for external consumers to inspect alias properties.

**Requirements**:
- Create a public `HyperlinkAlias` struct type that encapsulates alias metadata, including the alias name, the format pattern string (the URL template that the alias expands to, e.g. a scheme like `vscode://file/{path}:{line}:{column}`), a human-readable description, and an optional display priority
- The type must provide accessor methods for retrieving alias properties
- The format pattern is used internally for alias resolution: when a user specifies an alias name via `--hyperlink-format`, it resolves to that alias's format pattern
- The type must be cloneable and debuggable
- The type must support `const` construction for static alias definitions

**Acceptance**:
- When accessing a `HyperlinkAlias` instance, the `name()` method returns the alias identifier
- When an alias is resolved during format string parsing, its format pattern is used to construct the `HyperlinkFormat`
- When the `HyperlinkAlias` type is used in external crates, it is accessible from the printer crate's public API

---

### FR3: Display Priority Support for Aliases

**Problem**: When listing aliases in documentation or completions, certain special aliases (such as "default" and "none") should appear before application-specific aliases, but alphabetical sorting places them incorrectly.

**Requirements**:
- Add an optional display priority field to `HyperlinkAlias`
- Lower priority values indicate the alias should be displayed earlier
- Aliases without an explicit priority should appear after those with priorities when sorted
- The "default" alias must have the lowest priority (displayed first)
- The "none" alias must have the second-lowest priority (displayed second)

**Acceptance**:
- When retrieving aliases and sorting by display priority, "default" appears first
- When retrieving aliases and sorting by display priority, "none" appears second
- When retrieving aliases and sorting by display priority, application aliases (vscode, kitty, etc.) appear in their original order after prioritized aliases
- When calling `display_priority()` on an alias without explicit priority, `None` is returned

---

### FR4: Description Field for Hyperlink Aliases

**Problem**: Hyperlink alias names alone do not convey what URL scheme or application each alias corresponds to, making shell completions and documentation less helpful to users.

**Requirements**:
- Add a description field to each hyperlink alias
- Descriptions must be concise (suitable for shell completion display)
- Descriptions should indicate the URL scheme used (e.g., "file://", "vscode://")
- Descriptions should name the target application where applicable
- Provide a public accessor method to retrieve the description

**Acceptance**:
- When retrieving the description for "default", it indicates RFC 8089 file scheme with platform awareness
- When retrieving the description for "none", it indicates hyperlinks are disabled
- When retrieving the description for "vscode", it indicates VS Code scheme
- When retrieving the description for application-specific aliases, the description includes the URL scheme pattern

---

### FR5: Public API for Retrieving Hyperlink Aliases

**Problem**: External callers (such as the CLI completion generators and flag documentation) cannot access the list of available hyperlink aliases programmatically.

**Requirements**:
- Provide a public function named `hyperlink_aliases` in `crates/printer/src/hyperlink/mod.rs` (NOT in the `aliases.rs` submodule) that returns all available hyperlink aliases
- The returned collection must be sorted lexicographically by alias name
- The function must be accessible from outside the printer crate
- Document that callers may want to re-sort using display priority for user-facing output

**Acceptance**:
- When calling the aliases retrieval function from the CLI crate, a complete list of aliases is returned
- When iterating over the returned aliases, they are sorted alphabetically by name
- When the function is called multiple times, consistent results are returned

---

### FR6: Dynamic Alias List Generation in Documentation

**Problem**: The `--hyperlink-format` flag documentation contains a hardcoded list of alias names that must be manually updated when aliases are added or removed, creating a maintenance burden and risk of documentation drift.

**Requirements**:
- Generate the alias list in flag documentation dynamically from the alias definitions
- Sort aliases by display priority when generating documentation lists
- Format alias names appropriately for the documentation format (man page markup)
- Use lazy initialization to avoid repeated generation

**Acceptance**:
- When viewing `--hyperlink-format` help, "default" and "none" appear before other aliases
- When a new alias is added to the alias definitions, it automatically appears in the flag documentation without additional changes
- When viewing `--hyperlink-format` help, all available aliases are listed with proper formatting

---

### FR7: Enhanced Zsh Shell Completions for --hyperlink-format

**Problem**: The zsh shell completion for `--hyperlink-format` does not provide completion suggestions for available aliases or format string variables, reducing usability.

**Requirements**:
- Add completion function for hyperlink format aliases with their descriptions
- Add completion function for hyperlink format variables (path, host, line, column, wslprefix)
- The alias completions must be generated dynamically from the alias definitions
- Provide descriptions for each format variable explaining its purpose
- Use the `_alternative` completion to offer both aliases and custom format strings
- Prevent duplicate function definitions using zsh function existence checks

**Acceptance**:
- When tab-completing `--hyperlink-format=` in zsh, available aliases are shown with descriptions
- When tab-completing within a format string (after `{`), available variables are shown
- When completing the "path" variable, its description indicates it is required
- When alias descriptions are updated in the printer crate, zsh completions reflect the changes automatically

---

## Non-Functional Requirements

### Maintainability
- New aliases can be added by modifying only the aliases submodule
- Documentation and completions update automatically from alias definitions

### Backward Compatibility
- Existing hyperlink format parsing behavior remains unchanged
- Existing scripts using `--hyperlink-format` with alias names continue to work


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
