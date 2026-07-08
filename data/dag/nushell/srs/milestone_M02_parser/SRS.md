# Software Requirements Specification: Parser Bug Fixes and Improvements

## Overview

This milestone addresses multiple parser-related bugs in the Nushell shell that affect error reporting, expression parsing, and scope handling. The following issues are addressed:

1. **FR1**: External command arguments with parenthesized subexpressions are not parsed correctly
2. **FR2**: Short flags requiring values produce errors with missing span information
3. **FR3**: `export def` command leaks argument names into the current scope
4. **FR4**: Environment variable shorthand detection produces false positives with escaped quotes
5. **FR5**: Redefining built-in `def` keyword causes parser panics
6. **FR6**: Unbalanced delimiters report empty or invalid span locations
7. **FR7**: Incomplete math binary operations produce garbage expressions with incorrect spans

**Affected Modules**: Parser (lexer, expression parsing, keyword parsing)

---

## Functional Requirements

### FR1: External Command Arguments with Subexpressions

**Problem**: Exact same bareword expression gets treated differently for an external command and fails thinking there's a runaway parenthesis.

How to reproduce:

```nushell
/home/user: echo ProxyCommand=($'hello')
ProxyCommand=hello
/home/user: ^/bin/echo ProxyCommand=($'hello')
:::
```

When invoking external commands with arguments containing parenthesized subexpressions, the parser fails to recognize and evaluate the subexpressions correctly, treating them as literal text instead of evaluating them.

**Requirements**:
- Parse parenthesized expressions within external command arguments as subexpressions that should be evaluated
- Support nested parentheses within subexpressions
- Concatenate the result of subexpressions with surrounding literal text
- Properly handle edge cases where parentheses appear within quoted strings (these should remain literal)
- Report appropriate errors when parenthesized expressions are unclosed

**Acceptance**:
- Basic case: A subexpression containing a simple string literal evaluates correctly, i.e., `^echo <prefix>( <expr> )` outputs `<prefix><result_of_expr>`
- Pipeline case: A subexpression containing pipeline operations evaluates and concatenates properly with surrounding text
- Multiple subexpressions: Adjacent subexpressions are each evaluated and concatenated in order, specifically, multiple `( <expr> )` blocks are evaluated independently
- Quoted context: Parentheses within quoted strings remain as literal text, e.g., parentheses inside `"..."` or `'...'` are preserved literally
- Error case: Missing closing parenthesis is detected and reported, i.e., unclosed `(` produces a parse error

---

### FR2: Short Flags Requiring Values Missing Span

**Problem**: `ls -<tab>` works while `table -<tab>` doesn't. Problem rooted at the parser:

```nushell
> ast -f "ls -a"

╭─content─┬───────shape────────┬─────span──────╮
│ ls      │ shape_internalcall │ ╭───────┬───╮ │
│         │                    │ │ start │ 0 │ │
│         │                    │ │ end   │ 2 │ │
│         │                    │ ╰───────┴───╯ │
│ -a      │ shape_flag         │ ╭───────┬───╮ │
│         │                    │ │ start │ 3 │ │
│         │                    │ │ end   │ 5 │ │
│         │                    │ ╰───────┴───╯ │
╰─────────┴────────────────────┴───────────────╯

> ast -f "table -a"

╭─content─┬───────shape────────┬─────span──────╮
│ table   │ shape_internalcall │ ╭───────┬───╮ │
│         │                    │ │ start │ 0 │ │
│         │                    │ │ end   │ 5 │ │
│         │                    │ ╰───────┴───╯ │
╰─────────┴────────────────────┴───────────────╯

> ast -f "table --abbreviated"

╭────content────┬───────shape────────┬──────span──────╮
│ table         │ shape_internalcall │ ╭───────┬───╮  │
│               │                    │ │ start │ 0 │  │
│               │                    │ │ end   │ 5 │  │
│               │                    │ ╰───────┴───╯  │
│ --abbreviated │ shape_flag         │ ╭───────┬────╮ │
│               │                    │ │ start │ 6  │ │
│               │                    │ │ end   │ 19 │ │
│               │                    │ ╰───────┴────╯ │
╰───────────────┴────────────────────┴────────────────╯
```

When a short flag that requires a value is used at the end of a command without providing that value, the resulting parse error does not include the flag in the final expression's span coverage. This causes completions to fail because the incomplete flag is not tracked.

**Requirements**:
- When a short flag requires a value but none is provided, still add the flag to the call's named arguments
- Ensure the span of the incomplete flag is included in the expression being built
- This allows downstream tooling (such as completions) to be aware of the incomplete flag

**Acceptance**:
- When requesting completions for `table -` (a command with short flags requiring values), completions are returned for all available flags

---

### FR3: Export Def Exposes Arguments to Current Scope

**Problem**: The issue of "leaked argument variable" of `export def` can be reproduced by:

1. `export def foo [bar] {}`, either executed in the REPL or sourced from a script
2. `scope variables | where name == '$bar'`, showing a non-empty result

When using `export def` to define a function outside of a module context, the function's parameter names are incorrectly exposed to the current scope as variables. This pollutes the namespace and can cause unexpected behavior.

