# Software Requirements Specification: React 19 JSX Import Migration

## Overview

This milestone ensures React 19 compatibility by updating JSX type imports across the codebase. The project uses TypeScript with React components that reference `JSX.IntrinsicElements` and other JSX-related types. React 19 changes how JSX types are exported, requiring explicit imports of the `JSX` namespace type from the React package.

### Requirements Summary

1. **FR1**: Add explicit JSX type imports to all files that reference JSX namespace types
2. **FR2**: Standardize React import syntax for consistency

### Affected Modules

- Core type definitions (`src/@types/`)
- Component structures (`src/components/structures/`)
- View components (`src/components/views/`)
- Utility components (`src/components/utils/`)
- Context providers (`src/contexts/`)
- Accessibility utilities (`src/accessibility/`)
- Authentication flows (`src/components/structures/auth/`, `src/components/views/auth/`)
- Async-loaded components (`src/async-components/`)
- Event handling (`src/events/`)
- Toast notifications (`src/toasts/`)
- Export utilities (`src/utils/exportUtils/`)

---

## Functional Requirements

### FR1: Explicit JSX Type Imports

**Problem**: TypeScript files that use `JSX.IntrinsicElements`, `JSX.Element`, or other types from the JSX namespace fail to compile with React 19's updated type definitions, as the global JSX namespace is no longer automatically available.

**Requirements**:
- All TypeScript/TSX files that reference types from the JSX namespace must import `type JSX` explicitly from the `react` package
- The import must be added to the existing React import statement where present
- Files using `JSX.IntrinsicElements` in type definitions must include the explicit JSX type import
- Files with function return type annotations using JSX types must include the explicit JSX type import

**Acceptance**:
- When building the project with React 19 type definitions, all files compile without JSX namespace resolution errors
- Type checking passes for all components that use JSX namespace types in their signatures
- Components using dynamic element types with `JSX.IntrinsicElements` constraints compile correctly

### FR2: React Import Syntax Standardization

**Problem**: Some files use the namespace import pattern `import * as React from "react"` while others use the default import pattern `import React from "react"`. The namespace import pattern is deprecated for React 19 compatibility.

**Requirements**:
- Files using `import * as React from "react"` must be updated to use `import React from "react"`
- When a file imports both React and named exports, they should be combined into a single import statement
- Files with separate React namespace import and named imports from react must consolidate into a single import statement

**Acceptance**:
- When building the project, no files use the `import * as React` namespace import pattern
- All React imports follow the standard default import pattern with optional named imports
- Combined imports maintain proper formatting with type annotations where applicable


---

# Environment Dependency Changes (relative to Base Env)

