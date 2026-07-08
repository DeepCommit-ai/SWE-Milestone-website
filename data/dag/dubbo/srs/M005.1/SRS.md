# Software Requirements Specification: Affinity Router Core Infrastructure and Model

## Overview

This milestone introduces the core infrastructure for the Affinity Router feature in Apache Dubbo's clustering module. The Affinity Router enables consumers to preferentially route requests to service providers that share common attributes (such as region, zone, or data center) while providing graceful fallback when affinity-matched providers are insufficient.

### Requirements Summary

1. **FR1**: Implement core affinity state router with configurable affinity key matching
2. **FR2**: Implement ratio-based fallback mechanism for affinity routing
3. **FR3**: Implement affinity state router factory for router instantiation
4. **FR4**: Implement affinity router rule model for configuration representation
5. **FR5**: Implement YAML-based rule parser for affinity configuration
6. **FR6**: Add affinity-related constants to the cluster constants interface

### Affected Modules

- `dubbo-cluster` module
- Package: `org.apache.dubbo.rpc.cluster.router.affinity`
- Package: `org.apache.dubbo.rpc.cluster.router.affinity.config.model`
- Interface: `org.apache.dubbo.rpc.cluster.Constants`

---

## Functional Requirements

### FR1: Core Affinity State Router

**Problem**: Distributed services deployed across multiple regions or zones need the ability to preferentially route requests to providers within the same region or zone to reduce latency and improve performance.

**Requirements**:
- Implement an affinity-aware state router that extends the existing state router infrastructure
- Support configurable affinity keys (e.g., "region", "zone", "datacenter") that define the attribute used for affinity matching
- Match invokers based on whether their URL parameters contain the same value for the configured affinity key as the consumer
- Support enabling/disabling the router via configuration
- Return all invokers unchanged when the router is disabled
- Return all invokers unchanged when the input invoker list is empty
- Support runtime evaluation capability configurable via URL parameters
- Properly initialize condition matchers when the router is enabled
- Validate that the affinity key rule is not null or empty during initialization

**Acceptance**:
- When affinity routing is enabled with key "region" and consumer has region=east, invokers with region=east are preferentially selected
- When affinity routing is disabled, all invokers are returned without filtering
- When the affinity key is empty or null, initialization fails with an IllegalArgumentException
- When invoker list is empty, an empty list is returned immediately

---

### FR2: Ratio-Based Fallback Mechanism

**Problem**: Strict affinity routing may result in insufficient provider instances when too few providers match the affinity criteria, potentially causing service degradation or failure.

**Requirements**:
- Implement a ratio threshold mechanism that determines when to use affinity-filtered results versus falling back to all invokers
- The ratio represents the minimum percentage of invokers that must match the affinity criteria for the filtered result to be used
- When the ratio of matched invokers to total invokers falls below the configured ratio threshold, fall back to returning all invokers
- Log a warning when fallback occurs to aid in monitoring and troubleshooting
- Support configurable ratio values with a default value of 0 (meaning affinity results are always used if any matches exist)
- The ratio comparison should be: `(matched_count / total_count) >= (ratio / 100)`

**Acceptance**:
- When ratio is set to 20 and 3 out of 10 invokers match (30%), the filtered result is returned
- When ratio is set to 50 and 3 out of 10 invokers match (30%), all invokers are returned as fallback
- When ratio is set to 0, any non-empty match result is used
- When fallback occurs, a warning message is logged indicating the affinity result was ignored

---

### FR3: Affinity State Router Factory

**Problem**: The Dubbo router infrastructure requires factory classes to instantiate router implementations following the framework's extension mechanism.

**Requirements**:
- Implement a factory class that creates affinity state router instances
- Extend the cacheable state router factory base class to support router caching
- Create router instances with the provided URL containing configuration parameters
- Define a constant NAME identifier for the factory

**Acceptance**:
- When the factory's createRouter method is called with a URL, a properly configured AffinityStateRouter instance is returned
- The factory integrates with Dubbo's extension loading mechanism

---

### FR4: Affinity Router Rule Model

**Problem**: Affinity routing configuration needs a structured model class to represent and validate rule parameters.

**Requirements**:
- Implement a rule model class that extends the abstract router rule base class
- Support parsing configuration from a Map structure
- Store the affinity key that defines which URL parameter to match
- Store the ratio value that defines the fallback threshold
- Validate that the ratio value is between 0 and 100 (inclusive)
- Mark the rule as invalid and log an error when ratio validation fails
- Use the default affinity ratio when ratio is not specified in configuration
- Extract affinity configuration from the "affinityAware" key in the configuration map

**Acceptance**:
- When parsing a valid configuration map with key="region" and ratio=20, the rule model contains these values
- When parsing a configuration with ratio=150, the rule is marked as invalid and an error is logged
- When parsing a configuration with ratio=-10, the rule is marked as invalid and an error is logged
- When ratio is not specified, the default ratio value (0) is used

---

### FR5: YAML-Based Rule Parser

**Problem**: Affinity routing rules need to be parsed from YAML configuration files stored in the configuration center.

**Requirements**:
- Implement a parser that converts raw YAML strings into AffinityRouterRule objects
- Use safe YAML parsing to prevent security vulnerabilities
- Validate that the configuration version starts with "v3.1"
- Validate that the affinity key is not empty
- Mark the rule as invalid when version validation fails
- Mark the rule as invalid when affinity key validation fails
- Store the raw rule string in the parsed rule object for reference

**Acceptance**:
- When parsing a valid YAML configuration with configVersion "v3.1", scope, key, and affinityAware section, a valid rule is returned
- When parsing a configuration with configVersion "v2.0", the rule is marked as invalid
- When parsing a configuration with empty affinityKey, the rule is marked as invalid
- The raw YAML string is preserved in the parsed rule object

---

### FR6: Cluster Constants for Affinity Routing

**Problem**: The affinity routing feature requires new constant definitions for configuration keys and default values.

**Requirements**:
- Add AFFINITY_KEY constant with value "affinityAware" for identifying affinity configuration sections
- Add RATIO_KEY constant with value "ratio" for the ratio parameter key
- Add TRAFFIC_DISABLE_KEY constant with value "trafficDisable"
- Add DefaultRouteRatio constant with default value of 0
- Add DefaultRoutePriority constant with default value of 0
- Add DefaultAffinityRatio constant with default value of 0.0

**Acceptance**:
- The AFFINITY_KEY constant equals "affinityAware"
- The RATIO_KEY constant equals "ratio"
- The DefaultAffinityRatio constant equals 0.0
- Constants are accessible from the cluster Constants interface

---

## Configuration Schema

The affinity router supports the following YAML configuration format:

```yaml
configVersion: v3.1
scope: service  # Or application
key: service.apache.com
enabled: true
runtime: true
affinityAware:
  key: region    # The URL parameter key to match
  ratio: 20      # Minimum percentage of matches required (0-100)
```

### Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| configVersion | string | Yes | Must start with "v3.1" |
| scope | string | Yes | "service" or "application" |
| key | string | Yes | Service or application identifier |
| enabled | boolean | No | Enable/disable the router (default: true) |
| runtime | boolean | No | Runtime evaluation support (default: false) |
| affinityAware.key | string | Yes | URL parameter key for affinity matching |
| affinityAware.ratio | number | No | Fallback threshold percentage (default: 0, range: 0-100) |


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
