# Software Requirements Specification: Overlay List Active Status

## Overview

This specification defines requirements for enhancing the `overlay list` command to provide comprehensive overlay state information. The change affects the following areas:

1. **FR1**: Modify `overlay list` output format to return a table with overlay name and active status, including hidden overlays
2. **FR2**: Define consistent ordering for overlays in the output
3. **FR3**: Fix `overlay use` to correctly register modules in scoped contexts

**Affected Modules**:
- `overlay list` command (`crates/nu-cmd-lang/src/core_commands/overlay/list.rs`) - Table format output implementation
- `overlay use` command (`crates/nu-cmd-lang/src/core_commands/overlay/use_.rs`) - Fix for scoped module name handling
- `overlay hide` command (`crates/nu-cmd-lang/src/core_commands/hide.rs`) - Minor documentation update

---

## Requirements

### FR1: Return Table Format with Name and Active Status

**Problem**: The `overlay list` command currently returns only a list of strings containing active overlay names. Users cannot:
1. Determine the active/hidden state of overlays without additional commands
2. Track which overlays exist in the current session versus which are currently active
3. See overlays that have been hidden via `overlay hide`

**Requirements**:
- The `overlay list` command shall return a table instead of a plain list of strings
- Each row in the table shall contain:
  - A `name` column (string type) with the overlay name
  - An `active` column (boolean type) indicating whether the overlay is currently active
- The table shall include all overlays known to the engine state, not just active overlays
- Active overlays shall have `active` set to `true`
- Hidden overlays (those hidden via `overlay hide`) shall have `active` set to `false`
- The command's input/output type signature shall be updated accordingly
- The command description shall be updated to reflect the new behavior

**Acceptance**:
- The output of `overlay list` is a table with columns named `name` (String) and `active` (Bool)
- Active overlays appear with `active` equal to `true`
- Hidden overlays (after `overlay hide`) appear with `active` equal to `false`
- The table can be filtered by `active` field to separate active and hidden overlays
- Individual overlay records can be accessed by index (e.g., `overlay list | get 1`)

---

### FR2: Consistent Ordering of Overlays

**Problem**: Users need predictable ordering to retrieve the topmost active overlay from the list.

**Requirements**:
- Hidden (inactive) overlays shall be listed first in the output
- Active overlays shall follow hidden overlays, listed in the order they were activated
- The last entry in the list shall correspond to the most recently activated (topmost) overlay

**Acceptance**:
- In default state, `overlay list | last` returns the default overlay
- After activating an overlay, `overlay list | last` returns the most recently activated overlay
- Hidden overlays appear before active overlays in the list
- With multiple overlays, the activation order is preserved among active overlays

---

### FR3: Fix Scoped Module Registration in `overlay use`

**Problem**: The `overlay use` command fails to correctly register modules that are defined within scoped contexts (e.g., inside `do { }` blocks). When a module is defined and used within the same scope, the overlay lookup cannot find the module.

**Requirements**:
- The `overlay use` command shall correctly find and register modules defined in the current scope
- Quote trimming on module names shall not interfere with module lookup in scoped contexts
- The fix shall preserve correct behavior for modules defined in global contexts

**Acceptance**:
- When defining a module inside a `do` block and immediately using it with `overlay use`, the overlay is correctly registered
- When running `overlay list | last | get name` inside a `do` block after using a scoped module, the correct overlay name is returned
- When using quoted module names (single or double quotes) with `overlay use`, the overlay is correctly registered and can be hidden

---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
