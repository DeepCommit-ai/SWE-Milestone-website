# Software Requirements Specification
## Max Matches Searcher Migration

### Overview

This specification defines requirements for migrating the match limit (`max_matches`) functionality from the printer layer to the searcher layer in a grep-like search library. The current architecture places match counting and limit enforcement in the printer component, which creates issues when multiline search is enabled or when after-context lines contain additional matches.

**Requirements Summary**:
1. FR1: Add max_matches configuration to SearcherBuilder
2. FR2: Implement match counting and limit enforcement in searcher core
3. FR3: Correct multiline match counting behavior
4. FR4: Handle matches occurring within after-context lines
5. FR5: Support max_matches with inverted match mode

**Affected Components**:
- Searcher configuration and builder
- Searcher core search logic
- Multiline search handling

**Note**: This milestone adds the searcher-level max_matches functionality. The printer layer's existing max_matches configuration remains unchanged in this phase - printer API changes will be handled in a separate milestone.

---

### FR1: Add Max Matches Configuration to SearcherBuilder

**Problem**: The match limit configuration currently exists only in the printer layer, preventing the searcher from making match-limiting decisions during search.

**Requirements**:
- The SearcherBuilder must provide a method to set a maximum number of matches
- The configuration must accept an optional limit value (None means unlimited)
- A limit value of 0 must be valid, causing immediate termination with no matches
- The Searcher must expose a getter method to retrieve the configured max_matches value
- Multiline matches spanning multiple lines must be counted as exactly one match for limit purposes

**Acceptance**:
- `SearcherBuilder` must provide a builder method `max_matches(&mut self, limit: Option<u64>) -> &mut SearcherBuilder`
- `Searcher` must provide a getter method `max_matches(&self) -> Option<u64>`
- When SearcherBuilder is configured with `max_matches(Some(N))`, the searcher limits output to at most N matches
- When SearcherBuilder is configured with `max_matches(None)`, no match limit is enforced
- When `max_matches(Some(0))` is set, the searcher returns immediately without searching

---

### FR2: Implement Match Counting in Searcher Core

**Problem**: Match counting is performed in the printer, which cannot make early termination decisions during the search phase itself.

**Requirements**:
- The searcher core must maintain an internal match counter
- The counter must be incremented when a match is found (before reporting to the sink)
- The searcher must stop searching once the match limit is reached and any required after-context has been printed
- Match limit checks must be performed in all search code paths:
  - Line-by-line fast search
  - Line-by-line slow search
  - Multiline search
  - Inverted match search

**Acceptance**:
- When searching for pattern "Sherlock" with max_matches(1) in text containing multiple occurrences, only the first matching line is printed
- When the match limit is reached during line-by-line search, the searcher terminates without scanning remaining content

---

### FR3: Correct Multiline Match Counting

**Problem**: When using multiline mode with max_matches, a single match that spans multiple lines may be incorrectly counted multiple times or additional matches may be found and printed.

**Requirements**:
- In multiline mode, a match spanning N lines must increment the counter exactly once
- The searcher must check the match limit before attempting to find additional matches
- The find operation in multiline mode must respect the match limit

**Acceptance**:
- In multiline mode, a single match may span multiple lines; it counts as exactly 1 match regardless of how many lines it covers
- When max_matches is reached, the searcher must output all lines covered by the final match's span, then cease discovering or reporting new matches (aside from completing required after-context output if configured)
- When overlapping or adjacent multiline matches could potentially occur, reaching max_matches must not produce additional match output beyond the limit

---

### FR4: Handle Matches Within After-Context Lines

**Problem**: When after-context is enabled and the match limit has been reached, subsequent lines printed as context may themselves contain matches. The current behavior may either miss printing these or print them incorrectly.

**Requirements**:
- After reaching the match limit, any remaining after-context lines must still be printed
- If a line being printed as after-context contains a match, it should be printed as a match line (with match highlighting if applicable)
- The system must document that combining max-count with after-context or context may result in more matches than the specified limit being printed

**Acceptance**:
- Lines scanned during after-context output must still be checked for matches; if a match is found, that line must be output with match semantics (not context semantics)
- When a match occurs within an after-context window, it should refresh/extend the after-context window like any normal match (thus total match lines output may exceed max_matches; max_matches only limits the active search for new matches, not the scan chain required to complete context output)
- After reaching max_matches, any remaining after-context lines from the final match must still be printed

---

### FR5: Support Max Matches with Inverted Match Mode

**Problem**: Inverted match mode (showing non-matching lines) must correctly interact with the max_matches limit.

**Requirements**:
- When inverted match is enabled, the match counter must count non-matching lines (which become the "matches")
- The searcher must terminate after printing the specified number of non-matching lines plus any after-context
- Context lines in inverted mode should follow the same rules as normal mode

**Acceptance**:
- When searching with invert_match(true) and max_matches(1), only the first non-matching line (plus any configured after-context) is printed
- When searching with invert_match(true), max_matches(2), and after_context(1), exactly two non-matching lines are printed with their respective after-context
- When an inverted search reaches its match limit, remaining after-context from the final match is still printed

---

# Environment Dependency Changes (relative to Base Env)

## Rust Toolchain
- rustc upgraded to 1.92.0
- cargo upgraded to 1.92.0
