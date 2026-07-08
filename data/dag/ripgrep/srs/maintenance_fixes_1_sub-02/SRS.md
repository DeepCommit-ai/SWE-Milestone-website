# Software Requirements Specification: Maintenance Fixes and Minor Enhancements

## Overview

This milestone addresses a collection of bug fixes and minor enhancements across multiple components of ripgrep. The requirements include:

**Bug Fixes:**
1. **FR1**: Incorrect "bytes searched" statistic when using match limits
2. **FR2**: Glob pattern mishandling for paths ending with a trailing dot
3. **FR3**: Panic when using multiline mode with replace and look-around patterns
4. **FR4**: Add italic style attribute to color configuration
5. **FR5**: Line terminator not preserved when using `--crlf` with `--replace`
6. **FR6**: Inverted match with empty pattern file behavior

**Enhancements:**
1. **FR7**: Summary statistics incorrect when using `--json` flag
2. **FR8**: Files-with-matches broken when using PCRE2 multiline with look-around
9. **FR9**: BOM marker at start of gitignore files not handled
10. **FR10**: Glob escape function does not escape curly braces
11. **FR11**: Fish shell completions do not consider config file
12. **FR12**: Default thread count heuristic improvement
13. **FR13**: Add "total" label to stats output timing line
14. **FR14**: Add trace logging for detected file encoding

**Affected Modules**: searcher, printer, globset, ignore, core/flags, pcre2

---

## Requirements

### FR1: Incorrect "bytes searched" Statistic When Using Match Limits

**Problem**: When using the `-m/--max-count` flag to limit matches, the "bytes searched" value reported by `--stats` is incorrect, showing fewer bytes than were actually searched.

**Requirements**:
- The statistics collection must account for all bytes processed in a file, even when searching stops early due to match limits
- When a search terminates early (e.g., from `-m` limit), any remaining buffer content must be properly accounted for in the byte count statistics
- The byte count must reflect the cumulative size of all lines that were read and processed before the search terminated (i.e., lines containing the matches that triggered the limit)
- Add a `max_matches` method to `JSONBuilder` in `crates/printer/src/json.rs` that accepts `Option<u64>` to set the maximum number of matches before stopping
- Add a `max_matches` method to `SummaryBuilder` in `crates/printer/src/summary.rs` that accepts `Option<u64>` to set the maximum number of matches before stopping

**Acceptance**:

*Observable Behavior:*
- When a search terminates early due to a match limit (e.g., `--max-count`), the `bytes searched` statistic must reflect the number of bytes actually processed up to the termination point.
- The `bytes searched` statistic must not under-count due to early termination while there are still already-processed bytes pending in internal buffers.
- Specifically, the reported byte count must equal the sum of bytes in all lines that were read before the search stopped, including any line terminators in those lines.

---

### FR2: Glob Pattern Mishandling for Paths Ending with Trailing Dot

**Problem**: Glob patterns fail to match or exclude directory/file names that end with a trailing dot, causing incorrect filtering behavior.

**User Report**:
```
When using a glob exclusion pattern intended to exclude a directory whose name
ends with a trailing `.`, the exclusion is silently ignored and files within
that directory are still included in results.
```

**Requirements**:
- The file name extraction utility must correctly handle paths where the final component ends with a dot character
- The path handling must only return `None` for the parent directory indicator `..`, not for arbitrary names ending in `.`

**Acceptance**:

*Observable Behavior:*
- Glob exclusion patterns must correctly distinguish between directory/file names that end with a dot and those that do not.
- A pattern excluding `name/` must not affect `name./`, and a pattern excluding `name./` must not affect `name/`.

---

### FR3: Panic When Using Multiline Mode with Replace and Look-around Patterns

**Problem**: When using `-U/--multiline` combined with `-r/--replace`, certain regex patterns containing look-around assertions cause a panic due to incorrect buffer bounds calculation.

**User Report**:
```
Running a multiline search with replacement causes ripgrep to panic with an
index out of bounds error when the regex uses look-around patterns that match
across multiple locations.
```

