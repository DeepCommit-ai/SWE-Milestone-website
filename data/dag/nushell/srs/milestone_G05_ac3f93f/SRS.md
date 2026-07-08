# Software Requirements Specification: Format Bits Endianness

## Overview

This specification defines requirements for improving the `format bits` command in Nushell by:

1. Changing the default byte order output from native endian to big endian for consistent, portable results
2. Adding an `--endian` flag to allow users to select the desired byte ordering

**Affected Module**: `format bits` command (string formatting / conversions category)

---

## FR1: Change Default Endianness to Big Endian

**Problem**: The `format bits` command outputs multi-byte numeric values using native endianness, which produces different results on little-endian and big-endian systems. This inconsistency makes output non-portable across different architectures.

**Requirements**:
- The `format bits` command must output multi-byte integer values using big-endian byte order by default
- This change affects the following input types: `int`, `filesize`, `duration`, and `bool`
- Single-byte values remain unaffected by endianness
- Binary data and string inputs continue to be processed byte-by-byte in their natural order
- The output format remains space-separated groups of 8 binary digits per byte

**Acceptance**:
- Multi-byte case: When formatting an integer that requires multiple bytes (e.g., values >= 256), the output displays bytes in big-endian order, with the most significant byte appearing first
- Single-byte case: Values that fit in a single byte (0-255 for unsigned representation) output as a single 8-bit group, unaffected by endianness settings
- Cross-platform consistency: The command produces identical output on both little-endian and big-endian host systems

---

## FR2: Add Endian Selection Flag

**Problem**: Users may need to output binary representations in a specific byte order for compatibility with different systems or protocols that expect little-endian or native-endian formats.

**Requirements**:
- Add an `--endian` (short form `-e`) flag to the `format bits` command
- The flag must accept a string argument with three valid values:
  - `big`: Output in big-endian order (most significant byte first)
  - `little`: Output in little-endian order (least significant byte first)
  - `native`: Output using the host system's native byte order
- When the flag is not specified, the default behavior must be big-endian
- The flag applies to numeric types: `int`, `filesize`, `duration`, and `bool`
- The flag also applies when processing tables and records containing these numeric types
- Providing an invalid value for the flag must produce an appropriate error message

**Acceptance**:
- Big-endian mode: With `--endian big`, multi-byte values display the most significant byte first
- Little-endian mode: With `--endian little`, multi-byte values display the least significant byte first (byte order is reversed compared to big-endian)
- Native mode: With `--endian native`, the output uses the host system's native byte order
- Short flag: The `-e` short form works equivalently to `--endian`
- Invalid value handling: Providing an unrecognized endian value (anything other than `big`, `little`, or `native`) produces an error that indicates the valid options


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- rustc 1.87.0
