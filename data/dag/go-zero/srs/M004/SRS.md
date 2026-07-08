# Software Requirements Specification: CPU Monitoring and Adaptive Shedding

## Overview

This milestone addresses CPU monitoring and adaptive load shedding improvements across the go-zero framework:

1. **FR1**: Introduce generic mathematical range utility functions for value clamping operations
2. **FR2**: Implement dynamic overload factor calculation for adaptive shedding based on CPU utilization
3. **FR3**: Optimize shedding algorithm with improved calculation precision and performance
4. **FR4**: Add cgroup v2 support for CPU statistics collection on Linux systems
5. **FR5**: Implement graceful fallback handling when cgroup facilities are unavailable

**Affected Modules**:
- `core/mathx` - Mathematical utilities
- `core/load` - Adaptive load shedding
- `core/stat/internal` - CPU statistics collection
- `rest` and `zrpc` configuration

---

## FR1: Mathematical Range Utility Functions

**Problem**: The codebase lacks reusable generic functions for common value-bounding operations such as clamping values to minimum bounds, maximum bounds, or ranges.

**Requirements**:
- Provide generic functions that support value-bounding operations:
  - A lower-bound function that returns the greater of a value or a specified lower bound
  - An upper-bound function that returns the smaller of a value or a specified upper bound
  - A range-clamping function that constrains a value to a specified range, respecting both lower and upper bounds
- All functions must support standard numeric types including signed integers, unsigned integers, and floating-point types
- Functions must use Go generics to provide type safety without requiring type conversions
- When a range constraint has a lower bound greater than the upper bound, the lower bound should take precedence

**Acceptance**:
- Three generic mathematical utility functions are available for numeric type constraints
- The lower-bound function returns the greater of the input value or the specified lower bound
- The upper-bound function returns the smaller of the input value or the specified upper bound
- The range-clamping function clamps values to the specified range, with defined behavior when bounds are invalid
- All functions work consistently with standard numeric types (int/int8/int16/int32/int64, uint/uint8/uint16/uint32/uint64, float32/float64)

---

## FR2: Dynamic Overload Factor for Adaptive Shedding

**Problem**: The adaptive shedder makes binary shedding decisions based solely on whether CPU exceeds a threshold, leading to aggressive request dropping that doesn't scale proportionally with the severity of overload.

**Requirements**:
- Calculate a dynamic overload factor based on current CPU utilization relative to the configured threshold
- The overload factor should scale the maximum allowable in-flight requests based on how far CPU usage is above the threshold
- When CPU is at or below the threshold, the full calculated maximum flight capacity should be used
- When CPU is significantly above the threshold, the allowable capacity should be reduced proportionally
- Even under severe CPU overload, a minimum percentage (10%) of normal request capacity must be accepted to prevent complete service blackout
- The overload factor must be bounded between the minimum floor value and 1.0
- The calculation must handle edge cases where CPU maximum and threshold values are equal to avoid division errors

**Acceptance**:
- Adaptive shedder implements dynamic overload factor calculation
- The overload factor reflects the ratio of remaining CPU capacity relative to the safety threshold
- Factor calculation: (maximum_cpu_capacity - current_cpu_usage) / (maximum_cpu_capacity - cpu_threshold)
- Maximum CPU capacity is measured in millicpu units (1000 = full capacity)
- Overload factor is bounded to the range [0.1, 1.0], preventing complete request rejection even under severe overload
- When CPU is at or below threshold, the overload factor is 1.0 (full capacity)
- When deciding on high throughput shedding, multiply the maximum allowed in-flight requests by the overload factor
- Graceful handling of boundary conditions, particularly when CPU threshold approaches maximum capacity

---

## FR3: Shedding Algorithm Calculation Optimization

**Problem**: The max flight calculation uses integer division which loses precision, and the algorithm can be optimized for better performance.

**Requirements**:
- Optimize the shedding algorithm to improve calculation precision:
  - Current implementation loses precision due to integer-based arithmetic
  - Solution requires shifting to floating-point arithmetic throughout the calculation pipeline
- Pre-compute a window scale factor that normalizes time periods into a consistent multiplicative constant
  - This factor combines time unit conversions (seconds to bucket duration, milliseconds) into a single value
  - The scaling factor is determined during initialization and remains constant
- Recalculate the maximum in-flight requests formula:
  - Maximum in-flight = maximum pass-through rate × minimum response time × window scale factor
  - The result must be bounded to a minimum value of 1.0 to prevent arithmetic errors
- Update all comparisons involving maximum in-flight requests to use floating-point operations consistently

