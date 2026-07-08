# Software Requirements Specification: Maintenance Infrastructure

## Overview

This milestone encompasses minor infrastructure maintenance and code quality improvements for the Element Web application, including:

1. **FR1**: Modernize null-coalescing patterns in location utilities
2. **FR2**: Update WYSIWYG editor component type annotations for nullable ref compatibility
3. **FR3**: Add test identifier to Quick Settings menu for E2E testing infrastructure
4. **FR4**: Update JSDoc documentation to use consistent terminology

<!-- REMOVED FROM ORIGINAL SRS (not matching actual Patch):
1. **FR1**: Update TypeScript compiler to v5.8.2 with required type annotation corrections
2. **FR2**: Update matrix-wysiwyg rich text editor dependency to v2.38.2 with API compatibility fixes
3. **FR3**: Add E2E test coverage for the Quick Settings dialog
4. **FR4**: Update localized translations from Localazy
-->

**Affected Modules**:
- Location event utilities
- WYSIWYG composer components
- Quick Settings UI component
- User identity warning component documentation

<!-- REMOVED FROM ORIGINAL SRS:
- Build toolchain and type system
- Internationalization (i18n) translation files
-->

---

## Requirements

### FR1: Modernize Null-Coalescing Patterns in Location Utilities

<!-- REMOVED FROM ORIGINAL SRS - FR1 was "TypeScript v5.8.2 Upgrade":
**Problem**: The project uses an outdated TypeScript version (5.7.3) that lacks recent type system improvements and stricter type checking.

**Requirements**:
- Update the TypeScript compiler dependency from v5.7.3 to v5.8.2
- Resolve any type errors introduced by stricter type checking in the new version
- Ensure `window.location` reassignment patterns in tests compile correctly with TypeScript 5.8.2's stricter DOM type checking
- Ensure null-coalescing patterns for optional property access compile correctly

**Acceptance**:
- When building the project with TypeScript 5.8.2, no type errors occur
- When running the test suite, all tests compile and pass
- When accessing optional properties in location utilities, the code uses modern null-coalescing patterns (`?.` and `??`)
-->

**Problem**: The location event geo URI utility uses legacy ternary patterns for null checking that can be modernized.

**Requirements**:
- Update the `locationEventGeoUri` function in `src/utils/location/locationEventGeoUri.ts` to use modern null-coalescing operators
- Replace ternary null check pattern with optional chaining (`?.`) and nullish coalescing (`??`) operators

**Acceptance**:
- When extracting geo URI from location event content, the code uses `loc?.uri ?? content["geo_uri"]` pattern
- When `loc` is undefined or null, the fallback to `content["geo_uri"]` works correctly

---

### FR2: Update WYSIWYG Editor Type Annotations

<!-- REMOVED FROM ORIGINAL SRS - FR2 was "Matrix WYSIWYG v2.38.2 Upgrade":
**Problem**: The matrix-wysiwyg rich text editor dependency is outdated at v2.38.0, missing bug fixes and improvements from newer versions.

**Requirements**:
- Update @vector-im/matrix-wysiwyg dependency from v2.38.0 to v2.38.2
- Update TypeScript type annotations to match the new API signatures in the updated library
-->

**Problem**: The WYSIWYG editor components have type annotations that need to accommodate nullable ref types for compatibility with updated React patterns.

**Requirements**:
- Update the `Editor` component's forwardRef type annotation in `src/components/views/rooms/wysiwyg_composer/components/Editor.tsx`
- Update the `useSetCursorPosition` hook parameter type in `src/components/views/rooms/wysiwyg_composer/hooks/useSetCursorPosition.ts`

**Acceptance**:
- The Editor component forwardRef type is `forwardRef<HTMLDivElement | null, EditorProps>`
- The useSetCursorPosition hook accepts `RefObject<HTMLDivElement | null>` as the ref parameter type

---

### FR3: Add Quick Settings Test Identifier

<!-- REMOVED FROM ORIGINAL SRS - FR3 was "Quick Settings E2E Test Coverage":
**Problem**: The Quick Settings menu dialog lacks end-to-end test coverage, making it difficult to detect visual regressions.

**Requirements**:
- Add a test identifier attribute to the Quick Settings menu component for automated testing
- Create an E2E test that verifies the Quick Settings menu renders correctly
- Include screenshot comparison testing for visual regression detection

**Acceptance**:
- When clicking the "Quick settings" button, the quick settings menu becomes visible
- When the quick settings menu is displayed, it can be located using a test identifier
- When the quick settings menu is rendered, its visual appearance matches the expected screenshot
-->

**Problem**: The Quick Settings menu lacks a test identifier attribute for automated E2E testing.

**Requirements**:
- Add a `data-testid` attribute to the Quick Settings menu component in `src/components/views/spaces/QuickSettingsButton.tsx`
- The test identifier should be placed on the context menu wrapper

**Acceptance**:
- The Quick Settings menu has `data-testid="quick-settings-menu"` attribute
- E2E tests can locate the menu using the test identifier

---

### FR4: Update User Identity Warning Documentation

<!-- REMOVED FROM ORIGINAL SRS - FR4 was "Localazy Translation Update":
**Problem**: Translations are out of sync with the latest localization updates from Localazy, and identity change messaging uses inconsistent terminology.

**Requirements**:
- Download and integrate the latest translations from Localazy
- Update English (en_EN) source strings for identity change warnings to use "was reset" instead of "has changed" or "appears to have changed" terminology
- Update all affected localized translations (Czech, German, French, Hungarian, Norwegian, Ukrainian) with the new identity reset messaging
- Ensure all identity-related warning messages use consistent terminology across:
  - User identity pinning warnings (pinned_identity_changed)
  - Verified identity change warnings (verified_identity_changed)
  - Event shield tooltips (sender_identity_previously_verified)
  - User identity warning component documentation

**Acceptance**:
- When a user's identity is reset, the warning message displays "identity was reset" instead of "identity has changed"
- When viewing identity warnings for verified users, the message indicates the identity "was reset"
- When hovering over an event shield for identity violations, the tooltip shows "Sender's verified identity was reset"
- When identity warnings appear, consistent "was reset" terminology is used across all languages
-->

**Problem**: The JSDoc documentation in the UserIdentityWarning component uses inconsistent terminology.

**Requirements**:
- Update the JSDoc comment in `src/components/views/rooms/UserIdentityWarning.tsx` to use "was reset" terminology instead of "has changed"

**Acceptance**:
- The component documentation describes warning behavior as "identity was reset" instead of "identity has changed"

---

## Non-Functional Requirements

- All changes must maintain backward compatibility with existing functionality
- No runtime behavior changes - modifications are limited to types, attributes, and documentation
- The build process must complete without errors

<!-- REMOVED FROM ORIGINAL SRS:
- Test suites must pass with the updated dependencies
- No breaking changes to the public API of affected components
-->

---

# Environment Dependency Changes (relative to Base Env)

## Node.js Packages
- axios@1.7.9 added
- strip-ansi@7.1.0 removed
