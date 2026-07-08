# Software Requirements Specification: React DOM Rendering Modernization

## Overview

This milestone modernizes the React DOM rendering approach for message content in the Element Web application. The current implementation uses legacy patterns that directly manipulate the DOM after rendering, creating separate React roots for pills, tooltips, spoilers, and code blocks. This approach leads to:

- Complex lifecycle management with manual mounting/unmounting of React subtrees
- Deprecated React patterns (legacy context access in constructors)
- Tight coupling between DOM manipulation utilities and rendering logic
- Maintenance burden from scattered rendering logic across multiple utility files

### Requirements Summary

1. **FR1**: Create a unified `EventContentBody` component with declarative rendering for message content
2. **FR2**: Implement a composable renderer module for transforming HTML content into React components
3. **FR3**: Remove legacy DOM manipulation utilities for pills, tooltips, and spoilers
4. **FR4**: Eliminate deprecated constructor patterns that access legacy React context
5. **FR5**: Centralize PushProcessor access through MatrixClient instance
6. **FR6**: Fix RightPanel component state initialization with getDerivedStateFromProps

### Affected Modules

- `src/components/views/messages/` - Message body rendering components
- `src/components/views/elements/` - Pill and Spoiler components
- `src/renderer/` - New renderer module (to be created)
- `src/HtmlUtils.tsx` - HTML rendering utilities
- `src/Linkify.tsx` - Link processing utilities
- `src/utils/` - Various utility files
- Multiple component constructors across the codebase

---

## Functional Requirements

### FR1: Unified Event Content Body Component

**Problem**: Message content rendering is scattered across multiple locations with DOM manipulation happening after React's render cycle, causing complexity in managing React subtrees for pills, code blocks, spoilers, and link tooltips.

**Requirements**:
- Create a new `EventContentBody` component that renders Matrix event message content declaratively
- Support rendering content as either a `div` or `span` element based on context
- Accept the Matrix event and content as props, along with optional rendering flags
- Parse formatted HTML content using a declarative approach instead of post-render DOM manipulation
- Support the following rendering features through configuration props:
  - Mention pills for user/room references
  - Keyword pills for push notification keywords
  - Spoiler content that reveals on click
  - Syntax-highlighted code blocks with copy functionality
  - Tooltips for ambiguous links (links where displayed text differs from href)
- Integrate with the existing linkification system for plain text content
- Memoize the component to prevent unnecessary re-renders
- Access MatrixClient from React context rather than global singleton

**Acceptance**:
- When rendering a message with `@room` mention and the push rule matches, the mention appears as a pill component
- When rendering a message with a user permalink, the link displays as a user pill with avatar
- When rendering formatted HTML with `<span data-mx-spoiler>` elements, spoiler content is hidden until clicked
- When rendering code blocks in formatted HTML, syntax highlighting is applied and a copy button is available
- When rendering links where href differs from link text, a tooltip displays the full URL on hover (on platforms requiring URL tooltips)

---

### FR2: Composable Renderer Module

**Problem**: Post-render DOM traversal and manipulation to inject React components is error-prone, creates lifecycle management complexity, and makes the rendering logic difficult to maintain and test.

**Requirements**:
- Create a new `src/renderer/` module with composable rendering functions
- Implement renderer functions as objects mapping tag names to transformation functions
- Each renderer function should accept a DOM node and return a React element or undefined
- Provide a utility that merges multiple renderers into a single replacer function for use with html-react-parser
- Implement renderers for the following content types:
  - Mention pills: Transforms anchor elements pointing to Matrix permalinks into the existing Pill component, and transforms `@room` text nodes into AtRoomMention pills when push rules match
  - Keyword pills: Transforms text nodes containing push notification keywords into keyword pills using the existing Pill component
  - Ambiguous link tooltips: Wraps anchors where href differs from text content with tooltip triggers
  - Spoilers: Transforms spans with `data-mx-spoiler` attribute into the existing Spoiler component
  - Code blocks: Transforms `pre` elements into the existing CodeBlock component