**Acceptance**:
- The shedding algorithm uses floating-point arithmetic throughout instead of integer division
- Window scale factor is pre-computed during initialization as a constant combining time unit conversions
- Maximum in-flight calculation is updated to multiply: pass count × response time × window scale factor
- All intermediate calculations and comparisons use floating-point values
- Maximum in-flight value is clamped to a minimum of 1.0
- Throughput comparisons correctly use floating-point operations for consistency

---

## FR4: Cgroup v2 CPU Statistics Support

**Problem**: CPU usage collection fails on systems running cgroup v2 (unified hierarchy) because the code reads cgroup v1-specific files that don't exist in cgroup v2.

**Requirements**:
- Detect whether the system is running cgroup v1 or cgroup v2 unified hierarchy
- Extend the cgroup interface to support both v1 and v2 implementations
- For cgroup v2 systems:
  - Retrieve CPU quota information from the appropriate v2 locations
  - Parse quota data in the specified format when multiple fields are present
  - Handle special cases indicating unlimited quota (typically represented as a keyword)
  - Retrieve CPU usage metrics from v2-specific files and convert to consistent time units
  - Retrieve effective CPU core count from v2-specific locations
- Simplify the cgroup interface to return computed values:
  - CPU quota as a computed ratio between quota and period (returns -1 for unlimited)
  - CPU usage as a single time value in nanoseconds
  - Effective CPUs as an integer count rather than a raw list
- Maintain backward compatibility with cgroup v1 systems

**Acceptance**:
- The cgroup interface supports both v1 and v2 implementations
- CPU quota method returns the quota-to-period ratio as a floating-point number, or -1 for unlimited quota
- CPU usage method returns cumulative CPU time in nanoseconds for consistency
- Effective CPUs method returns the count of available CPU cores as an integer
- cgroup v2 implementation reads from the unified hierarchy locations
- cgroup v2 handles special case values that indicate unlimited resources
- Unit conversions are performed to maintain consistent output formats (nanoseconds for time)
- cgroup v1 systems continue to work with their existing file structures
- File parsing errors are handled appropriately with error returns

---

## FR5: Graceful Fallback for Unavailable Cgroup

**Problem**: On systems where cgroup facilities are unavailable (e.g., WSL, containers without proper cgroup mounts), CPU monitoring initialization fails and may cause runtime errors or panics.

**Requirements**:
- Implement graceful degradation when cgroup facilities are not available:
  - Detect cgroup unavailability during initialization (file access failures, permission errors, panics)
  - Detect cgroup unavailability at runtime (exceptions during monitoring operations)
- When cgroup is unavailable:
  - CPU monitoring functions return 0 to indicate no load information available
  - This allows the system to continue operating without CPU-based shedding
- Error handling during initialization:
  - Capture and recover from panics that occur during cgroup initialization
  - Log all initialization errors appropriately
  - Prevent initialization errors from terminating the application
- Initialization behavior:
  - Initialization logic executes exactly once using appropriate synchronization
  - Subsequent calls to monitoring functions check availability status before attempting cgroup operations
  - Once availability status is determined, it persists for the application lifetime
- CPU usage capping:
  - All returned CPU usage values are bounded to a maximum of 1000 millicpu
  - This prevents overflow conditions and ensures valid utilization metrics

**Acceptance**:
- The system detects when cgroup facilities are unavailable and sets an internal flag to track this state
- Unavailable cgroup scenarios include: missing cgroup filesystem, insufficient permissions, initialization panics
- When cgroup is unavailable, CPU usage queries return 0 (no load information)
- Initialization handles exceptions gracefully without crashing:
  - Panics during initialization are caught and logged
  - Initialization errors are caught and logged
  - The system continues operating in degraded mode (no CPU-based shedding)
- Initialization runs exactly once via synchronization mechanism
- Subsequent calls check availability before attempting operations
- CPU usage values are capped at 1000 millicpu
- All errors and panics are logged for observability

---

## Environment Dependency Changes

This milestone introduces the following dependencies:

1. **Go Generics**: Requires Go 1.18+ for generic type parameters in FR1
2. **Cgroup v2 Detection**: Requires ability to read filesystem to detect cgroup version
3. **Synchronization**: Requires `sync.Once` or equivalent for one-time initialization in FR5
4. **Panic Recovery**: Requires deferred panic recovery mechanism for FR5
5. **Logging**: Requires error logging capability for FR5

---

## Implementation Notes

- All modifications maintain backward compatibility with existing cgroup v1 systems
- The adaptive shedding enhancements improve proportional load rejection without breaking existing behavior
- CPU monitoring gracefully degrades on unsupported platforms rather than failing completely
- Precision improvements in FR3 maintain the same behavioral semantics while improving numerical accuracy
- All changes are designed to be transparent to consuming code while improving system robustness