**Requirements**:
- The replacement function must correctly handle cases where match positions extend beyond the original line range due to look-around assertions
- The buffer end calculation must account for matches that extend past the expected range
- When computing the end position for copying remaining bytes after replacements, the implementation must handle the case where the last match position exceeds the expected range boundary

**Acceptance**:

*Observable Behavior:*
- Multiline replacement searches involving regex patterns that use look-around assertions must complete without panicking.
- When a look-around pattern causes match evaluation to examine text outside the current line's typical bounds, replacement processing must correctly handle the resulting match boundaries without out-of-bounds access.
- The replacement output must correctly include all matched content and replacements, even when match boundaries extend beyond the initially expected line range.

---

### FR4: Add Italic Style Attribute to Color Configuration

**Problem**: The `--colors` flag does not support italic text styling, limiting terminal output customization options.

**Requirements**:
- Add `italic` and `noitalic` as valid style attribute values for the `--colors` flag
- The color parsing error message must list all available style attributes including the new italic options
- Documentation must be updated to reflect the new style options

**Acceptance**:

*Observable Behavior:*
- `--colors 'match:style:italic'` must apply italic styling to matches without error
- `--colors 'match:style:noitalic'` must remove italic styling without error
- When an invalid style attribute is provided (including an empty attribute), the error must include a “Choose from:” list of supported style attributes in this exact order: `nobold, bold, nointense, intense, nounderline, underline, noitalic, italic`.

---

### FR5: Line Terminator Not Preserved When Using `--crlf` with `--replace`

**Problem**: When using `--crlf` mode with the `-r/--replace` flag, the CRLF line terminator is stripped from output, producing incorrect line endings.

**Requirements**:
- When performing replacements in CRLF mode, the original line terminator must be preserved in the output
- The replacement processing must ensure that each line's original terminator (whether LF or CRLF) appears in the output after the replacement text

**Acceptance**:

*Observable Behavior:*
- When performing replacements in CRLF mode, the output must preserve the original line terminator for each line (LF vs CRLF), including in cases where the replacement expands to the entire match.
- Input containing mixed line terminators (some lines ending with LF, others with CRLF) must have each line's original terminator preserved in the replacement output.
- This behavior applies to single-line replacement mode; in multiline mode, the line terminator handling follows different semantics.

---

### FR6: Inverted Match with Empty Pattern File Behavior

**Problem**: Using `rg -vf file` where `file` is empty produces no output, when it should match all lines (since inverting "match nothing" means "match everything").

**User Report**:
```
When using an empty pattern file with invert match enabled, the command returns
no output, but logically if the empty pattern set matches nothing, then invert
match should match everything.
```

**Requirements**:
- When pattern list is empty and invert match (`-v`) is enabled, the search should proceed and match all lines
- Empty pattern sets must not be treated as an immediate "no possible matches" case when invert match is enabled
- The "matches possible" optimization check must consider the invert-match flag before deciding to skip the search

**Acceptance**:

*Observable Behavior:*
- When the pattern file contains zero patterns (completely empty file, zero bytes):
  - Without invert-match enabled, the search must behave as "no possible matches": it must produce no matches and exit with status 1.
  - With invert-match enabled, the search must match all input lines and exit successfully.
- When the pattern file contains a single empty-string pattern (e.g., a file containing only a newline):
  - Without invert-match, the empty-string pattern matches every line (since empty string matches everywhere), so all lines are output.
  - With invert-match, inverting "match everything" results in "match nothing", so no lines are output and the command exits with status 1.
- This distinction between "zero patterns" and "one empty pattern" must be correctly handled.

---

## Enhancement Requirements

*Note: The following requirements (FR7-FR14) are enhancements. Acceptance criteria are based on expected observable behavior.*

### FR7: Summary Statistics Incorrect When Using `--json` Flag

**Problem**: When using `--json` output mode, the summary statistics (bytes searched, search count) are not accumulated for files that contain no matches.

**Requirements**:
- Statistics must be collected for all searched files regardless of whether matches were found
- The JSON output "end" message may be suppressed for files with no matches, but the statistics must still be accumulated before that check

