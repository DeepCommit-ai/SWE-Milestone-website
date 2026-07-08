# Software Requirements Specification: Lua Scripts Externalization

## Overview

This specification defines requirements for migrating embedded Lua scripts to separate `.lua` files across the go-zero framework's Redis-based components. The affected modules include:

1. **Bloom Filter** (`core/bloom`) - Scripts for bit operations in probabilistic data structures
2. **Period Limiter** (`core/limit`) - Script for time-window based rate limiting
3. **Token Limiter** (`core/limit`) - Script for token bucket rate limiting
4. **Redis Lock** (`core/stores/redis`) - Scripts for distributed lock acquisition and release

The migration uses Go's embed directive to load Lua scripts at compile time while maintaining full backward compatibility with existing functionality.

---

## Requirements

### FR1: Externalize Bloom Filter Lua Scripts

**Problem**: Lua scripts for bloom filter operations (setting and testing bits) are embedded as string literals within Go source code, making them difficult to maintain, review, and customize independently.

**Requirements**:
- Extract the bloom filter "set" operation Lua script to a dedicated `.lua` file alongside the Go source
- Extract the bloom filter "test" operation Lua script to a dedicated `.lua` file alongside the Go source
- Load both scripts at compile time using Go's embed mechanism
- Maintain identical script behavior for setting bits in the bloom filter bitset
- Maintain identical script behavior for testing bit presence in the bloom filter

**Acceptance**:
- When adding an element to the bloom filter, the external Lua script executes and sets the appropriate bits
- When checking element existence, the external Lua script executes and returns correct boolean result
- Existing bloom filter tests continue to pass without modification
- The `.lua` files are located in the same package directory as the Go source

---

### FR2: Externalize Period Limiter Lua Script

**Problem**: The period-based rate limiter's Lua script is embedded as a string literal, making it difficult to maintain, audit, and customize the rate limiting logic.

**Requirements**:
- Extract the period limit Lua script to a dedicated `.lua` file alongside the Go source
- Load the script at compile time using Go's embed mechanism
- Preserve the script's rate limiting logic including the compatibility pattern for Aliyun Redis
- Maintain identical return codes for allowed, hit-quota, and over-quota states

**Acceptance**:
- When requesting a permit within quota, the limiter returns the appropriate allowed state
- When hitting the quota exactly, the limiter returns the hit-quota state
- When exceeding the quota, the limiter returns the over-quota state
- Existing period limiter tests continue to pass without modification

---

### FR3: Externalize Token Limiter Lua Script

**Problem**: The token bucket rate limiter's Lua script is embedded as a string literal, complicating maintenance and independent review of the rate limiting algorithm.

**Requirements**:
- Extract the token bucket limit Lua script to a dedicated `.lua` file alongside the Go source
- Load the script at compile time using Go's embed mechanism
- Preserve the token bucket algorithm including token refill calculations
- Maintain the compatibility pattern for Aliyun Redis (avoiding `local key = KEYS[1]` pattern)

**Acceptance**:
- When tokens are available, the limiter allows requests and correctly decrements the token count
- When tokens are depleted, the limiter denies requests
- Token refill occurs correctly based on elapsed time and configured rate
- Existing token limiter tests continue to pass without modification

---

### FR4: Externalize Redis Lock Lua Scripts

**Problem**: The distributed lock implementation's Lua scripts for lock acquisition and release are embedded as string literals, hindering maintainability and independent script auditing.

**Requirements**:
- Extract the lock acquisition Lua script to a dedicated `.lua` file alongside the Go source
- Extract the lock release (delete) Lua script to a dedicated `.lua` file alongside the Go source
- Load both scripts at compile time using Go's embed mechanism
- Preserve atomic lock acquisition semantics with ownership verification and expiration
- Preserve atomic lock release semantics with ownership verification

**Acceptance**:
- When acquiring a lock, the script atomically checks ownership and sets/extends the lock with correct expiration
- When releasing a lock, the script atomically verifies ownership before deletion
- Lock acquisition returns success when lock is available or already owned
- Lock release returns success only when the caller owns the lock
- Existing Redis lock tests continue to pass without modification

---

### FR5: Consistent Variable Naming Convention

**Problem**: Variable naming for embedded scripts should follow a consistent pattern to improve code readability and maintainability.

**Requirements**:
- Use a consistent naming pattern where the embedded string variable indicates it contains Lua script content
- Use a consistent naming pattern for the Redis script object derived from the embedded content
- Apply this naming convention uniformly across all migrated components

**Acceptance**:
- All embedded Lua content variables follow the established naming pattern
- All Redis script objects follow the established naming pattern
- Code compiles and all existing tests pass with the new naming convention


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
