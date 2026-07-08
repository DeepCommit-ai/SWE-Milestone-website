# Software Requirements Specification: Standard Library Enhancements

## Overview

This milestone introduces enhancements to the Nushell standard library (`std`) and RFC standard library (`std-rfc`), including:

1. **FR1**: Add `random dice` command to the standard library with input validation
2. **FR2**: Add `random choice` command to the RFC standard library for sampling list elements
3. **FR3**: Add `str align` command to align text by a target substring
4. **FR4**: Fix `std/help` module to handle example results and external command queries correctly
5. **FR5**: Add OSC 9;4 progress bar support to the `std/bench` module

**Affected Modules**:
- `std/random` (new module)
- `std-rfc/random` (new module)
- `std-rfc/str`
- `std/help`
- `std/bench`

---

## Requirements

### FR1: Add `random dice` Command to Standard Library with Input Validation

**Problem**: Users need a standard library implementation of dice rolling functionality that validates input arguments to prevent nonsensical operations like rolling zero dice or dice with one or fewer sides.

**Requirements**:
- Implement a `random dice` command in the `std/random` module
- The command accepts `--dice` flag (default: 1) specifying how many dice to roll
- The command accepts `--sides` flag (default: 6) specifying the number of sides per die
- The command must reject invalid arguments:
  - Zero or negative values for `--dice`
  - Zero, negative, or one-sided values for `--sides` (dice must have at least 2 sides)
- Return a list of integers representing the roll results
- The built-in `random dice` command should be marked as deprecated in favor of this standard library implementation

**Acceptance**:
- When `random dice --dice 0` is called, an error is raised
- When `random dice --dice (-2)` is called, an error is raised
- When `random dice --sides 0` is called, an error is raised
- When `random dice --sides (-2)` is called, an error is raised
- When `random dice --sides 1` is called, an error is raised (one-sided dice are invalid)
- When `random dice` is called with valid defaults, a list containing one integer between 1 and 6 is returned
- When `random dice --dice 10 --sides 12` is called, a list of 10 integers (each between 1 and 12) is returned

---

### FR2: Add `random choice` Command to RFC Standard Library

**Problem**: Users need a way to randomly sample elements from a list without replacement, using a statistically sound algorithm.

**Requirements**:
- Implement a `random choice` command in the `std-rfc/random` module
- The command takes a list as input and samples `n` elements (default: 1) without replacement
- If `n` exceeds the input list length, an error is raised with a descriptive message
- The sampling algorithm should provide uniform distribution across all possible samples
- Always return a list, even when sampling a single element

**Acceptance**:
- When `[1 2 3 4 5] | random choice 2` is called, a list of 2 elements from the input is returned
- When `[1 2 3] | random choice 5` is called, an error is raised indicating the sample size exceeds input length
- When `[1 2 3] | random choice` is called (default n=1), a list containing one element is returned

---

### FR3: Add `str align` Command to RFC Standard Library

**Problem**: Users need a way to align text by a common substring (such as `=` in variable assignments) across multiple lines to improve code readability.

**Requirements**:
- Implement a `str align` command in the `std-rfc/str` module
- The command accepts a target substring to align on
- The command supports the following options:
  - `--char (-c)`: Character to use for padding (default: space)
  - `--center (-C)`: Add padding at the beginning of the line instead of before the target
  - `--range (-r)`: Limit alignment to a specific range of lines
- Lines that do not contain the target substring are left unchanged
- The command accepts either a string or a list of strings as input
- Empty input returns an empty string

**Acceptance**:
- When `["one = 1", "two = 2", "three = 3"] | str align '='` is called, the `=` signs are vertically aligned by adding spaces before them
- When `["one = 1", "two = 2", "three = 3"] | str align '=' --center` is called, padding is added at the beginning of lines instead
- When `["let a = 1", "# comment", "let max = 2"] | str align '='` is called, the comment line (without `=`) is unchanged
- When alignment is applied with `--range 2..`, only lines starting from index 2 are aligned

---

### FR4: Fix `std/help` Module Issues

**Problem**: The `std/help` module has several issues affecting usability:
1. Example results display incorrectly due to improper handling of trailing whitespace and binary examples
2. The `help externs` command fails because it uses a deprecated field name (`is_extern`) instead of the current field (`type`)
3. Code uses verbose `if not ($x | is-empty)` patterns instead of the cleaner `if ($x | is-not-empty)` idiom

**Requirements**:
- Fix example result display to properly trim trailing whitespace and handle all result types consistently
- Update the external command query to use `type == "external"` instead of the deprecated `is_extern == true` field
- Replace `if not ($x | is-empty)` patterns with `if ($x | is-not-empty)` throughout the help module for consistency and clarity
- Remove the "Module" field from command help output (field no longer available)

**Acceptance**:
- When `help externs` is called, external commands are listed correctly without errors
- When viewing help for a command with examples, the example results display without leading empty lines or trailing whitespace issues
- When help is displayed for binary data examples, the output renders correctly

---

### FR5: Add OSC 9;4 Progress Bar Support to Benchmark Module

**Problem**: Users running benchmarks in terminals that support OSC 9;4 sequences (such as Windows Terminal, ConEmu) have no visual progress indication in the terminal's UI elements (taskbar, tab).

**Requirements**:
- Add OSC 9;4 progress reporting to the `std/bench` module during benchmark execution
- Progress should be reported every 10 rounds to avoid excessive terminal output
- Progress percentage should reflect overall completion across all commands being benchmarked
- Clear the progress indicator when benchmarking completes

**Acceptance**:
- When running a benchmark in a terminal supporting OSC 9;4, the terminal shows progress indication
- When benchmarking completes, the progress indicator is cleared (OSC 9;4;0 sequence sent)


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust upgraded to 1.87.0 (from 1.86.0)
