# Software Requirements Specification: Spring Security OAuth2 Serialization Support

## Overview

This milestone addresses serialization failures for Spring Security OAuth2 authentication objects in Dubbo's distributed service communication. The dubbo-spring-security module provides security context transmission between Dubbo services, but multiple OAuth2 authentication classes from Spring Security cannot be properly serialized and deserialized using Jackson, preventing OAuth2 authentication contexts from being transmitted across service boundaries.

**Affected Module**: `dubbo-plugin/dubbo-spring-security`

**Requirements Summary**:
1. FR1: OAuth2 Authentication Principal Serialization - Enable serialization/deserialization of OAuth2 authenticated principal objects
2. FR2: Bearer Token Authentication Serialization - Enable serialization/deserialization of bearer token authentication objects
3. FR3: OAuth2 Client Authentication Token Serialization - Enable serialization/deserialization of OAuth2 client authentication tokens
4. FR4: Registered Client Serialization - Enable serialization/deserialization of OAuth2 registered client objects with JDK8/11 compatibility
5. FR5: Supporting OAuth2 Types Serialization - Enable serialization/deserialization of OAuth2 supporting types (grant types, authentication methods, settings)
6. FR6: OAuth2 Authorized Client Serialization - Enable serialization/deserialization of OAuth2 authorized client objects with client registration information

---

## FR1: OAuth2 Authentication Principal Serialization

**Problem**: Spring Security's OAuth2AuthenticatedPrincipal and DefaultOAuth2AuthenticatedPrincipal objects cannot be serialized and deserialized through Dubbo's ObjectMapperCodec, causing authentication context loss when transmitting security information between distributed services.

**User Report**:
```
When using Dubbo with Spring Security OAuth2 resource server, the authenticated principal
information cannot be passed to downstream services. Serializing OAuth2AuthenticatedPrincipal
fails with Jackson serialization errors, preventing proper authentication propagation.
```

**Requirements**:
- OAuth2AuthenticatedPrincipal interface implementations must be serializable to JSON and deserializable back to objects
- DefaultOAuth2AuthenticatedPrincipal must preserve name, attributes, and authorities across serialization round-trips
- Type information must be preserved in serialized form to enable proper deserialization

**Acceptance**:
- When an OAuth2AuthenticatedPrincipal is serialized and deserialized through ObjectMapperCodec, the resulting object retains its name, attributes, and granted authorities
- When a DefaultOAuth2AuthenticatedPrincipal with attributes and authorities is round-tripped through JSON serialization, all data is preserved

---

## FR2: Bearer Token Authentication Serialization

**Problem**: BearerTokenAuthentication objects from Spring Security's OAuth2 resource server cannot be serialized for transmission between Dubbo services, breaking authentication propagation in distributed OAuth2-secured systems.

**User Report**:
```
BearerTokenAuthentication cannot be serialized when transmitting security context
to downstream Dubbo services. The authentication token includes principal, credentials,
and authorities that all fail to serialize properly through the existing codec.
```

**Requirements**:
- BearerTokenAuthentication objects must be fully serializable including the embedded principal, credentials (OAuth2AccessToken), and authorities
- Serialization must include type information to support polymorphic deserialization
- The serialization must work with the existing ObjectMapperCodec infrastructure

**Acceptance**:
- When a BearerTokenAuthentication containing a principal, OAuth2AccessToken credentials, and granted authorities is serialized and deserialized, the resulting object is non-null and contains valid data
- When BearerTokenAuthentication is transmitted between Dubbo services via the security context, authentication information is preserved

---

## FR3: OAuth2 Client Authentication Token Serialization

**Problem**: OAuth2ClientAuthenticationToken from Spring Authorization Server cannot be serialized, preventing client authentication context from being shared across distributed authorization server components.

**User Report**:
```
Cannot serialize OAuth2ClientAuthenticationToken for distributed authorization server
deployments. The token contains client ID, authentication method, credentials, and
additional parameters that fail during Jackson serialization.
```

**Requirements**:
- OAuth2ClientAuthenticationToken must be serializable with client ID, client authentication method, credentials, and additional parameters
- ClientAuthenticationMethod enum values must serialize and deserialize correctly
- Nullable fields (credentials, additionalParameters) must be handled properly

**Acceptance**:
- When an OAuth2ClientAuthenticationToken with client ID, authentication method, credentials, and additional parameters is serialized and deserialized, the resulting object is valid
- When different ClientAuthenticationMethod values are used, they serialize and deserialize correctly

---

## FR4: Registered Client Serialization with JDK Compatibility

**Problem**: RegisteredClient objects from Spring Authorization Server cannot be serialized, and direct type references to ClientSettings and TokenSettings cause compilation failures on JDK8 and JDK11 due to class file version incompatibility.

**User Report**:
```
1. RegisteredClient serialization fails with Jackson errors when trying to persist
   or transmit client registration data.

2. Compilation error on JDK8/JDK11: The project fails to compile with errors related
   to ClientSettings and TokenSettings classes. These classes have class file version
   61.0 (Java 17) which cannot be loaded by JDK8 (52.0) or JDK11 (55.0) at compile time.
```

**Requirements**:
- RegisteredClient must be fully serializable including all fields: id, clientId, clientIdIssuedAt, clientSecret, clientSecretExpiresAt, clientName, clientAuthenticationMethods, authorizationGrantTypes, redirectUris, postLogoutRedirectUris, scopes, clientSettings, and tokenSettings
- The serialization implementation must compile successfully on JDK8 and JDK11 without direct compile-time references to Spring Authorization Server classes that require JDK17+
- ClientSettings and TokenSettings must serialize through a type-agnostic mechanism that avoids compile-time class loading. Specifically, any Jackson mixin or deserialization constructor must declare `clientSettings` and `tokenSettings` parameters as `Object` type rather than their actual Spring Authorization Server types
- The solution must still correctly serialize and deserialize these settings when run on JDK17+

