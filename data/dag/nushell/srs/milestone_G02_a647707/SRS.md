# Software Requirements Specification: Runtime Enforcement of Type Annotations

## Overview

This document specifies requirements for enforcing type annotations at runtime in Nushell variable assignments. Currently, type annotations on variables (e.g., `let x: int = ...` or `mut a: record<b: int> = ...`) are only checked at parse time when the assigned value's type is known statically. However, when values come from dynamic sources (such as pipeline transformations like `to nuon | from nuon`), runtime type checking is not performed, allowing type mismatches to go undetected.

### Summary of Requirements

1. **FR1**: Implement an experimental option to enforce runtime type checking on variable assignments
2. **FR2**: Produce conversion errors when assigned values do not match the declared type annotation at runtime
3. **FR3**: Update glob and string type subtyping to allow bidirectional compatibility
4. **FR4**: Infer correct loop variable type when iterating over Range values in `for` loops

### Affected Modules

- Engine IR evaluation (the `StoreVariable` instruction handling)
- Experimental options framework
- Type system subtyping rules
- Parser keyword handling for `for` loop iteration

---

## Requirements

### FR1: Experimental Option for Runtime Type Enforcement

**Problem**: Type annotations on variables are ignored at runtime, allowing dynamically-typed values to be assigned to annotated variables without validation.

**Requirements**:
- Introduce an experimental opt-in option named `enforce-runtime-annotations`
- Create a new module `crates/nu-experimental/src/options/enforce_runtime_annotations.rs` following the pattern of existing options (e.g., `pipefail.rs`)
- Define a static `ENFORCE_RUNTIME_ANNOTATIONS: ExperimentalOption` that can be queried via `.get()` method
- The option identifier must be `"enforce-runtime-annotations"` (used with `--experimental-options=[enforce-runtime-annotations]`)
- Register the option in `crates/nu-experimental/src/options/mod.rs` by adding it to the `ALL` array and re-exporting it
- When enabled, variable assignments must validate the assigned value's type against the declared type annotation
- The option must be opt-in by default (disabled unless explicitly enabled)

**Acceptance**:
- When the experimental option is enabled and a variable is assigned a value incompatible with its type annotation, a conversion error is produced
- When the experimental option is disabled, variable assignments behave as before (no runtime type checking)
- The option can be enabled via command line: `nu --experimental-options=[enforce-runtime-annotations]`

---

### FR2: Runtime Type Mismatch Produces Conversion Error

**Problem**: When a variable with a type annotation (such as `record<b: int>`) is assigned a value with an incompatible type at runtime (such as `record<a: int>`), no error is raised.

**Requirements**:
- When runtime type enforcement is enabled and a value with incompatible type is assigned to an annotated variable, produce a conversion error
- The type check should occur when executing the variable storage instruction, comparing the value's type against the variable's declared type (obtainable from `engine_state.get_var(var_id).ty`)
- The error message must contain "can't convert" along with the source type and target type information
- The error identifier must be "nu::shell::cant_convert"
- Compound assignment operators (e.g., `+=`, `-=`, `*=`, `/=`) that change the result type should also trigger type validation errors

**Acceptance**:
- When the option is enabled and executing `let x: record<b: int> = ({a: 1} | to nuon | from nuon)`, an error containing "can't convert record<a: int> to record<b: int>" is produced
- When the option is enabled and executing `mut a: record<b: int> = {b:1}; $a.b /= 4`, an error containing "nu::shell::cant_convert" is produced because division produces a float incompatible with the `int` type annotation

---

### FR3: Bidirectional Glob and String Subtyping

**Problem**: Passing a string-typed variable to a function expecting a glob parameter fails with a conversion error, even though string and glob are semantically compatible for many use cases.

**Requirements**:
- Update the `Type::is_subtype_of` method in `nu-protocol/src/ty.rs` to add bidirectional subtyping between `Type::Glob` and `Type::String`
- Add match arms: `(Type::Glob, Type::String) => true` and `(Type::String, Type::Glob) => true`
- Note: The parse-time `type_compatible` function in `nu-parser` already has asymmetric handling and should NOT be modified

**Acceptance**:
- When a glob-typed variable is passed to a function expecting a string parameter, an error "expected string, found glob" is produced (the parser still distinguishes them for type checking at definition sites)
- When a string-typed variable is passed to a function expecting a glob parameter, the call succeeds and the value is used correctly

---

### FR4: Range Iteration Type Inference

**Problem**: When iterating over a `Range` in a `for` loop, the loop variable's type is not correctly inferred, potentially causing type mismatches with runtime enforcement enabled.

**Requirements**:
- When parsing a `for` loop that iterates over a `Range` expression, infer the loop variable's type as `Type::Number` (since range elements can be either int or float)
- This ensures the loop variable has a compatible type regardless of whether the range yields integers or floats

**Acceptance**:
- When iterating over a range with `for i in 1..10 { ... }`, the variable `i` has type `Number`
- No type errors occur when using range iteration with runtime type enforcement enabled


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- rustc upgraded to 1.88.0 (from 1.86.0)
- cargo upgraded to 1.88.0 (from 1.86.0)