**Acceptance**:

*Observable Behavior:*
- When using `--json --stats` on multiple files, the total bytes searched and search count must include all files processed, not just those with matches

---

### FR8: Files-with-matches Broken When Using PCRE2 Multiline with Look-around

**Problem**: When using `-l/--files-with-matches` with `--pcre2 --multiline` and patterns containing look-around assertions, ripgrep may fail to report matching files.

**Requirements**:
- In `--files-with-matches` mode, a file must be reported whenever a match exists, even if match iteration can miss it in multiline look-around scenarios

**Acceptance**:

*Observable Behavior:*
- When using `--multiline --pcre2 --files-with-matches` with patterns that include look-around assertions, matching files must still be reported in output.

---

### FR9: BOM Marker at Start of Gitignore Files Not Handled

**Problem**: Gitignore files saved with a UTF-8 BOM (Byte Order Mark) have their first pattern incorrectly parsed, causing the pattern to not match as expected.

**Requirements**:
- When parsing gitignore files, strip the UTF-8 BOM character (`U+FEFF`) from the beginning of the first line if present
- This behavior must match Git's handling of gitignore files with BOM markers

**Acceptance**:

*Observable Behavior:*
- A gitignore file that begins with a UTF-8 BOM must have the BOM ignored for purposes of parsing the first pattern, so that the first pattern is interpreted the same as if the BOM were not present.

---

### FR10: Glob Escape Function Does Not Escape Curly Braces

**Problem**: The `globset::escape()` function does not escape curly brace characters `{` and `}`, which are special glob syntax for alternation patterns.

**Requirements**:
- The escape function must treat `{` and `}` as special characters and escape them using the bracket notation (e.g., `{` becomes `[{]`)

**Acceptance**:

*Observable Behavior:*
- Escaping must ensure `{` and `}` are treated as literals in the resulting glob (i.e., they must not be interpreted as alternation/grouping syntax).

---

### FR11: Fish Shell Completions Do Not Consider Config File

**Problem**: Fish shell completions do not take the `RIPGREP_CONFIG_PATH` environment variable into account when determining available options and their negations.

**Requirements**:
- Fish completions must take the ripgrep config file (as specified by `RIPGREP_CONFIG_PATH`) into account when determining whether flags are already enabled
- The negated-flag completion condition must check both the command line and the config file for the corresponding base flag

**Acceptance**:

*Observable Behavior:*
- When `RIPGREP_CONFIG_PATH` is set, the fish completions must factor in flags present in the config file when offering completions

---

### FR12: Default Thread Count Heuristic Improvement

**Problem**: When thread count is set to 0 (auto-detect), the default of 2 threads is used regardless of available CPU parallelism.

**Requirements**:
- When thread count is 0, use the system's available parallelism (capped at a reasonable maximum) instead of hardcoded value 2
- Cap the automatic thread count at 12 to avoid excessive parallelism overhead

**Acceptance**:

*Observable Behavior:*
- When thread count is set to 0, the actual thread count must be derived from the system’s available parallelism, with a minimum of 1 and maximum of 12.

---

### FR13: Add "total" Label to Stats Output Timing Line

**Problem**: The final timing line in `--stats` output lacks a label, making it unclear what the time measurement represents.

**Requirements**:
- The process time line in stats output must include the word "total" to clarify it represents total process time

**Acceptance**:

*Observable Behavior:*
- The stats output must show `X.XXXXXX seconds total` instead of just `X.XXXXXX seconds`

---

### FR14: Add Trace Logging for Detected File Encoding

**Problem**: When ripgrep detects a file's encoding via BOM, there is no logging to help diagnose encoding-related issues.

**Requirements**:
- Add a trace-level log message when a BOM is detected, indicating the detected encoding

**Acceptance**:

*Observable Behavior:*
- When a file with a BOM is processed and trace logging is enabled, a trace-level message must be emitted indicating that a BOM was found and which encoding was detected.


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust upgraded to 1.85.0 (from 1.74.0)
