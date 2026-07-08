# Software Requirements Specification: Logging FQCN Infrastructure Enhancement

## Overview

This milestone enhances the Dubbo logging infrastructure to support customizable Fully Qualified Class Name (FQCN) parameters across all logging adapters. The current implementation uses a hardcoded FQCN value, causing log output to incorrectly report the caller location as an internal wrapper class instead of the actual source class making the log call.

### Requirements Summary

1. **FR1**: Extend LoggerAdapter interface with FQCN-aware logger retrieval methods
2. **FR2**: Implement FQCN support in Log4j logger adapter
3. **FR3**: Implement FQCN support in Log4j2 logger adapter
4. **FR4**: Implement FQCN support in SLF4J logger adapter
5. **FR4a**: Implement FQCN support in JCL (Commons Logging) logger adapter
6. **FR4b**: Implement FQCN support in JDK logger adapter
7. **FR5**: Add FQCN-aware factory methods to LoggerFactory
8. **FR6**: Update FluentLoggerImpl to use correct FQCN for caller identification

### Affected Modules

- dubbo-common (logging infrastructure)

---

## Functional Requirements

### FR1: Extend LoggerAdapter Interface with FQCN Support

**Problem**: The LoggerAdapter interface only provides methods to retrieve loggers by Class or String key, with no mechanism to specify the FQCN for accurate caller location reporting.

**Requirements**:
- Add overloaded `getLogger` methods that accept an FQCN parameter in addition to the key
- Methods should accept FQCN as the first parameter followed by either Class or String key
- Provide default implementations that delegate to existing methods for backward compatibility
- Existing adapter implementations not supporting custom FQCN should continue to function

**Acceptance**:
- `LoggerAdapter` interface must declare: `default Logger getLogger(String fqcn, Class<?> key)` that delegates to `getLogger(key)` by default
- `LoggerAdapter` interface must declare: `default Logger getLogger(String fqcn, String key)` that delegates to `getLogger(key)` by default
- When a logger is requested with a custom FQCN, the returned logger uses that FQCN for location-aware logging
- When no FQCN is specified, existing behavior is preserved
- All existing LoggerAdapter implementations compile and function without modification

---

### FR2: Implement FQCN Support in Log4j Logger

**Problem**: The Log4j logger implementation uses a static FQCN constant, preventing customization of the caller class name reported in log output.

**Requirements**:
- Support configurable FQCN through constructor parameter
- Convert the static FQCN constant to an instance field
- Provide a constructor that accepts custom FQCN alongside the underlying logger
- Maintain backward compatibility with existing constructor
- Pass the configured FQCN to all logging calls

**Acceptance**:
- `Log4jLogger` must support construction with a custom FQCN parameter
- `Log4jLoggerAdapter` must override the FQCN-aware `getLogger` methods declared in FR1
- When Log4j logger is created with custom FQCN, all log levels (trace, debug, info, warn, error) use that FQCN
- Log4j adapter creates loggers with custom FQCN when requested
- Existing code using the adapter without FQCN continues to work

---

### FR3: Implement FQCN Support in Log4j2 Logger

**Problem**: The Log4j2 logger implementation does not support custom FQCN for location-aware logging, and uses basic Logger interface methods that don't support FQCN specification.

**Requirements**:
- Support configurable FQCN through constructor parameter
- Use `ExtendedLogger` interface from Log4j2 API which provides FQCN-aware logging methods (`logIfEnabled` with FQCN parameter)
- Replace direct logging calls (e.g., `logger.trace()`) with `logIfEnabled(fqcn, level, marker, message, throwable)` pattern
- Provide constructor accepting custom FQCN alongside the underlying logger
- Maintain backward compatibility with existing constructor

**Acceptance**:
- `Log4j2Logger` must support construction with a custom FQCN parameter
- `Log4j2Logger` must cast the underlying logger to `ExtendedLogger` to access FQCN-aware methods
- `Log4j2LoggerAdapter` must override the FQCN-aware `getLogger` methods declared in FR1
- When Log4j2 logger is created with custom FQCN, all log statements include correct caller location
- Log4j2 adapter creates loggers with custom FQCN when requested
- All log levels (trace, debug, info, warn, error) must use `logIfEnabled` with the configured FQCN

---

### FR4: Implement FQCN Support in SLF4J Logger

**Problem**: The SLF4J logger implementation uses a static FQCN constant, causing location-aware loggers to report incorrect source locations.

**Requirements**:
- Support configurable FQCN through constructor parameter
- Convert the static FQCN constant to an instance field
- Provide constructor accepting custom FQCN alongside the underlying SLF4J logger
- Pass configured FQCN to LocationAwareLogger calls when available
- Maintain backward compatibility with existing constructor
- Handle null exception parameters safely in logging methods

