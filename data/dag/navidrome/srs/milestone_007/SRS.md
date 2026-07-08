# Software Requirements Specification: Agent Logic Streamlining

## Overview

This specification defines requirements for streamlining the agent loading logic in the metadata agents subsystem. The changes aim to simplify agent management by removing unnecessary caching mechanisms and introducing structured agent type tracking.

### Summary of Requirements

1. **FR1**: Remove unnecessary agent caching mechanism
2. **FR2**: Introduce structured agent type representation
3. **FR3**: Optimize agent loading based on type classification
4. **FR4**: Ensure plugin loader is only invoked for actual plugin agents

### Affected Modules

- Metadata agents management (agent loading, instantiation, and type resolution)

---

## Functional Requirements

### FR1: Remove Unnecessary Agent Caching Mechanism

**Problem**: The agent loading system maintains a TTL-based cache for loaded agents, which adds synchronization overhead and complexity without proportional benefit since agent instantiation is lightweight.

**Requirements**:
- Remove the TTL-based caching layer from the agent management system
- Agent instances should be created fresh on each request cycle
- The synchronization primitives associated with cache access should be eliminated
- The Agents struct should no longer maintain a cache field

**Acceptance**:
- When the Agents struct is instantiated, no cache is initialized
- Agent loading operations proceed without cache lookup or storage steps
- Memory usage from cache data structures is eliminated

---

### FR2: Introduce Structured Agent Type Representation

**Problem**: The agent discovery process returns only agent names as strings, requiring the loading logic to probe both built-in and plugin sources to determine how to load each agent.

**Requirements**:
- Define a structured representation for enabled agents that includes both the agent name and its type classification (built-in vs plugin)
- The existing function that returns enabled agent names as strings should be refactored to return structured enabled agent representations instead
- The type classification should be determined at configuration parsing time, not at load time
- Built-in agents should be identified by checking the agent registry
- Plugin agents should be identified by checking available plugins from the plugin loader
- The local agent should always be classified as a built-in agent

**Acceptance**:
- The structured representation must contain:
  - The agent identifier
  - A boolean indicator distinguishing plugin agents from built-in agents
- When agents are configured with both built-in and plugin agents, each enabled agent entry correctly identifies whether it originates from a plugin source
- When only the local agent is configured (empty configuration), it is identified as a built-in agent
- Built-in agents must be distinguishable from plugin agents in the structured representation
- Plugin agents must be distinguishable from built-in agents in the structured representation

**Technical Constraint**: This structured representation is internal to the agent subsystem and should not be exported outside the package. Use unexported (package-private) identifiers following Go naming conventions.

---

### FR3: Optimize Agent Loading Based on Type Classification

**Problem**: The agent loading function probes multiple sources (built-in registry, then plugin loader) sequentially for every agent, regardless of whether the agent type is already known.

**Requirements**:
- The agent loading function should accept structured agent information that includes type classification
- For built-in agents, only the built-in agent registry should be consulted
- For plugin agents, only the plugin loader should be invoked
- Unknown or invalid agent names should continue to be filtered out during configuration parsing

**Acceptance**:
- When loading a built-in agent, only the built-in constructor is invoked
- When loading a plugin agent, only the plugin loader's load function is invoked
- When an invalid agent name is specified in configuration, it is ignored and no loading is attempted for it

---

### FR4: Ensure Plugin Loader Is Only Invoked for Actual Plugin Agents

**Problem**: The current implementation may invoke the plugin loader's LoadMediaAgent function for agents that are known to be built-in, which is inefficient.

**Requirements**:
- The plugin loader's LoadMediaAgent function must never be called for built-in agents
- The plugin loader's LoadMediaAgent function must only be called for agents that have been classified as plugins
- Invalid agent names that are not recognized as either built-in or plugin should not trigger any plugin loading attempts

**Acceptance**:
- When only built-in agents are configured, the plugin loader's LoadMediaAgent function is never called during agent resolution
- When a mix of built-in and plugin agents are configured, LoadMediaAgent is called only for the plugin agents
- When invalid agent names are in the configuration, LoadMediaAgent is not called for those invalid names
- When the configuration is empty (only local agent), the plugin loader's LoadMediaAgent function is never called

---

## Behavioral Requirements

### Agent Discovery Behavior

- When the agents configuration is empty, only the local agent should be included in the enabled agents list
- When the agents configuration is empty, no plugin agents should be included even if plugins are available
- When the agents configuration specifies agents, only those agents (plus the local agent if not already included) should be enabled
- The order specified in configuration must be preserved in the enabled agents list
- Plugin agents should only appear in the enabled list when explicitly configured

### Agent Loading Behavior

- Both built-in and plugin agents should be loadable when explicitly configured together
- The configuration order should determine the agent evaluation order when fetching metadata
- The local agent should always be appended if not explicitly included in configuration

---

## Test Verification

The following behaviors must be verified:

1. Only the local agent is enabled when no configuration is specified
2. Plugin agents are not included when no configuration is specified, even if plugins are available
3. Plugin agents are only included in the enabled list when explicitly configured
4. Only configured plugin agents are included; unconfigured plugins are excluded
5. Plugin agents are loaded on demand when configured
6. Both built-in and plugin agents can coexist and be correctly identified
7. The configuration-specified order is respected in the enabled agents list
8. LoadMediaAgent is never called for built-in agents
9. LoadMediaAgent is never called for invalid/unknown agent names


---

## Interface Contracts (Required Names & Signatures)

The structured agent type tracking must use these exact (unexported)
identifiers in `core/agents`:

- `type enabledAgent struct { name string; isPlugin bool }` — an enabled agent
  with its type information.
- `func (a *Agents) getEnabledAgentNames() []enabledAgent` — returns the
  ordered list of enabled agents (built-ins and plugins from config order),
  always including the local agent.
- `func (a *Agents) getAgent(ea enabledAgent) Interface` — instantiates the
  agent. Built-in agents must be resolved only via the built-in registry, and
  plugin agents only via the plugin loader; `LoadMediaAgent` must never be
  called for built-in or invalid agent names.

# Environment Dependency Changes (relative to Base Env)

## Go Packages
- github.com/onsi/ginkgo/v2/ginkgo v2.23.4 added (CLI tool for spec-level test reporting)