- Support passing context parameters (room, event, settings) to renderers
- Provide utilities to apply renderers to both parsed HTML and plain text strings
- Enable integration with the linkify-react library through a render function adapter

**Acceptance**:
- The renderer module exports functions for each content type and a utility to combine them
- When combining multiple renderers, they are applied in order until one returns a transformed element
- When the mention pill renderer encounters an anchor with a Matrix permalink href, it renders using the existing Pill component if either: (1) the href matches the anchor's text content (plain text messages where linkify created the anchor from a permalink URL), or (2) the content is HTML formatted (where the anchor was created by the composer or original message). This ensures plain text identifiers like `@user:example.com` or `#room:example.com` are linkified but not pillified, while explicit permalink URLs are pillified
- When the keyword pill renderer encounters text matching the keyword pattern, it renders a keyword pill
- When the spoiler renderer encounters a span with `data-mx-spoiler` attribute, it renders using the existing Spoiler component
- When the code block renderer encounters a `pre` element, it renders using the existing CodeBlock component

<!-- REMOVED - Implementation details that leak API design:
- The module must export from `src/renderer/index.ts`:
  - `mentionPillRenderer`: RendererMap for anchor elements and `@room` text nodes
  - `keywordPillRenderer`: RendererMap for keyword text nodes
  - `ambiguousLinkTooltipRenderer`: RendererMap for ambiguous anchor elements
  - `spoilerRenderer`: RendererMap for spoiler span elements
  - `codeBlockRenderer`: RendererMap for pre elements
  - `combineRenderers`: function that combines multiple RendererMap objects
  - `RendererMap`: type definition for renderer objects
  - `Replacer`: type for html-react-parser replace functions
  - `applyReplacerOnString`: utility function
  - `replacerToRenderFunction`: adapter for linkify-react
- `RendererMap` type must map tag names (lowercase strings) or `Node.TEXT_NODE` to replacer functions
- `combineRenderers(...renderers: RendererMap[]): (parameters: Parameters) => Replacer` - returns a function that accepts a parameters object and returns a Replacer for html-react-parser
- The parameters object passed to `combineRenderers(...)({...})` must include:
  - `isHtml: boolean` (required) - whether the content is HTML
  - `mxEvent?: MatrixEvent` - required for mentionPillRenderer
  - `room?: Room` - required for mentionPillRenderer
  - `keywordRegexpPattern?: RegExp` - required for keywordPillRenderer
  - `shouldShowPillAvatar?: boolean` - optional for mentionPillRenderer
  - `onHeightChanged?: () => void` - optional callback
- When the keyword pill renderer encounters text matching the keyword pattern, it returns a keyword pill wrapped in `<bdi>` with a `<span tabindex="0">` wrapper
-->

---

### FR3: Remove Legacy DOM Manipulation Utilities

**Problem**: The `pillifyLinks`, `tooltipifyLinks`, and `ReactRootManager` utilities manage separate React trees by directly manipulating the DOM, which is deprecated, fragile, and incompatible with React 18 strict mode.

**Requirements**:
- Remove the `pillifyLinks` function from `src/utils/pillify.tsx`
- Remove the `tooltipifyLinks` function from `src/utils/tooltipify.tsx`
- Remove the `ReactRootManager` class from `src/utils/react.tsx`
- Remove the `linkifyElement` function and its dependency on `linkify-element` package
- Remove the `linkify-element` package dependency from package.json
- Update components that previously used these utilities to use the new declarative rendering approach
- Remove deprecated helper functions from the Pill component (`pillRoomNotifPos`, `pillRoomNotifLen`)
- Remove legacy `bodyToDiv` and `bodyToSpan` functions from HtmlUtils in favor of the new `EventContentBody` component
- Export the `bodyToNode` function from HtmlUtils for use by the new renderer

