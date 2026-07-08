# Software Requirements Specification: Glob Nested Alternates Support

## Overview

This specification defines requirements for adding support for nested alternation groups in glob patterns. Currently, the glob parser rejects patterns that contain alternation groups nested within other alternation groups (e.g., `{a,{b,c}}` or `{{a,b},{c,d}}`), returning a `NestedAlternates` error. Users require the ability to construct complex glob patterns with arbitrarily nested alternations to express sophisticated file matching rules.

### Requirements Summary

1. **FR1**: Support parsing of nested alternation groups in glob patterns
2. **FR2**: Maintain proper error handling for malformed alternation patterns
3. **FR3**: Generate correct regular expressions for nested alternations
4. **FR4**: Ensure nested alternation patterns correctly match file paths

### Affected Components

- Glob pattern parser
- Alternation group handling logic
- Regex generation for alternation tokens

---

## Functional Requirements

### FR1: Support Parsing of Nested Alternation Groups

**Problem**: Glob patterns containing nested alternation groups such as `{a,{b,c}}`, `{{a,b},{c,d}}`, or `{a,b{c,d}}` fail to parse with a `NestedAlternates` error, preventing users from expressing complex file matching patterns.

**User Report**:
```
When I try to use a glob pattern like `**/{node_modules/**/*/{ts,js},crates/**/*.{rs,toml}}`
to match files across different project types, the parser rejects it with a
"nested alternates" error. I need nested alternates to efficiently express
patterns that combine multiple complex path matching rules.
```

**Requirements**:
- The glob parser shall accept patterns containing alternation groups nested at any depth
- Patterns such as `{a,{b,c}}` (one level of nesting) shall be valid
- Patterns such as `{{a,b},{c,d}}` (two alternation groups at the same level, each nested) shall be valid
- Patterns such as `{a,b{c,d}}` (alternation nested within a branch of an outer alternation) shall be valid
- The parser shall correctly track the scope of each alternation group to associate branches with their containing group

**Acceptance**:
- When parsing pattern `{a,{b,c}}`, the parser produces a valid glob without error
- When parsing pattern `{{a,b},{c,d}}`, the parser produces a valid glob without error
- When parsing pattern `{a,b{c,d}}`, the parser produces a valid glob without error

---

### FR2: Maintain Proper Error Handling for Malformed Alternation Patterns

**Problem**: While enabling nested alternations, the parser must continue to detect and report errors for syntactically invalid alternation patterns such as unmatched braces.

**Requirements**:
- The parser shall return an `UnclosedAlternates` error when a `{` is found without a matching `}`
- The parser shall return an `UnopenedAlternates` error when a `}` is found without a preceding unmatched `{`
- Error detection shall work correctly for nested patterns where only some braces are unmatched
- Commas outside of alternation groups shall be treated as literal characters, not branch separators

**Acceptance**:
- When parsing pattern `{a,{b,c}` (missing closing brace for outer group), an `UnclosedAlternates` error is returned
- When parsing pattern `a,b}` (closing brace without opening), an `UnopenedAlternates` error is returned
- When parsing pattern `{a,b}}` (extra closing brace), an `UnopenedAlternates` error is returned

---

### FR3: Generate Correct Regular Expressions for Nested Alternations

**Problem**: Nested alternation groups must be compiled to regular expressions that correctly represent the alternation semantics, with each nested group producing a properly scoped non-capturing group in the regex.

**Requirements**:
- Each alternation group shall compile to a non-capturing regex group with pipe-separated alternatives
- Nested alternation groups shall produce nested non-capturing groups in the generated regex
- The order of alternatives in the generated regex shall preserve the order from the glob pattern
- Simple alternation `{a,b}` shall generate regex pattern `(?:a|b)`
- One-level nested alternation `{a,{b,c}}` shall generate regex pattern `(?:a|(?:b|c))`
- Multi-group nested alternation `{{a,b},{c,d}}` shall generate regex pattern `(?:(?:a|b)|(?:c|d))`

**Acceptance**:
- When pattern `{a,b}` is compiled, the resulting regex matches the form `^(?:a|b)$`
- When pattern `{a,{b,c}}` is compiled, the resulting regex matches the form `^(?:a|(?:b|c))$`
- When pattern `{{a,b},{c,d}}` is compiled, the resulting regex matches the form `^(?:(?:a|b)|(?:c|d))$`

---

### FR4: Ensure Nested Alternation Patterns Correctly Match File Paths

**Problem**: Glob patterns with nested alternations must correctly match against file paths, expanding all possible combinations represented by the nested structure.

**Requirements**:
- A pattern with nested alternations shall match any path that satisfies any combination of the alternation branches
- Pattern `{a,b{c,d}}` shall match paths matching `a`, `bc`, or `bd`
- Nested alternations shall work correctly in combination with other glob features (wildcards, character classes, etc.)
- Matching behavior shall be consistent with the existing alternation semantics for flat alternation groups

**Acceptance**:
- When pattern `{a,b{c,d}}` is matched against path `a`, the match succeeds
- When pattern `{a,b{c,d}}` is matched against path `bc`, the match succeeds
- When pattern `{a,b{c,d}}` is matched against path `bd`, the match succeeds
- When pattern `{a,b{c,d}}` is matched against path `b`, the match fails (incomplete match)
- When pattern `{a,b{c,d}}` is matched against path `be`, the match fails (incorrect alternative)

---

## Compatibility Notes

- The `NestedAlternates` error kind shall be deprecated but retained in the public API for backward compatibility
- Existing patterns without nested alternations shall continue to work identically
- The semantic meaning of commas, braces, and other alternation-related syntax remains unchanged outside of enabling nesting


---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- Rust upgraded to 1.88.0