**Acceptance**:
- `Slf4jLogger` must support construction with a custom FQCN parameter
- `Slf4jLoggerAdapter` must override the FQCN-aware `getLogger` methods declared in FR1
- When SLF4J logger is created with custom FQCN, LocationAwareLogger operations use that FQCN
- SLF4J adapter creates loggers with custom FQCN when requested
- Logger correctly handles null Throwable parameters without throwing NullPointerException

---

### FR4a: Implement FQCN Support in JCL (Commons Logging) Logger

**Problem**: The JCL logger adapter does not support custom FQCN for API consistency with other logging adapters.

**Requirements**:
- Support configurable FQCN through constructor parameter in the logger class
- Store the FQCN as an instance field for API consistency across all adapters
- Provide a constructor that accepts custom FQCN alongside the underlying Commons Logging logger
- Maintain backward compatibility with existing constructor
- The adapter must override the FQCN-aware `getLogger` methods to create loggers with the specified FQCN

**Note**: Apache Commons Logging's `Log` interface does not natively support FQCN-based caller location. The FQCN parameter is accepted for API uniformity but the underlying framework limitation means caller location accuracy depends on the actual logging implementation bound at runtime.

**Acceptance**:
- `JclLogger` must support construction with a custom FQCN parameter
- `JclLoggerAdapter` must override the FQCN-aware `getLogger` methods declared in FR1
- JCL adapter creates loggers with custom FQCN when requested
- All log levels (trace, debug, info, warn, error) function correctly
- Existing code using the adapter without FQCN continues to work

---

### FR4b: Implement FQCN Support in JDK Logger

**Problem**: The JDK logger adapter does not support custom FQCN for accurate caller location reporting in log output.

**Requirements**:
- Support configurable FQCN through constructor parameter
- Store the FQCN as an instance field
- Provide a constructor that accepts custom FQCN alongside the underlying JDK logger
- Maintain backward compatibility with existing constructor
- The adapter must override the FQCN-aware `getLogger` methods to create loggers with the specified FQCN

**Note**: The JDK `java.util.logging.Logger` provides `logp()` methods that accept source class name parameter, which can be utilized for FQCN-aware logging if needed. However, for API consistency, the implementation may simply store the FQCN without changing the underlying logging calls.

**Acceptance**:
- `JdkLogger` must support construction with a custom FQCN parameter
- `JdkLoggerAdapter` must override the FQCN-aware `getLogger` methods declared in FR1
- JDK adapter creates loggers with custom FQCN when requested
- All log levels (trace, debug, info, warn, error) function correctly
- Existing code using the adapter without FQCN continues to work

---

### FR5: Add FQCN-Aware Factory Methods to LoggerFactory

**Problem**: LoggerFactory provides no mechanism to obtain loggers with custom FQCN for accurate caller identification in wrapper classes.

**Requirements**:
- Add overloaded `getErrorTypeAwareLogger` methods accepting FQCN parameter
- Methods should accept FQCN as first parameter, followed by Class or String key
- Logger cache must distinguish between loggers with different FQCN values for the same key
- Use composite cache keys combining logger name and FQCN

**Acceptance**:
- `LoggerFactory` must provide: `ErrorTypeAwareLogger getErrorTypeAwareLogger(String fqcn, Class<?> key)`
- `LoggerFactory` must provide: `ErrorTypeAwareLogger getErrorTypeAwareLogger(String fqcn, String key)`
- Cache must use a composite key structure to distinguish loggers with different FQCNs for the same logger name
- When requesting logger with FQCN, the underlying logger adapter receives the FQCN parameter
- Loggers with different FQCNs for the same key are cached separately
- When same FQCN and key combination is requested multiple times, cached logger is returned

---

### FR6: Update FluentLoggerImpl for Correct Caller Identification [EXTENDED - No Test Coverage]

**Problem**: FluentLoggerImpl acts as a wrapper around the actual logger, but log entries report FluentLoggerImpl or internal wrapper classes as the source instead of the actual calling class.

**Requirements**:
- FluentLoggerImpl must pass its own class name as the FQCN when obtaining the delegate logger
- Use the FQCN-aware factory methods from LoggerFactory
- Apply this change to both Class-based and String-based constructor overloads

**Acceptance**:
- Both constructors must use FQCN-aware factory methods with FluentLoggerImpl's class name as the FQCN parameter
- When logging through FluentLogger, the reported caller location reflects the class that called FluentLogger methods
- Stack trace filtering correctly identifies the actual caller by excluding FluentLoggerImpl from the call stack

**Note**: This requirement has no test coverage in the existing test suite and is marked as EXTENDED.

---

## Acceptance Criteria

The following test scenarios must pass:

1. All logging adapter implementations (JCL, JDK, Log4j, SLF4J, Log4j2) correctly accept and utilize FQCN parameter when creating loggers
2. Logger test suite validates all log levels (error, warn, info, debug, trace) work correctly across all adapters with FQCN support
3. Parameterized logging with arguments functions correctly with FQCN-aware loggers
4. Exception logging with and without message parameters works correctly
5. Existing functionality without FQCN specification continues to operate normally


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
