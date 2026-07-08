# Software Requirements Specification: M019 - Feature Enhancements - Minor Additions

## Overview

This milestone consolidates minor feature additions and enhancements to Apache Dubbo that extend functionality without introducing breaking changes. The requirements include:

1. **FR1**: Point-to-point network interface configuration option
2. **FR2**: Triple protocol exception serialization support
3. **FR3**: Nacos metadata report listener enhancement for multiple references
4. **FR4**: Metadata service exporter null safety improvement
5. **FR5**: Maven OS detection plugin configuration for cross-platform builds

**Affected Modules**:
- dubbo-common
- dubbo-config-api
- dubbo-metadata-api
- dubbo-metadata-report-nacos
- dubbo-registry-api
- dubbo-remoting-api
- dubbo-remoting-http3
- dubbo-rpc-triple
- dubbo-plugin/dubbo-security

---

## Requirements

### FR1: Point-to-Point Network Interface Configuration Option

**Problem**: Dubbo applications cannot selectively ignore point-to-point network interfaces (such as VPN tunnel interfaces) when discovering local IP addresses, causing incorrect address registration in certain network environments.

**Requirements**:
- Provide a configuration property to control whether point-to-point network interfaces should be ignored during network interface enumeration
- The configuration should default to not ignoring point-to-point interfaces (preserving backward compatibility)
- When enabled, network interfaces identified as point-to-point should be filtered out from the list of valid network interfaces used for service registration

**Acceptance**:
- When the point-to-point ignore configuration is disabled (default), point-to-point network interfaces are included in network interface discovery
- When the point-to-point ignore configuration is enabled, network interfaces that return true for `isPointToPoint()` are excluded from consideration
- Existing behavior for other ignored interface configurations remains unchanged

---

### FR2: Triple Protocol Exception Serialization Support

**Problem**: When Triple protocol REST services throw exceptions, the exceptions cannot be properly serialized and transmitted to clients because certain exception classes are not in the deserialization allowlist, resulting in serialization failures.

**Requirements**:
- Identify and add HTTP/REST-related exception classes to the serialization allowlist to enable proper exception handling in Triple protocol
- Ensure all relevant exception types that may be thrown during REST service invocation can be serialized

**Acceptance**:
- When a REST service method throws HTTP or REST-related exceptions, the exceptions are properly serialized and returned to the client
- Bean argument POST requests to REST endpoints function correctly with proper exception handling
- Exception details are correctly transmitted to the client side for debugging purposes

---

### FR3: Nacos Metadata Report Listener Enhancement

**Problem**: When multiple service references share the same service key but have different subscribed URL parameters, only one listener is registered because the existing implementation checks if a listener already exists for the service key before adding a new one.

**Requirements**:
- Allow adding service mapping listeners to NacosMetadataReport without checking if a listener for the service key already exists
- Support scenarios where multiple references with the same service key need separate listeners due to different URL parameters

**Acceptance**:
- When multiple references subscribe to the same service key with different URL parameters, each reference receives its own mapping listener
- Service mapping updates are correctly propagated to all registered listeners for a given service key

---

### FR4: Metadata Service Exporter Null Safety Improvement

**Problem**: The metadata service exporter can encounter a NullPointerException when checking export status because it assumes the service configuration is always initialized before the check.

**Requirements**:
- Improve the export condition check to handle cases where service configuration may be null
- Provide a method to safely retrieve exported URLs that handles both v1 and v2 metadata service configurations
- Ensure the exporter correctly reports exported URLs from both v1 and v2 services when both are present

**Acceptance**:
- When metadata service export is called multiple times, no NullPointerException is thrown
- The exported URLs list correctly includes URLs from both v1 and v2 metadata services when applicable
- Log messages accurately reflect the complete list of exported metadata service URLs

---

### FR5: Maven OS Detection Plugin Configuration

**Problem**: Modules that depend on OS-type detection for native library selection fail to build correctly in Eclipse m2e environment because the os-maven-plugin is only configured as a build extension, which Eclipse m2e does not process.

**Requirements**:
- Configure os-maven-plugin as both a build plugin (for Eclipse m2e compatibility) and a build extension (for standard Maven builds) in affected modules
- Apply this configuration to:
  - dubbo-security module
  - dubbo-remoting-http3 module
  - dubbo-rpc-triple module
- Use a centralized version property for the plugin version

**Acceptance**:
- Affected modules build successfully when using standard `mvn install` command
- Affected modules build successfully when imported and built in Eclipse IDE with m2e
- OS-type detection properties (e.g., os.detected.classifier) are available during the build lifecycle


---

# Environment Dependency Changes (relative to Base Env)

No changes detected.
