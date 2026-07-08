# Software Requirements Specification

## Global Gitignore Pattern Matching with Absolute Paths

### Overview

This specification addresses a bug in the ignore pattern matching system where global gitignore files fail to correctly filter files when ripgrep is invoked with absolute search paths. The issue affects:

1. Global gitignore files configured via git's `core.excludesFile` setting
2. Custom ignore files specified via the `--ignore-file` command-line flag

**Requirements Summary:**

1. **FR1**: Fix anchored gitignore pattern matching when searching absolute paths with global gitignore files

**Affected Components:**

- File walker/traversal system
- Ignore pattern matching infrastructure
- Global gitignore handling

---

### FR1: Anchored Pattern Matching in Global Gitignores with Absolute Paths

**Problem**: Anchored patterns (e.g., `/foo`) in global gitignore files do not correctly match files when ripgrep is provided with absolute paths to search.

**User Report**:
```
When using a global gitignore file with an anchored pattern like `/haystack`,
the pattern correctly ignores files when searching with relative paths (like `.`),
but fails to ignore the same files when searching with an absolute path.

For example:
- Create a file `a/b/c/haystack`
- Create a gitignore with pattern `/haystack`
- From directory `a/b/c`, running `rg --files .` correctly ignores `haystack`
- But running `rg --files /absolute/path/to/a/b/c` incorrectly shows `haystack`

The pattern should match regardless of whether a relative or absolute path is provided.
```

**Requirements**:

- Global gitignore patterns must be interpreted relative to the current working directory, not relative to an empty root path
- Anchored patterns (patterns starting with `/`) in global gitignore files must correctly match files when:
  - Searching with absolute paths
  - Searching with relative paths
  - Searching from subdirectories
- The behavior must be consistent between:
  - Gitignore files from git's `core.excludesFile` configuration
  - Gitignore files added via the `--ignore-file` flag
- The current working directory must be properly tracked and propagated through the file traversal system
- When the current working directory cannot be determined, global gitignore files should be gracefully skipped rather than causing errors
- The current working directory should be queried at most once per traversal for efficiency
- Users should have the ability to explicitly set the current working directory context if needed

**Acceptance**:

- When a global gitignore file contains an anchored pattern `/haystack`, and a file named `haystack` exists at the root of the search path, that file should be excluded from results regardless of whether the search path is specified as absolute or relative
- When running ripgrep from a subdirectory with `--ignore-file` pointing to a gitignore containing `/haystack`, and providing an absolute path to search, files matching the pattern should be correctly filtered
- When the current working directory cannot be determined, the system should log a debug message and continue operation without the global gitignore rules (rather than failing)
- A regression scenario must be covered: when searching from a subdirectory using a global/custom ignore file with an anchored pattern, and providing an absolute search path, the anchored pattern must still correctly filter files


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust upgraded to 1.85.0

## Base Image
- Base image: rust:1.74.0-slim
