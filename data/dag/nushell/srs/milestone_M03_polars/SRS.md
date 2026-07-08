# Software Requirements Specification: Polars Plugin Updates and Fixes

## Overview

This specification covers updates and improvements to the Nushell Polars plugin, including bug fixes, dependency upgrades, and API enhancements. The requirements address:

1. **FR1**: Fix `polars fill-null` signature to accept expression input in addition to dataframe input
2. **FR2**: Fix `polars open` to use tab separator for TSV files when no explicit delimiter is specified
3. **FR3**: Pin the `planus` dependency to version 1.1.1 to prevent incompatible upgrades
4. **FR4**: Upgrade Polars library from version 0.49.x to version 0.51.0 with required API adaptations
5. **FR5**: Standardize input/output type declarations across all polars commands using a centralized type system
6. **FR6**: Fix Rust lifetime syntax lint warnings in function signatures

**Affected Modules**:
- `crates/nu_plugin_polars/src/dataframe/command/` (all command implementations)
- `crates/nu_plugin_polars/src/dataframe/values/` (type system and value handling)
- `crates/nu_plugin_polars/src/cache/` (cache get command)
- `crates/nu_plugin_polars/Cargo.toml` (dependency management)

---

## Requirements

### FR1: Expression Input Support for `polars fill-null`

**Problem**: The `polars fill-null` command only accepts dataframe input but should also support expression input to allow filling null values within expression chains.

**Requirements**:
- The `polars fill-null` command must accept expression input in addition to dataframe input
- When used with expressions, the command should return an expression that can be used in expression chains (e.g., within `polars select`)
- The command signature must declare both input/output type combinations

**Acceptance**:
- When piping an expression (e.g., `polars col a | polars shift 2 | polars fill-null 0`) to `polars fill-null`, the command returns a valid expression
- When using `polars fill-null` in expression context within `polars select`, the null values in the resulting column are filled with the specified value

---

### FR2: TSV File Separator for `polars open`

**Problem**: When opening TSV (Tab-Separated Values) files with `polars open`, the command does not automatically use tab as the separator, requiring users to manually specify the delimiter.

**Requirements**:
- The `polars open` command must automatically detect TSV file extension (`.tsv`)
- When opening a TSV file without an explicit `--delimiter` flag, the command must use tab (`\t`) as the default separator
- When an explicit `--delimiter` flag is provided, it must override the automatic TSV detection
- CSV files must continue to use comma as the default separator

**Acceptance**:
- When running `polars open data.tsv` on a tab-separated file, the data is correctly parsed with tab as the separator
- When running `polars open data.tsv --delimiter ","` on a TSV file, comma is used as the separator (explicit override)
- When running `polars open data.csv`, comma remains the default separator

---

### FR3: Pin `planus` Dependency Version

**Problem**: The `planus` dependency can be automatically upgraded to version 1.2.0, which may introduce compatibility issues with the current Polars version.

**Requirements**:
- The `planus` dependency must be explicitly pinned to version 1.1.1
- The dependency pinning must prevent cargo from upgrading planus to incompatible versions

**Acceptance**:
- When building the project, the `planus` crate version resolves to exactly 1.1.1
- The polars plugin compiles and functions correctly with the pinned dependency

---

### FR4: Polars Library Upgrade to Version 0.51.0

**Problem**: The Polars plugin uses version 0.49.x of the Polars library and needs to be upgraded to version 0.51.0 to access new features and improvements.

**Requirements**:
- Upgrade all Polars-related dependencies to version 0.51.0:
  - `polars` main crate
  - `polars-io`
  - `polars-arrow`
  - `polars-ops`
  - `polars-plan`
  - `polars-utils`
- Add `polars-lazy` as a new explicit dependency
- Adapt all command implementations to breaking API changes in Polars 0.51.0, including but not limited to:
  - The `pivot` function API changes requiring `Expr` instead of `PivotAgg` enum
  - The `explode` function API changes requiring `Selector` instead of string slices
  - The `to_dummies` function signature changes adding a `drop_nulls` parameter
  - The `unique`/`unique_stable` function API changes
  - The `to_integer` string method signature changes
  - The `as_datetime` and `as_datetime_not_exact` function signature changes
  - Expression enum variant changes (removal of `Columns`, `Wildcard`, `Nth`, `DtypeColumn`, `IndexColumn`, `Exclude` variants)
  - The `AggExpr::Count` enum variant becoming a struct variant
  - The `AnonymousFunction` expression losing its `output_type` field
  - The `Resource` type changes using `PlPath` instead of string paths

**Acceptance**:
- The project compiles successfully with Polars 0.51.0 dependencies
- All existing polars commands function correctly with the updated library version
- The `polars pivot` command supports both string aggregate names and custom expressions
- The `polars dummies` command supports the new `--drop-nulls` flag
- The `polars as-datetime` command supports new `--time-unit` and `--time-zone` flags
- The `polars integer` command supports new `--strict`, `base`, and `dtype` parameters

---

### FR5: Standardized Input/Output Type Declarations

**Problem**: Polars commands use inconsistent type declarations with hardcoded `Type::Custom("dataframe".into())` strings throughout the codebase, making it difficult to maintain and prone to errors.

**Requirements**:
- Introduce a `PolarsPluginType` enum with variants for all polars custom types:
  - `NuDataFrame`
  - `NuLazyFrame`
  - `NuExpression`
  - `NuLazyGroupBy`
  - `NuWhen`
  - `NuPolarsTestData`
  - `NuDataType`
  - `NuSchema`
- The enum must implement `Into<Type>` trait for easy conversion to nushell's `Type`
- Provide a `type_name()` method that returns consistent type names (e.g., `polars_dataframe`, `polars_lazyframe`, `polars_expression`)
- Provide a `types()` static method that returns a slice of all available types
- Update all command signatures to use `PolarsPluginType` variants instead of hardcoded strings
- Commands that accept multiple input types must declare all valid input/output combinations

**Acceptance**:
- All polars commands use `PolarsPluginType` enum variants for type declarations
- Commands that accept both dataframe and lazyframe input declare both type combinations in their signatures
- Commands that accept expression input declare the expression type combination in their signatures
- The type names are consistent and follow the `polars_*` naming convention

---

### FR6: Fix Lifetime Syntax Lint Warnings

**Problem**: Several function signatures use the old lifetime syntax `Vec<Example>` which triggers the `mismatched_lifetime_syntaxes` lint warning in newer Rust versions.

**Requirements**:
- Update all `examples()` method signatures in polars commands from `fn examples(&self) -> Vec<Example>` to `fn examples(&self) -> Vec<Example<'_>>`
- Apply the fix consistently across all affected files

**Acceptance**:
- Building the project with `cargo build` produces no `mismatched_lifetime_syntaxes` lint warnings related to polars command files
- All polars command `examples()` methods use the explicit lifetime syntax


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust upgraded to 1.88.0 (via rust-toolchain.toml)
