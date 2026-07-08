# Software Requirements Specification: Unclosed Character Class Toggle for Glob Parsing

## Overview

This specification defines requirements for adding an unclosed character class configuration option to the glob parsing system. This feature enables gitignore-compatible behavior where glob patterns containing unclosed character classes (e.g., `[abc` without a closing `]`) are treated as literal strings instead of producing parse errors.

### Requirements Summary

1. **FR1**: Add unclosed class toggle to the glob builder API
2. **FR2**: Implement literal fallback parsing for unclosed character classes
3. **FR3**: Enable unclosed class support by default in gitignore parsing
4. **FR4**: Disable unclosed class support by default in override globs

### Affected Modules

- Glob pattern parsing (globset crate)
- Gitignore file parsing (ignore crate)
- Override glob handling (ignore crate)

---

## Functional Requirements

### FR1: Add Unclosed Class Toggle to Glob Builder API

**Problem**: The glob builder API lacks a configuration option to control how unclosed character classes are handled during pattern parsing.

**Requirements**:
- Provide a configuration method on the glob builder that accepts a boolean parameter to enable/disable unclosed class handling
- When enabled, unclosed character classes should be parsed without error
- When disabled, unclosed character classes should result in a parse error (existing behavior)
- The default value should be disabled to preserve strict parsing behavior for general glob usage
- The configuration method should support method chaining with other builder methods

**Acceptance**:

*Observable Behavior:*
- When unclosed class mode is enabled on a glob builder, patterns with unclosed character classes parse successfully
- When unclosed class mode is disabled (or default), patterns with unclosed character classes return an error
- The configuration can be combined with other glob options (case insensitivity, literal separator, etc.)

*API Contract (for test compatibility):*
- Unit tests expect method `allow_unclosed_class(bool)` returning `&mut Self` on `GlobBuilder`

---

### FR2: Implement Literal Fallback Parsing for Unclosed Character Classes

**Problem**: When the unclosed class option is enabled, the parser must treat the opening bracket `[` as a literal character when no matching closing bracket `]` exists in the pattern.

**Requirements**:
- When unclosed class mode is enabled and an unclosed character class is detected, the opening `[` and all following characters should be treated as literal text
- The parser must correctly handle edge cases including:
  - Single opening bracket: `[`
  - Opening bracket followed by characters: `[abc`
  - Empty bracket sequences: `[]`
  - Multiple unclosed brackets: `[][`
  - Negated patterns without closing bracket: `[!`
  - Negated empty patterns: `[!]`
- When unclosed character classes appear within alternation groups (brace expressions), each branch should be evaluated independently for character class closure
- The parser should handle patterns with many opening brackets efficiently without performance degradation

**Acceptance**:

*Observable Behavior:*
- When unclosed class mode is enabled:
  - Pattern `[` matches the literal string `[`
  - Pattern `[abc` matches the literal string `[abc`
  - Pattern `[]` matches the literal string `[]`
  - Pattern `[][` matches the literal string `[][`
  - Pattern `[!` matches the literal string `[!`
  - Pattern `[!]` matches the literal string `[!]`
  - Pattern `{[abc,xyz}` matches either literal `[abc` or literal `xyz`
  - Pattern `{[abc,[xyz}` matches either literal `[abc` or literal `[xyz`
  - Pattern `{[abc],[xyz}` matches either character class `[abc]` (valid closed class) or literal `[xyz` (unclosed treated as literal)

---

### FR3: Enable Unclosed Class Support by Default in Gitignore Parsing

**Problem**: Git's gitignore implementation treats unclosed character classes as literal patterns. Users with gitignore files containing patterns like `[abc` (without closing bracket) find that ripgrep fails to parse these patterns, causing unexpected behavior where files that should be ignored are not ignored.

**User Report**:
```
I have a .gitignore file with a pattern [abc which git treats as a literal
filename match. When I run ripgrep with --files, it fails to parse my
gitignore and shows files that should be hidden.
```

**Requirements**:
- The gitignore builder should enable unclosed class mode by default to match git's behavior
- Gitignore files containing patterns with unclosed character classes should parse without error
- The gitignore builder should expose a method to toggle this behavior for users who want stricter parsing

**Acceptance**:

*Observable Behavior:*
- When a .gitignore file contains the pattern `[abc`, a file literally named `[abc` is correctly ignored
- When listing files with `--files` in a git repository containing a .gitignore with unclosed bracket patterns, the ignore rules are applied correctly
- Test `regression::r3127_gitignore_allow_unclosed_class` passes

*API Contract (for test compatibility):*
- Unit tests expect `GitignoreBuilder` to have `allow_unclosed_class(bool)` method returning `&mut Self`
- Default value for unclosed class mode in `GitignoreBuilder` should be `true`

---

### FR4: Disable Unclosed Class Support by Default in Override Globs

**Problem**: Override globs (used for command-line include/exclude patterns) should prioritize clear error messages over permissive parsing, since they are typically provided directly by users who can immediately correct mistakes.

**Requirements**:
- Override globs should disable unclosed class mode by default
- Users providing malformed glob patterns via command-line flags should receive parse errors rather than silent misinterpretation
- The override builder should expose a method to enable unclosed class support for users who need it

**Acceptance**:

*Observable Behavior:*
- When providing a glob pattern with unclosed character class via the `-g` or `--glob` flag, the command returns an error
- When a pattern like `[abc` is used as a command-line glob filter, the user receives a clear error message about the unclosed character class

*API Contract (for test compatibility):*
- Unit tests expect `OverrideBuilder` to have `allow_unclosed_class(bool)` method returning `&mut Self`
- `OverrideBuilder` should initialize with unclosed class mode disabled

---

## Notes

Unit tests in this milestone directly reference the `allow_unclosed_class` method name. The API contract sections above document these expectations to ensure test compatibility. The behavioral acceptance criteria describe what the system should do; the API contract sections describe how tests verify it.

---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
