# Software Requirements Specification: Documentation and Help Improvements

## Overview

This milestone addresses multiple improvements to the Nushell shell's documentation, help system, and LSP (Language Server Protocol) integration. The requirements focus on:

1. **FR1**: Improve unknown flag error messages with contextual suggestions
2. **FR2**: Sort command help flags by required status
3. **FR3**: Add LSP mode indicator to the `$nu` constant and adjust print behavior
4. **FR4**: Fix typo in `format filesize` help example
5. **FR5**: Update `query json` plugin help to remove broken documentation link

**Affected Modules**:
- Parser (flag parsing and error handling)
- Engine documentation generation
- Engine state and constants
- CLI print command
- Command help examples

---

## Functional Requirements

### FR1: Improve Unknown Flag Error Messages

**Problem**: When a user provides an unknown flag to a command, the error message lists all available flags regardless of how many exist, resulting in noisy and unhelpful output.

**User Report**:
```
When I type `ls --full-path` (missing the 's'), I get an error that dumps
all available flags. This is confusing when there are many flags. It would
be more helpful to suggest the correct flag name if there's a close match.
```

**Requirements**:
- When an unknown long flag is provided, check if a similar flag name exists and suggest it (e.g., "Did you mean: `--full-paths`?")
- When an unknown short flag is provided or no close match exists, display a simpler message directing the user to use `--help` to see available flags
- Remove the feature that dumps all available flags in unknown flag errors

**Acceptance**:
- When running `ls --full-path`, the error message contains "Did you mean: `--full-paths`?"
- When running `ls -r` (invalid short flag), the error message contains "Use `--help` to see available flags"
- Error messages no longer contain long lists of "Available flags: --help(-h), --all(-a),..."

---

### FR2: Sort Help Message Flags by Required Status

**Problem**: When viewing command help via `--help`, flags are displayed in an arbitrary order, making it difficult for users to quickly identify which flags are mandatory.

**Example**: Running `some-command --help` might show flags in this order:
- `--optional-flag-a`
- `--required-flag` (required parameter)
- `--help`
- `--optional-flag-b`

Users have to scan through all flags to find required ones.

**Requirements**:
- In the flags section of command help output, display flags in a prioritized order:
  1. Required flags first
  2. The `--help` flag second
  3. All other optional flags last
- Maintain consistent ordering within each category

**Acceptance**:
- When viewing help for a command with required flags, those flags appear at the top of the Flags section
- The `--help` flag appears after required flags but before other optional flags

---

### FR3: Add LSP Mode Indicator and Print Behavior

**Problem**: Users and scripts have no way to detect when Nushell is running in LSP (Language Server Protocol) mode, and print statements in LSP mode can interfere with the LSP communication protocol.

**Requirements**:
- Add a boolean field `is-lsp` to the `$nu` constant that indicates whether Nushell is running in LSP mode
- When in LSP mode, the `print` command should automatically output to stderr instead of stdout to avoid interfering with LSP protocol messages
- The `is-lsp` field should be properly initialized based on command-line arguments when Nushell starts

**Acceptance**:
- The `$nu` constant contains an `is-lsp` field of boolean type
- Tab completion for `$nu.` includes `is-lsp` among the available fields
- When running in LSP mode, `print` output is automatically redirected to stderr

---

### FR4: Fix Typo in `format filesize` Help Example

**Problem**: The help example for `format filesize` uses an incorrect unit specifier that would not work in practice.

**Requirements**:
- Correct the example in the `format filesize` command help to use a valid filesize unit

**Acceptance**:
- The `format filesize` command example shows a valid unit (lowercase `kB` instead of uppercase `KB`)

---

### FR5: Update `query json` Plugin Help

**Problem**: The `query json` plugin help contains a link to external documentation that is no longer valid or accessible.

**Requirements**:
- Remove the broken documentation link from the `query json` plugin extra description
- Keep the reference to the gjson crate repository

**Acceptance**:
- The `query json` extra description no longer contains a link to the SYNTAX.md file
- The description still references the gjson crate for users who want to learn more


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust 1.87.0 installed and active (via rust-toolchain.toml override)
