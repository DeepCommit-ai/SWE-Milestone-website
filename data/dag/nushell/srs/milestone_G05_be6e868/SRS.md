# Software Requirements Specification: LSP Testing Code Refactoring

## Overview

This milestone addresses improvements to the Nushell Language Server Protocol (LSP) implementation, focusing on two main areas:

1. **Test code refactoring**: Consolidating duplicated test code across multiple LSP modules using parameterized tests
2. **Bug fix for goto definition on newly created files**: Ensuring goto definition works correctly for files that exist only in the LSP document cache (not yet saved to disk)

### Affected Modules
- LSP completion module
- LSP diagnostics module
- LSP goto definition module
- LSP hover module
- LSP inlay hints module
- LSP signature help module
- LSP symbols module
- LSP workspace module (references, rename, highlight)
- LSP notification module

---

## Requirements

### FR1: Consolidate Duplicated LSP Test Code Using Parameterized Tests

**Problem**: The LSP test suite contains numerous individual test functions with repetitive boilerplate code for initializing the language server, opening files, sending requests, and asserting results. This duplication makes the test suite harder to maintain and extend.

**Requirements**:
- Replace multiple individual test functions with parameterized test functions using the `rstest` crate
- Consolidate test cases that share the same request/response pattern into single parameterized functions
- Reduce test code duplication while maintaining full test coverage
- Simplify path construction in tests (e.g., combining multiple `script.push()` calls into single path strings like `"lsp/completion/var.nu"`)
- When goto definition resolves to a standard library file (non-absolute path), the LSP should skip the result and send a warning notification to the client
- Add a new `send_log_message` method to `LanguageServer` that sends LSP `window/logMessage` notifications with the specified message type and content
- In `get_location_by_span`, add a check using `path.is_relative()` to skip files with relative paths (e.g., nu-std files) and send a warning log message containing "absolute path is expected" when this occurs
- Add test helper functions in `workspace.rs` to reduce JSON boilerplate: `make_range(start_line, start_char, end_line, end_char)`, `make_location_ref(uri, start_line, start_char, end_line, end_char)`, `make_text_edit(new_text, start_line, start_char, end_line, end_char)`, `make_highlight(kind, start_line, start_char, end_line, end_char)`
- Add test helper functions in `symbols.rs` to reduce JSON boilerplate: `create_position(line, character)`, `create_range(...)`, `create_symbol(...)`, `update_symbol_uri(symbols, uri)`
- Add a platform-specific constant `DETAIL_STR` in `completion.rs` tests: `"detail"` on non-Windows, `"detail\r"` on Windows

**Acceptance**:
- When running the LSP test suite, all parameterized tests execute successfully with the same coverage as the original individual tests
- Test code is more concise with shared setup logic extracted into reusable patterns
- Adding new test cases requires only adding new `#[case]` attributes rather than duplicating entire test functions

### FR2: Support Goto Definition for Newly Created Files

**Problem**: When a user creates a new file in their editor that hasn't been saved to disk yet, the goto definition feature fails because the LSP attempts to read the file from the filesystem. This affects developers who define and immediately want to navigate to symbols within unsaved buffers.

**Requirements**:
- Modify the `open` test helper function signature to: `open(client_connection: &Connection, uri: Uri, new_text: Option<String>) -> Result<lsp_server::Notification, String>`
- When `new_text` is `Some(content)`, the `open` function should use the provided content; when `None`, it should read from disk as before
- Update the `open_unchecked` helper to call `open` with `None` for the third parameter to maintain backward compatibility
- Add a new test `goto_definition_in_new_file` that verifies goto definition works for files that don't exist on disk
- Goto definition requests should work correctly for documents that exist only in the LSP's in-memory document cache
- The LSP should use the document content from its internal cache when the physical file doesn't exist on disk

**Acceptance**:
- When a file is opened with content provided via the `new_text` parameter, goto definition correctly locates symbol definitions within that file
- Users can navigate to definitions of functions, variables, and commands defined within unsaved files
- Existing behavior for files that exist on disk remains unchanged


---

# Environment Dependency Changes (relative to Base Env)

- Add `fancy-regex = { workspace = true }` dependency to `crates/nu-lsp/Cargo.toml`