**Requirements**:
- When parsing `export def` statements, ensure that parameter definitions do not leak into the enclosing scope
- After parsing an `export def`, the current scope should not contain the parameter names as variables

**Acceptance**:
- After executing `export def <func_name> [<param>: <type>] {}`, the parameter `<param>` should not be visible in the current scope's variable list
- Function parameters remain scoped only within the function body

---

### FR4: Environment Shorthand False Positive

**Problem**: The parser incorrectly interprets certain string patterns as environment variable shorthand syntax.

**Issue Description** (GitHub Issue #16332 - "Quote escaping in strings behaving unexpectedly"):
> I would expect `"\"'\"=\"foo\""` to yield a string literal, but it doesn't. However, if I add a space before the closing quote, `"\"'\"=\"foo\" "`, then it does. I would expect the first example to be correct, and also expect spacing to not have any effect on this.

Specifically, strings containing escaped quotes followed by an equals sign (e.g., `"\"=foo"`) are misidentified as environment variable assignments.

**Requirements**:
- Before treating a token as environment shorthand syntax (e.g., `VAR=value`), validate that the left-hand side is a syntactically valid environment variable name
- Tokens where the left-hand side contains characters invalid for environment variable names should not be parsed as environment shorthand
- The validation should follow standard POSIX environment variable naming conventions

**Acceptance**:
- Test:
  - Input: String literal containing an escaped quote followed by `=` and more characters
  - Expectation: Parsed as string literal, returns the unescaped string content
- Regression tests for valid environment shorthand syntax should continue to pass:
  - Valid patterns like `VARNAME=value command` should still work

---

### FR5: Redefining `def` Keyword Causes Panic

**Problem**: When a user attempts to redefine the built-in `def` keyword (e.g., `def def (=a|s)>`), the parser panics instead of returning a proper error. This was discovered through fuzzing (GitHub Issue #16586).

**Reproduction**:
```nushell
def def (=a|s)>
```

A similar issue occurs when trying to redefine the `extern` keyword.

**Requirements**:
- When parsing `def` or `extern` commands, look up the command definition in a way that avoids conflicts with user-defined redefinitions
- Handle attempts to redefine built-in keywords without causing parser instability or panic
- Return an appropriate parse error (e.g., "Unclosed delimiter") instead of a panic when malformed syntax is encountered

**Acceptance**:
- When executing `def def (=a|s)>`, an error message containing "Unclosed delimiter" is returned instead of a panic
- The shell remains stable and responsive after attempting to redefine built-in keywords

---

### FR6: Empty Span of Unbalanced Delimiter

**Problem**: When the parser encounters an unbalanced closing delimiter (`)` or `}`) without a matching opening delimiter, it reports a `ParseError::Unbalanced` error with an empty or out-of-bounds span. This makes error messages point to invalid source locations.

**Requirements**:
- When reporting unbalanced delimiter errors, the span should cover the actual unbalanced delimiter character
- The span should be valid and within the bounds of the input
- The span should have non-zero length, covering exactly the unbalanced delimiter
- When tokenizing type annotations (in `parse_var_with_opt_type`), comma (`,`) should be treated as a delimiter token rather than whitespace, ensuring malformed type syntax like bare commas produce "unknown type" errors

**Acceptance**:
- When parsing a statement with a malformed type annotation containing an unbalanced `)`, an error message containing "unbalanced ( and )" is reported with a valid span covering the unbalanced delimiter
- When parsing a statement with a malformed type annotation containing an unbalanced `}`, an error message containing "unbalanced { and }" is reported with a valid span covering the unbalanced delimiter
- When parsing a statement with an invalid type syntax, an error message containing "unknown type" is reported
- All error spans are within valid source bounds and have non-zero length

---

### FR7: Missing Span of Incomplete Math Binary Operation

**Problem**: Duplicated garbage expression in parsing results (GitHub Issue #16713).

**How to reproduce**:

```nushell
> ast -f "$ a"

╭─content─┬─────shape─────┬───────span────────╮
│ $       │ shape_garbage │ {record 2 fields} │
│ a       │ shape_garbage │ {record 2 fields} │
│ a       │ shape_garbage │ {record 2 fields} │
╰─────────┴───────────────┴───────────────────╯
```

**Expected behavior**:

```
╭─content─┬─────shape─────┬───────span────────╮
│ $       │ shape_garbage │ {record 2 fields} │
│ a       │ shape_garbage │ {record 2 fields} │
╰─────────┴───────────────┴───────────────────╯
```

The duplication occurs because both the operator and the garbage expression for the missing operand are assigned the same span.

**Requirements**:
- When an incomplete math expression is detected, the garbage expression representing the missing operand should have a distinct span from the operator
- The missing operand's span should represent the location where the operand was expected (typically a zero-width span at the end of the operator)
- The operator and right-hand-side expressions in a `BinaryOp` should never have identical spans in error cases

**Acceptance**:
- When parsing `$ a`, the resulting `BinaryOp` expression has an operator span that is different from the right-hand-side (garbage) expression's span
- Error messages for incomplete math expressions point to the correct location

---

## Additional Notes

- All fixes must maintain backward compatibility with existing valid Nushell scripts
- Error messages should be clear and actionable, pointing to the correct source location
- Parser performance should not be significantly impacted by these fixes


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
