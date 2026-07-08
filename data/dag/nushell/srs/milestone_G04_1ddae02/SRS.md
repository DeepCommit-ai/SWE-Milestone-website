# Software Requirements Specification: Query XML Multiple Output Types and Enhanced Nodeset Formatting

## Overview

This document specifies requirements for enhancing the `query xml` command to support multiple XPath result types and provide enhanced output formatting options for nodeset results.

### Requirements Summary

1. **FR1**: Return XPath scalar results (boolean, number, string) as native Nushell scalar types instead of wrapped in tables
2. **FR2**: Use fixed column name `string_value` for nodeset output instead of truncated query strings
3. **FR3**: Add output formatting flags for nodeset results (`--output-string-value`, `--output-type`, `--output-names`)
4. **FR4**: Make the `xml:` namespace prefix always available without explicit registration

### Affected Module

- `query xml` command in the query plugin (`nu_plugin_query`)

---

## Requirements

### FR1: Return XPath Scalar Results as Native Types

**Problem**: The `query xml` command wraps all XPath results in a table structure with a single column named after a truncated version of the query, regardless of whether the XPath expression returns a scalar value (boolean, number, or string) or a nodeset.

**Requirements**:
- When an XPath expression evaluates to a boolean result (e.g., `false()`, `true()`, comparisons), return a Nushell boolean value directly
- When an XPath expression evaluates to a numeric result (e.g., `count()`, arithmetic expressions), return a Nushell float value directly
- When an XPath expression evaluates to a string result (e.g., `local-name()`, `string()`, `concat()`), return a Nushell string value directly
- Only nodeset results should return a table/list structure

**Acceptance**:
- Boolean result: XPath expressions that evaluate to boolean (e.g., `false()`, `true()`, comparison operators) return a native Nushell boolean value directly, not wrapped in a table
- Numeric result: XPath expressions that evaluate to a number (e.g., `count()`, arithmetic expressions) return a native Nushell float value directly, not wrapped in a table
- String result: XPath expressions that evaluate to a string (e.g., `local-name()`, `string()`, `concat()`) return a native Nushell string value directly, not wrapped in a table
- Nodeset result: XPath expressions that select nodes (element paths, attribute selectors, etc.) continue to return a list of records (table structure)

---

### FR2: Use Fixed Column Name for Nodeset Output

**Problem**: When the `query xml` command returns nodeset results, it uses a truncated version of the query string as the column name (truncating queries longer than 17 characters and adding "..."). This makes output unpredictable and difficult to process programmatically.

**Requirements**:
- Nodeset results must use a fixed column name `string_value` instead of deriving the column name from the query string
- The column should contain the string value of each node in the nodeset

**Acceptance**:
- Fixed column name: All nodeset query results use `string_value` as the column name, regardless of the XPath query used
- Query length independence: The column name remains `string_value` whether the query is short or exceeds the previous truncation threshold (17 characters)
- Content preservation: The `string_value` column contains the string value of each matched node as defined by XPath string-value semantics

---

### FR3: Add Output Formatting Flags for Nodeset Results

**Problem**: Users need more information about XML nodes than just their string values. They may need to know the node type (element, attribute, text, etc.) or naming information (local name, namespace URI, prefixed name).

**Requirements**:
- Add `--output-string-value` flag to explicitly include the `string_value` column in output
- Add `--output-type` flag to include a `type` column indicating the node type
- Add `--output-names` flag to include `local_name`, `namespace`, and `prefixed_name` columns
- When no output flags are specified, maintain backward compatibility by including only `string_value`
- When any `--output-*` flag is specified, only include the columns for the specified flags
- Users must explicitly specify `--output-string-value` to include string values when using other output flags

> **Note**: Do not change the signature of existing internal functions unless explicitly required. Prefer passing new configuration through existing mechanisms to avoid breaking existing callers.

**Output Column Details** (in record order when multiple flags are specified):
1. `string_value`: The string value of the node (from `--output-string-value`)
2. `type`: One of `element`, `attribute`, `text`, `comment`, `processing_instruction`, `root`, or `namespace` (from `--output-type`)
3. `local_name`: The local part of the node's name (or nothing for nodes without names) (from `--output-names`)
4. `namespace`: The namespace URI of the node (or nothing if no namespace) (from `--output-names`)
5. `prefixed_name`: The prefixed name as it appears in the document (or nothing for nodes without names) (from `--output-names`)

**Acceptance**:
- Type-only output: When `--output-type` is specified alone, the nodeset result contains only the `type` column (no `string_value` column is included)
- Explicit string value: When `--output-string-value` is specified alongside other output flags, the `string_value` column is included in the output
- Names columns: When `--output-names` is specified, the result includes three additional columns: `local_name`, `namespace`, and `prefixed_name`
- Column ordering: When multiple output flags are combined, columns appear in a fixed order: `string_value` → `type` → `local_name` → `namespace` → `prefixed_name`
- Default behavior: When no `--output-*` flags are specified, the output defaults to including only the `string_value` column (backward compatible)
- Node type values: The `type` column contains one of: `element`, `attribute`, `text`, `comment`, `processing_instruction`, `root`, or `namespace`

---

### FR4: Make `xml:` Namespace Prefix Always Available

**Problem**: The XML namespace (`http://www.w3.org/XML/1998/namespace`) is a reserved namespace that is always implicitly declared with the `xml:` prefix in all XML documents. However, users must currently register this namespace explicitly to query attributes like `xml:lang` or `xml:base`.

**Requirements**:
- The `xml:` prefix must be automatically available for use in XPath queries without requiring explicit registration via `--namespaces`
- If users explicitly provide an `xml` namespace mapping, their mapping should be respected
- The automatic `xml:` prefix must map to the standard XML namespace URI `http://www.w3.org/XML/1998/namespace`

**Acceptance**:
- Implicit availability: The `xml:` prefix can be used in XPath queries without requiring explicit registration via `--namespaces`
- Standard XML attributes: Queries targeting standard XML namespace attributes (such as `xml:lang`, `xml:base`, `xml:space`, `xml:id`) work correctly without namespace configuration
- No error on xml prefix: Using the `xml:` prefix in XPath expressions does not produce an "undefined namespace prefix" error
- User override respected: If a user explicitly provides an `xml` namespace mapping via `--namespaces`, that user-provided mapping takes precedence over the default


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust 1.87.0 toolchain added (active via rust-toolchain.toml)
