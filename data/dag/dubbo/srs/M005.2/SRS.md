# Software Requirements Specification: Affinity Router Config-Based Implementations

## Overview

This specification defines requirements for implementing configuration-based affinity router components that enable dynamic affinity routing through the config center. The implementation provides session stickiness patterns with both service-level and application-level granularity.

**Requirements Summary**:
1. FR1: Implement listenable state router base for affinity routing with dynamic configuration support
2. FR2: Implement service-level affinity routing with config center integration
3. FR3: Implement application-level affinity routing for provider applications
4. FR4: Implement router factory components for SPI extension activation

**Affected Modules**:
- `dubbo-cluster` - Router implementations and factory classes

---

## Requirements

### FR1: Listenable State Router Base for Affinity Routing

**Problem**: The affinity routing feature lacks support for dynamic configuration changes from the config center, requiring static configuration that cannot be updated at runtime.

**Requirements**:
- Implement an abstract state router that listens to configuration changes from the config center
- The router must subscribe to configuration keys with the suffix `.affinity-router`
- The router must process configuration change events including additions, updates, and deletions
- When a configuration is deleted, the router must clear the current affinity routing rules
- When a configuration is added or modified, the router must parse the affinity rule and generate routing conditions
- The router must support parsing affinity rules that include:
  - An affinity key specifying the routing dimension
  - A ratio parameter controlling the threshold for affinity matching
  - An enabled flag to enable/disable the routing rule
- The router must delegate actual routing logic to an internal affinity state router when rules are configured
- The router must return invokers unchanged when no affinity router is configured or when invokers list is empty
- The router must implement the `ConfigurationListener` interface to receive configuration updates
- The router must clean up configuration listeners when stopped

**Acceptance**:
- When a new affinity rule configuration is pushed to the config center, the router parses and applies the rule immediately
- When an existing affinity rule configuration is modified, the router updates its routing behavior accordingly
- When an affinity rule configuration is deleted from the config center, the router stops applying affinity-based filtering
- When the router receives an empty or invalid rule, it logs an error and the rule does not take effect
- When the router is stopped, it removes its listener from the rule repository

---

### FR2: Service-Level Affinity State Router

**Problem**: There is no service-level affinity routing that allows configuration of session stickiness on a per-service basis using the service's unique identifier.

**Requirements**:
- Implement a service-level affinity router that extends the listenable state router base
- The router must derive its rule key from the service's unique name using `DynamicConfiguration.getRuleKey(url)`
- The router must automatically subscribe to configuration updates for the pattern `{service-unique-name}.affinity-router`
- The router must apply affinity routing rules specific to the individual service being invoked

**Acceptance**:
- When a service-level affinity rule exists in the config center with key `{service-name}.affinity-router`, the router applies that rule to invocations of that service
- When multiple services have different affinity rules, each service router applies only its own service-specific rule

---

### FR3: Application-Level Affinity Provider Router

**Problem**: There is no application-level affinity routing that allows configuration of session stickiness based on the provider application, supporting cross-service affinity within a provider application.

**Requirements**:
- Implement an application-level affinity router for provider applications
- The router must dynamically determine the provider application from the invoker list on notification
- The router must subscribe to configuration updates for the pattern `{provider-application}.affinity-router`
- The router must handle provider application discovery by extracting the remote application from invoker URLs
- The router must not subscribe to its own consumer application's rules (skip when provider application equals current application)
- The router must log a warning when the provider application cannot be determined from invokers
- The router must manage listener subscriptions when the provider application changes:
  - Remove the listener for the previous provider application
  - Add a listener for the new provider application
  - Process any existing rule immediately after subscribing
- The router must handle empty invoker lists gracefully by returning early without modification

**Acceptance**:
- When invokers are notified with a new provider application, the router subscribes to that application's affinity rules
- When the provider application changes across notifications, the router removes the old subscription and creates a new one
- When the provider application is empty, the router logs a warning and does not attempt subscription
- When the provider application equals the current consumer application, the router does not subscribe to rules
- When an application-level affinity rule exists, the router applies affinity filtering to all services from that provider application

---

### FR4: Router Factory Components

**Problem**: The new affinity router implementations need to be registered with the Dubbo extension system to be automatically activated in the router chain.

**Requirements**:
- Implement a service-level affinity router factory that creates `AffinityServiceStateRouter` instances
- Implement an application-level affinity router factory that creates `AffinityProviderAppStateRouter` instances
- Both factories must extend `CacheableStateRouterFactory` to support router instance caching per service key
- The service-level factory must be activated with order 130 to ensure proper positioning in the router chain
- The application-level factory must be activated with order 135, placing it after service-level routing
- Factories must be annotated with `@Activate` to enable automatic SPI activation

**Acceptance**:
- When a consumer subscribes to a service, the router factories create appropriate affinity router instances
- When router factories are queried multiple times for the same service key, they return the cached router instance
- When the router chain is built, the service-level affinity router (order 130) is positioned before the application-level affinity router (order 135)


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