**Acceptance**:
- The `bodyToNode` function must be exported from `src/HtmlUtils.tsx` and return an object containing the parsed body content, formatted body (if HTML), emoji elements (if applicable), and appropriate CSS class names
- When the application builds, no imports reference `pillifyLinks`, `tooltipifyLinks`, or `ReactRootManager`
- When the application runs, pills render correctly in message content without DOM manipulation
- When editing a message containing pills, the pills re-render correctly without duplicate roots
- When the `linkify-element` package is removed from dependencies, the build succeeds

<!-- REMOVED - Implementation details that leak function signatures:
- `bodyToNode(content: IContent, highlights: Optional<string[]>, opts?: EventRenderOpts): BodyToNodeReturn` must be exported from `src/HtmlUtils.tsx`
- `EventRenderOpts` must include optional properties: `highlightLink?: string`, `disableBigEmoji?: boolean`, `stripReplyFallback?: boolean`, `forComposerQuote?: boolean`
- `BodyToNodeReturn` type must include:
  - `strippedBody: string` - the plain text body
  - `formattedBody?: string` - sanitized HTML if the content has HTML formatting
  - `emojiBodyElements: JSX.Element[] | undefined` - emoji elements for non-HTML emoji-only content
  - `className: string` - CSS class string including `mx_EventTile_body` and conditionally `mx_EventTile_bigEmoji` and `markdown-body`
-->

---

### FR4: Eliminate Legacy Context Access in Constructors

**Problem**: Multiple class components pass the React context as a second argument to the constructor and call `super(props, context)`. This is a legacy pattern that generates React warnings about `getDerivedStateFromProps` and deprecated lifecycle usage.

**Requirements**:
- Update class component constructors to only accept `props` parameter
- Call `super(props)` instead of `super(props, context)` in constructors
- Access context values through `this.context` after construction rather than in the constructor
- Ensure context-dependent initialization is moved to `componentDidMount` or handled via `getDerivedStateFromProps` where appropriate
- Apply this change to all affected components in the codebase

**Acceptance**:
- When React strict mode is enabled, no warnings about legacy context API usage appear in console
- When components mount, they correctly access context values through `this.context`
- When the application renders, all affected components function identically to before

---

### FR5: Centralize PushProcessor Access

**Problem**: Multiple locations instantiate `new PushProcessor(client)` to access push rule functionality, when the MatrixClient already exposes a `pushProcessor` property that should be reused.

**Requirements**:
- Replace `new PushProcessor(client)` instantiations with `client.pushProcessor` access
- Update the following areas to use the centralized PushProcessor:
  - Push notification enabled check utilities
  - Call handler incoming call rule lookup
  - Pillfiy/mention detection for `@room` notifications
  - Push rule synchronization monitoring
  - Push rule action updates
- Remove unused PushProcessor imports after migration
- Ensure test utilities provide mock `pushProcessor` property on mock clients

**Acceptance**:
- When checking if push notifications are disabled, the client's pushProcessor is used
- When handling incoming calls, the push rule is retrieved from client.pushProcessor
- When detecting `@room` mentions, the push rule matching uses client.pushProcessor
- When tests create mock clients, they include a mock pushProcessor property

---

### FR6: Fix RightPanel State Initialization

**Problem**: The RightPanel component relies on `getDerivedStateFromProps` for state derivation but the constructor was removed during context cleanup, causing React to error because initial state is undefined.

**Requirements**:
- Add a constructor to RightPanel that initializes state by calling `getDerivedStateFromProps(props)`
- Ensure the component has valid initial state before the first render

**Acceptance**:
- When the RightPanel component mounts, it has valid initial state
- When the RightPanel receives new props, the state updates correctly via getDerivedStateFromProps
- When viewing the right panel in the application, no React errors about undefined state appear

---

### FR7: Update Spoiler Component Interface

**Problem**: The Spoiler component accepts `contentHtml` as a string and uses `dangerouslySetInnerHTML`, which is incompatible with the new declarative rendering approach.

**Requirements**:
- Change the Spoiler component to accept `children` prop of type `ReactNode` instead of `contentHtml` string
- Remove the `dangerouslySetInnerHTML` usage from the component
- Render children directly within the spoiler content span
- Update all callers to pass React elements as children