## Node Packages
- @babel/code-frame upgraded to 7.26.2
- @babel/core upgraded to 7.26.10
- @babel/eslint-parser upgraded to 7.26.10
- @babel/eslint-plugin upgraded to 7.26.10
- @babel/generator upgraded to 7.26.10
- @babel/helpers upgraded to 7.26.10
- @babel/plugin-proposal-private-methods@7.18.6 added
- @babel/plugin-transform-runtime upgraded to 7.26.10
- @babel/runtime upgraded to 7.26.10
- @babel/traverse upgraded to 7.26.10
- @babel/types upgraded to 7.26.10
- @element-hq/element-web-playwright-common@1.1.5 added
- @eslint-community/eslint-utils upgraded to 4.5.1
- @fontsource/inconsolata upgraded to 5.2.5
- @fontsource/inter upgraded to 5.2.5
- @keyv/serialize upgraded to 1.0.3
- @matrix-org/analytics-events upgraded to 0.29.2
- @playwright/test upgraded to 1.51.1
- @sentry/babel-plugin-component-annotate upgraded to 3.2.2
- @sentry/browser upgraded to 9.6.0
- @sentry/bundler-plugin-core upgraded to 3.2.2
- @sentry/cli upgraded to 2.42.2
- @sentry/cli-darwin upgraded to 2.42.2
- @sentry/cli-linux-arm upgraded to 2.42.2
- @sentry/cli-linux-arm64 upgraded to 2.42.2
- @sentry/cli-linux-i686 upgraded to 2.42.2
- @sentry/cli-linux-x64 upgraded to 2.42.2
- @sentry/cli-win32-i686 upgraded to 2.42.2
- @sentry/cli-win32-x64 upgraded to 2.42.2
- @sentry/core upgraded to 9.6.0
- @sentry/webpack-plugin upgraded to 3.2.2
- @sentry-internal/browser-utils upgraded to 9.6.0
- @sentry-internal/feedback upgraded to 9.6.0
- @sentry-internal/replay upgraded to 9.6.0
- @sentry-internal/replay-canvas upgraded to 9.6.0
- @testcontainers/postgresql upgraded to 10.19.0
- @types/dockerode upgraded to 3.3.35
- @types/lodash upgraded to 4.17.16
- @types/node upgraded to 18.19.80
- @types/prop-types upgraded to 15.7.14
- @types/react-virtualized upgraded to 9.22.2
- @typescript-eslint/eslint-plugin upgraded to 8.26.1
- @typescript-eslint/parser upgraded to 8.26.1
- @typescript-eslint/scope-manager upgraded to 8.26.1
- @typescript-eslint/type-utils upgraded to 8.26.1
- @typescript-eslint/types upgraded to 8.26.1
- @typescript-eslint/typescript-estree upgraded to 8.26.1
- @typescript-eslint/utils upgraded to 8.26.1
- @typescript-eslint/visitor-keys upgraded to 8.26.1
- @vector-im/compound-design-tokens upgraded to 4.0.1
- @vector-im/compound-web upgraded to 7.9.0
- @vector-im/matrix-wysiwyg upgraded to 2.38.2
- acorn upgraded to 8.14.1
- axios upgraded to 1.8.1
- babel-loader upgraded to 10.0.0
- babel-plugin-polyfill-corejs3 upgraded to 0.11.1
- bare-os upgraded to 3.6.0
- cacheable upgraded to 1.8.9
- caniuse-lite upgraded to 1.0.30001704
- copy-webpack-plugin upgraded to 13.0.0
- core-js upgraded to 3.41.0
- core-js-compat upgraded to 3.41.0
- cronstrue upgraded to 2.56.0
- css-minimizer-webpack-plugin upgraded to 7.0.2
- dom-serializer upgraded to 2.0.0
- domhandler upgraded to 5.0.3
- domutils upgraded to 3.2.2
- electron-to-chromium upgraded to 1.5.120
- eslint-config-prettier upgraded to 10.1.1
- eslint-plugin-react-compiler upgraded to 19.0.0-beta-e552027-20250112
- eslint-plugin-react-hooks upgraded to 5.2.0
- eslint-visitor-keys upgraded to 4.2.0
- fastq upgraded to 1.19.1
- file-entry-cache upgraded to 10.0.7
- foreground-child upgraded to 3.3.1
- form-data upgraded to 4.0.2
- hookified upgraded to 1.8.1
- html-dom-parser@5.0.13 added
- html-react-parser@5.2.2 added
- inline-style-parser@0.2.4 added
- knip upgraded to 5.46.0
- lint-staged upgraded to 15.5.0
- lodash-es@4.17.21 added
- mailpit-api upgraded to 1.2.0
- maplibre-gl upgraded to 5.2.0
- matrix-js-sdk upgraded to 37.2.0
- nan upgraded to 2.22.2
- oidc-client-ts upgraded to 3.2.0
- playwright upgraded to 1.51.1
- playwright-core upgraded to 1.51.1
- postcss-calc upgraded to 10.1.1
- prettier upgraded to 3.5.3
- re-resizable upgraded to 6.11.2
- react-property@2.0.2 added
- react-string-replace@1.1.1 added
- reusify upgraded to 1.1.0
- strip-ansi downgraded to 6.0.1
- style-to-js@1.1.16 added
- style-to-object@1.0.8 added
- stylelint upgraded to 16.16.0
- stylelint-scss upgraded to 6.11.1
- terser-webpack-plugin upgraded to 5.3.14
- testcontainers upgraded to 10.21.0
- tinyglobby upgraded to 0.2.12
- typescript upgraded to 5.8.2
- update-browserslist-db upgraded to 1.1.3
- uuid upgraded to 11.1.0
- common-path-prefix removed
- find-cache-dir removed
- linkify-element removed
- @sindresorhus/merge-streams removed
- unicorn-magic removed
