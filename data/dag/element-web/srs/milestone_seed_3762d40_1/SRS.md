# Software Requirements Specification: Enhanced Rageshake Error Reporting

## Overview

This milestone improves the bug report (rageshake) upload experience by providing actionable, user-friendly error information when uploads fail. Currently, when a rageshake upload fails, users receive only a generic HTTP error code with no explanation of why the submission was rejected or how to resolve the issue.

### Requirements Summary

1. **FR1**: Implement structured error handling for rageshake server responses
2. **FR2**: Display human-readable error messages for known rejection reasons
3. **FR3**: Support policy URL display when the server provides additional information
4. **FR4**: Handle unknown and unexpected error responses gracefully
5. **FR5**: Support request timeout with cancellation

### Affected Modules

- Rageshake submission module
- Bug report dialog component
- Internationalization strings

---

## Requirements

### FR1: Structured Error Handling for Rageshake Responses

**Problem**: When bug report uploads fail, the rageshake submission module throws a generic `Error` with only an HTTP status code, providing no structured information about why the server rejected the report.

**Requirements**:
- Create a dedicated error class that captures structured error information from the rageshake server response
- The error class must include: machine-readable error code, human-readable error message, HTTP status code, and optional policy URL
- Parse JSON error responses from the rageshake server to extract `errcode`, `error`, and `policy_url` fields
- Throw the structured error when the server responds with a 4xx or 5xx status code containing error information
- Validate response Content-Type before parsing to ensure proper JSON handling

**Acceptance**:
- A `RageshakeError` class must be created and exported from the rageshake submission module
- `RageshakeError` must expose public readonly properties: `errorcode`, `error`, `statusCode`, and `policyURL`
- When the rageshake server responds with a JSON error body containing `errcode` and `error` fields, the submission throws a `RageshakeError` with `errorcode` set to the `errcode` value from the response
- When the rageshake server responds with a `policy_url` in the error body, the `policyURL` property on the thrown `RageshakeError` is set to that value
- When the rageshake server responds with an unexpected Content-Type, a `RageshakeError` with `errorcode` set to `"UNKNOWN"` is thrown

---

### FR2: Human-Readable Error Messages for Known Rejection Reasons

**Problem**: Users receive unhelpful error messages like "HTTP 400" when their bug reports are rejected, leaving them unable to understand or address the issue.

**Requirements**:
- Map known rageshake error codes to user-friendly, localized error messages
- Support the following specific error codes with distinct messages:
  - `DISALLOWED_APP`: Application not supported by the rageshake server
  - `REJECTED_BAD_VERSION`: Application version is too old
  - `REJECTED_UNEXPECTED_RECOVERY_KEY`: Report rejected due to containing sensitive recovery key data
- Provide a generic rejection message for other `REJECTED_*` error codes
- Provide a fallback message for unknown server errors
- Provide a fallback message for non-rageshake errors (network failures, etc.)

**Acceptance**:
- The dialog must detect rageshake-specific errors and check the error code to determine which message to display
- When upload fails with `errorcode === "DISALLOWED_APP"`, the dialog displays: "Your bug report was rejected. The rageshake server does not support this application."
- When upload fails with `errorcode === "REJECTED_BAD_VERSION"`, the dialog displays: "Your bug report was rejected as the version you are running is too old."
- When upload fails with `errorcode === "REJECTED_UNEXPECTED_RECOVERY_KEY"`, the dialog displays: "Your bug report was rejected for safety reasons, as it contained a recovery key."
- When upload fails with any other rejection-type error code, the dialog displays: "Your bug report was rejected. The rageshake server rejected the contents of the report due to a policy."
- When upload fails with an unknown error code, the dialog displays: "The rageshake server encountered an unknown error and could not handle the report."
- When upload fails with a non-rageshake error, the dialog displays: "Failed to send logs."
- All error messages must be localized using the i18n system under the key namespace `bug_reporting|failed_send_logs_causes`
<!-- COMMENTED OUT - Implementation detail:
- Import `RageshakeError` and use `instanceof RageshakeError` to detect rageshake-specific errors
- Check `errorcode?.startsWith("REJECTED")` for generic rejection handling
-->

---

### FR3: Policy URL Display

**Problem**: Some rageshake rejection responses include a policy URL with additional information, but this URL is not displayed to users.

**Requirements**:
- When a rageshake error includes a policy URL, display a "Learn more" link to the user
- The link must open in a new browser tab
- The link should only appear when a policy URL is actually provided in the error response

**Acceptance**:
- When a `RageshakeError` has a truthy `policyURL` property, the dialog must render a "Learn more" link with `href` set to the `policyURL` value
- The "Learn more" link must open in a new tab (e.g., using `target="_blank"`)
- When the `policyURL` property is `undefined` or falsy, no "Learn more" link is displayed

---

### FR4: Graceful Handling of Unexpected Responses

**Problem**: The system should handle edge cases where the rageshake server responds with unexpected formats or missing data.

**Requirements**:
- Handle responses with non-JSON Content-Type by throwing an appropriate error
- Handle error responses that lack the expected `errcode` field
- Ensure successful responses (2xx status) return the report URL from the response

**Acceptance**:
- When the server responds with a success status and JSON containing `report_url`, that URL is returned from `sendBugReport()`
- When the server responds with a non-JSON Content-Type on error, a `RageshakeError` with `errorcode === "UNKNOWN"` is thrown
- When the server responds with a 4xx/5xx status but no `errcode` in the body, a `RageshakeError` with `errorcode === "UNKNOWN"` is thrown

---

### FR5: Request Timeout with Cancellation

**Problem**: Bug report uploads can hang indefinitely if the server is unresponsive, leaving users waiting without feedback. The current implementation lacks proper timeout handling.

**Requirements**:
- The HTTP request must have a reasonable timeout to avoid hanging indefinitely
- The submission function should use modern Promise-based async patterns

**Acceptance**:
- The rageshake submission request must be configured with a timeout mechanism
- If the request times out, the Promise is rejected with an appropriate error
- The submission function must use async/await pattern and return a Promise

---

# Environment Dependency Changes (relative to Base Env)

## Node Packages
- @vector-im/matrix-wysiwyg upgraded to 2.38.2
- re-resizable upgraded to 6.11.2
- babel-loader upgraded to ^10.0.0
- copy-webpack-plugin upgraded to ^13.0.0
- prettier upgraded to 3.5.2
- typescript upgraded to 5.8.2