**Acceptance**:
- Spoiler component accepts children as ReactNode and renders them within the spoiler
- When rendering a spoiler in message content, the spoiler displays with its children as React elements
- When clicking a hidden spoiler, the content is revealed correctly
- When the spoiler content contains nested elements, they render properly

<!-- REMOVED - CSS class names already exist in current Spoiler component, Agent should discover from codebase:
- Spoiler component props interface must be: `{ reason?: string; children: ReactNode }`
- The spoiler must render with CSS class `mx_EventTile_spoiler` on the button element
- The reason (if provided) must render in a span with class `mx_EventTile_spoiler_reason`
- The content must render in a span with class `mx_EventTile_spoiler_content`
-->

---

### FR8: Update CodeBlock Component Interface

**Problem**: The CodeBlock component accepts an `HTMLElement` as children and extracts content using DOM APIs, which is incompatible with declarative rendering.

**Requirements**:
- Change the CodeBlock component to accept a parsed node prop from html-react-parser instead of HTMLElement
- Use the parser's utility functions to extract content from the parsed node
- Convert the parsed node's children to React elements for rendering
- Ensure code elements are added if missing from the source
- Wrap the component output in a container div for styling

**Acceptance**:
- CodeBlock component accepts the parsed `pre` element from html-react-parser
- When rendering a code block in message content, the block displays with line numbers (if enabled)
- When syntax highlighting is enabled and a language is detected, the code is highlighted
- When clicking the copy button, the code text is copied to clipboard
- When the code block exceeds the line threshold, collapse/expand functionality works

<!-- REMOVED - Implementation details:
- CodeBlock component props interface must be: `{ preNode: Element; onHeightChanged?(): void }` where `Element` is from `html-react-parser`
- The component must render a wrapper div with class `mx_EventTile_pre_container`
-->

---

### FR9: Update Pill Component Context Usage

**Problem**: The Pill component creates its own `MatrixClientContext.Provider` wrapper and uses `MatrixClientPeg.safeGet()` directly, which is unnecessary when rendered within an existing context and prevents proper context inheritance.

**Requirements**:
- Remove the internal `MatrixClientContext.Provider` wrapper from the Pill component
- Use `useContext(MatrixClientContext)` to access the client instead of `MatrixClientPeg.safeGet()`
- Ensure Pill components are always rendered within a MatrixClientContext provider
- Update tests to provide appropriate context wrappers

**Acceptance**:
- When rendering a Pill component, it uses the MatrixClient from context
- Pill components render with appropriate styling for different pill types (room mentions, user mentions, keywords, etc.)
- Pill components are wrapped in a `<bdi>` element for bidirectional text isolation
- When tests render Pill components, they provide the necessary context

<!-- REMOVED - CSS class names already exist in current Pill component, Agent should discover from codebase:
- Pill components must render with base CSS class `mx_Pill` and type-specific classes:
  - `mx_AtRoomPill` for `@room` mentions
  - `mx_UserPill` for user mentions
  - `mx_UserPill_me` when the pill references the current user
  - `mx_RoomPill` for room mentions
  - `mx_KeywordPill` for keyword pills
  - `mx_EventPill` for event permalinks
- Pill text content must render in a span with class `mx_Pill_text`
-->

---

### FR10: Update usePermalinkMember Hook Context Usage

**Problem**: The `usePermalinkMember` hook accesses `SdkContextClass.instance` directly (a global singleton) instead of using React context, which makes testing difficult and violates React patterns.

**Requirements**:
- Update `usePermalinkMember` to access `SDKContext` via `useContext` hook
- Pass the context to helper functions that need it
- Update the dependency array of effects to include context

**Acceptance**:
- When a permalink member is resolved, the SDK context is accessed from React context
- When the user profile store is queried, it uses the context-provided store
- When tests run, they can provide mock context values


---

# Environment Dependency Changes (relative to Base Env)

## Node Packages
- linkify-element 4.1.4 added (explicit env patch for START state missing dependency)