**Acceptance**:
- When a RegisteredClient with all fields populated (including TokenSettings and ClientSettings with custom configurations) is serialized and deserialized, the resulting object is valid
- When the dubbo-spring-security module is compiled with JDK8 or JDK11, compilation succeeds without errors related to class file versions
- When running on JDK17+ with Spring Authorization Server available, RegisteredClient serialization works correctly

---

## FR5: Supporting OAuth2 Types Serialization

**Problem**: Various supporting OAuth2 types used within authentication objects cannot be serialized, causing complete serialization failure even when the parent objects have serialization support.

**User Report**:
```
Even after attempting to serialize OAuth2 authentication objects, failures occur
due to nested types: AuthorizationGrantType, ClientAuthenticationMethod, ClientSettings,
TokenSettings, and unmodifiable collections all fail to serialize properly.
```

**Requirements**:
- AuthorizationGrantType must serialize its value and deserialize back to the correct type
- ClientAuthenticationMethod must serialize its value and deserialize correctly
- ClientSettings must serialize its settings map and deserialize with full settings preservation
- TokenSettings must serialize its settings map and deserialize with full settings preservation
- Java collection wrapper types used internally by Spring Security (such as unmodifiable collection views) must be properly handled during deserialization to preserve their immutability characteristics

**Acceptance**:
- When AuthorizationGrantType values are included in serialized objects, they deserialize to the correct grant type
- When ClientSettings with custom settings are serialized, all settings are preserved after deserialization
- When TokenSettings with custom configurations are serialized, all configurations are preserved after deserialization
- When immutable collection wrappers are deserialized, their immutability is preserved

---

## FR6: OAuth2 Authorized Client Serialization

**Problem**: OAuth2AuthorizedClient objects, which represent the association between an OAuth2 client and an authorized end-user, cannot be serialized through Dubbo's ObjectMapperCodec. This prevents authorized client information (including client registration details and access tokens) from being transmitted between distributed services.

**User Report**:
```
When attempting to transmit OAuth2AuthorizedClient between Dubbo services, serialization
fails. The OAuth2AuthorizedClient contains a ClientRegistration with multiple nested
OAuth2 types (authorization grant types, authentication methods, URIs) that require
proper Jackson serialization support.
```

**Requirements**:
- OAuth2AuthorizedClient must be serializable including its embedded ClientRegistration, principal name, and OAuth2AccessToken
- ClientRegistration objects must serialize all configuration fields including registration ID, client credentials, authorization URIs, token URIs, and scopes
- The serialization must handle the various nested OAuth2 types (AuthorizationGrantType, ClientAuthenticationMethod) that are part of ClientRegistration

**Acceptance**:
- When an OAuth2AuthorizedClient with a fully configured ClientRegistration and access token is serialized and deserialized, the resulting object is valid and non-null
- When ClientRegistration containing grant types, authentication methods, and OAuth2 endpoint URIs is round-tripped through JSON serialization, all configuration is preserved

---

## Verification Scenarios

The implementation must support the following usage patterns commonly encountered in distributed OAuth2 systems:

1. **Resource Server Authentication Flow**: When a resource server receives a bearer token and creates an authentication context, that context (including the authenticated principal and token credentials) must be transmittable to downstream Dubbo services without data loss.

2. **Authorization Server Client Authentication**: When an authorization server authenticates a client using various authentication methods, the resulting authentication token must be serializable for distributed authorization server deployments.

3. **Client Registration Management**: When OAuth2 client registration data (including security settings and token configurations) needs to be shared across service instances, the complete registration object must serialize and deserialize correctly.

4. **Authorized Client State**: When an application maintains OAuth2 authorized client state (linking users to their authorized OAuth2 clients), this state must be persistable and transmittable through Dubbo's codec infrastructure.

---

## Technical Implementation Guidance

**Module Location**:
- Serialization support should be implemented within the `dubbo-plugin/dubbo-spring-security` module
- The implementation must integrate with the existing ObjectMapperCodec infrastructure

**Serialization Architecture**:
- The existing `ObjectMapperCodec` class already registers several Spring Security Jackson modules. Examine how these modules are loaded and registered to understand the extension pattern
- Jackson provides mechanisms to customize serialization for third-party classes without modifying those classes directly. Research Jackson's approach for adding serialization support to classes you don't control
- For polymorphic types (interfaces and abstract classes), the serialized JSON must include type information so that the deserializer knows which concrete class to instantiate. Jackson provides annotations to embed class type information in JSON output

**Runtime Compatibility**:
- The implementation must handle optional dependencies gracefully - if Spring Security OAuth2 classes are not present at runtime, the module should continue to function without errors
- Use class loading checks before registering type-specific serialization configurations
- JDK8/JDK11 compatibility must be maintained by avoiding compile-time dependencies on classes that require JDK17+. When referencing JDK17+ classes in serialization configurations, use String-based class names and runtime reflection rather than direct type references

**Dependency Investigation**:
- Review the Spring Security OAuth2 libraries' existing Jackson support by examining their jar contents for jackson-related packages
- Some types may already have partial support through existing modules - verify what works and what doesn't before implementing new serialization configurations

---

# Environment Dependency Changes (relative to Base Env)

Add test-scoped dependency for Spring Authorization Server types (RegisteredClient, OAuth2ClientAuthenticationToken, ClientSettings, TokenSettings, etc.) to enable serialization testing.
