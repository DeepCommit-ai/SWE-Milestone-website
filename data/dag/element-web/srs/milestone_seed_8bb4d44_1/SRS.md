# Software Requirements Specification: Element Call Bundle Integration

## Overview

This milestone bundles Element Call directly within Element Web packages, enabling offline and self-contained deployment of voice and video calling functionality. The implementation removes the external dependency on `call.element.io` and introduces a developer settings override mechanism.

### Requirements Summary

1. **FR1**: Bundle Element Call widget for local deployment
2. **FR2**: Add Developer.elementCallUrl setting for URL override
3. **FR3**: Conditional analytics integration based on user consent
4. **FR4**: Create SettingsField component for string-based settings

### Affected Modules

- Element Call widget URL generation
- Developer settings infrastructure
- Devtools dialog
- Widget capability authorization
- SDK configuration defaults

---

## Functional Requirements

### FR1: Bundle Element Call Widget for Local Deployment

**Problem**: Element Web currently requires an external Element Call instance at `call.element.io` for group voice/video calls, preventing offline or air-gapped deployments.

**Requirements**:
- Element Call widget assets shall be bundled within the Element Web distribution
- The default Element Call URL shall resolve to a local bundled path relative to the application base URL
- The `element_call.url` configuration option shall be removed from the SDK configuration interface
- The bundled Element Call shall function identically to the external hosted version

**Acceptance**:
- When a user initiates a call, the widget loads from the local bundled assets
- When Element Web is deployed without network access to external services, Element Call functionality remains available
- When the application configuration is examined, no `element_call.url` option exists
- The default Element Call URL shall be constructed as a relative path `./widgets/element-call/index.html#` from the application base URL (`window.location.href`)

---

### FR2: Developer.elementCallUrl Setting for URL Override

**Problem**: Developers and testers need the ability to override the default bundled Element Call URL for testing alternative Element Call deployments.

**Requirements**:
- A new developer setting `Developer.elementCallUrl` shall be available at the device level
- When this setting contains a non-empty value, Element Call shall load from the specified URL instead of the bundled default
- The setting shall be accessible through the Devtools dialog
- The setting shall have an appropriate display name for the UI

**Acceptance**:
- The setting shall be registered in `src/settings/Settings.tsx` with key `"Developer.elementCallUrl"` supporting `SettingLevel.DEVICE` with default value `""`
- The setting's `displayName` shall use the i18n key `"devtools|settings|elementCallUrl"` which resolves to "Element Call URL"
- A new type `StringSettingKey` shall be exported from `src/settings/Settings.tsx` to represent settings with string values
- When the setting has a non-empty value, Element Call shall load from that URL instead of the default bundled path
<!-- COMMENTED OUT - Implementation detail leak:
- `SettingsStore.getValue("Developer.elementCallUrl")` shall return the custom URL when set, which is used in `ElementCall.generateWidgetUrl()` to override the default bundled path
-->
- The Devtools dialog shall include a `<SettingsField>` component for `Developer.elementCallUrl` at `SettingLevel.DEVICE`, placed as the last item in the Options section (after `enableWidgetScreenshots`)

---

### FR3: Conditional Analytics Integration Based on User Consent

**Problem**: Analytics parameters are currently passed to Element Call regardless of the user's analytics consent status.

**Requirements**:
- Posthog analytics parameters (`analyticsID`, `posthogUserId`, `posthogApiHost`, `posthogApiKey`) shall only be passed to Element Call when:
  - Posthog is configured in the SDK configuration
  - The user has not disabled analytics (anonymity is not "Disabled")
- When `pseudonymousAnalyticsOptIn` is false or the analytics ID is not present in account data, an empty analytics ID shall be passed
- The rageshake submit URL shall be passed to Element Call when configured
- Sentry configuration shall only be passed when analytics consent is granted

**Acceptance**:
- Posthog parameters (`analyticsID`, `posthogUserId`, `posthogApiHost`, `posthogApiKey`) shall only be appended to the widget URL when Posthog is configured and analytics is not disabled
- The `analyticsID` value shall be:
  - The user's analytics ID if they have opted in to pseudonymous analytics
  - Empty string otherwise
- When the `feature_allow_screen_share_only_mode` setting is enabled, the `allowVoipWithNoMedia` URL parameter shall be set to `"true"`
<!-- COMMENTED OUT - Implementation detail leak:
- Posthog parameters shall only be appended when:
  - `SdkConfig.get("posthog")` returns a configuration object, AND
  - `PosthogAnalytics.instance.getAnonymity()` does not return `Anonymity.Disabled`
- The `analyticsID` value shall be determined by reading `client.getAccountData(PosthogAnalytics.ANALYTICS_EVENT_TYPE)?.getContent()`:
  - If `pseudonymousAnalyticsOptIn` is true and `id` exists, use the `id` value
  - Otherwise, use empty string `""`
-->

---

### FR4: SettingsField Component for String-Based Settings

**Problem**: The settings infrastructure lacks a reusable UI component for editing string-type settings with inline save/cancel functionality.

**Requirements**:
- A new SettingsField component shall support string-based settings
- The component shall display the setting's configured display name as its label
- The component shall provide save and cancel actions for editing
- The component shall persist changes through the SettingsStore
- The component shall support an onChange callback to notify parent components of saved values

**Acceptance**:
- The component shall be created at `src/components/views/elements/SettingsField.tsx` as a default export
- The component shall accept props: `settingKey: StringSettingKey`, `level: SettingLevel`, optional `roomId?: string`, optional `label?: string`, optional `isExplicit?: boolean`, and optional `onChange?(value: string): void`
- The label shall default to the setting's configured display name when the `label` prop is not provided
- When the user saves a change, the `onChange` callback shall be invoked with the new value after persisting to the settings store
- The component shall use Compound Web's inline edit component for the UI
<!-- COMMENTED OUT - Implementation detail leak:
- The label shall default to `SettingsStore.getDisplayName(settingKey, level)` when the `label` prop is not provided
- When the user saves a change, the `onChange` callback shall be invoked with the new value after persisting via `SettingsStore.setValue()`
- The component shall use `@vector-im/compound-web`'s `EditInPlace` component for the inline edit UI
-->

---

### FR5: Widget Capability Trust Model Update

**Problem**: The current Element Call widget trust model relies on origin-based URL matching against the configured `element_call.url`, which is incompatible with bundled deployment.

**Requirements**:
- Element Call widget trust shall be determined by widget type rather than URL origin matching
- Widgets with the Call type in Room context shall receive automatic capability grants (AlwaysOnScreen, MSC3846TurnServers, etc.)
- The trust model shall work correctly for both bundled and custom-URL Element Call instances

**Acceptance**:
- When an Element Call widget is created in a room, it automatically receives the required capabilities without origin URL comparison
- When using a custom Element Call URL via developer settings, the widget still receives automatic capability grants


---

# Environment Dependency Changes (relative to Base Env)

## Node.js Packages
- html-react-parser@5.2.2 added
