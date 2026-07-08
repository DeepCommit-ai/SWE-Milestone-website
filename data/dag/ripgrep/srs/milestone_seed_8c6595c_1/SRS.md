# Software Requirements Specification: Performance Issues with After-Context Flag

## Overview

This specification addresses two related performance bugs in the grep-searcher crate affecting searches that use the `-A/--after-context` flag with large context values.

### Summary of Requirements

1. **FR1**: Fix exponential slowdown when searching stdin with large after-context values
2. **FR2**: Optimize context line calculation to avoid unnecessary backward line scanning when before-context is zero

### Affected Components

- Line buffer module - Buffer fill logic for stream readers
- Searcher core module - Context line calculation in buffer roll operation

---

## Functional Requirements

### FR1: Line Buffer Fill Performance for Stream Input

**Problem**: Searching stdin (or other stream-based readers) with large `-A/--after-context` values causes exponential slowdown that makes the search unusable for practical workloads.

**User Report**:
```
When using ripgrep with large after-context values (e.g., -A 10000) while searching
stdin, the search takes orders of magnitude longer than expected. The same search
completes quickly when searching files directly, but becomes unbearably slow when
piped through stdin.
```

**Requirements**:
- The line buffer must fully utilize its allocated capacity when reading from stream-based inputs (stdin, pipes, network streams)
- The buffer fill operation must loop on the underlying `read()` call until either the buffer's free capacity is exhausted or the reader returns zero bytes (EOF), rather than returning after a single partial read
- The fill operation must not return to the caller with unused buffer capacity unless the input source is exhausted
- Performance of stdin searches should be comparable to file-based searches for equivalent data sizes
- When binary detection is enabled, the line buffer must check for binary content in each batch of newly-read bytes immediately after the `read()` call returns, before proceeding to the next read iteration or returning to the caller

**Binary Detection Behavioral Note**:
The line buffer (Reader mode) and slice-based searcher (Slice mode) have intentionally different binary detection semantics:
- **Reader mode**: Performs binary detection on every chunk of bytes read into the buffer. When binary content is detected, the search terminates immediately. The reported `byte count` reflects only the bytes that were actually searched before binary detection occurred, which may be less than the total bytes read.
- **Slice mode**: Performs binary detection only on the initial chunk (up to buffer capacity) and subsequently only within matched lines. This means Slice mode may search more bytes before detecting binary content that appears after the initial chunk and outside of matches.

This behavioral difference is by design and must be preserved.

**Acceptance**:
- When searching stdin with `-A 10000` on a multi-megabyte input, the search completes in a reasonable time (seconds, not minutes or hours)
- The buffer fill loop continues reading until free capacity is zero or EOF is reached
- Binary detection occurs incrementally on each read batch, causing earlier termination in Reader mode compared to Slice mode when binary content appears beyond the initial buffer and outside matched lines

---

### FR2: Context Start Calculation Optimization

**Problem**: Using large `-A/--after-context` values causes unnecessary performance overhead even when `-B/--before-context` is zero or not specified.

**User Report**:
```
Search performance degrades significantly when using only after-context (-A) with
large values, even though before-context lines are not being displayed. The slowdown
is noticeable with values like -A 1000 or higher.
```

**Requirements**:
- The context start calculation during buffer roll operations must only scan backward for the number of lines actually needed for before-context display
- When before-context is zero, the backward line-preceding scan should be skipped entirely
- The context separator logic (which needs to know about previous line positions) must continue to function correctly even without the full backward scan
- The optimization must not affect the correctness of context line output when both before-context and after-context are used together

**Acceptance**:
- When searching with `-A 10000` and no `-B` flag, there is no backward line scanning overhead proportional to the after-context value
- When searching with `-A 1000 -B 5`, only 5 lines are scanned backward, not 1000
- Context separators (`--`) appear correctly between non-adjacent match groups regardless of the optimization
- Search results remain identical before and after the optimization for all combinations of before-context and after-context values

---

## Performance Acceptance Criteria

- Stdin searches with large after-context values must not exhibit exponential time complexity relative to the context size
- The performance improvement should be measurable: searches that previously took minutes should complete in seconds
- Memory usage patterns should remain consistent with the existing buffer allocation strategy
- No regression in search correctness or output formatting for any combination of context flags


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- rustc upgraded to 1.92.0
- cargo upgraded to 1.92.0
